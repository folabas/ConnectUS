'use client';

/**
 * The hero visual: three screens, one film, one timeline.
 *
 * This is the product's whole promise in a picture, so it is the one place on
 * the page that earns cinematic motion. It is still deliberately cheap:
 *
 *   - three DOM elements, not a canvas and not a WebGL scene
 *   - the only animated properties are `transform` and `opacity`
 *   - the playhead is a single CSS keyframe animation on the compositor, not a
 *     React state update per frame. Driving a progress bar from state would
 *     re-render this subtree ~60 times a second for a decorative detail
 *   - `prefers-reduced-motion` renders the same composition, static
 *
 * The "film" is a CSS gradient rather than an image: no request, no layout
 * shift, no decode, and nothing to lazy-load.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Mic, MessageCircle } from 'lucide-react';
import { EASE } from '@/lib/motion';
import { cn } from '@/lib/ui';

interface Screen {
  name: string;
  /** Fractional position in the stack, used for depth and stagger. */
  depth: number;
  className: string;
}

const SCREENS: Screen[] = [
  { name: 'Amara', depth: 2, className: 'left-0 top-[22%] w-[44%] sm:-left-4 sm:w-[42%]' },
  { name: 'Diego', depth: 1, className: 'right-0 top-[12%] w-[44%] sm:-right-3 sm:w-[42%]' },
  { name: 'You', depth: 0, className: 'left-1/2 top-[4%] w-[62%] -translate-x-1/2 sm:w-[58%]' },
];

export function SyncVisual({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn('relative mx-auto aspect-[5/4] w-full max-w-2xl sm:aspect-[16/9]', className)}
      aria-hidden="true"
    >
      {/* Ambient wash. One blurred element, not a stack of filters. */}
      <div className="pointer-events-none absolute inset-x-8 top-8 h-1/2 rounded-full bg-[#695CFF]/25 blur-[80px]" />

      {SCREENS.map((screen, index) => (
        <motion.div
          key={screen.name}
          initial={reduced ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 0.15 + index * 0.12 }}
          className={cn('absolute', screen.className)}
          style={{ zIndex: 10 - screen.depth }}
        >
          <div
            className={cn(
              'overflow-hidden rounded-xl border border-white/12 bg-[#141417] shadow-2xl sm:rounded-2xl',
              screen.depth > 0 && 'opacity-70',
            )}
          >
            {/* The frame everyone is on. */}
            <div className="relative aspect-video bg-[linear-gradient(135deg,#2a1f5e_0%,#4c3a9e_38%,#8B7FFF_66%,#f0a868_100%)]">
              {/* A suggestion of a scene: a horizon and a low sun. Two elements. */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1a1030] to-transparent" />
              <div className="absolute bottom-[28%] left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-[#ffd9a0] opacity-90 blur-[2px]" />

              {screen.depth === 0 && (
                <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3">
                  <Playhead reduced={Boolean(reduced)} />
                </div>
              )}
            </div>

            {/* Who is watching. */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium text-white sm:h-5 sm:w-5 sm:text-[9px]"
                style={{ backgroundColor: screen.depth === 0 ? '#695CFF' : '#3a3a42' }}
              >
                {screen.name[0]}
              </span>
              <span className="truncate text-[9px] text-white/70 sm:text-[11px]">
                {screen.name}
              </span>
              {screen.depth === 0 && (
                <Mic className="ml-auto h-2.5 w-2.5 text-emerald-400 sm:h-3 sm:w-3" />
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {/* One floating message, to say "there is a conversation here" without
          drawing a whole fake chat panel. */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : 0.85 }}
        className="absolute bottom-[2%] left-[1%] z-20 flex items-center gap-2 rounded-full border border-white/10 bg-[#141417]/95 px-3 py-1.5 shadow-xl backdrop-blur-sm sm:left-[6%]"
      >
        <MessageCircle className="h-3 w-3 text-[#8B7FFF]" />
        <span className="text-[10px] text-white/80 sm:text-xs">
          wait, rewind that bit
        </span>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : 1 }}
        className="absolute right-[4%] top-[2%] z-20 text-2xl sm:text-3xl"
      >
        🍿
      </motion.div>
    </div>
  );
}

/**
 * The shared timeline. The fill is a CSS animation so it runs entirely off the
 * main thread; under reduced motion it renders parked at a fixed position.
 */
function Playhead({ reduced }: { reduced: boolean }) {
  return (
    <div className="rounded-md bg-black/50 px-2 py-1.5 backdrop-blur-sm">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25">
        <div
          className={cn(
            'h-full rounded-full bg-white',
            reduced ? 'w-[38%]' : 'w-full origin-left animate-[playhead_9s_ease-in-out_infinite]',
          )}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[7px] text-white/60 sm:text-[9px]">
        <span>in sync · 3 watching</span>
        <span>1:24:06</span>
      </div>
    </div>
  );
}
