import type { Type } from '@nestjs/common';

import type { User } from './entities/user.entity';
import type { Account } from './entities/account.entity';
import type { Verification } from './entities/verification.entity';
import type { Passkey } from './entities/passkey.entity';
import type { TokenSession } from './entities/token-session.entity';
import type { AuthService } from './services/auth.service';
import type { TokenService } from './services/token.service';
import type { OAuthService } from './services/oauth.service';
import type { TwoFactorService } from './services/two-factor.service';
import type { OtpService } from './services/otp.service';
import type { MagicLinkService } from './services/magic-link.service';
import type { PasskeyService } from './services/passkey.service';
import type { AnonymousService } from './services/anonymous.service';
import type { SSOService } from './services/sso.service';
import type { OnetapService } from './services/onetap.service';
import type { AuthController } from './controllers/auth.controller';
import type { TwoFactorController } from './controllers/two-factor.controller';
import type { PasskeyController } from './controllers/passkey.controller';
import type { AdminController } from './controllers/admin.controller';

export type AuthProviderType =
  | 'credentials'
  | 'oauth'
  | 'magic-link'
  | 'otp'
  | 'passkey'
  | 'anonymous'
  | 'onelink'
  | 'sso';

export type OAuthProviderName =
  | 'google'
  | 'github'
  | 'facebook'
  | 'apple'
  | 'microsoft'
  | 'discord'
  | 'custom';

export type SSOProviderName = 'saml' | 'oidc';

export type TwoFactorMethod = 'totp' | 'email' | 'sms' | 'backup-code';

export interface OAuthProviderConfig {
  enabled?: boolean;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authorizeUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  callbackUrl?: string;
  allowRegistration?: boolean;
}

export interface SSOProviderConfig {
  enabled?: boolean;
  type: SSOProviderName;
  label: string;
  entryPoint: string;
  issuer: string;
  certificate?: string;
  privateKey?: string;
  callbackUrl?: string;
  allowRegistration?: boolean;
}

export interface CredentialsConfig {
  enabled?: boolean;
  allowRegistration?: boolean;
}

export interface EmailChannelConfig {
  from: string;
  subjectPrefix?: string;
}

export interface TwoFactorConfig {
  enabled?: boolean;
  methods?: TwoFactorMethod[];
  issuer?: string;
  backupCodesCount?: number;
}

export interface PasskeyConfig {
  enabled?: boolean;
  relyingPartyName?: string;
  relyingPartyId?: string;
  origin?: string;
}

export interface AnonymousConfig {
  enabled?: boolean;
  maxAgeDays?: number;
}

export interface MagicLinkConfig {
  enabled?: boolean;
  expiresInMinutes?: number;
}

export interface OtpConfig {
  enabled?: boolean;
  expiresInMinutes?: number;
  length?: number;
}

export interface OnelinkConfig {
  enabled?: boolean;
  googleClientId?: string;
  appleClientId?: string;
}

export interface ProviderConfig {
  google?: OAuthProviderConfig;
  github?: OAuthProviderConfig;
  facebook?: OAuthProviderConfig;
  apple?: OAuthProviderConfig;
  microsoft?: OAuthProviderConfig;
  discord?: OAuthProviderConfig;
  custom?: OAuthProviderConfig & { name: string };
}

export interface SecurityConfig {
  passwordHashRounds?: number;
  jwtSecret?: string;
  jwtExpiresIn?: string | number;
  refreshTokenSecret?: string;
  refreshTokenExpiresIn?: string | number;
  rateLimit?: {
    enabled?: boolean;
    maxAttempts?: number;
    windowMs?: number;
  };
  requireEmailVerification?: boolean;
  maxSessions?: MaxSessionConfig;
}

export interface MaxSessionConfig {
  enabled?: boolean;
  maxPerUser?: number;
}

export interface OverrideConfig {
  entities?: {
    user?: Type<User>;
    account?: Type<Account>;
    verification?: Type<Verification>;
    passkey?: Type<Passkey>;
    tokenSession?: Type<TokenSession>;
  };
  services?: {
    auth?: Type<AuthService>;
    token?: Type<TokenService>;
    oauth?: Type<OAuthService>;
    twoFactor?: Type<TwoFactorService>;
    otp?: Type<OtpService>;
    magicLink?: Type<MagicLinkService>;
    passkey?: Type<PasskeyService>;
    anonymous?: Type<AnonymousService>;
    sso?: Type<SSOService>;
    onetap?: Type<OnetapService>;
  };
  controllers?: {
    auth?: Type<AuthController>;
    twoFactor?: Type<TwoFactorController>;
    passkey?: Type<PasskeyController>;
    admin?: Type<AdminController>;
  };
}

export interface DatabaseConfig {
  entities?: {
    user?: Type<any>;
    account?: Type<any>;
    verification?: Type<any>;
    passkey?: Type<any>;
    tokenSession?: Type<any>;
  };
}

export interface AuthModuleOptions {
  providers?: AuthProviderType[];
  credentials?: CredentialsConfig;
  oauth?: ProviderConfig;
  sso?: SSOProviderConfig[];
  twoFactor?: TwoFactorConfig;
  passkey?: PasskeyConfig;
  anonymous?: AnonymousConfig;
  magicLink?: MagicLinkConfig;
  otp?: OtpConfig;
  onelink?: OnelinkConfig;
  email?: EmailChannelConfig;
  security?: SecurityConfig;
  database?: DatabaseConfig;
  cache?: {
    store?: any;
    ttl?: number;
  };
  override?: OverrideConfig;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  name?: string;
  image?: string;
  roles?: string[];
  isAnonymous?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorVerified?: boolean;
  tokenVersion?: number;
  jti?: string;
}

export interface LoginResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
}

export interface RegisterResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken?: string;
}

export interface OAuthProfile {
  provider: OAuthProviderName;
  providerAccountId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  image?: string;
}

export interface SSOProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  attributes?: Record<string, unknown>;
}

export interface PasskeyRegistration {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
  type: 'public-key';
}

export interface PasskeyAuthentication {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: string;
}

export interface VerifyTokenResult {
  valid: boolean;
  userId?: string;
  email?: string;
  reason?: string;
}

export interface SendOtpInput {
  email?: string;
  phone?: string;
  purpose: 'login' | 'verify' | '2fa';
}

export interface VerifyOtpInput {
  email?: string;
  phone?: string;
  code: string;
  purpose: 'login' | 'verify' | '2fa';
}

export interface CreateUserInput {
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
  image?: string;
  roles?: string[];
  emailVerified?: boolean;
  isAnonymous?: boolean;
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface LinkAccountInput {
  userId: string;
  provider: string;
  providerAccountId: string;
  email?: string;
  name?: string;
  image?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  idToken?: string;
  scope?: string;
  tokenType?: string;
}
