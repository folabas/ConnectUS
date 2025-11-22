const jwt = require('jsonwebtoken');

export interface TokenPayload {
    userId: string;
    email: string;
}

export const generateToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET || 'default-secret-change-this';
    const expiresIn = process.env.JWT_EXPIRE || '7d';

    return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET || 'default-secret-change-this';
    return jwt.verify(token, secret) as TokenPayload;
};
