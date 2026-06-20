import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('auth_passkeys')
export class Passkey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.passkeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'credential_id', length: 255 })
  credentialId: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'credential_device_type', type: 'text' })
  credentialDeviceType: string;

  @Column({ name: 'credential_backed_up', default: false })
  credentialBackedUp: boolean;

  @Column({ name: 'transports', nullable: true, type: 'simple-json' })
  transports?: string[];

  @Column({ name: 'nickname', nullable: true, length: 255 })
  nickname?: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
