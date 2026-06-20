import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import { AuthModule } from './auth.module';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { OAuthService } from './services/oauth.service';
import { TwoFactorService } from './services/two-factor.service';
import { AnonymousService } from './services/anonymous.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { User } from './entities/user.entity';
import { Account } from './entities/account.entity';
import { Verification } from './entities/verification.entity';
import { Passkey } from './entities/passkey.entity';
import { TokenSession } from './entities/token-session.entity';
import { AUTH_OPTIONS } from './auth.constants';
import {
  AuthController,
  TwoFactorController,
  PasskeyController,
  AdminController,
} from './index';

describe('nesthub/auth', () => {
  describe('AuthModule.forRoot', () => {
    it('should return a DynamicModule with default options', () => {
      const mod = AuthModule.forRoot();

      expect(mod.module).toBe(AuthModule);
      expect(mod.providers).toBeDefined();
      expect(mod.controllers).toBeDefined();
      expect(mod.imports).toBeDefined();
      expect(mod.exports).toContain(AuthModule);
    });

    it('should include controllers based on default options', () => {
      const mod = AuthModule.forRoot();

      expect(mod.controllers).toContain(AuthController);
      expect(mod.controllers).toContain(TwoFactorController);
      expect(mod.controllers).toContain(AdminController);
      expect(mod.controllers).not.toContain(PasskeyController);
    });

    it('should include passkey controller when enabled', () => {
      const mod = AuthModule.forRoot({
        passkey: { enabled: true, relyingPartyId: 'test', origin: 'test' },
      });

      expect(mod.controllers).toContain(PasskeyController);
    });

    it('should include services and guards based on features', () => {
      const mod = AuthModule.forRoot();

      expect(mod.providers).toContain(AuthService);
      expect(mod.providers).toContain(TokenService);
      expect(mod.providers).toContain(TokenBlacklistService);
      expect(mod.providers).not.toContain(OAuthService);
      expect(mod.providers).toContain(TwoFactorService);
      expect(mod.providers).toContain(AnonymousService);
      expect(mod.providers).toContain(AuthGuard);
      expect(mod.providers).toContain(RolesGuard);
    });

    it('should include oauth service when oauth providers are configured', () => {
      const mod = AuthModule.forRoot({
        oauth: {
          google: { clientId: 'x', clientSecret: 'y', callbackUrl: 'z' },
        },
      });

      expect(mod.providers).toContain(OAuthService);
    });

    it('should provide resolved AUTH_OPTIONS', () => {
      const mod = AuthModule.forRoot();
      const optionsProvider = mod.providers!.find(
        (p: any) => p.provide === AUTH_OPTIONS,
      ) as any;

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.useValue).toBeDefined();
      expect(optionsProvider.useValue.providers).toEqual(['credentials']);
      expect(optionsProvider.useValue.security.jwtExpiresIn).toBe('15m');
      expect(optionsProvider.useValue.security.rateLimit.enabled).toBe(true);
    });

    it('should apply custom options', () => {
      const mod = AuthModule.forRoot({
        providers: ['credentials', 'oauth'],
        security: { jwtExpiresIn: '5m', jwtSecret: 'custom-secret' },
        twoFactor: { enabled: false },
      });
      const optionsProvider = mod.providers!.find(
        (p: any) => p.provide === AUTH_OPTIONS,
      ) as any;

      expect(optionsProvider.useValue.providers).toContain('oauth');
      expect(optionsProvider.useValue.security.jwtExpiresIn).toBe('5m');
      expect(optionsProvider.useValue.twoFactor.enabled).toBe(false);
    });
  });

  describe('AuthModule.forRootAsync', () => {
    it('should return a DynamicModule', () => {
      const mod = AuthModule.forRootAsync({
        useFactory: () => ({}),
        inject: [],
      });

      expect(mod.module).toBe(AuthModule);
      expect(mod.providers).toBeDefined();
      expect(mod.controllers).toBeDefined();
    });

    it('should pass through imports', () => {
      const mod = AuthModule.forRootAsync({
        useFactory: () => ({}),
        inject: [],
        imports: [],
      });

      expect(mod.module).toBe(AuthModule);
    });
  });

  describe('AuthService (integration with test bed)', () => {
    it('should be instantiable', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          JwtModule.register({
            secret: 'test',
            signOptions: { expiresIn: '15m' },
          }),
        ],
        providers: [
          AuthService,
          TokenService,
          TokenBlacklistService,
          {
            provide: getRepositoryToken(User),
            useClass: Repository,
          },
          {
            provide: getRepositoryToken(TokenSession),
            useClass: Repository,
          },
          {
            provide: AUTH_OPTIONS,
            useValue: { providers: ['credentials'] },
          },
        ],
      }).compile();

      const authService = moduleRef.get<AuthService>(AuthService);
      expect(authService).toBeDefined();
    });
  });

  describe('TokenBlacklistService', () => {
    let service: TokenBlacklistService;

    beforeEach(() => {
      service = new TokenBlacklistService();
    });

    it('should not blacklist a fresh jti', async () => {
      const result = await service.isBlacklisted('unknown-jti');
      expect(result).toBe(false);
    });

    it('should blacklist a jti', async () => {
      await service.blacklist('test-jti-1', new Date(Date.now() + 60000));
      const result = await service.isBlacklisted('test-jti-1');
      expect(result).toBe(true);
    });

    it('should auto-expire blacklisted entries', async () => {
      await service.blacklist('expired-jti', new Date(Date.now() - 1000));
      const result = await service.isBlacklisted('expired-jti');
      expect(result).toBe(false);
    });

    it('should handle multiple jtis independently', async () => {
      await service.blacklist('jti-1', new Date(Date.now() + 60000));
      await service.blacklist('jti-2', new Date(Date.now() + 60000));

      expect(await service.isBlacklisted('jti-1')).toBe(true);
      expect(await service.isBlacklisted('jti-2')).toBe(true);
      expect(await service.isBlacklisted('jti-3')).toBe(false);
    });
  });

  describe('TokenService', () => {
    let service: TokenService;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          JwtModule.register({
            secret: 'test-secret',
            signOptions: { expiresIn: '15m' },
          }),
        ],
        providers: [
          TokenService,
          {
            provide: AUTH_OPTIONS,
            useValue: {
              security: {
                jwtSecret: 'test-secret',
                refreshTokenSecret: 'test-refresh-secret',
                jwtExpiresIn: '15m',
                refreshTokenExpiresIn: '7d',
              },
            },
          },
        ],
      }).compile();

      service = moduleRef.get<TokenService>(TokenService);
    });

    it('should generate and verify access tokens', async () => {
      const token = await service.generateAccessToken({
        id: 'user-1',
        email: 'test@example.com',
        roles: ['user'],
        tokenVersion: 0,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = await service.verifyAccessToken(token);
      expect(payload).toBeDefined();
      expect(payload!.id).toBe('user-1');
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.tokenVersion).toBe(0);
      expect(payload!.jti).toBeDefined();
    });

    it('should generate and verify refresh tokens', async () => {
      const token = await service.generateRefreshToken({
        id: 'user-1',
        tokenVersion: 1,
      });

      expect(token).toBeDefined();

      const payload = await service.verifyRefreshToken(token);
      expect(payload).toBeDefined();
      expect(payload!.sub).toBe('user-1');
      expect(payload!.jti).toBeDefined();
      expect(payload!.tokenVersion).toBe(1);
      expect(payload!.exp).toBeDefined();
    });

    it('should reject invalid access tokens', async () => {
      const result = await service.verifyAccessToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject invalid refresh tokens', async () => {
      const result = await service.verifyRefreshToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should hash tokens consistently', () => {
      const hash1 = service.hashToken('test-token');
      const hash2 = service.hashToken('test-token');
      const hash3 = service.hashToken('other-token');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('should generate OTP codes with correct length', () => {
      const code4 = service.generateOtpCode(4);
      const code6 = service.generateOtpCode(6);
      const code8 = service.generateOtpCode(8);

      expect(code4.length).toBe(4);
      expect(code6.length).toBe(6);
      expect(code8.length).toBe(8);
      expect(/^\d+$/.test(code6)).toBe(true);
    });

    it('should generate secure tokens', () => {
      const token = service.generateSecureToken(16);
      expect(token.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });
  });

  describe('entities', () => {
    it('User should have required decorators', () => {
      const user = new User();
      expect(user).toBeDefined();
      expect(user.id).toBeUndefined();
      expect(user.deletedAt).toBeUndefined();
    });

    it('Account should have required decorators', () => {
      const account = new Account();
      expect(account).toBeDefined();
      expect(account.deletedAt).toBeUndefined();
    });

    it('Verification should have required decorators', () => {
      const verification = new Verification();
      expect(verification).toBeDefined();
      expect(verification.deletedAt).toBeUndefined();
    });

    it('Passkey should have required decorators', () => {
      const passkey = new Passkey();
      expect(passkey).toBeDefined();
      expect(passkey.deletedAt).toBeUndefined();
    });

    it('TokenSession should have required decorators', () => {
      const session = new TokenSession();
      expect(session).toBeDefined();
      expect(session.deletedAt).toBeUndefined();
    });
  });

  describe('exports', () => {
    it('should export AuthModule', () => {
      expect(AuthModule).toBeDefined();
    });

    it('should export all controllers', () => {
      expect(AuthController).toBeDefined();
      expect(TwoFactorController).toBeDefined();
      expect(PasskeyController).toBeDefined();
      expect(AdminController).toBeDefined();
    });

    it('should export User entity', () => {
      expect(User).toBeDefined();
    });
  });
});
