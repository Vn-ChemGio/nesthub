export { AuthModule } from './auth.module';

export { User } from './entities/user.entity';
export { Account } from './entities/account.entity';
export { Verification } from './entities/verification.entity';
export { Passkey } from './entities/passkey.entity';
export { TokenSession } from './entities/token-session.entity';

export { AuthService } from './services/auth.service';
export { TokenService } from './services/token.service';
export { OAuthService } from './services/oauth.service';
export { TwoFactorService } from './services/two-factor.service';
export { OtpService } from './services/otp.service';
export { MagicLinkService } from './services/magic-link.service';
export { PasskeyService } from './services/passkey.service';
export { AnonymousService } from './services/anonymous.service';
export { SSOService } from './services/sso.service';
export { OnetapService } from './services/onetap.service';
export { TokenBlacklistService } from './services/token-blacklist.service';

export { AuthController } from './controllers/auth.controller';
export { TwoFactorController } from './controllers/two-factor.controller';
export { PasskeyController } from './controllers/passkey.controller';
export { AdminController } from './controllers/admin.controller';

export { AuthGuard } from './guards/auth.guard';
export { RolesGuard } from './guards/roles.guard';

export { Public } from './decorators/public.decorator';
export { Roles } from './decorators/roles.decorator';

export { AUTH_OPTIONS, AUTH_PREFIX } from './auth.constants';

export type {
  AuthModuleOptions,
  AuthProviderType,
  OAuthProviderName,
  SSOProviderName,
  TwoFactorMethod,
  OAuthProviderConfig,
  SSOProviderConfig,
  ProviderConfig,
  SecurityConfig,
  MaxSessionConfig,
  OverrideConfig,
  DatabaseConfig,
  TwoFactorConfig,
  PasskeyConfig,
  AnonymousConfig,
  MagicLinkConfig,
  OtpConfig,
  OnelinkConfig,
  AuthenticatedUser,
  LoginResult,
  RegisterResult,
  OAuthProfile,
  SSOProfile,
  PasskeyRegistration,
  PasskeyAuthentication,
  BackupCode,
  VerifyTokenResult,
  SendOtpInput,
  VerifyOtpInput,
  CreateUserInput,
  LinkAccountInput,
  SessionMetadata,
} from './interfaces';
