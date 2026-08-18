'use client';

/**
 * Past sessions: what was watched, when, and with whom.
 *
 * "With whom" is drawn from the room's append-only `attendees` list rather than
 * `participants`, which is a live roster and is empty by the time a session
 * ends. Rooms created before that field existed fall back to whatever the
 * roster still holds, so their companion list may be short — that is a gap in
 * the old data, not in the query.
 */

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clapperboard, Loader2, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { errorMessage, roomApi } from '@/lib/api';
import { cn, focusRing, initials, surface } from '@/lib/ui';
import type { WatchHistoryEntry } from '@/types';

/** "14 March 2026" — unambiguous, and avoids locale-dependent day/month order. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "with Amara, Diego and 2 others" */
function describeCompany(companions: WatchHistoryEntry['companions']): string {
  const names = companions.map((c) => c.fullName).filter(Boolean) as string[];
  if (names.length === 0) return 'on your own';
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`;
  return `with ${names[0]}, ${names[1]} and ${names.length - 2} other${
    names.length - 2 === 1 ? '' : 's'
  }`;
}

export function WatchHistory() {
  const [entries, setEntries] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await roomApi.history());
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
    <section className={cn(surface, 'p-6')}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg tracking-tight">Watch history</h2>
        {entries.length > 0 && (
          <span className="text-sm text-white/40">
            {entries.length} session{entries.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-white/50">{error}</p>
          <Button
            onClick={load}
            className="mt-4 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
          >
            Try again
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Clapperboard className="h-9 w-9 text-white/20" />
          <p className="mt-4">No sessions yet</p>
          <p className="mt-1 max-w-xs text-sm text-white/50">
            Rooms you host or join will show up here, along with who watched with you.
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-white/5">
          {entries.map((entry) => (
            <li key={entry.roomId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
                {entry.movie?.image ? (
                  <Image
                    src={entry.movie.image}
                    alt=""
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Clapperboard className="h-5 w-5 text-white/20" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="truncate font-medium">
                    {entry.movie?.title ?? 'Film unavailable'}
                  </p>
                  {entry.youHosted && (
                    <span className="rounded border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-1.5 py-0.5 text-[10px] text-[var(--brand-soft)]">
                      You hosted
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate text-sm text-white/50">
                  {entry.name} · {formatDate(entry.watchedAt)}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  {entry.companions.length > 0 && (
                    <div className="flex -space-x-2">
                      {entry.companions.slice(0, 4).map((person) => (
                        <Avatar
                          key={person._id}
                          className="h-6 w-6 border border-[var(--surface)]"
                          title={person.fullName}
                        >
                          <AvatarImage src={person.avatarUrl} alt="" />
                          <AvatarFallback className="bg-[var(--brand)] text-[9px] text-[var(--brand-ink)]">
                            {initials(person.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                  <span className="flex items-center gap-1.5 truncate text-xs text-white/40">
                    <Users className="h-3 w-3 shrink-0" />
                    {describeCompany(entry.companions)}
                  </span>
                </div>
              </div>

              {/* A finished room cannot be rejoined, so only offer the link for
                  sessions that are still open. */}
              {entry.status !== 'finished' && (
                <Link
                  href={`/room/${entry.roomId}`}
                  className={cn(
                    'self-center rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/5 hover:text-white',
                    focusRing,
                  )}
                >
                  Rejoin
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
