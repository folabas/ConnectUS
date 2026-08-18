'use client';

/**
 * Join requests awaiting the host's decision.
 *
 * Previously these were surfaced only as a toast plus a panel in the lobby. Once
 * the host started the session and moved to the watch screen there was nowhere
 * left to see them, so a request arriving mid-film showed a toast for a few
 * seconds and then vanished — the person outside waited indefinitely while the
 * host had no idea they were there.
 *
 * This renders wherever the host is, and stays put until they accept or decline.
 */

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/providers/RoomProvider';
import { cn, formatRelative, initials, surface } from '@/lib/ui';

export function PendingRequests({
  variant = 'panel',
  className,
}: {
  /** `panel` for the lobby, `floating` for over the film. */
  variant?: 'panel' | 'floating';
  className?: string;
}) {
  const { pendingRequests, approve, reject } = useRoom();
  const [deciding, setDeciding] = useState<string | null>(null);

  if (pendingRequests.length === 0) return null;

  const decide = async (userId: string, action: 'approve' | 'reject') => {
    setDeciding(userId);
    try {
      await (action === 'approve' ? approve(userId) : reject(userId));
    } finally {
      setDeciding(null);
    }
  };

  return (
    <section
      aria-live="polite"
      className={cn(
        variant === 'panel'
          ? cn(surface, 'p-6')
          : 'rounded-2xl border border-[var(--brand)]/40 bg-[var(--surface)]/95 p-4 shadow-2xl backdrop-blur',
        className,
      )}
    >
      <h2
        className={cn(
          'tracking-tight',
          variant === 'panel' ? 'text-lg' : 'text-sm font-medium',
        )}
      >
        {pendingRequests.length === 1
          ? 'Someone wants to join'
          : `${pendingRequests.length} people want to join`}
      </h2>

      <ul className={cn('space-y-3', variant === 'panel' ? 'mt-4' : 'mt-3')}>
        {pendingRequests.map((request) => {
          const busy = deciding === request.user._id;
          const name = request.user.fullName ?? 'Guest';

          return (
            <li
              key={request.user._id}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
            >
              <Avatar className="h-9 w-9 border border-white/15">
                <AvatarImage src={request.user.avatarUrl} alt="" />
                <AvatarFallback className="bg-[var(--brand)] text-sm text-[var(--brand-ink)]">
                  {initials(request.user.fullName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{name}</p>
                <p className="text-xs text-white/40">
                  asked {formatRelative(request.requestedAt)}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void decide(request.user._id, 'approve')}
                  aria-label={`Let ${name} in`}
                  className="h-9 rounded-lg bg-emerald-600 px-3 hover:bg-emerald-500"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void decide(request.user._id, 'reject')}
                  aria-label={`Decline ${name}`}
                  className="h-9 rounded-lg border-white/15 bg-transparent px-3 text-white hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
