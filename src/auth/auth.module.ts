import {
  Global,
  Module,
  DynamicModule,
  Type,
  ForwardReference,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { User } from './entities/user.entity';
import { Account } from './entities/account.entity';
import { Verification } from './entities/verification.entity';
import { Passkey } from './entities/passkey.entity';
import { TokenSession } from './entities/token-session.entity';
import { AUTH_OPTIONS } from './auth.constants';
import type { AuthModuleOptions } from './interfaces';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { OAuthService } from './services/oauth.service';
import { TwoFactorService } from './services/two-factor.service';
import { OtpService } from './services/otp.service';
import { MagicLinkService } from './services/magic-link.service';
import { PasskeyService } from './services/passkey.service';
import { AnonymousService } from './services/anonymous.service';
import { SSOService } from './services/sso.service';
import { OnetapService } from './services/onetap.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AuthController } from './controllers/auth.controller';
import { TwoFactorController } from './controllers/two-factor.controller';
import { PasskeyController } from './controllers/passkey.controller';
import { AdminController } from './controllers/admin.controller';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

const guards = [AuthGuard, RolesGuard];
const strategies = [JwtStrategy];

function buildDefaultOptions(options?: AuthModuleOptions): AuthModuleOptions {
  return {
    providers: options?.providers ?? ['credentials'],
    credentials: {
      enabled: options?.credentials?.enabled ?? true,
      allowRegistration: options?.credentials?.allowRegistration ?? true,
    },
    oauth: options?.oauth,
    sso: options?.sso,
    twoFactor: {
      enabled: options?.twoFactor?.enabled ?? true,
      methods: options?.twoFactor?.methods ?? ['totp', 'email'],
      issuer: options?.twoFactor?.issuer,
      backupCodesCount: options?.twoFactor?.backupCodesCount ?? 8,
    },
    passkey: {
      enabled: options?.passkey?.enabled ?? false,
      relyingPartyName: options?.passkey?.relyingPartyName ?? 'NestHub Auth',
      relyingPartyId: options?.passkey?.relyingPartyId,
      origin: options?.passkey?.origin,
    },
    anonymous: {
      enabled: options?.anonymous?.enabled ?? true,
      maxAgeDays: options?.anonymous?.maxAgeDays ?? 30,
    },
    magicLink: {
      enabled: options?.magicLink?.enabled ?? false,
      expiresInMinutes: options?.magicLink?.expiresInMinutes ?? 15,
    },
    otp: {
      enabled: options?.otp?.enabled ?? false,
      expiresInMinutes: options?.otp?.expiresInMinutes ?? 10,
      length: options?.otp?.length ?? 6,
    },
    onelink: {
      enabled: options?.onelink?.enabled ?? false,
    },
    email: options?.email,
    security: {
      passwordHashRounds: options?.security?.passwordHashRounds ?? 12,
      jwtSecret: options?.security?.jwtSecret,
      jwtExpiresIn: options?.security?.jwtExpiresIn ?? '15m',
      refreshTokenSecret: options?.security?.refreshTokenSecret,
      refreshTokenExpiresIn: options?.security?.refreshTokenExpiresIn ?? '7d',
      rateLimit: options?.security?.rateLimit ?? {
        enabled: true,
        maxAttempts: 5,
        windowMs: 900000,
      },
      requireEmailVerification:
        options?.security?.requireEmailVerification ?? false,
      maxSessions: options?.security?.maxSessions,
    },
    database: {
      entities: options?.database?.entities,
    },
    cache: options?.cache,
    override: options?.override,
  };
}

function hasOAuth(opts: AuthModuleOptions): boolean {
  if (!opts.oauth) return false;
  return Object.values(opts.oauth).some(
    (v) =>
      v !== undefined &&
      'clientId' in v &&
      (v as { enabled?: boolean }).enabled !== false,
  );
}

function hasSSO(opts: AuthModuleOptions): boolean {
  return !!opts.sso && opts.sso.some((p) => p.enabled !== false);
}

function resolveConditionalServices(
  override: AuthModuleOptions['override'] | undefined,
  opts: AuthModuleOptions,
): Type<any>[] {
  const s = override?.services;
  const services: Type<any>[] = [
    s?.auth ?? AuthService,
    TokenService,
    TokenBlacklistService,
    AnonymousService,
  ];

  if (hasOAuth(opts) || opts.onelink?.enabled || s?.oauth) {
    services.push(s?.oauth ?? OAuthService);
  }
  if (opts.twoFactor?.enabled || s?.twoFactor) {
    services.push(s?.twoFactor ?? TwoFactorService);
  }
  if (opts.otp?.enabled || s?.otp) {
    services.push(s?.otp ?? OtpService);
  }
  if (opts.magicLink?.enabled || s?.magicLink) {
    services.push(s?.magicLink ?? MagicLinkService);
  }
  if (opts.passkey?.enabled || s?.passkey) {
    services.push(s?.passkey ?? PasskeyService);
  }
  if (hasSSO(opts) || s?.sso) {
    services.push(s?.sso ?? SSOService);
  }
  if (opts.onelink?.enabled || s?.onetap) {
    services.push(s?.onetap ?? OnetapService);
  }

  return services;
}

function resolveConditionalControllers(
  override: AuthModuleOptions['override'] | undefined,
  opts: AuthModuleOptions,
): Type<any>[] {
  const c = override?.controllers;
  const controllers: Type<any>[] = [c?.auth ?? AuthController, AdminController];

  if (opts.twoFactor?.enabled || c?.twoFactor) {
    controllers.push(c?.twoFactor ?? TwoFactorController);
  }
  if (opts.passkey?.enabled || c?.passkey) {
    controllers.push(c?.passkey ?? PasskeyController);
  }

  return controllers;
}

function resolveConditionalEntities(
  override: AuthModuleOptions['override'] | undefined,
  opts: AuthModuleOptions,
): Type<any>[] {
  const e = override?.entities;
  const entities: Type<any>[] = [e?.user ?? User, TokenSession];

  if (
    hasOAuth(opts) ||
    hasSSO(opts) ||
    override?.services?.oauth ||
    override?.services?.sso
  ) {
    entities.push(e?.account ?? Account);
  }
  if (
    opts.otp?.enabled ||
    opts.magicLink?.enabled ||
    override?.services?.otp ||
    override?.services?.magicLink
  ) {
    entities.push(e?.verification ?? Verification);
  }
  if (opts.passkey?.enabled || override?.services?.passkey) {
    entities.push(e?.passkey ?? Passkey);
  }

  return entities;
}

@Global()
@Module({})
export class AuthModule {
  static forRoot(options?: AuthModuleOptions): DynamicModule {
    const resolvedOptions = buildDefaultOptions(options);
    const jwtSecret =
      resolvedOptions.security?.jwtSecret ||
      process.env.JWT_SECRET ||
      'nesthub-jwt-secret';

    const entities = resolveConditionalEntities(
      options?.override,
      resolvedOptions,
    );
    const services = resolveConditionalServices(
      options?.override,
      resolvedOptions,
    );
    const controllers = resolveConditionalControllers(
      options?.override,
      resolvedOptions,
    );

    return {
      module: AuthModule,
      imports: [
        TypeOrmModule.forFeature(entities),
        JwtModule.register({
          secret: jwtSecret,
          signOptions: {
            expiresIn: (resolvedOptions.security?.jwtExpiresIn ??
              '15m') as SignOptions['expiresIn'],
          },
        }),
      ],
      controllers,
      providers: [
        ...services,
        ...guards,
        ...strategies,
        {
          provide: AUTH_OPTIONS,
          useValue: resolvedOptions,
        },
      ],
      exports: [...services, ...guards, AuthModule],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => AuthModuleOptions | Promise<AuthModuleOptions>;
    inject?: (string | symbol | Type<any>)[];
    imports?: (
      | DynamicModule
      | Type<any>
      | Promise<DynamicModule>
      | ForwardReference
    )[];
  }): DynamicModule {
    const allEntities: Type<any>[] = [
      User,
      Account,
      Verification,
      Passkey,
      TokenSession,
    ];

    const allControllers: Type<any>[] = [
      AuthController,
      AdminController,
      TwoFactorController,
      PasskeyController,
    ];

    const allServices: Type<any>[] = [
      AuthService,
      TokenService,
      TokenBlacklistService,
      OAuthService,
      TwoFactorService,
      OtpService,
      MagicLinkService,
      PasskeyService,
      AnonymousService,
      SSOService,
      OnetapService,
    ];

    return {
      module: AuthModule,
      imports: [
        ...(options.imports ?? []),
        JwtModule.registerAsync({
          global: true,
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return {
              secret:
                opts.security?.jwtSecret ||
                process.env.JWT_SECRET ||
                'nesthub-jwt-secret',
              signOptions: {
                expiresIn: (opts.security?.jwtExpiresIn ??
                  '15m') as SignOptions['expiresIn'],
              },
            };
          },
          inject: options.inject,
        }),
        TypeOrmModule.forFeature(allEntities),
      ],
      providers: [
        ...allServices,
        ...guards,
        ...strategies,
        {
          provide: AUTH_OPTIONS,
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return buildDefaultOptions(opts);
          },
          inject: options.inject,
        },
      ],
      controllers: allControllers,
      exports: [...allServices, ...guards, AuthModule],
    };
  }
}
