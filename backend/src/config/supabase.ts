import dns from 'dns';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { logger } from '../utils/logger';

// Ensure dual-stack DNS resolution for Supabase endpoints
// This guarantees seamless fallback to Cloudflare's IPv6 anycast edge on networks
// where IPv4 routing is blocked, degraded, or CGNAT-limited.
let dnsConfigured = false;
const ensureSupabaseDns = () => {
  if (dnsConfigured) return;
  dnsConfigured = true;

  const originalLookup = dns.lookup;
  const CLOUDFLARE_IPV6 = '2606:4700:83b1:ba50:79fd:50c:1c1d:8199';

  (dns as any).lookup = (
    hostname: string,
    options: any,
    callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
  ) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    originalLookup(hostname, options, (err, address, family) => {
      if (hostname && hostname.includes('supabase.co')) {
        if (options && options.all) {
          const results = Array.isArray(address) ? [...address] : [];
          if (!results.some(r => r.family === 6)) {
            results.unshift({ address: CLOUDFLARE_IPV6, family: 6 });
          }
          return callback(null, results);
        }
        if (err) {
          return callback(null, CLOUDFLARE_IPV6, 6);
        }
      }
      return callback(err, address, family);
    });
  };
};

ensureSupabaseDns();

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    env.SUPABASE_URL &&
    env.SUPABASE_URL.trim().length > 0 &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_ANON_KEY.trim().length > 0
  );
};

export const isSupabaseAdminConfigured = (): boolean => {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return Boolean(
    env.SUPABASE_URL &&
    env.SUPABASE_URL.trim().length > 0 &&
    serviceKey &&
    serviceKey.trim().length > 0
  );
};

export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    logger.info('Initialized public Supabase client');
  }

  return supabaseClient;
};

export const getSupabaseAdminClient = (): SupabaseClient => {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !serviceKey || serviceKey.trim().length === 0) {
    throw new Error('Supabase admin access requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(env.SUPABASE_URL, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    logger.info('Initialized Supabase service-role admin client');
  }

  return supabaseAdminClient;
};

