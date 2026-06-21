# nesthub/api-keys

API key management for NestJS — create, validate, revoke.

## Features

- **Key generation** — cryptographically secure random keys with prefix
- **Hash storage** — keys stored as SHA-256 hashes
- **Validation** — validate key and check expiry
- **Scopes** — optional permission scopes per key

## Usage

```typescript
import { ApiKeysModule, ApiKeyService } from 'nesthub/api-keys';

@Module({ imports: [ApiKeysModule.forRoot()] })
export class AppModule {}

// Create key
const { key } = await apiKeyService.create({
  name: 'Production API Key',
  userId: 'user-1',
  scopes: ['read:orders', 'write:orders'],
});

// Validate
const { valid, record } = await apiKeyService.validate(key);
```
