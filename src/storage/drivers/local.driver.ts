import { randomUUID } from 'node:crypto';
import {
  readFile,
  writeFile,
  unlink,
  readdir,
  stat,
  mkdir,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import type {
  LocalDriverConfig,
  FileResult,
  ListResult,
  PutFileOptions,
  PresignedUrlOptions,
} from '../interfaces.js';
import type { StorageDriver } from './driver.interface.js';

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

export class LocalDriver implements StorageDriver {
  constructor(private readonly config: LocalDriverConfig) {}

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
    return readFile(this.resolve(path));
  }

  async delete(path: string): Promise<void> {
    await unlink(this.resolve(path));
  }

  async list(prefix?: string): Promise<ListResult> {
    const dir = prefix ? this.resolve(prefix) : this.config.baseDir;
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((e) => e.isFile())
        .map(async (e) => {
          const s = await stat(join(dir, e.name));
          return {
            key: join(prefix ?? '', e.name),
            size: s.size,
            lastModified: s.mtime,
          };
        }),
    );
    return { files, prefix: prefix ?? '' };
  }

  url(path: string): string {
    if (this.config.publicUrl) {
      return `${this.config.publicUrl.replace(/\/+$/, '')}/${path}`;
    }
    return `/storage/${path}`;
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(existsSync(this.resolve(path)));
  }

  async presignedUrlPut(
    _key: string,
    _options?: PresignedUrlOptions,
  ): Promise<string> {
    throw new Error('Presigned URL is not supported by the local driver');
  }

  async presignedUrlGet(
    _key: string,
    _options?: PresignedUrlOptions,
  ): Promise<string> {
    throw new Error('Presigned URL is not supported by the local driver');
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
    const fullPath = subDir ? join(subDir, filename) : filename;
    const absolute = this.resolve(fullPath);

    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, buffer);

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
    const fullPath = subDir ? join(subDir, filename) : filename;
    const absolute = this.resolve(fullPath);

    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, buffer);

    return {
      path: fullPath,
      url: this.url(fullPath),
      size: buffer.length,
      mimeType: 'application/octet-stream',
      originalName: filename,
    };
  }

  private resolve(path: string): string {
    return join(this.config.baseDir, path);
  }
}
