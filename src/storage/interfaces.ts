export type StorageDriver = 'local' | 's3';

export interface LocalDriverConfig {
  driver: 'local';
  baseDir: string;
  publicUrl?: string;
}

export interface S3DriverConfig {
  driver: 's3';
  region: string;
  bucket: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  publicUrl?: string;
  acl?: string;
  presignedUrl?: {
    enabled?: boolean;
    expiresIn?: number;
  };
}

export type StorageDriverConfig = LocalDriverConfig | S3DriverConfig;

export interface FileValidationOptions {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  forbiddenMagicBytes?: string[][];
}

export interface ImageProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  grayscale?: boolean;
}

export interface PutFileOptions {
  /** Override destination filename */
  filename?: string;
  /** Subdirectory under the configured base */
  subDir?: string;
  /** File validation rules */
  validation?: FileValidationOptions;
  /** Image processing (requires sharp) */
  image?: ImageProcessingOptions;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  expiresIn?: number;
  metadata?: Record<string, string>;
  contentType?: string;
}

export interface FileResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface ListResult {
  files: { key: string; size: number; lastModified: Date }[];
  prefix: string;
}

export interface StorageModuleOptions {
  default: StorageDriverConfig;
  disks?: Record<string, StorageDriverConfig>;
}
