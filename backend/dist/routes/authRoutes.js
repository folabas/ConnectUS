"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/logout', authController_1.logout);
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/reset-password/:resetToken', authController_1.resetPassword);
// Protected routes (require authentication)
router.get('/me', auth_1.authMiddleware, authController_1.getMe);
router.patch('/me', auth_1.authMiddleware, authController_1.updateMe);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map