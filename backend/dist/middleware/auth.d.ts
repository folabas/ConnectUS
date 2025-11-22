import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map