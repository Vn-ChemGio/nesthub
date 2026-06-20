import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import type { AuthModuleOptions, AuthenticatedUser } from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

interface AccessTokenPayload {
  sub: string;
  email?: string;
  roles?: string[];
  isAnonymous?: boolean;
  twoFactorVerified?: boolean;
  tokenVersion?: number;
  jti?: string;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  tokenVersion?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  private readonly jwtExpiresIn: SignOptions['expiresIn'];
  private readonly refreshExpiresIn: SignOptions['expiresIn'];

  constructor(
    private readonly jwtService: JwtService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.jwtExpiresIn = (options.security?.jwtExpiresIn ??
      '15m') as SignOptions['expiresIn'];
    this.refreshExpiresIn = (options.security?.refreshTokenExpiresIn ??
      '7d') as SignOptions['expiresIn'];
  }

  async generateAccessToken(user: AuthenticatedUser): Promise<string> {
    const payload: AccessTokenPayload & { jti: string } = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      isAnonymous: user.isAnonymous,
      twoFactorVerified: user.twoFactorVerified ?? false,
      tokenVersion: user.tokenVersion ?? 0,
      jti: randomBytes(16).toString('hex'),
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  async generateRefreshToken(user: AuthenticatedUser): Promise<string> {
    const payload = {
      sub: user.id,
      type: 'refresh' as const,
      jti: randomBytes(16).toString('hex'),
      tokenVersion: user.tokenVersion ?? 0,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.options.security?.refreshTokenSecret,
      expiresIn: this.refreshExpiresIn,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        isAnonymous: payload.isAnonymous ?? false,
        twoFactorVerified: payload.twoFactorVerified ?? false,
        tokenVersion: payload.tokenVersion ?? 0,
        jti: payload.jti,
      };
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<{
    sub: string;
    jti: string;
    tokenVersion?: number;
    exp?: number;
  } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.options.security?.refreshTokenSecret,
        },
      );
      return {
        sub: payload.sub,
        jti: payload.jti,
        tokenVersion: payload.tokenVersion ?? 0,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateOtpCode(length = 6): string {
    const digits = '0123456789';
    let code = '';
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += digits[bytes[i] % 10];
    }
    return code;
  }
}
