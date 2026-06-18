# nesthub/queue

RDS-style config factory for [BullMQ](https://bullmq.io) (via `@nestjs/bullmq`).

Works with either Valkey (`VALKEY_URL`) or Redis (`REDIS_URL`) environment variables.

## Installation

```bash
npm install nesthub @nestjs/bullmq bullmq
```

## Usage

```typescript
import { BullModule } from '@nestjs/bullmq';
import { configBullMQ } from 'nesthub/queue';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: configBullMQ,
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'email' }),
  ],
})
export class AppModule {}
```

### Valkey (reads `VALKEY_URL` from env)

```typescript
BullModule.forRootAsync({
  // Requires VALKEY_URL in .env:
  // VALKEY_URL=valkey://localhost:6379
  useFactory: configBullMQ,
  inject: [ConfigService],
})
```

### Redis (reads `REDIS_URL` from env)

```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) =>
    configBullMQ(config, { store: 'redis' }),
  inject: [ConfigService],
})
```

### With custom prefix and default job options

```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) =>
    configBullMQ(config, {
      prefix: '{myapp}',
      defaultJobOptions: { attempts: 3, removeOnComplete: 100 },
    }),
  inject: [ConfigService],
})
```

### Direct URL (no env vars)

```typescript
BullModule.forRootAsync({
  useFactory: () => ({
    connection: { url: 'redis://user:pass@host:6379' },
    prefix: '{default}',
  }),
})
```

## QueueModuleOptions

| Option | Default | Description |
|---|---|---|
| `store` | `'valkey'` | Backend store: `'valkey'` or `'redis'` |
| `prefix` | `'{default}'` | BullMQ key prefix |
| `defaultJobOptions` | `{ removeOnComplete: true, removeOnFail: true }` | Default job options (auto-removes jobs to prevent memory overflow; override by passing same keys) |
