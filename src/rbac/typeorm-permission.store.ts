import type { Repository } from 'typeorm';
import { PermissionStore } from './interfaces.js';
import type { Permission } from './interfaces.js';
import { RbacRoleEntity } from './entities/rbac-role.entity.js';
import { RbacUserRoleEntity } from './entities/rbac-user-role.entity.js';

export class TypeOrmPermissionStore extends PermissionStore {
  constructor(
    private readonly roleRepo: Repository<RbacRoleEntity>,
    private readonly userRoleRepo: Repository<RbacUserRoleEntity>,
  ) {
    super();
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: { role: true },
    });

    const perms: Permission[] = [];
    for (const ur of userRoles) {
      if (ur.role?.permissions) {
        perms.push(...ur.role.permissions);
      }
    }
    return perms;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: { role: true },
    });

    return userRoles.filter((ur) => ur.role).map((ur) => ur.role!.name);
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const exists = await this.userRoleRepo.findOne({
      where: { userId, roleId },
    });
    if (exists) return;
    await this.userRoleRepo.save(this.userRoleRepo.create({ userId, roleId }));
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepo.delete({ userId, roleId });
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.userRoleRepo.delete({ userId });
    if (roleIds.length > 0) {
      await this.userRoleRepo.save(
        roleIds.map((roleId) => this.userRoleRepo.create({ userId, roleId })),
      );
    }
  }
}
