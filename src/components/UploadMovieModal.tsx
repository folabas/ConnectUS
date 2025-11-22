import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Film, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { movieApi, tokenStorage } from '@/services/api';
import { toast } from 'sonner';

interface UploadMovieModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const GENRES = [
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Documentary',
    'Drama',
    'Educational',
    'Fantasy',
    'Horror',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Thriller',
    'Western',
];

export function UploadMovieModal({ isOpen, onClose, onSuccess }: UploadMovieModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [genre, setGenre] = useState('');
    const [posterUrl, setPosterUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingAsset, setProcessingAsset] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('video/')) {
                toast.error('Please select a valid video file');
                return;
            }

            setSelectedFile(file);

            // Auto-fill title from filename
            const filename = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const formattedTitle = filename
                .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
                .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
            setTitle(formattedTitle);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a video file');
            return;
        }

        if (!genre) {
            toast.error('Please select a genre');
            return;
        }

        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }

        const token = tokenStorage.get();
        if (!token) {
            toast.error('Please log in to upload movies');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: Get upload URL from backend
            toast.info('Preparing upload...');
            const uploadUrlResponse = await movieApi.createUploadUrl(token);

            if (!uploadUrlResponse.success || !uploadUrlResponse.data) {
                throw new Error('Failed to create upload URL');
            }

            const { uploadUrl, uploadId } = uploadUrlResponse.data;
            let assetId = uploadUrlResponse.data.assetId;

            // Step 2: Upload video to Mux
            toast.info('Uploading video...');
            await movieApi.uploadToMux(uploadUrl, selectedFile, (progress) => {
                setUploadProgress(progress);
            });

            toast.success('Video uploaded successfully!');
            setUploadProgress(100);
            setProcessingAsset(true);

            // Step 3: Poll for Asset ID if not immediately available
            if (!assetId) {
                toast.info('Finalizing upload...');
                let attempts = 0;
                const maxAttempts = 30;

                while (attempts < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const uploadDetails = await movieApi.getUploadDetails(token, uploadId);

                    if (uploadDetails.success && uploadDetails.data && uploadDetails.data.assetId) {
                        assetId = uploadDetails.data.assetId;
                        break;
                    }
                    attempts++;
                }
            }

            if (!assetId) {
                throw new Error('Failed to retrieve asset ID. Please try again.');
            }

            // Step 4: Wait for Mux to process the video and get asset details
            toast.info('Processing video...');
            let assetDetails;
            let attempts = 0;
            const maxAttempts = 30; // Wait up to 30 seconds

            while (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

                const assetResponse = await movieApi.getAssetDetails(token, assetId);

                if (assetResponse.success && assetResponse.data) {
                    assetDetails = assetResponse.data;

                    // Check if asset is ready
                    if (assetDetails.status === 'ready' && assetDetails.playbackId) {
                        break;
                    }
                }

                attempts++;
            }

            if (!assetDetails || !assetDetails.playbackId) {
                throw new Error('Video processing timed out. Please try again later.');
            }

            // Step 5: Create movie in database
            toast.info('Saving movie...');
            const createResponse = await movieApi.create(token, {
                title: title.trim(),
                genre,
                muxAssetId: assetId,
                muxPlaybackId: assetDetails.playbackId,
                duration: assetDetails.duration,
                image: posterUrl || assetDetails.thumbnailUrl,
            });

            if (!createResponse.success) {
                throw new Error(createResponse.message || 'Failed to save movie');
            }

            toast.success('Movie uploaded successfully!');

            // Reset form
            setSelectedFile(null);
            setTitle('');
            setGenre('');
            setPosterUrl('');
            setUploadProgress(0);

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload movie');
        } finally {
            setUploading(false);
            setProcessingAsset(false);
        }
    };

    const handleClose = () => {
        if (!uploading) {
            setSelectedFile(null);
            setTitle('');
            setGenre('');
            setPosterUrl('');
            setUploadProgress(0);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-[#1A1A1F] rounded-3xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#695CFF] to-[#8B7FFF] flex items-center justify-center">
                                        <Film className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-semibold text-white">Upload Movie</h2>
                                </div>
                                <button
                                    onClick={handleClose}
                                    disabled={uploading}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* File Upload */}
                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">Video File *</label>
                                    <div
                                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${selectedFile
                                            ? 'border-[#695CFF] bg-[#695CFF]/10'
                                            : 'border-white/20 hover:border-white/40'
                                            }`}
                                    >
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handleFileSelect}
                                            disabled={uploading}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                                        {selectedFile ? (
                                            <>
                                                <p className="text-white font-medium">{selectedFile.name}</p>
                                                <p className="text-white/60 text-sm mt-1">
                                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-white/80 font-medium">Click or drag to upload video</p>
                                                <p className="text-white/40 text-sm mt-1">MP4, MOV, AVI, or other video formats</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Genre Selection */}
                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">Genre *</label>
                                    <select
                                        value={genre}
                                        onChange={(e) => setGenre(e.target.value)}
                                        disabled={uploading}
                                        className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-[#695CFF] focus:bg-white/10 transition-colors disabled:opacity-50"
                                    >
                                        <option value="">Select a genre</option>
                                        {GENRES.map((g) => (
                                            <option key={g} value={g} className="bg-[#1A1A1F]">
                                                {g}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Title */}
                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">Title (optional)</label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        disabled={uploading}
                                        placeholder="Auto-filled from filename"
                                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                                    />
                                    <p className="mt-2 text-xs text-white/40">Leave blank to use filename</p>
                                </div>

                                {/* Poster URL */}
                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">Poster Image URL (optional)</label>
                                    <Input
                                        value={posterUrl}
                                        onChange={(e) => setPosterUrl(e.target.value)}
                                        disabled={uploading}
                                        placeholder="https://example.com/poster.jpg"
                                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[#695CFF] focus:bg-white/10"
                                    />
                                    <p className="mt-2 text-xs text-white/40">Leave blank to use auto-generated thumbnail</p>
                                </div>

                                {/* Upload Progress */}
                                {uploading && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/60">
                                                {processingAsset ? 'Processing video...' : 'Uploading...'}
                                            </span>
                                            <span className="text-white font-medium">
                                                {processingAsset ? '100%' : `${Math.round(uploadProgress)}%`}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadProgress}%` }}
                                                className="h-full bg-gradient-to-r from-[#695CFF] to-[#8B7FFF]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                                <Button
                                    onClick={handleClose}
                                    disabled={uploading}
                                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpload}
                                    disabled={uploading || !selectedFile || !genre}
                                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#695CFF] to-[#8B7FFF] text-white transition-opacity disabled:opacity-50 flex items-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {processingAsset ? 'Processing...' : 'Uploading...'}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Upload Movie
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
