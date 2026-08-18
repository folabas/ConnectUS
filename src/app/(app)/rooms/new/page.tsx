'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Check, Globe, Loader2, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { errorMessage, movieApi, roomApi } from '@/lib/api';
import { cn, field, focusRing, surface } from '@/lib/ui';
import { ROOM_THEMES, type Movie, type RoomTheme, type RoomType } from '@/types';

function CreateRoomForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const movieId = searchParams.get('movie');

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loadingMovie, setLoadingMovie] = useState(Boolean(movieId));
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('private');
  const [theme, setTheme] = useState<RoomTheme>(ROOM_THEMES[0]);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [startTime, setStartTime] = useState('');

  useEffect(() => {
    if (!movieId) return;
    let cancelled = false;
    movieApi
      .get(movieId)
      .then((result) => {
        if (cancelled) return;
        setMovie(result);
        setName((current) => current || `${result.title} watch party`);
      })
      .catch((error) => !cancelled && toast.error(errorMessage(error)))
      .finally(() => !cancelled && setLoadingMovie(false));
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setNameError('Give the room a name.');
      return;
    }
    if (!movieId) {
      toast.error('Pick a film from the library first.');
      router.push('/library');
      return;
    }

    setSubmitting(true);
    try {
      const room = await roomApi.create({
        name: name.trim(),
        movieId,
        type,
        theme,
        maxParticipants,
        adminEnabled,
        approvalRequired,
        startTime: startTime || undefined,
      });
      toast.success('Room created.');
      router.push(`/room/${room._id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!movieId) {
    return (
      <div className={cn(surface, 'flex flex-col items-center px-6 py-16 text-center')}>
        <p className="text-lg">Choose a film first</p>
        <p className="mt-1 max-w-sm text-sm text-white/50">
          Every room is built around one film. Pick one and the room settings come next.
        </p>
        <Button
          onClick={() => router.push('/library')}
          className="mt-5 rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
        >
          Browse the library
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h1 className="text-3xl tracking-tight">Host a room</h1>
        <p className="mt-1 text-white/60">Set it up once — you can start whenever everyone lands.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Basics */}
          <section className={cn(surface, 'space-y-5 p-6')}>
            <div className="space-y-1.5">
              <Label htmlFor="room-name" className="text-sm text-white/70">
                Room name
              </Label>
              <Input
                id="room-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                maxLength={60}
                placeholder="Friday night sci-fi"
                aria-invalid={Boolean(nameError)}
                className={field}
              />
              {nameError && (
                <p role="alert" className="text-sm text-red-400">
                  {nameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-white/70">Who can join</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <VisibilityOption
                  selected={type === 'private'}
                  onSelect={() => setType('private')}
                  icon={Lock}
                  title="Private"
                  body="Only people with the code or an invite."
                />
                <VisibilityOption
                  selected={type === 'public'}
                  onSelect={() => setType('public')}
                  icon={Globe}
                  title="Public"
                  body="Listed publicly for anyone to find."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-sm text-white/70">
                Start time <span className="text-white/40">(optional)</span>
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={cn(field, '[color-scheme:dark]')}
              />
              <p className="text-xs text-white/40">
                Leave blank to open the lobby now. A future time schedules the room and
                notifies everyone who joins.
              </p>
            </div>
          </section>

          {/* Controls */}
          <section className={cn(surface, 'space-y-5 p-6')}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="capacity" className="text-sm text-white/70">
                  Capacity
                </Label>
                <span className="flex items-center gap-1.5 text-sm text-white/60">
                  <Users className="h-3.5 w-3.5" />
                  {maxParticipants} people
                </span>
              </div>
              <Slider
                id="capacity"
                min={2}
                max={10}
                step={1}
                value={[maxParticipants]}
                onValueChange={([value]) => setMaxParticipants(value)}
              />
            </div>

            <ToggleRow
              id="admin-enabled"
              checked={adminEnabled}
              onChange={setAdminEnabled}
              title="Host controls playback"
              body="Only you can play, pause and seek. Turn off to let anyone drive."
            />

            <ToggleRow
              id="approval-required"
              checked={approvalRequired}
              onChange={setApprovalRequired}
              title="Approve each person"
              body="Arrivals wait in the lobby until you let them in."
            />
          </section>

          {/* Theme */}
          <section className={cn(surface, 'p-6')}>
            <Label className="text-sm text-white/70">Room theme</Label>
            <div className="mt-3 flex flex-wrap gap-3">
              {ROOM_THEMES.map((option) => {
                const selected = option.name === theme.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setTheme(option)}
                    aria-pressed={selected}
                    aria-label={option.name}
                    className={cn(
                      'relative h-12 w-12 rounded-xl transition-transform hover:scale-105',
                      focusRing,
                      selected && 'ring-2 ring-white ring-offset-2 ring-offset-[#0D0D0F]',
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${option.primary}, ${option.secondary})`,
                    }}
                  >
                    {selected && (
                      <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-white/40">{theme.name}</p>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className={cn(surface, 'overflow-hidden')}>
            <div className="relative aspect-video bg-gradient-to-br from-[#695CFF]/30 to-[#141417]">
              {loadingMovie ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : (
                movie?.image && (
                  <Image src={movie.image} alt="" fill unoptimized className="object-cover" />
                )
              )}
            </div>

            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40">Now showing</p>
                <p className="mt-1 truncate font-medium">{movie?.title ?? 'Loading…'}</p>
                {movie && (
                  <p className="mt-0.5 text-sm text-white/50">
                    {[movie.genre, movie.duration].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/library')}
                className="h-10 w-full rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                Change film
              </Button>

              <Button
                type="submit"
                disabled={submitting || loadingMovie}
                className="h-12 w-full rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
                style={{ backgroundColor: theme.primary }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create room'}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

function VisibilityOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect(): void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-4 text-left transition-colors',
        focusRing,
        selected
          ? 'border-[#695CFF] bg-[#695CFF]/10'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20',
      )}
    >
      <Icon className={cn('h-4.5 w-4.5', selected ? 'text-[#8B7FFF]' : 'text-white/50')} />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/50">{body}</p>
    </button>
  );
}

function ToggleRow({
  id,
  checked,
  onChange,
  title,
  body,
}: {
  id: string;
  checked: boolean;
  onChange(value: boolean): void;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {title}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{body}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

export default function CreateRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#695CFF]" />
        </div>
      }
    >
      <CreateRoomForm />
    </Suspense>
  );
}
