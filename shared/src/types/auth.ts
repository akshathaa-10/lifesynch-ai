export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: 'google';
  providerAccountId: string;
  scopes: string[];
  tokenExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  hasGmailAccess?: boolean;
  hasCalendarAccess?: boolean;
  connectedAccounts?: ConnectedAccount[];
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface JwtUserPayload {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface GoogleOAuthPayload {
  code: string;
  redirectUri?: string;
}
