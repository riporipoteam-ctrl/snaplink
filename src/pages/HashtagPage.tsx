import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PostItem } from '../components/post/PostItem';
import { ArrowLeft, Hash } from 'lucide-react';
import { motion } from 'motion/react';

export function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;

    setLoading(true);
    const fetchPosts = async () => {
      try {
        // Search for posts containing the hashtag
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const hashtagLower = `#${tag}`.toLowerCase();
        const filtered = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((post: any) => post.content?.toLowerCase().includes(hashtagLower));
        
        setPosts(filtered);
      } catch (error) {
        console.error('Error fetching hashtag posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [tag]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center space-x-4">
          <Link to="/" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="h-5 w-5 dark:text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-bold dark:text-white flex items-center">
              <Hash className="h-5 w-5 mr-1 text-blue-500" />
              {tag}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{posts.length} posts</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : posts.length > 0 ? (
        <div>
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <PostItem post={post} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Hash className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h2 className="text-xl font-bold dark:text-white mb-2">No posts with #{tag}</h2>
          <p>Be the first to use this hashtag!</p>
        </div>
      )}
    </div>
  );
}
