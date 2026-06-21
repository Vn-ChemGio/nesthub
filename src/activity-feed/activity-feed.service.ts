import { Injectable, Inject, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityFeedEntity } from './entities/activity-feed.entity.js';
import { ACTIVITY_FEED_REPOSITORY } from './interfaces.js';
import type { ActivityEntry } from './interfaces.js';

@Injectable()
export class ActivityFeedService {
  private readonly logger = new Logger(ActivityFeedService.name);

  constructor(
    @Inject(ACTIVITY_FEED_REPOSITORY)
    private readonly repository: Repository<ActivityFeedEntity>,
  ) {}

  async add(
    input: Omit<ActivityEntry, 'id' | 'read' | 'createdAt'>,
  ): Promise<void> {
    const entity = this.repository.create({
      ...input,
      read: false,
    });
    await this.repository.save(entity);
  }

  list(userId: string, limit = 20): Promise<ActivityEntry[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' as const },
      take: limit,
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.repository.update({ id, userId }, { read: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.update({ userId, read: false }, { read: true });
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.repository.count({
      where: { userId, read: false },
    });
  }

  listByOrganization(
    organizationId: string,
    limit = 50,
  ): Promise<ActivityEntry[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' as const },
      take: limit,
    });
  }
}
