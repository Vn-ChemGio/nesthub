import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'key_hash' })
  keyHash: string;

  @Column()
  prefix: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  scopes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, string>;

  @Column({ name: 'expires_at', nullable: true, type: 'timestamp' })
  expiresAt?: Date;

  @Column({ name: 'last_used_at', nullable: true, type: 'timestamp' })
  lastUsedAt?: Date;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamp' })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
