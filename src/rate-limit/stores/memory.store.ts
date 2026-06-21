import type { RateLimitStore } from './interfaces.js';

interface Entry {
  count: number;
  resetAt: number;
}

export class MemoryStore implements RateLimitStore {
  private readonly store = new Map<string, Entry>();

  increment(
    key: string,
    ttl: number,
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + ttl };
      this.store.set(key, entry);
      return Promise.resolve({ count: 1, resetAt: entry.resetAt });
    }

    entry.count++;
    return Promise.resolve({ count: entry.count, resetAt: entry.resetAt });
  }

  reset(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
