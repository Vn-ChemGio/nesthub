import { Global, Module, DynamicModule } from '@nestjs/common';
import { LoggerService } from './logger.service.js';
import { RequestLoggerInterceptor } from './request-logger.interceptor.js';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';
import { LOGGER_MODULE_OPTIONS, PINO_LOGGER } from './logger.constants.js';
import type { LoggerModuleOptions } from './interfaces.js';

function buildPinoProvider(options?: LoggerModuleOptions) {
  return {
    provide: PINO_LOGGER,
    useFactory: async () => {
      if (!options) return undefined;
      const pino = await import('pino');

      const targets: any[] = [];
      if (options.prettyPrint) {
        targets.push({
          target: 'pino-pretty',
          level: options.level ?? 'info',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        });
      }
      if (options.transports) {
        for (const t of options.transports) {
          targets.push({
            target: t.target,
            level: t.level ?? options.level,
            options: t.options,
          });
        }
      }

      const transport =
        targets.length > 0 ? pino.transport({ targets }) : undefined;
      return pino.default(
        {
          level: options.level ?? 'info',
          redact: options.redact,
          serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err,
          },
        },
        transport ?? undefined,
      );
    },
  };
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options?: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      providers: [buildPinoProvider(options), LoggerService],
      exports: [LoggerService, PINO_LOGGER],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => LoggerModuleOptions | Promise<LoggerModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: LoggerModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: LOGGER_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: PINO_LOGGER,
          inject: [LOGGER_MODULE_OPTIONS],
          useFactory: async (opts: LoggerModuleOptions) => {
            if (!opts) return undefined;
            const pino = await import('pino');
            const targets: any[] = [];
            if (opts.prettyPrint) {
              targets.push({
                target: 'pino-pretty',
                level: opts.level ?? 'info',
                options: { colorize: true, translateTime: 'HH:MM:ss.l' },
              });
            }
            if (opts.transports) {
              for (const t of opts.transports) {
                targets.push({
                  target: t.target,
                  level: t.level ?? opts.level,
                  options: t.options,
                });
              }
            }
            const transport =
              targets.length > 0 ? pino.transport({ targets }) : undefined;
            return pino.default(
              {
                level: opts.level ?? 'info',
                redact: opts.redact,
                serializers: {
                  req: pino.stdSerializers.req,
                  res: pino.stdSerializers.res,
                  err: pino.stdSerializers.err,
                },
              },
              transport ?? undefined,
            );
          },
        },
        LoggerService,
      ],
      exports: [LoggerService, PINO_LOGGER],
    };
  }
}

export { RequestLoggerInterceptor, CorrelationIdMiddleware };
