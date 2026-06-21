import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ApiKeyService } from './api-keys.service.js';
import { APIKEY_MODULE_OPTIONS, APIKEY_REPOSITORY } from './interfaces.js';
import type { ApiKeyModuleOptions, ApiKeyRecord } from './interfaces.js';

interface ApiKeyRepository {
  save(data: Record<string, unknown>): Promise<ApiKeyRecord>;
  find(query: { where?: Record<string, unknown> }): Promise<ApiKeyRecord[]>;
  update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ affected: number }>;
}

const IN_MEMORY_STORE: ApiKeyRecord[] = [];

const IN_MEMORY_REPO: ApiKeyRepository = {
  save: (data) => {
    const record = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
    } as ApiKeyRecord;
    IN_MEMORY_STORE.push(record);
    return Promise.resolve(record);
  },
  find: (query) => {
    const where = query.where ?? {};
    return Promise.resolve(
      IN_MEMORY_STORE.filter((r) =>
        Object.entries(where).every(
          ([k, v]) => r[k as keyof ApiKeyRecord] === v,
        ),
      ),
    );
  },
  update: (id, data) => {
    const idx = IN_MEMORY_STORE.findIndex((r) => r.id === id);
    if (idx >= 0) Object.assign(IN_MEMORY_STORE[idx], data);
    return Promise.resolve({ affected: idx >= 0 ? 1 : 0 });
  },
};

function createRepositoryProvider(
  opts: ApiKeyModuleOptions,
): Provider<ApiKeyRepository> {
  if (!opts.typeorm?.enabled) {
    return { provide: APIKEY_REPOSITORY, useValue: IN_MEMORY_REPO };
  }

  return {
    provide: APIKEY_REPOSITORY,
    inject: [DataSource],
    useFactory: async (dataSource: DataSource) => {
      const { ApiKeyEntity } = await import('./api-key.entity.js');
      const { ApiKeyTypeOrmRepository } =
        await import('./api-key.repository.js');
      const repo = dataSource.getRepository(ApiKeyEntity);
      return new ApiKeyTypeOrmRepository(repo);
    },
  };
}

@Global()
@Module({})
export class ApiKeysModule {
  static forRoot(options?: ApiKeyModuleOptions): DynamicModule {
    const opts = options ?? { typeorm: { enabled: true } };
    return {
      module: ApiKeysModule,
      providers: [
        {
          provide: APIKEY_MODULE_OPTIONS,
          useValue: opts,
        },
        createRepositoryProvider(opts),
        ApiKeyService,
      ],
      exports: [ApiKeyService],
    };
  }
}
