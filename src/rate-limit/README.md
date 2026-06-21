# nesthub/rate-limit

Rate limiting module for NestJS with pluggable stores. Supports in-memory (single-instance) and Redis (multi-instance) backends.

## Installation

Already included with `nesthub`. No extra install needed for the default in-memory store.

For Redis store: `npm install ioredis`

## Quick Start

```typescript
import { RateLimitModule, RateLimitService } from 'nesthub/rate-limit';

@Module({
  imports: [RateLimitModule.forRoot({ defaultLimit: 100, defaultTtl: 60 })],
})
export class AppModule {}

// In a service:
@Injectable()
export class MyService {
  constructor(private readonly rateLimit: RateLimitService) {}

  async someAction(userId: string) {
    const { allowed, remaining, resetAt } = await this.rateLimit.check(userId);
    if (!allowed) {
      throw new Error(`Rate limited. Try again at ${new Date(resetAt)}`);
    }
  }
}
```

## Configuration

### `RateLimitModule.forRoot(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `store` | `'memory' \| 'redis'` | `'memory'` | Backend store |
| `defaultTtl` | `number` | `60` | Default window (seconds) |
| `defaultLimit` | `number` | `100` | Max requests per window |
| `redisUrl` | `string` | — | Redis connection string (when `store: 'redis'`) |
| `redis` | `RedisClient` | — | Pre-configured ioredis instance |

### `RateLimitConfig` (per-call override)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ttl` | `number` | `defaultTtl` | Window in seconds |
| `limit` | `number` | `defaultLimit` | Max requests |
| `keyPrefix` | `string` | `'rl'` | Prefix for the store key |

## Stores

### Memory Store (default)

Single-instance, no external dependencies. All counters live in-process.

```typescript
RateLimitModule.forRoot({ defaultLimit: 30, defaultTtl: 10 })
```

### Redis Store (multi-instance)

Use Redis to share rate limit state across instances. Uses a Lua script for atomic increment + TTL.

```typescript
// With connection string:
RateLimitModule.forRoot({
  store: 'redis',
  redisUrl: 'redis://localhost:6379',
  defaultLimit: 100,
  defaultTtl: 60,
})

// With existing ioredis client:
import Redis from 'ioredis';
const redis = new Redis();

RateLimitModule.forRoot({
  store: 'redis',
  redis,
  defaultLimit: 100,
})
```

How it works:
- Each `check()` call runs an atomic Lua script: `INCR` key, `PEXPIRE` on first creation, returns count + remaining TTL
- Parallel-safe across any number of instances
- Keys auto-expire after the TTL window

### Custom Store

Implement the `RateLimitStore` interface:

```typescript
import type { RateLimitStore } from 'nesthub/rate-limit';

class MyStore implements RateLimitStore {
  async increment(key: string, ttl: number) {
    // return { count, resetAt }
  }
  async reset(key: string) {
    // delete key
  }
}
```

Then provide it via the `RATELIMIT_STORE` token.

## API

### `RateLimitService.check(key, config?)`

```typescript
const result = await rateLimit.check('user-42', { ttl: 5, limit: 3 });

// result: { allowed: boolean; remaining: number; resetAt: number }
```

- `allowed` — `true` if under the limit
- `remaining` — requests left in the window (capped at 0)
- `resetAt` — epoch ms when the window resets

### `RateLimitService.reset(key, prefix?)`

```typescript
await rateLimit.reset('user-42');          // default prefix 'rl'
await rateLimit.reset('user-42', 'custom'); // custom prefix
```

## Examples

### Rate-limit by IP

```typescript
async checkIp(req: Request) {
  const ip = req.ip;
  const result = await this.rateLimit.check(ip, { ttl: 10, limit: 5 });
  if (!result.allowed) {
    throw new HttpException('Too Many Requests', 429);
  }
}
```

### Different limits per route

```typescript
await rateLimit.check('login:user-42', { ttl: 60, limit: 5 });
await rateLimit.check('api:user-42', { ttl: 1, limit: 30 });
```

### Reset after successful action

```typescript
await rateLimit.reset('login:user-42');
```
