import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { TokenSession } from '../entities/token-session.entity';
import { TokenService } from './token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import type {
  AuthModuleOptions,
  AuthenticatedUser,
  LoginResult,
  RegisterResult,
  CreateUserInput,
  SessionMetadata,
} from '../interfaces';
import { AUTH_OPTIONS } from '../auth.constants';

@Injectable()
export class AuthService {
  private readonly hashRounds: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TokenSession)
    private readonly sessionRepo: Repository<TokenSession>,
    private readonly tokenService: TokenService,
    private readonly blacklistService: TokenBlacklistService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthModuleOptions,
  ) {
    this.hashRounds = options.security?.passwordHashRounds ?? 12;
  }

  async register(
    input: CreateUserInput,
    metadata?: SessionMetadata,
  ): Promise<RegisterResult> {
    if (this.options.credentials?.enabled === false) {
      throw new BadRequestException('Credentials login is not enabled');
    }
    if (this.options.credentials?.allowRegistration === false) {
      throw new BadRequestException('Registration is not enabled');
    }
    if (input.email) {
      const existing = await this.userRepo.findOne({
        where: { email: input.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    if (input.phone) {
      const existing = await this.userRepo.findOne({
        where: { phone: input.phone },
      });
      if (existing) {
        throw new ConflictException('Phone already in use');
      }
    }

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, this.hashRounds);
    }

    const user = this.userRepo.create({
      email: input.email,
      phone: input.phone,
      name: input.name,
      image: input.image,
      passwordHash,
      roles: input.roles ?? ['user'],
      emailVerified: input.emailVerified ?? false,
      isAnonymous: input.isAnonymous ?? false,
      tokenVersion: 0,
    });

    const saved = await this.userRepo.save(user);

    const authenticatedUser: AuthenticatedUser = {
      id: saved.id,
      email: saved.email,
      emailVerified: saved.emailVerified,
      phone: saved.phone,
      name: saved.name,
      image: saved.image,
      roles: saved.roles,
      isAnonymous: saved.isAnonymous,
      twoFactorEnabled: saved.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: saved.tokenVersion,
    };

    const accessToken =
      await this.tokenService.generateAccessToken(authenticatedUser);
    const refreshToken = await this.tokenService.generateRefreshToken({
      id: saved.id,
    });

    await this.createSession(saved.id, refreshToken, metadata);
    await this.enforceSessionLimit(saved.id);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
    };
  }

  async loginWithPassword(
    identifier: string,
    password: string,
    metadata?: SessionMetadata,
  ): Promise<LoginResult> {
    if (this.options.credentials?.enabled === false) {
      throw new UnauthorizedException('Login with password is not enabled');
    }
    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createLoginResult(user, metadata);
  }

  async loginAnonymous(metadata?: SessionMetadata): Promise<RegisterResult> {
    const anonymousId = this.tokenService.generateSecureToken(16);

    const user = this.userRepo.create({
      name: `Anonymous_${anonymousId.slice(0, 8)}`,
      isAnonymous: true,
      anonymousId,
      roles: ['user'],
      tokenVersion: 0,
    });

    const saved = await this.userRepo.save(user);

    const authenticatedUser: AuthenticatedUser = {
      id: saved.id,
      name: saved.name,
      roles: saved.roles,
      isAnonymous: true,
      twoFactorEnabled: false,
      twoFactorVerified: false,
      tokenVersion: saved.tokenVersion,
    };

    const accessToken =
      await this.tokenService.generateAccessToken(authenticatedUser);
    const refreshToken =
      await this.tokenService.generateRefreshToken(authenticatedUser);

    await this.createSession(saved.id, refreshToken, metadata);
    await this.enforceSessionLimit(saved.id);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
    };
  }

  async convertAnonymousUser(
    anonymousUserId: string,
    input: CreateUserInput,
    metadata?: SessionMetadata,
  ): Promise<RegisterResult> {
    if (this.options.credentials?.enabled === false) {
      throw new BadRequestException('Credentials login is not enabled');
    }
    if (
      input.password &&
      this.options.credentials?.allowRegistration === false
    ) {
      throw new BadRequestException('Registration is not enabled');
    }
    const user = await this.userRepo.findOne({
      where: { id: anonymousUserId, isAnonymous: true },
    });
    if (!user) {
      throw new BadRequestException('Anonymous user not found');
    }

    if (input.email) {
      const existing = await this.userRepo.findOne({
        where: { email: input.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = input.email;
    }

    if (input.password) {
      user.passwordHash = await bcrypt.hash(input.password, this.hashRounds);
    }

    if (input.name) user.name = input.name;
    if (input.image) user.image = input.image;
    user.isAnonymous = false;
    user.anonymousId = undefined;

    const saved = await this.userRepo.save(user);

    const authenticatedUser: AuthenticatedUser = {
      id: saved.id,
      email: saved.email,
      emailVerified: saved.emailVerified,
      phone: saved.phone,
      name: saved.name,
      image: saved.image,
      roles: saved.roles,
      isAnonymous: false,
      twoFactorEnabled: saved.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: saved.tokenVersion,
    };

    const accessToken =
      await this.tokenService.generateAccessToken(authenticatedUser);
    const refreshToken =
      await this.tokenService.generateRefreshToken(authenticatedUser);

    await this.createSession(saved.id, refreshToken, metadata);
    await this.enforceSessionLimit(saved.id);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    metadata?: SessionMetadata,
  ): Promise<LoginResult | null> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    if (await this.blacklistService.isBlacklisted(payload.jti)) {
      return null;
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) return null;

    if (
      payload.tokenVersion !== undefined &&
      payload.tokenVersion < user.tokenVersion
    ) {
      return null;
    }

    const oldTokenExpiry = payload.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 60_000);
    await this.blacklistService.blacklist(payload.jti, oldTokenExpiry);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      name: user.name,
      image: user.image,
      roles: user.roles,
      isAnonymous: user.isAnonymous,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: user.tokenVersion,
    };

    const accessToken =
      await this.tokenService.generateAccessToken(authenticatedUser);
    const newRefreshToken =
      await this.tokenService.generateRefreshToken(authenticatedUser);

    await this.createSession(user.id, newRefreshToken, metadata);
    await this.enforceSessionLimit(user.id);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async getProfile(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      name: user.name,
      image: user.image,
      roles: user.roles,
      isAnonymous: user.isAnonymous,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: user.tokenVersion,
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string; image?: string },
  ): Promise<AuthenticatedUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (data.name !== undefined) user.name = data.name;
    if (data.image !== undefined) user.image = data.image;

    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      email: saved.email,
      emailVerified: saved.emailVerified,
      phone: saved.phone,
      name: saved.name,
      image: saved.image,
      roles: saved.roles,
      isAnonymous: saved.isAnonymous,
      twoFactorEnabled: saved.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: saved.tokenVersion,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (this.options.credentials?.enabled === false) {
      throw new BadRequestException('Password management is not enabled');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Password change not available');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, this.hashRounds);
    await this.userRepo.save(user);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user || user.deletedAt) {
      throw new BadRequestException('Account not found');
    }

    user.email = undefined;
    user.phone = undefined;
    user.name = 'Deleted User';
    user.image = undefined;
    user.passwordHash = undefined;
    user.anonymousId = undefined;
    user.twoFactorSecret = undefined;
    user.backupCodes = undefined;
    user.tokenVersion += 1;

    await this.userRepo.softRemove(user);
    await this.sessionRepo.delete({ userId });
  }

  async logout(userId: string, jti?: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    if (jti) {
      const session = await this.sessionRepo.findOne({
        where: { userId, jti },
      });
      const expiry = session?.expiresAt ?? new Date(Date.now() + 60_000);
      await this.blacklistService.blacklist(jti, expiry);
      await this.sessionRepo.delete({ userId, jti });
    } else {
      user.tokenVersion += 1;
      await this.userRepo.save(user);
      await this.sessionRepo.delete({ userId });
    }
  }

  async logoutAll(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    user.tokenVersion += 1;
    await this.userRepo.save(user);
    await this.sessionRepo.delete({ userId });
  }

  async getUserSessions(userId: string): Promise<TokenSession[]> {
    return this.sessionRepo.find({
      where: {
        userId,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new BadRequestException('Session not found');
    }
    await this.blacklistService.blacklist(session.jti, session.expiresAt);
    await this.sessionRepo.delete(sessionId);
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const maxSessions = this.options.security?.maxSessions;
    if (!maxSessions?.enabled || !maxSessions.maxPerUser) return;

    const active = await this.sessionRepo.count({
      where: {
        userId,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (active <= maxSessions.maxPerUser) return;

    const oldest = await this.sessionRepo.find({
      where: {
        userId,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: active - maxSessions.maxPerUser,
    });

    for (const session of oldest) {
      await this.blacklistService.blacklist(session.jti, session.expiresAt);
    }

    const ids = oldest.map((s) => s.id);
    await this.sessionRepo.delete(ids);
  }

  async findUserByIdentifier(identifier: string): Promise<User | null> {
    if (identifier.includes('@')) {
      return this.userRepo.findOne({ where: { email: identifier } });
    }
    return (
      this.userRepo.findOne({ where: { email: identifier } }) ??
      this.userRepo.findOne({ where: { phone: identifier } })
    );
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    metadata?: SessionMetadata,
  ): Promise<void> {
    const decoded = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!decoded) return;

    const session = this.sessionRepo.create({
      userId,
      jti: decoded.jti,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceName: metadata?.deviceName,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.sessionRepo.save(session);
  }

  private async createLoginResult(
    user: User,
    metadata?: SessionMetadata,
  ): Promise<LoginResult> {
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      name: user.name,
      image: user.image,
      roles: user.roles,
      isAnonymous: user.isAnonymous,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: false,
      tokenVersion: user.tokenVersion,
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

    await this.createSession(user.id, refreshToken, metadata);
    await this.enforceSessionLimit(user.id);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
    };
  }
}
