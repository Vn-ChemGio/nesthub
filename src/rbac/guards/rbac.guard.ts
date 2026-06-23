import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { REQUIRED_ROLE_KEY } from '../decorators/require-role.decorator.js';
import type { Permission } from '../interfaces.js';

interface RbacRequestUser {
  id?: string;
  roles?: string[];
  [key: string]: unknown;
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(RbacService)
    private readonly rbacService?: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const permission = this.reflector.getAllAndOverride<Permission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !permission) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: RbacRequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: no authenticated user');
    }

    if (requiredRoles?.length) {
      if (!user.roles?.length) {
        throw new ForbiddenException('Insufficient permissions');
      }
      const hasRole = requiredRoles.some((role) => user.roles!.includes(role));
      if (!hasRole) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    if (permission) {
      if (user.id && this.rbacService?.hasUserPermission) {
        const hasPermission = await this.rbacService.hasUserPermission(
          user.id,
          permission.action,
          permission.resource,
        );
        if (!hasPermission) {
          throw new ForbiddenException('Insufficient permissions');
        }
      } else if (user.roles?.length && this.rbacService) {
        const hasRolePermission = user.roles.some((role) =>
          this.rbacService!.hasPermission(
            role,
            permission.action,
            permission.resource,
          ),
        );
        if (!hasRolePermission) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }
    }

    return true;
  }
}
