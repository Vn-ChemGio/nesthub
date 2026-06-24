import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule } from './webhook.module';
import {
  WebhookService,
  WebhookEventBus,
  WebhookCircuitBreaker,
} from './services';
import { WebhookDeliveryStore, WebhookDeliveryEntity } from './store';
import { WEBHOOK_MODULE_OPTIONS } from './webhook.constants';
import type { WebhookModuleOptions } from './interfaces';
import { createHmac } from 'node:crypto';

describe('WebhookModule', () => {
  let webhookService: WebhookService;
  let eventBus: WebhookEventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [WebhookModule.forRoot()],
    }).compile();

    webhookService = module.get<WebhookService>(WebhookService);
    eventBus = module.get<WebhookEventBus>(WebhookEventBus);
  });

  it('should provide WebhookService', () => {
    expect(webhookService).toBeDefined();
  });

  it('should provide WebhookEventBus', () => {
    expect(eventBus).toBeDefined();
  });

  it('should verify HMAC signature', () => {
    const payload = 'test-payload';
    const secret = 'my-secret';
    const signature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    expect(webhookService.verifySignature(payload, signature, secret)).toBe(
      true,
    );
    expect(webhookService.verifySignature(payload, 'invalid', secret)).toBe(
      false,
    );
  });

  it('should emit and listen to events', async () => {
    const handler = jest.fn();
    eventBus.on('user.created', handler);

    await eventBus.emit('user.created', { id: 1, email: 'test@test.com' });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'user.created',
        payload: { id: 1, email: 'test@test.com' },
      }),
    );
  });

  it('should allow custom event ID on emit', async () => {
    const handler = jest.fn();
    eventBus.on('test', handler);

    const event = await eventBus.emit('test', { x: 1 }, 'custom-id-123');
    expect(event.id).toBe('custom-id-123');
  });
});

describe('WebhookService', () => {
  let service: WebhookService;

  function createMockEvent() {
    return {
      id: 'evt-1',
      type: 'test.event',
      payload: { foo: 'bar' },
      timestamp: new Date(),
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: WEBHOOK_MODULE_OPTIONS,
          useValue: {
            outgoing: {
              defaultTimeout: 500,
              defaultRetries: 1,
              defaultRetryDelay: 100,
            },
          } as WebhookModuleOptions,
        },
        WebhookService,
      ],
    }).compile();
    service = module.get<WebhookService>(WebhookService);
  });

  it('should return success on 2xx response', async () => {
    const mockFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await service.send(createMockEvent(), {
      url: 'https://example.com/webhook',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    mockFetch.mockRestore();
  });

  it('should retry and fail after exhausting attempts', async () => {
    const mockFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network error'));

    const result = await service.send(createMockEvent(), {
      url: 'https://example.com/webhook',
      retries: 2,
      retryDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempt).toBe(2);
    expect(result.error).toBe('Network error');
    expect(result.duration).toBeGreaterThanOrEqual(0);
    mockFetch.mockRestore();
  });

  it('should report total duration on failure (not 0)', async () => {
    const mockFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Timeout'));

    const result = await service.send(createMockEvent(), {
      url: 'https://example.com/webhook',
      retries: 2,
      retryDelay: 5,
    });

    expect(result.duration).toBeGreaterThan(0);
    mockFetch.mockRestore();
  });
});

describe('WebhookCircuitBreaker', () => {
  let cb: WebhookCircuitBreaker;

  beforeEach(() => {
    cb = new WebhookCircuitBreaker();
    cb.enable(3, 5000);
  });

  it('should be closed initially', () => {
    expect(cb.isOpen('https://example.com')).toBe(false);
  });

  it('should open after threshold failures', () => {
    cb.recordFailure('https://example.com');
    cb.recordFailure('https://example.com');
    expect(cb.isOpen('https://example.com')).toBe(false);
    cb.recordFailure('https://example.com');
    expect(cb.isOpen('https://example.com')).toBe(true);
  });

  it('should close on success', () => {
    cb.recordFailure('https://example.com');
    cb.recordFailure('https://example.com');
    cb.recordFailure('https://example.com');
    expect(cb.isOpen('https://example.com')).toBe(true);
    cb.recordSuccess('https://example.com');
    expect(cb.isOpen('https://example.com')).toBe(false);
  });

  it('should recover after cooldown', async () => {
    cb.enable(1, 10);
    cb.recordFailure('https://example.com');
    expect(cb.isOpen('https://example.com')).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(cb.isOpen('https://example.com')).toBe(false);
  });

  it('should record failure with custom threshold and cooldown', () => {
    cb.enable(2, 10000);
    cb.recordFailure('https://example.com', 2, 10000);
    cb.recordFailure('https://example.com', 2, 10000);
    expect(cb.isOpen('https://example.com')).toBe(true);
  });

  it('should not open when circuit breaker is disabled', () => {
    const disabled = new WebhookCircuitBreaker();
    disabled.recordFailure('https://example.com');
    disabled.recordFailure('https://example.com');
    disabled.recordFailure('https://example.com');
    expect(disabled.isOpen('https://example.com')).toBe(false);
  });

  it('should reset all entries', () => {
    cb.enable(1, 5000);
    cb.recordFailure('https://a.com');
    cb.recordFailure('https://b.com');
    cb.reset();
    expect(cb.isOpen('https://a.com')).toBe(false);
    expect(cb.isOpen('https://b.com')).toBe(false);
  });
});

describe('WebhookModule with storage', () => {
  it('should provide WebhookDeliveryStore when storage is enabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [WebhookDeliveryEntity],
          synchronize: true,
        }),
        await WebhookModule.forRoot({ storage: { enabled: true } }),
      ],
    }).compile();

    const store = module.get<WebhookDeliveryStore>(WebhookDeliveryStore);
    expect(store).toBeDefined();

    const svc = module.get<WebhookService>(WebhookService);
    expect(svc).toBeDefined();
  });
});

describe('WebhookModule with circuit breaker', () => {
  it('should provide WebhookCircuitBreaker when enabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WebhookModule.forRoot({
          circuitBreaker: { enabled: true, threshold: 3, cooldownMs: 5000 },
        }),
      ],
    }).compile();

    const cb = module.get<WebhookCircuitBreaker>(WebhookCircuitBreaker);
    expect(cb).toBeDefined();
    expect(cb.isOpen('https://example.com')).toBe(false);
  });
});
