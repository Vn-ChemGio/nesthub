import { Injectable, Optional, Inject } from '@nestjs/common';
import type { Cacheable } from 'cacheable';

export const CACHE_MANAGER = 'CACHE_MANAGER';

@Injectable()
export class TokenBlacklistService {
  private readonly store = new Map<string, number>();

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cacheable,
  ) {}

  async blacklist(jti: string, expiresAt: Date): Promise<void> {
    const expiry = expiresAt.getTime();
    const ttl = Math.max(1, expiry - Date.now());

    if (this.cache) {
      await this.cache.set(`blacklist:${jti}`, true, ttl);
      return;
    }

    this.store.set(jti, expiry);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    if (this.cache) {
      const cached = await this.cache.get(`blacklist:${jti}`);
      return cached !== undefined && cached !== null;
    }

    const expiry = this.store.get(jti);
    if (!expiry) return false;
    if (expiry < Date.now()) {
      this.store.delete(jti);
      return false;
    }
    return true;
  }
}
