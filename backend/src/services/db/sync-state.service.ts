import { SyncProvider, SyncStatus } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

export interface SyncStateRecord {
  id: string;
  userId: string;
  provider: SyncProvider;
  lastSyncedAt: string | null;
  syncToken: string | null;
  status: SyncStatus;
  errorMessage: string | null;
  updatedAt: string;
}

export class SyncStateService {
  private inMemorySyncState: Map<string, SyncStateRecord> = new Map();

  public async getSyncState(userId: string, provider: SyncProvider): Promise<SyncStateRecord | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('sync_state')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        provider: data.provider,
        lastSyncedAt: data.last_synced_at,
        syncToken: data.sync_token,
        status: data.status,
        errorMessage: data.error_message,
        updatedAt: data.updated_at
      };
    }

    const key = `${userId}:${provider}`;
    return this.inMemorySyncState.get(key) || null;
  }

  public async updateSyncState(
    userId: string,
    provider: SyncProvider,
    updates: {
      status: SyncStatus;
      lastSyncedAt?: string | null;
      syncToken?: string | null;
      errorMessage?: string | null;
    }
  ): Promise<void> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const payload: Record<string, unknown> = {
        user_id: userId,
        provider,
        status: updates.status,
        updated_at: now
      };

      if (updates.lastSyncedAt !== undefined) {
        payload.last_synced_at = updates.lastSyncedAt;
      }
      if (updates.syncToken !== undefined) {
        payload.sync_token = updates.syncToken;
      }
      if (updates.errorMessage !== undefined) {
        payload.error_message = updates.errorMessage;
      }

      const { error } = await supabase
        .from('sync_state')
        .upsert(payload, { onConflict: 'user_id,provider' });

      if (error) {
        logger.error(`Error updating sync state for user ${userId} (${provider}):`, error.message);
      }
      return;
    }

    const key = `${userId}:${provider}`;
    const existing = this.inMemorySyncState.get(key);
    this.inMemorySyncState.set(key, {
      id: existing ? existing.id : `sync_${Date.now()}`,
      userId,
      provider,
      status: updates.status,
      lastSyncedAt: updates.lastSyncedAt !== undefined ? updates.lastSyncedAt : (existing?.lastSyncedAt || null),
      syncToken: updates.syncToken !== undefined ? updates.syncToken : (existing?.syncToken || null),
      errorMessage: updates.errorMessage !== undefined ? updates.errorMessage : (existing?.errorMessage || null),
      updatedAt: now
    });
  }
}

export const syncStateService = new SyncStateService();
