# nesthub

A collection of modular NestJS utility packages. Each module can be imported independently via sub-path exports so you only install what you need.

## Installation

```bash
npm install nesthub
```

Each sub-package has its own peer dependencies. Install only the modules you need:

| Import path | Install command | Description | README |
|---|---|---|---|
| `nesthub/typeorm` | `npm install nesthub @nestjs/typeorm @nestjs/config pg` | TypeORM configuration helpers (RDS PostgreSQL, MySQL) | [README](src/typeorm/README.md) |
| `nesthub/cache` | `npm install nesthub keyv cacheable` + `@keyv/valkey` or `@keyv/redis` | Global cache module with Valkey / Redis backend | [README](src/cache/README.md) |
| `nesthub/queue` | `npm install nesthub @nestjs/bullmq bullmq` | BullMQ config factory for Valkey / Redis backend | [README](src/queue/README.md) |
| `nesthub/notification` | `npm install nesthub` + optional peers (see [README](src/notification/README.md)) | Multi-channel notification module (email, SMS, Firebase, Telegram) with templates, queue, TypeORM persistence | [README](src/notification/README.md) |
| `nesthub/auth` | `npm install nesthub @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt otplib` | Feature-rich Auth module — JWT, OAuth, SSO, 2FA, Passkeys, magic link, OTP, session management, GDPR account deletion | [README](src/auth/README.md) |
| `nesthub/excel` | `npm install nesthub exceljs` | Export JSON data to Excel (.xlsx) — fast, zero boilerplate | [README](src/excel/README.md) |

Click each README link above for detailed usage, environment variables, and options specific to that module.

## Quick examples

### TypeORM

```bash
npm install nesthub @nestjs/typeorm @nestjs/config pg
```

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

```bash
npm install nesthub keyv cacheable @keyv/valkey
```

```typescript
import { CacheModule } from 'nesthub/cache'

@Module({
  imports: [CacheModule.forRoot({ store: 'valkey' })],
})
export class AppModule {}
```

### Queue

```bash
npm install nesthub @nestjs/bullmq bullmq
```

```typescript
import { BullModule } from '@nestjs/bullmq'
import { configBullMQ } from 'nesthub/queue'

BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: configBullMQ,
})
```

### Notification

```bash
npm install nesthub
# Optional: npm install nodemailer twilio firebase-admin handlebars @nestjs/bullmq bullmq @nestjs/typeorm typeorm
```

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

### Auth

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt otplib
```

```typescript
import { Module } from '@nestjs/common'
import { AuthModule } from 'nesthub/auth'

@Module({
  imports: [
    AuthModule.forRoot({
      security: { jwtSecret: process.env.JWT_SECRET },
      oauth: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      },
      twoFactor: { enabled: true, methods: ['totp', 'email'] },
      passkey: { enabled: true, relyingPartyId: 'example.com', origin: 'https://example.com' },
    }),
  ],
})
export class AppModule {}
```

### Excel

```bash
npm install nesthub exceljs
```

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
