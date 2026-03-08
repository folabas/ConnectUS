import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LogIn, Copy, Loader2, Users, Play, Lock, Globe, Send, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Screen } from '../App';
import { roomApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';
import { signalingService } from '@/services/signaling';

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
  type: 'public' | 'private';
  approvalRequired: boolean;
}

export function JoinRoom({ onNavigate }: JoinRoomProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [roomCode, setRoomCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [joining, setJoining] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  // Parse invite link from URL query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setRoomCode(code.toUpperCase());
      setActiveTab('private');
    }
  }, []);

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

  // Listen for join request approval/rejection
  useEffect(() => {
    if (joinRequestStatus !== 'pending' || !pendingRoomId) return;

    const socket = signalingService.connect();
    const userData = JSON.parse(localStorage.getItem('connectus_user') || '{}');
    const userId = userData.userId;

    const handleRequestApproved = (data: { roomId: string; room: any }) => {
      if (data.roomId === pendingRoomId) {
        toast.success('Your join request was approved!');
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentRoomId', data.room._id);
        }
        setJoinRequestStatus('approved');
        onNavigate('waiting-room');
      }
    };

    const handleRequestRejected = (data: { roomId: string }) => {
      if (data.roomId === pendingRoomId) {
        toast.error('Your join request was rejected');
        setJoinRequestStatus('rejected');
        setPendingRoomId(null);
      }
    };

    socket.on('join-request-approved', handleRequestApproved);
    socket.on('join-request-rejected', handleRequestRejected);

    return () => {
      socket.off('join-request-approved', handleRequestApproved);
      socket.off('join-request-rejected', handleRequestRejected);
    };
  }, [joinRequestStatus, pendingRoomId, onNavigate]);

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
      // If joining via roomId (public room click or from invite link without code), use direct join
      // If joining via code, try direct join first - backend will handle approval flow
      const response = await roomApi.join(token, {
        roomId,
        code
      });

      if (response.success && response.data) {
        // Check if user was directly added (for public rooms) or needs approval
        const room = response.data;

        // Check if user is already a participant (was approved or direct join)
        const currentUser = JSON.parse(localStorage.getItem('connectus_user') || '{}');
        const isParticipant = room.participants?.some((p: any) => {
          const pId = p._id || p;
          return pId === currentUser.userId;
        });

        if (isParticipant) {
          toast.success('Joined room successfully!');
          if (typeof window !== 'undefined') {
            localStorage.setItem('currentRoomId', room._id);
          }
          onNavigate('waiting-room');
        } else {
          // User needs approval - store roomId and show pending state
          toast.info('Join request sent! Waiting for host approval.');
          setPendingRoomId(room._id);
          setJoinRequestStatus('pending');
        }
      } else if ((response as any).requiresApproval) {
        // Explicitly handle "requires approval" response
        const room = (response as any).data;
        const roomId = room?._id || roomCode; // Use roomCode if roomId not available

        // Call requestToJoin to ensure they are in the pending list
        const requestResponse = await roomApi.requestToJoin(token, room?._id || roomId);
        if (requestResponse.success) {
          toast.info('Join request sent! Waiting for host approval.');
          setPendingRoomId(room?._id || roomId);
          setJoinRequestStatus('pending');
        } else {
          toast.error(requestResponse.message || 'Failed to send join request');
        }
      } else if (response.message?.includes('private') || response.message?.includes('invite')) {
        // If room is private and requires invite, offer to send request
        if (roomId) {
          const requestResponse = await roomApi.requestToJoin(token, roomId);
          if (requestResponse.success) {
            toast.info('Join request sent! Waiting for host approval.');
            setPendingRoomId(roomId);
            setJoinRequestStatus('pending');
          } else {
            toast.error(requestResponse.message || 'Failed to send join request');
          }
        } else {
          toast.error(response.message || 'Failed to join room');
        }
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

  const handleRequestToJoin = async (roomId: string) => {
    const token = tokenStorage.get();
    if (!token) {
      toast.error('Please log in to join a room');
      onNavigate('auth');
      return;
    }

    setJoining(true);
    try {
      const response = await roomApi.requestToJoin(token, roomId);
      if (response.success) {
        toast.info('Join request sent! Waiting for host approval.');
        setPendingRoomId(roomId);
        setJoinRequestStatus('pending');
      } else {
        toast.error(response.message || 'Failed to send join request');
      }
    } catch (error) {
      console.error('Error requesting to join:', error);
      toast.error('Failed to send join request');
    } finally {
      setJoining(false);
    }
  };

  const handleInviteLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteLink(value);

    // Try to extract room code from various URL formats
    // Examples:
    // - connectus.live/join/ABC123
    // - https://connectus.live/join/ABC123
    // - connectus.live?code=ABC123
    // - ABC123
    let extractedCode = '';

    if (value.includes('/join/')) {
      // URL format: .../join/ABC123
      const parts = value.split('/join/');
      extractedCode = parts[parts.length - 1].split('?')[0].toUpperCase();
    } else if (value.includes('code=')) {
      // Query param format: ...?code=ABC123
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      extractedCode = url.searchParams.get('code')?.toUpperCase() || '';
    } else if (value.length >= 6) {
      // Direct code: ABC123XYZ
      extractedCode = value.toUpperCase();
    }

    if (extractedCode && extractedCode.length >= 4) {
      setRoomCode(extractedCode);
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
            Browse active sessions or enter a code to join a private room
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
              Discover Sessions
            </button>
            <button
              onClick={() => setActiveTab('private')}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'private'
                ? 'bg-[#695CFF] text-white shadow-lg shadow-[#695CFF]/25'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              Join with Code
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {joinRequestStatus === 'pending' ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                  <Send className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Request Sent</h2>
                <p className="text-white/60 mb-6">Your join request is pending. You'll be notified when the host approves or rejects your request.</p>
                <div className="flex items-center justify-center gap-2 text-yellow-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Waiting for approval...</span>
                </div>
                <Button
                  onClick={() => {
                    setJoinRequestStatus('idle');
                    setPendingRoomId(null);
                  }}
                  className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl h-12"
                >
                  Cancel and Go Back
                </Button>
              </div>
            </motion.div>
          ) : joinRequestStatus === 'rejected' ? (
            <motion.div
              key="rejected"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Request Rejected</h2>
                <p className="text-white/60 mb-6">The host has declined your join request.</p>
                <Button
                  onClick={() => {
                    setJoinRequestStatus('idle');
                    setPendingRoomId(null);
                  }}
                  className="w-full bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl h-12"
                >
                  Try Another Room
                </Button>
              </div>
            </motion.div>
          ) : activeTab === 'public' ? (
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
                        ) : room.type === 'private' || room.approvalRequired ? (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Request Access
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            Join Now
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
                      placeholder="Paste invite link or room code..."
                      value={inviteLink}
                      onChange={handleInviteLinkChange}
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
