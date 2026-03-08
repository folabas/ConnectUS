import { useState, useRef, useEffect, useCallback } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import type { ComponentType, SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, MessageCircle, Users, X, Heart, ThumbsUp, Laugh, Mic, MicOff, Video, VideoOff, PhoneOff, SkipBack, SkipForward, Copy, Check, Lock, Loader2, XCircle, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Movie, RoomTheme, Screen, Room } from '../App';
import { roomApi, tokenStorage, userStorage } from '@/services/api';
import { useWebRTC } from '@/hooks/useWebRTC';
import { signalingService } from '@/services/signaling';
import { toast } from 'sonner';

interface MovieWatchScreenProps {
  onNavigate: (screen: Screen) => void;
  selectedMovie: Movie | null;
  roomTheme: RoomTheme;
  currentRoom: Room | null;
}

const reactions = [
  { icon: Heart, color: 'text-red-500', name: 'love' },
  { icon: ThumbsUp, color: 'text-blue-500', name: 'like' },
  { icon: Laugh, color: 'text-yellow-500', name: 'laugh' }
];

interface FloatingReaction {
  id: number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  x: number;
}

interface VideoController {
  play: () => Promise<void>;
  pause: () => void;
  currentTime: number;
  paused: boolean;
  duration: number;
  volume: number;
  muted: boolean;
}

const VideoPlayer = ({ stream, muted = false, className }: { stream: MediaStream, muted?: boolean, className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted={muted} className={className} />;
};

export function MovieWatchScreen({ onNavigate, selectedMovie, roomTheme, currentRoom }: MovieWatchScreenProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(currentRoom || null);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [muxPlayerReady, setMuxPlayerReady] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const muxPlayerRef = useRef<HTMLElement & { play?: () => Promise<void>; pause?: () => void; currentTime?: number; paused?: boolean; duration?: number; volume?: number; muted?: boolean }>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactionIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  const user = userStorage.get();
  const userId = user?.userId || null;
  const roomId = activeRoom?._id || (typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null);

  // Handle both populated host (object with _id) and direct ObjectId (string)
  // Convert both to strings for comparison to avoid type mismatch
  const hostId = activeRoom?.host?._id?.toString() || activeRoom?.host?.toString();
  const isHost = hostId === userId?.toString();
  const isAdminEnabled = activeRoom?.adminEnabled || false;
  const canControl = !isAdminEnabled || isHost;

  const isMuxPlayer = !!(selectedMovie as any)?.muxPlaybackId || !!(activeRoom?.movie as any)?.muxPlaybackId;

  const getVideoController = useCallback((): VideoController | null => {
    if (isMuxPlayer && muxPlayerRef.current) {
      return {
        play: async () => { if (muxPlayerRef.current?.play) await muxPlayerRef.current.play(); },
        pause: () => { if (muxPlayerRef.current?.pause) muxPlayerRef.current.pause(); },
        get currentTime() { return muxPlayerRef.current?.currentTime || 0; },
        set currentTime(val) { if (muxPlayerRef.current) muxPlayerRef.current.currentTime = val; },
        get paused() { return muxPlayerRef.current?.paused ?? true; },
        get duration() { return muxPlayerRef.current?.duration || 0; },
        get volume() { return muxPlayerRef.current?.volume || 1; },
        set volume(val) { if (muxPlayerRef.current) muxPlayerRef.current.volume = val; },
        get muted() { return muxPlayerRef.current?.muted ?? false; },
        set muted(val) { if (muxPlayerRef.current) muxPlayerRef.current.muted = val; },
      };
    }
    if (videoRef.current) {
      return videoRef.current;
    }
    return null;
  }, [isMuxPlayer]);

  const { localStream, peers, messages, isConnected, permissionError, retry, toggleAudio, toggleVideo, sendChatMessage } = useWebRTC(roomId, userId);

  useEffect(() => {
    if (permissionError === 'Permission denied') {
      toast.error('Camera/Microphone access was denied.', {
        description: 'Please click the lock icon in your browser address bar to allow permissions, then click retry.',
        action: {
          label: 'Retry',
          onClick: () => retry()
        },
        duration: 10000
      });
    } else if (permissionError === 'Device error') {
      toast.error('Could not access media devices.', {
        description: 'Please ensure your camera and microphone are connected and not used by another app.',
        action: {
          label: 'Retry',
          onClick: () => retry()
        }
      });
    }
  }, [permissionError, retry]);

  useEffect(() => {
    setActiveRoom(currentRoom || null);
  }, [currentRoom]);

  useEffect(() => {
    const fetchRoom = async () => {
      if (activeRoom) return; // Only fetch if not already loaded

      const storedRoomId = roomId || (typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null);
      if (!storedRoomId) return;

      const token = tokenStorage.get();
      if (!token) return;

      try {
        const response = await roomApi.getById(token, storedRoomId);
        if (response.success && response.data) {
          setActiveRoom(response.data);
        }
      } catch (error) {
        console.error('Error fetching room:', error);
      }
    };

    fetchRoom();
  }, [roomId, activeRoom]);

  const fetchRoomData = async () => {
    const storedRoomId = roomId || (typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null);
    if (!storedRoomId) return;

    const token = tokenStorage.get();
    if (!token) return;

    try {
      const response = await roomApi.getById(token, storedRoomId);
      if (response.success && response.data) {
        setActiveRoom(response.data);
      }
    } catch (error) {
      console.error('Error fetching room:', error);
    }
  };

  // Video synchronization socket listeners
  useEffect(() => {
    if (!roomId) return;

    const socket = signalingService.connect();
    if (!socket) return;

    const handleVideoPlay = (payload: any) => {
      if (payload.roomId === roomId && !isSyncingRef.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 2000) return;
        lastSyncTimeRef.current = now;

        isSyncingRef.current = true;
        const controller = getVideoController();
        if (controller) {
          controller.currentTime = payload.currentTime || 0;
          controller.play().catch(console.error);
          setIsPlaying(true);
        }
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    };

    const handleVideoPause = (payload: any) => {
      if (payload.roomId === roomId && !isSyncingRef.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 2000) return;
        lastSyncTimeRef.current = now;

        isSyncingRef.current = true;
        const controller = getVideoController();
        if (controller) {
          controller.currentTime = payload.currentTime || 0;
          controller.pause();
          setIsPlaying(false);
        }
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    };

    const handleVideoSeek = (payload: any) => {
      if (payload.roomId === roomId && !isSyncingRef.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 1000) return;
        lastSyncTimeRef.current = now;

        isSyncingRef.current = true;
        const controller = getVideoController();
        if (controller) {
          controller.currentTime = payload.currentTime || 0;
          setCurrentTime(payload.currentTime || 0);
        }
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    };

    const handleVideoSyncRequest = (payload: any) => {
      if (isHost && payload.roomId === roomId) {
        const controller = getVideoController();
        if (controller) {
          socket.emit('video-sync-response', {
            roomId,
            currentTime: controller.currentTime,
            isPlaying: !controller.paused
          });
        }
      }
    };

    const handleVideoSyncResponse = (payload: any) => {
      if (payload.roomId === roomId && !isHost && !isSyncingRef.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 2000) return;
        lastSyncTimeRef.current = now;

        isSyncingRef.current = true;
        const controller = getVideoController();
        if (controller) {
          controller.currentTime = payload.currentTime || 0;
          setCurrentTime(payload.currentTime || 0);
          if (payload.isPlaying) {
            controller.play().catch(console.error);
            setIsPlaying(true);
          } else {
            controller.pause();
            setIsPlaying(false);
          }
        }
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    };

    const handleReaction = (payload: any) => {
      if (payload.roomId === roomId && payload.userId !== userId) {
        const reactionData = reactions.find(r => r.name === payload.reaction);
        if (reactionData) {
          addReaction(reactionData.icon, reactionData.color);
        }
      }
    };

    const handleRoomEnded = (payload: any) => {
      if (payload.roomId === roomId) {
        toast.info(payload.message || 'The session has ended.');
        localStorage.removeItem('currentRoomId');
        onNavigate('library');
      }
    };

    const handleJoinRequestReceived = (payload: any) => {
      if (payload.roomId === roomId && isHost) {
        toast.info(`New join request from a user`, {
          action: {
            label: 'View',
            onClick: () => setShowRequestsModal(true)
          }
        });
        // Refresh room data to show new requests
        fetchRoomData();
      }
    };

    const handleRoomUpdated = (payload: any) => {
      if (payload.roomId === roomId) {
        // Update local room state if participants or requests changed
        setActiveRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: payload.participants || prev.participants,
            joinRequests: payload.joinRequests || prev.joinRequests
          };
        });
      }
    };

    socket.on('video-play', handleVideoPlay);
    socket.on('video-pause', handleVideoPause);
    socket.on('video-seek', handleVideoSeek);
    socket.on('video-sync-request', handleVideoSyncRequest);
    socket.on('video-sync-response', handleVideoSyncResponse);
    socket.on('reaction', handleReaction);
    socket.on('room-ended', handleRoomEnded);
    socket.on('user-left', (data: { userId: string, userName: string }) => {
      if (data.userId !== userId) {
        toast.info(`${data.userName} left the room`);
        fetchRoomData();
      }
    });
    socket.on('user-connected', ({ userId: connectingUserId }) => {
      if (connectingUserId !== userId) {
        fetchRoomData();
      }
    });
    socket.on('user-disconnected', ({ userId: disconnectedUserId }) => {
      if (disconnectedUserId !== userId) {
        fetchRoomData();
      }
    });
    socket.on('join-request-received', handleJoinRequestReceived);
    socket.on('room-updated', handleRoomUpdated);

    // Request sync when joining (for non-hosts)
    if (!isHost) {
      setTimeout(() => {
        socket.emit('video-sync-request', { roomId });
      }, 2000);
    }

    return () => {
      socket.off('reaction', handleReaction);
      socket.off('room-ended', handleRoomEnded);
      socket.off('room-updated', handleRoomUpdated);
      socket.off('user-left');
      socket.off('user-connected');
      socket.off('user-disconnected');
      socket.off('join-request-received', handleJoinRequestReceived);
    };
  }, [roomId, isHost, getVideoController, userId]);

  // Poll for video state updates (for MuxPlayer)
  useEffect(() => {
    if (!isMuxPlayer) return;

    const interval = setInterval(() => {
      const controller = getVideoController();
      if (controller) {
        setCurrentTime(controller.currentTime);
        setIsPlaying(!controller.paused);
        setDuration(controller.duration || 0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isMuxPlayer, getVideoController]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Use selectedMovie or fallback to room movie if available
  const movie = selectedMovie || (activeRoom?.movie as Movie) || null;

  useEffect(() => {
    if (!movie && !activeRoom) {
      // Only redirect if both are missing (give fetch a chance)
      const storedRoomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
      if (!storedRoomId) {
        onNavigate('library');
      }
    }
  }, [movie, activeRoom, onNavigate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [movie]);

  const togglePlay = () => {
    if (!canControl) {
      toast.error('Only the host can control playback');
      return;
    }

    const controller = getVideoController();
    if (!controller || isSyncingRef.current) return;

    const newIsPlaying = !isPlaying;
    if (newIsPlaying) {
      controller.play().catch(console.error);
    } else {
      controller.pause();
    }
    setIsPlaying(newIsPlaying);

    // Broadcast to other users
    if (roomId && signalingService.isConnected) {
      signalingService.emitVideoEvent(newIsPlaying ? 'video-play' : 'video-pause', {
        roomId,
        currentTime: controller.currentTime
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    const controller = getVideoController();
    if (controller) {
      controller.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const controller = getVideoController();
    if (controller) {
      controller.muted = newMuted;
    }
  };

  const handleToggleMic = () => {
    const enabled = toggleAudio();
    setMicOn(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    setVideoOn(enabled);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) {
      toast.error('Only the host can seek');
      return;
    }

    const time = parseFloat(e.target.value);
    setCurrentTime(time);

    if (!isSyncingRef.current) {
      const controller = getVideoController();
      if (controller) {
        controller.currentTime = time;

        // Broadcast seek to other users
        if (roomId && signalingService.isConnected) {
          signalingService.emitVideoEvent('video-seek', {
            roomId,
            currentTime: time
          });
        }
      }
    }
  };

  const skip = (seconds: number) => {
    const controller = getVideoController();
    if (controller) {
      controller.currentTime += seconds;
    }
  };

  const handleLeaveRoom = () => {
    if (roomId && userId) {
      signalingService.socket?.emit('leave-room', roomId, userId);
    }
    localStorage.removeItem('currentRoomId');
    onNavigate('library');
  };

  const handleEndRoom = async () => {
    if (!roomId) return;
    const token = tokenStorage.get();
    if (!token) return;

    try {
      const response = await roomApi.end(token, roomId);
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

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const addReaction = (icon: ComponentType<SVGProps<SVGSVGElement>>, color: string, reactionName?: string) => {
    const id = ++reactionIdRef.current;
    const newReaction: FloatingReaction = {
      id,
      icon,
      color,
      x: (id * 37) % 200
    };
    setFloatingReactions(prev => [...prev, newReaction]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);

    // Broadcast reaction to other users
    if (reactionName && roomId) {
      const socket = signalingService.socket;
      if (socket) {
        socket.emit('reaction', {
          roomId,
          reaction: reactionName,
          userId
        });
      }
    }
  };

  const handleCopyLink = () => {
    if (activeRoom?.code) {
      const link = `${window.location.origin}/join/${activeRoom.code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Room link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendChatMessage(chatInput);
      setChatInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleApproveRequest = async (requestedUserId: string) => {
    setProcessingRequest(requestedUserId);
    try {
      const token = tokenStorage.get();
      if (!token || !roomId) return;

      const response = await roomApi.approveJoinRequest(token, roomId, requestedUserId);
      if (response.success) {
        toast.success('User approved to join');
        setActiveRoom(response.data);
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

  const handleRejectRequest = async (requestedUserId: string) => {
    setProcessingRequest(requestedUserId);
    try {
      const token = tokenStorage.get();
      if (!token || !roomId) return;

      const response = await roomApi.rejectJoinRequest(token, roomId, requestedUserId);
      if (response.success) {
        toast.info('Join request rejected');
        setActiveRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            joinRequests: prev.joinRequests?.filter((r: any) => r.user._id !== requestedUserId)
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

  if (!movie) {
    return (
      <div className="h-screen bg-[#0D0D0F] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#695CFF]" />
          <p className="text-white/60">Loading session...</p>
        </div>
      </div>
    );
  }

  const participants = activeRoom?.participants || [];

  return (
    <div ref={containerRef} className="h-screen bg-[#0D0D0F] text-white flex flex-col overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        <div
          className="flex-1 relative bg-black flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {/* Video Element */}
          {movie.muxPlaybackId ? (
            <MuxPlayer
              ref={(el) => { muxPlayerRef.current = el; }}
              className="w-full h-full object-contain"
              playbackId={movie.muxPlaybackId}
              metadata={{
                video_id: movie.id,
                video_title: movie.title,
                viewer_user_id: userId || 'anonymous',
              }}
              streamType="on-demand"
              autoPlay={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e: any) => setCurrentTime(e.target?.currentTime || 0)}
              onLoadedMetadata={(e: any) => setDuration(e.target?.duration || 0)}
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={movie.videoUrl}
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
          )}

          {/* Top Left - Room Code */}
          {activeRoom?.code && (
            <div className="absolute top-4 left-4 md:top-6 md:left-6 flex gap-2 z-50">
              <div className="px-3 py-2 md:px-4 md:py-2 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center gap-2">
                <span className="text-xs md:text-sm text-white/60 hidden sm:inline">Room:</span>
                <span className="text-xs md:text-sm font-mono">{activeRoom.code}</span>
              </div>
              <div className="px-3 py-2 md:px-4 md:py-2 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center gap-2">
                <Users className="w-3 h-3 md:w-4 md:h-4 text-[#695CFF]" />
                <span className="text-xs md:text-sm font-medium">{participants.length}</span>
              </div>
              <button
                onClick={handleCopyLink}
                className="px-2 md:px-4 py-2 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-black/70 transition-colors flex items-center gap-1 md:gap-2"
              >
                {copied ? <Check className="w-3 h-3 md:w-4 md:h-4" /> : <Copy className="w-3 h-3 md:w-4 md:h-4" />}
                <span className="text-xs md:text-sm hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          )}

          {/* Admin Control Indicator */}
          {isAdminEnabled && !canControl && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 md:top-6 z-50">
              <div className="px-3 py-2 md:px-4 md:py-2 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center gap-1 md:gap-2">
                <Lock className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                <span className="text-xs md:text-sm text-white/80 hidden sm:inline">Host controlling</span>
              </div>
            </div>
          )}

          {/* Top Right Controls and Participants */}
          <div className="absolute top-4 right-4 md:top-6 md:right-6 flex gap-2 md:gap-3 items-start z-50">
            {/* Local Video */}
            {localStream && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative group w-20 h-16 md:w-32 md:h-24 rounded-lg md:rounded-2xl overflow-hidden border border-white/20 bg-black"
              >
                <VideoPlayer stream={localStream} muted={true} className="w-full h-full object-cover transform scale-x-[-1]" />
                <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-[8px] md:text-[10px]">You</div>
              </motion.div>
            )}

            {/* Remote Videos */}
            {peers.slice(0, 2).map((peer) => (
              <motion.div
                key={peer.userId}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative group w-20 h-16 md:w-32 md:h-24 rounded-lg md:rounded-2xl overflow-hidden border border-white/20 bg-black"
              >
                <VideoPlayer stream={peer.stream} className="w-full h-full object-cover" />
                <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-[8px] md:text-[10px]">
                  {participants.find((p: any) => p._id === peer.userId)?.fullName || 'User'}
                </div>
              </motion.div>
            ))}

            <motion.button
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowChat(!showChat)}
              className="flex items-center gap-1 md:gap-2 px-3 py-3 md:px-4 md:py-3 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-black/70 transition-colors"
            >
              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm hidden sm:inline">Chat</span>
            </motion.button>

            <motion.button
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleFullscreen}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5" />}
            </motion.button>

            {isHost && (
              <motion.button
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowRequestsModal(true)}
                className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
                {activeRoom?.joinRequests?.some((r: any) => r.status === 'pending') && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded-full border-2 border-[#0D0D0F] flex items-center justify-center text-[8px] md:text-[10px] font-bold">
                    {activeRoom.joinRequests.filter((r: any) => r.status === 'pending').length}
                  </span>
                )}
              </motion.button>
            )}
          </div>

          {/* Floating Reactions Container */}
          <div className="absolute bottom-32 left-6 pointer-events-none">
            <AnimatePresence>
              {floatingReactions.map((reaction) => {
                const ReactionIcon = reaction.icon;
                return (
                  <motion.div
                    key={reaction.id}
                    initial={{ y: 0, opacity: 1, x: reaction.x }}
                    animate={{ y: -150, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 3, ease: "easeOut" }}
                    className="absolute"
                  >
                    <ReactionIcon className={`w-8 h-8 ${reaction.color}`} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Floating Reactions Buttons */}
          <div className="absolute bottom-28 md:bottom-32 left-4 md:left-6 flex gap-2 md:gap-3">
            {reactions.map((reaction, index) => {
              const ReactionIcon = reaction.icon;
              return (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => addReaction(reaction.icon, reaction.color, reaction.name)}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ReactionIcon className={`w-5 h-5 ${reaction.color}`} />
                </motion.button>
              );
            })}
          </div>

          {/* Video Controls */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute bottom-0 left-0 right-0 px-3 md:px-6 pb-3 md:pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              >
                {/* Progress Bar */}
                <div className="mb-3 md:mb-4">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 md:h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${roomTheme.primary} ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`
                    }}
                  />
                  <div className="flex items-center justify-between mt-1 md:mt-2 text-xs md:text-sm text-white/60">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5" /> : <Play className="w-4 h-4 md:w-5 md:h-5 ml-0.5 md:ml-1" />}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => skip(-10)}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors hidden sm:flex"
                    >
                      <SkipBack className="w-3 h-3 md:w-4 md:h-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => skip(10)}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors hidden sm:flex"
                    >
                      <SkipForward className="w-3 h-3 md:w-4 md:h-4" />
                    </motion.button>

                    <div className="flex items-center gap-1 md:gap-2 ml-1 md:ml-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMute}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5" />}
                      </motion.button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 md:w-24 h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              className="fixed md:relative md:w-96 w-full h-full bg-[#0D0D0F]/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-50 md:z-40 right-0 top-0"
            >
              {/* Chat Header */}
              <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <MessageCircle className="w-4 h-4 md:w-5 md:h-5" style={{ color: roomTheme.primary }} />
                  <h3 className="text-base md:text-lg">Live Chat</h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowChat(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-4">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === userId;
                    const sender = participants.find((p: any) => p._id === msg.userId);
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={`space-y-1 ${isMe ? 'items-end flex flex-col' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: isMe ? roomTheme.primary : 'white' }}>
                            {isMe ? 'You' : (sender?.fullName || 'Unknown')}
                          </span>
                          <span className="text-xs text-white/40">
                            {(() => {
                              const now = Date.now();
                              const msgTime = new Date(msg.timestamp).getTime();
                              const diffMs = now - msgTime;
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMs / 3600000);

                              if (diffMins < 1) return 'just now';
                              if (diffMins < 60) return `${diffMins}m ago`;
                              if (diffHours < 24) return `${diffHours}h ago`;
                              return new Date(msg.timestamp).toLocaleDateString();
                            })()}
                          </span>
                        </div>
                        <div className={`px-4 py-3 rounded-2xl border ${isMe ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'}`}>
                          <p className="text-sm text-white/80">{msg.text}</p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 md:p-6 border-t border-white/10">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 h-10 md:h-12 bg-white/5 border-white/10 rounded-xl md:rounded-2xl text-white text-sm placeholder:text-white/40 focus:border-[#695CFF]"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="h-10 md:h-12 px-4 md:px-6 rounded-xl md:rounded-2xl text-white text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${roomTheme.primary}, ${roomTheme.secondary})`
                    }}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Control Bar - Always Fixed and Visible */}
      <div className="flex-none px-3 py-3 md:px-6 md:py-4 bg-[#0D0D0F] border-t border-white/10 flex items-center justify-between z-50 relative">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 md:gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-xs md:text-sm text-white/60">{participants.length} watching</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 hover:bg-red-500/30'
              }`}
          >
            {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-red-500" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${videoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 hover:bg-red-500/30'
              }`}
          >
            {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-500" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowExitConfirm(true)}
            className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
          >
            <PhoneOff className="w-4 h-4 text-red-500" />
          </motion.button>
        </div>
      </div>

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
                <PhoneOff className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">{isHost ? 'End Session?' : 'Leave Session?'}</h2>
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

        {showRequestsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequestsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#1A1A1E] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Join Requests</h2>
                  <p className="text-xs text-white/40">Manage who can join your session</p>
                </div>
                <button
                  onClick={() => setShowRequestsModal(false)}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 max-h-[400px] overflow-y-auto">
                {activeRoom?.joinRequests?.filter((r: any) => r.status === 'pending').length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Users className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/40">No pending join requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeRoom?.joinRequests
                      ?.filter((r: any) => r.status === 'pending')
                      .map((request: any) => (
                        <div key={request.user._id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center font-bold">
                              {request.user.fullName?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{request.user.fullName}</p>
                              <p className="text-[10px] text-white/40">Requested access</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={processingRequest === request.user._id}
                              onClick={() => handleRejectRequest(request.user._id)}
                              className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                            <button
                              disabled={processingRequest === request.user._id}
                              onClick={() => handleApproveRequest(request.user._id)}
                              className="w-9 h-9 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-500 flex items-center justify-center transition-colors"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10">
                <Button
                  onClick={() => setShowRequestsModal(false)}
                  className="w-full h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div >
  );
}
