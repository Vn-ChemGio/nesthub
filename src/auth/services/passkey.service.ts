import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Passkey } from '../entities/passkey.entity';
import { User } from '../entities/user.entity';
import { TokenService } from './token.service';
import type {
  AuthModuleOptions,
  AuthenticatedUser,
  LoginResult,
  PasskeyRegistration,
  PasskeyAuthentication,
} from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

@Injectable()
export class PasskeyService {
  constructor(
    @InjectRepository(Passkey)
    private readonly passkeyRepo: Repository<Passkey>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {}

  async initiateRegistration(userId: string): Promise<{
    challenge: string;
    rp: { name: string; id: string };
    user: { id: string; name: string; displayName: string };
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const challenge = this.tokenService.generateSecureToken(32);

    return {
      challenge,
      rp: {
        name: this.options.passkey?.relyingPartyName ?? 'NestHub Auth',
        id: this.options.passkey?.relyingPartyId ?? 'localhost',
      },
      user: {
        id: user.id,
        name: user.email ?? user.id,
        displayName: user.name ?? user.email ?? user.id,
      },
    };
  }

  async completeRegistration(
    userId: string,
    registration: PasskeyRegistration,
  ): Promise<Passkey> {
    const passkey = this.passkeyRepo.create({
      userId,
      credentialId: registration.id,
      publicKey: JSON.stringify(registration.response),
      credentialDeviceType: 'platform',
      credentialBackedUp: false,
      nickname: `Passkey ${new Date().toLocaleDateString()}`,
    });

    return this.passkeyRepo.save(passkey);
  }

  initiateAuthentication(): {
    challenge: string;
    allowCredentials?: { id: string; type: 'public-key' }[];
  } {
    const challenge = this.tokenService.generateSecureToken(32);
    return { challenge };
  }

  async completeAuthentication(
    authentication: PasskeyAuthentication,
  ): Promise<LoginResult> {
    const passkey = await this.passkeyRepo.findOne({
      where: { credentialId: authentication.id },
      relations: { user: true },
    });

    if (!passkey || !passkey.user) {
      throw new BadRequestException('Passkey not found');
    }

    const user = passkey.user;

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

  async getUserPasskeys(userId: string): Promise<
    Array<{
      id: string;
      credentialId: string;
      nickname: string;
      createdAt: Date;
    }>
  > {
    const passkeys = await this.passkeyRepo.find({
      where: { userId },
    });
    return passkeys.map((p) => ({
      id: p.id,
      credentialId: p.credentialId,
      nickname: p.nickname ?? '',
      createdAt: p.createdAt,
    }));
  }

  async deletePasskey(userId: string, passkeyId: string): Promise<void> {
    const passkey = await this.passkeyRepo.findOne({
      where: { id: passkeyId, userId },
    });
    if (!passkey) throw new BadRequestException('Passkey not found');
    await this.passkeyRepo.remove(passkey);
  }
}
