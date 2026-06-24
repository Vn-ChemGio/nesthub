import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { WebhookEvent } from '../interfaces';

type WebhookEventHandler = (event: WebhookEvent) => void | Promise<void>;

@Injectable()
export class WebhookEventBus {
  private readonly logger = new Logger(WebhookEventBus.name);
  private readonly listeners = new Map<string, Set<WebhookEventHandler>>();

  on(eventType: string, handler: WebhookEventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  async emit(
    eventType: string,
    payload: unknown,
    eventId?: string,
  ): Promise<WebhookEvent> {
    const event: WebhookEvent = {
      id: eventId ?? randomUUID(),
      type: eventType,
      payload,
      timestamp: new Date(),
    };

    const handlers = this.listeners.get(eventType);
    if (!handlers || handlers.size === 0) return event;

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error(`Webhook handler error: ${error.message}`);
        }
      }
    }

    await Promise.allSettled(promises);
    return event;
  }

  removeAll(eventType?: string) {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }
}
