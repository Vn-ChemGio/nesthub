export interface RedisClient {
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

export interface RateLimitModuleOptions {
  store?: 'memory' | 'redis';
  redisUrl?: string;
  redis?: RedisClient;
  defaultTtl?: number;
  defaultLimit?: number;
}

export interface RateLimitConfig {
  ttl: number;
  limit: number;
  keyPrefix?: string;
}

export const RATELIMIT_MODULE_OPTIONS = 'RATELIMIT_MODULE_OPTIONS';
export const RATELIMIT_STORE = 'RATELIMIT_STORE';
