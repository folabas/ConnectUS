import { Request, Response } from 'express';
import { Movie } from '../models/Movie';

// Initial movie data for seeding
const initialMovies = [
    {
        title: 'Quantum Horizon',
        image: 'https://images.unsplash.com/photo-1655367574486-f63675dd69eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGNpbmVtYXxlbnwxfHx8fDE3NjMzODE5NTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '2h 15m',
        rating: '8.5',
        genre: 'Sci-Fi',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        muxPlaybackId: '36q401a684q7k960015d8000', // Sample Mux Asset
        description: 'A journey through the quantum realm where reality bends and time dissolves.',
        year: 2025
    },
    {
        title: 'Dark Velocity',
        image: 'https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhY3Rpb24lMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '2h 05m',
        rating: '8.2',
        genre: 'Action',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        muxPlaybackId: '36q401a684q7k960015d8000', // Using same sample for demo
        description: 'High-octane action in a futuristic metropolis where speed is the only currency.',
        year: 2025
    },
    {
        title: 'Nebula Dreams',
        image: 'https://images.unsplash.com/photo-1661115111405-981a08256178?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2lmaSUyMG1vdmllJTIwcG9zdGVyfGVufDF8fHx8MTc2MzQyMTgwOXww&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '1h 58m',
        rating: '8.8',
        genre: 'Sci-Fi',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        description: 'An astronaut discovers a sentient nebula that communicates through dreams.',
        year: 2025
    },
    {
        title: 'Silent Echo',
        image: 'https://images.unsplash.com/photo-1655367574486-f63675dd69eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGNpbmVtYXxlbnwxfHx8fDE3NjMzODE5NTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '2h 10m',
        rating: '8.4',
        genre: 'Drama',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        description: 'A powerful drama about a musician who loses their hearing but finds a new voice.',
        year: 2024
    },
    {
        title: 'The Last Circuit',
        image: 'https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhY3Rpb24lMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '2h 22m',
        rating: '8.6',
        genre: 'Thriller',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        description: 'A hacker uncovers a conspiracy that threatens to shut down the global grid.',
        year: 2025
    },
    {
        title: 'Cosmic Laughter',
        image: 'https://images.unsplash.com/photo-1587042285747-583b4d4d73b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21lZHklMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU3NzR8MA&ixlib=rb-4.1.0&q=80&w=1080',
        duration: '1h 45m',
        rating: '7.9',
        genre: 'Comedy',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        description: 'Aliens land on Earth, but they just want to perform stand-up comedy.',
        year: 2024
    }
];

// GET /api/movies
export const getMovies = async (req: Request, res: Response): Promise<void> => {
    try {
        const { genre, search } = req.query;
        let query: any = {};

        if (genre && genre !== 'All') {
            query.genre = genre;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const movies = await Movie.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: movies.length,
            data: movies,
        });
    } catch (error: any) {
        console.error('Get movies error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// GET /api/movies/:id
export const getMovieById = async (req: Request, res: Response): Promise<void> => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            res.status(404).json({
                success: false,
                message: 'Movie not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: movie,
        });
    } catch (error: any) {
        console.error('Get movie error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/movies/seed
export const seedMovies = async (req: Request, res: Response): Promise<void> => {
    try {
        // Clear existing movies
        await Movie.deleteMany({});

        await Movie.insertMany(initialMovies);

        res.status(201).json({
            success: true,
            message: 'Movies seeded successfully',
            count: initialMovies.length,
        });
    } catch (error: any) {
        console.error('Seed movies error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
