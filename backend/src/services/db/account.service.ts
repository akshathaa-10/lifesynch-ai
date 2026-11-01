import { ConnectedAccount } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

export interface SaveConnectedAccountDTO {
  userId: string;
  provider: 'google';
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  scopes: string[];
}

export class AccountService {
  private inMemoryAccounts: Map<string, ConnectedAccount & { accessToken: string; refreshToken?: string }> = new Map();

  public async saveConnectedAccount(dto: SaveConnectedAccountDTO): Promise<ConnectedAccount> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();

      const payload: Record<string, unknown> = {
        user_id: dto.userId,
        provider: dto.provider,
        provider_account_id: dto.providerAccountId,
        access_token: dto.accessToken,
        scopes: dto.scopes,
        updated_at: now
      };

      if (dto.refreshToken) {
        payload.refresh_token = dto.refreshToken;
      }
      if (dto.tokenExpiry) {
        payload.token_expiry = dto.tokenExpiry.toISOString();
      }

      const { data, error } = await supabase
        .from('connected_accounts')
        .upsert(payload, { onConflict: 'user_id,provider' })
        .select()
        .single();

      if (error) {
        logger.error('Error saving connected account to Supabase:', error.message);
        throw error;
      }

      logger.info(`Saved connected account (${dto.provider}) for user ${dto.userId}`);
      return {
        id: data.id,
        userId: data.user_id,
        provider: data.provider,
        providerAccountId: data.provider_account_id,
        scopes: data.scopes || [],
        tokenExpiry: data.token_expiry,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    const key = `${dto.userId}:${dto.provider}`;
    const account = {
      id: `acc_${Date.now()}`,
      userId: dto.userId,
      provider: dto.provider,
      providerAccountId: dto.providerAccountId,
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      tokenExpiry: dto.tokenExpiry?.toISOString(),
      scopes: dto.scopes,
      createdAt: now,
      updatedAt: now
    };
    this.inMemoryAccounts.set(key, account);
    logger.info(`[In-Memory] Saved connected account for user ${dto.userId}`);
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      scopes: account.scopes,
      tokenExpiry: account.tokenExpiry,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }

  public async getAccount(userId: string, provider: 'google') {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error) return null;
      return data;
    }

    return this.inMemoryAccounts.get(`${userId}:${provider}`) || null;
  }

  public async getAllConnectedAccounts(provider: 'google') {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('provider', provider);

      if (error) {
        logger.error(`Error querying all connected accounts for ${provider}:`, error.message);
        return [];
      }
      return data || [];
    }

    return Array.from(this.inMemoryAccounts.values()).filter(a => a.provider === provider);
  }

  public async updateTokens(
    userId: string,
    provider: 'google',
    tokens: { accessToken?: string; refreshToken?: string; tokenExpiry?: Date }
  ): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const payload: Record<string, unknown> = {
        updated_at: now
      };
      if (tokens.accessToken) {
        payload.access_token = tokens.accessToken;
      }
      if (tokens.refreshToken) {
        payload.refresh_token = tokens.refreshToken;
      }
      if (tokens.tokenExpiry) {
        payload.token_expiry = tokens.tokenExpiry.toISOString();
      }

      const { error } = await supabase
        .from('connected_accounts')
        .update(payload)
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) {
        logger.error(`Failed to update tokens for user ${userId}:`, error.message);
        throw error;
      }
      logger.info(`Updated tokens in Supabase for user ${userId} (${provider})`);
      return;
    }

    const key = `${userId}:${provider}`;
    const account = this.inMemoryAccounts.get(key);
    if (account) {
      if (tokens.accessToken) account.accessToken = tokens.accessToken;
      if (tokens.refreshToken) account.refreshToken = tokens.refreshToken;
      if (tokens.tokenExpiry) account.tokenExpiry = tokens.tokenExpiry.toISOString();
      account.updatedAt = now;
      this.inMemoryAccounts.set(key, account);
    }
  }
}

export const accountService = new AccountService();
