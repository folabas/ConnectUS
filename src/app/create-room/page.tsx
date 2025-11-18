'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRoom } from '@/components/CreateRoom';
import type { Movie, RoomTheme, Screen } from '@/App';

export default function CreateRoomPage() {
  const router = useRouter();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(() => {
    const m = typeof window !== 'undefined' ? localStorage.getItem('selectedMovie') : null;
    return m ? JSON.parse(m) : null;
  });
  const [roomTheme, setRoomTheme] = useState<RoomTheme>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('roomTheme') : null;
    return t ? JSON.parse(t) : { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' };
  });

  const onMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
    localStorage.setItem('selectedMovie', JSON.stringify(movie));
  };

  const onThemeChange = (theme: RoomTheme) => {
    setRoomTheme(theme);
    localStorage.setItem('roomTheme', JSON.stringify(theme));
  };

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
    <CreateRoom
      onNavigate={onNavigate}
      selectedMovie={selectedMovie}
      onMovieSelect={onMovieSelect}
      roomTheme={roomTheme}
      onThemeChange={onThemeChange}
    />
  );
}