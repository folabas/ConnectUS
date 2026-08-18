'use client';

/**
 * Persistent chrome for every signed-in screen.
 *
 * Previously each screen drew its own back button and header, so navigation
 * differed page to page and there was no way to reach Settings from the library
 * without going through Profile.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Clapperboard,
  Compass,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/brand/Logo';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { useAuth } from '@/providers/AuthProvider';
import { cn, focusRing, initials } from '@/lib/ui';

const NAV = [
  { href: '/library', label: 'Library', icon: Clapperboard },
  { href: '/rooms', label: 'Rooms', icon: Compass },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0F]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/library" className={cn('shrink-0 rounded-lg', focusRing)} aria-label="ConnectUs home">
            <Logo size={30} className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>

          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                    focusRing,
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => router.push('/rooms/new')}
              className="h-10 rounded-xl bg-[#695CFF] px-4 hover:bg-[#5a4de6]"
            >
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:block">Host</span>
            </Button>

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn('rounded-full', focusRing)}
                  aria-label="Account menu"
                >
                  <Avatar className="h-9 w-9 border border-white/15">
                    <AvatarImage src={user?.avatarUrl} alt="" />
                    <AvatarFallback className="bg-[#695CFF] text-sm text-white">
                      {initials(user?.fullName || user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 border-white/10 bg-[#141417] text-white"
              >
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm">{user?.fullName || 'Your account'}</p>
                  <p className="truncate text-xs text-white/50">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => void signOut()} className="text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

/** Re-exported so pages can render a bell without importing the shell. */
export { Bell };
