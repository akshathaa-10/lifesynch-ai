import { User } from '@lifesynch/shared';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

export interface UpsertUserDTO {
  email: string;
  name?: string;
  picture?: string;
}

export class UserService {
  // In-memory user store fallback when Supabase keys are not yet configured in .env
  private inMemoryUsers: Map<string, User> = new Map();

  public async upsertUser(dto: UpsertUserDTO): Promise<User> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      
      // Query existing user by email
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', dto.email)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        logger.error('Error querying user in Supabase:', selectError.message);
        throw selectError;
      }

      if (existingUser) {
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update({
            name: dto.name || existingUser.name,
            picture: dto.picture || existingUser.picture,
            updated_at: now
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          logger.error('Error updating user in Supabase:', updateError.message);
          throw updateError;
        }

        logger.info(`Updated existing user: ${dto.email} (${existingUser.id})`);
        return this.mapSupabaseUser(updated);
      }

      // Insert new user
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({
          email: dto.email,
          name: dto.name,
          picture: dto.picture,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Error creating user in Supabase:', insertError.message);
        throw insertError;
      }

      logger.info(`Created new user in Supabase: ${dto.email} (${created.id})`);
      return this.mapSupabaseUser(created);
    }

    // In-memory fallback
    let user = Array.from(this.inMemoryUsers.values()).find(u => u.email === dto.email);
    if (user) {
      user = {
        ...user,
        name: dto.name || user.name,
        picture: dto.picture || user.picture,
        updatedAt: now
      };
      this.inMemoryUsers.set(user.id, user);
      logger.info(`[In-Memory] Updated user: ${dto.email} (${user.id})`);
      return user;
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: dto.email,
      name: dto.name,
      picture: dto.picture,
      createdAt: now,
      updatedAt: now
    };
    this.inMemoryUsers.set(newUser.id, newUser);
    logger.info(`[In-Memory] Created new user: ${dto.email} (${newUser.id})`);
    return newUser;
  }

  public async getUserById(id: string): Promise<User | null> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      // Query connected accounts
      const { data: accounts } = await supabase
        .from('connected_accounts')
        .select('id, user_id, provider, provider_account_id, scopes, token_expiry, created_at, updated_at')
        .eq('user_id', id);

      const user = this.mapSupabaseUser(data);
      if (accounts) {
        user.connectedAccounts = accounts.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          userId: String(a.user_id),
          provider: 'google',
          providerAccountId: String(a.provider_account_id),
          scopes: Array.isArray(a.scopes) ? a.scopes : [],
          tokenExpiry: a.token_expiry ? String(a.token_expiry) : undefined,
          createdAt: String(a.created_at),
          updatedAt: String(a.updated_at)
        }));
        user.hasGmailAccess = user.connectedAccounts.some(a =>
          a.scopes.some(s => s.includes('gmail'))
        );
        user.hasCalendarAccess = user.connectedAccounts.some(a =>
          a.scopes.some(s => s.includes('calendar'))
        );
      }

      return user;
    }

    return this.inMemoryUsers.get(id) || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSupabaseUser(record: any): User {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      picture: record.picture,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

export const userService = new UserService();
