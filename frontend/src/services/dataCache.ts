/**
 * Local Persisted Cache for LifeSynch AI
 * 
 * Provides immediate instant-load on first boot or hard page refresh (Stale-While-Revalidate).
 * Prevents zero counts, visual popping, layout shifts, and redundant API calls.
 */

const CACHE_PREFIX = 'lifesynch_cache_v1';

export const dataCache = {
  get<T>(userId: string | undefined, key: string, defaultValue: T): T {
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultValue;
    }

    try {
      const userKey = userId || 'default';
      const raw = localStorage.getItem(`${CACHE_PREFIX}_${userKey}_${key}`);
      if (!raw) return defaultValue;

      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(defaultValue) && !Array.isArray(parsed.data)) {
        return defaultValue;
      }
      return parsed.data !== undefined ? (parsed.data as T) : defaultValue;
    } catch (e) {
      console.warn(`[dataCache] Failed to read ${key} from cache:`, e);
      return defaultValue;
    }
  },

  set<T>(userId: string | undefined, key: string, data: T): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const userKey = userId || 'default';
      const payload = {
        data,
        cachedAt: Date.now()
      };
      localStorage.setItem(`${CACHE_PREFIX}_${userKey}_${key}`, JSON.stringify(payload));
    } catch (e) {
      // LocalStorage quota may be reached or disabled
      console.warn(`[dataCache] Failed to write ${key} to cache:`, e);
    }
  },

  hasCache(userId: string | undefined, key: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    try {
      const userKey = userId || 'default';
      const raw = localStorage.getItem(`${CACHE_PREFIX}_${userKey}_${key}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.data)) {
        return parsed.data.length > 0;
      }
      return parsed?.data !== undefined;
    } catch {
      return false;
    }
  },

  hasAnyUserCache(userId: string | undefined): boolean {
    return this.hasCache(userId, 'tasks') || this.hasCache(userId, 'emails') || this.hasCache(userId, 'calendar');
  },

  clear(userId: string | undefined): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userKey = userId || 'default';
      const prefix = `${CACHE_PREFIX}_${userKey}_`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[dataCache] Failed to clear user cache:', e);
    }
  }
};

