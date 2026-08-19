'use client';

/**
 * Whether an element is currently on screen.
 *
 * The landing visuals are looping animations driven by chained timers. Without
 * this they run from mount for the life of the page, so all three "how it
 * works" illustrations were animating while more than 1600px below the fold —
 * waking React and the compositor for something nobody could see.
 *
 * Unlike the scroll reveals, which fire once and are done, these need to be
 * told when to *stop*, so `once` is not an option here.
 */

import { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement = HTMLDivElement>(
  /** Start a little before the element arrives so it is mid-cycle on entry. */
  rootMargin = '200px',
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // IntersectionObserver has been baseline in every browser this app targets
    // since 2019, so there is no fallback path to keep correct.
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
