import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    getNotifications,
    markAsRead,
    markAllAsRead
} from '../controllers/notificationController';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, markAsRead);
router.patch('/read-all', authMiddleware, markAllAsRead);

export default router;
