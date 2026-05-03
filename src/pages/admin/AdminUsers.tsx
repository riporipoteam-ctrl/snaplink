import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, increment, deleteDoc, where, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Users, CheckCircle, Star, Coins, Shield, Crown, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { awardUserProgress, getLevelProgress, getTotalXpForLevel, MAX_LEVEL } from '../../lib/levels';
import { LevelBadge } from '../../components/ui/LevelBadge';
import { deletePostCascade } from '../../lib/dataCleanup';
import { matchesUserSearch } from '../../lib/userSearch';
import { logAdminAction } from '../../lib/adminLogs';

export function AdminUsers() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [coinAmount, setCoinAmount] = useState<{ [key: string]: string }>({});
  const [xpAmount, setXpAmount] = useState<{ [key: string]: string }>({});
  const [levelAmount, setLevelAmount] = useState<{ [key: string]: string }>({});
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [premiumUntilAmount, setPremiumUntilAmount] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(query(usersRef));
        setUsers(usersSnapshot.docs.map(doc => doc.data() as UserProfile));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [userProfile]);

  const toggleVerify = async (user: UserProfile) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isVerified: !user.isVerified });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isVerified: !u.isVerified } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const togglePremium = async (user: UserProfile) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      if (user.isPremium) {
        await updateDoc(userRef, { isPremium: false, premiumUntil: null });
        if (userProfile) {
          await logAdminAction({
            actorId: userProfile.uid,
            actorDisplayName: userProfile.displayName,
            actorRole: userProfile.role,
            action: 'Removed Plus',
            targetType: 'user',
            targetId: user.uid,
            targetLabel: user.displayName,
          });
        }
        setUsers(users.map(u => u.uid === user.uid ? { ...u, isPremium: false, premiumUntil: undefined } : u));
        return;
      }

      const selectedDate = premiumUntilAmount[user.uid];
      const expiry = selectedDate
        ? new Date(`${selectedDate}T23:59:59`)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await updateDoc(userRef, {
        isPremium: true,
        premiumUntil: expiry.toISOString(),
      });
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Granted Plus',
          targetType: 'user',
          targetId: user.uid,
          targetLabel: user.displayName,
          details: `Expires ${expiry.toLocaleDateString()}.`,
        });
      }
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isPremium: true, premiumUntil: expiry.toISOString() } : u));
      setPremiumUntilAmount((prev) => ({ ...prev, [user.uid]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const giveSnapCoins = async (user: UserProfile) => {
    const amount = parseInt(coinAmount[user.uid] || '0');
    if (isNaN(amount) || amount <= 0) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { snapCoins: increment(amount) });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, snapCoins: (u.snapCoins || 0) + amount } : u));
      setCoinAmount({ ...coinAmount, [user.uid]: '' });
      alert(`Successfully gave ${amount} SnapCoins to ${user.displayName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const giveXp = async (user: UserProfile) => {
    const amount = parseInt(xpAmount[user.uid] || '0', 10);
    if (Number.isNaN(amount) || amount <= 0) return;

    try {
      await awardUserProgress(user.uid, { xp: amount });
      setUsers(users.map((entry) => {
        if (entry.uid !== user.uid) return entry;
        const nextTotalXp = (entry.totalXp || 0) + amount;
        const nextProgress = getLevelProgress(nextTotalXp);
        return { ...entry, totalXp: nextTotalXp, level: nextProgress.level, xp: nextProgress.xpIntoLevel };
      }));
      setXpAmount({ ...xpAmount, [user.uid]: '' });
      alert(`Successfully gave ${amount} XP to ${user.displayName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const setLevel = async (user: UserProfile) => {
    const requestedLevel = parseInt(levelAmount[user.uid] || '0', 10);
    if (Number.isNaN(requestedLevel)) return;

    const safeLevel = Math.max(1, Math.min(MAX_LEVEL, requestedLevel));

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        level: safeLevel,
        totalXp: getTotalXpForLevel(safeLevel),
        xp: 0,
      });
      setUsers(users.map((entry) => (
        entry.uid === user.uid
          ? { ...entry, level: safeLevel, totalXp: getTotalXpForLevel(safeLevel), xp: 0 }
          : entry
      )));
      setLevelAmount({ ...levelAmount, [user.uid]: '' });
      alert(`${user.displayName} is now level ${safeLevel}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const removeAccount = async (user: UserProfile) => {
    setRemovingUser(user.uid);
    try {
      const batchDelete = async (collectionName: string, field: string, value: string) => {
        try {
          const collectionQuery = query(collection(db, collectionName), where(field, '==', value));
          const snap = await getDocs(collectionQuery);
          for (const documentSnapshot of snap.docs) {
            await deleteDoc(documentSnapshot.ref);
          }
        } catch { /* some collections may not exist */ }
      };

      const deleteNestedCollection = async (path: string) => {
        try {
          const nestedSnapshot = await getDocs(collection(db, path));
          for (const nestedDoc of nestedSnapshot.docs) {
            await deleteDoc(nestedDoc.ref);
          }
        } catch { /* silent */ }
      };

      const deleteChatThread = async (chatId: string) => {
        await deleteNestedCollection(`chats/${chatId}/messages`);
        await deleteDoc(doc(db, 'chats', chatId));
      };

      const deleteLivestream = async (streamId: string) => {
        await deleteNestedCollection(`livestreams/${streamId}/comments`);
        try {
          const viewersSnapshot = await getDocs(collection(db, `livestreams/${streamId}/viewers`));
          for (const viewerDoc of viewersSnapshot.docs) {
            await deleteNestedCollection(`livestreams/${streamId}/viewers/${viewerDoc.id}/hostCandidates`);
            await deleteNestedCollection(`livestreams/${streamId}/viewers/${viewerDoc.id}/viewerCandidates`);
            await deleteDoc(viewerDoc.ref);
          }
        } catch { /* silent */ }
        await deleteDoc(doc(db, 'livestreams', streamId));
      };

      const deleteGroup = async (groupId: string) => {
        await deleteNestedCollection(`groups/${groupId}/messages`);
        await deleteNestedCollection(`groups/${groupId}/posts`);
        await deleteNestedCollection(`groups/${groupId}/joinRequests`);
        await deleteDoc(doc(db, 'groups', groupId));
      };

      const deleteCall = async (callId: string) => {
        await deleteNestedCollection(`calls/${callId}/offerCandidates`);
        await deleteNestedCollection(`calls/${callId}/answerCandidates`);
        await deleteDoc(doc(db, 'calls', callId));
      };

      try {
        const userPostsSnapshot = await getDocs(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
        for (const postDoc of userPostsSnapshot.docs) {
          await deletePostCascade({ id: postDoc.id, ...(postDoc.data() as any) });
        }
      } catch { /* silent */ }
      await batchDelete('comments', 'authorId', user.uid);
      await batchDelete('likes', 'userId', user.uid);
      await batchDelete('reposts', 'userId', user.uid);
      await batchDelete('follows', 'followerId', user.uid);
      await batchDelete('follows', 'followingId', user.uid);
      await batchDelete('notifications', 'targetUserId', user.uid);
      await batchDelete('notifications', 'sourceUserId', user.uid);
      await batchDelete('business_affiliation_invites', 'targetUserId', user.uid);
      await batchDelete('business_affiliation_invites', 'businessUid', user.uid);
      await batchDelete('ads', 'businessUid', user.uid);
      await batchDelete('sessions', 'uid', user.uid);
      await batchDelete('login_tokens', 'uid', user.uid);
      await batchDelete('reports', 'reporterId', user.uid);
      await batchDelete('reports', 'targetId', user.uid);
      await batchDelete('admin_tasks', 'assignedTo', user.uid);
      await batchDelete('game_chat', 'uid', user.uid);
      try { await deleteDoc(doc(db, 'game_positions', user.uid)); } catch { /* silent */ }

      try {
        const userChallengesSnapshot = await getDocs(collection(db, 'user_challenges'));
        for (const challengeDoc of userChallengesSnapshot.docs) {
          if (challengeDoc.id.startsWith(`${user.uid}_`)) {
            await deleteDoc(challengeDoc.ref);
          }
        }
      } catch { /* silent */ }

      try {
        const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
        for (const attendanceDoc of attendanceSnapshot.docs) {
          const attendanceData = attendanceDoc.data() as any;
          if (!attendanceData.records || !(user.uid in attendanceData.records)) continue;

          const nextRecords = { ...attendanceData.records };
          delete nextRecords[user.uid];
          await updateDoc(attendanceDoc.ref, { records: nextRecords });
        }
      } catch { /* silent */ }

      try {
        await deleteDoc(doc(db, 'meeting_rooms', 'team-room', 'participants', user.uid));
      } catch { /* silent */ }

      try {
        const meetingSignals = await getDocs(collection(db, 'meeting_rooms', 'team-room', 'signals'));
        for (const signalDoc of meetingSignals.docs) {
          const signalData = signalDoc.data() as any;
          if (signalData.from === user.uid || signalData.to === user.uid) {
            await deleteDoc(signalDoc.ref);
          }
        }
      } catch { /* silent */ }

      try {
        const outgoingCalls = await getDocs(query(collection(db, 'calls'), where('callerId', '==', user.uid)));
        for (const callDoc of outgoingCalls.docs) {
          await deleteCall(callDoc.id);
        }

        const incomingCalls = await getDocs(query(collection(db, 'calls'), where('calleeId', '==', user.uid)));
        for (const callDoc of incomingCalls.docs) {
          if (!outgoingCalls.docs.some((existingDoc) => existingDoc.id === callDoc.id)) {
            await deleteCall(callDoc.id);
          }
        }
      } catch { /* silent */ }

      try {
        const chatsQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
        const chatSnap = await getDocs(chatsQ);
        for (const chatDoc of chatSnap.docs) {
          const chatData = chatDoc.data() as any;
          const participants = (chatData.participants || []).filter((participantId: string) => participantId !== user.uid);
          if (chatData.isGroupChat && participants.length > 1) {
            await updateDoc(chatDoc.ref, {
              participants,
              updatedAt: new Date().toISOString(),
            });
          } else {
            await deleteChatThread(chatDoc.id);
          }
        }
      } catch { /* silent */ }

      try {
        const livestreamsSnapshot = await getDocs(query(collection(db, 'livestreams'), where('hostId', '==', user.uid)));
        for (const streamDoc of livestreamsSnapshot.docs) {
          await deleteLivestream(streamDoc.id);
        }
      } catch { /* silent */ }

      try {
        const livestreamCommentsSnapshot = await getDocs(collection(db, 'livestreams'));
        for (const streamDoc of livestreamCommentsSnapshot.docs) {
          const commentsSnapshot = await getDocs(query(collection(db, `livestreams/${streamDoc.id}/comments`), where('userId', '==', user.uid)));
          for (const commentDoc of commentsSnapshot.docs) {
            await deleteDoc(commentDoc.ref);
          }
        }
      } catch { /* silent */ }

      try {
        const groupsSnapshot = await getDocs(collection(db, 'groups'));
        for (const groupDoc of groupsSnapshot.docs) {
          const groupData = groupDoc.data() as any;
          if (groupData.creatorId === user.uid) {
            await deleteGroup(groupDoc.id);
            continue;
          }

          try {
            const groupMessages = await getDocs(query(collection(db, 'groups', groupDoc.id, 'messages'), where('senderId', '==', user.uid)));
            for (const messageDoc of groupMessages.docs) {
              await deleteDoc(messageDoc.ref);
            }
          } catch { /* silent */ }

          try {
            const groupPosts = await getDocs(query(collection(db, 'groups', groupDoc.id, 'posts'), where('authorId', '==', user.uid)));
            for (const groupPostDoc of groupPosts.docs) {
              await deleteDoc(groupPostDoc.ref);
            }
          } catch { /* silent */ }

          const wasMember = (groupData.members || []).includes(user.uid);
          const wasAdmin = (groupData.admins || []).includes(user.uid);
          const wasModerator = (groupData.moderators || []).includes(user.uid);
          if (wasMember || wasAdmin || wasModerator) {
            await updateDoc(groupDoc.ref, {
              members: arrayRemove(user.uid),
              moderators: arrayRemove(user.uid),
              admins: arrayRemove(user.uid),
              membersCount: wasMember ? Math.max((groupData.membersCount || 1) - 1, 0) : groupData.membersCount || 0,
            });
          }

          try {
            await deleteDoc(doc(db, 'groups', groupDoc.id, 'joinRequests', user.uid));
          } catch { /* silent */ }
        }
      } catch { /* silent */ }

      try {
        const makeSpaceRoomsSnapshot = await getDocs(collection(db, 'makespace_rooms'));
        for (const roomDoc of makeSpaceRoomsSnapshot.docs) {
          const roomData = roomDoc.data() as any;
          if (roomData.hostId === user.uid) {
            await deleteNestedCollection(`makespace_rooms/${roomDoc.id}/players`);
            await deleteNestedCollection(`makespace_rooms/${roomDoc.id}/chat`);
            await deleteDoc(roomDoc.ref);
            continue;
          }

          if ((roomData.players || []).includes(user.uid)) {
            const nextPlayers = (roomData.players || []).filter((playerId: string) => playerId !== user.uid);
            await updateDoc(roomDoc.ref, {
              players: nextPlayers,
              currentPlayers: Math.max((roomData.currentPlayers || 1) - 1, 0),
            });
          }

          try {
            const roomChatMessages = await getDocs(query(collection(db, 'makespace_rooms', roomDoc.id, 'chat'), where('uid', '==', user.uid)));
            for (const chatDoc of roomChatMessages.docs) {
              await deleteDoc(chatDoc.ref);
            }
          } catch { /* silent */ }

          try {
            await deleteDoc(doc(db, 'makespace_rooms', roomDoc.id, 'players', user.uid));
          } catch { /* silent */ }
        }
      } catch { /* silent */ }

      await deleteDoc(doc(db, 'users', user.uid));

      setUsers(prev => prev.filter(u => u.uid !== user.uid));
      setConfirmRemove(null);
      alert(`Account for ${user.displayName} has been removed.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
      alert('Failed to fully remove account. Some data may remain.');
    } finally {
      setRemovingUser(null);
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  const filteredUsers = searchQuery.trim()
    ? users.filter((entry) => matchesUserSearch(entry, searchQuery))
    : users;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Users className="mr-2 text-blue-500" /> User Management</h1>
        </div>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading users...</div>
      ) : (
        <div className="p-4 max-w-5xl mx-auto space-y-3">
          <div className="sticky top-[4.6rem] z-[5] rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, @username, bio, or uid..."
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          <AnimatePresence>
            {filteredUsers.map((user, index) => (
              <motion.div 
                key={user.uid} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow bg-white dark:bg-gray-800 space-y-4 sm:space-y-0"
              >
                <div className="flex items-center space-x-4">
                  <Avatar src={user.photoURL} alt={user.displayName} className="h-12 w-12" />
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-lg dark:text-white">{user.displayName}</span>
                      {user.isVerified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                      {user.isPremium && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                      {user.role === 'admin' && <Shield className="h-4 w-4 text-purple-500" />}
                      {user.role === 'moderator' && <Shield className="h-4 w-4 text-amber-500" />}
                      {user.role === 'member' && <Crown className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</span>
                      <LevelBadge level={user.level || 1} compact />
                      {user.role !== 'user' && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : user.role === 'moderator'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderator' : 'Member'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center font-medium">
                      <Coins className="h-3 w-3 mr-1 text-yellow-500" /> {user.snapCoins || 0} Coins
                    </div>
                    {user.isPremium && user.premiumUntil && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-300 mt-1 font-medium">
                        Plus until {new Date(user.premiumUntil).toLocaleDateString()}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                      {(user.xp || 0)} XP in current level
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-3 sm:items-end">
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <input
                      type="date"
                      value={premiumUntilAmount[user.uid] || ''}
                      onChange={(e) => setPremiumUntilAmount({ ...premiumUntilAmount, [user.uid]: e.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      title="Premium expiry date"
                    />
                    <Button size="sm" variant={user.isPremium ? "outline" : "default"} className={`rounded-full px-4 ${user.isPremium ? 'text-yellow-600 border-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`} onClick={() => togglePremium(user)}>
                      {user.isPremium ? 'Revoke Premium' : 'Give Premium'}
                    </Button>
                    <Button size="sm" variant={user.isVerified ? "outline" : "default"} className="rounded-full px-4" onClick={() => toggleVerify(user)}>
                      {user.isVerified ? 'Unverify' : 'Verify'}
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={coinAmount[user.uid] || ''}
                      onChange={(e) => setCoinAmount({ ...coinAmount, [user.uid]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => giveSnapCoins(user)}>
                      <Coins className="h-4 w-4 mr-1" /> Give
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      type="number"
                      placeholder="XP"
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={xpAmount[user.uid] || ''}
                      onChange={(e) => setXpAmount({ ...xpAmount, [user.uid]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => giveXp(user)}>
                      Give XP
                    </Button>
                    <input
                      type="number"
                      min={1}
                      max={MAX_LEVEL}
                      placeholder="Level"
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={levelAmount[user.uid] || ''}
                      onChange={(e) => setLevelAmount({ ...levelAmount, [user.uid]: e.target.value })}
                    />
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setLevel(user)}>
                      Set Level
                    </Button>
                  </div>
                  {user.uid !== userProfile?.uid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full px-4 text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 mt-1 w-full sm:w-auto"
                      onClick={() => setConfirmRemove(user)}
                      disabled={removingUser === user.uid}
                    >
                      {removingUser === user.uid ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Removing...</>
                      ) : (
                        <><Trash2 className="h-4 w-4 mr-1" /> Remove Account</>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Remove Account Confirmation Modal */}
      <AnimatePresence>
        {confirmRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setConfirmRemove(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Remove Account</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl mb-4">
                <Avatar src={confirmRemove.photoURL} alt={confirmRemove.displayName} className="h-10 w-10" />
                <div>
                  <p className="font-bold dark:text-white">{confirmRemove.displayName}</p>
                  <p className="text-sm text-gray-500">@{confirmRemove.username}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">This will permanently delete:</p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 mb-5 space-y-1 ml-4 list-disc">
                <li>User profile and all personal data</li>
                <li>All posts, comments, and likes</li>
                <li>All follows, chats, and notifications</li>
                <li>Sessions and login tokens</li>
              </ul>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setConfirmRemove(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white border-0"
                  onClick={() => removeAccount(confirmRemove)}
                  disabled={removingUser === confirmRemove.uid}
                >
                  {removingUser === confirmRemove.uid ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Removing...</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-1" /> Remove Account</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
