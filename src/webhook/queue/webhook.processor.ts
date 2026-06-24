import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WebhookService } from '../services';
import type { OutgoingWebhookConfig, WebhookEvent } from '../interfaces';

interface QueueJobData {
  event: WebhookEvent;
  config: OutgoingWebhookConfig;
  deliveryId: string;
  createdAt: string;
}

@Processor('webhook')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhookService: WebhookService) {
    super();
  }

  async process(job: Job<QueueJobData>): Promise<any> {
    const { event, config } = job.data;
    this.logger.log(`Processing webhook job ${job.id} (${event.type})`);
    return this.webhookService.send(event, config);
  }
}
