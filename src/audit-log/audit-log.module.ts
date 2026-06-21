import { Global, Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service.js';
import { AuditLogEntity } from './entities/audit-log.entity.js';
import { AUDITLOG_MODULE_OPTIONS, AUDITLOG_REPOSITORY } from './interfaces.js';
import type { AuditLogModuleOptions } from './interfaces.js';

@Global()
@Module({})
export class AuditLogModule {
  static forRoot(options?: AuditLogModuleOptions): DynamicModule {
    const typeormEnabled = options?.typeorm?.enabled ?? true;

    const providers: any[] = [
      {
        provide: AUDITLOG_MODULE_OPTIONS,
        useValue: options ?? { typeorm: { enabled: true } },
      },
      AuditLogService,
    ];

    if (typeormEnabled) {
      providers.push({
        provide: AUDITLOG_REPOSITORY,
        useExisting: getRepositoryToken(AuditLogEntity),
      });
      return {
        module: AuditLogModule,
        imports: [TypeOrmModule.forFeature([AuditLogEntity])],
        providers,
        exports: [AuditLogService],
      };
    }

    return {
      module: AuditLogModule,
      providers,
      exports: [AuditLogService],
    };
  }
}
