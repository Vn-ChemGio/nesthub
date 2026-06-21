# @nesthub/storage

File upload & storage for NestJS with local filesystem and S3-compatible drivers.

## Features

- **Local driver** — filesystem storage
- **S3 driver** — AWS S3, MinIO, Cloudflare R2, Backblaze B2
- **Multi-disk** — multiple storage disks per app
- **Image processing** — resize, format conversion, quality (requires `sharp`)
- **Uniform API** — same interface for all drivers

## Installation

```bash
npm install @nesthub/storage
```

Optional peer dependencies:

```bash
# For S3 driver
npm install @aws-sdk/client-s3
# For image processing
npm install sharp
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { StorageModule } from '@nesthub/storage';

@Module({
  imports: [
    StorageModule.forRoot({
      default: {
        driver: 'local',
        baseDir: './uploads',
        publicUrl: '/storage',
      },
      disks: {
        avatars: {
          driver: 's3',
          region: 'us-east-1',
          bucket: 'my-avatars',
          endpoint: process.env.S3_ENDPOINT, // MinIO / R2
        },
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { StorageService } from '@nesthub/storage';

@Injectable()
export class AvatarService {
  constructor(private readonly storage: StorageService) {}

  async uploadAvatar(file: Buffer, userId: string) {
    return this.storage.put(file, undefined, {
      filename: `avatar-${userId}.webp`,
      subDir: 'avatars',
      image: { resize: { width: 256, height: 256 }, format: 'webp', quality: 80 },
    }, 'avatars');
  }

  getAvatarUrl(path: string) {
    return this.storage.url(path, 'avatars');
  }
}
```

## API

### StorageService

| Method | Description |
|--------|-------------|
| `put(file, destination?, options?, disk?)` | Upload file |
| `get(path, disk?)` | Download file as Buffer |
| `delete(path, disk?)` | Delete file |
| `list(prefix?, disk?)` | List files |
| `url(path, disk?)` | Get public URL |
| `exists(path, disk?)` | Check file existence |
| `presignedUrlPut(key, options?, disk?)` | Get presigned upload URL (S3 only) |
| `presignedUrlGet(key, options?, disk?)` | Get presigned download URL (S3 only) |
| `disk(name?)` | Get driver instance |

### PutFileOptions

| Option | Type | Description |
|--------|------|-------------|
| `filename` | `string` | Override filename |
| `subDir` | `string` | Subdirectory prefix |
| `validation` | `FileValidationOptions` | MIME type & size validation |
| `image` | `ImageProcessingOptions` | Resize / format / quality |
| `metadata` | `Record<string, string>` | Custom metadata (S3 only) |

### PresignedUrlOptions

| Option | Type | Description |
|--------|------|-------------|
| `expiresIn` | `number` | Seconds until URL expires (default: 3600) |
| `contentType` | `string` | Expected content type (presigned upload) |
| `metadata` | `Record<string, string>` | Custom metadata (presigned upload) |

### S3 presigned URL config

```typescript
{
  driver: 's3',
  // ... standard S3 config
  presignedUrl: {
    enabled: true,     // enable presigned URL support (default: false)
    expiresIn: 7200,    // default expiration in seconds (default: 3600)
  },
}
```
