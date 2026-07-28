import type { Meta, StoryObj } from '@storybook/react';
import { motion, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { useScrollShadow } from './use-scroll-shadow';

// ─── Demo component ─────────────────────────────────────────────
// Renders a scrollable container with a simulated sticky header
// that demonstrates scroll-driven shadow overlay and parallax.

interface ScrollShadowDemoProps {
  /** Only activate on mobile-width viewports (< 768px). */
  mobileOnly?: boolean;
  /** Label displayed on the simulated sticky header. */
  label?: string;
  /** Shadow gradient intensity (0.04–0.12). */
  shadowIntensity?: number;
}

function ScrollShadowDemo({
  mobileOnly = false,
  label = 'Sticky Header',
  shadowIntensity = 0.06,
}: ScrollShadowDemoProps) {
  const { shadowSpring, shadowParallaxSpring } = useScrollShadow({ mobileOnly });

  // Live value readouts
  const [shadowOpacity, setShadowOpacity] = useState(0);
  const [parallax, setParallax] = useState(0);
  useMotionValueEvent(shadowSpring, 'change', setShadowOpacity);
  useMotionValueEvent(shadowParallaxSpring, 'change', setParallax);

  return (
    <main className="relative h-[500px] overflow-auto rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      {/* Scroll hint banner */}
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <span>↓</span>
        <span>Scroll to see the shadow fade in beneath &quot;{label}&quot;</span>
        <span>↓</span>
      </div>

      {/* Tall scrollable content */}
      <div className="flex flex-col items-center gap-6 px-6 pb-[200px] pt-8">
        {/* Live value readout cards */}
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
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
            <div className="mb-1 h-3 w-full rounded bg-gray-100 dark:bg-gray-600" />
            <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-gray-600" />
          </div>
        ))}

        {/* Configuration summary */}
        <div className="w-full max-w-md rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <code className="font-mono">
            useScrollShadow({'{\u00a0'}
            {mobileOnly && 'mobileOnly: true, '}
            {'}'})
          </code>
        </div>
      </div>

      {/* Simulated sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95">
        {/* Shadow overlay — appears at the bottom edge of the header when content scrolls behind it */}
        {/* Light mode */}
        <motion.div
          className="pointer-events-none absolute top-full left-0 right-0 h-3 dark:hidden"
          style={{
            opacity: shadowSpring,
            y: shadowParallaxSpring,
            background: `linear-gradient(to bottom, rgba(0,0,0,${shadowIntensity}), transparent)`,
          }}
        />
        {/* Dark mode */}
        <motion.div
          className="pointer-events-none absolute top-full left-0 right-0 h-3 hidden dark:block"
          style={{
            opacity: shadowSpring,
            y: shadowParallaxSpring,
            background: `linear-gradient(to bottom, rgba(255,255,255,${(shadowIntensity * 0.6).toFixed(2)}), transparent)`,
          }}
        />

        {/* Header content */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              shadow: {shadowOpacity.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
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
        {value.toFixed(3)}
        <span className="ml-0.5 text-[10px] font-normal opacity-60">{format}</span>
      </div>
    </div>
  );
}

// ─── Storybook configuration ────────────────────────────────────

const meta = {
  title: 'Hooks/useScrollShadow',
  component: ScrollShadowDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'A lightweight hook that provides scroll-driven shadow opacity and',
          'parallax values without element hide/show logic.',
          '',
          'Use for elements that only need a shadow overlay as the user',
          'scrolls — e.g. sticky headers, floating buttons, or static banners.',
          '',
          '**How it works:**',
          '- Listens for scroll on the `<main>` element',
          '- Shadow opacity ramps 0→1 over the first 20px of scroll',
          '- Shadow shifts ±3px with scroll velocity for depth feel',
          '- RAF-throttled — zero React re-renders during scroll',
          '',
          '**Mobile-only mode:**',
          '- Only activates on viewports ≤ 767px',
          '- Resets shadow on resize to desktop',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    mobileOnly: {
      control: 'boolean',
      description: 'Only activate on mobile-width viewports (< 768px).',
      table: { defaultValue: { summary: 'false' } },
    },
    label: {
      control: 'text',
      description: 'Label text displayed on the simulated sticky header.',
      table: { defaultValue: { summary: '"Sticky Header"' } },
    },
    shadowIntensity: {
      control: { type: 'range', min: 0.04, max: 0.12, step: 0.01 },
      description: 'Shadow gradient intensity for light mode.',
      table: { defaultValue: { summary: '0.06' } },
    },
  },
} satisfies Meta<typeof ScrollShadowDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Stories ─────────────────────────────────────────────────────

/** Default sticky header — shadow fades in as content scrolls behind it. */
export const Default: Story = {
  name: 'Default',
  args: {
    label: 'Sticky Header',
    shadowIntensity: 0.06,
  },
};

/** Mobile-only mode — shadow only activates on mobile-width viewports. */
export const MobileOnly: Story = {
  name: 'Mobile-Only',
  args: {
    mobileOnly: true,
    label: 'Sticky Header (mobile only)',
    shadowIntensity: 0.08,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile2',
    },
    docs: {
      description: {
        story: [
          'Only activates the scroll listener when the viewport is ≤ 767 px wide.',
          'Resizing to desktop resets the shadow to its initial state.',
        ].join('\n'),
      },
    },
  },
};
