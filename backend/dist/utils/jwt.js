"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jwt = require('jsonwebtoken');
const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET || 'default-secret-change-this';
    const expiresIn = process.env.JWT_EXPIRE || '7d';
    return jwt.sign(payload, secret, { expiresIn });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const secret = process.env.JWT_SECRET || 'default-secret-change-this';
    return jwt.verify(token, secret);
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=jwt.js.map