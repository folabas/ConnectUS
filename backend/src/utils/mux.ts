import Mux from '@mux/mux-node';

let muxClient: Mux | null = null;

const getMuxClient = () => {
    if (!muxClient) {
        if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
            throw new Error('Mux credentials missing from environment variables');
        }
        muxClient = new Mux({
            tokenId: process.env.MUX_TOKEN_ID,
            tokenSecret: process.env.MUX_TOKEN_SECRET,
        });
    }
    return muxClient;
};

export interface DirectUploadResponse {
    uploadUrl: string;
    assetId: string;
    uploadId: string;
}

/**
 * Create a Direct Upload URL for video uploads
 * @returns Upload URL, Asset ID (if available), and Upload ID
 */
export const createDirectUpload = async (): Promise<DirectUploadResponse> => {
    try {
        const mux = getMuxClient();
        const upload = await mux.video.uploads.create({
            new_asset_settings: {
                playback_policy: ['public'],
            },
            cors_origin: '*', // In production, set this to your frontend domain
        });

        console.log('Mux Upload Response:', JSON.stringify(upload, null, 2));

        return {
            uploadUrl: upload.url,
            assetId: upload.asset_id || '',
            uploadId: upload.id,
        };
    } catch (error) {
        console.error('Error creating Mux Direct Upload:', error);
        throw new Error('Failed to create upload URL');
    }
};

/**
 * Get upload details from Mux
 * @param uploadId - Mux Upload ID
 * @returns Upload details including status and asset_id
 */
export const getUploadDetails = async (uploadId: string) => {
    try {
        const mux = getMuxClient();
        const upload = await mux.video.uploads.retrieve(uploadId);
        return upload;
    } catch (error) {
        console.error('Error retrieving Mux upload:', error);
        throw new Error('Failed to retrieve upload details');
    }
};

/**
 * Get asset details from Mux
 * @param assetId - Mux Asset ID
 * @returns Asset details including playback ID and duration
 */
export const getAssetDetails = async (assetId: string) => {
    try {
        const mux = getMuxClient();
        const asset = await mux.video.assets.retrieve(assetId);
        return asset;
    } catch (error) {
        console.error('Error retrieving Mux asset:', error);
        throw new Error('Failed to retrieve asset details');
    }
};

/**
 * Format duration from seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g., "2h 15m")
 */
export const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

// Export getMuxClient for cases where direct access is needed
export default getMuxClient;
