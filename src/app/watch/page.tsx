'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MovieWatchScreen } from '@/components/MovieWatchScreen';
import type { Movie, RoomTheme, Screen } from '@/App';

export default function WatchPage() {
  const router = useRouter();
  const [selectedMovie] = useState<Movie | null>(() => {
    const m = typeof window !== 'undefined' ? localStorage.getItem('selectedMovie') : null;
    return m ? JSON.parse(m) : null;
  });
  const [roomTheme] = useState<RoomTheme | null>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('roomTheme') : null;
    return t ? JSON.parse(t) : null;
  });

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

  return (
    <MovieWatchScreen
      onNavigate={onNavigate}
      selectedMovie={selectedMovie}
      roomTheme={roomTheme || { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' }}
    />
  );
}