export interface ApiKeyModuleOptions {
  typeorm: { enabled: boolean };
  hashAlgorithm?: 'sha256' | 'sha512';
  prefix?: string;
  keyLength?: number;
}

export interface CreateApiKeyInput {
  name: string;
  userId: string;
  organizationId?: string;
  scopes?: string[];
  expiresAt?: Date;
  metadata?: Record<string, string>;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  userId: string;
  organizationId?: string;
  scopes: string;
  metadata?: Record<string, string>;
  expiresAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export const APIKEY_MODULE_OPTIONS = 'APIKEY_MODULE_OPTIONS';
export const APIKEY_REPOSITORY = 'APIKEY_REPOSITORY';
