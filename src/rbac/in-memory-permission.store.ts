import type { Permission } from './interfaces.js';
import { PermissionStore } from './interfaces.js';

export class InMemoryPermissionStore extends PermissionStore {
  private readonly userRoles = new Map<string, string[]>();

  constructor(private readonly rolePermissions: Map<string, Permission[]>) {
    super();
  }

  assignRole(userId: string, role: string): void {
    const roles = this.userRoles.get(userId) ?? [];
    if (!roles.includes(role)) {
      roles.push(role);
      this.userRoles.set(userId, roles);
    }
  }

  removeRole(userId: string, role: string): void {
    const roles = this.userRoles.get(userId);
    if (!roles) return;
    const idx = roles.indexOf(role);
    if (idx >= 0) {
      roles.splice(idx, 1);
      if (roles.length === 0) this.userRoles.delete(userId);
      else this.userRoles.set(userId, roles);
    }
  }

  setUserRoles(userId: string, roles: string[]): void {
    this.userRoles.set(userId, [...roles]);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = this.getUserRoles(userId);
    const perms: Permission[] = [];
    for (const role of roles) {
      const rolePerms = this.rolePermissions.get(role) ?? [];
      perms.push(...rolePerms);
    }
    return perms;
  }

  getUserRoles(userId: string): string[] {
    return this.userRoles.get(userId) ?? [];
  }
}
