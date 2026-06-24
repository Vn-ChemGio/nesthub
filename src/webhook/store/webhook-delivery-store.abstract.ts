export interface WebhookDeliveryRecord {
  id?: string;
  eventType?: string;
  payload?: string;
  url?: string;
  status?: string;
  statusCode?: number;
  error?: string;
  attempt?: number;
  duration?: number;
  createdAt?: Date;
  completedAt?: Date;
}

export abstract class WebhookDeliveryStore {
  abstract upsert(
    id: string,
    data: Partial<WebhookDeliveryRecord>,
  ): Promise<void>;
}
