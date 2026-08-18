'use client';

/**
 * Blocks a subtree until the session is known.
 *
 * The important detail is that it waits for `status !== 'loading'` before
 * redirecting. Redirecting on `!user` alone would bounce every signed-in user to
 * /auth on a hard refresh, because the profile has not been resolved yet on the
 * first render.
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      // Preserve the destination in the URL rather than localStorage, so it
      // survives a different tab completing the sign-in.
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0F]">
        <Loader2 className="h-6 w-6 animate-spin text-[#695CFF]" aria-label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
}
