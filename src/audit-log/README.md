# nesthub/audit-log

Audit trail for NestJS — track who did what and when.

## Features

- **Automatic audit trail** — log every action with resource, user, and context
- **Structured diffs** — track before/after values for updates
- **Filter by resource, user, or organization** — flexible querying
- **IP & user-agent capture** — built-in request context fields
- **TypeORM integration** — works with your existing database (PostgreSQL, MySQL, SQLite, etc.)
- **Custom repository support** — use any backend by providing your own repository

## Installation

```bash
npm install nesthub/audit-log
```

Ensure `@nestjs/typeorm` and `typeorm` are installed and your root `TypeOrmModule` is configured.

## Usage

### Module registration

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from 'nesthub/audit-log';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* your DB config */ }),
    AuditLogModule.forRoot(),
  ],
})
export class AppModule {}
```

> **Note**: `AuditLogModule` is `@Global()`, so you only need to import it once.

### Service injection

```typescript
import { Injectable } from '@nestjs/common';
import { AuditLogService } from 'nesthub/audit-log';

@Injectable()
export class UserService {
  constructor(private readonly auditLog: AuditLogService) {}

  async updateUser(id: string, data: any) {
    const before = await this.findUser(id);
    await this.saveUser(id, data);

    await this.auditLog.log({
      action: 'user.updated',
      resource: 'user',
      resourceId: id,
      userId: id,
      metadata: { updatedFields: Object.keys(data) },
      diff: {
        email: { from: before.email, to: data.email },
        name: { from: before.name, to: data.name },
      },
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });
  }
}
```

### Entity

The module provides an `AuditLogEntity` that creates the `audit_log` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `action` | varchar(100) | Audited action (e.g. `user.login`, `order.created`) |
| `resource` | varchar(255) | Resource type (e.g. `user`, `order`) |
| `resource_id` | varchar(255) | Target resource ID (optional) |
| `user_id` | varchar(255) | Who performed the action (optional) |
| `organization_id` | varchar(255) | Org scope (optional) |
| `metadata` | simple-json | Arbitrary extra data (optional) |
| `diff` | simple-json | Before/after diff (optional) |
| `ip` | varchar(45) | Client IP address (optional) |
| `user_agent` | varchar(500) | User-Agent string (optional) |
| `created_at` | timestamp | Auto-generated |

### Custom repository override

The module internally uses `AUDITLOG_REPOSITORY` pointing to the TypeORM entity repository. Override it with `AUDITLOG_REPOSITORY` to use a different backend:

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule, AUDITLOG_REPOSITORY } from 'nesthub/audit-log';

const MyRepo = {
  create: (data: any) => data,
  save: async (data: any) => ({ id: 'custom', ...data }),
  find: async () => [],
};

@Module({
  imports: [AuditLogModule.forRoot()],
  providers: [
    { provide: AUDITLOG_REPOSITORY, useValue: MyRepo },
  ],
})
export class AppModule {}
```

The `AUDITLOG_REPOSITORY` token is exported from `nesthub/audit-log`. The injected contract matches `Repository<AuditLogEntity>` from TypeORM (`create`, `save`, `find`).

### Disable TypeORM

If you want to use a completely custom backend, disable TypeORM and provide your own repository:

```typescript
AuditLogModule.forRoot({ typeorm: { enabled: false } })
```

Then provide `AUDITLOG_REPOSITORY` in your module as shown above.

## API

### AuditLogService

| Method | Description |
|--------|-------------|
| `log(entry)` | Create a new audit log entry |
| `findByResource(resource, resourceId)` | Get audit entries for a specific resource |
| `findByUser(userId, limit?)` | Get audit entries by user (default 50) |
| `findByOrganization(organizationId, limit?)` | Get audit entries by organization (default 50) |

### AuditLogEntry (input fields)

When calling `log()`, provide these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | Yes | Action name (e.g. `user.login`, `order.created`) |
| `resource` | `string` | Yes | Resource type (e.g. `user`, `order`) |
| `resourceId` | `string` | No | ID of the target resource |
| `userId` | `string` | No | ID of the user who performed the action |
| `organizationId` | `string` | No | Scope to an organization |
| `metadata` | `Record<string, unknown>` | No | Arbitrary extra data |
| `diff` | `Record<string, { from: unknown; to: unknown }>` | No | Before/after values |
| `ip` | `string` | No | Client IP address |
| `userAgent` | `string` | No | User-Agent header |

The `id` and `createdAt` fields are automatically generated.

## Examples

### Log user login

```typescript
await auditLog.log({
  action: 'user.login',
  resource: 'user',
  resourceId: 'user-1',
  userId: 'user-1',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
});
```

### Log resource update with diff

```typescript
await auditLog.log({
  action: 'order.updated',
  resource: 'order',
  resourceId: 'order-42',
  userId: 'user-5',
  metadata: { reason: 'price adjustment' },
  diff: {
    total: { from: 99.99, to: 89.99 },
    status: { from: 'pending', to: 'confirmed' },
  },
  organizationId: 'org-acme',
});
```

### Query audit trail

```typescript
// By resource
const resourceLogs = await auditLog.findByResource('order', 'order-42');

// By user (last 20)
const userLogs = await auditLog.findByUser('user-5', 20);

// By organization (last 100)
const orgLogs = await auditLog.findByOrganization('org-acme', 100);
```

## Cloud Integration

When `typeorm: { enabled: false }`, you can direct audit logs to cloud audit services by providing a custom `AUDITLOG_REPOSITORY`.

### Google Cloud Audit Logs

Install the Google Cloud Logging client:

```bash
npm install @google-cloud/logging
```

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule, AUDITLOG_REPOSITORY } from 'nesthub/audit-log';
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const log = logging.log('audit-trail');

const GoogleCloudAuditRepo = {
  create: (data: any) => data,
  async save(data: any) {
    const metadata = {
      resource: { type: 'global' },
      labels: {
        action: data.action,
        resource: data.resource,
        userId: data.userId ?? '',
      },
    };
    const entry = log.entry(metadata, {
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      userId: data.userId,
      organizationId: data.organizationId,
      metadata: data.metadata,
      diff: data.diff,
      ip: data.ip,
      userAgent: data.userAgent,
    });
    await log.write(entry);
    return { id: entry.id, ...data, createdAt: new Date() };
  },
  async find(query: any) {
    const where = query.where ?? {};
    const filterParts = [
      `logName="${log.logName_}"`,
      ...Object.entries(where)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `jsonPayload.${k}="${v}"`),
    ];
    const entries = await logging.getEntries({
      filter: filterParts.join(' AND '),
      pageSize: query.take ?? 50,
      orderBy: 'timestamp desc',
    });
    return entries[0].map((e: any) => ({
      id: e.metadata.insertId,
      action: e.data?.jsonPayload?.action,
      resource: e.data?.jsonPayload?.resource,
      resourceId: e.data?.jsonPayload?.resourceId,
      userId: e.data?.jsonPayload?.userId,
      organizationId: e.data?.jsonPayload?.organizationId,
      metadata: e.data?.jsonPayload?.metadata,
      diff: e.data?.jsonPayload?.diff,
      ip: e.data?.jsonPayload?.ip,
      userAgent: e.data?.jsonPayload?.userAgent,
      createdAt: new Date(e.data?.timestamp),
    }));
  },
};

@Module({
  imports: [AuditLogModule.forRoot({ typeorm: { enabled: false } })],
  providers: [
    { provide: AUDITLOG_REPOSITORY, useValue: GoogleCloudAuditRepo },
  ],
})
export class AppModule {}
```

### AWS CloudTrail

Install the AWS CloudTrail client:

```bash
npm install @aws-sdk/client-cloudtrail
```

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule, AUDITLOG_REPOSITORY } from 'nesthub/audit-log';
import { CloudTrailClient, PutAuditEventsCommand } from '@aws-sdk/client-cloudtrail';

const cloudTrail = new CloudTrailClient({ region: process.env.AWS_REGION });

const AwsCloudTrailRepo = {
  create: (data: any) => data,
  async save(data: any) {
    await cloudTrail.send(new PutAuditEventsCommand({
      AuditEvents: [{
        EventName: data.action,
        EventSource: data.resource,
        Resources: data.resourceId
          ? [{ ResourceName: data.resourceId, ResourceType: data.resource }]
          : undefined,
        UserIdentity: data.userId ? { PrincipalId: data.userId } : undefined,
        AdditionalEventData: JSON.stringify({
          organizationId: data.organizationId,
          metadata: data.metadata,
          diff: data.diff,
          ip: data.ip,
          userAgent: data.userAgent,
        }),
      }],
    }));
    return { id: crypto.randomUUID(), ...data, createdAt: new Date() };
  },
  find: async () => [],
};

@Module({
  imports: [AuditLogModule.forRoot({ typeorm: { enabled: false } })],
  providers: [
    { provide: AUDITLOG_REPOSITORY, useValue: AwsCloudTrailRepo },
  ],
})
export class AppModule {}
```

> **Note**: AWS CloudTrail `PutAuditEvents` is ingested as a customer-authored event. Events appear in CloudTrail ~5 minutes after submission.

### Oracle Cloud Infrastructure (OCI) Audit

Install the OCI SDK:

```bash
npm install oci-sdk
```

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule, AUDITLOG_REPOSITORY } from 'nesthub/audit-log';
import common from 'oci-common';
import { LoggingManagementClient, LoggingSearchClient } from 'oci-loggingingestion';
import { AuditClient } from 'oci-audit';

const provider = new common.ConfigFileAuthenticationDetailsProvider();
const loggingClient = new LoggingManagementClient({ authenticationDetailsProvider: provider });
const searchClient = new LoggingSearchClient({ authenticationDetailsProvider: provider });
const auditClient = new AuditClient({ authenticationDetailsProvider: provider });

const LOG_GROUP_ID = process.env.OCI_LOG_GROUP_ID!;

const OciAuditRepo = {
  create: (data: any) => data,
  async save(data: any) {
    await loggingClient.putLogs({
      logGroupId: LOG_GROUP_ID,
      putLogsDetails: {
        specVersion: '1.0',
        logEntries: [{
          id: crypto.randomUUID(),
          data: JSON.stringify({
            action: data.action,
            resource: data.resource,
            resourceId: data.resourceId,
            userId: data.userId,
            organizationId: data.organizationId,
            metadata: data.metadata,
            diff: data.diff,
            ip: data.ip,
            userAgent: data.userAgent,
          }),
          time: new Date().toISOString(),
        }],
      },
    });
    return { id: crypto.randomUUID(), ...data, createdAt: new Date() };
  },
  async find(query: any) {
    const where = query.where ?? {};

    // Search custom audit logs from OCI Logging
    const searchStr = Object.entries(where)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k} = '${v}'`)
      .join(' && ');

    const loggingResults = searchStr
      ? await searchClient.searchLogs({
          searchLogsDetails: {
            timeStart: new Date(Date.now() - 90 * 86400000).toISOString(),
            timeEnd: new Date().toISOString(),
            searchQuery: `search "${LOG_GROUP_ID}" | ${searchStr} | sort by datetime desc | limit ${query.take ?? 50}`,
          },
        })
      : { searchResult: { results: [] } };

    // Also fetch native OCI Audit events if querying by resource
    const auditResults = where.resource
      ? await auditClient.listEvents({
          compartmentId: process.env.OCI_COMPARTMENT_ID!,
          startTime: new Date(Date.now() - 90 * 86400000).toISOString(),
          endTime: new Date().toISOString(),
        })
      : { items: [] };

    const customEntries = (loggingResults.searchResult?.results ?? []).map((r: any) => {
      const data = JSON.parse(r.data);
      return { id: r.id, ...data, createdAt: new Date(r.time) };
    });

    const nativeEntries = (auditResults as any).items ?? [];

    return [
      ...customEntries,
      ...nativeEntries
        .filter((e: any) => !where.action || e.eventName === where.action)
        .map((e: any) => ({
          id: e.eventId,
          action: e.eventName,
          resource: e.eventSource,
          resourceId: e.eventId,
          userId: e.identity?.principalId,
          createdAt: new Date(e.eventTime),
        })),
    ].slice(0, query.take ?? 50);
  },
};

@Module({
  imports: [AuditLogModule.forRoot({ typeorm: { enabled: false } })],
  providers: [
    { provide: AUDITLOG_REPOSITORY, useValue: OciAuditRepo },
  ],
})
export class AppModule {}
```

> **OCI note**: The native Audit API is read-only with 90-day retention. The example above uses **OCI Logging** for storing and querying custom audit events, and also reads native OCI Audit events for Oracle cloud resource activity. Both sources are merged in `find()` for a unified view.
