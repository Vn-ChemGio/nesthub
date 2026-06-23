import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RbacRoleEntity } from './rbac-role.entity.js';

@Entity('rbac_user_roles')
export class RbacUserRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'role_id' })
  roleId: string;

  @ManyToOne(() => RbacRoleEntity)
  @JoinColumn({ name: 'role_id' })
  role?: RbacRoleEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
