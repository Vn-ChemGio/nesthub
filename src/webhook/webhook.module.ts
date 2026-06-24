import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import {
  WebhookService,
  WebhookEventBus,
  WebhookCircuitBreaker,
} from './services';
import { WebhookController } from './controllers';
import { WEBHOOK_MODULE_OPTIONS } from './webhook.constants';
import {
  WebhookDeliveryStore,
  TypeOrmWebhookDeliveryStore,
  WebhookDeliveryEntity,
} from './store';
import type { WebhookModuleOptions } from './interfaces';

@Global()
@Module({})
export class WebhookModule {
  static async forRoot(options?: WebhookModuleOptions): Promise<DynamicModule> {
    const opts = options ?? {};
    const imports: any[] = [];
    const providers: Provider[] = [
      { provide: WEBHOOK_MODULE_OPTIONS, useValue: opts },
      WebhookService,
      WebhookEventBus,
    ];

    if (opts.queue?.enabled) {
      const { WebhookQueueModule } = await import('./queue');

      imports.push(WebhookQueueModule);
    }

    if (opts.storage?.enabled) {
      if (opts.storage.store) {
        providers.push({
          provide: WebhookDeliveryStore,
          useClass: opts.storage.store,
        });
      } else {
        const { TypeOrmModule } = await import('@nestjs/typeorm');
        imports.push(TypeOrmModule.forFeature([WebhookDeliveryEntity]));
        providers.push({
          provide: WebhookDeliveryStore,
          useClass: TypeOrmWebhookDeliveryStore,
        });
      }
    }

    if (opts.circuitBreaker?.enabled) {
      const threshold = opts.circuitBreaker.threshold;
      const cooldownMs = opts.circuitBreaker.cooldownMs;
      providers.push({
        provide: WebhookCircuitBreaker,
        useFactory: () => {
          const cb = new WebhookCircuitBreaker();
          cb.enable(threshold, cooldownMs);
          return cb;
        },
      });
    }

    return {
      module: WebhookModule,
      imports,
      controllers: [WebhookController],
      providers,
      exports: [WebhookService, WebhookEventBus],
    };
  }
}
