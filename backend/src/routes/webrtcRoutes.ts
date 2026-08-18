import express from 'express';
import { getIceServers } from '../controllers/webrtcController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Authenticated: TURN credentials should not be handed to anonymous callers.
router.get('/ice', authMiddleware, getIceServers);

export default router;
