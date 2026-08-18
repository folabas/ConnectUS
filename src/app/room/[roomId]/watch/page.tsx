'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  LogOut,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Users,
  Video as VideoIcon,
  VideoOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoomChat } from '@/components/room/RoomChat';
import { ParticipantStrip } from '@/components/room/ParticipantStrip';
import { ReactionBar, ReactionOverlay } from '@/components/room/Reactions';
import { useRoom } from '@/providers/RoomProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWebRTC } from '@/hooks/useWebRTC';
import { usePlaybackSync } from '@/hooks/usePlaybackSync';
import { cn, focusRing, surface } from '@/lib/ui';

type Panel = 'chat' | 'people' | null;

export default function WatchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, phase, error, isHost, leave, end } = useRoom();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>('chat');
  const [blockedByAutoplay, setBlockedByAutoplay] = useState(false);

  // With host control off, anyone may drive playback.
  const canControl = isHost || room?.adminEnabled === false;

  const { requestSync } = usePlaybackSync({
    roomId: room?._id ?? '',
    canControl: Boolean(canControl),
    videoRef,
  });

  const {
    localStream,
    peers,
    mediaError,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    relayAvailable,
  } = useWebRTC(room?._id ?? null, phase === 'member');

  // Ask the room where it is once the film is ready to play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== 'member') return;
    const onReady = () => requestSync();
    video.addEventListener('loadedmetadata', onReady);
    return () => video.removeEventListener('loadedmetadata', onReady);
  }, [phase, requestSync]);

  // Anyone who lands here before the host starts belongs in the lobby.
  useEffect(() => {
    if (phase === 'member' && room && room.status !== 'playing' && room.status !== 'active') {
      router.replace(`/room/${room._id}`);
    }
  }, [phase, room, router]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (phase !== 'member' || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
        <div className={cn(surface, 'max-w-md p-8 text-center')}>
          <h1 className="text-xl tracking-tight">You are not in this session</h1>
          <p className="mt-2 text-white/60">{error ?? 'Ask the host for an invite.'}</p>
          <Button
            onClick={() => router.push('/rooms')}
            className="mt-6 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
          >
            Back to rooms
          </Button>
        </div>
      </div>
    );
  }

  const source = room.movie?.videoUrl;
  const theme = room.theme;

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col bg-black text-white">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
        <button
          onClick={() => router.push(`/room/${room._id}`)}
          className={cn(
            'flex items-center gap-2 rounded-lg text-sm text-white/60 transition-colors hover:text-white',
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Lobby</span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{room.movie?.title}</p>
          <p className="truncate text-xs text-white/40">{room.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 sm:flex">
            <Users className="h-3 w-3" />
            {room.participants.length}
          </span>

          {isHost ? (
            <Button
              onClick={() => void end()}
              variant="outline"
              className="h-9 rounded-xl border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
            >
              End session
            </Button>
          ) : (
            <Button
              onClick={() => void leave()}
              variant="outline"
              className="h-9 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <div className="relative flex flex-1 flex-col">
          <div className="relative flex-1 bg-black">
            {source ? (
              <video
                ref={videoRef}
                src={source}
                controls={Boolean(canControl)}
                playsInline
                onPlay={() => setBlockedByAutoplay(false)}
                className="h-full max-h-[calc(100vh-8rem)] w-full object-contain"
              />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center p-8 text-center">
                <div>
                  <p className="text-lg">This film has no playable source</p>
                  <p className="mt-1 text-sm text-white/50">
                    The host needs to pick a different title.
                  </p>
                </div>
              </div>
            )}

            <ReactionOverlay roomId={room._id} />

            {/* Followers cannot scrub; make that explicit rather than silently
                swallowing their clicks. */}
            {!canControl && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-white/60 backdrop-blur">
                  {room.host?.fullName ?? 'The host'} controls playback
                </span>
              </div>
            )}

            {blockedByAutoplay && (
              <button
                onClick={() => void videoRef.current?.play()}
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              >
                <span className="rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] px-6 py-3">Tap to join playback</span>
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <ControlButton
                onClick={toggleAudio}
                active={audioEnabled}
                disabled={!localStream}
                label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </ControlButton>

              <ControlButton
                onClick={toggleVideo}
                active={videoEnabled}
                disabled={!localStream}
                label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
              >
                {videoEnabled ? (
                  <VideoIcon className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4" />
                )}
              </ControlButton>

              <ControlButton
                onClick={() => void containerRef.current?.requestFullscreen?.()}
                active
                label="Enter fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </ControlButton>
            </div>

            <ReactionBar roomId={room._id} themeColor={theme.primary} />

            <div className="flex items-center gap-2 lg:hidden">
              <ControlButton
                onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
                active={panel === 'chat'}
                label="Toggle chat"
              >
                <MessageSquare className="h-4 w-4" />
              </ControlButton>
              <ControlButton
                onClick={() => setPanel(panel === 'people' ? null : 'people')}
                active={panel === 'people'}
                label="Toggle participants"
              >
                <Users className="h-4 w-4" />
              </ControlButton>
            </div>
          </div>

          {/* Without a TURN relay, peers behind symmetric NAT silently fail to
              connect. Saying so beats leaving someone staring at a black tile
              wondering whether their camera is broken. */}
          {!relayAvailable && !mediaError && (
            <p className="border-t border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/50">
              Video connections are direct only on this server. If someone&apos;s camera
              never appears, their network is likely blocking peer-to-peer.
            </p>
          )}

          {mediaError && (
            <p className="border-t border-white/10 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              {mediaError === 'denied'
                ? 'Camera and microphone are blocked, so others cannot see or hear you. Everything else works.'
                : mediaError === 'not-found'
                  ? 'No camera or microphone found. You can still watch and chat.'
                  : 'This browser does not support video chat. You can still watch and chat.'}
            </p>
          )}
        </div>

        {/* Side panel */}
        <AnimatePresence initial={false}>
          {panel && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex w-full flex-col border-t border-white/10 lg:w-80 lg:border-l lg:border-t-0 xl:w-96"
            >
              <div className="flex border-b border-white/10">
                <PanelTab active={panel === 'chat'} onClick={() => setPanel('chat')}>
                  Chat
                </PanelTab>
                <PanelTab active={panel === 'people'} onClick={() => setPanel('people')}>
                  People ({room.participants.length})
                </PanelTab>
              </div>

              {panel === 'chat' ? (
                <RoomChat roomId={room._id} currentUserId={user?.userId} theme={theme} />
              ) : (
                <ParticipantStrip
                  room={room}
                  peers={peers}
                  localStream={localStream}
                  currentUserId={user?.userId}
                />
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Desktop always shows a panel; this restores it after a mobile close. */}
        {!panel && (
          <button
            onClick={() => setPanel('chat')}
            className="hidden w-12 items-center justify-center border-l border-white/10 text-white/50 hover:text-white lg:flex"
            aria-label="Open chat panel"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick(): void;
  active: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        focusRing,
        active ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400',
      )}
    >
      {children}
    </button>
  );
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-4 py-3 text-sm transition-colors',
        focusRing,
        active ? 'border-b-2 border-[var(--brand)] text-white' : 'text-white/50 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
