import { Injectable, Inject, Logger } from '@nestjs/common';
import { RATELIMIT_MODULE_OPTIONS, RATELIMIT_STORE } from './interfaces.js';
import type { RateLimitModuleOptions, RateLimitConfig } from './interfaces.js';
import type { RateLimitStore } from './stores/interfaces.js';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @Inject(RATELIMIT_MODULE_OPTIONS)
    private readonly options: RateLimitModuleOptions,
    @Inject(RATELIMIT_STORE)
    private readonly store: RateLimitStore,
  ) {}

  async check(
    key: string,
    config?: RateLimitConfig,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const ttl = (config?.ttl ?? this.options.defaultTtl ?? 60) * 1000;
    const limit = config?.limit ?? this.options.defaultLimit ?? 100;
    const fullKey = `${config?.keyPrefix ?? 'rl'}:${key}`;

    const { count, resetAt } = await this.store.increment(fullKey, ttl);

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return {
      allowed: true,
      remaining: limit - count,
      resetAt,
    };
  }

  async reset(key: string, prefix?: string): Promise<void> {
    await this.store.reset(`${prefix ?? 'rl'}:${key}`);
  }
}
