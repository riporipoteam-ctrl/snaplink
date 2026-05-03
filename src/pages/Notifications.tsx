import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, Heart, UserPlus, MessageCircle, AlertTriangle, Trash2, Ban, CheckSquare, CalendarCheck, Video, Megaphone, AtSign, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { describeNotification, getNotificationLink } from '../lib/notifications';

export function Notifications() {
  const { userProfile } = useAuth();
  const { notifications, unreadCount, markAllAsRead, clearAllNotifications } = useNotifications();

  // Mark all as read when this page is opened
  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />;
      case 'follow': return <UserPlus className="h-6 w-6 text-blue-500" />;
      case 'comment': return <MessageCircle className="h-6 w-6 text-blue-500" />;
      case 'mention': return <AtSign className="h-6 w-6 text-indigo-500" />;
      case 'message': return <MessageCircle className="h-6 w-6 text-cyan-500" />;
      case 'call': return <Phone className="h-6 w-6 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'ban': return <Ban className="h-6 w-6 text-red-500" />;
      case 'task': return <CheckSquare className="h-6 w-6 text-emerald-500" />;
      case 'attendance': return <CalendarCheck className="h-6 w-6 text-cyan-500" />;
      case 'meeting': return <Video className="h-6 w-6 text-violet-500" />;
      case 'announcement': return <Megaphone className="h-6 w-6 text-amber-500" />;
      default: return <Bell className="h-6 w-6 text-purple-500" />;
    }
  };

  return (
    <div className="pb-20 md:pb-0 min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
        {/* Animated bell */}
        <motion.div
          animate={{ rotate: [0, -20, 20, -15, 15, -10, 10, -5, 5, 0] }}
          transition={{ duration: 1.2, delay: 0.3, ease: "easeInOut" }}
        >
          <Bell className="h-6 w-6 dark:text-white" />
        </motion.div>
        <h1 className="text-xl font-bold dark:text-white">Notifications</h1>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
          >
            {unreadCount} new
          </motion.span>
        )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={() => { if (window.confirm('Clear all notifications?')) clearAllNotifications(); }}
            className="flex items-center space-x-1 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-full transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 text-center text-gray-500 dark:text-gray-400"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0], y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          </motion.div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nothing to see here — yet</h2>
          <p>When someone interacts with you or your posts, you'll find it here.</p>
        </motion.div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          <AnimatePresence>
            {notifications.map((notification, index) => {
              const linkTo = getNotificationLink(notification);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  layout
                >
                  <Link 
                    to={linkTo}
                    className={`p-4 flex space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors block ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500' : ''}`}
                  >
                    <motion.div 
                      className="flex-shrink-0 pt-1"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: index * 0.05 + 0.1 }}
                    >
                      <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        {getIcon(notification.type)}
                      </div>
                    </motion.div>
                    <div className="flex-1">
                      <Avatar src={notification.sourceUser?.photoURL} alt={notification.sourceUser?.displayName} size="sm" className="mb-2" />
                      <p className="text-[15px] dark:text-white">
                        {describeNotification(notification)}
                      </p>
                      {notification.message && !['warning', 'ban'].includes(notification.type) && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {notification.message}
                        </p>
                      )}
                      {(notification.type === 'warning' || notification.type === 'ban') && notification.message && (
                        <p className="mt-1 text-sm font-medium text-orange-600 dark:text-orange-300">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-3 w-3 rounded-full bg-blue-500 self-center shrink-0"
                      />
                    )}
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
