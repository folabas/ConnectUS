import { Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ userId, read: false });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount
        });
    } catch (error: any) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const notification = await Notification.findOne({ _id: id, userId });
        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }

        notification.read = true;
        await notification.save();

        res.status(200).json({ success: true, data: notification });
    } catch (error: any) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// PATCH /api/notifications/read-all
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
