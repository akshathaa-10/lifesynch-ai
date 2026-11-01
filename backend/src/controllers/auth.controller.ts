import { Request, Response, NextFunction } from 'express';
import { ApiResponse, AuthSession, User } from '@lifesynch/shared';
import { googleOAuthService } from '../services/google/oauth.service';
import { autoSyncService } from '../services/auto-sync.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const getGoogleAuthUrl = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const url = googleOAuthService.getAuthorizationUrl();
    const response: ApiResponse<{ authUrl: string }> = {
      success: true,
      data: { authUrl: url },
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const handleGoogleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code as string;
    const errorParam = req.query.error as string;

    if (errorParam) {
      const redirectUrl = `${env.CLIENT_URL}/auth/callback?error=${encodeURIComponent(errorParam)}`;
      res.redirect(redirectUrl);
      return;
    }

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Missing authorization code from Google OAuth callback',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const authResult: AuthSession = await googleOAuthService.handleCallback(code);

    // Trigger immediate automatic background synchronization for the logged-in user
    autoSyncService.syncUser(authResult.user.id).catch(err => {
      logger.error(`Initial auto-sync error for user ${authResult.user.id}:`, err);
    });

    // If request accepts HTML / browser navigation, redirect to frontend with token
    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${encodeURIComponent(authResult.token)}`;
      res.redirect(redirectUrl);
      return;
    }

    // Otherwise return JSON (useful for Postman / direct API consumers)
    const response: ApiResponse<AuthSession> = {
      success: true,
      message: 'Google authentication successful',
      data: authResult,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      res.redirect(`${env.CLIENT_URL}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
      return;
    }
    next(error);
  }
};

export const getCurrentUser = (req: Request, res: Response): void => {
  const response: ApiResponse<User | null> = {
    success: true,
    data: req.user || null,
    timestamp: new Date().toISOString()
  };
  res.status(200).json(response);
};

export const logout = (_req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: true,
    message: 'User logged out successfully',
    timestamp: new Date().toISOString()
  };
  res.status(200).json(response);
};
