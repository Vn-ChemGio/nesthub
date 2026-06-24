# nesthub/webhook

Outgoing and incoming webhook management for NestJS.

## Features

- **Outgoing webhooks** — send with exponential backoff retry
- **HMAC signature** — verify incoming and sign outgoing payloads (SHA‑256 / SHA‑1)
- **Event bus** — in‑memory pub/sub for decoupled webhook emission
- **Queue integration** — optional [@nestjs/bullmq](https://docs.nestjs.com/techniques/queues) queue for delivery **that survives restarts**
- **Database persistence** — optional TypeORM / custom store for delivery logs
- **Circuit breaker** — stop hammering dead URLs after repeated failures
- **Incoming webhook controller** — auto‑registered controller with signature verification

## Installation

```bash
npm install nesthub
```

Optional peer dependencies:

| Feature | Install |
|---------|---------|
| BullMQ queue | `npm install @nestjs/bullmq bullmq` |
| TypeORM storage | `npm install @nestjs/typeorm typeorm` |

---

## Module registration

```typescript
import { Module } from '@nestjs/common';
import { WebhookModule } from 'nesthub/webhook';

@Module({
  imports: [await WebhookModule.forRoot({ ... })],
})
export class AppModule {}
```

`forRoot` is `async` because it dynamically imports optional peer deps (`@nestjs/typeorm`) only when storage is enabled.

---

## Configuration

```typescript
interface WebhookModuleOptions {
  outgoing?: {
    defaultTimeout?: number;    // 10000
    defaultRetries?: number;    // 3
    defaultRetryDelay?: number; // 1000
  };
  queue?: {
    enabled: boolean;
  };
  storage?: {
    enabled: boolean;
    store?: Type<WebhookDeliveryStore>;
  };
  circuitBreaker?: {
    enabled: boolean;
    threshold?: number;         // 5
    cooldownMs?: number;        // 30000
  };
  incoming?: {
    path?: string;
    secret?: string;
    signatureHeader?: string;
    signatureAlgorithm?: 'hmac-sha256' | 'hmac-sha1';
  };
}
```

---

## Usage examples

> `BullModule.forRoot*` must be configured **before** `WebhookModule` when queue is enabled.

---

### Minimal — no queue, no store

Basic outgoing webhook with in‑memory retry.

```typescript
import { Module } from '@nestjs/common';
import { WebhookModule } from 'nesthub/webhook';

@Module({
  imports: [await WebhookModule.forRoot()],
})
export class AppModule {}
```

---

### Queue only

Delivery survives restarts via Redis + BullMQ. Configure `BullModule.forRoot*` before `WebhookModule`.

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookModule } from 'nesthub/webhook';

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL! } }),
    await WebhookModule.forRoot({ queue: { enabled: true } }),
  ],
})
export class AppModule {}
```

Usage:

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookQueueService } from 'nesthub/webhook';

@Injectable()
export class OrderService {
  constructor(private readonly queue: WebhookQueueService) {}

  async orderCreated(order: any) {
    await this.queue.enqueue(
      { id: `order-${order.id}`, type: 'order.created', payload: order, timestamp: new Date() },
      { url: 'https://partner.com/webhook' },
    );
  }
}
```

The `WebhookProcessor` worker processes jobs asynchronously. If the process crashes mid‑job, BullMQ retries it automatically.

---

### Storage — TypeORM

Delivery logs persisted to database.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule, WebhookDeliveryEntity } from 'nesthub/webhook';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [WebhookDeliveryEntity],
      synchronize: true,
    }),
    await WebhookModule.forRoot({ storage: { enabled: true } }),
  ],
})
export class AppModule {}
```

When `storage: { enabled: true }` with no `store`, the module auto‑imports `TypeOrmModule.forFeature([WebhookDeliveryEntity])`.

Each delivery attempt is logged with status: `queued` → `delivering` → `delivered` | `failed`.

---

### Storage — custom store

Implement `WebhookDeliveryStore` for MongoDB, filesystem, etc.

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookDeliveryStore, WebhookDeliveryRecord } from 'nesthub/webhook';

@Injectable()
export class MongoDeliveryStore extends WebhookDeliveryStore {
  async upsert(id: string, data: Partial<WebhookDeliveryRecord>): Promise<void> {
    await this.collection.updateOne({ id }, { $set: data }, { upsert: true });
  }
}
```

```typescript
await WebhookModule.forRoot({
  storage: { enabled: true, store: MongoDeliveryStore },
})
```

---

### Circuit breaker

Stop sending to dead URLs after repeated failures.

```typescript
await WebhookModule.forRoot({
  circuitBreaker: { enabled: true, threshold: 3, cooldownMs: 30000 },
})
```

When the circuit is open for a URL, `send()` returns failure immediately without making a request.

---

### Queue + storage (full production)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WebhookModule, WebhookDeliveryEntity } from 'nesthub/webhook';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [WebhookDeliveryEntity],
    }),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL! } }),
    await WebhookModule.forRoot({
      queue: { enabled: true },
      storage: { enabled: true },
      circuitBreaker: { enabled: true, threshold: 5, cooldownMs: 30000 },
    }),
  ],
})
export class AppModule {}
```

### Incoming controller

Auto‑registers `WebhookController` at POST `/`. The controller is always present but inert when `incoming` is not configured — it just returns `{ ok: true }`.

```typescript
await WebhookModule.forRoot({
  incoming: {
    secret: process.env.PARTNER_SECRET,
    signatureHeader: 'x-signature-256',
    signatureAlgorithm: 'hmac-sha256',
  },
})
```

---

## Send flow

```
send(event, config)
  ├─ Circuit breaker open? → return failure
  ├─ Save "queued" to store
  ├─ Loop: try request
  │    ├─ Success → save "delivered", reset circuit breaker, return
  │    └─ Failure → exponential backoff, retry
  └─ All retries exhausted → save "failed", open circuit breaker
```

## Exports

| Export | Description |
|--------|-------------|
| `WebhookModule` | Main dynamic module |
| `WebhookQueueModule` | Sub‑module for the BullMQ queue |
| `WebhookService` | Send webhooks with retry + persistence |
| `WebhookQueueService` | Enqueue webhooks via BullMQ |
| `WebhookProcessor` | Default worker for the `webhook` queue |
| `WebhookEventBus` | In‑memory pub/sub |
| `WebhookCircuitBreaker` | Circuit breaker for dead URLs |
| `WebhookController` | Incoming webhook handler |
| `WebhookDeliveryStore` | Abstract store — extend for custom backends |
| `TypeOrmWebhookDeliveryStore` | TypeORM implementation of `WebhookDeliveryStore` |
| `WebhookDeliveryEntity` | TypeORM entity for delivery log |
| `WebhookDeliveryRecord` | Shape of a delivery record |
| `WEBHOOK_QUEUE_NAME` | Queue name constant (`'webhook'`) |
| `WEBHOOK_MODULE_OPTIONS` | Injection token for module config |

## Testing

```bash
npx jest src/webhook/index.spec.ts
```

Tests cover: HMAC verification, event bus, delivery retry, circuit breaker, module resolution with storage.
