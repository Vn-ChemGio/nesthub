# nesthub/notification

Multi-channel notification module for NestJS with support for email, SMS, Firebase Cloud Messaging, and Telegram.

## Features

- **4 channels**: Email, SMS, Firebase, Telegram
- **Multiple providers**: Configure many SMTP servers / SMS gateways per channel (failover chain)
- **Template engine**: Handlebars (`.hbs`) for dynamic content
- **Queue support**: Optional BullMQ integration with expiry check
- **Persistence**: Optional TypeORM-based notification logging (snake_case columns)
- **Optional dependencies**: Only install what you use

## Installation

```bash
npm install nesthub
```

### Optional channel dependencies

Only install the libraries for channels you use:

```bash
# For email (SMTP)
npm install nodemailer

# For SMS (choose your provider)
npm install twilio
# or
npm install @aws-sdk/client-sns

# For Firebase
npm install firebase-admin

# For templates
npm install handlebars

# For queue
npm install @nestjs/bullmq bullmq

# For persistence (TypeORM)
npm install @nestjs/typeorm typeorm
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { NotificationModule } from 'nesthub/notification';

@Module({
  imports: [
    NotificationModule.forRoot({
      channels: {
        email: {
          smtp: { host: 'smtp.example.com', port: 587, user: 'user', pass: 'pass' },
          defaults: { from: 'noreply@example.com' },
        },
      },
    }),
  ],
})
export class AppModule {}
```

## SMTP Configuration

Two ways to configure email:

### Explicit SMTP fields
```typescript
email: {
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,      // true for port 465
    user: 'username',
    pass: 'password',
  },
  defaults: { from: 'noreply@example.com' },
}
```

### Connection string (nodemailer transport)
```typescript
email: {
  transport: 'smtp://user:pass@smtp.example.com:587',
  defaults: { from: 'noreply@example.com' },
}
```

## Multi-Provider Failover

Pass an array of configs per channel. On failure, the next provider is tried automatically:

```typescript
channels: {
  email: [
    { smtp: { host: 'smtp1.example.com', port: 587, user: 'u1', pass: 'p1' } },
    { smtp: { host: 'smtp2.example.com', port: 587, user: 'u2', pass: 'p2' } },
  ],
}
```

## Usage

```typescript
import { Injectable } from '@nestjs/common';
import { NotificationService } from 'nesthub/notification';

@Injectable()
export class UserService {
  constructor(private readonly notification: NotificationService) {}

  async welcomeUser(email: string, name: string) {
    await this.notification.send({
      channel: 'email',
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      context: { name },
    });
  }
}
```

## API

### `NotificationModule.forRoot(options)`

| Option | Type | Description |
|--------|------|-------------|
| `channels.email` | `EmailChannelConfig \| EmailChannelConfig[]` | Email channel config(s) |
| `channels.sms` | `SmsChannelConfig \| SmsChannelConfig[]` | SMS channel config(s) |
| `channels.firebase` | `FirebaseChannelConfig \| FirebaseChannelConfig[]` | Firebase channel config(s) |
| `channels.telegram` | `TelegramChannelConfig \| TelegramChannelConfig[]` | Telegram channel config(s) |
| `templates.dir` | `string` | Directory containing `.hbs` template files |
| `queue` | `QueueConfig` | BullMQ queue configuration |
| `storage.enabled` | `boolean` | Enable notification persistence |

### `NotificationModule.forRootAsync(options)`

Use with `ConfigService` to read config from environment variables:

```typescript
NotificationModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    channels: {
      email: {
        smtp: {
          host: config.get('SMTP_HOST'),
          port: config.get('SMTP_PORT'),
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
      },
    },
    queue: {
      enabled: true,
      connection: { url: config.get('VALKEY_URL') ?? 'valkey://localhost:6379' },
    },
    templates: { dir: config.get('TEMPLATE_DIR', './templates') },
    storage: { enabled: config.get('NOTIFICATION_STORAGE', false) },
  }),
})
```

### `NotificationService`

| Method | Description |
|--------|-------------|
| `send(input)` | Send notification immediately (tries providers in order) |
| `enqueue(input)` | Queue notification for async processing |

## Template Engine

Place `.hbs` files in the configured template directory:

```hbs
<!-- templates/welcome.hbs -->
<h1>Welcome, {{name}}!</h1>
<p>Thank you for joining us.</p>
```

## Queue with Expiry Check

```typescript
NotificationModule.forRoot({
  channels: { email: { smtp: { host: '...', port: 587 } } },
  queue: {
    enabled: true,
    name: 'notifications',
    connection: { url: 'valkey://localhost:6379' },
    defaultJobOptions: { attempts: 3 },
  },
})
```

Expired notifications (those with `expiresAt` in the past) are automatically skipped.

## Persistence with TypeORM

The `NotificationLog` entity uses snake_case column names.

```typescript
import { NotificationLog, NOTIFICATION_LOG_REPOSITORY } from 'nesthub/notification';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLog]),
    NotificationModule.forRoot({
      channels: { email: { smtp: { host: '...', port: 587 } } },
      storage: { enabled: true },
    }),
  ],
  providers: [{
    provide: NOTIFICATION_LOG_REPOSITORY,
    useFactory: (repo) => repo,
    inject: [getRepositoryToken(NotificationLog)],
  }],
})
export class AppModule {}
```

### Column naming

| Entity property | DB column |
|----------------|-----------|
| `to` | `recipient_to` |
| `messageId` | `message_id` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `sentAt` | `sent_at` |

## Telegram Channel

### Configuration

```typescript
channels: {
  telegram: { botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
}
```

### Sending messages

**Text only** — sends via `/sendMessage`:
```typescript
await notification.send({
  channel: 'telegram',
  to: '1077316390',
  content: '<b>Hello</b> from HTML',
});
```

**With file attachment** — sends via `/sendDocument`, `content` becomes the caption:
```typescript
await notification.send({
  channel: 'telegram',
  to: '1077316390',
  content: 'Report attached',
  attachments: [{ filename: 'report.xlsx', content: buffer }],
});
```

**Multiple files** — sends via `/sendMediaGroup` (single request), caption on last file:
```typescript
await notification.send({
  channel: 'telegram',
  to: '1077316390',
  content: 'Monthly reports',
  attachments: [
    { filename: 'jan.xlsx', content: buf1 },
    { filename: 'feb.xlsx', content: buf2 },
  ],
});
```

**Attachment from file path:**
```typescript
await notification.send({
  channel: 'telegram',
  to: '1077316390',
  attachments: [{ filename: 'photo.jpg', path: '/tmp/photo.jpg' }],
});
```
