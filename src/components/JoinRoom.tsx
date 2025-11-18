import { motion } from 'framer-motion';
import { ArrowLeft, LogIn, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

import { Screen } from '../App';

interface JoinRoomProps {
  onNavigate: (screen: Screen) => void;
}

export function JoinRoom({ onNavigate }: JoinRoomProps) {
  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <motion.button
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={() => onNavigate('library')}
          className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </motion.button>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10"
        >
          <div className="mb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
              <LogIn className="w-8 h-8" />
            </div>
            <h1 className="text-3xl mb-2 tracking-tight">Join Room</h1>
            <p className="text-white/60">Enter the room code to join your friends</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm text-white/60 mb-2 block">Room Code</label>
              <Input
                type="text"
                placeholder="abc123xyz"
                className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10 text-center text-lg tracking-widest"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0D0D0F] text-white/40">Or paste invite link</span>
              </div>
            </div>

            <div className="relative">
              <Copy className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type="text"
                placeholder="connectus.app/room/abc123xyz"
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
              />
            </div>
          </div>

          <Button
            onClick={() => onNavigate('waiting-room')}
            className="w-full h-14 bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl mb-4"
          >
            Join Room
          </Button>

          <p className="text-center text-sm text-white/40">
            Don&apos;t have a code?{' '}
            <button
              onClick={() => onNavigate('create-room')}
              className="text-[#695CFF] hover:text-[#8B7FFF] transition-colors"
            >
              Create your own room
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
