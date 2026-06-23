import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import type {
  Permission,
  FeatureFlag,
  RbacModuleOptions,
} from './interfaces.js';
import {
  RBAC_PERMISSIONS,
  RBAC_MODULE_OPTIONS,
  RBAC_PERMISSION_STORE,
} from './interfaces.js';
import { PermissionStore } from './interfaces.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl = 60000;

  constructor(
    @Inject(RBAC_MODULE_OPTIONS)
    private readonly options: RbacModuleOptions,
    @Inject(RBAC_PERMISSIONS)
    private readonly permissions: Map<string, Permission[]>,
    @Optional()
    @Inject(RBAC_PERMISSION_STORE)
    private readonly permissionStore?: PermissionStore,
  ) {}

  hasPermission(role: string, action: string, resource: string): boolean {
    const perms = this.permissions.get(role);
    if (!perms || perms.length === 0) return false;
    return perms.some(
      (p) =>
        (p.action === '*' || p.action === action) &&
        (p.resource === resource || p.resource === '*') &&
        p.action !== 'deny',
    );
  }

  addPermissions(role: string, perms: Permission[]): void {
    const existing = this.permissions.get(role) ?? [];
    this.permissions.set(role, [...existing, ...perms]);
  }

  removePermissions(role: string, resources?: string[]): void {
    if (!resources) {
      this.permissions.delete(role);
      return;
    }
    const existing = this.permissions.get(role) ?? [];
    this.permissions.set(
      role,
      existing.filter((p) => !resources.includes(p.resource)),
    );
  }

  getRolePermissions(role: string): Permission[] {
    return this.permissions.get(role) ?? [];
  }

  isFeatureEnabled(flag: FeatureFlag): boolean {
    return flag.enabled;
  }

  filterEnabledFlags(flags: FeatureFlag[]): FeatureFlag[] {
    return flags.filter((f) => this.isFeatureEnabled(f));
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    if (!this.permissionStore) {
      this.logger.warn(
        'No PermissionStore configured. getUserPermissions requires a PermissionStore.',
      );
      return [];
    }

    const cacheKey = `permissions:${userId}`;
    const cached = this.getFromCache<Permission[]>(cacheKey);
    if (cached) return cached;

    const perms = await this.permissionStore.getUserPermissions(userId);
    this.setCache(cacheKey, perms);
    return perms;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    if (!this.permissionStore) {
      this.logger.warn(
        'No PermissionStore configured. getUserRoles requires a PermissionStore.',
      );
      return [];
    }

    const cacheKey = `roles:${userId}`;
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    const roles = await this.permissionStore.getUserRoles(userId);
    this.setCache(cacheKey, roles);
    return roles;
  }

  async hasUserPermission(
    userId: string,
    action: string,
    resource: string,
  ): Promise<boolean> {
    if (!this.permissionStore) {
      return false;
    }

    const perms = await this.getUserPermissions(userId);
    return perms.some(
      (p) =>
        (p.action === '*' || p.action === action) &&
        (p.resource === resource || p.resource === '*') &&
        p.action !== 'deny',
    );
  }

  invalidateCache(userId?: string): void {
    if (userId) {
      this.cache.delete(`permissions:${userId}`);
      this.cache.delete(`roles:${userId}`);
    } else {
      this.cache.clear();
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: unknown): void {
    const ttl = this.options.cache?.ttl ?? this.defaultTtl;
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }
}
