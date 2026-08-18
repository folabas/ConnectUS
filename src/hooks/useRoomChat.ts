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

  // History is stored alongside the room it belongs to, so `loading` is derived
  // rather than being a second state set synchronously inside the effect. It
  // also means a room change cannot briefly show the previous room's messages.
  const [history, setHistory] = useState<{ roomId: string | null; messages: ChatMessage[] }>({
    roomId: null,
    messages: [],
  });

  const loading = history.roomId !== roomId;

  useEffect(() => {
    let cancelled = false;
    roomApi
      .messages(roomId)
      .then((loaded) => !cancelled && setHistory({ roomId, messages: loaded }))
      .catch(() => {
        // Start with an empty transcript rather than blocking the room.
        if (!cancelled) setHistory({ roomId, messages: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useSocketEvent('chat-message', (message) => {
    if (message.roomId !== roomId) return;
    setHistory((current) =>
      // Guard against a duplicate delivery on reconnect.
      current.messages.some((m) => m.id === message.id)
        ? current
        : { roomId, messages: [...current.messages, message] },
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

  return { messages: history.messages, loading, send };
}
