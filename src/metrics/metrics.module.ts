import { Global, Module, DynamicModule } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import {
  METRICS_MODULE_OPTIONS,
  METRICS_REGISTRY,
} from './metrics.constants.js';
import type { MetricsModuleOptions } from './interfaces.js';

function buildRegistryProvider(options: MetricsModuleOptions) {
  return {
    provide: METRICS_REGISTRY,
    useFactory: async () => {
      const client = await import('prom-client');
      const register = new client.Registry();

      if (options.prefix) register.setDefaultLabels({});
      if (options.defaultLabels)
        register.setDefaultLabels(options.defaultLabels);
      if (options.collectDefaultMetrics !== false) {
        client.collectDefaultMetrics({ register });
      }

      const prefix = options.prefix ?? 'nesthub_';

      new client.Counter({
        name: `${prefix}http_requests_total`,
        help: 'Total HTTP requests',
        labelNames: ['method', 'path', 'status'],
        registers: [register],
      });

      new client.Histogram({
        name: `${prefix}http_request_duration_ms`,
        help: 'HTTP request duration in ms',
        labelNames: ['method', 'path', 'status'],
        buckets: options.requestDuration?.buckets ?? [
          5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
        ],
        registers: [register],
      });

      return register;
    },
  };
}

@Global()
@Module({})
export class MetricsModule {
  static forRoot(options?: MetricsModuleOptions): DynamicModule {
    return {
      module: MetricsModule,
      providers: [
        buildRegistryProvider(options ?? {}),
        {
          provide: METRICS_MODULE_OPTIONS,
          useValue: options ?? {},
        },
        MetricsService,
      ],
      exports: [MetricsService, METRICS_REGISTRY],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => MetricsModuleOptions | Promise<MetricsModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: MetricsModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: METRICS_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: METRICS_REGISTRY,
          inject: [METRICS_MODULE_OPTIONS],
          useFactory: async (opts: MetricsModuleOptions) => {
            const client = await import('prom-client');
            const register = new client.Registry();
            if (opts.defaultLabels)
              register.setDefaultLabels(opts.defaultLabels);
            if (opts.collectDefaultMetrics !== false) {
              client.collectDefaultMetrics({ register });
            }
            const prefix = opts.prefix ?? 'nesthub_';
            new client.Counter({
              name: `${prefix}http_requests_total`,
              help: 'Total HTTP requests',
              labelNames: ['method', 'path', 'status'],
              registers: [register],
            });
            new client.Histogram({
              name: `${prefix}http_request_duration_ms`,
              help: 'HTTP request duration in ms',
              labelNames: ['method', 'path', 'status'],
              buckets: opts.requestDuration?.buckets ?? [
                5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
              ],
              registers: [register],
            });
            return register;
          },
        },
        MetricsService,
      ],
      exports: [MetricsService, METRICS_REGISTRY],
    };
  }
}

export { MetricsInterceptor } from './metrics.interceptor.js';
export { TrackMetric } from './decorators.js';
