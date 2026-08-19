/**
 * These landing illustrations are looping animations sitting ~2000px below the
 * fold. The thing worth testing is not what they look like but *when they run*:
 * before the visibility gate they animated from mount, for the whole life of
 * the page, while nobody could see them.
 */

import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** A controllable IntersectionObserver, so a test can decide what is on screen. */
const observers: Array<(visible: boolean) => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no Element.scrollTo; the chat panel autoscrolls on new messages.
  Element.prototype.scrollTo = vi.fn();
  observers.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push((visible) => cb([{ isIntersecting: visible }]));
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const show = (visible: boolean) =>
  act(() => {
    observers.forEach((fire) => fire(visible));
  });

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('StepTwoVisual', () => {
  /** The lobby renders one avatar per arrival, so this counts the animation. */
  const arrivals = (el: HTMLElement) =>
    el.querySelectorAll('[data-testid="lobby-avatar"]').length;

  it('stays still while off screen', async () => {
    const { StepTwoVisual } = await import('@/components/landing/StepVisual');
    const { container } = render(<StepTwoVisual />);

    // Never reported as intersecting: nobody should arrive, ever.
    advance(30_000);
    expect(arrivals(container)).toBe(0);
    expect(screen.queryByText(/room code/i)).toBeNull();
  });

  it('runs once it scrolls into view, and parks when it leaves', async () => {
    const { StepTwoVisual } = await import('@/components/landing/StepVisual');
    const { container } = render(<StepTwoVisual />);

    show(true);
    advance(1100);
    expect(arrivals(container)).toBe(1);

    advance(600);
    expect(arrivals(container)).toBe(2);

    show(false);
    const parked = arrivals(container);
    advance(20_000);
    expect(arrivals(container)).toBe(parked);
  });
});

describe('WatchRoomVisual', () => {
  const messages = (el: HTMLElement) =>
    el.querySelectorAll('[data-testid="chat-line"]').length;

  it('does not fill its chat until it is on screen', async () => {
    const { WatchRoomVisual } = await import(
      '@/components/landing/WatchRoomVisual'
    );
    const { container } = render(<WatchRoomVisual />);

    advance(30_000);
    expect(messages(container)).toBe(0);

    show(true);
    advance(6000);
    expect(messages(container)).toBeGreaterThan(0);
  });
});
