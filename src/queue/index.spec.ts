import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';
import { configBullMQ } from './index';

type MockConfigService = {
  get: jest.Mock<unknown, [key: string, defaultValue?: unknown]>;
};

function createMockConfigService(
  env: Record<string, string> = {},
): MockConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      return key in env ? env[key] : defaultValue;
    }),
  };
}

describe('nesthub/queue', () => {
  describe('configBullMQ', () => {
    it('should read VALKEY_URL by default', () => {
      const config = createMockConfigService({
        VALKEY_URL: 'valkey://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService);

      expect((result.connection as RedisOptions).url).toBe(
        'valkey://localhost:6379',
      );
      expect(config.get).toHaveBeenCalledWith('VALKEY_URL');
    });

    it('should read REDIS_URL for redis store', () => {
      const config = createMockConfigService({
        REDIS_URL: 'redis://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService, {
        store: 'redis',
      });

      expect((result.connection as RedisOptions).url).toBe(
        'redis://localhost:6379',
      );
      expect(config.get).toHaveBeenCalledWith('REDIS_URL');
    });

    it('should throw on missing env var', () => {
      const config = createMockConfigService();
      expect(() => configBullMQ(config as unknown as ConfigService)).toThrow(
        'Missing VALKEY_URL environment variable.',
      );
    });

    it('should throw with REDIS_URL for redis store', () => {
      const config = createMockConfigService();
      expect(() =>
        configBullMQ(config as unknown as ConfigService, { store: 'redis' }),
      ).toThrow('Missing REDIS_URL environment variable.');
    });

    it('should apply prefix option', () => {
      const config = createMockConfigService({
        VALKEY_URL: 'valkey://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService, {
        prefix: '{myapp}',
      });

      expect(result.prefix).toBe('{myapp}');
    });

    it('should default prefix to {default}', () => {
      const config = createMockConfigService({
        VALKEY_URL: 'valkey://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService);

      expect(result.prefix).toBe('{default}');
    });

    it('should apply defaultJobOptions', () => {
      const config = createMockConfigService({
        VALKEY_URL: 'valkey://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService, {
        defaultJobOptions: { attempts: 3, removeOnComplete: 100 },
      });

      expect(result.defaultJobOptions).toEqual({
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: true,
      });
    });

    it('should return defaultJobOptions with auto-removal when not set', () => {
      const config = createMockConfigService({
        VALKEY_URL: 'valkey://localhost:6379',
      });
      const result = configBullMQ(config as unknown as ConfigService);

      expect(result.defaultJobOptions).toEqual({
        removeOnComplete: true,
        removeOnFail: true,
      });
    });
  });
});
