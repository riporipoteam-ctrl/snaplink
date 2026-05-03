import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../contexts/AuthContext';
import { PostItem } from '../components/post/PostItem';
import { Avatar } from '../components/ui/Avatar';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';
import { ArrowLeft, Search as SearchIcon, Users, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { searchUsersByQuery } from '../lib/userSearch';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q.trim()) return;

    setLoading(true);
    const searchAll = async () => {
      try {
        const foundUsers = await searchUsersByQuery(q, { limit: 20 });
        setUsers(foundUsers);

        // Search posts by content
        const postsRef = collection(db, 'posts');
        const postsSnap = await getDocs(query(postsRef, orderBy('createdAt', 'desc'), limit(100)));
        const matchedPosts = postsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((post: any) => post.content?.toLowerCase().includes(q.toLowerCase()));
        
        setPosts(matchedPosts);
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setLoading(false);
      }
    };

    searchAll();
  }, [q]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center space-x-4">
          <Link to="/" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="h-5 w-5 dark:text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-bold dark:text-white flex items-center">
              <SearchIcon className="h-5 w-5 mr-2 text-blue-500" />
              "{q}"
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          className={`flex-1 py-3 text-center font-bold text-sm transition-colors flex items-center justify-center space-x-2 ${activeTab === 'users' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          onClick={() => setActiveTab('users')}
        >
          <Users className="h-4 w-4" />
          <span>People ({users.length})</span>
        </button>
        <button
          className={`flex-1 py-3 text-center font-bold text-sm transition-colors flex items-center justify-center space-x-2 ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          onClick={() => setActiveTab('posts')}
        >
          <FileText className="h-4 w-4" />
          <span>Posts ({posts.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm">Searching...</p>
        </div>
      ) : (
        <>
          {activeTab === 'users' && (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {users.length > 0 ? users.map((user, i) => (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link to={`/profile/${user.uid}`} className="flex items-center space-x-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Avatar src={user.photoURL} alt={user.displayName} />
                    <div>
                      <p className="font-bold dark:text-white flex items-center">
                        {user.displayName}
                        {user.isVerified && <VerificationBadge className="ml-1 w-4 h-4" />}
                        <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-4 h-4" />
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">@{user.username}</p>
                      {user.bio && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-1">{user.bio}</p>}
                    </div>
                  </Link>
                </motion.div>
              )) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">No users found for "{q}"</div>
              )}
            </div>
          )}
          {activeTab === 'posts' && (
            <div>
              {posts.length > 0 ? posts.map(post => (
                <PostItem key={post.id} post={post} />
              )) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">No posts found for "{q}"</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
