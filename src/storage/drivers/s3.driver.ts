import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type {
  S3DriverConfig,
  FileResult,
  ListResult,
  PutFileOptions,
  PresignedUrlOptions,
} from '../interfaces.js';
import type { StorageDriver } from './driver.interface.js';
import type {
  S3Client as S3ClientType,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';

interface SharpInstance {
  resize(options?: {
    width?: number;
    height?: number;
    fit?: string;
  }): SharpInstance;
  grayscale(enabled: boolean): SharpInstance;
  toFormat(format: string, options?: { quality?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
}

export class S3Driver implements StorageDriver {
  private client: S3ClientType | undefined;
  private initialized = false;

  constructor(private readonly config: S3DriverConfig) {}

  private async ensureClient(): Promise<S3ClientType> {
    if (this.initialized) return this.client!;
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      credentials:
        this.config.accessKeyId && this.config.secretAccessKey
          ? {
              accessKeyId: this.config.accessKeyId,
              secretAccessKey: this.config.secretAccessKey,
            }
          : undefined,
    });
    this.initialized = true;
    return this.client;
  }

  async put(
    file: Buffer | string,
    destination?: string,
    options?: PutFileOptions,
  ): Promise<FileResult> {
    if (options?.image) {
      return this.putWithOptions(file, destination ?? randomUUID(), options);
    }
    return this.putRaw(file, destination, options);
  }

  async get(path: string): Promise<Buffer> {
    const client = await this.ensureClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: path }),
    );
    const chunks: Uint8Array[] = [];
    const body = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(path: string): Promise<void> {
    const client = await this.ensureClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: path }),
    );
  }

  async list(prefix?: string): Promise<ListResult> {
    const client = await this.ensureClient();
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const response = await client.send(
      new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: prefix }),
    );
    const files = (response.Contents ?? []).map((obj) => ({
      key: obj.Key as string,
      size: obj.Size as number,
      lastModified: obj.LastModified as Date,
    }));
    return { files, prefix: prefix ?? '' };
  }

  url(path: string): string {
    if (this.config.publicUrl) {
      return `${this.config.publicUrl.replace(/\/+$/, '')}/${path}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      await client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: path }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async presignedUrlPut(
    key: string,
    options?: PresignedUrlOptions,
  ): Promise<string> {
    const client = await this.ensureClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const expiresIn = options?.expiresIn ?? this.config.presignedUrl?.expiresIn ?? 3600;
    return getSignedUrl(client, new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Metadata: options?.metadata,
      ContentType: options?.contentType,
    }), { expiresIn });
  }

  async presignedUrlGet(
    key: string,
    options?: PresignedUrlOptions,
  ): Promise<string> {
    const client = await this.ensureClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const expiresIn = options?.expiresIn ?? this.config.presignedUrl?.expiresIn ?? 3600;
    return getSignedUrl(client, new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    }), { expiresIn });
  }

  async putWithOptions(
    file: Buffer | string,
    destination: string,
    options?: PutFileOptions,
  ): Promise<FileResult> {
    let buffer = typeof file === 'string' ? await readFile(file) : file;

    if (options?.image) {
      const sharp = (await import('sharp')).default as unknown as (
        input: Buffer,
      ) => SharpInstance;
      buffer = await sharp(buffer)
        .resize(options.image.resize)
        .grayscale(options.image.grayscale ?? false)
        .toFormat(options.image.format ?? 'webp', {
          quality: options.image.quality ?? 80,
        })
        .toBuffer();
    }

    const ext = options?.image?.format
      ? `.${options.image.format}`
      : extname(options?.filename ?? destination) || '';

    const filename = options?.filename ?? `${randomUUID()}${ext}`;
    const subDir = options?.subDir ?? '';
    const fullPath = subDir ? `${subDir}/${filename}` : filename;

    const client = await this.ensureClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: fullPath,
        Body: buffer,
        ContentType: options?.image?.format
          ? `image/${options.image.format}`
          : undefined,
        Metadata: options?.metadata,
        ACL: this.config.acl as ObjectCannedACL | undefined,
      }),
    );

    return {
      path: fullPath,
      url: this.url(fullPath),
      size: buffer.length,
      mimeType: options?.image?.format
        ? `image/${options.image.format}`
        : 'application/octet-stream',
      originalName: options?.filename ?? filename,
    };
  }

  private async putRaw(
    file: Buffer | string,
    destination?: string,
    options?: PutFileOptions,
  ): Promise<FileResult> {
    const buffer = typeof file === 'string' ? await readFile(file) : file;
    const ext = extname(options?.filename ?? destination ?? '');
    const filename = options?.filename ?? `${randomUUID()}${ext}`;
    const subDir = options?.subDir ?? '';
    const fullPath = subDir ? `${subDir}/${filename}` : filename;

    const client = await this.ensureClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: fullPath,
        Body: buffer,
        Metadata: options?.metadata,
        ACL: this.config.acl as ObjectCannedACL | undefined,
      }),
    );

    return {
      path: fullPath,
      url: this.url(fullPath),
      size: buffer.length,
      mimeType: 'application/octet-stream',
      originalName: filename,
    };
  }
}
