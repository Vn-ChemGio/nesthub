export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface FeatureFlagCheck {
  orgPlan?: string;
  orgId?: string;
  userId?: string;
}

export interface RbacCacheConfig {
  ttl?: number;
  store?: 'memory' | 'redis';
}

export interface RbacModuleOptions {
  typeorm?: { enabled: boolean };
  cache?: RbacCacheConfig;
  override?: {
    permissionStore?: any;
  };
}

export abstract class PermissionStore {
  abstract getUserPermissions(
    userId: string,
  ): Promise<Permission[]> | Permission[];
  abstract getUserRoles(userId: string): Promise<string[]> | string[];
}

export const RBAC_MODULE_OPTIONS = 'RBAC_MODULE_OPTIONS';
export const RBAC_PERMISSION_STORE = 'RBAC_PERMISSION_STORE';
export const RBAC_PERMISSIONS = 'RBAC_PERMISSIONS';
