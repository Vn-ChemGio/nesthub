import { Global, Module, DynamicModule } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { LocalDriver } from './drivers/local.driver.js';
import { S3Driver } from './drivers/s3.driver.js';
import {
  STORAGE_MODULE_OPTIONS,
  STORAGE_DRIVERS,
  STORAGE_DEFAULT_DISK,
} from './storage.constants.js';
import type {
  StorageModuleOptions,
  StorageDriverConfig,
} from './interfaces.js';
import type { StorageDriver } from './drivers/driver.interface.js';

function buildDrivers(
  options: StorageModuleOptions,
): Map<string, StorageDriver> {
  const drivers = new Map<string, StorageDriver>();

  const addDriver = (name: string, config: StorageDriverConfig) => {
    if (config.driver === 'local') {
      drivers.set(name, new LocalDriver(config));
    } else if (config.driver === 's3') {
      drivers.set(name, new S3Driver(config));
    }
  };

  addDriver('default', options.default);
  if (options.disks) {
    for (const [name, config] of Object.entries(options.disks)) {
      addDriver(name, config);
    }
  }

  return drivers;
}

@Global()
@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    const drivers = buildDrivers(options);
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_DRIVERS,
          useValue: drivers,
        },
        {
          provide: STORAGE_DEFAULT_DISK,
          useValue: 'default',
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => StorageModuleOptions | Promise<StorageModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: STORAGE_DRIVERS,
          inject: [STORAGE_MODULE_OPTIONS],
          useFactory: (opts: StorageModuleOptions) => buildDrivers(opts),
        },
        {
          provide: STORAGE_DEFAULT_DISK,
          useValue: 'default',
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
