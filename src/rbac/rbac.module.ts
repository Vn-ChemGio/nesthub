import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RbacService } from './rbac.service.js';
import { RbacGuard } from './guards/rbac.guard.js';
import { InMemoryPermissionStore } from './in-memory-permission.store.js';
import {
  RBAC_MODULE_OPTIONS,
  RBAC_PERMISSION_STORE,
  RBAC_PERMISSIONS,
} from './interfaces.js';
import type { RbacModuleOptions, Permission } from './interfaces.js';
import type { PermissionStore } from './interfaces.js';

const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  owner: [{ action: '*', resource: '*' }],
  admin: [{ action: '*', resource: '*' }],
  member: [
    { action: 'read', resource: '*' },
    { action: 'create', resource: 'post' },
    { action: 'update', resource: 'post' },
    { action: 'delete', resource: 'post' },
  ],
  viewer: [{ action: 'read', resource: '*' }],
};

function createPermissionStoreProvider(
  options: RbacModuleOptions,
  defaultPerms: Map<string, Permission[]>,
): Provider<PermissionStore> {
  if (options.override?.permissionStore) {
    return {
      provide: RBAC_PERMISSION_STORE,
      useClass: options.override.permissionStore,
    };
  }

  if (options.typeorm?.enabled) {
    return {
      provide: RBAC_PERMISSION_STORE,
      inject: [DataSource],
      useFactory: async (dataSource: DataSource) => {
        const { RbacRoleEntity } =
          await import('./entities/rbac-role.entity.js');
        const { RbacUserRoleEntity } =
          await import('./entities/rbac-user-role.entity.js');
        const { TypeOrmPermissionStore } =
          await import('./typeorm-permission.store.js');
        const roleRepo = dataSource.getRepository(RbacRoleEntity);
        const userRoleRepo = dataSource.getRepository(RbacUserRoleEntity);
        return new TypeOrmPermissionStore(roleRepo, userRoleRepo);
      },
    };
  }

  return {
    provide: RBAC_PERMISSION_STORE,
    useFactory: () => new InMemoryPermissionStore(defaultPerms),
  };
}

@Global()
@Module({})
export class RbacModule {
  static forRoot(options?: RbacModuleOptions): DynamicModule {
    const opts = options ?? {};
    const defaultPerms = new Map(Object.entries(DEFAULT_PERMISSIONS));

    return {
      module: RbacModule,
      providers: [
        { provide: RBAC_MODULE_OPTIONS, useValue: opts },
        { provide: RBAC_PERMISSIONS, useValue: defaultPerms },
        createPermissionStoreProvider(opts, defaultPerms),
        RbacService,
        RbacGuard,
      ],
      exports: [RbacService, RbacGuard],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => RbacModuleOptions | Promise<RbacModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    const defaultPerms = new Map(Object.entries(DEFAULT_PERMISSIONS));

    return {
      module: RbacModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: RBAC_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        { provide: RBAC_PERMISSIONS, useValue: defaultPerms },
        {
          provide: RBAC_PERMISSION_STORE,
          inject: [RBAC_MODULE_OPTIONS, DataSource],
          useFactory: async (
            opts: RbacModuleOptions,
            dataSource?: DataSource,
          ) => {
            if (opts.override?.permissionStore) {
              const store = new opts.override.permissionStore();
              return store;
            }

            if (opts.typeorm?.enabled && dataSource) {
              const { RbacRoleEntity } =
                await import('./entities/rbac-role.entity.js');
              const { RbacUserRoleEntity } =
                await import('./entities/rbac-user-role.entity.js');
              const { TypeOrmPermissionStore } =
                await import('./typeorm-permission.store.js');
              const roleRepo = dataSource.getRepository(RbacRoleEntity);
              const userRoleRepo = dataSource.getRepository(RbacUserRoleEntity);
              return new TypeOrmPermissionStore(roleRepo, userRoleRepo);
            }

            return new InMemoryPermissionStore(defaultPerms);
          },
        },
        RbacService,
        RbacGuard,
      ],
      exports: [RbacService, RbacGuard],
    };
  }
}
