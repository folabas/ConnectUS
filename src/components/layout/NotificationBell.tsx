'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationApi } from '@/lib/api';
import { useSocketEvent } from '@/providers/SocketProvider';
import { cn, focusRing, formatRelative } from '@/lib/ui';
import type { Notification } from '@/types';

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await notificationApi.list());
    } catch {
      // A failed poll should not surface an error toast on every screen.
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount; same pattern as RoomProvider.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Room invites now arrive over the socket as well as being persisted, so the
  // bell updates without a refresh.
  useSocketEvent('room-invite', (payload) => {
    void load();
    toast.info(`${payload.fromUserName} invited you to "${payload.roomName}"`, {
      duration: 8000,
      action: { label: 'Join', onClick: () => router.push(`/room/${payload.roomId}`) },
    });
  });

  const unread = items.filter((n) => !n.read).length;

  const open = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationApi.markRead(notification._id);
        setItems((current) =>
          current.map((n) => (n._id === notification._id ? { ...n, read: true } : n)),
        );
      } catch {
        // Navigation matters more than the read receipt.
      }
    }
    if (notification.data.roomId) router.push(`/room/${notification.data.roomId}`);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((current) => current.map((n) => ({ ...n, read: true })));
    } catch {
      toast.error('Could not mark notifications as read.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/5 hover:text-white',
            focusRing,
          )}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-ink)] px-1 text-[10px] font-medium">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 border-white/10 bg-[var(--surface)] p-0 text-white"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white"
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/40">
            Nothing yet. Invites and requests show up here.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul>
              {items.map((notification) => (
                <li key={notification._id}>
                  <button
                    onClick={() => void open(notification)}
                    className={cn(
                      'w-full border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5',
                      !notification.read && 'bg-[var(--brand)]/10',
                    )}
                  >
                    <p className="text-sm">
                      {notification.type === 'room_invite' && (
                        <>
                          <span className="font-medium">
                            {notification.data.fromUserName || 'Someone'}
                          </span>{' '}
                          invited you to{' '}
                          <span className="font-medium">{notification.data.roomName}</span>
                        </>
                      )}
                      {notification.type === 'friend_request' && (
                        <>
                          <span className="font-medium">
                            {notification.data.fromUserName || 'Someone'}
                          </span>{' '}
                          sent you a friend request
                        </>
                      )}
                      {notification.type === 'room_starting' && (
                        <>
                          <span className="font-medium">{notification.data.roomName}</span> is
                          starting soon
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {formatRelative(notification.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
