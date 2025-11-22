import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LogIn, Copy, Loader2, Users, Play, Lock, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Screen } from '../App';
import { roomApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface JoinRoomProps {
  onNavigate: (screen: Screen) => void;
}

interface PublicRoom {
  _id: string;
  name: string;
  movie: {
    title: string;
    image: string;
    duration: string;
  };
  host: {
    fullName: string;
    avatarUrl: string;
  };
  participants: any[];
  maxParticipants: number;
}

export function JoinRoom({ onNavigate }: JoinRoomProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (activeTab === 'public') {
      fetchPublicRooms();
    }
  }, [activeTab]);

  const fetchPublicRooms = async () => {
    setLoadingRooms(true);
    try {
      const token = tokenStorage.get();
      if (!token) return;
      const response = await roomApi.getAll(token);
      if (response.success && response.data) {
        setPublicRooms(response.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load public rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleJoinRoom = async (roomId?: string, code?: string) => {
    const token = tokenStorage.get();
    if (!token) {
      toast.error('Please log in to join a room');
      onNavigate('auth');
      return;
    }

    if (!roomId && !code) {
      toast.error('Please enter a room code');
      return;
    }

    setJoining(true);
    try {
      const response = await roomApi.join(token, {
        roomId,
        code
      });

      if (response.success && response.data) {
        toast.success('Joined room successfully!');
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentRoomId', response.data._id);
        }
        onNavigate('waiting-room');
      } else {
        toast.error(response.message || 'Failed to join room');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error('Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Join a Session</h1>
          <p className="text-white/60 text-lg">
            Browse public watch parties or enter a code to join a private room
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-12">
          <div className="bg-white/5 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab('public')}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'public'
                  ? 'bg-[#695CFF] text-white shadow-lg shadow-[#695CFF]/25'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Public Rooms
              </div>
            </button>
            <button
              onClick={() => setActiveTab('private')}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'private'
                  ? 'bg-[#695CFF] text-white shadow-lg shadow-[#695CFF]/25'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Private Code
              </div>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'public' ? (
            <motion.div
              key="public"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {loadingRooms ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#695CFF]" />
                </div>
              ) : publicRooms.length === 0 ? (
                <div className="col-span-full text-center py-12 text-white/40">
                  No active public rooms found. Why not create one?
                </div>
              ) : (
                publicRooms.map((room) => (
                  <div
                    key={room._id}
                    className="group relative bg-white/5 rounded-3xl overflow-hidden border border-white/10 hover:border-[#695CFF]/50 transition-all hover:shadow-2xl hover:shadow-[#695CFF]/10"
                  >
                    {/* Movie Backdrop */}
                    <div className="aspect-video relative">
                      <img
                        src={room.movie.image}
                        alt={room.movie.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="font-bold text-lg truncate">{room.movie.title}</h3>
                        <p className="text-sm text-white/60">{room.name}</p>
                      </div>
                    </div>

                    {/* Room Details */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          {room.host.avatarUrl ? (
                            <img
                              src={room.host.avatarUrl}
                              alt={room.host.fullName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-xs">
                              {room.host.fullName?.[0] || 'H'}
                            </div>
                          )}
                          <span className="text-sm text-white/60">
                            Hosted by <span className="text-white">{room.host.fullName}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/5 text-white/60">
                          <Users className="w-3.5 h-3.5" />
                          {room.participants.length}/{room.maxParticipants}
                        </div>
                      </div>

                      <Button
                        onClick={() => handleJoinRoom(room._id)}
                        disabled={joining || room.participants.length >= room.maxParticipants}
                        className="w-full bg-white/10 hover:bg-[#695CFF] hover:text-white text-white border-0"
                      >
                        {joining ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : room.participants.length >= room.maxParticipants ? (
                          'Room Full'
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            Join Session
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="private"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10">
                <div className="mb-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Private Access</h2>
                  <p className="text-white/60">Enter the room code to join</p>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <Input
                      type="text"
                      placeholder="ABC123XYZ"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10 text-center text-lg tracking-widest uppercase"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#0D0D0F] text-white/40">Or paste invite link</span>
                    </div>
                  </div>

                  <div className="relative">
                    <Copy className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <Input
                      type="text"
                      placeholder="connectus.app/room/..."
                      className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => handleJoinRoom(undefined, roomCode)}
                  disabled={joining || !roomCode.trim()}
                  className="w-full h-14 bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Room'
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
