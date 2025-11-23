import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, X, Loader2, Circle, Check, User } from 'lucide-react';
import { friendApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';
import { AddFriendModal } from './AddFriendModal';
import { signalingService } from '@/services/signaling';

interface Friend {
    _id: string;
    friendshipId: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    onlineStatus: 'online' | 'offline';
    lastSeen?: Date;
}

interface PendingRequest {
    _id: string;
    requester: {
        _id: string;
        fullName: string;
        email: string;
        avatarUrl?: string;
    };
    status: 'pending';
}

interface FriendsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FriendsSidebar({ isOpen, onClose }: FriendsSidebarProps) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    // Socket listeners for real-time friend status updates
    useEffect(() => {
        const socket = signalingService.socket;
        if (!socket) return;

        const handleFriendOnline = (friendUserId: string) => {
            console.log('Friend came online:', friendUserId);
            setFriends(prev => prev.map(friend =>
                friend._id === friendUserId
                    ? { ...friend, onlineStatus: 'online' as const }
                    : friend
            ));
        };

        const handleFriendOffline = (friendUserId: string) => {
            console.log('Friend went offline:', friendUserId);
            setFriends(prev => prev.map(friend =>
                friend._id === friendUserId
                    ? { ...friend, onlineStatus: 'offline' as const }
                    : friend
            ));
        };

        socket.on('friend-online', handleFriendOnline);
        socket.on('friend-offline', handleFriendOffline);

        return () => {
            socket.off('friend-online', handleFriendOnline);
            socket.off('friend-offline', handleFriendOffline);
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const [friendsRes, pendingRes] = await Promise.all([
                friendApi.getAll(token),
                friendApi.getPending(token)
            ]);

            if (friendsRes.success && friendsRes.data) {
                setFriends(friendsRes.data);
            }

            if (pendingRes.success && pendingRes.data) {
                setPendingRequests(pendingRes.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load friends');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const response = await friendApi.accept(token, requestId);
            if (response.success) {
                toast.success('Friend request accepted');
                fetchData(); // Refresh lists
            } else {
                toast.error('Failed to accept request');
            }
        } catch (error) {
            console.error('Accept error:', error);
            toast.error('Failed to accept request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const response = await friendApi.reject(token, requestId);
            if (response.success) {
                toast.success('Friend request rejected');
                setPendingRequests(prev => prev.filter(req => req._id !== requestId));
            } else {
                toast.error('Failed to reject request');
            }
        } catch (error) {
            console.error('Reject error:', error);
            toast.error('Failed to reject request');
        } finally {
            setProcessingId(null);
        }
    };

    const onlineFriends = friends.filter(f => f.onlineStatus === 'online');
    const offlineFriends = friends.filter(f => f.onlineStatus === 'offline');

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        />

                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-80 bg-[#1a1a1f] border-l border-white/10 shadow-2xl z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                                            <Users className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Friends</h2>
                                            <p className="text-xs text-white/40">{friends.length} total</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#695CFF]" />
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Pending Requests */}
                                        {pendingRequests.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                                                    <UserPlus className="w-4 h-4 text-[#695CFF]" />
                                                    Pending Requests ({pendingRequests.length})
                                                </h3>
                                                <div className="space-y-2">
                                                    {pendingRequests.map(req => (
                                                        <div key={req._id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-sm font-medium text-white">
                                                                    {req.requester.avatarUrl ? (
                                                                        <img src={req.requester.avatarUrl} alt={req.requester.fullName} className="w-full h-full rounded-full object-cover" />
                                                                    ) : (
                                                                        req.requester.fullName?.[0] || <User className="w-5 h-5" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-white truncate">{req.requester.fullName}</p>
                                                                    <p className="text-xs text-white/40 truncate">wants to be friends</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleAccept(req._id)}
                                                                    disabled={processingId === req._id}
                                                                    className="flex-1 h-8 bg-[#695CFF] hover:bg-[#5a4de6] text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                                >
                                                                    {processingId === req._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReject(req._id)}
                                                                    disabled={processingId === req._id}
                                                                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Friends List */}
                                        {friends.length === 0 && pendingRequests.length === 0 ? (
                                            <div className="text-center py-12 text-white/40">
                                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                <p className="mb-2">No friends yet</p>
                                                <p className="text-sm">Add friends to watch together!</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Online Friends */}
                                                {onlineFriends.length > 0 && (
                                                    <div>
                                                        <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                                                            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                                                            Online ({onlineFriends.length})
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {onlineFriends.map(friend => (
                                                                <FriendCard key={friend._id} friend={friend} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Offline Friends */}
                                                {offlineFriends.length > 0 && (
                                                    <div>
                                                        <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                                                            <Circle className="w-2 h-2 fill-white/40 text-white/40" />
                                                            Offline ({offlineFriends.length})
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {offlineFriends.map(friend => (
                                                                <FriendCard key={friend._id} friend={friend} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/10">
                                <button
                                    onClick={() => setShowAddFriendModal(true)}
                                    className="w-full bg-gradient-to-r from-[#695CFF] to-[#8B7FFF] hover:from-[#5a4de6] hover:to-[#7a6eef] text-white rounded-xl h-12 flex items-center justify-center gap-2 transition-all"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Add Friend
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AddFriendModal
                isOpen={showAddFriendModal}
                onClose={() => {
                    setShowAddFriendModal(false);
                    if (isOpen) fetchData(); // Refresh list when modal closes
                }}
            />
        </>
    );
}

function FriendCard({ friend }: { friend: Friend }) {
    const isOnline = friend.onlineStatus === 'online';

    return (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative">
                    {friend.avatarUrl ? (
                        <img
                            src={friend.avatarUrl}
                            alt={friend.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center text-sm font-medium text-white">
                            {friend.fullName?.[0] || friend.email[0]}
                        </div>
                    )}
                    {/* Online indicator */}
                    <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1a1a1f] ${isOnline ? 'bg-green-500' : 'bg-white/40'
                            }`}
                    />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                        {friend.fullName || friend.email}
                    </p>
                    <p className="text-xs text-white/40">
                        {isOnline ? 'Online' : 'Offline'}
                    </p>
                </div>
            </div>
        </div>
    );
}
