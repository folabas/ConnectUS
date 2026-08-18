/**
 * Shared visual vocabulary.
 *
 * The screens previously repeated the same long Tailwind strings (`bg-white/5
 * border-white/10 rounded-2xl` and friends) with small inconsistencies between
 * them — different radii on sibling cards, three shades of muted text. Naming
 * them once keeps the redesign coherent.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Kept for the few places that need a value rather than a class. */
export const BRAND = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  primary: 'var(--brand)',
  primaryHover: 'var(--brand-hover)',
  secondary: 'var(--brand-soft)',
  ink: 'var(--brand-ink)',
  accent: 'var(--accent)',
} as const;

/** Frosted panel used for cards, sidebars and modals. */
export const surface = 'bg-white/[0.04] border border-white/10 rounded-2xl';

/** Same, but interactive. */
export const surfaceHover =
  'bg-white/[0.04] border border-white/10 rounded-2xl transition-colors hover:bg-white/[0.07] hover:border-white/20';

/** Form fields. */
export const field =
  'h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/40 ' +
  'focus:border-[var(--brand)] focus:bg-white/[0.07] transition-colors';

export const textMuted = 'text-white/60';
export const textFaint = 'text-white/40';

/** Section heading used above content groups. */
export const sectionTitle = 'text-lg font-medium tracking-tight text-white';

/** Focus ring applied to bare buttons that are not shadcn `Button`s. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]';

/** Colour per room status, for badges. */
export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Lobby open', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  active: { label: 'Live', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  playing: { label: 'Watching now', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  finished: { label: 'Ended', className: 'bg-white/10 text-white/50 border-white/15' },
};

/** "2h 15m" from a seconds count. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** "just now", "4m ago", "2h ago". */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Initials for an avatar fallback. */
export function initials(name?: string, fallback = '?'): string {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
