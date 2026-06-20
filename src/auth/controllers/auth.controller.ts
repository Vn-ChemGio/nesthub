import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AuthGuard } from '../guards/auth.guard';
import { Public } from '../decorators/public.decorator';
import type { AuthRequest } from '../types/request.type';
import type { SessionMetadata } from '../interfaces';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  UpdateProfileDto,
  AuthResponseDto,
  ProfileDto,
  UserDto,
  SessionDto,
  RevokeSessionDto,
  LogoutDto,
} from '../responses';

function extractMetadata(
  req: AuthRequest,
  deviceName?: string,
): SessionMetadata {
  return {
    ipAddress: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    deviceName,
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  async register(
    @Body() body: RegisterDto,
    @Req() req: AuthRequest,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(
      body,
      extractMetadata(req, body.deviceName),
    );
    return {
      user: result.user as unknown as UserDto,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email/phone and password' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: AuthRequest,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.loginWithPassword(
      body.identifier,
      body.password,
      extractMetadata(req, body.deviceName),
    );
    if (result.requiresTwoFactor) {
      return {
        user: result.user as unknown as UserDto,
        requiresTwoFactor: true,
        accessToken: '',
      };
    }
    return {
      user: result.user as unknown as UserDto,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Public()
  @Post('anonymous')
  @ApiOperation({ summary: 'Login anonymously' })
  async loginAnonymous(@Req() req: AuthRequest): Promise<AuthResponseDto> {
    const result = await this.authService.loginAnonymous(extractMetadata(req));
    return {
      user: result.user as unknown as UserDto,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      properties: {
        refreshToken: {
          type: 'string',
          example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4uLi4=',
        },
      },
    },
  })
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Req() req: AuthRequest,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.refreshAccessToken(
      refreshToken,
      extractMetadata(req),
    );
    if (!result) {
      return {
        user: {} as unknown as UserDto,
        accessToken: '',
        error: 'Invalid refresh token',
      };
    }
    return {
      user: result.user as unknown as UserDto,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout current session' })
  @ApiBody({ type: LogoutDto, required: false })
  async logout(
    @Req() req: AuthRequest,
    @Body() body?: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(req.user.id, body?.jti);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Logout all sessions' })
  async logoutAll(@Req() req: AuthRequest): Promise<{ message: string }> {
    await this.authService.logoutAll(req.user.id);
    return { message: 'All sessions logged out' };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Get all active sessions with device info' })
  async getSessions(@Req() req: AuthRequest): Promise<SessionDto[]> {
    return this.authService.getUserSessions(req.user.id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a specific session (logout device)' })
  async revokeSession(
    @Req() req: AuthRequest,
    @Param() params: RevokeSessionDto,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(params.id, req.user.id);
    return { message: 'Session revoked' };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: AuthRequest): Promise<ProfileDto> {
    const profile = await this.authService.getProfile(req.user.id);
    return profile as ProfileDto;
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Update profile' })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileDto> {
    const result = await this.authService.updateProfile(req.user.id, body);
    return result as ProfileDto;
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @Req() req: AuthRequest,
    @Body() body: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Delete('account')
  @ApiOperation({
    summary:
      'Delete account (GDPR) — anonymizes PII and invalidates all sessions',
  })
  async deleteAccount(@Req() req: AuthRequest): Promise<{ message: string }> {
    await this.authService.deleteAccount(req.user.id);
    return { message: 'Account deleted successfully' };
  }
}
