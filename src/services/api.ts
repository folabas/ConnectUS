// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface AuthResponse {
    userId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    token: string;
    expiresAt: string;
}

export interface UserProfile {
    userId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    createdAt?: string;
}

// Auth API Service
export const authApi = {
    // Register new user
    register: async (data: {
        email: string;
        password: string;
        fullName?: string;
    }): Promise<ApiResponse<AuthResponse>> => {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },

    // Login user
    login: async (data: {
        email: string;
        password: string;
    }): Promise<ApiResponse<AuthResponse>> => {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },

    // Logout user
    logout: async (token: string): Promise<ApiResponse> => {
        const response = await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Get current user profile
    getMe: async (token: string): Promise<ApiResponse<UserProfile>> => {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Update user profile
    updateMe: async (
        token: string,
        data: { fullName?: string; avatarUrl?: string }
    ): Promise<ApiResponse<UserProfile>> => {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },

    // Forgot password
    forgotPassword: async (email: string): Promise<ApiResponse> => {
        const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        return response.json();
    },

    // Reset password
    resetPassword: async (
        resetToken: string,
        newPassword: string
    ): Promise<ApiResponse> => {
        const response = await fetch(
            `${API_URL}/api/auth/reset-password/${resetToken}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ newPassword }),
            }
        );

        return response.json();
    },
};

// Movie API Service
// Movie API Service
export const movieApi = {
    // Get all movies with optional filters
    getAll: async (params?: { genre?: string; search?: string }): Promise<ApiResponse<any[]>> => {
        const queryParams = new URLSearchParams();
        if (params?.genre && params.genre !== 'All') queryParams.append('genre', params.genre);
        if (params?.search) queryParams.append('search', params.search);

        const response = await fetch(`${API_URL}/api/movies?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return response.json();
    },

    // Get movie by ID
    getById: async (id: string): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/movies/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return response.json();
    },

    // Create upload URL for Direct Upload
    createUploadUrl: async (token: string): Promise<ApiResponse<{ uploadUrl: string; assetId: string; uploadId: string }>> => {
        const response = await fetch(`${API_URL}/api/movies/upload-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Get upload details
    getUploadDetails: async (token: string, uploadId: string): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/movies/upload/${uploadId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        return response.json();
    },

    // Upload video file to Mux
    uploadToMux: async (uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = (e.loaded / e.total) * 100;
                    onProgress(progress);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('PUT', uploadUrl);
            xhr.send(file);
        });
    },

    // Get asset details from Mux
    getAssetDetails: async (token: string, assetId: string): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/movies/asset/${assetId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Create movie in database
    create: async (token: string, data: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },
};

// Room API Service
export const roomApi = {
    // Create a new room
    create: async (token: string, data: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },

    // Get all public rooms
    getAll: async (token: string): Promise<ApiResponse<any[]>> => {
        const response = await fetch(`${API_URL}/api/rooms`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Get room by ID
    getById: async (token: string, id: string): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/rooms/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return response.json();
    },

    // Join a room
    join: async (token: string, data: { roomId?: string; code?: string }): Promise<ApiResponse<any>> => {
        const response = await fetch(`${API_URL}/api/rooms/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        return response.json();
    },
};

// Local Storage Helpers
export const tokenStorage = {
    set: (token: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('connectus_token', token);
        }
    },

    get: (): string | null => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('connectus_token');
        }
        return null;
    },

    remove: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('connectus_token');
        }
    },
};

// User Data Storage
export const userStorage = {
    set: (user: UserProfile) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('connectus_user', JSON.stringify(user));
        }
    },

    get: (): UserProfile | null => {
        if (typeof window !== 'undefined') {
            const user = localStorage.getItem('connectus_user');
            return user ? JSON.parse(user) : null;
        }
        return null;
    },

    remove: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('connectus_user');
        }
    },
};
