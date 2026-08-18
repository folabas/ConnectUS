import mongoose, { Document, Schema } from 'mongoose';

/** Where the stream comes from. See docs/VIDEO_SOURCES.md. */
export type MovieSource = 'archive' | 'blender' | 'upload';

export interface IMovie extends Document {
    title: string;
    image: string;
    duration: string;
    rating: string;
    genre: string;
    videoUrl: string;
    muxPlaybackId?: string;
    muxAssetId?: string;
    /** Internet Archive item identifier, for catalog-sourced titles. */
    archiveId?: string;
    source: MovieSource;
    description?: string;
    year?: number;
    createdAt: Date;
    updatedAt: Date;
}

const movieSchema = new Schema<IMovie>(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        image: {
            type: String,
            required: [true, 'Image URL is required'],
        },
        duration: {
            type: String,
            required: [true, 'Duration is required'],
        },
        rating: {
            type: String,
            required: [true, 'Rating is required'],
        },
        genre: {
            type: String,
            required: [true, 'Genre is required'],
            index: true,
        },
        videoUrl: {
            type: String,
            required: [true, 'Video URL is required'],
        },
        muxPlaybackId: {
            type: String,
        },
        muxAssetId: {
            type: String,
        },
        archiveId: {
            type: String,
            unique: true,
            sparse: true,
        },
        source: {
            // Not every movie has a Mux playback id, which the schema previously
            // assumed. The discriminator lets the player pick the right path.
            type: String,
            enum: ['archive', 'blender', 'upload'],
            default: 'upload',
            index: true,
        },
        description: {
            type: String,
        },
        year: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

// Reuse an already-registered model rather than redefining it: Mongoose
// throws OverwriteModelError on a second registration, which happens
// whenever the module registry is reset (hot reload, test isolation).
export const Movie =
    (mongoose.models.Movie as mongoose.Model<IMovie>) ||
    mongoose.model<IMovie>('Movie', movieSchema);
