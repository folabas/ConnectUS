import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Lock, Globe, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, RoomTheme, Screen } from '../App';
import { movieApi, roomApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface CreateRoomProps {
  onNavigate: (screen: Screen) => void;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
  roomTheme: RoomTheme;
  onThemeChange: (theme: RoomTheme) => void;
}

const themes: RoomTheme[] = [
  { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' },
  { primary: '#FF6B6B', secondary: '#FF8E8E', name: 'Sunset Red' },
  { primary: '#4ECDC4', secondary: '#6FE2DA', name: 'Ocean Blue' },
  { primary: '#FFD93D', secondary: '#FFE566', name: 'Golden Hour' },
  { primary: '#A8E6CF', secondary: '#C8F0DD', name: 'Mint Fresh' }
];

export function CreateRoom({ onNavigate, selectedMovie, onMovieSelect, roomTheme, onThemeChange }: CreateRoomProps) {
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentMovie, setCurrentMovie] = useState<Movie | null>(selectedMovie);

  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'private' | 'public'>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('roomType') : null;
    return v === 'public' ? 'public' : 'private';
  });
  const [adminEnabled, setAdminEnabled] = useState<boolean>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('adminEnabled') : null;
    return v ? v === 'true' : true;
  });
  const [startTime, setStartTime] = useState<string>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('startTime') : null;
    return v || '';
  });
  const [maxParticipants, setMaxParticipants] = useState<number>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('maxParticipants') : null;
    const n = v ? parseInt(v, 10) : 4;
    return Math.min(4, Math.max(1, isNaN(n) ? 4 : n));
  });

  // Fetch all movies for the carousel
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const response = await movieApi.getAll();
        if (response.success && response.data) {
          const mappedMovies = response.data.map((m: any) => ({
            id: m._id,
            title: m.title,
            image: m.image,
            duration: m.duration,
            rating: m.rating,
            genre: m.genre,
            videoUrl: m.videoUrl
          }));
          setAllMovies(mappedMovies);

          // If no movie selected, default to first one
          if (!currentMovie && mappedMovies.length > 0) {
            setCurrentMovie(mappedMovies[0]);
            onMovieSelect(mappedMovies[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching movies:', error);
        toast.error('Failed to load movies');
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  // Update current movie if selectedMovie changes from props
  useEffect(() => {
    if (selectedMovie) {
      setCurrentMovie(selectedMovie);
    }
  }, [selectedMovie]);

  const currentIndex = currentMovie && allMovies.length > 0
    ? allMovies.findIndex(m => m.id === currentMovie.id)
    : 0;

  const handlePrevMovie = () => {
    if (allMovies.length === 0) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allMovies.length - 1;
    const newMovie = allMovies[prevIndex];
    setCurrentMovie(newMovie);
    onMovieSelect(newMovie);
  };

  const handleNextMovie = () => {
    if (allMovies.length === 0) return;
    const nextIndex = currentIndex < allMovies.length - 1 ? currentIndex + 1 : 0;
    const newMovie = allMovies[nextIndex];
    setCurrentMovie(newMovie);
    onMovieSelect(newMovie);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    if (!currentMovie) {
      toast.error('Please select a movie');
      return;
    }

    const token = tokenStorage.get();
    if (!token) {
      toast.error('Please log in to create a room');
      onNavigate('auth');
      return;
    }

    setCreating(true);
    try {
      const response = await roomApi.create(token, {
        name: roomName,
        movieId: currentMovie.id,
        type: roomType,
        theme: roomTheme,
        startTime: startTime || undefined,
        maxParticipants,
        adminEnabled
      });

      if (response.success && response.data) {
        toast.success('Room created successfully!');
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentRoomId', response.data._id);
        }
        onNavigate('waiting-room');
      } else {
        toast.error(response.message || 'Failed to create room');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#695CFF]" />
      </div>
    );
  }

  if (!currentMovie) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">No movies available</p>
          <Button onClick={() => onNavigate('library')}>Back to Library</Button>
        </div>
      </div>
    );
  }

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
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Privacy</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setRoomType('private');
                      if (typeof window !== 'undefined') localStorage.setItem('roomType', 'private');
                    }}
                    className={`h-14 rounded-2xl flex items-center justify-center gap-2 transition-all ${roomType === 'private' ? 'text-white' : 'hover:bg-white/10 text-white'
                      }`}
                    style={{
                      background:
                        roomType === 'private'
                          ? `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                          : 'rgba(255,255,255,0.05)',
                      borderColor:
                        roomType === 'private' ? roomTheme.primary : 'rgba(255,255,255,0.1)',
                      borderWidth: 1,
                      borderStyle: 'solid'
                    }}
                  >
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                  <button
                    onClick={() => {
                      setRoomType('public');
                      if (typeof window !== 'undefined') localStorage.setItem('roomType', 'public');
                    }}
                    className={`h-14 rounded-2xl flex items-center justify-center gap-2 transition-all ${roomType === 'public' ? 'text-white' : 'hover:bg-white/10 text-white'
                      }`}
                    style={{
                      background:
                        roomType === 'public'
                          ? `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                          : 'rgba(255,255,255,0.05)',
                      borderColor:
                        roomType === 'public' ? roomTheme.primary : 'rgba(255,255,255,0.1)',
                      borderWidth: 1,
                      borderStyle: 'solid'
                    }}
                  >
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
                      className={`w-12 h-12 rounded-full transition-all ${roomTheme.name === theme.name
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
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      if (typeof window !== 'undefined') localStorage.setItem('startTime', e.target.value);
                    }}
                    className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                  />
                  <p className="mt-2 text-xs text-white/40">Time uses your local timezone</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Max Participants</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={maxParticipants}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty input while typing
                      if (val === '') {
                        setMaxParticipants(1);
                        return;
                      }
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) {
                        const clamped = Math.min(4, Math.max(1, n));
                        setMaxParticipants(clamped);
                        if (typeof window !== 'undefined') localStorage.setItem('maxParticipants', String(clamped));
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      const val = e.target.value;
                      if (val === '' || isNaN(parseInt(val, 10))) {
                        setMaxParticipants(2);
                        if (typeof window !== 'undefined') localStorage.setItem('maxParticipants', '2');
                      }
                    }}
                    className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                  />
                  <p className="mt-2 text-xs text-white/40">Limit enforced to 4 participants</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-2 block">Admin Controls</label>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-sm text-white/80">Enable admin-only room management</span>
                  <input
                    type="checkbox"
                    checked={adminEnabled}
                    onChange={(e) => {
                      setAdminEnabled(e.target.checked);
                      if (typeof window !== 'undefined') localStorage.setItem('adminEnabled', String(e.target.checked));
                    }}
                    className="w-5 h-5"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateRoom}
              disabled={creating}
              className="w-full h-14 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
              }}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Room...
                </>
              ) : (
                'Create Room'
              )}
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
