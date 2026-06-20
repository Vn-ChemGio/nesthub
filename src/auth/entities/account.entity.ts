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

@Entity('auth_accounts')
@Index(['provider', 'providerAccountId'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider', length: 255 })
  provider: string;

  @Column({ name: 'provider_account_id', length: 255 })
  providerAccountId: string;

  @Column({ name: 'email', nullable: true, length: 255 })
  email?: string;

  @Column({ name: 'name', nullable: true, length: 255 })
  name?: string;

  @Column({ name: 'image', nullable: true, length: 1024 })
  image?: string;

  @Column({ name: 'access_token', nullable: true, type: 'text' })
  accessToken?: string;

  @Column({ name: 'refresh_token', nullable: true, type: 'text' })
  refreshToken?: string;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'id_token', nullable: true, type: 'text' })
  idToken?: string;

  @Column({ name: 'scope', nullable: true, length: 255 })
  scope?: string;

  @Column({ name: 'token_type', nullable: true, length: 50 })
  tokenType?: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
