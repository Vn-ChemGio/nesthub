export const ACTIVITY_FEED_REPOSITORY = 'ACTIVITY_FEED_REPOSITORY';

export interface ActivityEntry {
  id: string;
  type: string;
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  organizationId?: string;
  userId: string;
  read: boolean;
  createdAt: Date;
}
