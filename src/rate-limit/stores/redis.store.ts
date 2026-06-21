import type { RateLimitStore } from './interfaces.js';
import type { RedisClient } from '../interfaces.js';

const INCR_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  local pttl = redis.call('PTTL', KEYS[1])
  return {count, pttl}
`;

export class RedisStore implements RateLimitStore {
  constructor(private readonly client: RedisClient) {}

  async increment(
    key: string,
    ttl: number,
  ): Promise<{ count: number; resetAt: number }> {
    const result = (await this.client.eval(INCR_SCRIPT, 1, key, ttl)) as [
      number,
      number,
    ];
    const count = Number(result[0]);
    const pttl = Number(result[1]);
    return { count, resetAt: Date.now() + pttl };
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key);
  }
}
