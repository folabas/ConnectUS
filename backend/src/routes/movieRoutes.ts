import express from 'express';
import {
    getMovies,
    getMovieById,
    seedMovies,
    createUploadUrl,
    createMovie,
    getAsset,
    getUpload,
    searchCatalog,
    importFromCatalog,
} from '../controllers/movieController';
import { protect } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';

const router = express.Router();

// Public
router.get('/', getMovies);

// Public-domain catalog. Declared before '/:id' so the literal path wins.
router.get('/catalog/search', protect, searchCatalog);
router.post('/catalog/import', protect, writeLimiter, importFromCatalog);

// Uploads
router.post('/upload-url', protect, writeLimiter, createUploadUrl);
router.get('/upload/:uploadId', protect, getUpload);
router.get('/asset/:assetId', protect, getAsset);
router.post('/', protect, writeLimiter, createMovie);

// Seeding the starter catalog is additive and idempotent.
router.post('/seed', protect, writeLimiter, seedMovies);

// Parameterised route last.
router.get('/:id', getMovieById);

export default router;
