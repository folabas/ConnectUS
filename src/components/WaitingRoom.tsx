import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Users, Play, Video, VideoOff, Mic, MicOff, Loader2, UserPlus, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const userData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('connectus_user') || '{}') : {};
  const userId = userData.userId;

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

          // Check if current user has a pending request
          const userData = JSON.parse(localStorage.getItem('connectus_user') || '{}');
          const userId = userData.userId;
          const pendingRequest = response.data.joinRequests?.find(
            (r: any) => r.user._id === userId && r.status === 'pending'
          );
          if (pendingRequest) {
            setJoinRequestPending(true);
          }

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

  // Handle auto-redirect if already approved and room is playing
  useEffect(() => {
    if (redirecting) return; // Already on the way

    if (room?.status === 'playing') {
      const isParticipant = room.participants?.some(
        (p: any) => (p._id || p).toString() === userId?.toString()
      );

      if (isParticipant) {
        setRedirecting(true);
        const timer = setTimeout(() => {
          onNavigate('watch');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [room?.status, room?.participants, userId, onNavigate, redirecting]);

  // Listen for real-time room updates via Socket.io
  useEffect(() => {
    const socket = signalingService.connect(); // Ensure connection
    const currentRoomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
    const userDataStr = typeof window !== 'undefined' ? localStorage.getItem('connectus_user') : null;

    if (!socket || !currentRoomId || !userDataStr) return;

    const userData = JSON.parse(userDataStr);
    const userId = userData.userId;

    // Set up ALL listeners FIRST before emitting join-room
    const handleRoomUpdate = (data: { roomId: string; participantCount: number; participants: any[]; movie?: any }) => {
      if (data.roomId === currentRoomId) {
        console.log('Room updated with new participants:', data);
        setRoom((prev: any) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            participants: data.participants,
            movie: data.movie || prev.movie
          };
          // Also update parent state with movie if provided
          if (data.movie && onRoomUpdate) {
            onRoomUpdate(updated);
          }
          return updated;
        });
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
        // Update local state
        setRoom(data.room);
        // Update parent state so MovieWatchScreen gets the room with movie
        if (onRoomUpdate) {
          onRoomUpdate(data.room);
        }
        // Navigate to watch screen when room starts
        onNavigate('watch');
      }
    };

    // Handle new join requests (for host)
    const handleJoinRequestReceived = async (data: { roomId: string; userId: string }) => {
      if (data.roomId === currentRoomId) {
        // Refresh room to get updated joinRequests
        const token = tokenStorage.get();
        if (token) {
          const response = await roomApi.getById(token, currentRoomId);
          if (response.success && response.data) {
            setRoom(response.data);
          }
        }
      }
    };

    // Handle join request approved (for the requester)
    const handleJoinRequestApproved = (data: { roomId: string; room: any }) => {
      if (data.roomId === currentRoomId) {
        toast.success('Your join request was approved!');
        setJoinRequestPending(false);
        setRoom(data.room);
        if (onRoomUpdate) {
          onRoomUpdate(data.room);
        }
        if (data.room.status === 'playing') {
          setRedirecting(true);
          setTimeout(() => onNavigate('watch'), 1000);
        }
      }
    };

    // Handle join request rejected (for the requester)
    const handleJoinRequestRejected = (data: { roomId: string }) => {
      if (data.roomId === currentRoomId) {
        toast.error('Your join request was rejected');
        setJoinRequestPending(false);
        onNavigate('library');
      }
    };

    const handleRoomEnded = (data: { roomId: string; message: string }) => {
      if (data.roomId === currentRoomId) {
        toast.info(data.message || 'This session has been ended.');
        localStorage.removeItem('currentRoomId');
        onNavigate('library');
      }
    };

    // Register listeners FIRST
    socket.on('room-updated', handleRoomUpdate);
    socket.on('room-starting-soon', handleRoomStartingSoon);
    socket.on('room-started', handleRoomStarted);
    socket.on('join-request-received', handleJoinRequestReceived);
    socket.on('join-request-approved', handleJoinRequestApproved);
    socket.on('join-request-rejected', handleJoinRequestRejected);
    socket.on('room-ended', handleRoomEnded);

    // THEN emit join-room (after listeners are set up)
    const joinRoom = () => {
      socket.emit('user-online', userId);
      setTimeout(() => {
        socket.emit('join-room', currentRoomId, userId);
      }, 200);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on('connect', joinRoom);
    }

    // Cleanup
    return () => {
      socket.off('room-updated', handleRoomUpdate);
      socket.off('room-starting-soon', handleRoomStartingSoon);
      socket.off('room-started', handleRoomStarted);
      socket.off('join-request-received', handleJoinRequestReceived);
      socket.off('join-request-approved', handleJoinRequestApproved);
      socket.off('join-request-rejected', handleJoinRequestRejected);
      socket.off('room-ended', handleRoomEnded);
      socket.off('connect', joinRoom);
    };
  }, [onNavigate]);

  const handleStart = async () => {
    try {
      const token = tokenStorage.get();
      if (!token || !room?._id) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${room._id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (data.success) {
        // Navigation happens via socket event 'room-started'
        // But we can also navigate immediately for the host
        onNavigate('watch');
      } else {
        toast.error(data.message || 'Failed to start session');
      }
    } catch (error) {
      console.error("Failed to start room:", error);
      toast.error('Failed to start session');
    }
  };

  const handleLeaveRoom = () => {
    const roomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
    if (roomId && userId) {
      signalingService.socket?.emit('leave-room', roomId, userId);
    }
    localStorage.removeItem('currentRoomId');
    onNavigate('library');
  };

  const handleEndRoom = async () => {
    if (!room?._id) return;
    const token = tokenStorage.get();
    if (!token) return;

    try {
      const response = await roomApi.end(token, room._id);
      if (response.success) {
        localStorage.removeItem('currentRoomId');
        onNavigate('library');
      } else {
        toast.error(response.message || 'Failed to end session');
      }
    } catch (error) {
      console.error('Error ending room:', error);
      toast.error('Failed to end session');
    }
  };

  const handleApproveRequest = async (userId: string) => {
    if (!room?._id || !processingRequest) {
      setProcessingRequest(userId);
    }

    try {
      const token = tokenStorage.get();
      if (!token || !room?._id) return;

      const response = await roomApi.approveJoinRequest(token, room._id, userId);
      if (response.success) {
        toast.success('User joined the room');
        setRoom(response.data);
      } else {
        toast.error(response.message || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (userId: string) => {
    if (!room?._id || !processingRequest) {
      setProcessingRequest(userId);
    }

    try {
      const token = tokenStorage.get();
      if (!token || !room?._id) return;

      const response = await roomApi.rejectJoinRequest(token, room._id, userId);
      if (response.success) {
        toast.info('Join request rejected');
        setRoom((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            joinRequests: prev.joinRequests?.filter((r: any) => r.user._id !== userId)
          };
        });
      } else {
        toast.error(response.message || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleCopy = () => {
    if (room?.code) {
      const link = `${window.location.origin}/join/${room.code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRequestJoin = async () => {
    try {
      const token = tokenStorage.get();
      if (!token || !room?._id) return;

      const response = await roomApi.requestToJoin(token, room._id);
      if (response.success) {
        toast.success('Join request sent! Waiting for host approval.');
        setJoinRequestPending(true);
      } else {
        toast.error(response.message || 'Failed to send join request');
      }
    } catch (error) {
      console.error('Error requesting join:', error);
      toast.error('Failed to send join request');
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
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${roomCode}` : `connectus.live/join/${roomCode}`;
  const pendingRequests = room?.joinRequests?.filter((r: any) => r.status === 'pending') || [];

  // Safe user access - use correct localStorage key
  const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('connectus_user') || '{}') : {};

  // Handle both populated host (object with _id) and direct ObjectId (string)
  // Convert both to strings for comparison to avoid type mismatch
  const hostId = room?.host?._id?.toString() || room?.host?.toString();
  const isHost = hostId === currentUser.userId?.toString();

  // Debug log (remove in production)
  console.log('Host check:', { hostId, currentUser, isHost, roomHost: room?.host });

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Header */}
      <nav className="px-8 py-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setShowExitConfirm(true)}
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
                          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0D0D0F]" />
                        </div>
                        <div>
                          <p className="font-medium">{participant.fullName || 'Unknown User'}</p>
                          <p className="text-xs text-white/40">{participant._id === room.host._id ? 'Host' : 'Viewer'}</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-white/40 col-span-2 text-center py-4">Waiting for participants...</p>
                  )}
                </div>
              </div>

              {/* Join Requests Section (Host only) */}
              {isHost && pendingRequests.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="p-6 rounded-3xl bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <h3 className="text-lg">Join Requests ({pendingRequests.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {pendingRequests.map((request: any) => (
                      <div
                        key={request.user._id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm font-medium">
                            {request.user.fullName ? request.user.fullName.substring(0, 2).toUpperCase() : '??'}
                          </div>
                          <div>
                            <p className="font-medium">{request.user.fullName || 'Unknown User'}</p>
                            <p className="text-xs text-white/40">
                              Requested {new Date(request.requestedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(request.user._id)}
                            disabled={processingRequest === request.user._id}
                            className="p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-500 transition-colors disabled:opacity-50"
                          >
                            {processingRequest === request.user._id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.user._id)}
                            disabled={processingRequest === request.user._id}
                            className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors disabled:opacity-50"
                          >
                            {processingRequest === request.user._id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Right - Movie Info & Controls */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                <div className="aspect-video rounded-2xl overflow-hidden mb-4 relative group">
                  <ImageWithFallback
                    src={displayMovie.image}
                    alt={displayMovie.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-12 h-12 text-white fill-white" />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-1">{displayMovie.title}</h2>
                <div className="flex items-center gap-3 text-sm text-white/60 mb-6">
                  <span>{displayMovie.duration}</span>
                  <span>•</span>
                  <span>{displayMovie.genre}</span>
                  <span>•</span>
                  <span>{displayMovie.rating}</span>
                </div>

                {/* Media Controls Preview */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setMicOn(!micOn)}
                    className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-colors ${micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                      }`}
                  >
                    {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setVideoOn(!videoOn)}
                    className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-colors ${videoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                      }`}
                  >
                    {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                </div>

                {/* Start Button (Only for Host) */}
                {isHost ? (
                  <Button
                    onClick={handleStart}
                    className="w-full h-14 text-lg font-medium rounded-2xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                    }}
                  >
                    Start Session
                  </Button>
                ) : !room.participants?.some((p: any) => (p._id || p).toString() === userId?.toString()) && room.status === 'playing' ? (
                  joinRequestPending ? (
                    <div className="text-center p-4 rounded-2xl bg-yellow-500/10 text-yellow-500 flex flex-col items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Waiting for host approval...
                    </div>
                  ) : (
                    <Button
                      onClick={handleRequestJoin}
                      className="w-full h-14 text-lg font-medium rounded-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                      }}
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Ask to Join
                    </Button>
                  )
                ) : room.status === 'playing' || redirecting ? (
                  <div className="text-center p-4 rounded-2xl bg-purple-500/10 text-purple-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining live session...
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-2xl bg-white/5 text-white/60">
                    Waiting for host to start...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteFriendsModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        roomId={room?._id}
        roomCode={room?.code}
      />
      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#1A1A1E] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">{isHost ? 'End Session?' : 'Leave Room?'}</h2>
              <p className="text-white/60 text-center mb-8">
                {isHost
                  ? 'Choose whether to end this session for everyone or just leave it running.'
                  : 'Are you sure you want to leave this watch party?'}
              </p>
              <div className="flex flex-col gap-3">
                {isHost && (
                  <Button
                    onClick={handleEndRoom}
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    End for Everyone
                  </Button>
                )}
                <Button
                  onClick={handleLeaveRoom}
                  className={`w-full h-12 ${isHost ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} text-white rounded-2xl`}
                >
                  {isHost ? 'Just Leave' : 'Leave Session'}
                </Button>
                <Button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full h-12 bg-transparent hover:bg-white/5 text-white/40 border border-white/10 rounded-2xl"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}