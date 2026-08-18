import { describe, expect, it, vi } from 'vitest';
import { formatDuration, formatRelative, initials } from '@/lib/ui';
import { isHost, isRoomLive } from '@/types';

describe('formatDuration', () => {
  it('renders minutes and seconds under an hour', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('renders hours when the film is long enough', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('degrades safely on NaN, which a video element reports before metadata loads', () => {
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatRelative', () => {
  it('describes recent times in minutes', () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60_000).toISOString();
    expect(formatRelative(fourMinutesAgo)).toBe('4m ago');
  });

  it('collapses the last minute to "just now"', () => {
    expect(formatRelative(new Date().toISOString())).toBe('just now');
  });

  it('returns empty rather than "NaN ago" for an unparseable date', () => {
    expect(formatRelative('not a date')).toBe('');
  });

  it('does not report a future timestamp as negative', () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    expect(formatRelative(soon)).toBe('just now');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
  });

  it('handles a single name', () => {
    expect(initials('Ada')).toBe('A');
  });

  it('falls back when the name is missing or blank', () => {
    expect(initials(undefined)).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('isHost', () => {
  const host = { _id: 'user-1', fullName: 'Ada' };

  it('matches a populated host reference', () => {
    expect(isHost({ host }, 'user-1')).toBe(true);
    expect(isHost({ host }, 'user-2')).toBe(false);
  });

  it('matches an unpopulated host reference', () => {
    // Not every endpoint populates `host`; a raw ObjectId string must still work
    // or the host silently loses their controls.
    expect(isHost({ host: 'user-1' as never }, 'user-1')).toBe(true);
  });

  it('is false when either side is missing', () => {
    expect(isHost(null, 'user-1')).toBe(false);
    expect(isHost({ host }, undefined)).toBe(false);
  });
});

describe('isRoomLive', () => {
  it('is true only for states with playback under way', () => {
    expect(isRoomLive('playing')).toBe(true);
    expect(isRoomLive('active')).toBe(true);
    expect(isRoomLive('waiting')).toBe(false);
    expect(isRoomLive('scheduled')).toBe(false);
    expect(isRoomLive('finished')).toBe(false);
  });
});
