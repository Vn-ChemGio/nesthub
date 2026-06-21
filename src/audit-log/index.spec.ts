import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogModule } from './audit-log.module.js';
import { AuditLogService } from './audit-log.service.js';
import { AuditLogEntity } from './entities/audit-log.entity.js';
import type { AuditLogEntry } from './interfaces.js';

describe('AuditLogModule', () => {
  let service: AuditLogService;

  const mockEntry: AuditLogEntry = {
    id: 'log-1',
    action: 'user.login',
    resource: 'user',
    resourceId: 'user-1',
    userId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockReturnValue(mockEntry),
      save: jest.fn().mockResolvedValue(mockEntry),
      find: jest.fn().mockResolvedValue([mockEntry]),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [AuditLogModule.forRoot()],
    })
      .overrideProvider(getRepositoryToken(AuditLogEntity))
      .useValue(mockRepo)
      .compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe('log', () => {
    it('should create and save an audit entry', async () => {
      await service.log({
        action: 'user.login',
        resource: 'user',
        resourceId: 'user-1',
        userId: 'user-1',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.login',
          resource: 'user',
          resourceId: 'user-1',
          userId: 'user-1',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(mockEntry);
    });

    it('should include optional metadata and diff when provided', async () => {
      await service.log({
        action: 'user.update',
        resource: 'user',
        resourceId: 'user-1',
        userId: 'user-1',
        metadata: { changedField: 'email' },
        diff: { email: { from: 'old@example.com', to: 'new@example.com' } },
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { changedField: 'email' },
          diff: { email: { from: 'old@example.com', to: 'new@example.com' } },
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('findByResource', () => {
    it('should return audit entries for a resource', async () => {
      const result = await service.findByResource('user', 'user-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resource: 'user', resourceId: 'user-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toEqual([mockEntry]);
    });
  });

  describe('findByUser', () => {
    it('should return audit entries for a user', async () => {
      const result = await service.findByUser('user-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toEqual([mockEntry]);
    });

    it('should default to 50 items', async () => {
      await service.findByUser('user-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should respect the limit parameter', async () => {
      await service.findByUser('user-1', 10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return audit entries for an organization', async () => {
      const result = await service.findByOrganization('org-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toEqual([mockEntry]);
    });

    it('should default to 50 items', async () => {
      await service.findByOrganization('org-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should respect custom limit', async () => {
      await service.findByOrganization('org-1', 10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
