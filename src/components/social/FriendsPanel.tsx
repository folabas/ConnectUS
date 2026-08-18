'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage, friendApi } from '@/lib/api';
import { useSocketEvent } from '@/providers/SocketProvider';
import { cn, field, initials, surface } from '@/lib/ui';
import type { Friend, User } from '@/types';

export function FriendsPanel() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [all, requests] = await Promise.all([friendApi.list(), friendApi.pending()]);
      setFriends(all);
      setPending(requests);
    } catch {
      // Leave the last known list in place.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Presence flips without a refresh.
  useSocketEvent('friend-online', ({ userId }) =>
    setFriends((current) =>
      current.map((f) =>
        f.user.userId === userId ? { ...f, user: { ...f.user, onlineStatus: 'online' } } : f,
      ),
    ),
  );

  useSocketEvent('friend-offline', ({ userId }) =>
    setFriends((current) =>
      current.map((f) =>
        f.user.userId === userId ? { ...f, user: { ...f.user, onlineStatus: 'offline' } } : f,
      ),
    ),
  );

  const respond = async (friendshipId: string, action: 'accept' | 'reject') => {
    try {
      await (action === 'accept'
        ? friendApi.accept(friendshipId)
        : friendApi.reject(friendshipId));
      await load();
      toast.success(action === 'accept' ? 'Friend added.' : 'Request declined.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <section className={cn(surface, 'p-6')}>
      <h2 className="text-lg tracking-tight">Friends</h2>

      <Tabs defaultValue="friends" className="mt-4">
        <TabsList className="border border-white/10 bg-white/[0.04]">
          <TabsTrigger value="friends" className="data-[state=active]:bg-[#695CFF]">
            All ({accepted.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-[#695CFF]">
            Requests ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-[#695CFF]">
            Add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : accepted.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              No friends yet. Search for someone in the Add tab.
            </p>
          ) : (
            <ul className="space-y-2">
              {accepted.map((friend) => (
                <li
                  key={friend._id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-white/15">
                      <AvatarImage src={friend.user.avatarUrl} alt="" />
                      <AvatarFallback className="bg-[#695CFF] text-sm text-white">
                        {initials(friend.user.fullName || friend.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    {friend.user.onlineStatus === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#141417] bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {friend.user.fullName ?? friend.user.email}
                    </p>
                    <p className="text-xs text-white/40">
                      {friend.user.onlineStatus === 'online' ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {pending.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">No pending requests.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((request) => (
                <li
                  key={request._id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                >
                  <Avatar className="h-9 w-9 border border-white/15">
                    <AvatarImage src={request.user.avatarUrl} alt="" />
                    <AvatarFallback className="bg-[#695CFF] text-sm text-white">
                      {initials(request.user.fullName || request.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {request.user.fullName ?? request.user.email}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void respond(request._id, 'accept')}
                      className="h-8 rounded-lg bg-emerald-600 px-2 hover:bg-emerald-500"
                      aria-label="Accept request"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void respond(request._id, 'reject')}
                      className="h-8 rounded-lg border-white/15 bg-transparent px-2 text-white hover:bg-white/5"
                      aria-label="Decline request"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <AddFriend onAdded={load} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function AddFriend({ onAdded }: { onAdded(): void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await friendApi.search(query.trim()));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const add = async (user: User) => {
    try {
      await friendApi.sendRequest(user.userId);
      setSent((current) => new Set(current).add(user.userId));
      toast.success('Friend request sent.');
      onAdded();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search for people"
            className={cn(field, 'pl-10')}
          />
        </div>
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-12 rounded-xl bg-[#695CFF] px-5 hover:bg-[#5a4de6]"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {results && (
        <ul className="mt-4 space-y-2">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No one matched that.</p>
          ) : (
            results.map((user) => (
              <li
                key={user.userId}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                <Avatar className="h-9 w-9 border border-white/15">
                  <AvatarImage src={user.avatarUrl} alt="" />
                  <AvatarFallback className="bg-[#695CFF] text-sm text-white">
                    {initials(user.fullName || user.email)}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm">{user.fullName ?? user.email}</p>
                <Button
                  size="sm"
                  disabled={sent.has(user.userId)}
                  onClick={() => void add(user)}
                  variant="outline"
                  className="h-8 rounded-lg border-white/15 bg-transparent text-xs text-white hover:bg-white/5"
                >
                  {sent.has(user.userId) ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-emerald-400" />
                      Sent
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 h-3 w-3" />
                      Add
                    </>
                  )}
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
