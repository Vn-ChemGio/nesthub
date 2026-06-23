import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const path: string =
      (request.route as { path: string } | undefined)?.path ?? request.url;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - start;
        const status = response.statusCode.toString();

        this.metrics.observeHistogram('http_request_duration_ms', duration, [
          { name: 'method', value: method },
          { name: 'path', value: path },
          { name: 'status', value: status },
        ]);

        this.metrics.incrementCounter('http_requests_total', [
          { name: 'method', value: method },
          { name: 'path', value: path },
          { name: 'status', value: status },
        ]);
      }),
    );
  }
}
