'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Compass, Loader2, Lock, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { errorMessage, roomApi } from '@/lib/api';
import { cn, STATUS_STYLES, surface, surfaceHover } from '@/lib/ui';
import type { Room } from '@/types';

const CODE_LENGTH = 6;

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRooms(await roomApi.listPublic());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-tight">Rooms</h1>
          <p className="mt-1 text-white/60">Join a public room, or enter a code you were sent.</p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          disabled={loading}
          className="h-10 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <JoinByCode />

      <section>
        <h2 className="mb-4 text-lg tracking-tight">Public rooms</h2>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        ) : error ? (
          <div className={cn(surface, 'px-6 py-12 text-center')}>
            <p>Could not load rooms</p>
            <p className="mt-1 text-sm text-white/50">{error}</p>
            <Button onClick={load} className="mt-5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]">
              Try again
            </Button>
          </div>
        ) : rooms.length === 0 ? (
          <div className={cn(surface, 'flex flex-col items-center px-6 py-16 text-center')}>
            <Compass className="h-10 w-10 text-white/20" />
            <p className="mt-4 text-lg">No public rooms right now</p>
            <p className="mt-1 max-w-sm text-sm text-white/50">
              Be the first — pick something from the library and open a room.
            </p>
            <Button
              onClick={() => router.push('/library')}
              className="mt-5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
            >
              Browse the library
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room._id} room={room} onOpen={() => router.push(`/room/${room._id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoomCard({ room, onOpen }: { room: Room; onOpen(): void }) {
  const status = STATUS_STYLES[room.status] ?? STATUS_STYLES.waiting;
  const full = room.participants.length >= room.maxParticipants;

  return (
    <button
      onClick={onOpen}
      disabled={full}
      className={cn(
        surfaceHover,
        'group flex w-full flex-col overflow-hidden text-left disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-[var(--brand)]/30 to-[var(--surface)]">
        {room.movie?.image && (
          <Image
            src={room.movie.image}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover opacity-50 transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span
          className={cn(
            'absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-xs',
            status.className,
          )}
        >
          {status.label}
        </span>
        {room.approvalRequired && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2.5 py-0.5 text-xs text-white/70">
            <Lock className="h-3 w-3" />
            Approval
          </span>
        )}
      </div>

      <div className="flex-1 p-4">
        <p className="truncate font-medium">{room.name}</p>
        <p className="mt-0.5 truncate text-sm text-white/50">
          {room.movie?.title ?? 'No film selected'}
        </p>

        <div className="mt-3 flex items-center justify-between text-sm text-white/60">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {room.participants.length}/{room.maxParticipants}
            {full && <span className="text-amber-300">· Full</span>}
          </span>
          <span className="truncate text-white/40">
            {room.host?.fullName ? `Hosted by ${room.host.fullName}` : ''}
          </span>
        </div>
      </div>
    </button>
  );
}

function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setJoining(true);
      try {
        const { room } = await roomApi.join({ code: value.toUpperCase() });
        router.push(`/room/${room._id}`);
      } catch (error) {
        toast.error(errorMessage(error));
        setCode('');
      } finally {
        setJoining(false);
      }
    },
    [router],
  );

  return (
    <section className={cn(surface, 'p-6')}>
      <h2 className="text-lg tracking-tight">Have a room code?</h2>
      <p className="mt-1 text-sm text-white/60">
        Six characters, from the host&apos;s invite.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <InputOTP
          maxLength={CODE_LENGTH}
          // Room codes are hex (crypto.randomBytes(...).toString('hex')), so they
          // contain A-F. input-otp defaults to inputMode="numeric", which puts a
          // number pad on phones and makes a code like BBEE43 impossible to type.
          inputMode="text"
          pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(value) => {
            const next = value.toUpperCase();
            setCode(next);
            if (next.length === CODE_LENGTH) void submit(next);
          }}
          disabled={joining}
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="h-12 w-11 border-white/15 bg-white/5 text-lg text-white"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {joining && (
          <span className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding the room…
          </span>
        )}
      </div>
    </section>
  );
}
