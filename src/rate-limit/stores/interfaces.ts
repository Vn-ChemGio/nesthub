export interface RateLimitStore {
  increment(
    key: string,
    ttl: number,
  ): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}
