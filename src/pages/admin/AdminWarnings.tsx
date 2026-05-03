import React, { useEffect, useState } from 'react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { AlertTriangle, Clock3, Search, Send } from 'lucide-react';
import { addDoc, collection, doc, getDocs, increment, query, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { searchUsersByQuery } from '../../lib/userSearch';
import { canModerateUsers } from '../../lib/adminPermissions';
import { logAdminAction } from '../../lib/adminLogs';

type WarningNotification = {
  id: string;
  message?: string;
  createdAt?: string;
  sourceDisplayName?: string;
};

function formatDateTime(value?: string) {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString();
}

export function AdminWarnings() {
  const { userProfile } = useAuth();
  const isAdmin = canModerateUsers(userProfile?.role);
  const isMember = userProfile?.role === 'member';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [warningText, setWarningText] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [memberWarnings, setMemberWarnings] = useState<WarningNotification[]>([]);
  const [memberLoading, setMemberLoading] = useState(true);

  useEffect(() => {
    if (!isMember || !userProfile?.uid || isAdmin) return;

    const fetchMyWarnings = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'notifications'), where('targetUserId', '==', userProfile.uid)));
        const notices = snapshot.docs
          .map((noticeDoc) => ({ id: noticeDoc.id, ...noticeDoc.data() }))
          .filter((notice: any) => notice.type === 'warning')
          .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')) as WarningNotification[];
        setMemberWarnings(notices);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      } finally {
        setMemberLoading(false);
      }
    };

    fetchMyWarnings();
  }, [isAdmin, isMember, userProfile?.uid]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const filtered = await searchUsersByQuery(searchQuery, { limit: 16 });
      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const sendWarning = async () => {
    if (!selectedUser || !warningText.trim() || !userProfile) return;
    setIsSending(true);

    try {
      await addDoc(collection(db, 'notifications'), {
        targetUserId: selectedUser.uid,
        sourceUserId: userProfile.uid,
        sourceDisplayName: userProfile.displayName,
        type: 'warning',
        title: 'You received a warning',
        message: warningText.trim(),
        createdAt: new Date().toISOString(),
        read: false,
      });

      const currentWarnings = selectedUser.warnings || 0;
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        warnings: currentWarnings + 1,
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Issued warning',
        targetType: 'user',
        targetId: selectedUser.uid,
        targetLabel: selectedUser.displayName,
        details: warningText.trim(),
      });

      alert(`Warning sent to ${selectedUser.username}`);
      setSearchResults((prev) =>
        prev.map((foundUser) =>
          foundUser.uid === selectedUser.uid
            ? { ...foundUser, warnings: (foundUser.warnings || 0) + 1 }
            : foundUser
        )
      );
      setWarningText('');
      setSelectedUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setIsSending(false);
    }
  };

  const removeWarning = async (selected: UserProfile) => {
    if (!selected.warnings || selected.warnings <= 0) return;
    if (window.confirm(`Are you sure you want to remove a warning from ${selected.username}?`)) {
      try {
        await updateDoc(doc(db, 'users', selected.uid), {
          warnings: increment(-1),
        });
        if (userProfile) {
          await logAdminAction({
            actorId: userProfile.uid,
            actorDisplayName: userProfile.displayName,
            actorRole: userProfile.role,
            action: 'Removed warning',
            targetType: 'user',
            targetId: selected.uid,
            targetLabel: selected.displayName,
          });
        }
        alert(`Warning removed from ${selected.username}`);
        setSearchResults((prev) =>
          prev.map((foundUser) =>
            foundUser.uid === selected.uid
              ? { ...foundUser, warnings: Math.max((foundUser.warnings || 0) - 1, 0) }
              : foundUser
          )
        );
        if (selectedUser?.uid === selected.uid) {
          setSelectedUser({
            ...selectedUser,
            warnings: Math.max((selectedUser.warnings || 0) - 1, 0),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users');
      }
    }
  };

  if (!isAdmin && !isMember) {
    return <div className="p-8 text-center text-red-500">Access Denied.</div>;
  }

  if (isMember && !isAdmin) {
    const warningCount = userProfile?.warnings || 0;
    const latestWarning = memberWarnings[0];

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center dark:text-white">
              <AlertTriangle className="mr-2 text-orange-500" /> My Warnings
            </h1>
          </div>
        </div>

        <div className="p-4 max-w-3xl mx-auto space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/30 p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-300">Total warnings</div>
              <div className="mt-3 flex items-end gap-3">
                <div className="text-4xl font-black text-orange-900 dark:text-orange-100">{warningCount}</div>
                <div className={`mb-1 rounded-full px-3 py-1 text-xs font-semibold ${warningCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/70 dark:text-orange-200' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                  {warningCount > 0 ? 'Needs attention' : 'Clear record'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest notice</div>
              {latestWarning ? (
                <div className="mt-3">
                  <div className="font-semibold text-gray-900 dark:text-white">{latestWarning.sourceDisplayName || 'Team moderation'}</div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Clock3 className="h-4 w-4" />
                    {formatDateTime(latestWarning.createdAt)}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">No warning notices yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Warning History</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">{memberWarnings.length} notice{memberWarnings.length === 1 ? '' : 's'}</div>
            </div>

            {memberLoading ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading your warnings...</div>
            ) : memberWarnings.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                You have no warning notices right now.
              </div>
            ) : (
              <div className="space-y-3">
                {memberWarnings.map((warning, index) => (
                  <motion.div
                    key={warning.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/70 dark:bg-orange-950/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-orange-900 dark:text-orange-100">{warning.sourceDisplayName || 'Team moderation'}</div>
                        <div className="mt-2 text-sm leading-6 text-orange-800 dark:text-orange-200">{warning.message || 'Warning issued.'}</div>
                      </div>
                      <div className="shrink-0 text-xs text-orange-600 dark:text-orange-300">{formatDateTime(warning.createdAt)}</div>
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
          <h1 className="text-xl font-bold flex items-center dark:text-white"><AlertTriangle className="mr-2 text-orange-500" /> Warnings Management</h1>
        </div>
      </div>

      <div className="p-4">
        <form onSubmit={handleSearch} className="mb-8 flex space-x-2 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search username to warn..."
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm dark:bg-gray-800 dark:text-white"
          />
          <Button type="submit" className="bg-orange-500 hover:bg-orange-600 rounded-xl px-6">Search</Button>
        </form>

        <AnimatePresence mode="wait">
          {searchResults.length > 0 && !selectedUser && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8"
            >
              <h2 className="text-lg font-bold mb-4 dark:text-white">Search Results</h2>
              <div className="space-y-3">
                {searchResults.map((foundUser, index) => (
                  <motion.div
                    key={foundUser.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar src={foundUser.photoURL} alt={foundUser.displayName} className="h-12 w-12" />
                      <div>
                        <div className="font-bold text-lg dark:text-white">{foundUser.displayName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">@{foundUser.username}</div>
                        <div className="text-xs text-orange-600 dark:text-orange-300 font-bold mt-1 bg-orange-50 dark:bg-orange-950/20 inline-block px-2 py-0.5 rounded-full">
                          Current Warnings: {foundUser.warnings || 0}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        className="rounded-full px-4 border-orange-200 text-orange-600 hover:bg-orange-50"
                        onClick={() => removeWarning(foundUser)}
                        disabled={!foundUser.warnings || foundUser.warnings <= 0}
                      >
                        Remove
                      </Button>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600 rounded-full px-6"
                        onClick={() => setSelectedUser(foundUser)}
                      >
                        Select
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {selectedUser && (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-orange-900 dark:text-orange-100">Issue Warning to</h2>
                <button onClick={() => setSelectedUser(null)} className="text-sm text-orange-600 hover:text-orange-800 font-medium hover:underline">Cancel</button>
              </div>

              <div className="flex items-center space-x-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-sm">
                <Avatar src={selectedUser.photoURL} alt={selectedUser.displayName} className="h-14 w-14" />
                <div>
                  <div className="font-bold text-lg dark:text-white">{selectedUser.displayName}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">@{selectedUser.username}</div>
                </div>
              </div>

              <textarea
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                placeholder="Enter detailed warning reason..."
                className="w-full border border-orange-200 dark:border-orange-900/40 rounded-xl p-4 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-orange-500 mb-6 shadow-inner resize-none dark:bg-gray-800 dark:text-white"
              />

              <Button
                onClick={sendWarning}
                disabled={!warningText.trim() || isSending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all"
              >
                <Send className="h-5 w-5 mr-2" /> {isSending ? 'Sending...' : 'Send Official Warning'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
