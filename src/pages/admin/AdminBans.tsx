import React, { useEffect, useState } from 'react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Ban, CheckCircle, Clock3, Plus, Search, X } from 'lucide-react';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { searchUsersByQuery } from '../../lib/userSearch';
import { canModerateUsers } from '../../lib/adminPermissions';
import { logAdminAction } from '../../lib/adminLogs';

type BanNotification = {
  id: string;
  message?: string;
  createdAt?: string;
  sourceDisplayName?: string;
};

type BanMode = 'permanent' | 'temporary';

function formatDateTime(value?: string | null) {
  if (!value) return 'No date set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date set';
  return parsed.toLocaleString();
}

function isFutureDate(value?: string | null) {
  return !!value && new Date(value) > new Date();
}

const clearedBanFields = {
  isBanned: false,
  banReason: null,
  bannedAt: null,
  bannedBy: null,
  banExpiresAt: null,
};

export function AdminBans() {
  const { userProfile } = useAuth();
  const isAdmin = canModerateUsers(userProfile?.role);
  const isMember = userProfile?.role === 'member';

  const [bannedUsers, setBannedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBanModal, setShowBanModal] = useState(false);
  const [banSearchQuery, setBanSearchQuery] = useState('');
  const [banSearchResults, setBanSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banMode, setBanMode] = useState<BanMode>('permanent');
  const [banExpiresAtInput, setBanExpiresAtInput] = useState('');
  const [banning, setBanning] = useState(false);

  const [memberHistory, setMemberHistory] = useState<BanNotification[]>([]);
  const [memberLoading, setMemberLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchBannedUsers = async () => {
      try {
        const bannedQuery = query(collection(db, 'users'), where('isBanned', '==', true));
        const snapshot = await getDocs(bannedQuery);
        const activeUsers: UserProfile[] = [];

        for (const bannedDoc of snapshot.docs) {
          const bannedUser = bannedDoc.data() as UserProfile;
          if (bannedUser.banExpiresAt && !isFutureDate(bannedUser.banExpiresAt)) {
            await updateDoc(doc(db, 'users', bannedUser.uid), clearedBanFields);
            continue;
          }
          activeUsers.push(bannedUser);
        }

        activeUsers.sort((a, b) => (b.bannedAt || '').localeCompare(a.bannedAt || ''));
        setBannedUsers(activeUsers);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };

    fetchBannedUsers();
  }, [isAdmin]);

  useEffect(() => {
    if (!isMember || !userProfile?.uid || isAdmin) return;

    const fetchMyBanHistory = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'notifications'), where('targetUserId', '==', userProfile.uid)));
        const notices = snapshot.docs
          .map((noticeDoc) => ({ id: noticeDoc.id, ...noticeDoc.data() }))
          .filter((notice: any) => notice.type === 'ban')
          .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')) as BanNotification[];
        setMemberHistory(notices);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      } finally {
        setMemberLoading(false);
      }
    };

    fetchMyBanHistory();
  }, [isAdmin, isMember, userProfile?.uid]);

  const handleBanSearch = async (searchVal: string) => {
    setBanSearchQuery(searchVal);
    if (!searchVal.trim()) {
      setBanSearchResults([]);
      return;
    }
    try {
      const filtered = await searchUsersByQuery(searchVal, {
        includeBanned: false,
        limit: 8,
      });
      setBanSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const banExpiryIso = banMode === 'temporary' && banExpiresAtInput ? new Date(banExpiresAtInput).toISOString() : null;
  const canSubmitBan = !!selectedUser && !!banReason.trim() && (banMode === 'permanent' || !!banExpiresAtInput) && (banMode === 'permanent' || isFutureDate(banExpiryIso));

  const banUser = async () => {
    if (!selectedUser || !banReason.trim() || !userProfile || !canSubmitBan) return;
    setBanning(true);

    const bannedAt = new Date().toISOString();
    const banMessage = banMode === 'temporary' && banExpiryIso
      ? `You have been banned until ${formatDateTime(banExpiryIso)}. Reason: ${banReason.trim()}`
      : `You have been permanently banned. Reason: ${banReason.trim()}`;

    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        isBanned: true,
        banReason: banReason.trim(),
        bannedAt,
        bannedBy: userProfile.uid,
        banExpiresAt: banExpiryIso,
      });

      await addDoc(collection(db, 'notifications'), {
        targetUserId: selectedUser.uid,
        sourceUserId: userProfile.uid,
        sourceDisplayName: userProfile.displayName,
        type: 'ban',
        title: 'Your account has been banned',
        message: banMessage,
        createdAt: bannedAt,
        read: false,
      });

      setBannedUsers((prev) => [
        {
          ...selectedUser,
          isBanned: true,
          banReason: banReason.trim(),
          bannedAt,
          bannedBy: userProfile.uid,
          banExpiresAt: banExpiryIso || undefined,
        },
        ...prev,
      ]);
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: banMode === 'temporary' ? 'Issued temporary ban' : 'Issued permanent ban',
        targetType: 'user',
        targetId: selectedUser.uid,
        targetLabel: selectedUser.displayName,
        details: banMode === 'temporary' && banExpiryIso
          ? `Reason: ${banReason.trim()}. Expires ${formatDateTime(banExpiryIso)}.`
          : `Reason: ${banReason.trim()}.`,
      });
      closeBanModal();
      alert(`${selectedUser.displayName} has been banned.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    } finally {
      setBanning(false);
    }
  };

  const unbanUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to unban this user?')) return;
    try {
      const user = bannedUsers.find((entry) => entry.uid === userId);
      await updateDoc(doc(db, 'users', userId), clearedBanFields);
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Removed ban',
          targetType: 'user',
          targetId: userId,
          targetLabel: user?.displayName || userId,
        });
      }
      setBannedUsers((prev) => prev.filter((bannedUser) => bannedUser.uid !== userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const closeBanModal = () => {
    setShowBanModal(false);
    setSelectedUser(null);
    setBanReason('');
    setBanSearchQuery('');
    setBanSearchResults([]);
    setBanMode('permanent');
    setBanExpiresAtInput('');
  };

  if (!isAdmin && !isMember) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  if (isMember && !isAdmin) {
    const activeBan = !!userProfile?.isBanned && (!userProfile?.banExpiresAt || isFutureDate(userProfile.banExpiresAt));
    const activeBanEnds = activeBan ? userProfile?.banExpiresAt : undefined;

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center dark:text-white">
              <Ban className="mr-2 text-red-500" /> My Ban Status
            </h1>
          </div>
        </div>

        <div className="p-4 max-w-3xl mx-auto space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`rounded-2xl border p-5 ${activeBan ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30' : 'border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/30'}`}>
              <div className={`text-sm font-semibold uppercase tracking-wide ${activeBan ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}`}>Current status</div>
              <div className="mt-3 flex items-center gap-3">
                {activeBan ? (
                  <>
                    <div className="text-3xl font-black text-red-900 dark:text-red-100">Restricted</div>
                    <div className="rounded-full bg-red-100 dark:bg-red-900/70 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-200">Active ban</div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-black text-green-900 dark:text-green-100">Clear</div>
                    <div className="rounded-full bg-green-100 dark:bg-green-900/60 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-200">No active ban</div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Restriction window</div>
              {activeBan ? (
                <div className="mt-3 space-y-2">
                  <div className="font-semibold text-gray-900 dark:text-white">{activeBanEnds ? 'Temporary ban' : 'Permanent ban'}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Clock3 className="h-4 w-4" />
                    {activeBanEnds ? `Ends ${formatDateTime(activeBanEnds)}` : 'No expiration set'}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">You do not have an active restriction.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Reason</h2>
            <div className={`rounded-xl px-4 py-4 text-sm leading-6 ${activeBan ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-100 dark:border-red-900/40' : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700'}`}>
              {activeBan ? (userProfile?.banReason || 'No reason was provided for this ban.') : 'No active ban reason to show.'}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ban History</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">{memberHistory.length} notice{memberHistory.length === 1 ? '' : 's'}</div>
            </div>

            {memberLoading ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading your restriction history...</div>
            ) : memberHistory.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                No ban notices found.
              </div>
            ) : (
              <div className="space-y-3">
                {memberHistory.map((notice, index) => (
                  <motion.div
                    key={notice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-red-900 dark:text-red-100">{notice.sourceDisplayName || 'Team moderation'}</div>
                        <div className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">{notice.message || 'Ban notice issued.'}</div>
                      </div>
                      <div className="shrink-0 text-xs text-red-600 dark:text-red-300">{formatDateTime(notice.createdAt)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Ban className="mr-2 text-red-500" /> Bans Management</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">
        <Button onClick={() => setShowBanModal(true)} className="mb-6 w-full text-lg h-14 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0">
          <Plus className="h-5 w-5 mr-2" /> Ban a User
        </Button>

        <AnimatePresence>
          {showBanModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                onClick={closeBanModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-red-900 dark:text-red-100 flex items-center"><Ban className="h-5 w-5 mr-2 text-red-500" /> Ban User</h2>
                  <button onClick={closeBanModal} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Select User *</label>
                    {selectedUser ? (
                      <div className="flex items-center justify-between p-3 border border-red-200 rounded-xl bg-red-50">
                        <div className="flex items-center space-x-3">
                          <Avatar src={selectedUser.photoURL} alt={selectedUser.displayName} size="sm" />
                          <div>
                            <div className="font-semibold text-sm">{selectedUser.displayName}</div>
                            <div className="text-xs text-gray-500">@{selectedUser.username}</div>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedUser(null); setBanSearchQuery(''); }} className="text-red-500 hover:text-red-600 text-sm font-medium">Change</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={banSearchQuery}
                          onChange={(e) => handleBanSearch(e.target.value)}
                          placeholder="Search for a user to ban..."
                          className="w-full border border-gray-300 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                        />
                        {banSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                            {banSearchResults.map((foundUser) => (
                              <button
                                key={foundUser.uid}
                                onClick={() => { setSelectedUser(foundUser); setBanSearchQuery(''); setBanSearchResults([]); }}
                                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Avatar src={foundUser.photoURL} alt={foundUser.displayName} size="sm" />
                                <div>
                                  <div className="font-semibold text-sm dark:text-white">{foundUser.displayName}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">@{foundUser.username}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Restriction Length *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBanMode('permanent')}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${banMode === 'permanent' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        Permanent
                      </button>
                      <button
                        type="button"
                        onClick={() => setBanMode('temporary')}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${banMode === 'temporary' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        Temporary
                      </button>
                    </div>
                    {banMode === 'temporary' && (
                      <div className="mt-3 space-y-2">
                        <input
                          type="datetime-local"
                          value={banExpiresAtInput}
                          onChange={(e) => setBanExpiresAtInput(e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                        />
                        <div className={`text-xs ${banExpiresAtInput && !isFutureDate(banExpiryIso) ? 'text-red-500' : 'text-gray-500'}`}>
                          {banExpiresAtInput && !isFutureDate(banExpiryIso)
                            ? 'Choose a future expiration time.'
                            : 'Temporary bans will automatically clear after this time.'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Reason *</label>
                    <textarea
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Enter the reason for banning this user..."
                      rows={4}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <Button
                    onClick={banUser}
                    disabled={!canSubmitBan || banning}
                    className="w-full h-12 rounded-xl text-lg bg-red-500 hover:bg-red-600 text-white border-0 disabled:opacity-50"
                  >
                    <Ban className="h-5 w-5 mr-2" /> {banning ? 'Banning...' : 'Confirm Ban'}
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <h2 className="text-lg font-bold mb-4 dark:text-white">Currently Banned Users ({bannedUsers.length})</h2>
        {loading ? (
          <div className="text-gray-500 text-center py-8">Loading banned users...</div>
        ) : bannedUsers.length === 0 ? (
          <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">No users are currently banned.</div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {bannedUsers.map((bannedUser) => (
                <motion.div
                  key={bannedUser.uid}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 border border-red-200 bg-red-50 rounded-xl"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <Avatar src={bannedUser.photoURL} alt={bannedUser.displayName} />
                      <div>
                        <div className="font-bold text-red-900">{bannedUser.displayName}</div>
                        <div className="text-sm text-red-700">@{bannedUser.username}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                            {bannedUser.banExpiresAt ? 'Temporary ban' : 'Permanent ban'}
                          </span>
                          {bannedUser.banExpiresAt && (
                            <span className="text-xs text-red-600">Ends {formatDateTime(bannedUser.banExpiresAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50 rounded-full px-6"
                      onClick={() => unbanUser(bannedUser.uid)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Unban
                    </Button>
                  </div>
                  {bannedUser.banReason && (
                    <div className="mt-3 ml-13 pl-12">
                      <div className="text-xs font-semibold text-red-800 mb-1">Ban Reason:</div>
                      <div className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">{bannedUser.banReason}</div>
                      <div className="mt-2 text-xs text-red-500 space-y-1">
                        {bannedUser.bannedAt && <div>Banned on {formatDateTime(bannedUser.bannedAt)}</div>}
                        {bannedUser.banExpiresAt && <div>Expires on {formatDateTime(bannedUser.banExpiresAt)}</div>}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
