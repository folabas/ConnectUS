import express from 'express';
import { getMovies, getMovieById, seedMovies } from '../controllers/movieController';

const router = express.Router();

// Public routes
router.get('/', getMovies);
router.get('/:id', getMovieById);
router.post('/seed', seedMovies); // In production, this should be protected or removed

export default router;
