import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_feed')
export class ActivityFeedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  type: string;

  @Column({ name: 'actor_id', length: 255 })
  @Index()
  actorId: string;

  @Column({ name: 'actor_name', nullable: true, length: 255 })
  actorName?: string;

  @Column({ name: 'actor_avatar', nullable: true, length: 1024 })
  actorAvatar?: string;

  @Column({ name: 'target_id', nullable: true, length: 255 })
  targetId?: string;

  @Column({ name: 'target_type', nullable: true, length: 100 })
  targetType?: string;

  @Column('simple-json', { name: 'metadata', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'organization_id', nullable: true, length: 255 })
  @Index()
  organizationId?: string;

  @Column({ length: 255 })
  @Index()
  userId: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
