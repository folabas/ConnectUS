'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Play, Star } from 'lucide-react';
import { cn, focusRing } from '@/lib/ui';
import type { Movie } from '@/types';

/**
 * Poster tile. Falls back to a generated gradient rather than a broken image
 * icon, since catalog artwork is frequently missing or 404s.
 */
export function MovieCard({
  movie,
  onSelect,
  priority = false,
}: {
  movie: Movie;
  onSelect(movie: Movie): void;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      onClick={() => onSelect(movie)}
      className={cn(
        'group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition-transform hover:-translate-y-1',
        focusRing,
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[var(--brand)]/30 to-[var(--surface)]">
        {movie.image && !failed ? (
          <Image
            src={movie.image}
            alt=""
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={() => setFailed(true)}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-center text-sm text-white/50">{movie.title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-ink)] shadow-lg">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="truncate text-sm font-medium text-white">{movie.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
            {movie.rating && movie.rating !== 'N/A' && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {movie.rating}
              </span>
            )}
            {movie.duration && movie.duration !== 'N/A' && <span>{movie.duration}</span>}
            {movie.year ? <span>{movie.year}</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="aspect-[2/3] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
  );
}
