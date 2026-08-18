import { useState } from 'react';

/** Transcoding poll cadence: up to 60s total. */
const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, movieApi } from '@/lib/api';
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

        setUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: reserve a direct-upload slot.
            toast.info('Preparing upload…');
            const { uploadUrl, uploadId, assetId: initialAssetId } =
                await movieApi.createUploadUrl();

            let assetId = initialAssetId;

            // Step 2: send the file straight to the storage provider.
            toast.info('Uploading video…');
            await movieApi.uploadFile(uploadUrl, selectedFile, setUploadProgress);

            setUploadProgress(100);
            setProcessingAsset(true);

            // Step 3: the asset id is assigned asynchronously after the bytes land.
            if (!assetId) {
                toast.info('Finalising upload…');
                for (let attempt = 0; attempt < POLL_ATTEMPTS && !assetId; attempt++) {
                    await wait(POLL_INTERVAL_MS);
                    const upload = await movieApi.getUpload(uploadId);
                    if (upload.assetId) assetId = upload.assetId;
                }
            }

            if (!assetId) {
                throw new Error('The upload did not finish in time. Please try again.');
            }

            // Step 4: wait for transcoding to produce a playable rendition.
            toast.info('Processing video…');
            let asset: Awaited<ReturnType<typeof movieApi.getAsset>> | null = null;
            for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
                await wait(POLL_INTERVAL_MS);
                const current = await movieApi.getAsset(assetId);
                if (current.status === 'ready' && current.playbackId) {
                    asset = current;
                    break;
                }
            }

            if (!asset?.playbackId) {
                throw new Error(
                    'Processing is taking longer than expected. The film will appear in your library once it finishes.',
                );
            }

            // Step 5: record it in the library.
            toast.info('Saving…');
            await movieApi.create({
                title: title.trim(),
                genre,
                muxAssetId: assetId,
                muxPlaybackId: asset.playbackId,
                duration: asset.duration,
                image: posterUrl || asset.thumbnailUrl || undefined,
                source: 'upload',
            });

            toast.success('Movie uploaded.');

            setSelectedFile(null);
            setTitle('');
            setGenre('');
            setPosterUrl('');
            setUploadProgress(0);

            onSuccess();
            onClose();
        } catch (error) {
            toast.error(errorMessage(error));
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
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-soft)] flex items-center justify-center">
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
                                            ? 'border-[var(--brand)] bg-[var(--brand)]/10'
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
                                        className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-[var(--brand)] focus:bg-white/10 transition-colors disabled:opacity-50"
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
                                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[var(--brand)] focus:bg-white/10"
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
                                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:border-[var(--brand)] focus:bg-white/10"
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
                                                className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-soft)]"
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
                                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-soft)] text-white transition-opacity disabled:opacity-50 flex items-center gap-2"
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
