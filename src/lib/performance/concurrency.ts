import pLimit from "p-limit";
import PQueue from "p-queue";

/** Global concurrency limiters to prevent overwhelming Supabase / Oracle proxy. */
export const supabaseLimit = pLimit(6);
export const oracleLimit = pLimit(4);
export const ioLimit = pLimit(8);

/** Background queue for non-blocking tasks (audit logs, prefetch). */
export const backgroundQueue = new PQueue({ concurrency: 2, autoStart: true });

/** Retry helper with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  const { retries = 3, baseMs = 250 } = opts;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}