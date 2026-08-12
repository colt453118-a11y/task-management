'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ShortcutsProvider } from '@/components/ui/shortcuts-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" forcedTheme="dark">
        {/* Honor the OS "reduce motion" setting for all framer-motion animations.
            The CSS `prefers-reduced-motion` block only covers CSS animations/
            transitions, not framer-motion's JS-driven transforms. */}
        <MotionConfig reducedMotion="user">
          <ShortcutsProvider>{children}</ShortcutsProvider>
          <Toaster />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
