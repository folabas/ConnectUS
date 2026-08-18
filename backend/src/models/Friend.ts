import mongoose, { Document, Schema } from 'mongoose';

export interface IFriend extends Document {
    requester: mongoose.Types.ObjectId;
    recipient: mongoose.Types.ObjectId;
    status: 'pending' | 'accepted' | 'blocked';
    createdAt: Date;
    updatedAt: Date;
}

const friendSchema = new Schema<IFriend>(
    {
        requester: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipient: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'blocked'],
            default: 'pending',
        },
    },
    {
        timestamps: true,
    }
);

// Compound index to prevent duplicate friend requests
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Reuse an already-registered model rather than redefining it: Mongoose
// throws OverwriteModelError on a second registration, which happens
// whenever the module registry is reset (hot reload, test isolation).
export const Friend =
    (mongoose.models.Friend as mongoose.Model<IFriend>) ||
    mongoose.model<IFriend>('Friend', friendSchema);
