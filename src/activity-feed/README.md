# nesthub/activity-feed

User activity feed for NestJS — in-app notifications and activity streams.

## Features

- **In-app notifications** — push activity events to user feeds
- **Read tracking** — mark individual or bulk activities as read
- **Unread counts** — get unread count per user
- **Organization scoping** — filter activities by organization
- **TypeORM integration** — works with your existing database (PostgreSQL, MySQL, SQLite, etc.)
- **No external dependencies** — only needs `@nestjs/typeorm` and `typeorm`

## Installation

```bash
npm install nesthub/activity-feed
```

Ensure `@nestjs/typeorm` and `typeorm` are installed and your root `TypeOrmModule` is configured.

## Usage

### Module registration

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityFeedModule } from 'nesthub/activity-feed';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* your DB config */ }),
    ActivityFeedModule,
  ],
})
export class AppModule {}
```

> **Note**: `ActivityFeedModule` is `@Global()`, so you only need to import it once.

### Service injection

```typescript
import { Injectable } from '@nestjs/common';
import { ActivityFeedService } from 'nesthub/activity-feed';

@Injectable()
export class PostService {
  constructor(private readonly activityFeed: ActivityFeedService) {}

  async createPost(userId: string, title: string) {
    const post = await this.savePost(userId, title);

    await this.activityFeed.add({
      type: 'post.created',
      actorId: userId,
      userId,
      targetId: post.id,
      targetType: 'post',
      metadata: { title },
      organizationId: post.orgId,
    });

    return post;
  }
}
```

### Entity

The module provides an `ActivityFeedEntity` that creates the `activity_feed` table:

### Custom repository override

The module internally uses `ACTIVITY_FEED_REPOSITORY` pointing to the TypeORM entity repository. Override it with `ACTIVITY_FEED_REPOSITORY` to use a different backend:

```typescript
import { Module } from '@nestjs/common';
import { ActivityFeedModule, ACTIVITY_FEED_REPOSITORY } from 'nesthub/activity-feed';

const MyRepo = {
  create: (data: any) => data,
  save: async (data: any) => ({ id: 'custom', ...data }),
  find: async () => [],
  update: async () => ({ affected: 1, raw: {}, generatedMaps: [] }),
  count: async () => 0,
};

@Module({
  imports: [ActivityFeedModule],
  providers: [
    { provide: ACTIVITY_FEED_REPOSITORY, useValue: MyRepo },
  ],
})
export class AppModule {}
```

The `ACTIVITY_FEED_REPOSITORY` token is exported from `nesthub/activity-feed`. The injected contract matches `Repository<ActivityFeedEntity>` from TypeORM (`create`, `save`, `find`, `update`, `count`).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `type` | varchar(100) | Activity type |
| `actor_id` | varchar(255) | Who performed the action |
| `actor_name` | varchar(255) | Display name (optional) |
| `actor_avatar` | varchar(1024) | Avatar URL (optional) |
| `target_id` | varchar(255) | Target resource ID (optional) |
| `target_type` | varchar(100) | Target resource type (optional) |
| `metadata` | simple-json | Arbitrary extra data (optional) |
| `organization_id` | varchar(255) | Org scope (optional) |
| `user_id` | varchar(255) | Feed owner |
| `read` | boolean | Read status |
| `created_at` | timestamp | Auto-generated |

## API

### ActivityFeedService

| Method | Description |
|--------|-------------|
| `add(input)` | Create a new activity entry |
| `list(userId, limit?)` | Get user's activity feed (newest first, default 20) |
| `markAsRead(id, userId)` | Mark a single activity as read |
| `markAllAsRead(userId)` | Mark all unread activities as read |
| `getUnreadCount(userId)` | Get count of unread activities |
| `listByOrganization(organizationId, limit?)` | Get org-wide activities (default 50) |

### ActivityEntry (input fields)

When calling `add()`, provide these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Activity type (e.g. `post.created`, `comment.added`) |
| `actorId` | `string` | Yes | ID of the user who performed the action |
| `userId` | `string` | Yes | ID of the user who owns this feed entry |
| `targetId` | `string` | No | ID of the target resource |
| `targetType` | `string` | No | Type of the target resource (e.g. `post`, `comment`) |
| `actorName` | `string` | No | Display name of the actor |
| `actorAvatar` | `string` | No | Avatar URL of the actor |
| `metadata` | `Record<string, unknown>` | No | Arbitrary extra data |
| `organizationId` | `string` | No | Scope to an organization |

The `id`, `read`, and `createdAt` fields are automatically generated.

## Examples

### Add activity with actor details

```typescript
await activityFeed.add({
  type: 'user.followed',
  actorId: 'user-b',
  actorName: 'Bob Smith',
  actorAvatar: 'https://example.com/avatars/bob.jpg',
  userId: 'user-a',
  targetId: 'user-a',
  targetType: 'user',
});
```

### Fetch feed and show unread badge

```typescript
const [activities, unread] = await Promise.all([
  activityFeed.list(currentUser.id),
  activityFeed.getUnreadCount(currentUser.id),
]);

// Display badge: Activities (3 unread)
console.log(`Activities (${unread} unread)`);
for (const activity of activities) {
  console.log(`[${activity.read ? '✓' : '○'}] ${activity.type} by ${activity.actorId}`);
}
```

### Mark activities as read

```typescript
// Mark single
await activityFeed.markAsRead(activityId, userId);

// Mark all as read
await activityFeed.markAllAsRead(userId);
```

### Organization feed

```typescript
const orgFeed = await activityFeed.listByOrganization(orgId, 10);
```
