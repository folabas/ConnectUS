'use client';

/**
 * A film reel drifting past, built from CSS rather than video.
 *
 * A looping hero video would be several megabytes on first paint, which is the
 * one thing this page cannot afford. Each "frame" is a gradient and two shapes,
 * so the whole strip costs a handful of DOM nodes and one transform animation
 * running on the compositor.
 *
 * The track is duplicated and translated by exactly -50%, which is what makes
 * the loop seamless: the second copy is in the first copy's place at the moment
 * the animation restarts.
 */

import { cn } from '@/lib/ui';

interface Frame {
  title: string;
  year: string;
  /** Two-stop gradient standing in for the film's palette. */
  from: string;
  to: string;
}

/**
 * Real public-domain titles, so the reel is honest about what the library
 * actually holds rather than inventing films.
 */
const FRAMES: Frame[] = [
  { title: 'Nosferatu', year: '1922', from: '#1b1410', to: '#6b4a2a' },
  { title: 'Metropolis', year: '1927', from: '#0f1622', to: '#3d5a80' },
  { title: 'His Girl Friday', year: '1940', from: '#241a12', to: '#8a6a3d' },
  { title: 'Night of the Living Dead', year: '1968', from: '#101010', to: '#4a4a4a' },
  { title: 'Charade', year: '1963', from: '#2a1220', to: '#94456b' },
  { title: 'The General', year: '1926', from: '#1a1a12', to: '#7a7150' },
  { title: 'Plan 9 from Outer Space', year: '1959', from: '#0d1420', to: '#2f5d7c' },
  { title: 'Detour', year: '1945', from: '#1e1410', to: '#7c4a35' },
];

function ReelFrame({ frame }: { frame: Frame }) {
  return (
    <figure className="w-56 shrink-0 sm:w-64">
      <div
        className="relative aspect-video overflow-hidden rounded-lg border border-white/10"
        style={{ background: `linear-gradient(140deg, ${frame.from}, ${frame.to})` }}
      >
        {/* A horizon and a light source: enough to read as a frame of film. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-[30%] left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-white/70 blur-[3px]" />

        {/* Projector scanline. One element, one transform. */}
        <div className="scanline pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />
      </div>

      <figcaption className="mt-2 px-0.5">
        <p className="truncate text-sm text-white/80">{frame.title}</p>
        <p className="text-xs text-white/35">{frame.year} · public domain</p>
      </figcaption>
    </figure>
  );
}

export function FilmReel({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      aria-label="A selection of public-domain films in the library"
    >
      {/* The strip runs edge to edge; these fade it out rather than cutting it. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--bg)] to-transparent" />

      <div className="reel-track flex w-max gap-4">
        {/* Duplicated so the -50% translation lands seamlessly. The copy is
            hidden from assistive tech, which should hear the list once. */}
        {FRAMES.map((frame) => (
          <ReelFrame key={frame.title} frame={frame} />
        ))}
        <div className="flex gap-4" aria-hidden>
          {FRAMES.map((frame) => (
            <ReelFrame key={`${frame.title}-copy`} frame={frame} />
          ))}
        </div>
      </div>
    </div>
  );
}
