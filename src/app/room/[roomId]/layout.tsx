'use client';

import { use } from 'react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { RoomProvider } from '@/providers/RoomProvider';

/**
 * The room subtree lives outside the `(app)` group: the lobby and watch screens
 * are immersive and draw their own chrome, but they still need a session.
 */
export default function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  return (
    <AuthGuard>
      <RoomProvider roomId={roomId}>{children}</RoomProvider>
    </AuthGuard>
  );
}
