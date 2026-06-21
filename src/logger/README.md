# nesthub/logger

Structured logging for NestJS with Pino, correlation IDs, and request logging.

## Features

- **Pino-based** — fast, low-overhead structured JSON logging
- **Correlation ID** — auto-generate and propagate request tracing IDs
- **Request logging** — interceptor for HTTP request/response logging
- **Pretty print** — human-readable console output in development
- **Multi-transport** — send logs to files, Sentry, Grafana, etc.

## Installation

```bash
npm install @nesthub/logger
npm install pino
# Optional: for pretty printing
npm install pino-pretty
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from '@nesthub/logger';

@Module({
  imports: [
    LoggerModule.forRoot({
      level: process.env.LOG_LEVEL ?? 'info',
      prettyPrint: process.env.NODE_ENV !== 'production',
      redact: ['req.headers.authorization'],
      correlationId: { enabled: true },
      requestLogging: { enabled: true },
    }),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@nesthub/logger';

@Injectable()
export class UserService {
  constructor(private readonly logger: LoggerService) {}

  createUser(email: string) {
    this.logger.info({ email }, 'Creating user');
  }
}
```

### Correlation ID Middleware

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from '@nesthub/logger';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

### Request Logger Interceptor

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLoggerInterceptor } from '@nesthub/logger';

// Register as global interceptor
const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new RequestLoggerInterceptor());

## Log Output Examples

### JSON (production)

```
{"level":30,"time":1718000000000,"pid":12345,"hostname":"my-host","correlationId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","msg":"Creating user","email":"user@example.com"}
{"level":30,"time":1718000000001,"pid":12345,"hostname":"my-host","correlationId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","req":{"method":"GET","url":"/api/users","headers":{"host":"localhost:3000","user-agent":"curl/8.0"}},"res":{"statusCode":200},"responseTime":15,"msg":"request completed"}
```

### Pretty-print (development)

```
[12:00:00.123] INFO (12345): Creating user
    correlationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    email: "user@example.com"

[12:00:00.456] INFO (12345): request completed
    correlationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    req.method: "GET"
    req.url: "/api/users"
    res.statusCode: 200
    responseTime: 15
```

## Integration with Log Storage & Visualization

### Elasticsearch (via Logstash)

Use `pino-socket` or `pino-logstash` to forward logs to Logstash:

```typescript
LoggerModule.forRoot({
  level: 'info',
  transports: [
    {
      target: 'pino-socket',
      options: {
        address: 'logstash.example.com',
        port: 5000,
        mode: 'tcp',
      },
    },
  ],
})
```

Logstash config (`logstash.conf`):

```
input {
  tcp { port => 5000 codec => json }
}
output {
  elasticsearch {
    hosts  => ["http://elasticsearch:9200"]
    index  => "logs-%{+YYYY.MM.dd}"
  }
}
```

### Elasticsearch (direct)

Install `pino-elasticsearch`:

```bash
npm install pino-elasticsearch
```

```typescript
LoggerModule.forRoot({
  level: 'info',
  transports: [
    {
      target: 'pino-elasticsearch',
      options: {
        index: 'logs',
        node: 'http://elasticsearch:9200',
        'es-version': 7,
        'flush-bytes': 1000,
      },
    },
  ],
})
```

### OpenSearch

Install `pino-opensearch`:

```bash
npm install pino-opensearch
```

```typescript
LoggerModule.forRoot({
  level: 'info',
  transports: [
    {
      target: 'pino-opensearch',
      options: {
        index: 'logs',
        node: 'http://opensearch:9200',
        'flush-bytes': 1000,
      },
    },
  ],
})
```

### Filebeat (sidecar)

When you prefer a sidecar approach, write logs to a file and let Filebeat ship them:

```typescript
LoggerModule.forRoot({
  level: 'info',
  transports: [
    {
      target: 'pino/file',
      options: {
        destination: '/var/log/app/app.log',
        mkdir: true,
      },
    },
  ],
})
```

Filebeat config (`filebeat.yml`):

```yaml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/app/*.log
    json.keys_under_root: true
    json.overwrite_keys: true

output.elasticsearch:
  hosts: ["http://elasticsearch:9200"]
  index: "logs-%{+yyyy.MM.dd}"
```

### Kibana / OpenSearch Dashboards

Once logs are indexed, create an **Index Pattern** matching `logs-*` to explore structured fields like `correlationId`, `level`, `req.method`, `res.statusCode`, and `responseTime`. Use `correlationId` to trace a single request across all services.`
```
