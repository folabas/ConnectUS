import { useState, useRef, useEffect } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import type { ComponentType, SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, MessageCircle, Users, X, Heart, ThumbsUp, Laugh, Mic, MicOff, Video, VideoOff, PhoneOff, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Movie, RoomTheme, Screen, Room } from '../App';
import { roomApi, tokenStorage, userStorage } from '@/services/api';
import { useWebRTC } from '@/hooks/useWebRTC';

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
  const [activeRoom, setActiveRoom] = useState<Room | null>(currentRoom);
  const [chatInput, setChatInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactionIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const user = userStorage.get();
  const userId = user?.userId || null;
  const roomId = activeRoom?._id || (typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null);

  const { localStream, peers, messages, toggleAudio, toggleVideo, sendChatMessage } = useWebRTC(roomId, userId);

  useEffect(() => {
    setActiveRoom(currentRoom);
  }, [currentRoom]);

  useEffect(() => {
    const fetchRoom = async () => {
      if (activeRoom) return;

      const storedRoomId = typeof window !== 'undefined' ? localStorage.getItem('currentRoomId') : null;
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
  }, [activeRoom]);

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
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
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
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
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

  const addReaction = (icon: ComponentType<SVGProps<SVGSVGElement>>, color: string) => {
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

  if (!movie) return null;

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
              ref={videoRef as any}
              className="w-full h-full object-contain"
              playbackId={movie.muxPlaybackId}
              metadata={{
                video_id: movie.id,
                video_title: movie.title,
                viewer_user_id: userId || 'anonymous',
                env_key: process.env.NEXT_PUBLIC_MUX_ENV_KEY,
              }}
              streamType="on-demand"
              autoPlay={false}
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={movie.videoUrl}
              onClick={togglePlay}
            />
          )}

          {/* Top Right Controls and Participants */}
          <div className="absolute top-6 right-6 flex gap-3 items-start z-50">
            {/* Local Video */}
            {localStream && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative group w-32 h-24 rounded-2xl overflow-hidden border border-white/20 bg-black"
              >
                <VideoPlayer stream={localStream} muted={true} className="w-full h-full object-cover transform scale-x-[-1]" />
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px]">You</div>
              </motion.div>
            )}

            {/* Remote Videos */}
            {peers.map((peer) => (
              <motion.div
                key={peer.userId}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative group w-32 h-24 rounded-2xl overflow-hidden border border-white/20 bg-black"
              >
                <VideoPlayer stream={peer.stream} className="w-full h-full object-cover" />
                {/* Try to find participant name */}
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px]">
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
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-black/70 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">Chat</span>
            </motion.button>

            <motion.button
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </motion.button>
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
          <div className="absolute bottom-32 left-6 flex gap-3">
            {reactions.map((reaction, index) => {
              const ReactionIcon = reaction.icon;
              return (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => addReaction(reaction.icon, reaction.color)}
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
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
                className="absolute bottom-0 left-0 right-0 px-6 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              >
                {/* Progress Bar */}
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${roomTheme.primary} ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`
                    }}
                  />
                  <div className="flex items-center justify-between mt-2 text-sm text-white/60">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => skip(-10)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <SkipBack className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => skip(10)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                    </motion.button>

                    <div className="flex items-center gap-2 ml-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleMute}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </motion.button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-24 h-1 rounded-full appearance-none cursor-pointer"
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
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-96 bg-[#0D0D0F]/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-40"
            >
              {/* Chat Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5" style={{ color: roomTheme.primary }} />
                  <h3 className="text-lg">Live Chat</h3>
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
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              <div className="p-6 border-t border-white/10">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 h-12 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF]"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="h-12 px-6 rounded-2xl text-white"
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
      <div className="flex-none px-6 py-4 bg-[#0D0D0F] border-t border-white/10 flex items-center justify-between z-50 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/60">{participants.length} watching</span>
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
            onClick={() => onNavigate('library')}
            className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
          >
            <PhoneOff className="w-4 h-4 text-red-500" />
          </motion.button>
        </div>
      </div>
    </div >
  );
}
