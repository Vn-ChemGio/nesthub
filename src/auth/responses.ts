import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsArray } from 'class-validator';

export class UserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: true })
  emailVerified?: boolean;

  @ApiPropertyOptional({ example: '+84123456789' })
  phone?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  image?: string;

  @ApiProperty({ type: [String], example: ['user'] })
  roles: string[];

  @ApiPropertyOptional({ example: false })
  isAnonymous?: boolean;

  @ApiPropertyOptional({ example: false })
  twoFactorEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  twoFactorVerified?: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE3MDQwNjk2MDAsImV4cCI6MTcwNDA3MzIwMH0.signature',
  })
  accessToken: string;

  @ApiPropertyOptional({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4uLi4=' })
  refreshToken?: string;

  @ApiPropertyOptional({ example: false })
  requiresTwoFactor?: boolean;

  @ApiPropertyOptional({ example: 'Invalid credentials' })
  error?: string;
}

export class ProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: true })
  emailVerified?: boolean;

  @ApiPropertyOptional({ example: '+84123456789' })
  phone?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  image?: string;

  @ApiProperty({ type: [String], example: ['user'] })
  roles: string[];

  @ApiPropertyOptional({ example: false })
  isAnonymous?: boolean;

  @ApiPropertyOptional({ example: false })
  twoFactorEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  twoFactorVerified?: boolean;
}

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+84123456789' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'SecureP@ss123' })
  password?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'John Doe' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String], example: ['user'] })
  roles?: string[];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Chrome on macOS' })
  deviceName?: string;
}

export class LoginDto {
  @IsString()
  @ApiProperty({ example: 'john@example.com' })
  identifier: string;

  @IsString()
  @ApiProperty({ example: 'SecureP@ss123' })
  password: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Chrome on macOS' })
  deviceName?: string;
}

export class ChangePasswordDto {
  @IsString()
  @ApiProperty({ example: 'OldP@ss123' })
  currentPassword: string;

  @IsString()
  @ApiProperty({ example: 'NewP@ss456' })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'John Updated' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://example.com/new-avatar.png' })
  image?: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'jti-abc-def-ghi' })
  jti?: string;
}

export class RevokeSessionDto {
  @IsString()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;
}

export class SessionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: 'jti-abc-def-ghi' })
  jti: string;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  ipAddress?: string;

  @ApiPropertyOptional({
    example:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })
  userAgent?: string;

  @ApiPropertyOptional({ example: 'Chrome on macOS' })
  deviceName?: string;

  @ApiProperty({ example: '2025-01-15T00:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2024-06-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-06-01T12:00:00.000Z' })
  updatedAt: Date;
}

export class TwoFactorSetupResponseDto {
  @ApiPropertyOptional({ example: 'JBSWY3DPEHPK3PXP' })
  secret?: string;

  @ApiPropertyOptional({
    example:
      'otpauth://totp/MyApp:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp',
  })
  otpauthUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['ABCD-1234', 'EFGH-5678', 'IJKL-9012'],
  })
  backupCodes?: string[];

  @ApiProperty({ example: 'Scan the QR code with your authenticator app' })
  message: string;
}

export class TwoFactorVerifyDto {
  @IsString()
  @ApiProperty({ example: '123456' })
  code: string;
}

export class TwoFactorStatusDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ type: [String], example: ['totp'] })
  methods: string[];
}

export class PasskeyRegistrationOptionsDto {
  @ApiProperty({
    example:
      'aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vLndlbGwta25vd24vd2ViYXV0aG4vcmVhbG0uanNvbg==',
  })
  challenge: string;

  @ApiProperty({ example: { name: 'MyApp', id: 'example.com' } })
  rp: { name: string; id: string };

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'john@example.com',
      displayName: 'John Doe',
    },
  })
  user: { id: string; name: string; displayName: string };

  @ApiProperty({
    type: [Object],
    example: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
  })
  pubKeyCredParams: { type: string; alg: number }[];

  @ApiPropertyOptional({
    example: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: 'preferred',
    },
  })
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    residentKey?: string;
    requireResidentKey?: boolean;
    userVerification?: string;
  };

  @ApiPropertyOptional({
    type: [Object],
    example: [{ id: 'credential-id-1', type: 'public-key' }],
  })
  excludeCredentials?: { id: string; type: string }[];
}

export class PasskeyAuthenticationOptionsDto {
  @ApiProperty({
    example:
      'aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vLndlbGwta25vd24vd2ViYXV0aG4vcmVhbG0uanNvbg==',
  })
  challenge: string;

  @ApiPropertyOptional({
    type: [Object],
    example: [{ id: 'credential-id-1', type: 'public-key' }],
  })
  allowCredentials?: { id: string; type: string }[];

  @ApiPropertyOptional({ example: 'preferred' })
  userVerification?: string;

  @ApiPropertyOptional({ example: 60000 })
  timeout?: number;
}

export class AdminUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+84123456789' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Admin User' })
  name?: string;

  @ApiProperty({ type: [String], example: ['admin', 'user'] })
  roles: string[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-06-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated Name' })
  name?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'updated@example.com' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+84987654321' })
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String], example: ['admin'] })
  roles?: string[];
}

export class TwoFactorSetupResponse extends TwoFactorSetupResponseDto {}
export class TwoFactorEnableResponse {
  @ApiProperty({ example: '2FA has been enabled successfully' })
  message: string;

  @ApiProperty({
    type: [String],
    example: ['ABCD-1234', 'EFGH-5678', 'IJKL-9012'],
  })
  backupCodes: string[];
}
export class TwoFactorVerifyResponse {
  @ApiProperty({ example: true })
  valid: boolean;
}
export class BackupCodesResponse {
  @ApiProperty({
    type: [String],
    example: ['ABCD-1234', 'EFGH-5678', 'IJKL-9012'],
  })
  backupCodes: string[];
}
export class AdminStatsResponse {
  @ApiProperty({ example: 42 })
  anonymousUsers: number;
}
export class AdminCleanupResponse {
  @ApiProperty({ example: 10 })
  deleted: number;
}
export class PasskeyRegistrationInitResponse {
  @ApiProperty({
    example:
      'aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vLndlbGwta25vd24vd2ViYXV0aG4vcmVhbG0uanNvbg==',
  })
  challenge: string;

  @ApiProperty({ example: { id: 'example.com', name: 'MyApp' } })
  rp: Record<string, any>;

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'john@example.com',
      displayName: 'John Doe',
    },
  })
  user: Record<string, any>;

  @ApiProperty({
    type: [Object],
    example: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
  })
  pubKeyCredParams: Record<string, any>[];
}
export class PasskeyAuthInitResponse {
  @ApiProperty({
    example:
      'aHR0cHM6Ly93d3cuZXhhbXBsZS5jb20vLndlbGwta25vd24vd2ViYXV0aG4vcmVhbG0uanNvbg==',
  })
  challenge: string;
}
export class PasskeyItemResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'My YubiKey' })
  name: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}
export class DeleteAccountDto {
  @ApiProperty({ example: 'Account deleted successfully' })
  message: string;
}

export class LoginSuccessResponse {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE3MDQwNjk2MDAsImV4cCI6MTcwNDA3MzIwMH0.signature',
  })
  accessToken: string;

  @ApiPropertyOptional({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4uLi4=' })
  refreshToken?: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
