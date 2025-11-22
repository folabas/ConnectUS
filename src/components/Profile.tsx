'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Calendar, Film, Users, Star, Edit2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Screen } from '../App';
import { authApi, userStorage, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface ProfileProps {
  onNavigate: (screen: Screen) => void;
}

interface UserData {
  userId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt?: string;
}

const watchHistory = [
  { id: 1, title: 'Quantum Horizon', date: 'Nov 15, 2025', rating: 5 },
  { id: 2, title: 'Dark Velocity', date: 'Nov 10, 2025', rating: 4 },
  { id: 3, title: 'Nebula Dreams', date: 'Nov 5, 2025', rating: 5 }
];

const stats = [
  { label: 'Movies Watched', value: '47', icon: Film },
  { label: 'Sessions Hosted', value: '23', icon: Users },
  { label: 'Hours Watched', value: '156', icon: Calendar }
];

export function Profile({ onNavigate }: ProfileProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // First try to get from localStorage
        const storedUser = userStorage.get();
        if (storedUser) {
          setUserData(storedUser);
        }

        // Get the token
        const token = tokenStorage.get();
        if (!token) {
          toast.error('Please log in to view your profile');
          onNavigate('auth');
          return;
        }

        // Then fetch fresh data from backend
        const response = await authApi.getMe(token);
        if (response.success && response.data) {
          setUserData(response.data);
          // Update localStorage with fresh data
          userStorage.set(response.data);
        } else {
          // If not authenticated, redirect to auth
          toast.error('Please log in to view your profile');
          onNavigate('auth');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load profile data');
        // Redirect to auth if there's an error
        onNavigate('auth');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [onNavigate]);

  // Get initials for avatar
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Format join date
  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#695CFF] mx-auto mb-4" />
          <p className="text-white/60">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white">
      {/* Header */}
      <nav className="px-8 py-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <Button
            onClick={() => onNavigate('settings')}
            variant="outline"
            className="border-white/10 hover:bg-white/5 rounded-full"
          >
            Settings
          </Button>
        </div>
      </nav>

      <div className="px-8 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Profile Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12 text-center"
          >
            <div className="relative inline-block mb-6">
              {userData?.avatarUrl ? (
                <img
                  src={userData.avatarUrl}
                  alt={userData.fullName || 'User'}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-4xl">
                  {getInitials(userData?.fullName, userData?.email)}
                </div>
              )}
              <button className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#695CFF] hover:bg-[#5a4de6] flex items-center justify-center transition-colors border-4 border-[#0D0D0F]">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <h1 className="text-4xl mb-2 tracking-tight">
              {userData?.fullName || 'User'}
            </h1>
            <p className="text-white/60 text-lg mb-4">Movie enthusiast & host</p>

            <div className="flex items-center justify-center gap-4 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {userData?.email || 'No email'}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Joined {formatJoinDate(userData?.createdAt)}
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 text-center"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#695CFF]/20 to-[#8B7FFF]/20 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-[#695CFF]" />
                </div>
                <div className="text-3xl mb-2">{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Watch History */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10"
          >
            <h2 className="text-2xl mb-6 tracking-tight">Recent Watch History</h2>

            <div className="space-y-4">
              {watchHistory.map((movie, index) => (
                <motion.div
                  key={movie.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                      <Film className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="mb-1">{movie.title}</h3>
                      <p className="text-sm text-white/60">{movie.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < movie.rating
                          ? 'fill-[#695CFF] text-[#695CFF]'
                          : 'text-white/20'
                          }`}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
