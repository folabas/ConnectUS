'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  const handleAuth = () => {
    // Handle authentication logic here
    router.push('/library');
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white flex">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#695CFF] via-[#8B7FFF] to-[#5a4de6]" />
        
        <div className="relative z-10 flex items-center justify-center w-full p-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
              <Video className="w-10 h-10" />
            </div>
            <h2 className="text-4xl tracking-tight">Welcome to ConnectUs</h2>
            <p className="text-xl text-white/80 max-w-md mx-auto leading-relaxed">
              Create memorable movie nights with friends from anywhere in the world
            </p>
          </motion.div>
        </div>

        {/* Ambient Elements */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => router.push('/')}
            className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="mb-8">
            <h1 className="text-4xl mb-2 tracking-tight">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-white/60">
              {isLogin ? 'Sign in to continue your experience' : 'Start your movie journey today'}
            </p>
          </div>

          <div className="space-y-4 mb-6">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  type="text"
                  placeholder="Full name"
                  className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type="email"
                placeholder="Email address"
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type="password"
                placeholder="Password"
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-end">
                <button className="text-sm text-[#695CFF] hover:text-[#8B7FFF] transition-colors">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={handleAuth}
            className="w-full h-14 bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl mb-4"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0D0D0F] text-white/40">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Button
              variant="outline"
              className="h-14 border-white/10 hover:bg-white/5 rounded-2xl text-white"
            >
              Google
            </Button>
            <Button
              variant="outline"
              className="h-14 border-white/10 hover:bg-white/5 rounded-2xl text-white"
            >
              Apple
            </Button>
          </div>

          <p className="text-center text-white/60">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#695CFF] hover:text-[#8B7FFF] transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}