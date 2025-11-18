import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Lock, Globe, Calendar, Clock, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, RoomTheme, Screen } from '../App';

interface CreateRoomProps {
  onNavigate: (screen: Screen) => void;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
  roomTheme: RoomTheme;
  onThemeChange: (theme: RoomTheme) => void;
}

const allMovies: Movie[] = [
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

const themes: RoomTheme[] = [
  { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' },
  { primary: '#FF6B6B', secondary: '#FF8E8E', name: 'Sunset Red' },
  { primary: '#4ECDC4', secondary: '#6FE2DA', name: 'Ocean Blue' },
  { primary: '#FFD93D', secondary: '#FFE566', name: 'Golden Hour' },
  { primary: '#A8E6CF', secondary: '#C8F0DD', name: 'Mint Fresh' }
];

export function CreateRoom({ onNavigate, selectedMovie, onMovieSelect, roomTheme, onThemeChange }: CreateRoomProps) {
  const [currentMovie, setCurrentMovie] = useState(selectedMovie || allMovies[0]);
  const currentIndex = allMovies.findIndex(m => m.id === currentMovie.id);

  const handlePrevMovie = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allMovies.length - 1;
    const newMovie = allMovies[prevIndex];
    setCurrentMovie(newMovie);
    onMovieSelect(newMovie);
  };

  const handleNextMovie = () => {
    const nextIndex = currentIndex < allMovies.length - 1 ? currentIndex + 1 : 0;
    const newMovie = allMovies[nextIndex];
    setCurrentMovie(newMovie);
    onMovieSelect(newMovie);
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        {/* Back Button */}
        <motion.button
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={() => onNavigate('library')}
          className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </motion.button>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Side - Form */}
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl mb-3 tracking-tight">Create Room</h1>
              <p className="text-white/60 text-lg">Set up your movie watching session</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block">Room Name</label>
                <Input
                  type="text"
                  placeholder="Friday Movie Night"
                  className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Privacy</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="h-14 rounded-2xl bg-[#695CFF] border border-[#695CFF] flex items-center justify-center gap-2 transition-all">
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                  <button className="h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center gap-2 transition-all">
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Room Theme</label>
                <div className="flex gap-2">
                  {themes.map((theme) => (
                    <motion.button
                      key={theme.name}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onThemeChange(theme)}
                      className={`w-12 h-12 rounded-full transition-all ${
                        roomTheme.name === theme.name
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0D0D0F]'
                          : ''
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
                      }}
                      title={theme.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Start Time (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <Input
                      type="date"
                      className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:border-[#695CFF] focus:bg-white/10"
                    />
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <Input
                      type="time"
                      className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:border-[#695CFF] focus:bg-white/10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Max Participants</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="number"
                    placeholder="8"
                    className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={() => onNavigate('waiting-room')}
              className="w-full h-14 text-white rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
              }}
            >
              Create Room
            </Button>
          </motion.div>

          {/* Right Side - Movie Carousel */}
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="relative">
              {/* Background Cards */}
              {currentIndex > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute left-0 top-12 w-48 h-64 rounded-2xl overflow-hidden blur-sm opacity-30 -z-10"
                >
                  <ImageWithFallback
                    src={allMovies[currentIndex - 1].image}
                    alt="Previous"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}

              {currentIndex < allMovies.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute right-0 top-12 w-48 h-64 rounded-2xl overflow-hidden blur-sm opacity-30 -z-10"
                >
                  <ImageWithFallback
                    src={allMovies[currentIndex + 1].image}
                    alt="Next"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}

              {/* Main Card */}
              <motion.div
                key={currentMovie.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10"
              >
                <div className="mb-6">
                  <p className="text-sm text-white/60 mb-2">Selected Movie</p>
                  <h2 className="text-2xl tracking-tight">{currentMovie.title}</h2>
                </div>

                <div className="relative aspect-video rounded-2xl overflow-hidden mb-6 bg-white/5">
                  <ImageWithFallback
                    src={currentMovie.image}
                    alt={currentMovie.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between py-3 border-t border-white/10">
                    <span className="text-white/60">Duration</span>
                    <span>{currentMovie.duration}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-white/10">
                    <span className="text-white/60">Rating</span>
                    <span>★ {currentMovie.rating}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-white/10">
                    <span className="text-white/60">Genre</span>
                    <span>{currentMovie.genre}</span>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    onClick={handlePrevMovie}
                    variant="outline"
                    className="flex-1 border-white/10 hover:bg-white/5 rounded-2xl text-white"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    onClick={handleNextMovie}
                    variant="outline"
                    className="flex-1 border-white/10 hover:bg-white/5 rounded-2xl text-white"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>

              {/* Ambient Glow */}
              <div 
                className="absolute -inset-4 blur-3xl -z-20 opacity-50"
                style={{
                  background: `radial-gradient(circle, ${roomTheme.primary}40 0%, transparent 70%)`
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
