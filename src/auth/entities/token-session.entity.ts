import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('auth_token_sessions')
@Index(['userId'])
@Index(['jti'], { unique: true })
@Index(['expiresAt'])
export class TokenSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'jti', length: 64 })
  jti: string;

  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress?: string;

  @Column({ name: 'user_agent', nullable: true, length: 512 })
  userAgent?: string;

  @Column({ name: 'device_name', nullable: true, length: 255 })
  deviceName?: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
