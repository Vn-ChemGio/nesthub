# nesthub/rbac

Role‑based access control (RBAC), permission guards, and feature flags for NestJS — designed for distributed systems.

## Features

- **Default roles** with granular action/resource permissions (owner, admin, member, viewer)
- **`@Permissions()` / `@RequireRole()` decorators** — declarative access control on any route
- **`RbacGuard`** — reads decorator metadata and enforces permissions at the controller level
- **`PermissionStore` abstraction** — pluggable permission storage (in‑memory, TypeORM, or custom)
- **Distributed caching** — in‑memory TTL cache to reduce repeated store lookups; `invalidateCache()` for immediate invalidation
- **TypeORM integration** — ready‑to‑use entities (`RbacRoleEntity`, `RbacUserRoleEntity`) and `TypeOrmPermissionStore`
- **Feature flags** — programmatic gating with `isFeatureEnabled()` / `filterEnabledFlags()`

## Installation

```bash
npm install nesthub
```

> Requires `@nestjs/common`, `@nestjs/core` (peer dependencies of NestJS).
> For TypeORM integration you also need `@nestjs/typeorm` and `typeorm`.
> For Redis caching you also need the `nesthub/cache` module.

## Quick start

```typescript
import { Module } from '@nestjs/common';
import { RbacModule } from 'nesthub/rbac';

@Module({
  imports: [RbacModule.forRoot()],
})
export class AppModule {}
```

Then inject `RbacService` anywhere:

```typescript
import { Injectable } from '@nestjs/common';
import { RbacService } from 'nesthub/rbac';

@Injectable()
export class PostService {
  constructor(private readonly rbac: RbacService) {}

  deletePost(userRole: string) {
    if (!this.rbac.hasPermission(userRole, 'delete', 'post')) {
      throw new Error('Forbidden');
    }
    // …
  }
}
```

## Default roles

| Role     | Permissions                                                    |
|----------|----------------------------------------------------------------|
| `owner`  | `*:*` (everything)                                             |
| `admin`  | `*:*` (everything)                                             |
| `member` | `read:*`, `create:post`, `update:post`, `delete:post`          |
| `viewer` | `read:*`                                                       |

You can add, remove, or query permissions programmatically via `RbacService` (see below).

## API reference

### `RbacModule`

A `@Global()` dynamic module registered via `forRoot()` or `forRootAsync()`.

**Options** (`RbacModuleOptions`):

| Option                      | Type                              | Default     | Description                                  |
|-----------------------------|-----------------------------------|-------------|----------------------------------------------|
| `typeorm.enabled`           | `boolean`                         | `false`     | Use `TypeOrmPermissionStore` instead of in‑memory |
| `cache.ttl`                 | `number` (ms)                     | `60000`     | How long user permissions are cached          |
| `override.permissionStore`  | `Type<PermissionStore>`           | —           | Provide a custom `PermissionStore` class      |

### `RbacService`

Injectable service for permission checks and role management.

#### Role‑based permission checks (in‑memory, no store required)

| Method                                              | Description                                    |
|-----------------------------------------------------|------------------------------------------------|
| `hasPermission(role, action, resource)`             | Check if a role has a specific permission      |
| `addPermissions(role, perms[])`                     | Add permissions to an existing role            |
| `removePermissions(role, resources?)`               | Remove permissions (or entire role)            |
| `getRolePermissions(role)`                          | List all permissions for a role                |

#### User‑based permission checks (requires `PermissionStore`)

| Method                                              | Description                                          |
|-----------------------------------------------------|------------------------------------------------------|
| `getUserPermissions(userId)`                        | Get all permissions for a user (cached)              |
| `getUserRoles(userId)`                              | Get all roles for a user (cached)                    |
| `hasUserPermission(userId, action, resource)`       | Check if a user has a specific permission (cached)   |
| `invalidateCache(userId?)`                          | Flush cache for one user or the entire cache         |

#### Feature flags

| Method                                              | Description                    |
|-----------------------------------------------------|--------------------------------|
| `isFeatureEnabled(flag)`                            | Check if a feature flag is on  |
| `filterEnabledFlags(flags[])`                       | Return only enabled flags      |

### `RbacGuard`

A `CanActivate` guard that enforces `@RequireRole()` and `@Permissions()` decorators.

**Behaviour:**
1. If no metadata is present → **allow** (pass through)
2. If `@RequireRole('admin')` is set → checks `request.user.roles` includes the required role
3. If `@Permissions('delete', 'post')` is set → calls `RbacService.hasUserPermission()` (if a `PermissionStore` is configured) or falls back to `RbacService.hasPermission()` for each user role
4. Missing user → throws `ForbiddenException`

Usage:

```typescript
import { Controller, UseGuards, Get, Delete } from '@nestjs/common';
import { RbacGuard, RequireRole, Permissions } from 'nesthub/rbac';

@Controller('posts')
@UseGuards(RbacGuard)
export class PostController {
  @Get()
  @RequireRole('admin', 'member')
  findAll() { }

  @Delete(':id')
  @Permissions('delete', 'post')
  remove() { }
}
```

> Combine `RbacGuard` with your authentication guard. Ensure `request.user` is set by an `AuthGuard` beforehand.

### `PermissionStore` (abstract class)

Define a custom permission storage backend:

```typescript
import { PermissionStore, Permission } from 'nesthub/rbac';

export class MyPermissionStore extends PermissionStore {
  async getUserPermissions(userId: string): Promise<Permission[]> { … }
  async getUserRoles(userId: string): Promise<string[]> { … }
}
```

Register it via module options:

```typescript
RbacModule.forRoot({
  override: { permissionStore: MyPermissionStore },
})
```

## TypeORM integration

When `typeorm.enabled: true`, the module creates a `TypeOrmPermissionStore` that reads permissions from the database.

### 1. Register the module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from 'nesthub/rbac';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* your DB config */ }),
    RbacModule.forRoot({ typeorm: { enabled: true } }),
  ],
})
export class AppModule {}
```

### 2. Import entities in your feature module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacRoleEntity, RbacUserRoleEntity } from 'nesthub/rbac';

@Module({
  imports: [
    TypeOrmModule.forFeature([RbacRoleEntity, RbacUserRoleEntity]),
  ],
})
export class MyModule {}
```

### 3. Seed roles

Insert default roles into `rbac_roles` table:

```sql
INSERT INTO rbac_roles (name, permissions) VALUES
  ('owner',  '[{"action": "*", "resource": "*"}]'),
  ('admin',  '[{"action": "*", "resource": "*"}]'),
  ('member', '[{"action": "read", "resource": "*"}, {"action": "create", "resource": "post"}, {"action": "update", "resource": "post"}, {"action": "delete", "resource": "post"}]'),
  ('viewer', '[{"action": "read", "resource": "*"}]');
```

Then assign roles to users:

```typescript
import { Injectable } from '@nestjs/common';
import { RbacService, PermissionStore, InMemoryPermissionStore } from 'nesthub/rbac';

@Injectable()
export class SetupService {
  constructor(private readonly rbac: RbacService) {}

  async assignUserRole(userId: string, roleName: string) {
    // In-memory store
    if (this.permissionStore instanceof InMemoryPermissionStore) {
      this.permissionStore.assignRole(userId, roleName);
    }
  }
}
```

> **Tip**: For TypeORM, use the `TypeOrmPermissionStore` directly by injecting `RBAC_PERMISSION_STORE`:
> ```typescript
> import { Inject } from '@nestjs/common';
> import { RBAC_PERMISSION_STORE, PermissionStore } from 'nesthub/rbac';
>
> constructor(
>   @Inject(RBAC_PERMISSION_STORE)
>   private readonly store: PermissionStore,
> ) {}
> ```

## Distributed cache optimisation

The `RbacService` caches every `getUserPermissions` / `getUserRoles` result in memory with a configurable TTL. This reduces repeated store lookups in high‑throughput scenarios.

| Cache method                  | Description                                        |
|-------------------------------|----------------------------------------------------|
| `cache.ttl` in module options | Set TTL in ms (default `60000` = 1 minute)         |
| `invalidateCache(userId)`     | Immediately evict cache for one user               |
| `invalidateCache()`           | Evict the entire permission cache                  |

**Best practices for distributed deployments:**

1. **Use a short TTL** (e.g., 10–30 s) so stale permissions are cleared quickly.
2. **Invalidate on write** — whenever a role is assigned/removed in your application, call `rbacService.invalidateCache(userId)`.
3. **Combine with Redis** — the in‑memory cache is per‑process. For multi‑instance deployments, pair with `nesthub/cache` and broadcast invalidation events (e.g., via Redis Pub/Sub).
4. **Avoid the store on every request** — the guard always uses the cached version; the store is only queried on cache miss.

```typescript
// Invalidation example
async function assignRole(userId: string, role: string) {
  await this.roleAssignmentService.assign(userId, role);
  this.rbacService.invalidateCache(userId); // next request sees new permissions
}
```

## `@RequireRole()` decorator

```typescript
@RequireRole('admin')
@RequireRole('admin', 'owner')         // any of these roles
```

Use with `RbacGuard` to restrict access by role name.

## `@Permissions()` decorator

```typescript
@Permissions('delete', 'post')    // action, resource
@Permissions('*', 'settings')     // wildcard action
```

Use with `RbacGuard` to check granular action/resource permissions.

## Async registration

```typescript
RbacModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    cache: { ttl: config.get('RBAC_CACHE_TTL', 30000) },
    typeorm: { enabled: config.get('RBAC_TYPEORM_ENABLED', true) },
  }),
});
```

## Complete example

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RbacModule, RbacGuard } from 'nesthub/rbac';

@Module({
  imports: [RbacModule.forRoot()],
  providers: [
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AppModule {}
```

Now every controller automatically enforces `@RequireRole()` and `@Permissions()` decorators.

---

## Injection tokens

| Token                     | Description                              |
|---------------------------|------------------------------------------|
| `RBAC_MODULE_OPTIONS`     | Current `RbacModuleOptions`              |
| `RBAC_PERMISSION_STORE`   | The active `PermissionStore` instance    |
| `RBAC_PERMISSIONS`        | The in‑memory `Map<string, Permission[]>` of role definitions |

Use them with `@Inject()` when you need direct access:

```typescript
import { Inject } from '@nestjs/common';
import { RBAC_PERMISSION_STORE, PermissionStore } from 'nesthub/rbac';

export class MyService {
  constructor(
    @Inject(RBAC_PERMISSION_STORE)
    private readonly store: PermissionStore,
  ) {}
}
```
