import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RbacModule } from './rbac.module.js';
import { RbacService } from './rbac.service.js';
import { RbacGuard } from './guards/rbac.guard.js';
import { InMemoryPermissionStore } from './in-memory-permission.store.js';
import {
  RBAC_MODULE_OPTIONS,
  RBAC_PERMISSION_STORE,
  RBAC_PERMISSIONS,
} from './interfaces.js';
import type { Permission, RbacModuleOptions } from './interfaces.js';
import { REQUIRED_ROLE_KEY } from './decorators/require-role.decorator.js';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator.js';

describe('RbacModule', () => {
  let service: RbacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RbacModule.forRoot()],
    }).compile();
    service = module.get<RbacService>(RbacService);
  });

  describe('default roles', () => {
    it('should allow owner to do anything', () => {
      expect(service.hasPermission('owner', 'delete', 'anything')).toBe(true);
    });

    it('should allow admin to do anything', () => {
      expect(service.hasPermission('admin', 'delete', 'anything')).toBe(true);
    });

    it('should allow viewer to read', () => {
      expect(service.hasPermission('viewer', 'read', 'post')).toBe(true);
    });

    it('should deny viewer to delete', () => {
      expect(service.hasPermission('viewer', 'delete', 'post')).toBe(false);
    });

    it('should allow member to create post', () => {
      expect(service.hasPermission('member', 'create', 'post')).toBe(true);
    });

    it('should deny member to delete user', () => {
      expect(service.hasPermission('member', 'delete', 'user')).toBe(false);
    });

    it('should deny unknown role', () => {
      expect(service.hasPermission('unknown', 'read', 'post')).toBe(false);
    });
  });

  describe('addPermissions', () => {
    it('should add custom permissions', () => {
      service.addPermissions('custom', [
        { action: 'export', resource: 'report' },
      ]);
      expect(service.hasPermission('custom', 'export', 'report')).toBe(true);
    });

    it('should append to existing role', () => {
      service.addPermissions('viewer', [
        { action: 'export', resource: 'analytics' },
      ]);
      expect(service.hasPermission('viewer', 'export', 'analytics')).toBe(true);
    });
  });

  describe('removePermissions', () => {
    it('should remove specific resource permissions', () => {
      service.addPermissions('custom', [
        { action: 'read', resource: 'a' },
        { action: 'write', resource: 'b' },
      ]);
      service.removePermissions('custom', ['a']);
      expect(service.hasPermission('custom', 'read', 'a')).toBe(false);
      expect(service.hasPermission('custom', 'write', 'b')).toBe(true);
    });

    it('should remove entire role when no resources specified', () => {
      service.addPermissions('temp', [{ action: 'read', resource: 'x' }]);
      service.removePermissions('temp');
      expect(service.hasPermission('temp', 'read', 'x')).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for a role', () => {
      const perms = service.getRolePermissions('viewer');
      expect(perms).toHaveLength(1);
      expect(perms[0]).toEqual({ action: 'read', resource: '*' });
    });

    it('should return empty array for unknown role', () => {
      expect(service.getRolePermissions('nonexistent')).toEqual([]);
    });
  });

  describe('getUserPermissions', () => {
    it('should return empty array when no PermissionStore is configured', async () => {
      const perms = await service.getUserPermissions('user-1');
      expect(perms).toEqual([]);
    });
  });

  describe('getUserRoles', () => {
    it('should return empty array when no PermissionStore is configured', async () => {
      const roles = await service.getUserRoles('user-1');
      expect(roles).toEqual([]);
    });
  });

  describe('hasUserPermission', () => {
    it('should return false when no PermissionStore is configured', async () => {
      const result = await service.hasUserPermission('user-1', 'read', 'post');
      expect(result).toBe(false);
    });
  });

  describe('feature flags', () => {
    it('should return true when flag is enabled', () => {
      expect(
        service.isFeatureEnabled({ key: 'x', name: 'x', enabled: true }),
      ).toBe(true);
    });

    it('should return false when flag is disabled', () => {
      expect(
        service.isFeatureEnabled({ key: 'x', name: 'x', enabled: false }),
      ).toBe(false);
    });

    it('should filter enabled flags', () => {
      const flags = [
        { key: 'a', name: 'a', enabled: true },
        { key: 'b', name: 'b', enabled: false },
        { key: 'c', name: 'c', enabled: true },
      ];
      const filtered = service.filterEnabledFlags(flags);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((f) => f.key)).toEqual(['a', 'c']);
    });
  });
});

describe('InMemoryPermissionStore', () => {
  const rolePermissions = new Map<string, Permission[]>([
    ['admin', [{ action: '*', resource: '*' }]],
    ['editor', [{ action: 'write', resource: 'post' }]],
  ]);

  let store: InMemoryPermissionStore;

  beforeEach(() => {
    store = new InMemoryPermissionStore(rolePermissions);
  });

  it('should return empty roles for unknown user', async () => {
    const roles = await store.getUserRoles('unknown');
    expect(roles).toEqual([]);
  });

  it('should return empty permissions for unknown user', async () => {
    const perms = await store.getUserPermissions('unknown');
    expect(perms).toEqual([]);
  });

  it('should assign and retrieve roles', async () => {
    store.assignRole('user-1', 'admin');
    const roles = await store.getUserRoles('user-1');
    expect(roles).toEqual(['admin']);
  });

  it('should return permissions for assigned roles', async () => {
    store.assignRole('user-1', 'editor');
    const perms = await store.getUserPermissions('user-1');
    expect(perms).toEqual([{ action: 'write', resource: 'post' }]);
  });

  it('should merge permissions from multiple roles', async () => {
    store.setUserRoles('user-1', ['admin', 'editor']);
    const perms = await store.getUserPermissions('user-1');
    expect(perms).toHaveLength(2);
  });

  it('should remove a role', async () => {
    store.assignRole('user-1', 'admin');
    store.removeRole('user-1', 'admin');
    const roles = await store.getUserRoles('user-1');
    expect(roles).toEqual([]);
  });

  it('should set roles replacing existing ones', async () => {
    store.assignRole('user-1', 'admin');
    store.setUserRoles('user-1', ['editor']);
    const roles = await store.getUserRoles('user-1');
    expect(roles).toEqual(['editor']);
  });

  it('should not duplicate roles on assignRole', async () => {
    store.assignRole('user-1', 'admin');
    store.assignRole('user-1', 'admin');
    const roles = await store.getUserRoles('user-1');
    expect(roles).toEqual(['admin']);
  });
});

describe('RbacService with InMemoryPermissionStore', () => {
  let service: RbacService;
  let store: InMemoryPermissionStore;

  beforeEach(async () => {
    store = new InMemoryPermissionStore(
      new Map([
        ['admin', [{ action: '*', resource: '*' }]],
        ['editor', [{ action: 'write', resource: 'post' }]],
        ['viewer', [{ action: 'read', resource: '*' }]],
      ]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RBAC_MODULE_OPTIONS,
          useValue: { cache: { ttl: 3600000 } } as RbacModuleOptions,
        },
        {
          provide: RBAC_PERMISSIONS,
          useValue: new Map([
            ['admin', [{ action: '*', resource: '*' }]],
            ['editor', [{ action: 'write', resource: 'post' }]],
            ['viewer', [{ action: 'read', resource: '*' }]],
          ]),
        },
        { provide: RBAC_PERMISSION_STORE, useValue: store },
        RbacService,
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  it('should get user permissions from store', async () => {
    store.assignRole('user-1', 'editor');
    const perms = await service.getUserPermissions('user-1');
    expect(perms).toEqual([{ action: 'write', resource: 'post' }]);
  });

  it('should get user roles from store', async () => {
    store.setUserRoles('user-1', ['admin', 'viewer']);
    const roles = await service.getUserRoles('user-1');
    expect(roles).toEqual(['admin', 'viewer']);
  });

  it('should check user permission correctly', async () => {
    store.assignRole('user-1', 'editor');
    expect(await service.hasUserPermission('user-1', 'write', 'post')).toBe(
      true,
    );
    expect(await service.hasUserPermission('user-1', 'delete', 'post')).toBe(
      false,
    );
  });

  it('should cache user permissions', async () => {
    store.assignRole('user-1', 'admin');
    await service.getUserPermissions('user-1');

    store.removeRole('user-1', 'admin');
    store.assignRole('user-1', 'viewer');

    const perms = await service.getUserPermissions('user-1');
    expect(perms).toEqual([{ action: '*', resource: '*' }]);
  });

  it('should invalidate cache for a specific user', async () => {
    store.setUserRoles('user-1', ['admin']);
    await service.getUserPermissions('user-1');

    store.setUserRoles('user-1', ['viewer']);
    service.invalidateCache('user-1');

    const perms = await service.getUserPermissions('user-1');
    expect(perms).toEqual([{ action: 'read', resource: '*' }]);
  });

  it('should invalidate entire cache', async () => {
    store.setUserRoles('user-1', ['admin']);
    store.setUserRoles('user-2', ['admin']);
    await service.getUserPermissions('user-1');
    await service.getUserPermissions('user-2');

    store.setUserRoles('user-1', ['viewer']);
    store.setUserRoles('user-2', ['viewer']);
    service.invalidateCache();

    const perms1 = await service.getUserPermissions('user-1');
    const perms2 = await service.getUserPermissions('user-2');
    expect(perms1).toEqual([{ action: 'read', resource: '*' }]);
    expect(perms2).toEqual([{ action: 'read', resource: '*' }]);
  });
});

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;
  let service: RbacService;
  let testModule: TestingModule;

  const guardRolePerms = new Map([
    ['admin', [{ action: '*', resource: '*' }]],
    ['editor', [{ action: 'write', resource: 'post' }]],
    ['viewer', [{ action: 'read', resource: '*' }]],
  ]);

  beforeEach(async () => {
    testModule = await Test.createTestingModule({
      providers: [
        Reflector,
        {
          provide: RBAC_MODULE_OPTIONS,
          useValue: {} as RbacModuleOptions,
        },
        {
          provide: RBAC_PERMISSIONS,
          useValue: new Map(guardRolePerms),
        },
        {
          provide: RBAC_PERMISSION_STORE,
          useValue: new InMemoryPermissionStore(new Map(guardRolePerms)),
        },
        RbacService,
        RbacGuard,
      ],
    }).compile();

    reflector = testModule.get<Reflector>(Reflector);
    guard = testModule.get<RbacGuard>(RbacGuard);
    service = testModule.get<RbacService>(RbacService);
  });

  function mockContext(user?: any) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  it('should pass when no metadata is set', async () => {
    const context = mockContext({ id: 'u1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw when user is missing and metadata is set', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRED_ROLE_KEY) return ['admin'];
        return undefined;
      });
    const context = mockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Access denied: no authenticated user',
    );
  });

  it('should pass when user has required role', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRED_ROLE_KEY) return ['admin'];
        return undefined;
      });
    const context = mockContext({ roles: ['admin'] });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw when user lacks required role', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRED_ROLE_KEY) return ['admin'];
        return undefined;
      });
    const context = mockContext({ roles: ['viewer'] });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Insufficient permissions',
    );
  });

  it('should check permission via service when user has id', async () => {
    const store = testModule.get<InMemoryPermissionStore>(
      RBAC_PERMISSION_STORE,
    );
    store.assignRole('user-1', 'editor');

    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === PERMISSIONS_KEY)
          return { action: 'write', resource: 'post' };
        return undefined;
      });
    const context = mockContext({ id: 'user-1', roles: ['editor'] });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw when user lacks permission via service', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === PERMISSIONS_KEY)
          return { action: 'delete', resource: 'post' };
        return undefined;
      });
    const context = mockContext({ id: 'user-1', roles: ['viewer'] });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Insufficient permissions',
    );
  });

  it('should check both role and permission', async () => {
    const store = testModule.get<InMemoryPermissionStore>(
      RBAC_PERMISSION_STORE,
    );
    store.assignRole('user-1', 'admin');

    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === REQUIRED_ROLE_KEY) return ['admin'];
        if (key === PERMISSIONS_KEY)
          return { action: 'delete', resource: 'post' };
        return undefined;
      });
    const context = mockContext({ id: 'user-1', roles: ['admin'] });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});

describe('RbacModule store resolution', () => {
  it('should create InMemoryPermissionStore when typeorm is disabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RbacModule.forRoot({ typeorm: { enabled: false } })],
    }).compile();

    const store = module.get(RBAC_PERMISSION_STORE);
    expect(store).toBeInstanceOf(InMemoryPermissionStore);
  });

  it('should create InMemoryPermissionStore when no options provided', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RbacModule.forRoot()],
    }).compile();

    const store = module.get(RBAC_PERMISSION_STORE);
    expect(store).toBeInstanceOf(InMemoryPermissionStore);
  });

  it('should export RbacGuard', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RbacModule.forRoot()],
    }).compile();

    const guard = module.get(RbacGuard);
    expect(guard).toBeDefined();
  });
});
