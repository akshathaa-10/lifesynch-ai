import { Router } from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getCurrentUser,
  logout
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/v1/auth/google -> returns redirect URL
router.get('/google', getGoogleAuthUrl);

// GET /api/v1/auth/google/callback -> handles redirect from Google
router.get('/google/callback', handleGoogleCallback);

// GET /api/v1/auth/me -> protected current user session
router.get('/me', requireAuth, getCurrentUser);

// POST /api/v1/auth/logout -> user sign out
router.post('/logout', logout);

export default router;
