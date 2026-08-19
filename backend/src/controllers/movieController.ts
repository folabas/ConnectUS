import { Request, Response } from 'express';
import { Movie } from '../models/Movie';
import { createDirectUpload, getAssetDetails, formatDuration, getUploadDetails } from '../utils/mux';
import { AuthRequest } from '../middleware/auth';
import { searchPlayable, resolveCached } from '../services/archiveService';

/**
 * The starter catalogue.
 *
 * Six real public-domain films, every one resolved from the Internet Archive
 * and confirmed to serve an HTTP range request — which is what the player needs
 * in order to seek — by scripts/find-seed-films.ts.
 *
 * What this replaced: six invented titles (Quantum Horizon, Dark Velocity and
 * friends) with fabricated ratings and synopses, all pointing at Google's
 * sample bucket. Four of the six were fifteen-second Chromecast adverts rather
 * than films, and the bucket now returns 403 outright, so a new user's very
 * first click was a dead link dressed up as a feature.
 *
 * Titles and years are curated rather than taken from the archive, whose
 * metadata is uploader-supplied and arrives as things like "Carnival of Souls
 * ( iPod Video Version )". The identifiers and URLs are exactly as verified.
 */
const initialMovies = [
    {
        title: 'Nosferatu',
        image: 'https://archive.org/services/img/Nosferatu1922',
        duration: '1h 32m',
        rating: 'N/A',
        genre: 'Horror',
        videoUrl: 'https://archive.org/download/Nosferatu1922/Nosferatu.mp4',
        archiveId: 'Nosferatu1922',
        source: 'archive' as const,
        description:
            "Murnau's unauthorised Dracula, and the film that taught cinema what a shadow could do. German Expressionism at its most unsettling.",
        year: 1922,
    },
    {
        title: 'Night of the Living Dead',
        image: 'https://archive.org/services/img/night-of-the-living-dead-1968',
        duration: '1h 36m',
        rating: 'N/A',
        genre: 'Horror',
        videoUrl:
            'https://archive.org/download/night-of-the-living-dead-1968/Night%20of%20the%20Living%20Dead%20(1968).mp4',
        archiveId: 'night-of-the-living-dead-1968',
        source: 'archive' as const,
        description:
            'Romero invented the modern zombie here, then lost the copyright to a missing notice on the title card — which is why it is free to watch at all.',
        year: 1968,
    },
    {
        title: 'His Girl Friday',
        image: 'https://archive.org/services/img/HisGirlFriday1940',
        duration: '1h 33m',
        rating: 'N/A',
        genre: 'Comedy',
        videoUrl: 'https://archive.org/download/HisGirlFriday1940/seqhisgirlfridayfull1d_512kb.mp4',
        archiveId: 'HisGirlFriday1940',
        source: 'archive' as const,
        description:
            'Newspaper screwball with dialogue so fast the cast talk over each other on purpose. Cary Grant and Rosalind Russell at full tilt.',
        year: 1940,
    },
    {
        title: 'Carnival of Souls',
        image: 'https://archive.org/services/img/carnival_of_souls',
        duration: '1h 23m',
        rating: 'N/A',
        genre: 'Horror',
        videoUrl: 'https://archive.org/download/carnival_of_souls/carnival_of_souls_512kb.mp4',
        archiveId: 'carnival_of_souls',
        source: 'archive' as const,
        description:
            'A church organist survives a crash and finds herself drawn to an abandoned pavilion. Made for almost nothing, and quietly terrifying.',
        year: 1962,
    },
    {
        title: 'Detour',
        image: 'https://archive.org/services/img/detour_1945',
        duration: '1h 9m',
        rating: 'N/A',
        genre: 'Drama',
        videoUrl: 'https://archive.org/download/detour_1945/detour_4k.mp4',
        archiveId: 'detour_1945',
        source: 'archive' as const,
        description:
            'Film noir stripped to the bone: a hitchhiker, a dead man and a series of decisions that only make things worse. Shot in six days.',
        year: 1945,
    },
    {
        title: 'The General',
        image: 'https://archive.org/services/img/TheGeneral1926',
        duration: '1h 19m',
        rating: 'N/A',
        genre: 'Comedy',
        videoUrl: 'https://archive.org/download/TheGeneral1926/The_General_1926_720p_512kb.mp4',
        archiveId: 'TheGeneral1926',
        source: 'archive' as const,
        description:
            'Buster Keaton chases a stolen locomotive through the Civil War, performing his own stunts on a moving train because of course he did.',
        year: 1926,
    },
];

/**
 * Titles from the old seed that pointed at Google's sample bucket.
 *
 * They are removed on seed rather than left in place: the bucket returns 403,
 * so each one is a broken play button, and they claimed runtimes of two hours
 * for what were fifteen-second adverts. Matched on the exact videoUrl host so
 * nothing a user added themselves is ever touched.
 */
const DEAD_SAMPLE_HOST = 'commondatastorage.googleapis.com';

// GET /api/movies
export const getMovies = async (req: Request, res: Response): Promise<void> => {
    try {
        const { genre, search } = req.query;
        let query: any = {};

        if (genre && genre !== 'All') {
            query.genre = genre;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const movies = await Movie.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: movies.length,
            data: movies,
        });
    } catch (error: any) {
        console.error('Get movies error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// GET /api/movies/:id
export const getMovieById = async (req: Request, res: Response): Promise<void> => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            res.status(404).json({
                success: false,
                message: 'Movie not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: movie,
        });
    } catch (error: any) {
        // Handle invalid ID format (CastError)
        if (error.name === 'CastError') {
            res.status(404).json({
                success: false,
                message: 'Movie not found',
            });
            return;
        }

        console.error('Get movie error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/movies/seed
export const seedMovies = async (req: Request, res: Response): Promise<void> => {
    try {
        // This endpoint used to call Movie.deleteMany({}) behind nothing more
        // than a valid login, so any registered account could empty the entire
        // catalog. It is now additive and idempotent: existing titles are left
        // alone and only missing ones are inserted.
        // Remove the old sample-bucket entries. Their host 403s, so every one
        // of them is a broken play button; anything a user added is untouched.
        const removed = await Movie.deleteMany({
            videoUrl: { $regex: DEAD_SAMPLE_HOST },
        });

        const results = await Promise.all(
            initialMovies.map((movie) =>
                Movie.updateOne(
                    { archiveId: movie.archiveId },
                    { $setOnInsert: movie },
                    { upsert: true }
                )
            )
        );

        const inserted = results.filter((result) => result.upsertedCount > 0).length;

        res.status(201).json({
            success: true,
            message:
                `Seed complete: ${inserted} added, ` +
                `${initialMovies.length - inserted} already present, ` +
                `${removed.deletedCount} dead sample entries removed`,
            count: inserted,
        });
    } catch (error: any) {
        console.error('Seed movies error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/movies/upload-url
export const createUploadUrl = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { uploadUrl, assetId, uploadId } = await createDirectUpload();

        res.status(200).json({
            success: true,
            data: {
                uploadUrl,
                assetId,
                uploadId,
            },
        });
    } catch (error: any) {
        console.error('Create upload URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create upload URL',
            error: error.message,
        });
    }
};

// GET /api/movies/upload/:uploadId
export const getUpload = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { uploadId } = req.params;
        const upload = await getUploadDetails(uploadId);

        res.status(200).json({
            success: true,
            data: {
                id: upload.id,
                status: upload.status,
                assetId: upload.asset_id || '',
            },
        });
    } catch (error: any) {
        console.error('Get upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve upload details',
            error: error.message,
        });
    }
};

// POST /api/movies
export const createMovie = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { title, genre, muxAssetId, muxPlaybackId, duration, rating, image } = req.body;

        // Validate required fields
        if (!title || !genre || !muxPlaybackId) {
            res.status(400).json({
                success: false,
                message: 'Title, genre, and Mux playback ID are required',
            });
            return;
        }

        // Create movie
        const movie = await Movie.create({
            title,
            genre,
            muxAssetId,
            muxPlaybackId,
            videoUrl: `https://stream.mux.com/${muxPlaybackId}.m3u8`,
            duration: duration || 'N/A',
            rating: rating || 'N/A',
            image: image || `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`,
            description: `User uploaded: ${title}`,
            year: new Date().getFullYear(),
            source: 'upload',
        });

        res.status(201).json({
            success: true,
            data: movie,
        });
    } catch (error: any) {
        console.error('Create movie error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create movie',
            error: error.message,
        });
    }
};

// GET /api/movies/asset/:assetId
export const getAsset = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { assetId } = req.params;
        const asset = await getAssetDetails(assetId);

        // Extract playback ID
        const playbackId = asset.playback_ids?.[0]?.id || '';

        // Format duration if available
        let duration = 'N/A';
        if (asset.duration) {
            duration = formatDuration(asset.duration);
        }

        res.status(200).json({
            success: true,
            data: {
                assetId: asset.id,
                playbackId,
                duration,
                status: asset.status,
                thumbnailUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null,
            },
        });
    } catch (error: any) {
        console.error('Get asset error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve asset details',
            error: error.message,
        });
    }
};

/* -------------------------------------------------------------------------- */
/* Public-domain catalog (Internet Archive)                                   */
/* -------------------------------------------------------------------------- */

// GET /api/movies/catalog/search
export const searchCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const query = String(req.query.q ?? '').trim();
        const page = Math.max(1, Number(req.query.page) || 1);

        if (query.length < 2) {
            res.status(400).json({
                success: false,
                message: 'Enter at least two characters to search',
            });
            return;
        }

        const results = await searchPlayable(query, page);

        // Flag titles already in the library so the client can hide "Add".
        const existing = await Movie.find({
            archiveId: { $in: results.map((result) => result.identifier) },
        }).select('archiveId');
        const known = new Set(existing.map((movie) => movie.archiveId));

        res.status(200).json({
            success: true,
            count: results.length,
            data: results
                .filter((result) => !known.has(result.identifier))
                .map((result) => ({
                    // The identifier stands in for _id until the item is imported.
                    _id: result.identifier,
                    title: result.title,
                    image: result.image,
                    duration: result.duration ?? 'N/A',
                    rating: 'N/A',
                    genre: 'Archive',
                    description: result.description,
                    year: result.year,
                    videoUrl: result.videoUrl,
                    source: 'archive',
                })),
        });
    } catch (error: any) {
        console.error('Catalog search error:', error);
        res.status(502).json({
            success: false,
            message: 'The public-domain archive is not responding. Try again shortly.',
        });
    }
};

// POST /api/movies/catalog/import
export const importFromCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const identifier = String(req.body?.identifier ?? '').trim();
        if (!identifier) {
            res.status(400).json({ success: false, message: 'An archive identifier is required' });
            return;
        }

        // Importing the same title twice is a no-op rather than an error, since
        // two people can add the same film at once.
        const existing = await Movie.findOne({ archiveId: identifier });
        if (existing) {
            res.status(200).json({ success: true, data: existing });
            return;
        }

        // Re-resolve server-side rather than trusting a client-supplied URL,
        // which would otherwise let anyone point a library entry anywhere.
        const item = await resolveCached(identifier);
        if (!item?.videoUrl) {
            res.status(404).json({
                success: false,
                message: 'That item has no playable video.',
            });
            return;
        }

        const movie = await Movie.create({
            title: item.title,
            image: item.image,
            duration: item.duration ?? 'N/A',
            rating: 'N/A',
            genre: 'Archive',
            videoUrl: item.videoUrl,
            description: item.description,
            year: item.year,
            source: 'archive',
            archiveId: identifier,
        });

        res.status(201).json({ success: true, data: movie });
    } catch (error: any) {
        console.error('Catalog import error:', error);
        res.status(500).json({
            success: false,
            message: 'Could not add that title.',
            error: error.message,
        });
    }
};
