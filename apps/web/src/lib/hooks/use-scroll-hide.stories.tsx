import type { Meta, StoryObj } from '@storybook/react';
import { motion, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { useScrollHide } from './use-scroll-hide';

// ─── Demo component ─────────────────────────────────────────────
// Renders a scrollable container with a simulated fixed element
// that demonstrates scroll-to-hide, shadow overlay, and parallax.

interface ScrollHideDemoProps {
  /** Y-offset (px) to translate the element when hidden. Positive = down, negative = up. */
  hideOffset?: number;
  /** Only activate on mobile-width viewports (< 768px). */
  mobileOnly?: boolean;
  /** Label displayed on the simulated element. */
  label?: string;
  /** Background style for the simulated element. */
  variant?: 'bottom-nav' | 'topbar';
}

function ScrollHideDemo({
  hideOffset = 100,
  mobileOnly = false,
  label = 'Bottom Nav',
  variant = 'bottom-nav',
}: ScrollHideDemoProps) {
  const { elementSpring, shadowSpring, shadowParallaxSpring } = useScrollHide({
    hideOffset,
    mobileOnly,
  });

  // Live value readouts — subscribe to motion value changes
  const [elementY, setElementY] = useState(0);
  const [shadowOpacity, setShadowOpacity] = useState(0);
  const [parallax, setParallax] = useState(0);
  useMotionValueEvent(elementSpring, 'change', setElementY);
  useMotionValueEvent(shadowSpring, 'change', setShadowOpacity);
  useMotionValueEvent(shadowParallaxSpring, 'change', setParallax);

  const isBottom = variant === 'bottom-nav';
  const positionClasses = isBottom
    ? 'bottom-0 border-t'
    : 'top-0 border-b';
  const shadowClasses = isBottom
    ? 'bottom-full' // shadow above the element
    : 'top-full';    // shadow below the element
  const shadowGradient = isBottom
    ? 'linear-gradient(to top, rgba(0,0,0,0.12), transparent)'
    : 'linear-gradient(to bottom, rgba(0,0,0,0.10), transparent)';

  return (
    <main className="relative h-[500px] overflow-auto rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      {/* Scroll hint banner */}
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <span>↓</span>
        <span>Scroll to see the element &quot;{label}&quot; hide</span>
        <span>↓</span>
      </div>

      {/* Tall scrollable content */}
      <div className="flex flex-col items-center gap-6 px-6 pb-[200px] pt-8">
        {/* Live value readout cards — updated via useMotionValueEvent */}
        <div className="grid w-full max-w-md grid-cols-3 gap-3">
          <ValueCard
            label="element y"
            value={elementY}
            format="px"
            color="text-blue-600"
          />
          <ValueCard
            label="shadow opacity"
            value={shadowOpacity}
            format=""
            color="text-emerald-600"
          />
          <ValueCard
            label="parallax"
            value={parallax}
            format="px"
            color="text-purple-600"
          />
        </div>

        {/* Content blocks */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-full max-w-md rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800"
          >
            <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mb-1 h-3 w-full rounded bg-gray-100 dark:bg-gray-750" />
            <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        ))}

        {/* Configuration summary */}
        <div className="w-full max-w-md rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <code className="font-mono">
            useScrollHide({'{\u00a0'}
            hideOffset: {hideOffset},{' '}
            {mobileOnly && 'mobileOnly: true, '}
            {'}'})
          </code>
        </div>
      </div>

      {/* Simulated fixed element */}
      <motion.div
        className={`fixed left-0 right-0 z-20 border-gray-200 bg-white/95 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95 ${positionClasses}`}
        style={{ y: elementSpring }}
      >
        {/* Shadow overlay */}
        <motion.div
          className={`pointer-events-none absolute left-0 right-0 h-3 ${shadowClasses}`}
          style={{
            opacity: shadowSpring,
            y: shadowParallaxSpring,
            background: shadowGradient,
          }}
        />

        {/* Element content */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isBottom ? 'bg-blue-500' : 'bg-indigo-500'}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {label}
            </span>
          </div>
          <span className="font-mono text-[10px] text-gray-400">
            y: {elementY.toFixed(0)}px
          </span>
        </div>
      </motion.div>
    </main>
  );
}

/** Small card showing a live-updating motion value. */
function ValueCard({
  label,
  value,
  format,
  color,
}: {
  label: string;
  value: number;
  format: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white p-2.5 text-center shadow-sm dark:bg-gray-800">
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color} dark:brightness-125`}>
        {value.toFixed(2)}
        <span className="ml-0.5 text-[10px] font-normal opacity-60">{format}</span>
      </div>
    </div>
  );
}

// ─── Storybook configuration ────────────────────────────────────

const meta = {
  title: 'Hooks/useScrollHide',
  component: ScrollHideDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'A React hook that adds scroll-to-hide behavior and a scroll-driven',
          'shadow overlay with parallax to fixed/sticky elements.',
          '',
          '**Core behavior:**',
          '- Listens for scroll on the `<main>` element',
          '- Hides the element when scrolling down past 60px (delta > 8px)',
          '- Shows the element when scrolling up (delta < -8px)',
          '- Always visible at the top 60px of the page',
          '- RAF-throttled — zero React re-renders during scroll',
          '',
          '**Shadow & parallax:**',
          '- Shadow opacity ramps 0→1 over the first 20px of scroll',
          '- Shadow shifts ±3px with scroll velocity for depth feel',
          '',
          '**Mobile-only mode:**',
          '- Only activates on viewports ≤ 767px',
          '- Resets element position on resize to desktop',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    hideOffset: {
      control: { type: 'number', min: -200, max: 200, step: 10 },
      description: 'Y-offset when hidden. Positive = down, negative = up.',
      table: { defaultValue: { summary: '100' } },
    },
    mobileOnly: {
      control: 'boolean',
      description: 'Only activate on mobile-width viewports (< 768px).',
      table: { defaultValue: { summary: 'false' } },
    },
    label: {
      control: 'text',
      description: 'Label text displayed on the simulated element.',
      table: { defaultValue: { summary: '"Bottom Nav"' } },
    },
    variant: {
      control: 'select',
      options: ['bottom-nav', 'topbar'],
      description: 'Visual style: bottom-nav (shadow above) or topbar (shadow below).',
      table: { defaultValue: { summary: 'bottom-nav' } },
    },
  },
} satisfies Meta<typeof ScrollHideDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Stories ─────────────────────────────────────────────────────

/** Bottom navigation bar — slides downward when hidden. */
export const BottomNav: Story = {
  name: 'Bottom Nav',
  args: {
    hideOffset: 100,
    label: 'Bottom Nav',
    variant: 'bottom-nav',
  },
};

/** Topbar / header — slides upward when hidden. */
export const Topbar: Story = {
  name: 'Topbar',
  args: {
    hideOffset: -60,
    label: 'Topbar',
    variant: 'topbar',
  },
};

/** Topbar restricted to mobile viewports (matchMedia ≤ 767px). */
export const MobileOnly: Story = {
  name: 'Mobile-Only Topbar',
  args: {
    hideOffset: -60,
    mobileOnly: true,
    label: 'Topbar (mobile only)',
    variant: 'topbar',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile2', // 412 × 915 — typical mobile
    },
    docs: {
      description: {
        story: [
          'Only activates the scroll listener when the viewport is ≤ 767 px wide.',
          'Resizes to desktop reset the element to its visible position.',
        ].join('\n'),
      },
    },
  },
};
