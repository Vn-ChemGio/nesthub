import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from '../entities/user.entity';
import { TokenService } from './token.service';
import type { AuthModuleOptions, BackupCode } from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

@Injectable()
export class TwoFactorService {
  private readonly issuer: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tokenService: TokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.issuer = options.twoFactor?.issuer ?? 'NestHub';
  }

  async generateTOTPSecret(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    try {
      const { authenticator } = await import('otplib');
      const secret = authenticator.generateSecret();
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');

      const otpauthUrl = authenticator.keyuri(
        user.email ?? userId,
        this.issuer,
        secret,
      );

      return { secret, otpauthUrl };
    } catch {
      throw new Error(
        'otplib is required for TOTP. Install it: npm install otplib',
      );
    }
  }

  async enableTOTP(
    userId: string,
    secret: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    try {
      const { authenticator } = await import('otplib');
      const isValid = authenticator.verify({ token: code, secret });
      if (!isValid) {
        throw new BadRequestException('Invalid TOTP code');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new Error('otplib is required for TOTP');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const backupCodeCount = this.options.twoFactor?.backupCodesCount ?? 8;
    const backupCodes = this.generateBackupCodesSync(backupCodeCount);

    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;
    user.backupCodes = backupCodes.map((c) => ({
      code: this.tokenService.hashToken(c),
      used: false,
    }));

    await this.userRepo.save(user);

    return { backupCodes };
  }

  async verifyTOTP(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    try {
      const { authenticator } = await import('otplib');
      return authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
      });
    } catch {
      return false;
    }
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.backupCodes) return false;

    const codes: BackupCode[] = user.backupCodes;
    const index = codes.findIndex(
      (c) => !c.used && this.tokenService.hashToken(code) === c.code,
    );

    if (index === -1) return false;

    codes[index].used = true;
    codes[index].usedAt = new Date().toISOString();
    user.backupCodes = codes;
    await this.userRepo.save(user);

    return true;
  }

  async disable(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.backupCodes = undefined;
    await this.userRepo.save(user);
  }

  async generateBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const backupCodeCount = this.options.twoFactor?.backupCodesCount ?? 8;
    const newCodes = this.generateBackupCodesSync(backupCodeCount);

    user.backupCodes = newCodes.map((c) => ({
      code: this.tokenService.hashToken(c),
      used: false,
    }));

    await this.userRepo.save(user);
    return newCodes;
  }

  private generateBackupCodesSync(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }
}
