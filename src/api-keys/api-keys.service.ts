import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { APIKEY_MODULE_OPTIONS, APIKEY_REPOSITORY } from './interfaces.js';
import type {
  ApiKeyModuleOptions,
  CreateApiKeyInput,
  ApiKeyResult,
  ApiKeyRecord,
} from './interfaces.js';

interface ApiKeyRepository {
  save(data: Record<string, unknown>): Promise<ApiKeyRecord>;
  find(query: { where?: Record<string, unknown> }): Promise<ApiKeyRecord[]>;
  update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ affected: number }>;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @Inject(APIKEY_MODULE_OPTIONS)
    private readonly options: ApiKeyModuleOptions,
    @Inject(APIKEY_REPOSITORY)
    private readonly repository: ApiKeyRepository,
  ) {}

  async create(input: CreateApiKeyInput): Promise<ApiKeyResult> {
    const prefix = this.options.prefix ?? 'nst';
    const raw = `${prefix}_${randomBytes(this.options.keyLength ?? 32).toString('hex')}`;
    const keyHash = this.hash(raw);

    const record = await this.repository.save({
      name: input.name,
      keyHash,
      prefix,
      userId: input.userId,
      organizationId: input.organizationId,
      scopes: (input.scopes ?? []).join(','),
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    });

    return {
      id: record.id,
      name: record.name,
      key: raw,
      prefix,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async validate(
    key: string,
  ): Promise<{ valid: boolean; record?: ApiKeyRecord }> {
    const keyHash = this.hash(key);
    const records = await this.repository.find({ where: { keyHash } });
    if (records.length === 0) return { valid: false };

    const record = records[0];

    if (record.revokedAt) {
      return { valid: false, record };
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return { valid: false, record };
    }

    await this.repository.update(record.id, { lastUsedAt: new Date() });
    return { valid: true, record };
  }

  async revoke(id: string): Promise<void> {
    await this.repository.update(id, { revokedAt: new Date() });
  }

  async restore(id: string): Promise<void> {
    await this.repository.update(id, { revokedAt: null });
  }

  list(userId: string): Promise<ApiKeyRecord[]> {
    return this.repository.find({ where: { userId } });
  }

  private hash(key: string): string {
    const algo = this.options.hashAlgorithm ?? 'sha256';
    return createHash(algo).update(key).digest('hex');
  }
}
