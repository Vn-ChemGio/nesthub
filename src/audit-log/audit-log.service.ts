import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity.js';
import { AUDITLOG_MODULE_OPTIONS, AUDITLOG_REPOSITORY } from './interfaces.js';
import type { AuditLogModuleOptions, AuditLogEntry } from './interfaces.js';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject(AUDITLOG_MODULE_OPTIONS)
    private readonly options: AuditLogModuleOptions,
    @Optional()
    @Inject(AUDITLOG_REPOSITORY)
    private readonly repository?: Repository<AuditLogEntity>,
  ) {}

  private ensureRepository(): Repository<AuditLogEntity> {
    if (!this.repository) {
      throw new Error(
        'AuditLog repository is not configured. ' +
          'Either enable TypeORM (typeorm: { enabled: true }) ' +
          'or provide a custom AUDITLOG_REPOSITORY provider.',
      );
    }
    return this.repository;
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    const repo = this.ensureRepository();
    const entity = repo.create({ ...entry });
    await repo.save(entity);
  }

  findByResource(
    resource: string,
    resourceId: string,
  ): Promise<AuditLogEntry[]> {
    const repo = this.ensureRepository();
    return repo.find({
      where: { resource, resourceId },
      order: { createdAt: 'DESC' as const },
    });
  }

  findByUser(userId: string, limit = 50): Promise<AuditLogEntry[]> {
    const repo = this.ensureRepository();
    return repo.find({
      where: { userId },
      order: { createdAt: 'DESC' as const },
      take: limit,
    });
  }

  findByOrganization(
    organizationId: string,
    limit = 50,
  ): Promise<AuditLogEntry[]> {
    const repo = this.ensureRepository();
    return repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' as const },
      take: limit,
    });
  }
}
