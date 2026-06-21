import { Injectable, Inject, Logger } from '@nestjs/common';
import { STORAGE_DRIVERS, STORAGE_DEFAULT_DISK } from './storage.constants.js';
import type { StorageDriver } from './drivers/driver.interface.js';
import type {
  FileResult,
  ListResult,
  PutFileOptions,
  PresignedUrlOptions,
} from './interfaces.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_DRIVERS)
    private readonly drivers: Map<string, StorageDriver>,
    @Inject(STORAGE_DEFAULT_DISK)
    private readonly defaultDisk: string,
  ) {}

  disk(name?: string): StorageDriver {
    const driver = this.drivers.get(name ?? this.defaultDisk);
    if (!driver) {
      throw new Error(
        `Storage disk "${name ?? this.defaultDisk}" not found. Available disks: ${[...this.drivers.keys()].join(', ')}`,
      );
    }
    return driver;
  }

  async put(
    file: Buffer | string,
    destination?: string,
    options?: PutFileOptions,
    disk?: string,
  ): Promise<FileResult> {
    return this.disk(disk).put(file, destination, options);
  }

  async get(path: string, disk?: string): Promise<Buffer> {
    return this.disk(disk).get(path);
  }

  async delete(path: string, disk?: string): Promise<void> {
    return this.disk(disk).delete(path);
  }

  async list(prefix?: string, disk?: string): Promise<ListResult> {
    return this.disk(disk).list(prefix);
  }

  url(path: string, disk?: string): string {
    return this.disk(disk).url(path);
  }

  async exists(path: string, disk?: string): Promise<boolean> {
    return this.disk(disk).exists(path);
  }

  async presignedUrlPut(
    key: string,
    options?: PresignedUrlOptions,
    disk?: string,
  ): Promise<string> {
    return this.disk(disk).presignedUrlPut(key, options);
  }

  async presignedUrlGet(
    key: string,
    options?: PresignedUrlOptions,
    disk?: string,
  ): Promise<string> {
    return this.disk(disk).presignedUrlGet(key, options);
  }
}
