import mongoose, { Document, Schema } from 'mongoose';

export interface IRoom extends Document {
    name: string;
    host: mongoose.Types.ObjectId;
    movie: mongoose.Types.ObjectId;
    type: 'public' | 'private';
    code?: string;
    theme: {
        primary: string;
        secondary: string;
        name: string;
    };
    startTime?: string;
    scheduledStartTime?: Date;
    notificationSent?: boolean;
    maxParticipants: number;
    adminEnabled: boolean;
    participants: mongoose.Types.ObjectId[];
    status: 'waiting' | 'scheduled' | 'active' | 'playing' | 'finished';
    createdAt: Date;
    updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
    {
        name: {
            type: String,
            required: [true, 'Room name is required'],
            trim: true,
        },
        host: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        movie: {
            type: Schema.Types.ObjectId,
            ref: 'Movie',
            required: true,
        },
        type: {
            type: String,
            enum: ['public', 'private'],
            default: 'private',
        },
        code: {
            type: String,
            unique: true,
            sparse: true, // Allows null/undefined to be unique (for public rooms)
        },
        theme: {
            primary: { type: String, required: true },
            secondary: { type: String, required: true },
            name: { type: String, required: true },
        },
        startTime: {
            type: String,
        },
        scheduledStartTime: {
            type: Date,
        },
        notificationSent: {
            type: Boolean,
            default: false,
        },
        maxParticipants: {
            type: Number,
            default: 4,
            max: 10,
        },
        adminEnabled: {
            type: Boolean,
            default: true,
        },
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        status: {
            type: String,
            enum: ['waiting', 'scheduled', 'active', 'playing', 'finished'],
            default: 'waiting',
        },
    },
    {
        timestamps: true,
    }
);

export const Room = mongoose.model<IRoom>('Room', roomSchema);
