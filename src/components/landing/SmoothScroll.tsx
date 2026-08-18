'use client';

/**
 * Lenis smooth scrolling, applied only where it helps.
 *
 * Conditions under which it is *not* started, and why:
 *   - `prefers-reduced-motion`: scroll hijacking is exactly what that preference
 *     is about. Native scrolling is restored entirely.
 *   - coarse pointers: touch platforms already have tuned momentum scrolling,
 *     and overriding it makes a phone feel laggy rather than smooth. This is the
 *     opposite of the usual mistake, which is shipping desktop scroll physics to
 *     a phone and calling it polish.
 *
 * The library itself is imported dynamically, so it stays out of the initial
 * bundle and never loads at all for the two cases above.
 */

import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

export function SmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let lenis: { raf(time: number): void; destroy(): void } | null = null;
    let frame = 0;
    let cancelled = false;

    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;

      lenis = new Lenis({
        duration: 1.05,
        // Slightly overshoot-free easing so long pages do not feel like they
        // are sliding to a stop after the user has stopped scrolling.
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [reduced]);

  return null;
}
