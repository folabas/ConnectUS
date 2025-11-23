import express from 'express';
import { createRoom, getRooms, getRoomById, joinRoom, inviteToRoom } from '../controllers/roomController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Protected routes
router.post('/', authMiddleware, createRoom);
router.get('/', authMiddleware, getRooms);
router.get('/:id', authMiddleware, getRoomById);
router.post('/join', authMiddleware, joinRoom);
router.post('/invite', authMiddleware, inviteToRoom);

export default router;
