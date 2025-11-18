'use client';

import { useRouter } from 'next/navigation';
import { Settings } from '@/components/Settings';
import type { Screen } from '@/App';

export default function SettingsPage() {
  const router = useRouter();

  const onNavigate = (screen: Screen) => {
    switch (screen) {
      case 'landing':
        router.push('/');
        break;
      case 'auth':
        router.push('/auth');
        break;
      case 'library':
        router.push('/library');
        break;
      case 'create-room':
        router.push('/create-room');
        break;
      case 'join-room':
        router.push('/join-room');
        break;
      case 'waiting-room':
        router.push('/waiting-room');
        break;
      case 'watch':
        router.push('/watch');
        break;
      case 'profile':
        router.push('/profile');
        break;
      case 'settings':
        router.push('/settings');
        break;
    }
  };

  return <Settings onNavigate={onNavigate} />;
}