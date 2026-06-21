import type {
  FileResult,
  ListResult,
  PutFileOptions,
  PresignedUrlOptions,
} from '../interfaces.js';

export interface StorageDriver {
  put(
    file: Buffer | string,
    destination?: string,
    options?: PutFileOptions,
  ): Promise<FileResult>;

  get(path: string): Promise<Buffer>;

  delete(path: string): Promise<void>;

  list(prefix?: string): Promise<ListResult>;

  url(path: string): string;

  exists(path: string): Promise<boolean>;

  /** Extra options (used by image processing etc.) */
  putWithOptions(
    file: Buffer | string,
    destination: string,
    options?: PutFileOptions,
  ): Promise<FileResult>;

  presignedUrlPut(key: string, options?: PresignedUrlOptions): Promise<string>;

  presignedUrlGet(key: string, options?: PresignedUrlOptions): Promise<string>;
}
