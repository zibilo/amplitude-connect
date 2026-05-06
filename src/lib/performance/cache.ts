import { LRUCache } from "lru-cache";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

/** Fast in-memory LRU cache (RIB validations, lookups, computed rows). */
export const memoryCache = new LRUCache<string, unknown>({
  max: 5000,
  ttl: 1000 * 60 * 15,
});

/** Persistent IndexedDB cache for heavy/offline data (Oracle mirror, ref tables). */
export const persistentCache = {
  get: <T>(key: string) => idbGet<T>(key),
  set: <T>(key: string, value: T) => idbSet(key, value),
  del: (key: string) => idbDel(key),
};

/** Memoize an async function with LRU + TTL. */
export function memoizeAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
  ttlMs = 60_000,
) {
  const cache = new LRUCache<string, Promise<TResult>>({ max: 1000, ttl: ttlMs });
  return (...args: TArgs): Promise<TResult> => {
    const key = keyFn(...args);
    const hit = cache.get(key);
    if (hit) return hit;
    const p = fn(...args).catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
    return p;
  };
}