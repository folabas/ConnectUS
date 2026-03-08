"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = exports.authMiddleware = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = require("../models/User");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'No token provided. Authorization denied.',
            });
            return;
        }
        const token = authHeader.substring(7);
        const decoded = (0, jwt_1.verifyToken)(token);
        console.log('[AUTH DEBUG] Token decoded:', decoded);
        console.log('[AUTH DEBUG] User ID from token:', decoded?.userId);
        // Check if user still exists
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User no longer exists. Authorization denied.',
            });
            return;
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Authorization denied.',
        });
    }
};
exports.authMiddleware = authMiddleware;
// Alias for consistency with common naming conventions
exports.protect = exports.authMiddleware;
//# sourceMappingURL=auth.js.map