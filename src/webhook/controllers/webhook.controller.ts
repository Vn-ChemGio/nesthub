import { Controller, Post, Headers, Req, Inject, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { WEBHOOK_MODULE_OPTIONS } from '../webhook.constants';
import type { WebhookModuleOptions } from '../interfaces';
import { WebhookService } from '../services';

@Controller()
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @Inject(WEBHOOK_MODULE_OPTIONS)
    private readonly options: WebhookModuleOptions,
    private readonly webhookService: WebhookService,
  ) {}

  @Post()
  handleIncoming(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const incoming = this.options.incoming;
    if (!incoming) {
      return { ok: true };
    }

    const sigHeader = incoming.signatureHeader ?? 'x-signature-256';
    const signature = headers[sigHeader.toLowerCase()];

    if (incoming.secret && signature) {
      const rawBody =
        (req as Request & { rawBody?: string }).rawBody ??
        JSON.stringify(req.body);
      const algorithm = incoming.signatureAlgorithm ?? 'hmac-sha256';
      const valid = this.webhookService.verifySignature(
        typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
        signature,
        incoming.secret,
        algorithm,
      );

      if (!valid) {
        this.logger.warn('Invalid webhook signature');
        return { ok: false, error: 'Invalid signature' };
      }
    }

    this.logger.log(`Incoming webhook received: ${req.method} ${req.url}`);
    return { ok: true };
  }
}
