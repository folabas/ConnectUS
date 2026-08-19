'use client';

/**
 * What happens when the host walks away.
 *
 * Leaving used to be refused outright for hosts, because a room with no host is
 * unusable: nobody can start it, admit anyone, or end it. But "you may not
 * leave" is not an answer either — the host may simply be done while everyone
 * else is mid-film.
 *
 * So it is a choice: end it for everyone, or hand the remote to someone still
 * inside. With exactly one other person there is nothing to choose, so the
 * dialog says who inherits rather than asking.
 */

import { useState } from 'react';
import { Loader2, LogOut, UserCheck, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, focusRing, initials } from '@/lib/ui';
import type { RoomMember } from '@/types';

export function HostLeaveDialog({
  open,
  onOpenChange,
  others,
  onEndForEveryone,
  onHandOver,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Everyone in the room except the host. */
  others: RoomMember[];
  onEndForEveryone(): Promise<void> | void;
  onHandOver(successorId: string): Promise<void> | void;
}) {
  const [busy, setBusy] = useState<'end' | 'hand' | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const soleOther = others.length === 1 ? others[0] : null;
  const successor = soleOther?._id ?? chosen;

  const run = async (which: 'end' | 'hand') => {
    setBusy(which);
    try {
      if (which === 'end') await onEndForEveryone();
      else if (successor) await onHandOver(successor);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/10 bg-[var(--surface)] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Leaving the room</AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            {others.length === 0
              ? 'You are the only one here, so leaving ends the session.'
              : soleOther
                ? `You can end the session for everyone, or hand hosting to ${
                    soleOther.fullName ?? 'the other person'
                  } and slip out.`
                : 'You can end the session for everyone, or pick someone to take over as host.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Only ask when there is genuinely a choice to make. */}
        {others.length > 1 && (
          <div className="max-h-56 space-y-2 overflow-y-auto py-1">
            <p className="flex items-center gap-1.5 text-xs text-white/40">
              <Users className="h-3 w-3" />
              Hand hosting to
            </p>
            {others.map((person) => {
              const selected = chosen === person._id;
              return (
                <button
                  key={person._id}
                  onClick={() => setChosen(person._id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                    focusRing,
                    selected
                      ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                      : 'border-white/10 hover:border-white/20',
                  )}
                >
                  <Avatar className="h-8 w-8 border border-white/15">
                    <AvatarImage src={person.avatarUrl} alt="" />
                    <AvatarFallback className="bg-[var(--brand)] text-xs text-[var(--brand-ink)]">
                      {initials(person.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {person.fullName ?? 'Guest'}
                  </span>
                  {selected && <UserCheck className="h-4 w-4 text-[var(--brand-soft)]" />}
                </button>
              );
            })}
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          {others.length > 0 && (
            <Button
              onClick={() => void run('hand')}
              disabled={!successor || busy !== null}
              className="w-full rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
            >
              {busy === 'hand' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  {soleOther
                    ? `Leave — ${soleOther.fullName ?? 'they'} host${soleOther.fullName ? 's' : ''}`
                    : 'Leave and hand over'}
                </>
              )}
            </Button>
          )}

          <Button
            onClick={() => void run('end')}
            disabled={busy !== null}
            variant="outline"
            className="w-full rounded-xl border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
          >
            {busy === 'end' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'End the session for everyone'
            )}
          </Button>

          <AlertDialogCancel
            disabled={busy !== null}
            className="mt-0 w-full rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
          >
            Stay
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
