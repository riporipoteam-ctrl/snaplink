import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '../ui/Logo';

export function EntranceAnimation({ children }: { children: React.ReactNode }) {
  const [showEntrance, setShowEntrance] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowEntrance(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showEntrance && (
          <motion.div
            key="entrance"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -90 }}
              animate={{ scale: 1.5, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            >
              <Logo className="h-32 w-32" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showEntrance ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </>
  );
}
