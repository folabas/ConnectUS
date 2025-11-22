'use client';

import { useRouter } from 'next/navigation';
import { MovieLibrary } from '@/components/MovieLibrary';
import type { Screen } from '@/App';

export default function LibraryPage() {
  const router = useRouter();

  const handleNavigate = (screen: Screen) => {
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
    <MovieLibrary
      onNavigate={handleNavigate}
      onMovieSelect={(movie) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedMovie', JSON.stringify(movie));
        }
      }}
    />
  );
}