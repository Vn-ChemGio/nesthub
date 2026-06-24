import type { Type } from '@nestjs/common';
import type { WebhookDeliveryStore } from './store';

export interface WebhookEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}

export interface OutgoingWebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface IncomingWebhookConfig {
  path?: string;
  secret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'hmac-sha256' | 'hmac-sha1';
}

export interface WebhookModuleOptions {
  incoming?: IncomingWebhookConfig;
  outgoing?: {
    defaultTimeout?: number;
    defaultRetries?: number;
    defaultRetryDelay?: number;
  };
  queue?: {
    enabled: boolean;
  };
  storage?: {
    enabled: boolean;
    store?: Type<WebhookDeliveryStore>;
  };
  circuitBreaker?: {
    enabled: boolean;
    threshold?: number;
    cooldownMs?: number;
  };
}

export interface WebhookResult {
  eventId: string;
  webhookId: string;
  url: string;
  status: number;
  success: boolean;
  duration: number;
  attempt: number;
  error?: string;
}

export type WebhookDeliveryStatus =
  | 'queued'
  | 'delivering'
  | 'delivered'
  | 'failed';

export interface WebhookDelivery {
  id: string;
  eventType: string;
  payload?: unknown;
  url: string;
  status: WebhookDeliveryStatus;
  statusCode?: number;
  error?: string;
  attempt: number;
  duration?: number;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}
