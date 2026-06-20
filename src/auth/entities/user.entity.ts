import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Account } from './account.entity';
import { Passkey } from './passkey.entity';
import type { BackupCode } from '../interfaces';

@Entity('auth_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ name: 'email', nullable: true, length: 255 })
  email?: string;

  @Column({ name: 'email_verified', nullable: true, default: false })
  emailVerified: boolean;

  @Index({ unique: true, where: '"phone" IS NOT NULL' })
  @Column({ name: 'phone', nullable: true, length: 50 })
  phone?: string;

  @Column({ name: 'phone_verified', nullable: true })
  phoneVerified?: boolean;

  @Column({ name: 'name', nullable: true, length: 255 })
  name?: string;

  @Column({ name: 'image', nullable: true, length: 1024 })
  image?: string;

  @Column({ name: 'password_hash', nullable: true, length: 255 })
  passwordHash?: string;

  @Column({ name: 'roles', nullable: true, type: 'simple-array' })
  roles?: string[];

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @Column({ name: 'anonymous_id', nullable: true, length: 255 })
  anonymousId?: string;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion: number;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'two_factor_secret', nullable: true, length: 255 })
  twoFactorSecret?: string;

  @Column({ name: 'backup_codes', nullable: true, type: 'simple-json' })
  backupCodes?: BackupCode[];

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Account, (account) => account.user)
  accounts?: Account[];

  @OneToMany(() => Passkey, (passkey) => passkey.user)
  passkeys?: Passkey[];
}
