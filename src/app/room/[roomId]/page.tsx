'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  Loader2,
  LogOut,
  Play,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { InviteFriends } from '@/components/room/InviteFriends';
import { PendingRequests } from '@/components/room/PendingRequests';
import { useRoom } from '@/providers/RoomProvider';
import { useAuth } from '@/providers/AuthProvider';
import { cn, focusRing, initials, surface } from '@/lib/ui';

export default function RoomLobbyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, phase, error, isHost, requestToJoin, start, end, leave } = useRoom();

  const [starting, setStarting] = useState(false);

  // A session already in progress belongs on the watch screen, not the lobby.
  useEffect(() => {
    if (phase === 'member' && room && (room.status === 'playing' || room.status === 'active')) {
      router.replace(`/room/${room._id}/watch`);
    }
  }, [phase, room, router]);

  if (phase === 'loading') {
    return <CenteredState><Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" /></CenteredState>;
  }

  if (phase === 'error' || phase === 'denied') {
    return (
      <CenteredState>
        <div className={cn(surface, 'max-w-md p-8 text-center')}>
          <h1 className="text-xl tracking-tight">
            {phase === 'denied' ? 'Not admitted' : 'Cannot open this room'}
          </h1>
          <p className="mt-2 text-white/60">{error ?? 'Something went wrong.'}</p>
          <Button
            onClick={() => router.push('/rooms')}
            className="mt-6 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
          >
            Back to rooms
          </Button>
        </div>
      </CenteredState>
    );
  }

  if (!room) return null;

  const theme = room.theme;

  if (phase === 'pending-approval') {
    return (
      <CenteredState>
        <div className={cn(surface, 'max-w-md p-8 text-center')}>
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${theme.primary}25` }}
          >
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.secondary }} />
          </span>
          <h1 className="mt-5 text-xl tracking-tight">Waiting for the host</h1>
          <p className="mt-2 text-white/60">
            {room.host?.fullName ?? 'The host'} needs to let you into &ldquo;{room.name}&rdquo;.
            This page updates the moment they do.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/rooms')}
              className="rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
            >
              Leave
            </Button>
            <Button onClick={() => void requestToJoin()} className="rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]">
              Ask again
            </Button>
          </div>
        </div>
      </CenteredState>
    );
  }

  const seatsLeft = room.maxParticipants - room.participants.length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      {/* Ambient wash in the room's theme */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-96 opacity-20 blur-[100px]"
        style={{ background: `radial-gradient(circle at 50% 0%, ${theme.primary}, transparent 70%)` }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <button
          onClick={() => router.push('/rooms')}
          className={cn(
            'mb-8 inline-flex items-center gap-2 rounded-lg text-sm text-white/60 transition-colors hover:text-white',
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          All rooms
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Header */}
            <div className={cn(surface, 'overflow-hidden')}>
              <div className="relative h-40 bg-gradient-to-br from-white/10 to-transparent sm:h-52">
                {room.movie?.image && (
                  <Image
                    src={room.movie.image}
                    alt=""
                    fill
                    unoptimized
                    priority
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover opacity-40"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <Badge
                    className="mb-2 border-0 text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {room.type === 'private' ? 'Private room' : 'Public room'}
                  </Badge>
                  <h1 className="text-2xl tracking-tight sm:text-3xl">{room.name}</h1>
                  <p className="mt-1 text-white/60">{room.movie?.title}</p>
                </div>
              </div>
            </div>

            {/* Participants */}
            <section className={cn(surface, 'p-6')}>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg tracking-tight">
                  <Users className="h-4.5 w-4.5 text-white/50" />
                  In the room
                </h2>
                <span className="text-sm text-white/50">
                  {room.participants.length}/{room.maxParticipants}
                  {seatsLeft > 0 && ` · ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`}
                </span>
              </div>

              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {room.participants.map((participant) => {
                  const isRoomHost = participant._id === room.host?._id;
                  return (
                    <li
                      key={participant._id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                    >
                      <Avatar className="h-9 w-9 border border-white/15">
                        <AvatarImage src={participant.avatarUrl} alt="" />
                        <AvatarFallback
                          className="text-sm text-white"
                          style={{ backgroundColor: theme.primary }}
                        >
                          {initials(participant.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {participant.fullName ?? 'Guest'}
                          {participant._id === user?.userId && (
                            <span className="text-white/40"> (you)</span>
                          )}
                        </p>
                        {isRoomHost && <p className="text-xs text-white/40">Host</p>}
                      </div>
                    </li>
                  );
                })}

                {Array.from({ length: Math.max(0, seatsLeft) }).map((_, i) => (
                  <li
                    key={`empty-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-3"
                  >
                    <div className="h-9 w-9 rounded-full bg-white/5" />
                    <p className="text-sm text-white/30">Empty seat</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Join requests — host only. Same component the watch
                screen uses, so a request looks the same wherever it is seen. */}
            {isHost && <PendingRequests />}

          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <ShareCard code={room.code} roomId={room._id} />

            <InviteFriends roomId={room._id} />

            <div className={cn(surface, 'space-y-3 p-5')}>
              {isHost ? (
                <>
                  <Button
                    onClick={async () => {
                      setStarting(true);
                      await start();
                      setStarting(false);
                    }}
                    disabled={starting}
                    className="h-12 w-full rounded-xl text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4 fill-current" />
                        Start the session
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-white/40">
                    Everyone in the lobby moves to the film together.
                  </p>
                  <Button
                    onClick={() => void end()}
                    variant="outline"
                    className="h-10 w-full rounded-xl border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
                  >
                    End room
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-center text-sm text-white/60">
                    Waiting for {room.host?.fullName ?? 'the host'} to start.
                  </p>
                  <Button
                    onClick={() => void leave()}
                    variant="outline"
                    className="h-10 w-full rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave room
                  </Button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ShareCard({ code, roomId }: { code?: string; roomId: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const link = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/room/${roomId}`),
    [roomId],
  );

  const copy = async (value: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy. Select and copy it manually.');
    }
  };

  return (
    <div className={cn(surface, 'p-5')}>
      <h2 className="text-sm font-medium">Invite people</h2>

      {code && (
        <div className="mt-4">
          <p className="text-xs text-white/40">Room code</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-lg tracking-[0.2em]">
              {code}
            </code>
            <Button
              onClick={() => void copy(code, 'code')}
              variant="outline"
              className="h-12 w-12 shrink-0 rounded-xl border-white/15 bg-transparent p-0 text-white hover:bg-white/5"
              aria-label="Copy room code"
            >
              {copied === 'code' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={() => void copy(link, 'link')}
        variant="outline"
        className="mt-3 h-10 w-full rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
      >
        {copied === 'link' ? (
          <>
            <Check className="mr-2 h-4 w-4 text-emerald-400" />
            Link copied
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Copy invite link
          </>
        )}
      </Button>
    </div>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4 text-white">
      {children}
    </div>
  );
}
