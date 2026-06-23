# nesthub/calendar

Google Calendar integration for NestJS — events, availability, booking, and push notifications.

## Features

- **CRUD events** — list, get, create, update, delete calendar events
- **Free/busy** — check availability across calendars
- **Find free slots** — discover open time slots for a given duration
- **OAuth2 & Service Account** — both auth methods supported
- **Push notifications** — watch calendar changes in real-time via Google webhooks
- **Reactive webhook handling** — RxJS observable and handler-based API for incoming notifications

## Installation

```bash
npm install nesthub
npm install googleapis
```

## What it provides

### CalendarModule

A `@Global()` dynamic module registered via `forRoot()` or `forRootAsync()`.

**Options** (`CalendarModuleOptions`):

| Option | Type | Description |
|--------|------|-------------|
| `auth.type` | `'service-account' \| 'oauth2'` | Authentication method |
| `auth.credentials.clientEmail` | `string` | Service account email (service-account) |
| `auth.credentials.privateKey` | `string` | Service account private key (service-account) |
| `auth.credentials.clientId` | `string` | OAuth2 client ID (oauth2) |
| `auth.credentials.clientSecret` | `string` | OAuth2 client secret (oauth2) |
| `auth.credentials.refreshToken` | `string` | OAuth2 refresh token (oauth2) |
| `auth.scopes` | `string[]` | Google API scopes |
| `defaultCalendarId` | `string` | Default calendar to operate on |

### CalendarService

Injectable service for calendar operations:

| Method | Description |
|--------|-------------|
| `listEvents(calendarId?, options?)` | List events with optional time range, ordering |
| `getEvent(eventId, calendarId?)` | Get a single event by ID (returns `null` if 404) |
| `createEvent(event, calendarId?)` | Create a new event |
| `updateEvent(eventId, partial, calendarId?)` | Partially update an event |
| `deleteEvent(eventId, calendarId?)` | Delete an event |
| `checkAvailability(request)` | Check free/busy across calendars |
| `findFreeSlots(date, durationMinutes, calendarId?)` | Find open time slots for a given duration |
| `watchCalendar(options, calendarId?)` | Start watching a calendar for push notifications |
| `stopWatch(channelId, resourceId)` | Stop a push notification channel |

### CalendarWebhookService

Injectable service that processes incoming Google Calendar push notifications:

| Method / Property | Description |
|-------------------|-------------|
| `processNotification(payload, verifyToken?)` | Handle incoming webhook payload from your controller |
| `events$` | RxJS `Observable<CalendarWebhookEvent>` to subscribe to changes reactively |
| `onCalendarEvent(handler)` | Register a callback `(payload, events) => void` for each change |

### Interfaces

| Interface | Description |
|-----------|-------------|
| `CalendarModuleOptions` | Module configuration |
| `CalendarEvent` | Event object for create/update/list |
| `FreeBusyRequest` | Free/busy query parameters |
| `FreeBusyResult` | Free/busy response |
| `ListEventsOptions` | Event listing filters |
| `CalendarWatchOptions` | Watch channel configuration |
| `CalendarWatchResponse` | Watch channel creation response |
| `CalendarWebhookPayload` | Incoming push notification payload |
| `CalendarWatchChannel` | Stored watch channel info |
| `CalendarWebhookHandler` | `(payload, events) => void` callback type |

## Usage

### Basic setup

```typescript
import { Module } from '@nestjs/common';
import { CalendarModule } from 'nesthub/calendar';

@Module({
  imports: [
    CalendarModule.forRoot({
      auth: {
        type: 'service-account',
        credentials: {
          clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
          privateKey: process.env.GOOGLE_PRIVATE_KEY,
        },
      },
      defaultCalendarId: 'primary',
    }),
  ],
})
export class AppModule {}
```

### CRUD operations

```typescript
import { Injectable } from '@nestjs/common';
import { CalendarService, CalendarEvent } from 'nesthub/calendar';

@Injectable()
export class BookingService {
  constructor(private readonly calendar: CalendarService) {}

  async listUpcomingEvents() {
    return this.calendar.listEvents('primary', {
      timeMin: new Date().toISOString(),
      maxResults: 20,
      orderBy: 'startTime',
    });
  }

  async getEvent(id: string) {
    return this.calendar.getEvent(id);
  }

  async createMeeting(event: CalendarEvent) {
    return this.calendar.createEvent(event);
  }

  async rescheduleEvent(eventId: string, start: string, end: string) {
    return this.calendar.updateEvent(eventId, { start: { dateTime: start }, end: { dateTime: end } });
  }

  async cancelEvent(eventId: string) {
    return this.calendar.deleteEvent(eventId);
  }
}
```

### Availability & free slots

```typescript
@Injectable()
export class AvailabilityService {
  constructor(private readonly calendar: CalendarService) {}

  async checkBusySlots(date: string) {
    return this.calendar.checkAvailability({
      timeMin: `${date}T00:00:00Z`,
      timeMax: `${date}T23:59:59Z`,
    });
  }

  async findAvailableSlots(date: string) {
    return this.calendar.findFreeSlots(date, 30);
  }
}
```

### CalendarWatchOptions reference

When calling `watchCalendar()`, you provide a `CalendarWatchOptions` object. Below is a detailed explanation of each field and how to set them up.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | A unique UUID identifying this watch channel. Google uses this to detect duplicate channels. Use `crypto.randomUUID()`. |
| `type` | `'web_hook'` | ✅ | The channel delivery mechanism. Must be `'web_hook'` for push notifications. |
| `address` | `string` | ✅ | Your public HTTPS endpoint that receives notifications (e.g., `https://your-domain.com/api/calendar/webhook`). Google sends POST requests here. **Must be HTTPS** — HTTP is rejected. |
| `token` | `string` | ❌ | An arbitrary secret string sent as the `X-Goog-Channel-Token` header with each notification. Use this in `processNotification()` to verify requests genuinely came from Google. |
| `expiration` | `string` | ❌ | RFC 3339 timestamp (e.g., `'2025-12-31T23:59:59Z'`) indicating when the channel expires. If omitted, Google sets a default (usually 7 days). Max is 7 days from creation. |
| `params` | `Record<string, string>` | ❌ | Optional query parameters appended to the `resourceUri` in notifications. For example, `{ ttl: '3600' }` helps Google determine retry behaviour. |
| `calendarId` | `string` | ❌ | Convenience field — overrides the `calendarId` argument passed to `watchCalendar()`. Not sent to the Google API. |

#### How to obtain / generate each parameter

- **`id`** — Always generate a fresh UUID per channel:
  ```typescript
  id: crypto.randomUUID()
  ```
  Persist the returned `id` (channel ID) and `resourceId` from `CalendarWatchResponse` so you can call `stopWatch()` later.

- **`type`** — Hard-code `'web_hook'`:
  ```typescript
  type: 'web_hook'
  ```

- **`address`** — The public URL of your controller endpoint. Ensure this endpoint:
  - Is publicly accessible over HTTPS
  - Returns `200 OK` quickly (Google retries on timeout)
  - Responds to the initial empty POST validation (Google sends one with no `X-Goog-*` headers)
  ```typescript
  address: 'https://your-domain.com/api/calendar/webhook'
  ```

- **`token`** (optional) — A secret known only to your app, e.g. from an environment variable:
  ```typescript
  token: process.env.CALENDAR_WEBHOOK_TOKEN
  ```
  Verify it when processing notifications:
  ```typescript
  await this.webhook.processNotification(payload, process.env.CALENDAR_WEBHOOK_TOKEN);
  ```

- **`expiration`** (optional) — Generate a timestamp up to ~7 days in the future:
  ```typescript
  expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  ```

- **`params`** (optional) — Arbitrary key-value pairs. These appear in the `resourceUri` of subsequent notifications:
  ```typescript
  params: { ttl: '3600', source: 'my-app' }
  ```

- **`calendarId`** (optional) — If set, this overrides the second argument of `watchCalendar()`:
  ```typescript
  // Both calls watch 'custom-calendar':
  await service.watchCalendar({ id, type, address, calendarId: 'custom-calendar' });
  await service.watchCalendar({ id, type, address }, 'custom-calendar');
  ```

### Push notifications (Google Calendar webhooks)

Google Calendar can push notifications to your server when events change directly on Google (not via your app).

#### 1. Start watching a calendar

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { CalendarService } from 'nesthub/calendar';

@Injectable()
export class CalendarWatcherService implements OnModuleInit {
  constructor(private readonly calendar: CalendarService) {}

  async onModuleInit() {
    const response = await this.calendar.watchCalendar({
      id: crypto.randomUUID(),
      type: 'web_hook',
      address: 'https://your-domain.com/api/calendar/webhook',
      token: 'your-verification-token',
    });

    console.log('Watch channel created:', response);
    // Store response.resourceId and response.id to stop later
  }
}
```

#### 2. Handle incoming notifications in your controller

```typescript
import { Controller, Post, Headers, Body, Req } from '@nestjs/common';
import { CalendarWebhookService, CalendarWebhookPayload } from 'nesthub/calendar';
import type { Request } from 'express';

@Controller('calendar')
export class CalendarWebhookController {
  constructor(private readonly webhook: CalendarWebhookService) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('x-goog-resource-state') resourceState: string,
    @Headers('x-goog-resource-id') resourceId: string,
    @Headers('x-goog-resource-uri') resourceUri: string,
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-channel-token') channelToken: string,
    @Headers('x-goog-channel-expiration') channelExpiration: string,
    @Req() req: Request,
  ) {
    if (!resourceState) {
      // Google sends an empty POST to validate the endpoint initially
      return { ok: true };
    }

    const payload: CalendarWebhookPayload = {
      resourceState: resourceState as 'sync' | 'exists',
      resourceId,
      resourceUri,
      channelId,
      channelToken,
      channelExpiration,
    };

    await this.webhook.processNotification(payload, 'your-verification-token');
    return { ok: true };
  }
}
```

#### 3. React to changes reactively

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CalendarWebhookService } from 'nesthub/calendar';
import { Subscription } from 'rxjs';

@Injectable()
export class CalendarSyncService implements OnModuleInit, OnModuleDestroy {
  private subscription: Subscription;

  constructor(private readonly webhook: CalendarWebhookService) {}

  onModuleInit() {
    this.subscription = this.webhook.events$.subscribe(({ payload, events }) => {
      console.log(`Change detected: ${payload.resourceState}`, events);
      // Sync with your database, notify users, etc.
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }
}
```

#### 4. Or use the callback API

```typescript
this.webhook.onCalendarEvent((payload, events) => {
  console.log(`Calendar changed: ${payload.resourceId}`);
  for (const event of events) {
    // Handle each changed event
  }
});
```

#### 5. Stop watching when no longer needed

```typescript
await this.calendar.stopWatch(channelId, resourceId);
```

### Async registration

```typescript
CalendarModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    auth: {
      type: 'service-account',
      credentials: {
        clientEmail: config.get('GOOGLE_CLIENT_EMAIL'),
        privateKey: config.get('GOOGLE_PRIVATE_KEY'),
      },
    },
    defaultCalendarId: config.get('GOOGLE_CALENDAR_ID'),
  }),
});
```
