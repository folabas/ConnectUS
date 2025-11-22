import { Response } from 'express';
import mongoose from 'mongoose';
import { Friend } from '../models/Friend';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { AuthRequest } from '../middleware/auth';
import { emailService } from '../services/emailService';

// POST /api/friends/request
export const sendFriendRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { recipientId } = req.body;
        const requesterId = req.user?.userId;

        if (!requesterId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        if (requesterId === recipientId) {
            res.status(400).json({ success: false, message: 'Cannot send friend request to yourself' });
            return;
        }

        // Check if recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // Check if friendship already exists
        const existing = await Friend.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId }
            ]
        });

        if (existing) {
            res.status(400).json({ success: false, message: 'Friend request already exists' });
            return;
        }

        // Create friend request
        const friendship = await Friend.create({
            requester: requesterId,
            recipient: recipientId,
            status: 'pending'
        });

        // Create notification
        const requester = await User.findById(requesterId);
        await Notification.create({
            userId: new mongoose.Types.ObjectId(recipientId),
            type: 'friend_request',
            data: {
                fromUserId: new mongoose.Types.ObjectId(requesterId),
                fromUserName: requester?.fullName || requester?.email || 'Someone',
                friendshipId: friendship._id.toString()
            }
        });

        res.status(201).json({ success: true, data: friendship });
    } catch (error: any) {
        console.error('Send friend request error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/friends/accept/:id
export const acceptFriendRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const friendship = await Friend.findById(id);
        if (!friendship) {
            res.status(404).json({ success: false, message: 'Friend request not found' });
            return;
        }

        if (friendship.recipient.toString() !== userId) {
            res.status(403).json({ success: false, message: 'Not authorized' });
            return;
        }

        friendship.status = 'accepted';
        await friendship.save();

        // Notify requester
        const accepter = await User.findById(userId);
        await Notification.create({
            userId: friendship.requester,
            type: 'friend_accepted',
            data: {
                fromUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
                fromUserName: accepter?.fullName || accepter?.email || 'Someone'
            }
        });

        res.status(200).json({ success: true, data: friendship });
    } catch (error: any) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/friends/reject/:id
export const rejectFriendRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const friendship = await Friend.findById(id);
        if (!friendship) {
            res.status(404).json({ success: false, message: 'Friend request not found' });
            return;
        }

        if (friendship.recipient.toString() !== userId) {
            res.status(403).json({ success: false, message: 'Not authorized' });
            return;
        }

        await Friend.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Friend request rejected' });
    } catch (error: any) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/friends
export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        const friendships = await Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        })
            .populate('requester', 'fullName email avatarUrl onlineStatus lastSeen')
            .populate('recipient', 'fullName email avatarUrl onlineStatus lastSeen');

        // Map to friend objects
        const friends = friendships.map(f => {
            const friend = f.requester._id.toString() === userId ? f.recipient : f.requester;
            return {
                friendshipId: f._id,
                ...(friend as any).toObject()
            };
        });

        res.status(200).json({ success: true, data: friends });
    } catch (error: any) {
        console.error('Get friends error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/friends/pending
export const getPendingRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        const requests = await Friend.find({
            recipient: userId,
            status: 'pending'
        }).populate('requester', 'fullName email avatarUrl');

        res.status(200).json({ success: true, data: requests });
    } catch (error: any) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// DELETE /api/friends/:id
export const removeFriend = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const friendship = await Friend.findById(id);
        if (!friendship) {
            res.status(404).json({ success: false, message: 'Friendship not found' });
            return;
        }

        if (friendship.requester.toString() !== userId && friendship.recipient.toString() !== userId) {
            res.status(403).json({ success: false, message: 'Not authorized' });
            return;
        }

        await Friend.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Friend removed' });
    } catch (error: any) {
        console.error('Remove friend error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/friends/invite/:friendId
export const inviteToRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { friendId } = req.params;
        const { roomId } = req.body;
        const userId = req.user?.userId;

        // Verify friendship
        const friendship = await Friend.findOne({
            $or: [
                { requester: userId, recipient: friendId },
                { requester: friendId, recipient: userId }
            ],
            status: 'accepted'
        });

        if (!friendship) {
            res.status(403).json({ success: false, message: 'Not friends with this user' });
            return;
        }

        // Get room and friend details
        const room = await Room.findById(roomId).populate('movie');
        const inviter = await User.findById(userId);
        const friend = await User.findById(friendId);

        if (!room || !inviter || !friend) {
            res.status(404).json({ success: false, message: 'Room or user not found' });
            return;
        }

        // Create notification
        await Notification.create({
            userId: new mongoose.Types.ObjectId(friendId),
            type: 'room_invite',
            data: {
                fromUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
                fromUserName: inviter.fullName || inviter.email,
                roomId: room._id.toString(),
                roomName: room.name,
                movieTitle: (room.movie as any)?.title || 'a movie'
            }
        });

        // Send email
        await emailService.sendRoomInvite({
            toEmail: friend.email,
            toName: friend.fullName || friend.email,
            fromName: inviter.fullName || inviter.email,
            movieTitle: (room.movie as any)?.title || 'a movie',
            roomCode: room.code,
            roomId: room._id.toString()
        });

        res.status(200).json({ success: true, message: 'Invite sent' });
    } catch (error: any) {
        console.error('Invite to room error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/friends/search
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { query } = req.query;
        const userId = req.user?.userId;

        if (!query || typeof query !== 'string') {
            res.status(400).json({ success: false, message: 'Query parameter is required' });
            return;
        }

        // Find users matching name or email, excluding current user
        const users = await User.find({
            $and: [
                { _id: { $ne: userId } },
                {
                    $or: [
                        { email: { $regex: query, $options: 'i' } },
                        { fullName: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        })
            .select('fullName email avatarUrl')
            .limit(10);

        // Check friendship status for each user
        const results = await Promise.all(users.map(async (user) => {
            const friendship = await Friend.findOne({
                $or: [
                    { requester: userId, recipient: user._id },
                    { requester: user._id, recipient: userId }
                ]
            });

            let status = 'none';
            if (friendship) {
                if (friendship.status === 'accepted') {
                    status = 'friend';
                } else if (friendship.status === 'pending') {
                    status = friendship.requester.toString() === userId ? 'sent' : 'received';
                }
            }

            return {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatarUrl: user.avatarUrl,
                status
            };
        }));

        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        console.error('Search users error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
