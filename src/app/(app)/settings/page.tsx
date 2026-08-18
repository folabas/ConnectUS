'use client';

import { useEffect, useState } from 'react';
import { Bell, LogOut, Monitor, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { cn, surface } from '@/lib/ui';

/** Client-side preferences. Server-backed settings would need a schema change. */
interface Preferences {
  emailNotifications: boolean;
  autoJoinVideo: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'connectus_preferences';

const DEFAULTS: Preferences = {
  emailNotifications: true,
  autoJoinVideo: true,
  reducedMotion: false,
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // Fall back to defaults if the stored blob is unreadable.
    }
  }, []);

  const update = (key: keyof Preferences) => (value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      await authApi.forgotPassword(user.email);
      toast.success('Password reset link sent to your email.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl tracking-tight">Settings</h1>

      <Section icon={Bell} title="Notifications">
        <ToggleRow
          id="email-notifications"
          label="Email me about invites"
          description="Room invitations and scheduled sessions arrive in your inbox."
          checked={prefs.emailNotifications}
          onChange={update('emailNotifications')}
        />
      </Section>

      <Section icon={Monitor} title="Watching">
        <ToggleRow
          id="auto-join-video"
          label="Turn my camera on when I join"
          description="Off means you join muted with the camera stopped."
          checked={prefs.autoJoinVideo}
          onChange={update('autoJoinVideo')}
        />
        <ToggleRow
          id="reduced-motion"
          label="Reduce motion"
          description="Calms floating reactions and screen transitions."
          checked={prefs.reducedMotion}
          onChange={update('reducedMotion')}
        />
      </Section>

      <Section icon={Shield} title="Account">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Password</p>
            <p className="mt-0.5 text-xs text-white/50">
              We will email {user?.email} a link to set a new one.
            </p>
          </div>
          <Button
            onClick={sendPasswordReset}
            disabled={sendingReset}
            variant="outline"
            className="shrink-0 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
          >
            {sendingReset ? 'Sending…' : 'Reset password'}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-5">
          <div>
            <p className="text-sm">Sign out</p>
            <p className="mt-0.5 text-xs text-white/50">Ends this session on this device.</p>
          </div>
          <Button
            onClick={() => void signOut()}
            variant="outline"
            className="shrink-0 rounded-xl border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(surface, 'p-6')}>
      <h2 className="flex items-center gap-2 text-lg tracking-tight">
        <Icon className="h-4.5 w-4.5 text-white/50" />
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}
