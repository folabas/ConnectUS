import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    type: 'friend_request' | 'friend_accepted' | 'room_invite';
    data: {
        fromUserId?: mongoose.Types.ObjectId;
        fromUserName?: string;
        roomId?: string;
        roomName?: string;
        movieTitle?: string;
        friendshipId?: string;
    };
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['friend_request', 'friend_accepted', 'room_invite'],
            required: true,
        },
        data: {
            type: Schema.Types.Mixed,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying of unread notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
