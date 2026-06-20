import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Account } from '../entities/account.entity';
import { TokenService } from './token.service';
import type {
  AuthModuleOptions,
  OAuthProviderName,
  OAuthProfile,
  LoginResult,
  AuthenticatedUser,
} from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async authenticate(profile: OAuthProfile): Promise<LoginResult> {
    const account = await this.accountRepo.findOne({
      where: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
      relations: { user: true },
    });

    if (account) {
      const user = account.user;
      if (!user) {
        throw new Error('User not found for linked account');
      }
      return this.createLoginResult(user);
    }

    if (profile.email) {
      const existingUser = await this.userRepo.findOne({
        where: { email: profile.email },
      });

      if (existingUser) {
        await this.linkAccount(existingUser.id, profile);
        return this.createLoginResult(existingUser);
      }
    }

    const allowRegistration = this.isRegistrationAllowed(profile.provider);
    if (!allowRegistration) {
      throw new UnauthorizedException(
        `Registration via ${profile.provider} is not allowed`,
      );
    }

    const user = this.userRepo.create({
      email: profile.email,
      emailVerified: profile.emailVerified ?? false,
      name: profile.name,
      image: profile.image,
      roles: ['user'],
      isAnonymous: false,
    });

    const savedUser = await this.userRepo.save(user);
    await this.linkAccount(savedUser.id, profile);

    return this.createLoginResult(savedUser);
  }

  async linkAccount(userId: string, profile: OAuthProfile): Promise<Account> {
    const existing = await this.accountRepo.findOne({
      where: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    });

    if (existing) return existing;

    const account = this.accountRepo.create({
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      image: profile.image,
    });

    return this.accountRepo.save(account);
  }

  async getUserAccounts(userId: string): Promise<Account[]> {
    return this.accountRepo.find({
      where: { userId },
    });
  }

  async unlinkAccount(
    userId: string,
    provider: string,
    providerAccountId: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const hasPassword = !!user.passwordHash;
    const accountCount = await this.accountRepo.count({ where: { userId } });

    if (!hasPassword && accountCount <= 1) {
      throw new Error('Cannot unlink the only authentication method');
    }

    await this.accountRepo.delete({
      userId,
      provider,
      providerAccountId,
    });
  }

  isProviderEnabled(provider: OAuthProviderName): boolean {
    const config = this.options.oauth?.[provider];
    if (!config) return false;
    if (config.enabled === false) return false;
    return !!(config?.clientId && config?.clientSecret);
  }

  isRegistrationAllowed(provider: OAuthProviderName): boolean {
    const config = this.options.oauth?.[provider];
    if (!config) return false;
    return config.allowRegistration !== false;
  }

  getProviderConfig(provider: OAuthProviderName) {
    return this.options.oauth?.[provider] ?? null;
  }

  getEnabledProviders(): {
    name: OAuthProviderName;
    allowRegistration: boolean;
  }[] {
    if (!this.options.oauth) return [];
    return (Object.keys(this.options.oauth) as OAuthProviderName[])
      .filter((p) => this.isProviderEnabled(p))
      .map((name) => ({
        name,
        allowRegistration: this.isRegistrationAllowed(name),
      }));
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
