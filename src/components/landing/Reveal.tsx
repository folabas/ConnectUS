'use client';

/**
 * Scroll reveal.
 *
 * Wraps framer-motion's `whileInView`, which is IntersectionObserver underneath
 * — no scroll listener, no layout reads per frame. `once` is on by default so
 * each element is observed until it fires and then forgotten.
 *
 * Under `prefers-reduced-motion` the content renders immediately at full
 * opacity instead of animating. It deliberately does not just skip the
 * animation, which would leave the element invisible forever.
 */

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { motionSafe, riseIn, sectionIn, stagger, viewport } from '@/lib/motion';

type Level = 'component' | 'section';

export function Reveal({
  children,
  level = 'component',
  delay = 0,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  level?: Level;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const reduced = useReducedMotion();
  const base: Variants = level === 'section' ? sectionIn : riseIn;
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={motionSafe(base, reduced)}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      transition={reduced ? undefined : { delay }}
    >
      {children}
    </Component>
  );
}

/** Parent that arranges its `Reveal` children into a short sequence. */
export function RevealGroup({
  children,
  className,
  delayChildren = 0,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delayChildren?: number;
  as?: 'div' | 'ul';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={reduced ? undefined : stagger(delayChildren)}
      initial={reduced ? undefined : 'hidden'}
      whileInView={reduced ? undefined : 'visible'}
      viewport={viewport}
    >
      {children}
    </Component>
  );
}
