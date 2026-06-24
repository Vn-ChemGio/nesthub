import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { WebhookEvent, OutgoingWebhookConfig } from '../interfaces';
import { WebhookDeliveryStore } from '../store';

export const WEBHOOK_QUEUE_NAME = 'webhook';

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE_NAME)
    private readonly queue: Queue,
    @Optional()
    private readonly store?: WebhookDeliveryStore,
  ) {}

  async enqueue(
    event: WebhookEvent,
    config: OutgoingWebhookConfig,
  ): Promise<string> {
    const deliveryId = event.id;

    if (this.store) {
      try {
        await this.store.upsert(deliveryId, {
          id: deliveryId,
          eventType: event.type,
          payload: JSON.stringify(event.payload),
          url: config.url,
          status: 'queued',
          attempt: 0,
          createdAt: new Date(),
        });
      } catch (err) {
        this.logger.error(`Failed to persist webhook delivery: ${err}`);
      }
    }

    await this.queue.add(event.type, {
      event,
      config,
      deliveryId,
      createdAt: new Date().toISOString(),
    });

    return deliveryId;
  }
}
