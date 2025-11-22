import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { friendApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface Friend {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    onlineStatus: 'online' | 'offline';
}

interface InviteFriendsModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
}

export function InviteFriendsModal({ isOpen, onClose, roomId }: InviteFriendsModalProps) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
    const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            fetchFriends();
        }
    }, [isOpen]);

    const fetchFriends = async () => {
        setLoading(true);
        try {
            const token = tokenStorage.get();
            if (!token) return;

            const response = await friendApi.getAll(token);
            if (response.success && response.data) {
                setFriends(response.data);
            }
        } catch (error) {
            console.error('Error fetching friends:', error);
            toast.error('Failed to load friends');
        } finally {
            setLoading(false);
        }
    };

    const toggleFriend = (friendId: string) => {
        const newSelected = new Set(selectedFriends);
        if (newSelected.has(friendId)) {
            newSelected.delete(friendId);
        } else {
            newSelected.add(friendId);
        }
        setSelectedFriends(newSelected);
    };

    const handleInvite = async () => {
        if (selectedFriends.size === 0) {
            toast.error('Please select at least one friend');
            return;
        }

        setInviting(true);
        const token = tokenStorage.get();
        if (!token) return;

        try {
            const promises = Array.from(selectedFriends).map(friendId =>
                friendApi.inviteToRoom(token, friendId, roomId)
            );

            await Promise.all(promises);

            // Mark as invited
            setInvitedFriends(new Set([...invitedFriends, ...selectedFriends]));
            setSelectedFriends(new Set());

            toast.success(`Invited ${selectedFriends.size} friend(s)!`);
        } catch (error) {
            console.error('Error inviting friends:', error);
            toast.error('Failed to send invites');
        } finally {
            setInviting(false);
        }
    };

    const onlineFriends = friends.filter(f => f.onlineStatus === 'online');
    const offlineFriends = friends.filter(f => f.onlineStatus === 'offline');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={onClose}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md bg-[#1a1a1f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                                            <Users className="w-5 h-5 text-white" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Invite Friends</h2>
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
                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#695CFF]" />
                                    </div>
                                ) : friends.length === 0 ? (
                                    <div className="text-center py-12 text-white/40">
                                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No friends yet</p>
                                        <p className="text-sm mt-2">Add friends to invite them to watch!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Online Friends */}
                                        {onlineFriends.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium text-white/60 mb-3">Online ({onlineFriends.length})</h3>
                                                <div className="space-y-2">
                                                    {onlineFriends.map(friend => (
                                                        <FriendItem
                                                            key={friend._id}
                                                            friend={friend}
                                                            isSelected={selectedFriends.has(friend._id)}
                                                            isInvited={invitedFriends.has(friend._id)}
                                                            onToggle={() => toggleFriend(friend._id)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Offline Friends */}
                                        {offlineFriends.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium text-white/60 mb-3">Offline ({offlineFriends.length})</h3>
                                                <div className="space-y-2">
                                                    {offlineFriends.map(friend => (
                                                        <FriendItem
                                                            key={friend._id}
                                                            friend={friend}
                                                            isSelected={selectedFriends.has(friend._id)}
                                                            isInvited={invitedFriends.has(friend._id)}
                                                            onToggle={() => toggleFriend(friend._id)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            {friends.length > 0 && (
                                <div className="p-6 border-t border-white/10">
                                    <Button
                                        onClick={handleInvite}
                                        disabled={inviting || selectedFriends.size === 0}
                                        className="w-full bg-[#695CFF] hover:bg-[#5a4de6] text-white h-12 rounded-xl"
                                    >
                                        {inviting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Sending Invites...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Invite {selectedFriends.size > 0 ? `(${selectedFriends.size})` : ''}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function FriendItem({
    friend,
    isSelected,
    isInvited,
    onToggle
}: {
    friend: Friend;
    isSelected: boolean;
    isInvited: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            disabled={isInvited}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${isInvited
                    ? 'bg-green-500/10 border border-green-500/30 cursor-not-allowed'
                    : isSelected
                        ? 'bg-[#695CFF]/20 border border-[#695CFF]'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
        >
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
                {friend.onlineStatus === 'online' && !isInvited && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#1a1a1f]" />
                )}
            </div>

            {/* Name */}
            <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">{friend.fullName || friend.email}</p>
                {friend.onlineStatus === 'offline' && !isInvited && (
                    <p className="text-xs text-white/40">Offline - will receive email</p>
                )}
            </div>

            {/* Status */}
            {isInvited ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
                <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                            ? 'bg-[#695CFF] border-[#695CFF]'
                            : 'border-white/30'
                        }`}
                >
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
            )}
        </button>
    );
}
