'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Mail, Send, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { errorMessage, friendApi, roomApi } from '@/lib/api';
import { cn, field, initials, surface } from '@/lib/ui';
import type { Friend } from '@/types';

/** Invite friends by account, or anyone else by email. */
export function InviteFriends({ roomId }: { roomId: string }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    friendApi
      .list()
      .then((result) => !cancelled && setFriends(result))
      .catch(() => {
        // An empty friend list is a fine fallback; the email path still works.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const invite = async (friend: Friend) => {
    setSending(friend.user.userId);
    try {
      await friendApi.inviteToRoom(friend.user.userId, roomId);
      setInvited((current) => new Set(current).add(friend.user.userId));
      toast.success(`Invited ${friend.user.fullName ?? 'your friend'}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(null);
    }
  };

  const inviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setEmailSending(true);
    try {
      await roomApi.inviteByEmail(roomId, [value]);
      toast.success(`Invitation sent to ${value}.`);
      setEmail('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEmailSending(false);
    }
  };

  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <div className={cn(surface, 'p-5')}>
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <UserPlus className="h-4 w-4 text-white/50" />
        Invite friends
      </h2>

      {loading ? (
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        </div>
      ) : accepted.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          No friends yet — invite by email below, or share the room code.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {accepted.map((friend) => {
            const done = invited.has(friend.user.userId);
            return (
              <li key={friend._id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-white/15">
                  <AvatarImage src={friend.user.avatarUrl} alt="" />
                  <AvatarFallback className="bg-[#695CFF] text-xs text-white">
                    {initials(friend.user.fullName || friend.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{friend.user.fullName ?? friend.user.email}</p>
                  {friend.user.onlineStatus === 'online' && (
                    <p className="text-xs text-emerald-400">Online</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={done || sending === friend.user.userId}
                  onClick={() => void invite(friend)}
                  className="h-8 shrink-0 rounded-lg border-white/15 bg-transparent px-3 text-xs text-white hover:bg-white/5"
                >
                  {sending === friend.user.userId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : done ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-emerald-400" />
                      Sent
                    </>
                  ) : (
                    'Invite'
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={inviteByEmail} className="mt-5 border-t border-white/5 pt-4">
        <label htmlFor="invite-email" className="text-xs text-white/40">
          Or invite by email
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={cn(field, 'h-10 pl-9 text-sm')}
            />
          </div>
          <Button
            type="submit"
            disabled={emailSending || !email.trim()}
            className="h-10 w-10 shrink-0 rounded-xl bg-[#695CFF] p-0 hover:bg-[#5a4de6]"
            aria-label="Send email invitation"
          >
            {emailSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
