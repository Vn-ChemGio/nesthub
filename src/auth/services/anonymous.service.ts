import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AnonymousService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async cleanupExpiredAnonymousUsers(maxAgeDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const result = await this.userRepo.delete({
      isAnonymous: true,
      createdAt: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }

  async getAnonymousUserCount(): Promise<number> {
    return this.userRepo.count({
      where: { isAnonymous: true },
    });
  }
}
