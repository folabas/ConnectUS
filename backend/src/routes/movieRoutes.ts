import express from 'express';
import { getMovies, getMovieById, seedMovies, createUploadUrl, createMovie, getAsset, getUpload } from '../controllers/movieController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getMovies);
router.post('/seed', protect, seedMovies); // Protected route

// Protected routes (require authentication)
router.post('/upload-url', protect, createUploadUrl);
router.get('/upload/:uploadId', protect, getUpload);
router.post('/', protect, createMovie);
router.get('/asset/:assetId', protect, getAsset);

// Generic routes (must be last)
router.get('/:id', getMovieById);

export default router;

