'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRoomChat } from '@/hooks/useRoomChat';
import { MAX_CHAT_LENGTH } from '@/lib/socket-events';
import { cn, field, initials } from '@/lib/ui';
import type { RoomTheme } from '@/types';

export function RoomChat({
  roomId,
  currentUserId,
  theme,
}: {
  roomId: string;
  currentUserId?: string;
  theme: RoomTheme;
}) {
  const { messages, loading, send } = useRoomChat(roomId);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the conversation, but don't yank someone out of the backlog they are
  // reading.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (send(draft)) setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            No messages yet. Say something.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.userId === currentUserId;
            return (
              <div
                key={message.id}
                className={cn('flex gap-2.5', mine && 'flex-row-reverse')}
              >
                <Avatar className="h-7 w-7 shrink-0 border border-white/10">
                  <AvatarFallback
                    className="text-[10px] text-white"
                    style={{ backgroundColor: mine ? theme.primary : '#3a3a42' }}
                  >
                    {initials(message.userName)}
                  </AvatarFallback>
                </Avatar>

                <div className={cn('min-w-0 max-w-[80%]', mine && 'text-right')}>
                  {!mine && (
                    <p className="mb-0.5 truncate text-xs text-white/40">
                      {message.userName ?? 'Guest'}
                    </p>
                  )}
                  <p
                    className={cn(
                      'inline-block break-words rounded-2xl px-3 py-2 text-sm',
                      mine ? 'text-white' : 'bg-white/[0.07] text-white/90',
                    )}
                    style={mine ? { backgroundColor: theme.primary } : undefined}
                  >
                    {message.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Message the room"
          aria-label="Message the room"
          className={cn(field, 'h-10 flex-1 text-sm')}
        />
        <Button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="h-10 w-10 shrink-0 rounded-xl p-0"
          style={{ backgroundColor: theme.primary }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
