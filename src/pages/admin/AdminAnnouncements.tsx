import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Megaphone, Plus, Trash2, Info, Zap, Calendar, AlertTriangle, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createNotificationForUsers, getRoleUserIds } from '../../lib/notifications';
import { logAdminAction } from '../../lib/adminLogs';

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

const typeOptions = [
  { value: 'info', label: 'Information', icon: Info, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'update', label: 'Update', icon: Zap, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'event', label: 'Event', icon: Calendar, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'important', label: 'Important', icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

export function AdminAnnouncements() {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<string>('info');
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;
    fetchAnnouncements();
  }, [userProfile]);

  const postAnnouncement = async () => {
    if (!title.trim() || !content.trim() || !userProfile) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        content: content.trim(),
        type,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorPhoto: userProfile.photoURL || '',
        createdAt: new Date().toISOString(),
      });

      const targetUserIds = await getRoleUserIds(['user', 'member', 'admin']);
      await createNotificationForUsers(targetUserIds.filter((uid) => uid !== userProfile.uid), {
        type: 'announcement',
        title: `New announcement: ${title.trim()}`,
        message: content.trim().slice(0, 180),
        sourceUserId: userProfile.uid,
        linkTo: '/announcements',
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
      });
      await logAdminAction({
        actorId: userProfile.uid,
        actorDisplayName: userProfile.displayName,
        actorRole: userProfile.role,
        action: 'Posted announcement',
        targetType: 'announcement',
        targetLabel: title.trim(),
        details: content.trim().slice(0, 240),
      });

      setTitle('');
      setContent('');
      setType('info');
      setShowForm(false);
      await fetchAnnouncements();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const announcement = announcements.find((entry) => entry.id === id);
      await deleteDoc(doc(db, 'announcements', id));
      if (userProfile) {
        await logAdminAction({
          actorId: userProfile.uid,
          actorDisplayName: userProfile.displayName,
          actorRole: userProfile.role,
          action: 'Deleted announcement',
          targetType: 'announcement',
          targetId: id,
          targetLabel: announcement?.title || id,
        });
      }
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
    } finally {
      setDeleting(null);
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Megaphone className="mr-2 text-blue-500" /> Manage Announcements</h1>
          <Button onClick={() => setShowForm(!showForm)} className="rounded-full px-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0">
            {showForm ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> New</>}
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6">
        {/* Create Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
                <h2 className="font-bold text-lg dark:text-white">Create Announcement</h2>

                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {typeOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setType(opt.value)}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            type === opt.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="h-5 w-5 mx-auto mb-1" />
                          <span className="text-xs font-bold">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Announcement title..."
                    maxLength={100}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Content</label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Write your announcement..."
                    rows={5}
                    maxLength={2000}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{content.length}/2000</p>
                </div>

                <Button
                  onClick={postAnnouncement}
                  disabled={posting || !title.trim() || !content.trim()}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
                >
                  {posting ? 'Posting...' : <><Send className="h-4 w-4 mr-2" /> Post Announcement</>}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Announcements List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500 font-medium">No announcements yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a, i) => {
              const cfg = typeOptions.find(t => t.value === a.type) || typeOptions[0];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <Icon className="h-3 w-3 mr-1" /> {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{a.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{a.content}</p>
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    disabled={deleting === a.id}
                    className="ml-3 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
