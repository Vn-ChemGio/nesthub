import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysModule } from './api-keys.module.js';
import { ApiKeyService } from './api-keys.service.js';

describe('ApiKeysModule', () => {
  let service: ApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ApiKeysModule.forRoot({ typeorm: { enabled: false } })],
    }).compile();
    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('should create an API key', async () => {
    const result = await service.create({ name: 'Test Key', userId: 'user-1' });
    expect(result.key).toMatch(/^nst_/);
    expect(result.name).toBe('Test Key');
  });

  it('should validate a valid key', async () => {
    const result = await service.create({ name: 'Test', userId: 'user-1' });
    const validation = await service.validate(result.key);
    expect(validation.valid).toBe(true);
  });

  it('should reject an unknown key', async () => {
    const validation = await service.validate('nst_unknown_key');
    expect(validation.valid).toBe(false);
  });

  it('should revoke a key and reject it on validate', async () => {
    const result = await service.create({ name: 'Test', userId: 'user-1' });
    await service.revoke(result.id);
    const validation = await service.validate(result.key);
    expect(validation.valid).toBe(false);
  });

  it('should restore a revoked key', async () => {
    const result = await service.create({ name: 'Test', userId: 'user-1' });
    await service.revoke(result.id);
    await service.restore(result.id);
    const validation = await service.validate(result.key);
    expect(validation.valid).toBe(true);
  });

  it('should reject an expired key', async () => {
    const past = new Date(Date.now() - 86400000);
    const result = await service.create({
      name: 'Expired',
      userId: 'user-1',
      expiresAt: past,
    });
    const validation = await service.validate(result.key);
    expect(validation.valid).toBe(false);
  });
});
