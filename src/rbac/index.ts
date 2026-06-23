export { RbacModule } from './rbac.module.js';
export { RbacService } from './rbac.service.js';
export { RbacGuard } from './guards/rbac.guard.js';
export { InMemoryPermissionStore } from './in-memory-permission.store.js';
export { TypeOrmPermissionStore } from './typeorm-permission.store.js';
export { RbacRoleEntity } from './entities/rbac-role.entity.js';
export { RbacUserRoleEntity } from './entities/rbac-user-role.entity.js';
export { PermissionStore } from './interfaces.js';
export {
  Permissions,
  PERMISSIONS_KEY,
} from './decorators/permissions.decorator.js';
export {
  RequireRole,
  REQUIRED_ROLE_KEY,
} from './decorators/require-role.decorator.js';
export type {
  RbacModuleOptions,
  RbacCacheConfig,
  Permission,
  Role,
  FeatureFlag,
  FeatureFlagCheck,
} from './interfaces.js';
