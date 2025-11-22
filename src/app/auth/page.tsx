'use client';

import { useRouter } from 'next/navigation';
import { Authentication } from '@/components/Authentication';
import type { Screen } from '@/App';

export default function AuthPage() {
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

  const onAuth = () => {
    // After successful authentication, redirect to library
    router.push('/library');
  };

  return <Authentication onNavigate={onNavigate} onAuth={onAuth} />;
}