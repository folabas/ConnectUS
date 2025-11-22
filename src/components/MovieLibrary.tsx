import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Video, User, Settings as SettingsIcon, Users, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, Screen } from '../App';
import { movieApi } from '@/services/api';
import { toast } from 'sonner';

interface MovieLibraryProps {
  onNavigate: (screen: Screen) => void;
  onMovieSelect: (movie: Movie) => void;
}

const categories = ['All', 'Action', 'Drama', 'Sci-Fi', 'Comedy', 'Thriller'];

export function MovieLibrary({ onNavigate, onMovieSelect }: MovieLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const response = await movieApi.getAll({
          genre: selectedCategory,
          search: searchQuery
        });

        if (response.success && response.data) {
          // Transform backend data to match frontend Movie interface if needed
          // Currently they match closely enough, but we need to ensure ID is handled correctly
          const mappedMovies = response.data.map((m: any) => ({
            id: m._id, // Use MongoDB _id
            title: m.title,
            image: m.image,
            duration: m.duration,
            rating: m.rating,
            genre: m.genre,
            videoUrl: m.videoUrl
          }));
          setMovies(mappedMovies);
        }
      } catch (error) {
        console.error('Error fetching movies:', error);
        toast.error('Failed to load movies');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchMovies();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedCategory, searchQuery]);

  const handleMovieClick = (movie: Movie) => {
    onMovieSelect(movie);
    onNavigate('create-room');
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Navigation */}
      <nav className="px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <span className="text-xl tracking-tight">ConnectUs</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => onNavigate('join-room')}
            variant="outline"
            className="border-white/10 hover:bg-white/5 rounded-full gap-2 text-white"
          >
            <Users className="w-4 h-4" />
            Join Room
          </Button>

          <Button
            onClick={() => onNavigate('create-room')}
            className="bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-full gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Room
          </Button>

          <button
            onClick={() => onNavigate('profile')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <User className="w-5 h-5" />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="px-8 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12"
          >
            <h1 className="text-5xl mb-3 tracking-tight">Discover Movies</h1>
            <p className="text-white/60 text-xl">Choose a movie to watch together</p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative mb-8"
          >
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
            />
          </motion.div>

          {/* Category Tabs */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 mb-12 overflow-x-auto pb-2"
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-full whitespace-nowrap transition-all ${selectedCategory === category
                  ? 'bg-[#695CFF] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {category}
              </button>
            ))}
          </motion.div>

          {/* Movie Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[#695CFF]" />
            </div>
          ) : movies.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {movies.map((movie, index) => (
                <motion.div
                  key={movie.id}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleMovieClick(movie)}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-4 bg-white/5">
                    <ImageWithFallback
                      src={movie.image}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-2 text-sm text-white/80 mb-2">
                          <span>{movie.duration}</span>
                          <span>•</span>
                          <span>★ {movie.rating}</span>
                        </div>
                        <Button className="w-full bg-white text-black hover:bg-white/90 rounded-full">
                          Select Movie
                        </Button>
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 text-sm">
                      ★ {movie.rating}
                    </div>
                  </div>

                  <h3 className="tracking-tight group-hover:text-[#695CFF] transition-colors">
                    {movie.title}
                  </h3>
                  <p className="text-sm text-white/50">{movie.duration}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-white/40">
              <p className="text-xl">No movies found</p>
              <p className="text-sm mt-2">Try adjusting your search or category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}