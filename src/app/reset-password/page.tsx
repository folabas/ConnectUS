'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { authApi } from '@/services/api';

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error('Invalid reset link');
            return;
        }

        if (!password || password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const response = await authApi.resetPassword(token, password);

            if (response.success) {
                setIsSuccess(true);
                toast.success('Password reset successfully!');

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push('/');
                }, 2000);
            } else {
                toast.error(response.message || 'Failed to reset password');
            }
        } catch (error: any) {
            console.error('Reset password error:', error);
            toast.error('Invalid or expired reset link');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
                    <p className="text-white/60 mb-6">This password reset link is invalid or has expired.</p>
                    <Button
                        onClick={() => router.push('/')}
                        className="bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-4">Password Reset Successful!</h1>
                    <p className="text-white/60 mb-6">Redirecting you to login...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md"
            >
                <button
                    onClick={() => router.push('/')}
                    className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                </button>

                <div className="mb-8">
                    <h1 className="text-4xl mb-2 tracking-tight">Reset your password</h1>
                    <p className="text-white/60">Enter your new password below</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <Input
                            type="password"
                            placeholder="New password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                            minLength={6}
                            required
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <Input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                            minLength={6}
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-14 bg-[#695CFF] hover:bg-[#5a4de6] text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}
