import { Router } from 'express';
import { authenticate, asyncHandler } from '@gleps/shared';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Public routes
router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

// Protected routes
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/verify-password', authenticate, asyncHandler(authController.verifyPassword));

export default router;
