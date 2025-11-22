import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Loader2, Check, User } from 'lucide-react';
import { Input } from './ui/input';
import { friendApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface AddFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SearchResult {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    status: 'none' | 'friend' | 'sent' | 'received';
}

export function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const response = await friendApi.search(token, query);
            if (response.success && response.data) {
                setResults(response.data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Failed to search users');
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (userId: string) => {
        setSending(userId);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const response = await friendApi.sendRequest(token, userId);
            if (response.success) {
                toast.success('Friend request sent!');
                // Update local state to show sent status
                setResults(prev => prev.map(user =>
                    user._id === userId ? { ...user, status: 'sent' } : user
                ));
            } else {
                toast.error(response.message || 'Failed to send request');
            }
        } catch (error) {
            console.error('Send request error:', error);
            toast.error('Failed to send request');
        } finally {
            setSending(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1a1a1f] border border-white/10 rounded-3xl shadow-2xl z-[70] overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Add Friend</h2>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <X className="w-4 h-4 text-white/60" />
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleSearch} className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                                    autoFocus
                                />
                            </form>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#695CFF]" />
                                    </div>
                                ) : results.length > 0 ? (
                                    results.map((user) => (
                                        <div
                                            key={user._id}
                                            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-white font-medium">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        user.fullName?.[0]?.toUpperCase() || <User className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{user.fullName}</p>
                                                    <p className="text-xs text-white/40">{user.email}</p>
                                                </div>
                                            </div>

                                            {user.status === 'none' && (
                                                <button
                                                    onClick={() => handleSendRequest(user._id)}
                                                    disabled={sending === user._id}
                                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
                                                >
                                                    {sending === user._id ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <UserPlus className="w-5 h-5" />
                                                    )}
                                                </button>
                                            )}

                                            {user.status === 'friend' && (
                                                <span className="text-xs font-medium text-green-400 bg-green-400/10 px-3 py-1 rounded-full">
                                                    Friends
                                                </span>
                                            )}

                                            {user.status === 'sent' && (
                                                <span className="text-xs font-medium text-white/40 bg-white/5 px-3 py-1 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Sent
                                                </span>
                                            )}

                                            {user.status === 'received' && (
                                                <span className="text-xs font-medium text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full">
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    ))
                                ) : query && !loading ? (
                                    <div className="text-center py-8 text-white/40">
                                        <p>No users found matching "{query}"</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-white/40">
                                        <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>Search for friends to add them</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
