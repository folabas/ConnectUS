"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.updateMe = exports.getMe = exports.logout = exports.login = exports.register = void 0;
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
// POST /api/auth/register
const register = async (req, res) => {
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
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'User with this email already exists',
            });
            return;
        }
        // Create new user
        const user = await User_1.User.create({
            email,
            password,
            fullName,
        });
        // Generate token
        const token = (0, jwt_1.generateToken)({
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
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message,
        });
    }
};
exports.register = register;
// POST /api/auth/login
const login = async (req, res) => {
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
        const user = await User_1.User.findOne({ email }).select('+password');
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
        const token = (0, jwt_1.generateToken)({
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message,
        });
    }
};
exports.login = login;
// POST /api/auth/logout
const logout = async (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    // This endpoint is optional and can be used for logging purposes
    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
};
exports.logout = logout;
// GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user?.userId);
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
            },
        });
    }
    catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
exports.getMe = getMe;
// PATCH /api/auth/me
const updateMe = async (req, res) => {
    try {
        const { fullName, avatarUrl } = req.body;
        const user = await User_1.User.findByIdAndUpdate(req.user?.userId, {
            ...(fullName && { fullName }),
            ...(avatarUrl && { avatarUrl }),
        }, { new: true, runValidators: true });
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
    }
    catch (error) {
        console.error('Update me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
exports.updateMe = updateMe;
// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email is required',
            });
            return;
        }
        const user = await User_1.User.findOne({ email });
        // Don't reveal if user exists or not for security
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent',
        });
        // TODO: Implement email sending logic
        // For now, just log the reset token
        if (user) {
            const resetToken = (0, jwt_1.generateToken)({
                userId: user._id.toString(),
                email: user.email,
            });
            console.log('Password reset token:', resetToken);
            // Send email with reset link: ${process.env.FRONTEND_URL}/reset-password/${resetToken}
        }
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
exports.forgotPassword = forgotPassword;
// POST /api/auth/reset-password/:resetToken
const resetPassword = async (req, res) => {
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
        const decoded = (0, jwt_1.verifyToken)(resetToken);
        // Update password
        const user = await User_1.User.findById(decoded.userId);
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
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(400).json({
            success: false,
            message: 'Invalid or expired reset token',
            error: error.message,
        });
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=authController.js.map