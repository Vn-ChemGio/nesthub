import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from '../entities/verification.entity';
import { TokenService } from './token.service';
import type {
  AuthModuleOptions,
  LoginResult,
  AuthenticatedUser,
} from '../interfaces';
import { AUTH_OPTIONS, OTP_PREFIX } from '../auth.constants';
import { User } from '../entities/user.entity';

@Injectable()
export class OtpService {
  private readonly expiresInMinutes: number;
  private readonly otpLength: number;

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.expiresInMinutes = options.otp?.expiresInMinutes ?? 10;
    this.otpLength = options.otp?.length ?? 6;
  }

  async sendOtp(
    identifier: string,
    purpose: 'login' | 'verify' | '2fa' = 'login',
  ): Promise<{ expiresInMinutes: number }> {
    const code = this.tokenService.generateOtpCode(this.otpLength);
    const token = this.tokenService.hashToken(`${OTP_PREFIX}${code}`);

    const verification = this.verificationRepo.create({
      identifier,
      type: purpose === '2fa' ? '2fa' : 'otp',
      token,
      metadata: { plainCode: code },
      expiresAt: new Date(Date.now() + this.expiresInMinutes * 60 * 1000),
    });

    await this.verificationRepo.save(verification);

    return { expiresInMinutes: this.expiresInMinutes };
  }

  async verifyOtp(
    identifier: string,
    code: string,
    purpose: 'login' | 'verify' | '2fa' = 'login',
  ): Promise<{ valid: boolean; loginResult?: LoginResult }> {
    const type = purpose === '2fa' ? '2fa' : 'otp';
    const token = this.tokenService.hashToken(`${OTP_PREFIX}${code}`);

    const verification = await this.verificationRepo.findOne({
      where: { identifier, type, token },
      order: { createdAt: 'DESC' },
    });

    if (!verification || verification.expiresAt < new Date()) {
      return { valid: false };
    }

    await this.verificationRepo.remove(verification);

    if (purpose === 'login') {
      const user = await this.userRepo.findOne({
        where: { email: identifier },
      });

      if (!user) {
        const newUser = this.userRepo.create({
          email: identifier,
          emailVerified: true,
          roles: ['user'],
          isAnonymous: false,
        });
        const saved = await this.userRepo.save(newUser);
        const refreshToken = await this.tokenService.generateRefreshToken({
          id: saved.id,
        });
        const accessToken = await this.tokenService.generateAccessToken({
          id: saved.id,
          email: saved.email,
          emailVerified: true,
          roles: saved.roles,
          isAnonymous: false,
          twoFactorEnabled: false,
          twoFactorVerified: false,
        });

        return {
          valid: true,
          loginResult: {
            user: {
              id: saved.id,
              email: saved.email,
              emailVerified: true,
              roles: saved.roles,
              isAnonymous: false,
              twoFactorEnabled: false,
              twoFactorVerified: false,
            },
            accessToken,
            refreshToken,
          },
        };
      }

      if (!user.emailVerified) {
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
          valid: true,
          loginResult: {
            user: authenticatedUser,
            accessToken: '',
            requiresTwoFactor: true,
          },
        };
      }

      const accessToken =
        await this.tokenService.generateAccessToken(authenticatedUser);
      const refreshToken =
        await this.tokenService.generateRefreshToken(authenticatedUser);

      return {
        valid: true,
        loginResult: {
          user: authenticatedUser,
          accessToken,
          refreshToken,
        },
      };
    }

    return { valid: true };
  }
}
