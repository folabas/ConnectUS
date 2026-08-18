'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Clapperboard, Download, Loader2, Play, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MovieCard, MovieCardSkeleton } from '@/components/movies/MovieCard';
import { errorMessage, movieApi } from '@/lib/api';
import { cn, field, surface } from '@/lib/ui';
import type { Movie } from '@/types';

const GENRES = ['All', 'Sci-Fi', 'Action', 'Drama', 'Thriller', 'Comedy', 'Documentary'];

/** Debounce so typing does not fire a request per keystroke. */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function LibraryPage() {
  const router = useRouter();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [genre, setGenre] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Movie | null>(null);

  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setMovies(await movieApi.list({ genre, search: debouncedSearch }));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [genre, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const host = (movie: Movie) => router.push(`/rooms/new?movie=${movie._id}`);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl tracking-tight">Library</h1>
        <p className="mt-1 text-white/60">Pick a film, then open a room around it.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles"
            aria-label="Search the library"
            className={cn(field, 'pl-10 pr-10')}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Tabs value={genre} onValueChange={setGenre}>
          <TabsList className="h-auto flex-wrap justify-start border border-white/10 bg-white/[0.04] p-1">
            {GENRES.map((g) => (
              <TabsTrigger
                key={g}
                value={g}
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-[#695CFF] data-[state=active]:text-white"
              >
                {g}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : movies.length === 0 ? (
        <EmptyState search={debouncedSearch} onClear={() => { setSearch(''); setGenre('All'); }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {movies.map((movie, index) => (
            <MovieCard
              key={movie._id}
              movie={movie}
              priority={index < 5}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <CatalogSearch onImported={(movie) => { void load(); setSelected(movie); }} />

      <MovieDetail movie={selected} onClose={() => setSelected(null)} onHost={host} />
    </div>
  );
}

function MovieDetail({
  movie,
  onClose,
  onHost,
}: {
  movie: Movie | null;
  onClose(): void;
  onHost(movie: Movie): void;
}) {
  return (
    <Sheet open={Boolean(movie)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-[#141417] text-white sm:max-w-md"
      >
        {movie && (
          <>
            <SheetTitle className="sr-only">{movie.title}</SheetTitle>
            <div className="space-y-5 overflow-y-auto p-6">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#695CFF]/30 to-[#141417]">
                {movie.image && (
                  <Image src={movie.image} alt="" fill unoptimized className="object-cover" />
                )}
              </div>

              <div>
                <h2 className="text-2xl tracking-tight">{movie.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/60">
                  {movie.rating && movie.rating !== 'N/A' && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {movie.rating}
                    </span>
                  )}
                  {movie.duration && movie.duration !== 'N/A' && <span>{movie.duration}</span>}
                  {movie.year ? <span>{movie.year}</span> : null}
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">
                    {movie.genre}
                  </span>
                </div>
              </div>

              {movie.description && (
                <p className="leading-relaxed text-white/70">{movie.description}</p>
              )}

              <Button
                onClick={() => onHost(movie)}
                className="h-12 w-full rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
              >
                <Play className="mr-2 h-4 w-4" />
                Host a room with this
              </Button>

              {movie.source === 'archive' && (
                <p className="text-xs leading-relaxed text-white/40">
                  Streamed from the Internet Archive under a public-domain or open licence.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Pull titles from the Internet Archive that are not in the library yet. */
function CatalogSearch({ onImported }: { onImported(movie: Movie): void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await movieApi.searchCatalog(query.trim()));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const add = async (movie: Movie) => {
    const identifier = movie._id;
    setImporting(identifier);
    try {
      const imported = await movieApi.importFromCatalog(identifier);
      toast.success(`Added "${imported.title}" to the library.`);
      onImported(imported);
      setResults((current) => current?.filter((m) => m._id !== identifier) ?? null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(null);
    }
  };

  return (
    <section className={cn(surface, 'p-6')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#695CFF]/15">
          <Clapperboard className="h-5 w-5 text-[#8B7FFF]" />
        </span>
        <div>
          <h2 className="text-lg tracking-tight">Add from the public-domain archive</h2>
          <p className="mt-1 text-sm text-white/60">
            Search tens of thousands of freely licensed films and add one to your library.
          </p>
        </div>
      </div>

      <form onSubmit={run} className="mt-5 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Nosferatu, Charade, His Girl Friday"
          aria-label="Search the public-domain archive"
          className={cn(field, 'flex-1')}
        />
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-12 shrink-0 rounded-xl bg-[#695CFF] px-5 hover:bg-[#5a4de6]"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {results && (
        <div className="mt-5">
          {results.length === 0 ? (
            <p className="text-sm text-white/50">
              No streamable matches. Try a different or shorter title.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {results.map((movie) => (
                <li key={movie._id} className="flex items-center gap-4 py-3">
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {movie.image && (
                      <Image src={movie.image} alt="" fill unoptimized className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{movie.title}</p>
                    <p className="truncate text-xs text-white/50">
                      {[movie.year, movie.duration].filter(Boolean).join(' · ') || 'Archive'}
                    </p>
                  </div>
                  <Button
                    onClick={() => void add(movie)}
                    disabled={importing === movie._id}
                    variant="outline"
                    className="h-9 shrink-0 rounded-lg border-white/15 bg-transparent text-white hover:bg-white/5"
                  >
                    {importing === movie._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Add
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyState({ search, onClear }: { search: string; onClear(): void }) {
  return (
    <div className={cn(surface, 'flex flex-col items-center px-6 py-16 text-center')}>
      <Clapperboard className="h-10 w-10 text-white/20" />
      <p className="mt-4 text-lg">
        {search ? `Nothing matching "${search}"` : 'The library is empty'}
      </p>
      <p className="mt-1 max-w-sm text-sm text-white/50">
        {search
          ? 'Try a different search, or pull the title in from the public-domain archive below.'
          : 'Add a film from the public-domain archive below to get started.'}
      </p>
      {search && (
        <Button
          onClick={onClear}
          variant="outline"
          className="mt-5 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className={cn(surface, 'flex flex-col items-center px-6 py-16 text-center')}>
      <p className="text-lg">Could not load the library</p>
      <p className="mt-1 max-w-sm text-sm text-white/50">{message}</p>
      <Button
        onClick={onRetry}
        className="mt-5 rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
      >
        Try again
      </Button>
    </div>
  );
}
