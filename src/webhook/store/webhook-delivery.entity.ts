import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { WebhookDeliveryStatus } from '../interfaces';

@Entity('webhook_deliveries')
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type' })
  @Index()
  eventType: string;

  @Column('text', { nullable: true })
  payload?: string;

  @Column()
  url: string;

  @Column('varchar', { length: 20, default: 'queued' })
  @Index()
  status: WebhookDeliveryStatus;

  @Column({ name: 'status_code', nullable: true })
  statusCode?: number;

  @Column('text', { nullable: true })
  error?: string;

  @Column({ default: 0 })
  attempt: number;

  @Column({ nullable: true })
  duration?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;
}
