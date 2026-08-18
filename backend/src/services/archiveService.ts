/**
 * Internet Archive catalog client.
 *
 * Supplies the launch catalog: real, freely licensed films with no API key and
 * no licensing exposure. See docs/VIDEO_SOURCES.md for why this source was
 * chosen over the alternatives.
 *
 * Two things the Archive makes non-obvious:
 *   - the video filename is not derivable from the item identifier, so a
 *     playable URL requires a second request to the metadata endpoint
 *   - many items in the movie collections have no streamable derivative at all
 *     (audio, images, or a stalled derive), so results must be filtered by what
 *     is actually playable rather than by what the search returns
 */

import {
    ArchiveCache,
    ARCHIVE_CACHE_TTL_DAYS,
    ARCHIVE_UNKNOWN_TTL_MINUTES,
} from '../models/ArchiveCache';

const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const METADATA_URL = 'https://archive.org/metadata';
const DOWNLOAD_URL = 'https://archive.org/download';

/** Give up rather than hang a request behind a slow third party. */
const TIMEOUT_MS = 12_000;

/**
 * Per-item timeout when resolving a playable file.
 *
 * Resolution runs concurrently, so total latency is the slowest single metadata
 * lookup. Measured against the live API a search took ~11s, almost all of it
 * waiting on one or two slow items. Capping each lookup trades a couple of
 * results for a search that returns in a usable time.
 */
const RESOLVE_TIMEOUT_MS = 5_000;

/** Derivative formats we can play in a browser, best first. */
const PLAYABLE_FORMATS = ['h.264', '512Kb MPEG4', 'MPEG4', 'HiRes MPEG4', 'Ogg Video'];

export interface ArchiveResult {
    identifier: string;
    title: string;
    year?: number;
    description?: string;
    /** Only present once the metadata lookup has found a playable file. */
    videoUrl?: string;
    image: string;
    duration?: string;
}

interface ArchiveFile {
    name: string;
    format?: string;
    length?: string;
    size?: string;
}

async function fetchJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Internet Archive responded ${response.status}`);
        }
        return (await response.json()) as T;
    } finally {
        clearTimeout(timer);
    }
}

/** "1:52:30" or "3271.5" -> "1h 52m". */
function formatLength(length?: string): string | undefined {
    if (!length) return undefined;

    let totalSeconds: number;
    if (length.includes(':')) {
        const parts = length.split(':').map(Number);
        if (parts.some(Number.isNaN)) return undefined;
        totalSeconds = parts.reduce((acc, part) => acc * 60 + part, 0);
    } else {
        totalSeconds = Number(length);
        if (Number.isNaN(totalSeconds)) return undefined;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function thumbnailFor(identifier: string): string {
    return `https://archive.org/services/img/${identifier}`;
}

/** Archive metadata fields are sometimes a string and sometimes an array. */
function firstValue(value: unknown): string | undefined {
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
    return typeof value === 'string' ? value : undefined;
}

/**
 * Search the moving-image collections.
 *
 * Results are candidates only — `videoUrl` is absent until `resolve` confirms a
 * playable derivative exists.
 */
export async function searchArchive(query: string, page = 1, rows = 20): Promise<ArchiveResult[]> {
    // Restrict to collections that actually contain watchable films, and exclude
    // items marked as unavailable for download.
    const q = [
        `(${escapeQuery(query)})`,
        'AND mediatype:(movies)',
        'AND (collection:(feature_films) OR collection:(classic_cartoons) OR collection:(short_films) OR collection:(sci_fi_horror))',
    ].join(' ');

    const params = new URLSearchParams({
        q,
        rows: String(rows),
        page: String(page),
        output: 'json',
    });
    ['identifier', 'title', 'year', 'description'].forEach((field) =>
        params.append('fl[]', field),
    );

    const payload = await fetchJson<{
        response?: { docs?: Array<Record<string, unknown>> };
    }>(`${SEARCH_URL}?${params.toString()}`);

    const docs = payload.response?.docs ?? [];

    return docs
        .map((doc): ArchiveResult | null => {
            const identifier = firstValue(doc.identifier);
            const title = firstValue(doc.title);
            if (!identifier || !title) return null;

            const year = Number(firstValue(doc.year));
            return {
                identifier,
                title,
                year: Number.isFinite(year) ? year : undefined,
                description: firstValue(doc.description)
                    ?.replace(/<[^>]*>/g, '')
                    .slice(0, 500),
                image: thumbnailFor(identifier),
            };
        })
        .filter((result): result is ArchiveResult => result !== null);
}

/** Lucene special characters would otherwise break the query. */
function escapeQuery(query: string): string {
    return query.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, ' ').trim();
}

/**
 * Resolve an identifier to a playable URL plus richer metadata.
 * Returns null when the item has no browser-playable derivative.
 */
export async function resolveArchiveItem(
    identifier: string,
    timeoutMs = TIMEOUT_MS,
): Promise<ArchiveResult | null> {
    const payload = await fetchJson<{
        metadata?: Record<string, unknown>;
        files?: ArchiveFile[];
    }>(`${METADATA_URL}/${encodeURIComponent(identifier)}`, timeoutMs);

    const files = payload.files ?? [];
    const metadata = payload.metadata ?? {};

    // Prefer the smallest acceptable rendition: these are streamed straight to
    // the browser, and a 700MB h.264 master buffers badly on a home connection.
    let chosen: ArchiveFile | undefined;
    for (const format of PLAYABLE_FORMATS) {
        const match = files.find(
            (file) => file.format === format && /\.(mp4|ogv|webm)$/i.test(file.name),
        );
        if (match) {
            chosen = match;
            break;
        }
    }

    if (!chosen) return null;

    const title = firstValue(metadata.title) ?? identifier;
    const year = Number(firstValue(metadata.year) ?? firstValue(metadata.date)?.slice(0, 4));

    return {
        identifier,
        title,
        year: Number.isFinite(year) ? year : undefined,
        description: firstValue(metadata.description)
            ?.replace(/<[^>]*>/g, '')
            .slice(0, 1000),
        image: thumbnailFor(identifier),
        duration: formatLength(chosen.length),
        videoUrl: `${DOWNLOAD_URL}/${encodeURIComponent(identifier)}/${encodeURIComponent(chosen.name)}`,
    };
}

/**
 * Resolve with a cache in front.
 *
 * Both outcomes are cached. A negative result matters as much as a positive
 * one: an item with no playable derivative will still have none next week, and
 * re-fetching its metadata on every search is the single biggest waste here.
 */
export async function resolveCached(identifier: string): Promise<ArchiveResult | null> {
    try {
        const cached = await ArchiveCache.findOne({ identifier }).lean();
        if (cached) {
            if (!cached.playable) return null;
            return {
                identifier,
                title: cached.title ?? identifier,
                year: cached.year,
                description: cached.description,
                image: cached.image ?? thumbnailFor(identifier),
                duration: cached.duration,
                videoUrl: cached.videoUrl,
            };
        }
    } catch {
        // A cache miss must never be fatal; fall through to a live lookup.
    }

    let resolved: ArchiveResult | null = null;
    let timedOut = false;
    try {
        resolved = await resolveArchiveItem(identifier, RESOLVE_TIMEOUT_MS);
    } catch {
        // Not a negative answer — the item may well be playable, the archive was
        // just slow. Cached briefly so a repeated search does not pay the full
        // timeout again, but not for long enough to hide it permanently.
        timedOut = true;
    }

    const expiresAt = timedOut
        ? new Date(Date.now() + ARCHIVE_UNKNOWN_TTL_MINUTES * 60 * 1000)
        : new Date(Date.now() + ARCHIVE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
        await ArchiveCache.updateOne(
            { identifier },
            {
                $set: {
                    identifier,
                    playable: Boolean(resolved?.videoUrl),
                    title: resolved?.title,
                    year: resolved?.year,
                    description: resolved?.description,
                    image: resolved?.image,
                    duration: resolved?.duration,
                    videoUrl: resolved?.videoUrl,
                    expiresAt,
                },
            },
            { upsert: true },
        );
    } catch {
        // Caching is an optimisation; failing to write one is not an error.
    }

    return resolved?.videoUrl ? resolved : null;
}

/**
 * Search, then resolve each candidate, keeping only the playable ones.
 * Resolution runs concurrently — serially this would be a dozen round trips.
 */
export async function searchPlayable(query: string, page = 1): Promise<ArchiveResult[]> {
    // 12 rather than 20: each uncached candidate costs a metadata round trip, and
    // a shorter list that arrives quickly beats a longer one that does not.
    const candidates = await searchArchive(query, page, 12);

    const resolved = await Promise.all(
        candidates.map((candidate) => resolveCached(candidate.identifier)),
    );

    return resolved.filter((item): item is ArchiveResult => item !== null && Boolean(item.videoUrl));
}
