import { Test, TestingModule } from '@nestjs/testing';
import { MetricsModule } from './metrics.module.js';
import { MetricsService } from './metrics.service.js';

describe('MetricsModule', () => {
  it('should provide MetricsService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule.forRoot({ collectDefaultMetrics: false })],
    }).compile();

    const service = module.get<MetricsService>(MetricsService);
    expect(service).toBeDefined();
  });

  it('should record and expose metrics', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule.forRoot({ collectDefaultMetrics: false })],
    }).compile();

    const service = module.get<MetricsService>(MetricsService);
    service.incrementCounter('nesthub_http_requests_total', [
      { name: 'method', value: 'GET' },
      { name: 'path', value: '/test' },
      { name: 'status', value: '200' },
    ]);

    const output = await service.getMetrics();
    expect(output).toContain('nesthub_http_requests_total');
    expect(output).toContain('method="GET"');
  });

  it('should handle forRootAsync', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MetricsModule.forRootAsync({
          useFactory: () => ({ collectDefaultMetrics: false }),
        }),
      ],
    }).compile();

    const service = module.get<MetricsService>(MetricsService);
    expect(service).toBeDefined();
  });
});
