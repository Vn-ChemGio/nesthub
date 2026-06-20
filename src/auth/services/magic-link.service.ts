import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from '../entities/verification.entity';
import { TokenService } from './token.service';
import type {
  AuthModuleOptions,
  LoginResult,
  AuthenticatedUser,
} from '../interfaces';
import { AUTH_OPTIONS, MAGIC_LINK_PREFIX } from '../auth.constants';
import { User } from '../entities/user.entity';

@Injectable()
export class MagicLinkService {
  private readonly expiresInMinutes: number;

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.expiresInMinutes = options.magicLink?.expiresInMinutes ?? 15;
  }

  async generateToken(
    email: string,
  ): Promise<{ token: string; expiresInMinutes: number }> {
    const rawToken = this.tokenService.generateSecureToken();
    const hashedToken = this.tokenService.hashToken(
      `${MAGIC_LINK_PREFIX}${rawToken}`,
    );

    const verification = this.verificationRepo.create({
      identifier: email,
      type: 'magic-link',
      token: hashedToken,
      metadata: { rawToken },
      expiresAt: new Date(Date.now() + this.expiresInMinutes * 60 * 1000),
    });

    await this.verificationRepo.save(verification);

    return { token: rawToken, expiresInMinutes: this.expiresInMinutes };
  }

  async verifyToken(rawToken: string): Promise<LoginResult> {
    const hashedToken = this.tokenService.hashToken(
      `${MAGIC_LINK_PREFIX}${rawToken}`,
    );

    const verification = await this.verificationRepo.findOne({
      where: { type: 'magic-link', token: hashedToken },
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    await this.verificationRepo.remove(verification);

    const email = verification.identifier;
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      user = this.userRepo.create({
        email,
        emailVerified: true,
        roles: ['user'],
        isAnonymous: false,
      });
      user = await this.userRepo.save(user);
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      await this.userRepo.save(user);
    }

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
