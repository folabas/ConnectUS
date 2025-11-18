import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Video, User, Settings as SettingsIcon, Users } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, Screen } from '../App';

interface MovieLibraryProps {
  onNavigate: (screen: Screen) => void;
  onMovieSelect: (movie: Movie) => void;
}

const categories = ['All', 'Action', 'Drama', 'Sci-Fi', 'Comedy', 'Thriller'];

const movies: Movie[] = [
  {
    id: 1,
    title: 'Quantum Horizon',
    image: 'https://images.unsplash.com/photo-1655367574486-f63675dd69eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGNpbmVtYXxlbnwxfHx8fDE3NjMzODE5NTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2h 15m',
    rating: '8.5',
    genre: 'Sci-Fi',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  {
    id: 2,
    title: 'Dark Velocity',
    image: 'https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhY3Rpb24lMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2h 05m',
    rating: '8.2',
    genre: 'Action',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
  },
  {
    id: 3,
    title: 'Nebula Dreams',
    image: 'https://images.unsplash.com/photo-1661115111405-981a08256178?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2lmaSUyMG1vdmllJTIwcG9zdGVyfGVufDF8fHx8MTc2MzQyMTgwOXww&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '1h 58m',
    rating: '8.8',
    genre: 'Sci-Fi',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    id: 4,
    title: 'Silent Echo',
    image: 'https://images.unsplash.com/photo-1655367574486-f63675dd69eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGNpbmVtYXxlbnwxfHx8fDE3NjMzODE5NTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2h 10m',
    rating: '8.4',
    genre: 'Drama',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
  },
  {
    id: 5,
    title: 'The Last Circuit',
    image: 'https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhY3Rpb24lMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2h 22m',
    rating: '8.6',
    genre: 'Thriller',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
  },
  {
    id: 6,
    title: 'Cosmic Laughter',
    image: 'https://images.unsplash.com/photo-1587042285747-583b4d4d73b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21lZHklMjBtb3ZpZSUyMHBvc3RlcnxlbnwxfHx8fDE3NjMzNDU3NzR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '1h 45m',
    rating: '7.9',
    genre: 'Comedy',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
  }
];

export function MovieLibrary({ onNavigate, onMovieSelect }: MovieLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = movies.filter(movie => {
    const matchesCategory = selectedCategory === 'All' || movie.genre === selectedCategory;
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
                className={`px-6 py-3 rounded-full whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-[#695CFF] text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </motion.div>

          {/* Movie Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredMovies.map((movie, index) => (
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
        </div>
      </div>
    </div>
  );
}