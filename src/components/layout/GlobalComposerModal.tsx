import React from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CreatePost } from '../post/CreatePost';

interface GlobalComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalComposerModal({ isOpen, onClose }: GlobalComposerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-gray-200/80 bg-white/96 shadow-[0_32px_80px_rgba(15,23,42,0.25)] dark:border-gray-800 dark:bg-gray-900/96"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200/80 px-5 py-4 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">Quick Post</p>
                <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Create from anywhere</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CreatePost onSuccess={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
