'use client';

/**
 * The room code, kept visible during the session.
 *
 * It was only shown in the lobby, so once the film started there was no way to
 * invite anyone without leaving the room — which is precisely when someone
 * texts asking to be let in.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn, focusRing } from '@/lib/ui';

export function RoomCodeBadge({
  code,
  roomId,
  className,
}: {
  code?: string;
  roomId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Public rooms have no code; the link is the only way in.
  const value = code ?? '';
  const label = code ? `Room code ${code}` : 'Copy invite link';

  const copy = async () => {
    const text = code
      ? code
      : typeof window === 'undefined'
        ? ''
        : `${window.location.origin}/room/${roomId}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(code ? 'Room code copied.' : 'Invite link copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select it and copy manually.');
    }
  };

  return (
    <button
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:border-white/20 hover:bg-white/[0.08]',
        focusRing,
        className,
      )}
    >
      {value ? (
        <>
          <span className="hidden text-[10px] uppercase tracking-wide text-white/40 sm:inline">
            Code
          </span>
          <code className="font-mono text-sm tracking-[0.15em] text-white">{value}</code>
        </>
      ) : (
        <span className="text-xs text-white/70">Invite link</span>
      )}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-white/50" />
      )}
    </button>
  );
}
