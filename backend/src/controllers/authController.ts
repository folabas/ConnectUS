import { Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken, verifyToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
            return;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'User with this email already exists',
            });
            return;
        }

        // Create new user
        const user = await User.create({
            email,
            password,
            fullName,
        });

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
        });

        res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            },
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message,
        });
    }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
            return;
        }

        // Find user and include password field
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
        });

        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message,
        });
    }
};

// POST /api/auth/logout
export const logout = async (req: Request, res: Response): Promise<void> => {
    // With JWT, logout is handled client-side by removing the token
    // This endpoint is optional and can be used for logging purposes
    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.user?.userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
                sessionsHosted: user.sessionsHosted,
                moviesWatched: user.moviesWatched,
                hoursWatched: user.hoursWatched,
                watchHistory: user.watchHistory,
            },
        });
    } catch (error: any) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// PATCH /api/auth/me
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { fullName, avatarUrl } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user?.userId,
            {
                ...(fullName && { fullName }),
                ...(avatarUrl && { avatarUrl }),
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error: any) {
        console.error('Update me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email is required',
            });
            return;
        }

        const user = await User.findOne({ email });

        // Don't reveal if user exists or not for security
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent',
        });

        // Send password reset email if user exists
        if (user) {
            const resetToken = generateToken({
                userId: user._id.toString(),
                email: user.email,
            });

            // Import emailService at the top of the file
            const { emailService } = await import('../services/emailService');

            await emailService.sendPasswordReset(
                user.email,
                user.fullName || user.email,
                resetToken
            );

            console.log('Password reset email sent to:', user.email);
        }
    } catch (error: any) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/auth/reset-password/:resetToken
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { resetToken } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            res.status(400).json({
                success: false,
                message: 'New password is required',
            });
            return;
        }

        // Verify reset token
        const decoded = verifyToken(resetToken);

        // Update password
        const user = await User.findById(decoded.userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });
    } catch (error: any) {
        console.error('Reset password error:', error);
        res.status(400).json({
            success: false,
            message: 'Invalid or expired reset token',
            error: error.message,
        });
    }
};
