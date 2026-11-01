import { google } from 'googleapis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { userService } from '../db/user.service';
import { accountService } from '../db/account.service';
import { signUserToken } from '../../utils/jwt';
import { AuthSession } from '@lifesynch/shared';

export class GoogleOAuthService {
  private readonly scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  private getCredentials() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI
    };
  }

  public isConfigured(): boolean {
    const creds = this.getCredentials();
    return Boolean(creds.clientId && creds.clientSecret);
  }

  public getClient(tokens?: { access_token?: string; refresh_token?: string }) {
    const creds = this.getCredentials();
    const client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      creds.redirectUri
    );
    if (tokens) {
      client.setCredentials(tokens);
    }
    return client;
  }

  public getAuthorizationUrl(): string {
    if (!this.isConfigured()) {
      throw new Error(
        'Google OAuth credentials not configured in environment. Please provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.'
      );
    }

    const client = this.getClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scopes,
      include_granted_scopes: true
    });
  }

  public async handleCallback(code: string): Promise<AuthSession> {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials not configured in environment.');
    }

    const client = this.getClient();
    logger.info('Exchanging authorization code for OAuth tokens with Google...');
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch user profile from Google OAuth2 API
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new Error('Failed to retrieve user email from Google OAuth profile.');
    }

    // 1. Upsert user in database
    const user = await userService.upsertUser({
      email: profile.email,
      name: profile.name || undefined,
      picture: profile.picture || undefined
    });

    // 2. Persist connected Google account with tokens
    if (tokens.access_token) {
      await accountService.saveConnectedAccount({
        userId: user.id,
        provider: 'google',
        providerAccountId: profile.id || profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scopes: this.scopes
      });
    }

    // 3. Issue signed JWT session token
    const token = signUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture
    });

    // 4. Retrieve complete user profile including connected account flags
    const fullUser = (await userService.getUserById(user.id)) || user;

    logger.info(`Google authentication completed successfully for: ${user.email}`);

    return {
      token,
      user: fullUser
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();
