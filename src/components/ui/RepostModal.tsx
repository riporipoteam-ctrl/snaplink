import React, { useState } from 'react';
import { X, Repeat2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';

interface RepostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepost: (content: string) => void;
  originalContent: string;
  originalAuthor: string;
}

export function RepostModal({ isOpen, onClose, onRepost, originalContent, originalAuthor }: RepostModalProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRepost = async () => {
    setIsSubmitting(true);
    await onRepost(content.trim());
    setContent('');
    setIsSubmitting(false);
    onClose();
  };

  const handleQuickRepost = async () => {
    setIsSubmitting(true);
    await onRepost('');
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold dark:text-white flex items-center">
              <Repeat2 className="h-5 w-5 mr-2 text-green-500" />
              Repost
            </h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 dark:text-white" />
            </button>
          </div>

          <div className="p-4">
            {/* Quick Repost */}
            <button
              onClick={handleQuickRepost}
              disabled={isSubmitting}
              className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-3"
            >
              <div className="flex items-center space-x-3">
                <Repeat2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-bold dark:text-white">Quick Repost</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Repost without adding anything</p>
                </div>
              </div>
            </button>

            {/* Repost with Comment */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <textarea
                className="w-full resize-none border-none bg-transparent text-sm placeholder-gray-400 dark:text-white focus:outline-none"
                placeholder="Add a comment to your repost..."
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={280}
              />
              
              {/* Original post preview */}
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">@{originalAuthor}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{originalContent || '[Media post]'}</p>
              </div>

              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-400">{content.length}/280</span>
                <Button
                  onClick={handleRepost}
                  disabled={isSubmitting}
                  className="rounded-full px-6 text-sm bg-green-500 hover:bg-green-600 text-white"
                >
                  {isSubmitting ? 'Posting...' : 'Repost'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
