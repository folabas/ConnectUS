import mongoose, { Document } from 'mongoose';
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
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any, IUser>;
//# sourceMappingURL=User.d.ts.map