import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../services/token.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { User } from '../entities/user.entity';
import { AUTH_OPTIONS } from '../auth.constants';
import type { AuthModuleOptions, AuthenticatedUser } from '../interfaces';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly blacklistService: TokenBlacklistService,
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers?: { authorization?: string };
      cookies?: Record<string, string>;
      query?: Record<string, string>;
    }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.tokenService.verifyAccessToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (user.jti && (await this.blacklistService.isBlacklisted(user.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const dbUser = await this.userRepo.findOne({
      where: { id: user.id },
      select: { id: true, tokenVersion: true },
    });
    if (
      dbUser &&
      user.tokenVersion !== undefined &&
      user.tokenVersion < dbUser.tokenVersion
    ) {
      throw new UnauthorizedException('Token has been revoked');
    }

    request.user = user;
    return true;
  }

  private extractToken(request: {
    headers?: { authorization?: string };
    cookies?: Record<string, string>;
    query?: Record<string, string>;
  }): string | null {
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    if (request.cookies?.access_token) {
      return request.cookies.access_token;
    }

    if (request.query?.token) {
      return request.query.token;
    }

    return null;
  }
}
