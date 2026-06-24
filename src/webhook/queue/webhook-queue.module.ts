import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookQueueService } from './webhook-queue.service';
import { WebhookProcessor } from './webhook.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'webhook' })],
  providers: [WebhookQueueService, WebhookProcessor],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
