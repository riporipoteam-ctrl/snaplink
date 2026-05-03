import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, UserPlus, MessageCircle, AlertTriangle, Bell, X, Ban, CheckSquare, CalendarCheck, Video, Megaphone, AtSign, Phone, Sparkles } from 'lucide-react';
import { ensureNotificationWorker, showSystemNotification, triggerInAppAttention } from '../lib/browserNotifications';
import { NotificationRecord, describeNotification, getNotificationLink } from '../lib/notifications';

interface NotificationContextType {
  unreadCount: number;
  notifications: NotificationRecord[];
  markAllAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  notifications: [],
  markAllAsRead: async () => {},
  clearAllNotifications: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

function getNotificationCreatedAtTime(notification: Pick<NotificationRecord, 'createdAt'>) {
  const parsed = new Date(notification.createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Toast notification component
function NotificationToast({ notification, onDismiss }: { notification: NotificationRecord; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getIcon = () => {
    switch (notification.type) {
      case 'like': return <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />;
      case 'follow': return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'comment': return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'mention': return <AtSign className="h-5 w-5 text-indigo-500" />;
      case 'message': return <MessageCircle className="h-5 w-5 text-cyan-500" />;
      case 'call': return <Phone className="h-5 w-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'ban': return <Ban className="h-5 w-5 text-red-500" />;
      case 'task': return <CheckSquare className="h-5 w-5 text-emerald-500" />;
      case 'attendance': return <CalendarCheck className="h-5 w-5 text-cyan-500" />;
      case 'meeting': return <Video className="h-5 w-5 text-violet-500" />;
      case 'announcement': return <Megaphone className="h-5 w-5 text-amber-500" />;
      case 'event': return <Sparkles className="h-5 w-5 text-fuchsia-500" />;
      default: return <Bell className="h-5 w-5 text-purple-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 min-w-[300px] max-w-md cursor-pointer hover:shadow-3xl transition-shadow"
      onClick={onDismiss}
    >
      <div className="shrink-0 p-2 rounded-full bg-gray-100 dark:bg-gray-700">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium dark:text-white truncate">{describeNotification(notification)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Just now</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <X className="h-4 w-4 text-gray-400" />
      </button>
    </motion.div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<NotificationRecord[]>([]);
  const lastSeenTimestampRef = useRef<string | null>(null);
  const shownSystemNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userProfile?.notificationsEnabled || userProfile.notificationPermission !== 'granted') return;
    void ensureNotificationWorker();
  }, [userProfile?.notificationsEnabled, userProfile?.notificationPermission]);

  useEffect(() => {
    if (!userProfile) {
      setNotifications([]);
      setUnreadCount(0);
      lastSeenTimestampRef.current = null;
      shownSystemNotificationsRef.current.clear();
      return;
    }

    const q = query(collection(db, 'notifications'), where('targetUserId', '==', userProfile.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const notifs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as NotificationRecord))
        .sort((left, right) => getNotificationCreatedAtTime(right) - getNotificationCreatedAtTime(left))
        .slice(0, 50);
      
      // Fetch fresh user profiles for all unique sourceUserIds
      const uniqueUserIds = [...new Set(notifs.map(n => n.sourceUserId).filter(Boolean))];
      const userCache: Record<string, { displayName: string; photoURL: string }> = {};
      await Promise.all(uniqueUserIds.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            userCache[uid] = { displayName: data.displayName || 'Unknown', photoURL: data.photoURL || '' };
          }
        } catch {}
      }));
      
      // Attach fresh user data to notifications
      const enrichedNotifs = notifs.map(n => ({
        ...n,
        sourceUser: userCache[n.sourceUserId] || n.sourceUser || { displayName: 'Someone', photoURL: '' },
      }));
      
      // Check for NEW notifications (ones we haven't seen yet)
      if (lastSeenTimestampRef.current) {
        const newNotifs = enrichedNotifs.filter(n => 
          !n.read && n.createdAt > lastSeenTimestampRef.current!
        );
        if (newNotifs.length > 0) {
          // Show toast for the newest one only
          setToasts(prev => {
            const existing = prev.map(p => p.id);
            const fresh = newNotifs.filter(n => !existing.includes(n.id));
            return [...prev, ...fresh.slice(0, 1)];
          });

          const newestNotification = newNotifs[0];

          if (newestNotification) {
            triggerInAppAttention({
              title: describeNotification(newestNotification),
              durationMs: newestNotification.type === 'call' ? 30000 : newestNotification.type === 'event' ? 18000 : 12000,
              vibration:
                newestNotification.type === 'call'
                  ? [280, 180, 280, 180, 600]
                  : newestNotification.type === 'event'
                  ? [180, 120, 180]
                  : [120],
              mode: newestNotification.type === 'call' ? 'call' : newestNotification.type === 'event' ? 'event' : 'default',
            });
          }

          if (userProfile?.notificationsEnabled && userProfile.notificationPermission === 'granted') {
            const unseenSystem = newNotifs.filter(n => !shownSystemNotificationsRef.current.has(n.id));
            unseenSystem.slice(0, 3).forEach((notification) => {
              shownSystemNotificationsRef.current.add(notification.id);
              void showSystemNotification({
                title: 'SnapLink',
                body: describeNotification(notification),
                tag: notification.id,
                url: getNotificationLink(notification),
                actions: notification.type === 'call'
                  ? [
                      { action: 'open-call', title: 'Answer', url: getNotificationLink(notification) },
                      { action: 'dismiss-call', title: 'Dismiss', url: '/messages' },
                    ]
                  : undefined,
              });
            });
          }
        }
      }
      
      setNotifications(enrichedNotifs);
      setUnreadCount(enrichedNotifs.filter(n => !n.read).length);
      
      if (!lastSeenTimestampRef.current && enrichedNotifs.length > 0) {
        lastSeenTimestampRef.current = enrichedNotifs[0].createdAt;
      } else if (enrichedNotifs.length > 0 && enrichedNotifs[0].createdAt > (lastSeenTimestampRef.current || '')) {
        lastSeenTimestampRef.current = enrichedNotifs[0].createdAt;
      }
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });

    return () => unsubscribe();
  }, [userProfile?.uid, userProfile?.notificationsEnabled, userProfile?.notificationPermission]);

  const markAllAsRead = useCallback(async () => {
    if (!userProfile) return;
    const unreadNotifs = notifications.filter(n => !n.read);
    if (unreadNotifs.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, [userProfile, notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    if (!userProfile) return;
    try {
      const q = query(collection(db, 'notifications'), where('targetUserId', '==', userProfile.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [userProfile]);

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, markAllAsRead, clearAllNotifications }}>
      {children}
      
      {/* Toast notification overlay — shows on ALL pages */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col space-y-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <NotificationToast
                notification={toast}
                onDismiss={() => dismissToast(toast.id)}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
