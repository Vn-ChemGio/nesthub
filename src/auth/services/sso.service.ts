import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Account } from '../entities/account.entity';
import { TokenService } from './token.service';
import type {
  AuthModuleOptions,
  SSOProfile,
  LoginResult,
  SSOProviderConfig,
  AuthenticatedUser,
} from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

@Injectable()
export class SSOService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async authenticateWithSSO(profile: SSOProfile): Promise<LoginResult> {
    const account = await this.accountRepo.findOne({
      where: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
      relations: { user: true },
    });

    if (account?.user) {
      return this.createLoginResult(account.user);
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: profile.email },
    });

    if (existingUser) {
      await this.linkSSOAccount(existingUser.id, profile);
      return this.createLoginResult(existingUser);
    }

    const providerConfig = this.getProviderConfigBySSOProfile(profile.provider);
    if (providerConfig && providerConfig.allowRegistration === false) {
      throw new UnauthorizedException(
        `Registration via SSO provider ${profile.provider} is not allowed`,
      );
    }

    const user = this.userRepo.create({
      email: profile.email,
      emailVerified: profile.emailVerified ?? true,
      name: profile.name,
      roles: ['user'],
      isAnonymous: false,
    });

    const savedUser = await this.userRepo.save(user);
    await this.linkSSOAccount(savedUser.id, profile);

    return this.createLoginResult(savedUser);
  }

  private async linkSSOAccount(
    userId: string,
    profile: SSOProfile,
  ): Promise<Account> {
    const account = this.accountRepo.create({
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      scope: 'sso',
    });

    return this.accountRepo.save(account);
  }

  getEnabledProviders(): SSOProviderConfig[] {
    return (this.options.sso ?? []).filter((p) => p.enabled !== false);
  }

  getProviderConfig(providerName: string): SSOProviderConfig | undefined {
    return this.options.sso?.find(
      (p) => p.label === providerName && p.enabled !== false,
    );
  }

  private getProviderConfigBySSOProfile(
    profileProvider: string,
  ): SSOProviderConfig | undefined {
    return this.options.sso?.find(
      (p) => `sso-${p.label}` === profileProvider && p.enabled !== false,
    );
  }

  private async createLoginResult(user: User): Promise<LoginResult> {
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      image: user.image,
      roles: user.roles,
      isAnonymous: user.isAnonymous,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: false,
    };

    if (user.twoFactorEnabled) {
      return {
        user: authenticatedUser,
        accessToken: '',
        requiresTwoFactor: true,
      };
    }

    const accessToken =
      await this.tokenService.generateAccessToken(authenticatedUser);
    const refreshToken =
      await this.tokenService.generateRefreshToken(authenticatedUser);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
    };
  }
}
