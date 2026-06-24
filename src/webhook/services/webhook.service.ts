import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { randomUUID, createHmac } from 'node:crypto';
import type {
  OutgoingWebhookConfig,
  WebhookEvent,
  WebhookResult,
} from '../interfaces';
import { WEBHOOK_MODULE_OPTIONS } from '../webhook.constants';
import type { WebhookModuleOptions, WebhookDelivery } from '../interfaces';
import { WebhookCircuitBreaker } from './webhook-circuit-breaker.service';
import { WebhookDeliveryStore } from '../store';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(WEBHOOK_MODULE_OPTIONS)
    private readonly options: WebhookModuleOptions,
    @Optional()
    private readonly store?: WebhookDeliveryStore,
    @Optional()
    private readonly circuitBreaker?: WebhookCircuitBreaker,
  ) {}

  async send(
    event: WebhookEvent,
    config: OutgoingWebhookConfig,
  ): Promise<WebhookResult> {
    const maxRetries =
      config.retries ?? this.options.outgoing?.defaultRetries ?? 3;
    const baseDelay =
      config.retryDelay ?? this.options.outgoing?.defaultRetryDelay ?? 1000;
    const timeout =
      config.timeout ?? this.options.outgoing?.defaultTimeout ?? 10000;

    const deliveryId = event.id;
    const startedAt = Date.now();

    await this.saveDelivery(deliveryId, {
      id: deliveryId,
      eventType: event.type,
      payload: event.payload,
      url: config.url,
      status: 'queued',
      attempt: 0,
      createdAt: new Date(),
    });

    if (this.circuitBreaker?.isOpen(config.url)) {
      const error = 'Circuit breaker is open';
      this.logger.warn(`Skipping webhook to ${config.url}: ${error}`);
      await this.saveDelivery(deliveryId, {
        id: deliveryId,
        status: 'failed',
        error,
        attempt: 0,
      });
      return {
        eventId: event.id,
        webhookId: randomUUID(),
        url: config.url,
        status: 0,
        success: false,
        duration: Date.now() - startedAt,
        attempt: 0,
        error,
      };
    }

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        await this.saveDelivery(deliveryId, {
          id: deliveryId,
          status: 'delivering',
          attempt,
        });

        const body = JSON.stringify({
          id: event.id,
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp.toISOString(),
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'NestHub-Webhook/1.0',
          ...config.headers,
        };

        if (config.secret) {
          headers['X-Signature-256'] = this.sign(body, config.secret);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);
        const duration = Date.now() - start;

        this.logger.log(
          `Webhook ${event.type} -> ${config.url}: ${response.status} (${duration}ms, attempt ${attempt}/${maxRetries})`,
        );

        if (response.ok) {
          this.circuitBreaker?.recordSuccess(config.url);
          await this.saveDelivery(deliveryId, {
            id: deliveryId,
            status: 'delivered',
            statusCode: response.status,
            duration: Date.now() - startedAt,
            completedAt: new Date(),
          });
          return {
            eventId: event.id,
            webhookId: randomUUID(),
            url: config.url,
            status: response.status,
            success: true,
            duration: Date.now() - startedAt,
            attempt,
          };
        }

        lastError = `HTTP ${response.status}`;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Webhook attempt ${attempt}/${maxRetries} failed: ${lastError}`,
        );
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.circuitBreaker?.recordFailure(config.url);
    await this.saveDelivery(deliveryId, {
      id: deliveryId,
      status: 'failed',
      error: lastError,
      attempt: maxRetries,
      completedAt: new Date(),
    });

    return {
      eventId: event.id,
      webhookId: randomUUID(),
      url: config.url,
      status: 0,
      success: false,
      duration: Date.now() - startedAt,
      attempt: maxRetries,
      error: lastError,
    };
  }

  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: 'hmac-sha256' | 'hmac-sha1' = 'hmac-sha256',
  ): boolean {
    const algo = algorithm === 'hmac-sha256' ? 'sha256' : 'sha1';
    const expected = createHmac(algo, secret).update(payload).digest('hex');
    return signature === expected;
  }

  private sign(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  private async saveDelivery(
    id: string,
    partial: Partial<WebhookDelivery>,
  ): Promise<void> {
    if (!this.store) return;
    try {
      const { payload, ...rest } = partial;
      await this.store.upsert(id, {
        id,
        ...rest,
        ...(payload !== undefined && { payload: JSON.stringify(payload) }),
      });
    } catch (err) {
      this.logger.error(`Failed to persist webhook delivery ${id}: ${err}`);
    }
  }
}
