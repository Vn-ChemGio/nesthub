import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TwoFactorService } from '../services/two-factor.service';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  TwoFactorSetupResponse,
  TwoFactorEnableResponse,
  TwoFactorVerifyResponse,
  BackupCodesResponse,
} from '../responses';

@ApiTags('Two-Factor Auth')
@Controller('auth/2fa')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Get('setup')
  @ApiOperation({ summary: 'Generate TOTP secret for 2FA setup' })
  @ApiOkResponse({ type: TwoFactorSetupResponse })
  async setup(@CurrentUser('id') userId: string) {
    return this.twoFactorService.generateTOTPSecret(userId);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA with TOTP' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['secret', 'code'],
      properties: {
        secret: { type: 'string', example: 'JBSWY3DPEHPK3PXP' },
        code: { type: 'string', example: '123456' },
      },
    },
  })
  @ApiOkResponse({ type: TwoFactorEnableResponse })
  async enable(
    @CurrentUser('id') userId: string,
    @Body() input: { secret: string; code: string },
  ) {
    return this.twoFactorService.enableTOTP(userId, input.secret, input.code);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a TOTP code' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', example: '123456' },
      },
    },
  })
  @ApiOkResponse({ type: TwoFactorVerifyResponse })
  async verify(
    @CurrentUser('id') userId: string,
    @Body() input: { code: string },
  ): Promise<{ valid: boolean }> {
    const valid = await this.twoFactorService.verifyTOTP(userId, input.code);
    return { valid };
  }

  @Post('disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable(@CurrentUser('id') userId: string): Promise<void> {
    return this.twoFactorService.disable(userId);
  }

  @Post('backup-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiOkResponse({ type: BackupCodesResponse })
  async generateBackupCodes(@CurrentUser('id') userId: string) {
    const codes = await this.twoFactorService.generateBackupCodes(userId);
    return { backupCodes: codes };
  }

  @Post('verify-backup-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a backup code' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', example: 'ABCD-1234' },
      },
    },
  })
  @ApiOkResponse({ type: TwoFactorVerifyResponse })
  async verifyBackupCode(
    @CurrentUser('id') userId: string,
    @Body() input: { code: string },
  ): Promise<{ valid: boolean }> {
    const valid = await this.twoFactorService.verifyBackupCode(
      userId,
      input.code,
    );
    return { valid };
  }
}
