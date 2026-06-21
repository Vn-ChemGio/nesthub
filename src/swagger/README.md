# nesthub/swagger

Scalar API reference for NestJS — powered by `@scalar/nestjs-api-reference`.

## Installation

```bash
npm install @nestjs/swagger @scalar/nestjs-api-reference
```

## Usage

```typescript
import { NestFactory } from '@nestjs/core';
import { setupSwaggerUI } from 'nesthub/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupSwaggerUI(app, {
    title: 'My API',
    description: 'API documentation',
    version: '1.0.0',
    persistAuth: true,
    serverUrl: 'http://localhost:3000',
  });

  await app.listen(3000);
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | `'api-docs'` | Path to serve Scalar |
| `title` | `string` | `'API Documentation'` | API title |
| `description` | `string` | `''` | API description |
| `version` | `string` | `'1.0'` | API version |
| `persistAuth` | `boolean` | `false` | Persist auth in localStorage |
| `serverUrl` | `string` | `undefined` | Server URL |
| `serverDescription` | `string` | `undefined` | Server description |

## Content Security Policy

Scalar loads UI assets from `https://cdn.jsdelivr.net` and uses inline scripts. If your app sets a `Content-Security-Policy` header, update `script-src` to allow:

```http
Content-Security-Policy: script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

For stricter security, use a nonce or hash (the hash changes per Scalar version — generate it from the inline script content or pin a specific version).
