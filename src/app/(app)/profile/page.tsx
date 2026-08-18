'use client';

import { useEffect, useState } from 'react';
import { Check, Clapperboard, Loader2, Pencil, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FriendsPanel } from '@/components/social/FriendsPanel';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { cn, field, initials, surface } from '@/lib/ui';

export default function ProfilePage() {
  const { user, updateUser, refresh } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');

  useEffect(() => {
    void refresh();
    // Refresh stats once on mount; `refresh` is stable.
  }, [refresh]);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
  }, [user?.fullName, user?.avatarUrl]);

  const save = async () => {
    if (!fullName.trim()) {
      toast.error('Your name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await authApi.updateMe({
        fullName: fullName.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      updateUser(updated);
      setEditing(false);
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setFullName(user?.fullName ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
    setEditing(false);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl tracking-tight">Profile</h1>

      <section className={cn(surface, 'p-6')}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar className="h-20 w-20 border-2 border-white/15">
            <AvatarImage src={user?.avatarUrl} alt="" />
            <AvatarFallback className="bg-[#695CFF] text-2xl text-white">
              {initials(user?.fullName || user?.email)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm text-white/70">
                    Display name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={60}
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avatarUrl" className="text-sm text-white/70">
                    Avatar URL
                  </Label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…"
                    className={field}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={save}
                    disabled={saving}
                    className="rounded-xl bg-[#695CFF] hover:bg-[#5a4de6]"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={cancel}
                    variant="outline"
                    className="rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl tracking-tight">{user?.fullName ?? 'Your account'}</h2>
                  <p className="mt-0.5 text-white/50">{user?.email}</p>
                </div>
                <Button
                  onClick={() => setEditing(true)}
                  variant="outline"
                  className="rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit profile
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={Users}
          label="Sessions hosted"
          value={user?.sessionsHosted ?? 0}
        />
        <StatCard
          icon={Clapperboard}
          label="Movies watched"
          value={user?.moviesWatched ?? 0}
        />
      </div>

      <FriendsPanel />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className={cn(surface, 'flex items-center gap-4 p-5')}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#695CFF]/15">
        <Icon className="h-5 w-5 text-[#8B7FFF]" />
      </span>
      <div>
        <p className="text-2xl tracking-tight">{value}</p>
        <p className="text-sm text-white/50">{label}</p>
      </div>
    </div>
  );
}
