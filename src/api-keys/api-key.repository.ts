import type { Repository } from 'typeorm';
import type { ApiKeyRecord } from './interfaces.js';
import { ApiKeyEntity } from './api-key.entity.js';

export class ApiKeyTypeOrmRepository {
  constructor(private readonly repo: Repository<ApiKeyEntity>) {}

  async save(data: Record<string, unknown>): Promise<ApiKeyRecord> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    return this.toRecord(saved);
  }

  async find(query: {
    where?: Record<string, unknown>;
  }): Promise<ApiKeyRecord[]> {
    const entities = await this.repo.find({
      where: query.where as Record<string, unknown>,
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toRecord(e));
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ affected: number }> {
    const result = await this.repo.update(id, data);
    return { affected: result.affected ?? 0 };
  }

  private toRecord(entity: ApiKeyEntity): ApiKeyRecord {
    return {
      id: entity.id,
      name: entity.name,
      keyHash: entity.keyHash,
      prefix: entity.prefix,
      userId: entity.userId,
      organizationId: entity.organizationId,
      scopes: entity.scopes ?? '',
      metadata: entity.metadata,
      expiresAt: entity.expiresAt,
      lastUsedAt: entity.lastUsedAt,
      revokedAt: entity.revokedAt,
      createdAt: entity.createdAt,
    };
  }
}
