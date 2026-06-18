# nesthub

A collection of modular NestJS utility packages. Each module can be imported independently via sub-path exports so you only install what you need.

## Installation

```bash
npm install nesthub
```

## Available modules

| Import path | Description | README |
|---|---|---|
| `nesthub/typeorm` | TypeORM configuration helpers (RDS PostgreSQL, MySQL) | [README](src/typeorm/README.md) |
| `nesthub/cache` | Global cache module with Valkey / Redis backend | [README](src/cache/README.md) |
| `nesthub/queue` | BullMQ config factory for Valkey / Redis backend | [README](src/queue/README.md) |
| `nesthub/notification` | Multi-channel notification module (email, SMS, Firebase, Telegram) with templates, queue, TypeORM persistence | [README](src/notification/README.md) |
| `nesthub/excel` | Export JSON data to Excel (.xlsx) — fast, zero boilerplate | [README](src/excel/README.md) |

Click each README link above for detailed usage, environment variables, and options specific to that module.

## Quick examples

### TypeORM

```typescript
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { configTypeOrmRDSPostgres } from 'nesthub/typeorm'

TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    configTypeOrmRDSPostgres(config, { poolSize: 20 }),
})
```

### Cache

```typescript
import { CacheModule } from 'nesthub/cache'

@Module({
  imports: [CacheModule.forRoot({ store: 'valkey' })],
})
export class AppModule {}
```

### Queue

```typescript
import { BullModule } from '@nestjs/bullmq'
import { configBullMQ } from 'nesthub/queue'

BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: configBullMQ,
})
```

### Notification

```typescript
import { Module } from '@nestjs/common'
import { NotificationModule } from 'nesthub/notification'

@Module({
  imports: [
    NotificationModule.forRoot({
      channels: {
        email: { smtp: { host: 'smtp.example.com', port: 587 } },
        sms: { provider: 'twilio', credentials: { accountSid: '...', authToken: '...' }, from: '+123' },
      },
      templates: { dir: './templates' },
      queue: { enabled: true, connection: { url: 'valkey://localhost:6379' } },
      storage: { enabled: true },
    }),
  ],
})
export class AppModule {}
```

### Excel

```typescript
import { exportToBuffer, exportToFile, exportToResponse } from 'nesthub/excel'

// Get buffer
const buffer = await exportToBuffer(users, {
  columns: ['name', 'email'],
  formatters: { active: (v) => (v ? 'Yes' : 'No') },
})

// Write to file
await exportToFile(users, './reports/users.xlsx')

// Send as download in controller
@Get('download')
async download(@Res() res: any) {
  await exportToResponse(users, res, 'users.xlsx')
}
```

## License

MIT
