import mongoose, { Document, Schema } from 'mongoose';

/**
 * Persisted room chat.
 *
 * The PRD requires message history, but chat was previously a socket broadcast
 * with no storage: refresh the page and the conversation was gone, and someone
 * who joined late saw nothing that had been said.
 */
export interface IMessage extends Document {
    room: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    /** Denormalised so history renders without an extra populate per message. */
    userName: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}

export const MAX_CHAT_LENGTH = 500;

const messageSchema = new Schema<IMessage>(
    {
        room: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        userName: {
            type: String,
            required: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_CHAT_LENGTH,
        },
    },
    { timestamps: true }
);

// History is always read newest-last for one room.
messageSchema.index({ room: 1, createdAt: 1 });

// Reuse an already-registered model rather than redefining it: Mongoose
// throws OverwriteModelError on a second registration, which happens
// whenever the module registry is reset (hot reload, test isolation).
export const Message =
    (mongoose.models.Message as mongoose.Model<IMessage>) ||
    mongoose.model<IMessage>('Message', messageSchema);
