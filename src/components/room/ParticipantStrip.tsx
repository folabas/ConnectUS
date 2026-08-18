'use client';

import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/ui';
import type { Peer } from '@/hooks/useWebRTC';
import type { Room } from '@/types';

/** Attaches a MediaStream to a video element; `<video src>` cannot take one. */
function StreamTile({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="h-full w-full object-cover"
    />
  );
}

export function ParticipantStrip({
  room,
  peers,
  localStream,
  currentUserId,
}: {
  room: Room;
  peers: Peer[];
  localStream: MediaStream | null;
  currentUserId?: string;
}) {
  const streamBySocket = new Map(peers.map((peer) => [peer.userId, peer.stream]));

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {room.participants.map((participant) => {
        const isMe = participant._id === currentUserId;
        const stream = isMe ? localStream : streamBySocket.get(participant._id);
        const isRoomHost = participant._id === room.host?._id;

        return (
          <div
            key={participant._id}
            className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
          >
            {stream ? (
              <StreamTile stream={stream} muted={isMe} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Avatar className="h-12 w-12 border border-white/15">
                  <AvatarImage src={participant.avatarUrl} alt="" />
                  <AvatarFallback
                    className="text-white"
                    style={{ backgroundColor: room.theme.primary }}
                  >
                    {initials(participant.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <VideoOff className="h-3 w-3" />
                  Camera off
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              <span className="truncate text-xs text-white">
                {participant.fullName ?? 'Guest'}
                {isMe && ' (you)'}
              </span>
              {isRoomHost && (
                <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white/80">
                  Host
                </span>
              )}
              {isMe && !localStream && <MicOff className="ml-auto h-3 w-3 text-white/50" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
