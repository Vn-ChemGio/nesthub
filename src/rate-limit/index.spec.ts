import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitModule } from './rate-limit.module.js';
import { RateLimitService } from './rate-limit.service.js';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RateLimitModule.forRoot({ defaultLimit: 3, defaultTtl: 60 })],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  it('should allow requests within limit', async () => {
    const result = await service.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should block when limit exceeded', async () => {
    await service.check('user-2');
    await service.check('user-2');
    await service.check('user-2');
    const result = await service.check('user-2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after expiry', async () => {
    const result = await service.check('user-3', { ttl: 0, limit: 100 });
    expect(result.allowed).toBe(true);
  });
});
