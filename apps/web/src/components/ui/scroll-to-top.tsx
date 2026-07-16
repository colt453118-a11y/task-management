'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A floating button that appears when the user scrolls down.
 * Clicking it smoothly scrolls back to the top of the page.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={scrollToTop}
          className={cn(
            'fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center',
            'bg-brand-500 shadow-brand-500/30 rounded-2xl text-white shadow-lg',
            'hover:bg-brand-400 hover:shadow-brand-500/40 transition-all duration-200 hover:shadow-xl',
            'focus-visible:ring-brand-500/50 focus-visible:outline-none focus-visible:ring-2 active:scale-90',
            'backdrop-blur-sm',
          )}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
