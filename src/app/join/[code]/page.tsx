'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { roomApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function JoinRoomByCodePage() {
    const router = useRouter();
    const params = useParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const joinRoom = async () => {
            const code = params.code as string;

            if (!code) {
                setErrorMessage('Invalid room code');
                setStatus('error');
                return;
            }

            // Check if user is authenticated
            const token = tokenStorage.get();
            if (!token) {
                // Store the intended destination
                if (typeof window !== 'undefined') {
                    localStorage.setItem('redirectAfterAuth', `/join/${code}`);
                }
                toast.error('Please log in to join this room');
                router.push('/auth');
                return;
            }

            try {
                setStatus('loading');
                const response = await roomApi.join(token, { code: code.toUpperCase() });

                if (response.success && response.data) {
                    // Store room ID for the waiting room
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('currentRoomId', response.data._id);
                    }

                    toast.success('Joined room successfully!');
                    setStatus('success');

                    // Redirect to waiting room
                    setTimeout(() => {
                        router.push('/waiting-room');
                    }, 500);
                } else {
                    setErrorMessage(response.message || 'Failed to join room');
                    setStatus('error');
                    toast.error(response.message || 'Failed to join room');
                }
            } catch (error) {
                console.error('Error joining room:', error);
                setErrorMessage('Failed to join room. Please try again.');
                setStatus('error');
                toast.error('Failed to join room');
            }
        };

        joinRoom();
    }, [params.code, router]);

    return (
        <div className="min-h-screen bg-[#0D0D0F] text-white flex items-center justify-center p-8">
            <div className="max-w-md w-full">
                {status === 'loading' && (
                    <div className="text-center">
                        <Loader2 className="w-16 h-16 animate-spin text-[#695CFF] mx-auto mb-6" />
                        <h1 className="text-2xl font-bold mb-2">Joining Room...</h1>
                        <p className="text-white/60">Please wait while we connect you to the session</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Unable to Join Room</h1>
                        <p className="text-white/60 mb-6">{errorMessage}</p>
                        <button
                            onClick={() => router.push('/join-room')}
                            className="px-6 py-3 bg-[#695CFF] hover:bg-[#5a4de6] rounded-2xl transition-colors"
                        >
                            Browse Rooms
                        </button>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Success!</h1>
                        <p className="text-white/60">Redirecting to waiting room...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
