import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriends,
    getPendingRequests,
    removeFriend,
    inviteToRoom,
    searchUsers
} from '../controllers/friendController';

const router = express.Router();

router.get('/search', authMiddleware, searchUsers);
router.post('/request', authMiddleware, sendFriendRequest);
router.post('/accept/:id', authMiddleware, acceptFriendRequest);
router.post('/reject/:id', authMiddleware, rejectFriendRequest);
router.get('/', authMiddleware, getFriends);
router.get('/pending', authMiddleware, getPendingRequests);
router.delete('/:id', authMiddleware, removeFriend);
router.post('/invite/:friendId', authMiddleware, inviteToRoom);

export default router;
