import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    email: string;
    password: string;
    fullName?: string;
    avatarUrl?: string;
    sessionsHosted: number;
    moviesWatched: number;
    hoursWatched: number;
    watchHistory: {
        movieId: mongoose.Types.ObjectId;
        title: string;
        date: Date;
        rating: number;
    }[];
    onlineStatus: 'online' | 'offline';
    lastSeen: Date;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't return password by default
        },
        fullName: {
            type: String,
            trim: true,
        },
        avatarUrl: {
            type: String,
            default: null,
        },
        sessionsHosted: {
            type: Number,
            default: 0
        },
        moviesWatched: {
            type: Number,
            default: 0
        },
        hoursWatched: {
            type: Number,
            default: 0
        },
        watchHistory: [{
            movieId: { type: Schema.Types.ObjectId, ref: 'Movie' },
            title: String,
            date: { type: Date, default: Date.now },
            rating: { type: Number, default: 0 }
        }],
        onlineStatus: {
            type: String,
            enum: ['online', 'offline'],
            default: 'offline'
        },
        lastSeen: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
