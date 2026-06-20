import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type VerificationType =
  | 'email-verification'
  | 'password-reset'
  | 'magic-link'
  | 'otp'
  | '2fa';

@Entity('auth_verifications')
@Index(['identifier', 'type'])
@Index(['expiresAt'])
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'identifier', length: 255 })
  identifier: string;

  @Column({ name: 'type', length: 50 })
  type: VerificationType;

  @Column({ name: 'token', length: 255 })
  token: string;

  @Column({ name: 'metadata', nullable: true, type: 'simple-json' })
  metadata?: Record<string, unknown>;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
