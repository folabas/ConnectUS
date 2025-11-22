import mongoose, { Document, Schema } from 'mongoose';

export interface IMovie extends Document {
    title: string;
    image: string;
    duration: string;
    rating: string;
    genre: string;
    videoUrl: string;
    muxPlaybackId?: string;
    muxAssetId?: string;
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

export const Movie = mongoose.model<IMovie>('Movie', movieSchema);
