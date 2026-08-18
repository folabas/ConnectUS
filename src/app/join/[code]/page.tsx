'use client';

/**
 * Invite-link landing: `/join/ABC123`.
 *
 * Resolves the code to a room id and forwards to the room. Signed-out visitors
 * are sent to /auth with `next` pointing back here, so the link survives the
 * sign-up detour — previously this was stashed in a `redirectAfterAuth`
 * localStorage key that a second tab could clobber.
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage, roomApi } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { cn, surface } from '@/lib/ui';

export default function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { status } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'anonymous') {
      router.replace(`/auth?next=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }

    let cancelled = false;
    roomApi
      .join({ code: code.toUpperCase() })
      .then(({ room }) => !cancelled && router.replace(`/room/${room._id}`))
      .catch((err) => !cancelled && setError(errorMessage(err)));

    return () => {
      cancelled = true;
    };
  }, [status, code, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D0D0F] p-4 text-white">
      {error ? (
        <div className={cn(surface, 'max-w-md p-8 text-center')}>
          <h1 className="text-xl tracking-tight">That invite did not work</h1>
          <p className="mt-2 text-white/60">{error}</p>
          <Button
            onClick={() => router.push('/rooms')}
            className="mt-6 rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
          >
            Browse rooms instead
          </Button>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#695CFF]" />
          <p className="mt-4 text-sm text-white/50">Finding room {code.toUpperCase()}…</p>
        </div>
      )}
    </div>
  );
}
