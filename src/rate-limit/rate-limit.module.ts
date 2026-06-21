import { Global, Module, DynamicModule } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { RATELIMIT_MODULE_OPTIONS, RATELIMIT_STORE } from './interfaces.js';
import type { RateLimitModuleOptions, RedisClient } from './interfaces.js';
import type { RateLimitStore } from './stores';
import { MemoryStore } from './stores';

function createStoreProvider(options: RateLimitModuleOptions) {
  if (options.store === 'redis') {
    return {
      provide: RATELIMIT_STORE,
      useFactory: async (): Promise<RateLimitStore> => {
        let client: RedisClient;
        if (options.redis) {
          client = options.redis;
        } else {
          const Redis = (await import('ioredis')).default as unknown as new (
            url: string,
          ) => RedisClient;
          client = new Redis(options.redisUrl ?? 'redis://localhost:6379');
        }
        const { RedisStore } = await import('./stores/redis.store.js');
        return new RedisStore(client);
      },
    };
  }

  return {
    provide: RATELIMIT_STORE,
    useValue: new MemoryStore(),
  };
}

@Global()
@Module({})
export class RateLimitModule {
  static forRoot(options?: RateLimitModuleOptions): DynamicModule {
    const opts: RateLimitModuleOptions = options ?? {};
    return {
      module: RateLimitModule,
      providers: [
        { provide: RATELIMIT_MODULE_OPTIONS, useValue: opts },
        createStoreProvider(opts),
        RateLimitService,
      ],
      exports: [RateLimitService],
    };
  }
}
