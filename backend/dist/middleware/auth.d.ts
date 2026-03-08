import { Request, Response, NextFunction } from 'express';
export interface AuthRequest<Params = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<Params, ResBody, ReqBody, ReqQuery> {
    user?: {
        userId: string;
        email: string;
    };
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map