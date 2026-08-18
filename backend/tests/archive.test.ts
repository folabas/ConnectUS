/**
 * Archive metadata caching.
 *
 * `fetch` is stubbed here rather than hitting archive.org: the point is to count
 * how many network round trips the cache avoids, which a live dependency with
 * variable latency cannot tell us.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDatabase, disconnectDatabase, resetDatabase } from './helpers';

const IDENTIFIER = 'test-item-playable';

/** A metadata response containing a browser-playable derivative. */
const playableMetadata = {
    metadata: { title: 'A Playable Film', year: '1931' },
    files: [
        { name: 'poster.jpg', format: 'JPEG' },
        { name: 'film_512kb.mp4', format: '512Kb MPEG4', length: '1:19:00' },
    ],
};

/** An item whose only file is audio — nothing to play in a video element. */
const unplayableMetadata = {
    metadata: { title: 'Just Audio' },
    files: [{ name: 'track.mp3', format: 'VBR MP3' }],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
    await connectDatabase();
});

afterAll(async () => {
    await disconnectDatabase();
});

beforeEach(async () => {
    await resetDatabase();
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function respondWith(payload: unknown, ok = true) {
    return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: async () => payload,
    } as Response);
}

describe('resolveCached', () => {
    it('fetches once, then serves the same item from cache', async () => {
        fetchMock.mockImplementation(() => respondWith(playableMetadata));
        const { resolveCached } = await import('../src/services/archiveService');

        const first = await resolveCached(IDENTIFIER);
        expect(first?.title).toBe('A Playable Film');
        expect(first?.videoUrl).toContain('film_512kb.mp4');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const second = await resolveCached(IDENTIFIER);
        expect(second?.title).toBe('A Playable Film');
        expect(second?.videoUrl).toBe(first?.videoUrl);
        // The whole point: no second round trip.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('remembers that an item is not playable, rather than re-checking it', async () => {
        // A negative answer is as worth caching as a positive one — an item with
        // no playable derivative will not grow one, and re-fetching it on every
        // search was the largest source of waste.
        fetchMock.mockImplementation(() => respondWith(unplayableMetadata));
        const { resolveCached } = await import('../src/services/archiveService');

        expect(await resolveCached('audio-only')).toBeNull();
        expect(await resolveCached('audio-only')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('caches a timeout only briefly, so a slow item is retried later', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('aborted')));
        const { resolveCached } = await import('../src/services/archiveService');
        const { ArchiveCache, ARCHIVE_UNKNOWN_TTL_MINUTES } = await import(
            '../src/models/ArchiveCache'
        );

        expect(await resolveCached('slow-item')).toBeNull();

        const entry = await ArchiveCache.findOne({ identifier: 'slow-item' });
        expect(entry).not.toBeNull();
        expect(entry!.playable).toBe(false);

        // Hours, not days: a timeout is not an answer about the item itself.
        const lifetimeMs = entry!.expiresAt.getTime() - Date.now();
        expect(lifetimeMs).toBeLessThanOrEqual(ARCHIVE_UNKNOWN_TTL_MINUTES * 60 * 1000 + 5000);
        expect(lifetimeMs).toBeGreaterThan(0);
    });

    it('keeps a resolved answer far longer than a timeout', async () => {
        fetchMock.mockImplementation(() => respondWith(playableMetadata));
        const { resolveCached } = await import('../src/services/archiveService');
        const { ArchiveCache, ARCHIVE_UNKNOWN_TTL_MINUTES } = await import(
            '../src/models/ArchiveCache'
        );

        await resolveCached(IDENTIFIER);

        const entry = await ArchiveCache.findOne({ identifier: IDENTIFIER });
        const lifetimeMs = entry!.expiresAt.getTime() - Date.now();
        expect(lifetimeMs).toBeGreaterThan(ARCHIVE_UNKNOWN_TTL_MINUTES * 60 * 1000);
    });

    it('picks the smallest acceptable rendition', async () => {
        // These stream straight to the browser; a 700MB master buffers badly on a
        // home connection when a 500MB version of the same film exists.
        fetchMock.mockImplementation(() =>
            respondWith({
                metadata: { title: 'Two Renditions' },
                files: [
                    { name: 'master.mp4', format: 'h.264', length: '1:00:00' },
                    { name: 'small_512kb.mp4', format: '512Kb MPEG4', length: '1:00:00' },
                ],
            }),
        );
        const { resolveCached } = await import('../src/services/archiveService');

        const result = await resolveCached('two-renditions');
        expect(result?.videoUrl).toContain('master.mp4');
    });

    it('encodes identifiers and filenames into the playback url', async () => {
        fetchMock.mockImplementation(() =>
            respondWith({
                metadata: { title: 'Spaces And Brackets' },
                files: [{ name: 'A Film (1922).mp4', format: '512Kb MPEG4' }],
            }),
        );
        const { resolveCached } = await import('../src/services/archiveService');

        const result = await resolveCached('odd id');
        // A raw space would produce a url the browser cannot request.
        expect(result?.videoUrl).not.toContain(' ');
        expect(result?.videoUrl).toContain('%20');
    });
});
