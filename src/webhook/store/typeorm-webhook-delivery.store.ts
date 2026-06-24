import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WebhookDeliveryRecord,
  WebhookDeliveryStore,
} from './webhook-delivery-store.abstract';
import { WebhookDeliveryEntity } from './webhook-delivery.entity';

@Injectable()
export class TypeOrmWebhookDeliveryStore extends WebhookDeliveryStore {
  constructor(
    @InjectRepository(WebhookDeliveryEntity)
    private readonly repo: Repository<WebhookDeliveryEntity>,
  ) {
    super();
  }

  async upsert(
    id: string,
    data: Partial<WebhookDeliveryRecord>,
  ): Promise<void> {
    await this.repo.upsert(this.repo.create(data as WebhookDeliveryEntity), [
      'id',
    ]);
  }
}
