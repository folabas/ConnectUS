'use client';

/**
 * Room chat.
 *
 * The PRD says messages persist; previously they were fire-and-forget socket
 * payloads that vanished on refresh and were echoed locally with no server
 * round-trip. History now loads over HTTP and live messages arrive over the
 * socket, including the sender's own — the server is the single ordering
 * authority, so two people typing at once see the same transcript.
 */

import { useCallback, useEffect, useState } from 'react';
import { roomApi } from '@/lib/api';
import { MAX_CHAT_LENGTH } from '@/lib/socket-events';
import { useSocket, useSocketEvent } from '@/providers/SocketProvider';
import type { ChatMessage } from '@/types';

export function useRoomChat(roomId: string) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    roomApi
      .messages(roomId)
      .then((history) => !cancelled && setMessages(history))
      .catch(() => {
        // Start with an empty transcript rather than blocking the room.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useSocketEvent('chat-message', (message) => {
    if (message.roomId !== roomId) return;
    setMessages((current) =>
      // Guard against a duplicate delivery on reconnect.
      current.some((m) => m.id === message.id) ? current : [...current, message],
    );
  });

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !socket) return false;
      socket.emit('chat-message', { roomId, text: trimmed.slice(0, MAX_CHAT_LENGTH) });
      return true;
    },
    [socket, roomId],
  );

  return { messages, loading, send };
}
