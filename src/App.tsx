import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { Authentication } from './components/Authentication';
import { MovieLibrary } from './components/MovieLibrary';
import { CreateRoom } from './components/CreateRoom';
import { WaitingRoom } from './components/WaitingRoom';
import { MovieWatchScreen } from './components/MovieWatchScreen';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { JoinRoom } from './components/JoinRoom';
import { signalingService } from './services/signaling';
import { toast } from 'sonner';

export type Screen = 'landing' | 'auth' | 'library' | 'create-room' | 'join-room' | 'waiting-room' | 'watch' | 'profile' | 'settings';

export interface RoomTheme {
  primary: string;
  secondary: string;
  name: string;
}

export interface Movie {
  id: string;
  title: string;
  image: string;
  duration: string;
  rating: string;
  genre: string;
  videoUrl?: string;
  muxPlaybackId?: string;
}

export interface Room {
  _id: string;
  name: string;
  host: any;
  movie: any;
  type: 'public' | 'private';
  code?: string;
  theme: RoomTheme;
  startTime?: string;
  maxParticipants: number;
  adminEnabled: boolean;
  approvalRequired: boolean;
  participants: any[];
  status: 'waiting' | 'playing' | 'finished' | 'scheduled';
  joinRequests?: Array<{
    user: any;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomTheme, setRoomTheme] = useState<RoomTheme>({
    primary: '#695CFF',
    secondary: '#8B7FFF',
    name: 'Purple Dream'
  });

  // Listen for real-time friend notifications
  useEffect(() => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('connectus_user') : null;
    if (!userData) return;

    const socket = signalingService.connect();
    const user = JSON.parse(userData);

    // Emit user online status
    if (socket.connected) {
      socket.emit('user-online', user.userId);
    } else {
      socket.on('connect', () => {
        socket.emit('user-online', user.userId);
      });
    }

    const handleFriendOnline = (friendId: string) => {
      toast.info('A friend is online', { duration: 3000 });
    };

    const handleFriendOffline = (friendId: string) => {
      // Optionally show offline notification
    };

    const handleRoomInvite = (data: { roomId: string; roomName: string; fromUserName: string }) => {
      toast.info(`${data.fromUserName} invited you to "${data.roomName}"`, {
        duration: 5000,
        action: {
          label: 'Join',
          onClick: () => {
            localStorage.setItem('currentRoomId', data.roomId);
            setCurrentScreen('waiting-room');
          }
        }
      });
    };

    socket.on('friend-online', handleFriendOnline);
    socket.on('friend-offline', handleFriendOffline);
    socket.on('room-invite', handleRoomInvite);

    return () => {
      socket.off('friend-online', handleFriendOnline);
      socket.off('friend-offline', handleFriendOffline);
      socket.off('room-invite', handleRoomInvite);
    };
  }, []);

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
        return <WaitingRoom onNavigate={navigate} selectedMovie={selectedMovie} roomTheme={roomTheme} onRoomUpdate={setCurrentRoom} />;
      case 'watch':
        return <MovieWatchScreen onNavigate={navigate} selectedMovie={selectedMovie} roomTheme={roomTheme} currentRoom={currentRoom} />;
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