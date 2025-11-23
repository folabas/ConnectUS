import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, Users, Play, Video, VideoOff, Mic, MicOff, Loader2, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Movie, RoomTheme, Screen } from '../App';
import { roomApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';
import { InviteFriendsModal } from './InviteFriendsModal';
import { signalingService } from '@/services/signaling';

interface WaitingRoomProps {
  onNavigate: (screen: Screen) => void;
  selectedMovie: Movie | null;
  roomTheme: RoomTheme;
  onRoomUpdate?: (room: any) => void;
}

export function WaitingRoom({ onNavigate, selectedMovie, roomTheme, onRoomUpdate }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoom = async () => {
      const roomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
      if (!roomId) {
        setLoading(false);
        return;
      }

      const token = tokenStorage.get();
      if (!token) {
        toast.error('Please log in to view this room');
        onNavigate('auth');
        setLoading(false);
        return;
      }

      try {
        const response = await roomApi.getById(token, roomId);
        if (response.success && response.data) {
          setRoom(response.data);
          if (onRoomUpdate) {
            onRoomUpdate(response.data);
          }
        } else {
          toast.error('Failed to load room details');
        }
      } catch (error) {
        console.error('Error fetching room:', error);
        toast.error('Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [onNavigate, onRoomUpdate]);

    // Listen for real-time room updates via Socket.io
  useEffect(() => {
    const socket = signalingService.socket;
    const currentRoomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
    const userDataStr = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;

    if (!socket || !currentRoomId || !userDataStr) return;
    
    const userData = JSON.parse(userDataStr);
    const userId = userData.userId;
    
    socket.emit('join-room', currentRoomId, userId);
    console.log('Emitted join-room:', currentRoomId, userId);
    
    const handleRoomUpdate = (data: { roomId: string; participantCount: number; participants: any[] }) => {
      if (data.roomId === currentRoomId) {
        console.log('Room updated:', data);
        setRoom((prev: any) => prev ? {
          ...prev,
          participants: data.participants
        } : null);
      }
    };

    const handleRoomStartingSoon = (data: { roomId: string; message: string; startTime: string }) => {
      if (data.roomId === currentRoomId) {
        toast.info(data.message, { duration: 10000 });
      }
    };

    const handleRoomStarted = (data: { roomId: string; message: string; room: any }) => {
      if (data.roomId === currentRoomId) {
        toast.success(data.message);
        setRoom(data.room);
      }
    };

    socket.on('room-updated', handleRoomUpdate);
    socket.on('room-starting-soon', handleRoomStartingSoon);
    socket.on('room-started', handleRoomStarted);

    return () => {
      socket.off('room-updated', handleRoomUpdate);
      socket.off('room-starting-soon', handleRoomStartingSoon);
      socket.off('room-started', handleRoomStarted);
    };
  }, []);



  const handleCopy = () => {
    if (room?.code) {
      const link = `${window.location.origin}/join/${room.code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#695CFF]" />
      </div>
    );
  }

  const displayMovie = room?.movie || selectedMovie || {
    title: 'Unknown Movie',
    image: '/placeholder.jpg',
    duration: '--',
    rating: '--',
    genre: '--'
  };

  const participants = room?.participants || [];
  const maxParticipants = room?.maxParticipants || 4;
  const roomCode = room?.code || '---';
  const isPrivate = room?.type === 'private';
  const inviteLink = typeof window !== 'undefined' ? `${window.location.host}/join/${roomCode}` : `connectus.app/join/${roomCode}`;

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
              <span className="text-sm">{participants.length}/{maxParticipants}</span>
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
            <p className="text-white/60 text-lg">{!isPrivate ? 'Public room – anyone can join' : 'Invite friends to join your session'}</p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left - Participants */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              {isPrivate ? (
                <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                  <label className="text-sm text-white/60 mb-3 block">Room Invite Link</label>
                  <div className="flex gap-3">
                    <div className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 truncate">
                      {inviteLink}
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
                  <p className="mt-2 text-sm text-white/40">Room Code: <span className="text-white font-mono">{roomCode}</span></p>
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl h-12"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Friends
                  </Button>
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
                  {participants.length > 0 ? (
                    participants.map((participant: any, index: number) => (
                      <motion.div
                        key={participant._id || index}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3"
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-lg font-medium">
                            {participant.fullName ? participant.fullName.substring(0, 2).toUpperCase() : '??'}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0D0D0F] bg-green-500`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{participant.fullName || 'Unknown User'}</p>
                          <p className="text-xs text-white/40">Online</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center text-white/40 py-4">Waiting for participants...</div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMicOn(!micOn)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micOn
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
                  className="text-white rounded-full px-8 gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                  }}
                >
                  <Play className="w-4 h-4" />
                  Start Session
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
                  <h2 className="text-xl tracking-tight">{displayMovie.title}</h2>
                </div>

                <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-white/5">
                  <ImageWithFallback
                    src={displayMovie.image}
                    alt={displayMovie.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Duration</span>
                    <span>{displayMovie.duration}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Rating</span>
                    <span>★ {displayMovie.rating}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Genre</span>
                    <span>{displayMovie.genre}</span>
                  </div>
                  {participants.length >= maxParticipants && (
                    <div className="mt-3 text-xs text-red-400">Room is at capacity ({maxParticipants})
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      {/* Invite Friends Modal */}
      {room && (
        <InviteFriendsModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={room._id}
        />
      )}
    </div>
  );
}