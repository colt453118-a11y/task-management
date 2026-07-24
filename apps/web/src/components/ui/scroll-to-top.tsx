'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useTransform } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollShadow } from '@/lib/hooks/use-scroll-shadow';

/**
 * A floating button that appears when the user scrolls down.
 * Clicking it smoothly scrolls back to the top of the page.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const { shadowSpring } = useScrollShadow();
  const btnShadow = useTransform(shadowSpring, [0, 1], [
    '0 4px 12px rgba(99,102,241,0.25)',
    '0 6px 28px rgba(99,102,241,0.45)',
  ]);

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
          whileHover={{ boxShadow: '0 8px 32px rgba(99,102,241,0.55)' }}
          onClick={scrollToTop}
          style={{ boxShadow: btnShadow }}
          className={cn(
            'fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center',
            'bg-brand-500 rounded-2xl text-white',
            'hover:bg-brand-400 transition-all duration-200',
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
