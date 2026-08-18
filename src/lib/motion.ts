/**
 * Shared motion vocabulary.
 *
 * Two rules the landing page follows:
 *
 *   1. Everything animates `transform` and `opacity` only. Those are the two
 *      properties the compositor can handle without a layout or paint pass, so
 *      a reveal costs nothing measurable even on a mid-range phone.
 *   2. Motion has a hierarchy. Most of the page is micro (hover) and component
 *      level (a card arriving). Section-level reveals are used sparingly and
 *      only the hero gets anything cinematic — otherwise every element competes
 *      for attention and none of it means anything.
 */

import type { Transition, Variants } from 'framer-motion';

/** The house easing: a firm start that settles rather than bounces. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const transition: Transition = { duration: 0.6, ease: EASE };
export const quick: Transition = { duration: 0.35, ease: EASE };

/** Component-level arrival. The default for cards, list items, images. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition },
};

/** Section-level arrival, with a touch more travel. Use sparingly. */
export const sectionIn: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition },
};

/**
 * Parent for a group that should arrive in sequence.
 * `staggerChildren` is deliberately small — a long cascade reads as a loading
 * bug rather than as choreography.
 */
export const stagger = (delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren },
  },
});

/**
 * Standard viewport config for scroll reveals. `once` matters: re-animating on
 * every scroll-by is the single most common way a site starts feeling cheap,
 * and it keeps IntersectionObserver work bounded.
 */
export const viewport = { once: true, amount: 0.25, margin: '0px 0px -80px 0px' } as const;

/**
 * Variants collapsed for `prefers-reduced-motion`.
 *
 * Note that content still *appears* — it simply arrives without travel. Removing
 * the animation entirely would leave elements stuck at `opacity: 0` for anyone
 * with the preference set, which is the usual bug in reduced-motion support.
 */
export const still: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

/** Pick the right variants for the user's motion preference. */
export function motionSafe(variants: Variants, reduced: boolean | null): Variants {
  return reduced ? still : variants;
}
