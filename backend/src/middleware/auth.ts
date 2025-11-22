import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
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

        const decoded = verifyToken(token);
        req.user = decoded;

        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Authorization denied.',
        });
    }
};
