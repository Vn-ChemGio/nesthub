import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import type {
  AuthModuleOptions,
  LoginResult,
  OAuthProfile,
} from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

interface GoogleTokenPayload {
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

interface AppleTokenPayload {
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  name?: string;
}

@Injectable()
export class OnetapService {
  constructor(
    private readonly oauthService: OAuthService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async verifyGoogleIdToken(idToken: string): Promise<LoginResult> {
    const googleConfig = this.options.oauth?.google;
    if (!googleConfig?.clientId) {
      throw new BadRequestException('Google OneTap is not configured');
    }

    try {
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(
        Buffer.from(base64, 'base64').toString('utf-8'),
      ) as GoogleTokenPayload;

      if (payload.aud !== googleConfig.clientId) {
        throw new BadRequestException('Invalid token audience');
      }

      if (payload.exp * 1000 < Date.now()) {
        throw new BadRequestException('Token expired');
      }

      const profile: OAuthProfile = {
        provider: 'google',
        providerAccountId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: payload.name,
        image: payload.picture,
      };

      return this.oauthService.authenticate(profile);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid Google ID token');
    }
  }

  async verifyAppleIdToken(idToken: string): Promise<LoginResult> {
    const appleConfig = this.options.oauth?.apple;
    if (!appleConfig?.clientId) {
      throw new BadRequestException('Apple OneTap is not configured');
    }

    try {
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(
        Buffer.from(base64, 'base64').toString('utf-8'),
      ) as AppleTokenPayload;

      if (payload.aud !== appleConfig.clientId) {
        throw new BadRequestException('Invalid token audience');
      }

      if (payload.exp * 1000 < Date.now()) {
        throw new BadRequestException('Token expired');
      }

      const profile: OAuthProfile = {
        provider: 'apple',
        providerAccountId: payload.sub,
        email: payload.email,
        emailVerified: true,
        name: payload.name ?? payload.email,
      };

      return this.oauthService.authenticate(profile);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid Apple ID token');
    }
  }
}
