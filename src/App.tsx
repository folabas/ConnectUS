import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Authentication } from './components/Authentication';
import { MovieLibrary } from './components/MovieLibrary';
import { CreateRoom } from './components/CreateRoom';
import { WaitingRoom } from './components/WaitingRoom';
import { MovieWatchScreen } from './components/MovieWatchScreen';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { JoinRoom } from './components/JoinRoom';

export type Screen = 'landing' | 'auth' | 'library' | 'create-room' | 'join-room' | 'waiting-room' | 'watch' | 'profile' | 'settings';

export interface Movie {
  id: number;
  title: string;
  image: string;
  duration: string;
  rating: string;
  genre: string;
  videoUrl?: string;
}

export interface RoomTheme {
  primary: string;
  secondary: string;
  name: string;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [roomTheme, setRoomTheme] = useState<RoomTheme>({
    primary: '#695CFF',
    secondary: '#8B7FFF',
    name: 'Purple Dream'
  });

  const navigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleAuth = () => {
    setIsAuthenticated(true);
    navigate('library');
  };

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return <LandingPage onNavigate={navigate} />;
      case 'auth':
        return <Authentication onNavigate={navigate} onAuth={handleAuth} />;
      case 'library':
        return <MovieLibrary onNavigate={navigate} onMovieSelect={handleMovieSelect} />;
      case 'create-room':
        return <CreateRoom onNavigate={navigate} selectedMovie={selectedMovie} onMovieSelect={handleMovieSelect} roomTheme={roomTheme} onThemeChange={setRoomTheme} />;
      case 'join-room':
        return <JoinRoom onNavigate={navigate} />;
      case 'waiting-room':
        return <WaitingRoom onNavigate={navigate} selectedMovie={selectedMovie} roomTheme={roomTheme} />;
      case 'watch':
        return <MovieWatchScreen onNavigate={navigate} selectedMovie={selectedMovie} roomTheme={roomTheme} />;
      case 'profile':
        return <Profile onNavigate={navigate} />;
      case 'settings':
        return <Settings onNavigate={navigate} />;
      default:
        return <LandingPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F]">
      {renderScreen()}
    </div>
  );
}