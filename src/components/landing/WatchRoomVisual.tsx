'use client';

/**
 * WatchRoomVisual — hero illustration.
 *
 * Shows a live watch party: a film playing, three faces watching, and a chat
 * panel with messages arriving in real-time. Everything is DOM + framer-motion;
 * no canvas, no video, no external assets.
 *
 * Architecture:
 *   - The "film" is a CSS gradient + scanline animation (matches FilmReel)
 *   - The playhead is a CSS keyframe on the compositor (matches SyncVisual)
 *   - Chat messages enter with staggered spring reveals and auto-scroll
 *   - Reaction emojis float upward and fade with a transform animation
 *   - prefers-reduced-motion renders the full layout frozen at its peak state
 *   - the loop is gated on visibility, so scrolling past it stops the work
 *
 * Below 480px the chat panel is dropped. Side by side at 375px the film was
 * squeezed to 195px, which made the thing the hero is actually selling the
 * smallest element in it; without the panel it gets 320px.
 */

import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MessageCircle, Heart, Smile } from 'lucide-react';
import { EASE } from '@/lib/motion';
import { useInView } from '@/hooks/useInView';

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */

const VIEWERS = [
  { name: 'Amara', initial: 'A', color: '#7c3aed', mic: true },
  { name: 'Diego', initial: 'D', color: '#0891b2', mic: false },
  { name: 'Remi',  initial: 'R', color: '#c2410c', mic: true },
];

interface ChatMessage {
  id: number;
  author: string;
  color: string;
  text: string;
  delay: number; // ms after loop start
}

const MESSAGES: ChatMessage[] = [
  { id: 1,  author: 'Amara', color: '#7c3aed', text: 'this cinematography 😭',      delay: 800  },
  { id: 2,  author: 'Diego', color: '#0891b2', text: 'wait rewind that bit!!',       delay: 2200 },
  { id: 3,  author: 'Remi',  color: '#c2410c', text: 'the score is incredible',      delay: 3600 },
  { id: 4,  author: 'Amara', color: '#7c3aed', text: '🍿🍿🍿',                        delay: 5000 },
  { id: 5,  author: 'Diego', color: '#0891b2', text: 'who directed this again?',     delay: 6400 },
  { id: 6,  author: 'Remi',  color: '#c2410c', text: 'Fritz Lang — absolute genius', delay: 7600 },
  { id: 7,  author: 'Amara', color: '#7c3aed', text: 'ok I need to watch more',      delay: 9000 },
];

const LOOP_DURATION = 11_000; // ms before resetting

interface Reaction {
  id: number;
  emoji: string;
  x: number; // % from left of film
}

const REACTION_SCHEDULE: Array<{ emoji: string; delay: number; x: number }> = [
  { emoji: '❤️', delay: 1600,  x: 72 },
  { emoji: '😮', delay: 4200,  x: 55 },
  { emoji: '🍿', delay: 5200,  x: 80 },
  { emoji: '😭', delay: 8200,  x: 64 },
];

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

/** One viewer's face tile in the top bar */
function ViewerTile({
  viewer,
  delay,
}: {
  viewer: (typeof VIEWERS)[number];
  delay: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="flex flex-col items-center gap-1"
    >
      {/* Face tile */}
      <div
        className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 sm:h-12 sm:w-12"
        style={{ background: `${viewer.color}22` }}
      >
        {/* Subtle animated "video" noise */}
        <span
          className="text-sm font-semibold sm:text-base"
          style={{ color: viewer.color }}
        >
          {viewer.initial}
        </span>
        {/* Live dot */}
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      {/* Name + mic */}
      <div className="flex items-center gap-0.5">
        <span className="text-[9px] text-white/50 sm:text-[10px]">{viewer.name}</span>
        {viewer.mic ? (
          <Mic className="h-2 w-2 text-emerald-400" />
        ) : (
          <MicOff className="h-2 w-2 text-white/25" />
        )}
      </div>
    </motion.div>
  );
}

/** A floating reaction emoji that rises and fades */
function FloatingReaction({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) {
  return (
    <motion.span
      key={reaction.id}
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{ opacity: 0, y: -52, scale: 1.2 }}
      transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
      className="pointer-events-none absolute bottom-10 select-none text-xl"
      style={{ left: `${reaction.x}%` }}
    >
      {reaction.emoji}
    </motion.span>
  );
}

/** A single chat bubble */
function ChatBubble({ msg }: { msg: ChatMessage }) {
  return (
    <motion.div
      data-testid="chat-line"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex items-start gap-2"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
        style={{ background: msg.color }}
      >
        {msg.author[0]}
      </span>
      <div className="min-w-0">
        <span className="text-[10px] font-medium" style={{ color: msg.color }}>
          {msg.author}
        </span>
        <p className="text-[11px] leading-snug text-white/75 sm:text-xs">{msg.text}</p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Main visual
───────────────────────────────────────────── */

export function WatchRoomVisual({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const chatRef = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView<HTMLDivElement>();

  const [rawMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Derived rather than stored: useReducedMotion resolves after the first
  // render, so seeding state from it left the chat permanently empty for
  // anyone with the preference set.
  const visibleMessages = reduced ? MESSAGES : rawMessages;

  /* ── Animation loop ── */
  useEffect(() => {
    if (reduced || !inView) return;

    // A set rather than an array: the cycle is recursive, so an append-only
    // list grew by a dozen entries every eleven seconds and was never trimmed.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    let reactionCounter = 0;

    function runCycle() {
      setVisibleMessages([]);
      setReactions([]);

      MESSAGES.forEach((msg) => {
        later(() => setVisibleMessages((prev) => [...prev, msg]), msg.delay);
      });

      REACTION_SCHEDULE.forEach((r) => {
        later(() => {
          reactionCounter += 1;
          setReactions((prev) => [
            ...prev,
            { id: reactionCounter, emoji: r.emoji, x: r.x },
          ]);
        }, r.delay);
      });

      later(runCycle, LOOP_DURATION);
    }

    runCycle();
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [reduced, inView]);

  /* ── Auto-scroll chat to bottom ── */
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [visibleMessages, reduced]);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
      ref={ref}
      className={`relative mx-auto w-full max-w-xl ${className ?? ''}`}
      aria-hidden="true"
    >
      {/* Ambient glow behind the card */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[var(--brand)]/8 blur-3xl" />

      {/* ── Main room card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] shadow-2xl">

        {/* ── Top bar: room name + viewer tiles ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium text-white/60 sm:text-xs">
              Movie Night · 4 watching
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {VIEWERS.map((v, i) => (
              <ViewerTile key={v.name} viewer={v} delay={0.5 + i * 0.1} />
            ))}
          </div>
        </div>

        {/* ── Main content: film + chat side-by-side ── */}
        <div className="flex">

          {/* ── Film player (left, wider) ── */}
          <div className="relative flex-1">
            {/* The film frame */}
            <div className="relative aspect-video bg-[linear-gradient(135deg,#2b1508_0%,#7a3418_38%,#d97a2b_68%,#f7d9a0_100%)]">
              {/* Scene elements */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#170b04] to-transparent" />
              <div className="absolute bottom-[32%] left-1/2 h-10 w-10 -translate-x-1/2 rounded-full bg-[#fff1d0] opacity-90 blur-[3px]" />
              {/* Horizon silhouette */}
              <div className="absolute bottom-[28%] inset-x-0 h-px bg-black/30" />

              {/* Scanline effect */}
              <div className="scanline pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />

              {/* Floating reactions */}
              <AnimatePresence>
                {reactions.map((r) => (
                  <FloatingReaction
                    key={r.id}
                    reaction={r}
                    onDone={() =>
                      setReactions((prev) => prev.filter((x) => x.id !== r.id))
                    }
                  />
                ))}
              </AnimatePresence>

              {/* Player controls bar */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 sm:px-3">
                {/* Progress bar — uses the existing playhead keyframe */}
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className={
                      reduced
                        ? 'h-full w-[38%] rounded-full bg-white'
                        : 'h-full w-full origin-left rounded-full bg-white animate-[playhead_9s_ease-in-out_infinite]'
                    }
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-white/50 sm:text-[10px]">
                  <span>in sync · 4 watching</span>
                  <span>1:24:06</span>
                </div>
              </div>
            </div>

            {/* Film title strip */}
            <div className="border-t border-white/[0.06] bg-[var(--elevated)] px-3 py-1.5">
              <p className="text-[10px] text-white/40">Metropolis <span className="text-white/20">· 1927 · Fritz Lang</span></p>
            </div>
          </div>

          {/* ── Chat panel (right, narrower) ── */}
          <div className="hidden w-[130px] flex-col border-l border-white/[0.06] min-[480px]:flex sm:w-[150px]">
            {/* Chat header */}
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-2.5 py-2">
              <MessageCircle className="h-3 w-3 text-[var(--brand-soft)]" />
              <span className="text-[10px] text-white/40">Chat</span>
            </div>

            {/* Message list */}
            <div
              ref={chatRef}
              className="flex flex-1 flex-col gap-2.5 overflow-hidden px-2.5 py-2.5"
              style={{ maxHeight: 160 }}
            >
              <AnimatePresence initial={false}>
                {visibleMessages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>
            </div>

            {/* Chat input */}
            <div className="border-t border-white/[0.06] px-2 py-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <span className="flex-1 text-[9px] text-white/20">Message…</span>
                <Smile className="h-3 w-3 text-white/20" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Reaction bar ── */}
        <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2 sm:px-4">
          <span className="text-[10px] text-white/30">React</span>
          {['❤️', '😮', '😂', '🍿', '👏'].map((emoji) => (
            <motion.button
              key={emoji}
              type="button"
              whileHover={reduced ? {} : { scale: 1.25 }}
              whileTap={reduced ? {} : { scale: 0.9 }}
              className="text-sm leading-none"
            >
              {emoji}
            </motion.button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Heart className="h-3 w-3 text-[var(--brand-soft)]" />
            <span className="text-[10px] text-white/30">12</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
