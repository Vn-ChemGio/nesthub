import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { CORRELATION_ID_HEADER } from './logger.constants.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly headerName: string = CORRELATION_ID_HEADER,
    private readonly generate: () => string = () => randomUUID(),
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers[this.headerName];
    const correlationId = Array.isArray(existing)
      ? existing[0]
      : (existing ?? this.generate());
    req.headers[this.headerName] = correlationId;
    res.setHeader(this.headerName, correlationId);
    next();
  }
}
