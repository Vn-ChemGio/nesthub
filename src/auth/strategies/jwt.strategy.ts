import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../interfaces';

interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  isAnonymous?: boolean;
  twoFactorVerified?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'nesthub-jwt-secret',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      isAnonymous: payload.isAnonymous ?? false,
      twoFactorVerified: payload.twoFactorVerified ?? false,
    };
  }
}
