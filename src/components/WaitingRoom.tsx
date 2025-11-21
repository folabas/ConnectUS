import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, Users, Play, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, RoomTheme, Screen } from '../App';

interface WaitingRoomProps {
  onNavigate: (screen: Screen) => void;
  selectedMovie: Movie | null;
  roomTheme: RoomTheme;
}

const participants = [
  { id: 1, name: 'Sarah Chen', avatar: 'SC', online: true },
  { id: 2, name: 'Alex Morgan', avatar: 'AM', online: true },
  { id: 3, name: 'Jordan Lee', avatar: 'JL', online: true },
  { id: 4, name: 'Taylor Kim', avatar: 'TK', online: false }
];

export function WaitingRoom({ onNavigate, selectedMovie, roomTheme }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [roomType] = useState<'private' | 'public'>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('roomType') : null;
    return v === 'public' ? 'public' : 'private';
  });
  const [adminEnabled] = useState<boolean>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('adminEnabled') : null;
    return v ? v === 'true' : true;
  });
  const [maxParticipants] = useState<number>(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('maxParticipants') : null;
    const n = v ? parseInt(v, 10) : 4;
    return Math.min(4, Math.max(1, isNaN(n) ? 4 : n));
  });

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const defaultMovie = {
    title: 'Quantum Horizon',
    image: 'https://images.unsplash.com/photo-1655367574486-f63675dd69eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGNpbmVtYXxlbnwxfHx8fDE3NjMzODE5NTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2h 15m',
    rating: '8.5',
    genre: 'Sci-Fi'
  };

  const movie = selectedMovie || defaultMovie;

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Header */}
      <nav className="px-8 py-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Room
          </button>
          
          <div className="flex items-center gap-3">
            <div 
              className="px-4 py-2 rounded-full border flex items-center gap-2"
              style={{
                backgroundColor: `${roomTheme.primary}20`,
                borderColor: `${roomTheme.primary}40`
              }}
            >
              <Users className="w-4 h-4" style={{ color: roomTheme.primary }} />
              <span className="text-sm">{participants.filter(p => p.online).length}/{maxParticipants}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12 text-center"
          >
            <h1 className="text-4xl mb-3 tracking-tight">Waiting Room</h1>
            <p className="text-white/60 text-lg">{roomType === 'public' ? 'Public room – anyone can join' : 'Invite friends to join your session'}</p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left - Participants */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              {roomType === 'private' ? (
                <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                  <label className="text-sm text-white/60 mb-3 block">Room Invite Link</label>
                  <div className="flex gap-3">
                    <div className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60">
                      connectus.app/room/abc123xyz
                    </div>
                    <Button
                      onClick={handleCopy}
                      className="px-6 text-white rounded-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                      }}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-white/80">Public room – open access</p>
                    <div className="px-3 py-1 rounded-full text-xs border" style={{ borderColor: `${roomTheme.primary}60` }}>No invite needed</div>
                  </div>
                </div>
              )}

              {/* Participants Grid */}
              <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                <h3 className="text-lg mb-4">Participants</h3>
                <div className="grid grid-cols-2 gap-4">
                  {participants.map((participant, index) => (
                    <motion.div
                      key={participant.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 + index * 0.05 }}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                          {participant.avatar}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0D0D0F] ${
                          participant.online ? 'bg-green-500' : 'bg-white/20'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{participant.name}</p>
                        <p className="text-xs text-white/40">
                          {participant.online ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMicOn(!micOn)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      micOn
                        ? 'bg-white/10 hover:bg-white/20'
                        : 'bg-red-500/20 hover:bg-red-500/30'
                    }`}
                  >
                    {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setVideoOn(!videoOn)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${videoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 hover:bg-red-500/30'}`}
                  >
                    {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                </div>

                <Button
                  onClick={() => onNavigate('watch')}
                  disabled={!adminEnabled}
                  className="text-white rounded-full px-8 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                  }}
                >
                  <Play className="w-4 h-4" />
                  {adminEnabled ? 'Start Session' : 'Admin disabled'}
                </Button>
              </div>
            </motion.div>

            {/* Right - Movie Preview */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1"
            >
              <div className="sticky top-8 p-6 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10">
                <div className="mb-4">
                  <p className="text-sm text-white/60 mb-2">Now Playing</p>
                  <h2 className="text-xl tracking-tight">{movie.title}</h2>
                </div>

                <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-white/5">
                  <ImageWithFallback
                    src={movie.image}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Duration</span>
                    <span>{movie.duration}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Rating</span>
                    <span>★ {movie.rating}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Genre</span>
                    <span>{movie.genre}</span>
                  </div>
                  {participants.filter(p => p.online).length >= maxParticipants && (
                    <div className="mt-3 text-xs text-red-400">Room is at capacity ({maxParticipants})</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}