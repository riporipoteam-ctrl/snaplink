import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, increment, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Link } from 'react-router-dom';
import { Search, UserPlus, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';
import { createNotification } from '../lib/notifications';
import { searchUsersByQuery } from '../lib/userSearch';
import { getSuggestedUsersForViewer } from '../lib/friendSuggestions';

async function fetchProfilesByIds(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const profileEntries = await Promise.all(
    uniqueIds.map(async (id) => {
      const userDoc = await getDoc(doc(db, 'users', id));
      return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    })
  );

  return profileEntries.filter(Boolean) as UserProfile[];
}

export default function Friends() {
  const { userProfile } = useAuth();
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'following' | 'followers' | 'search'>('following');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);

  useEffect(() => {
    async function fetchFriends() {
      if (!userProfile) return;
      setLoading(true);
      try {
        const followingQuery = query(collection(db, 'follows'), where('followerId', '==', userProfile.uid));
        const followersQuery = query(collection(db, 'follows'), where('followingId', '==', userProfile.uid));
        const [followingSnapshot, followersSnapshot, suggested] = await Promise.all([
          getDocs(followingQuery),
          getDocs(followersQuery),
          getSuggestedUsersForViewer(userProfile, { limit: 3 }),
        ]);

        const fIds = followingSnapshot.docs.map(doc => doc.data().followingId);
        setFollowingIds(new Set(fIds));
        const followerIds = followersSnapshot.docs.map(doc => doc.data().followerId);

        const [followingProfiles, followerProfiles] = await Promise.all([
          fetchProfilesByIds(fIds),
          fetchProfilesByIds(followerIds),
        ]);

        setFollowing(followingProfiles);
        setFollowers(followerProfiles);
        setSuggestions(suggested);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'follows/users');
      } finally {
        setLoading(false);
      }
    }

    fetchFriends();
  }, [userProfile]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        if (activeTab === 'search') setActiveTab('following');
        return;
      }
      setActiveTab('search');
      setLoading(true);
      try {
        const results = await searchUsersByQuery(searchQuery, {
          excludeUserIds: userProfile ? [userProfile.uid] : [],
          limit: 20,
        });
        setSearchResults(results);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery, userProfile]);

  const handleFollowToggle = async (e: React.MouseEvent, targetUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile) return;

    const followId = `${userProfile.uid}_${targetUserId}`;
    const followRef = doc(db, 'follows', followId);
    const targetUserRef = doc(db, 'users', targetUserId);
    const currentUserRef = doc(db, 'users', userProfile.uid);

    const isFollowing = followingIds.has(targetUserId);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
        setFollowing(prev => prev.filter(u => u.uid !== targetUserId));
      } else {
        await setDoc(followRef, {
          id: followId,
          followerId: userProfile.uid,
          followingId: targetUserId,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.add(targetUserId);
          return newSet;
        });
        
        const targetProfile = searchResults.find(u => u.uid === targetUserId) || followers.find(u => u.uid === targetUserId);
        if (targetProfile) {
          setFollowing(prev => [...prev, targetProfile]);
        }

        await createNotification({
          type: 'follow',
          sourceUserId: userProfile.uid,
          targetUserId: targetUserId,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null
          },
          dedupeKey: `follow-${userProfile.uid}`,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    }
  };

  const displayList = activeTab === 'following' ? following : activeTab === 'followers' ? followers : searchResults;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <h1 className="px-4 py-3 text-xl font-extrabold dark:text-white">Friends</h1>
        <div className="px-4 pb-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-full leading-5 bg-gray-50 dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            className={`flex-1 py-4 text-center font-bold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeTab === 'following' ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => { setActiveTab('following'); setSearchQuery(''); }}
          >
            Following
            {activeTab === 'following' && (
              <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-blue-500" />
            )}
          </button>
          <button
            className={`flex-1 py-4 text-center font-bold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeTab === 'followers' ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => { setActiveTab('followers'); setSearchQuery(''); }}
          >
            Followers
            {activeTab === 'followers' && (
              <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-blue-500" />
            )}
          </button>
          {activeTab === 'search' && (
            <button
              className="flex-1 py-4 text-center font-bold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 text-black dark:text-white"
            >
              Search Results
              <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-blue-500" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Section */}
      {activeTab === 'following' && suggestions.length > 0 && !loading && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Suggested for you</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggestions.map(user => (
              <Link key={user.uid} to={`/profile/${user.uid}`} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Avatar src={user.photoURL} alt={user.displayName} size="lg" />
                <span className="font-bold text-sm mt-2 dark:text-white text-center truncate w-full flex items-center justify-center">
                  {user.displayName}
                  {user.isVerified && <VerificationBadge className="ml-1 w-3.5 h-3.5" />}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</span>
                <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-3.5 h-3.5" />
                <button
                  onClick={(e) => handleFollowToggle(e, user.uid)}
                  className="mt-2 px-4 py-1.5 rounded-full font-bold text-sm bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Follow
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
      ) : displayList.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          {activeTab === 'following' ? "You aren't following anyone yet." : 
           activeTab === 'followers' ? "You don't have any followers yet." :
           "No users found matching your search."}
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          <AnimatePresence>
            {displayList.map(user => {
              const isFollowing = followingIds.has(user.uid);
              return (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Link to={`/profile/${user.uid}`} className={`p-4 flex space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors block`}>
                    <Avatar src={user.photoURL} alt={user.displayName} size="md" />
                    <div className="ml-3 flex-1">
                      <div className="font-bold flex items-center dark:text-white">
                        {user.displayName}
                        {user.isVerified && <VerificationBadge className="ml-1 w-4 h-4" />}
                        <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-4 h-4" />
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-sm">@{user.username}</div>
                      {user.bio && <div className="text-sm mt-1 line-clamp-1 dark:text-gray-300">{user.bio}</div>}
                    </div>
                    <button
                      onClick={(e) => handleFollowToggle(e, user.uid)}
                      className={`ml-4 px-4 py-1.5 rounded-full font-bold text-sm transition-colors flex items-center ${
                        isFollowing
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                          : 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-1" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Follow
                        </>
                      )}
                    </button>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
