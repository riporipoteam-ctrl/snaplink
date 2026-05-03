import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Megaphone, Info, Zap, Calendar, AlertTriangle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  type: 'info' | 'update' | 'event' | 'important';
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; gradient: string; label: string }> = {
  info: { icon: Info, color: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500', label: 'Information' },
  update: { icon: Zap, color: 'text-purple-500', gradient: 'from-purple-500 to-pink-500', label: 'Update' },
  event: { icon: Calendar, color: 'text-green-500', gradient: 'from-green-500 to-emerald-500', label: 'Event' },
  important: { icon: AlertTriangle, color: 'text-red-500', gradient: 'from-red-500 to-orange-500', label: 'Important' },
};

export function Announcements() {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold dark:text-white">Announcements</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Sparkles className="h-8 w-8 text-blue-500" />
            </motion.div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20">
            <Megaphone className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-400 dark:text-gray-500">No Announcements Yet</h2>
            <p className="text-gray-400 dark:text-gray-500 mt-2">Check back later for updates from the team.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {announcements.map((a, i) => {
                const cfg = typeConfig[a.type] || typeConfig.info;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.08, 0.4) }}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${cfg.gradient}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${cfg.gradient} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(a.createdAt)}</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{a.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                      <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Avatar src={a.authorPhoto} alt={a.authorName} className="h-6 w-6" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Posted by <span className="font-semibold text-gray-700 dark:text-gray-300">{a.authorName}</span></span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
