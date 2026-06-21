import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  action: string;

  @Column({ length: 255 })
  @Index()
  resource: string;

  @Column({ name: 'resource_id', nullable: true, length: 255 })
  resourceId?: string;

  @Column({ name: 'user_id', nullable: true, length: 255 })
  @Index()
  userId?: string;

  @Column({ name: 'organization_id', nullable: true, length: 255 })
  @Index()
  organizationId?: string;

  @Column('simple-json', { name: 'metadata', nullable: true })
  metadata?: Record<string, unknown>;

  @Column('simple-json', { name: 'diff', nullable: true })
  diff?: Record<string, { from: unknown; to: unknown }>;

  @Column({ nullable: true, length: 45 })
  ip?: string;

  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
