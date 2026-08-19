'use client';

/**
 * Animated illustrations for the "How it works" three-step section.
 *
 * Each visual is a self-contained looping animation that demonstrates one step
 * of the product flow. They run entirely on transform/opacity so the compositor
 * handles them without a layout or paint pass.
 *
 * Under `prefers-reduced-motion` every visual renders at its resting state —
 * the same layout, but frozen.
 *
 * Each loop is also gated on visibility. These sit well below the fold, and
 * without that gate all three animated continuously while the reader was still
 * looking at the hero.
 *
 * No Lottie runtime, no canvas, no video files. Pure React + framer-motion,
 * matching everything else on the page.
 */

import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';
import { useEffect, useState } from 'react';
import { Film, Search, Play, Check, Users } from 'lucide-react';
import { EASE } from '@/lib/motion';
import { useInView } from '@/hooks/useInView';

/* ─────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────── */

function Avatar({
  color,
  initial,
  size = 28,
}: {
  color: string;
  initial: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-[var(--surface)] font-medium text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.38,
      }}
    >
      {initial}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 1 — "Choose the film"
───────────────────────────────────────────── */

const SEARCH_TEXT = 'Metropolis';
const FILMS = [
  { title: 'Metropolis', year: '1927', from: '#0f1622', to: '#3d5a80' },
  { title: 'Nosferatu', year: '1922', from: '#1b1410', to: '#6b4a2a' },
  { title: 'The General', year: '1926', from: '#1a1a12', to: '#7a7150' },
];

export function StepOneVisual() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const [rawPhase, setPhase] = useState<'typing' | 'results' | 'selected'>('typing');
  const [rawTyped, setTyped] = useState('');

  // Derived rather than stored. useReducedMotion returns null on the first
  // render and resolves after, so seeding state from it left these frozen
  // mid-animation — an empty search box that never filled.
  const phase = reduced ? 'selected' : rawPhase;
  const typed = reduced ? SEARCH_TEXT : rawTyped;

  useEffect(() => {
    if (reduced || !inView) return;

    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (typed.length < SEARCH_TEXT.length) {
        timeout = setTimeout(
          () => setTyped(SEARCH_TEXT.slice(0, typed.length + 1)),
          80,
        );
      } else {
        timeout = setTimeout(() => setPhase('results'), 400);
      }
    } else if (phase === 'results') {
      timeout = setTimeout(() => setPhase('selected'), 1200);
    } else if (phase === 'selected') {
      timeout = setTimeout(() => {
        setPhase('typing');
        setTyped('');
      }, 2400);
    }

    return () => clearTimeout(timeout);
  }, [phase, typed, reduced, inView]);

  const showResults = phase === 'results' || phase === 'selected';
  const selected = phase === 'selected' ? 0 : -1;

  return (
    <div ref={ref} className="relative flex flex-col gap-2.5">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[var(--surface)] px-3.5 py-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
        <span className="flex-1 text-sm text-white/85">
          {typed}
          {phase === 'typing' && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block h-3.5 w-0.5 bg-[var(--brand)] align-middle"
            />
          )}
        </span>
      </div>

      {/* Results list */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex flex-col gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] p-2"
          >
            {FILMS.map((film, i) => {
              const isSelected = i === selected;
              return (
                <motion.div
                  key={film.title}
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.28,
                    ease: EASE,
                    delay: reduced ? 0 : i * 0.07,
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                  style={{
                    background: isSelected
                      ? 'rgba(227,154,46,0.12)'
                      : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(227,154,46,0.25)' : 'transparent'}`,
                  }}
                >
                  <div
                    className="h-8 w-14 shrink-0 overflow-hidden rounded-md"
                    style={{
                      background: `linear-gradient(135deg, ${film.from}, ${film.to})`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/90">
                      {film.title}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {film.year} · public domain
                    </p>
                  </div>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]"
                      >
                        <Check className="h-2.5 w-2.5 text-[var(--brand-ink)]" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/30">
        <Film className="h-3 w-3" />
        Thousands of public-domain titles
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 2 — "Open the room"
───────────────────────────────────────────── */

const ROOM_CODE = 'WX7K2M';
const MEMBERS = [
  { initial: 'A', color: '#7c3aed' },
  { initial: 'D', color: '#0891b2' },
  { initial: 'R', color: '#c2410c' },
  { initial: 'Y', color: '#E39A2E' },
];

export function StepTwoVisual() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const [rawCodeVisible, setCodeVisible] = useState(false);
  const [rawVisibleCount, setVisibleCount] = useState(0);

  // Derived, for the same reason as step one.
  const codeVisible = reduced ? true : rawCodeVisible;
  const visibleCount = reduced ? MEMBERS.length : rawVisibleCount;

  useEffect(() => {
    if (reduced || !inView) return;

    // A set rather than an array: the cycle is recursive, so an append-only
    // list grew by six entries every loop and was never trimmed.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    function runCycle() {
      // 1. Show the code card
      later(() => setCodeVisible(true), 400);

      // 2. Members arrive one by one
      MEMBERS.forEach((_, i) => later(() => setVisibleCount(i + 1), 1000 + i * 520));

      // 3. Reset and loop
      later(() => {
        setCodeVisible(false);
        setVisibleCount(0);
        later(runCycle, 500);
      }, 1000 + MEMBERS.length * 520 + 2000);
    }

    runCycle();
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [reduced, inView]);

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {/* Room code card */}
      <AnimatePresence>
        {codeVisible && (
          <motion.div
            key="code"
            initial={reduced ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="rounded-xl border border-white/10 bg-[var(--surface)] p-4"
          >
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/30">
              Room code
            </p>
            <div className="flex gap-1.5">
              {ROOM_CODE.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduced ? 0 : 0.06 * i,
                    duration: 0.25,
                    ease: EASE,
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-sm font-semibold tracking-tight text-white/90"
                >
                  {char}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby row */}
      <div className="rounded-xl border border-white/10 bg-[var(--surface)] px-4 py-3.5">
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] text-white/35">
          <Users className="h-3 w-3" />
          <span>Waiting in the lobby</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {MEMBERS.slice(0, visibleCount).map((m, i) => (
              <motion.div
                key={m.initial}
                data-testid="lobby-avatar"
                initial={reduced ? false : { opacity: 0, scale: 0, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                style={{ marginLeft: i > 0 ? -8 : 0 }}
              >
                <Avatar color={m.color} initial={m.initial} />
              </motion.div>
            ))}
          </div>

          {visibleCount > 0 && visibleCount < MEMBERS.length && (
            <motion.span
              key="joining"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-white/40"
            >
              joining…
            </motion.span>
          )}

          {visibleCount === MEMBERS.length && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-[11px] text-emerald-400"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Everyone&apos;s here
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Step 3 — "Press play once"
───────────────────────────────────────────── */

const SCREEN_NAMES = ['You', 'Amara', 'Diego'];
const SCREEN_COLORS = ['var(--brand)', '#7c3aed', '#0891b2'];
const OFFSETS = [0.38, 0.28, 0.44];
const SYNCED_POS = 0.38;

function MiniScreen({
  name,
  color,
  progress,
  highlight,
}: {
  name: string;
  color: string;
  progress: number;
  highlight: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border transition-all duration-500"
      style={{
        borderColor: highlight
          ? 'rgba(227,154,46,0.4)'
          : 'rgba(255,255,255,0.1)',
        boxShadow: highlight ? '0 0 16px rgba(227,154,46,0.15)' : 'none',
      }}
    >
      <div className="relative aspect-video bg-[linear-gradient(135deg,#2b1508_0%,#7a3418_60%,#d97a2b_100%)]">
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-1.5">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={{ scaleX: progress }}
              style={{ originX: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-[var(--surface)] px-2 py-1">
        <span
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-medium text-white"
          style={{ background: color }}
        >
          {name[0]}
        </span>
        <span className="text-[9px] text-white/60">{name}</span>
      </div>
    </div>
  );
}

type Phase = 'offset' | 'syncing' | 'synced';

export function StepThreeVisual() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const [rawPhase, setPhase] = useState<Phase>('offset');
  const phase: Phase = reduced ? 'synced' : rawPhase;

  useEffect(() => {
    if (reduced || !inView) return;

    const durations: Record<Phase, number> = {
      offset: 1800,
      syncing: 800,
      synced: 2600,
    };
    const next: Record<Phase, Phase> = {
      offset: 'syncing',
      syncing: 'synced',
      synced: 'offset',
    };

    const t = setTimeout(() => setPhase((p) => next[p]), durations[phase]);
    return () => clearTimeout(t);
  }, [phase, reduced, inView]);

  const progresses =
    phase === 'synced' || phase === 'syncing'
      ? [SYNCED_POS, SYNCED_POS, SYNCED_POS]
      : OFFSETS;

  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {SCREEN_NAMES.map((name, i) => (
          <MiniScreen
            key={name}
            name={name}
            color={SCREEN_COLORS[i]}
            progress={progresses[i]}
            highlight={phase === 'synced' && i === 0}
          />
        ))}
      </div>

      {/* Status + play button */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--surface)] px-3.5 py-2.5">
        <AnimatePresence mode="wait">
          {phase === 'offset' && (
            <motion.div
              key="offset"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-[11px] text-white/40"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              Each screen at a different second
            </motion.div>
          )}

          {phase === 'syncing' && (
            <motion.div
              key="syncing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-[11px] text-white/60"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                className="inline-block h-3 w-3 rounded-full border border-current border-t-transparent"
              />
              Syncing…
            </motion.div>
          )}

          {phase === 'synced' && (
            <motion.div
              key="synced"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center gap-2 text-[11px] text-emerald-400"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              In sync · all on the same frame
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          animate={
            phase === 'syncing' ? { scale: [1, 0.85, 1.08, 1] } : { scale: 1 }
          }
          transition={
            phase === 'syncing'
              ? { duration: 0.4, ease: EASE }
              : { duration: 0.2 }
          }
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300"
          style={{
            background:
              phase === 'synced' ? 'var(--brand)' : 'rgba(255,255,255,0.08)',
          }}
          aria-label="Press play"
        >
          <Play
            className="h-3 w-3"
            style={{
              color: phase === 'synced' ? 'var(--brand-ink)' : 'white',
              marginLeft: 1,
            }}
            fill="currentColor"
          />
        </motion.button>
      </div>
    </div>
  );
}
