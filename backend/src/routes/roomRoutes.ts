import express from 'express';
import {
    createRoom,
    getRooms,
    getRoomById,
    joinRoom,
    leaveRoom,
    getRoomMessages,
    getRoomHistory,
    inviteToRoom,
    startRoom,
    requestToJoin,
    approveJoinRequest,
    rejectJoinRequest,
    endRoom,
} from '../controllers/roomController';
import { authMiddleware } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';

const router = express.Router();

router.use(authMiddleware);

router.post('/', writeLimiter, createRoom);
router.get('/', getRooms);
// Declared before '/:id' so the literal path is not treated as a room id.
router.get('/history', getRoomHistory);

// `/join` and `/invite` are declared before `/:id` so they are not swallowed by
// the parameterised route.
router.post('/join', joinRoom);
// Previously mounted at `/invite/:friendId` while the handler read a list of
// emails from the body and ignored the parameter entirely.
router.post('/invite', writeLimiter, inviteToRoom);

router.get('/:id', getRoomById);
router.get('/:id/messages', getRoomMessages);
router.post('/:id/start', startRoom);
router.post('/:id/end', endRoom);
router.post('/:id/leave', leaveRoom);
router.post('/:id/request-join', writeLimiter, requestToJoin);
router.post('/:id/approve-request/:userId', approveJoinRequest);
router.post('/:id/reject-request/:userId', rejectJoinRequest);

export default router;
