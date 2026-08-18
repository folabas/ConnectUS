'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALLOWED_REACTIONS } from '@/lib/socket-events';
import { useSocket, useSocketEvent } from '@/providers/SocketProvider';
import { cn, focusRing } from '@/lib/ui';

interface FloatingReaction {
  key: number;
  emoji: string;
  /** Horizontal position as a percentage, so reactions do not stack in a column. */
  left: number;
}

/** Bounded so a reaction spammer cannot grow the array without limit. */
const MAX_ON_SCREEN = 24;
const LIFETIME_MS = 2600;

let nextKey = 0;

export function ReactionBar({
  roomId,
  themeColor,
}: {
  roomId: string;
  themeColor: string;
}) {
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);

  const send = (emoji: string) => {
    socket?.emit('reaction', { roomId, emoji });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Send a reaction"
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm transition-colors hover:bg-white/15',
          focusRing,
        )}
      >
        <span aria-hidden>🍿</span>
        <span className="hidden sm:inline">React</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/10 bg-[var(--surface)] p-2 shadow-xl"
          >
            {ALLOWED_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => send(emoji)}
                aria-label={`React with ${emoji}`}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-transform hover:scale-125',
                  focusRing,
                )}
                style={{ backgroundColor: `${themeColor}20` }}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Reactions drifting up over the film. */
export function ReactionOverlay({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = useCallback((emoji: string) => {
    const item: FloatingReaction = {
      key: nextKey++,
      emoji,
      left: 10 + Math.random() * 80,
    };
    setItems((current) => [...current, item].slice(-MAX_ON_SCREEN));

    const timer = setTimeout(() => {
      setItems((current) => current.filter((i) => i.key !== item.key));
    }, LIFETIME_MS);
    timers.current.push(timer);
  }, []);

  useSocketEvent('reaction', (payload) => {
    if (payload.roomId !== roomId) return;
    push(payload.emoji);
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((item) => (
          <motion.span
            key={item.key}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -220, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: LIFETIME_MS / 1000, ease: 'easeOut' }}
            style={{ left: `${item.left}%` }}
            className="absolute bottom-16 text-4xl"
          >
            {item.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
