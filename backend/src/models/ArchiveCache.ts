import mongoose, { Document, Schema } from 'mongoose';

/**
 * Cached Internet Archive lookups.
 *
 * Searching is cheap; resolving is not. Each search result needs its own
 * metadata request to find a playable filename — the filename is not derivable
 * from the identifier — and total latency is the slowest of those requests.
 * Measured at ~6s for twelve results.
 *
 * The archive's holdings barely change, so results are cached for a week. A
 * negative result (`playable: false`) is cached too: an item with no browser-
 * playable derivative will still have none tomorrow, and re-checking it every
 * search is the most wasteful thing this code could do.
 */
export interface IArchiveCache extends Document {
    identifier: string;
    playable: boolean;
    title?: string;
    year?: number;
    description?: string;
    image?: string;
    duration?: string;
    videoUrl?: string;
    /** Set on write; a TTL index removes the document at this point. */
    expiresAt: Date;
}

/** A resolved answer, positive or negative, is stable — hold it for a week. */
export const ARCHIVE_CACHE_TTL_DAYS = 7;

/**
 * A lookup that timed out is not an answer, so it gets a much shorter life.
 *
 * Without caching these at all, the slowest items are re-attempted on every
 * search and every search pays the full timeout again — which is exactly what
 * measurement showed. Holding them briefly makes a repeated search fast while
 * still letting a genuinely playable item be picked up later.
 */
export const ARCHIVE_UNKNOWN_TTL_MINUTES = 60;

const archiveCacheSchema = new Schema<IArchiveCache>(
    {
        identifier: { type: String, required: true, unique: true, index: true },
        playable: { type: Boolean, required: true },
        title: String,
        year: Number,
        description: String,
        image: String,
        duration: String,
        videoUrl: String,
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true },
);

// Mongo drops documents once expiresAt passes, so nothing has to sweep this.
archiveCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ArchiveCache =
    (mongoose.models.ArchiveCache as mongoose.Model<IArchiveCache>) ||
    mongoose.model<IArchiveCache>('ArchiveCache', archiveCacheSchema);
