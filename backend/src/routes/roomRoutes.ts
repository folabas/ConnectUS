import express from 'express';
import { createRoom, getRooms, getRoomById, joinRoom, inviteToRoom, startRoom, requestToJoin, approveJoinRequest, rejectJoinRequest } from '../controllers/roomController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Protected routes
router.post('/', authMiddleware, createRoom);
router.get('/', authMiddleware, getRooms);
router.get('/:id', authMiddleware, getRoomById);
router.post('/join', authMiddleware, joinRoom);
router.post('/:id/start', authMiddleware, startRoom);
router.post('/invite/:friendId', authMiddleware, inviteToRoom);
router.post('/:id/request-join', authMiddleware, requestToJoin);
router.post('/:id/approve-request/:userId', authMiddleware, approveJoinRequest);
router.post('/:id/reject-request/:userId', authMiddleware, rejectJoinRequest);

export default router;
