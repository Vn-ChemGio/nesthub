import type { ConfigService } from '@nestjs/config';
import type { BullRootModuleOptions } from '@nestjs/bullmq';
import type { DefaultJobOptions } from 'bullmq';

export interface QueueModuleOptions {
  store?: 'valkey' | 'redis';
  prefix?: string;
  defaultJobOptions?: DefaultJobOptions;
}

export function configBullMQ(
  configService: ConfigService,
  options?: QueueModuleOptions,
): BullRootModuleOptions {
  const { store = 'valkey', prefix, defaultJobOptions } = options ?? {};
  const envKey = store === 'valkey' ? 'VALKEY_URL' : 'REDIS_URL';
  const url = configService.get<string>(envKey);
  if (!url) {
    throw new Error(`Missing ${envKey} environment variable.`);
  }
  return {
    connection: { url },
    prefix: prefix ?? '{default}',
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
      ...defaultJobOptions,
    },
  };
}
