import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityFeedModule } from './activity-feed.module.js';
import { ActivityFeedService } from './activity-feed.service.js';
import { ActivityFeedEntity } from './entities/activity-feed.entity.js';
import type { ActivityEntry } from './interfaces.js';

describe('ActivityFeedModule', () => {
  let service: ActivityFeedService;

  const mockEntry: ActivityEntry = {
    id: 'act-1',
    type: 'post.created',
    actorId: 'user-1',
    userId: 'user-1',
    targetId: 'post-123',
    targetType: 'post',
    read: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockReturnValue(mockEntry),
      save: jest.fn().mockResolvedValue(mockEntry),
      find: jest.fn().mockResolvedValue([mockEntry]),
      update: jest
        .fn()
        .mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] }),
      count: jest.fn().mockResolvedValue(3),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ActivityFeedModule],
    })
      .overrideProvider(getRepositoryToken(ActivityFeedEntity))
      .useValue(mockRepo)
      .compile();

    service = module.get<ActivityFeedService>(ActivityFeedService);
  });

  describe('add', () => {
    it('should create and save an activity entry', async () => {
      await service.add({
        type: 'post.created',
        actorId: 'user-1',
        userId: 'user-1',
        targetId: 'post-1',
        targetType: 'post',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'post.created',
          actorId: 'user-1',
          userId: 'user-1',
          targetId: 'post-1',
          targetType: 'post',
          read: false,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(mockEntry);
    });

    it('should include optional metadata when provided', async () => {
      await service.add({
        type: 'reaction.added',
        actorId: 'user-3',
        userId: 'user-1',
        actorName: 'Alice',
        actorAvatar: 'https://example.com/avatar.png',
        targetId: 'post-1',
        targetType: 'post',
        metadata: { reaction: 'like' },
        organizationId: 'org-1',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorName: 'Alice',
          actorAvatar: 'https://example.com/avatar.png',
          metadata: { reaction: 'like' },
          organizationId: 'org-1',
        }),
      );
    });
  });

  describe('list', () => {
    it('should return activities for a user ordered by newest first', async () => {
      const result = await service.list('user-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toEqual([mockEntry]);
    });

    it('should respect the limit parameter', async () => {
      await service.list('user-1', 5);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should default to 20 items', async () => {
      await service.list('user-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific activity as read', async () => {
      await service.markAsRead('act-1', 'user-1');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'act-1', userId: 'user-1' },
        { read: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread activities as read', async () => {
      await service.markAllAsRead('user-1');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', read: false },
        { read: true },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the number of unread activities', async () => {
      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(3);
      expect(mockRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
      });
    });

    it('should return 0 when there are no unread items', async () => {
      mockRepo.count.mockResolvedValue(0);

      const count = await service.getUnreadCount('user-2');
      expect(count).toBe(0);
    });
  });

  describe('listByOrganization', () => {
    it('should return activities for an organization', async () => {
      const result = await service.listByOrganization('org-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toEqual([mockEntry]);
    });

    it('should default to 50 items', async () => {
      await service.listByOrganization('org-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should respect custom limit', async () => {
      await service.listByOrganization('org-1', 10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
