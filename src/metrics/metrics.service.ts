import { Injectable, Inject, Logger } from '@nestjs/common';
import { METRICS_REGISTRY } from './metrics.constants.js';
import type { MetricLabel } from './interfaces.js';
import type { Counter, Histogram, Gauge } from 'prom-client';

type MetricsRegistry = {
  getSingleMetric(
    name: string,
  ): Counter<string> | Histogram<string> | Gauge<string> | undefined;
  metrics(): Promise<string>;
  contentType: string;
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @Inject(METRICS_REGISTRY)
    private readonly registry: MetricsRegistry,
  ) {}

  incrementCounter(name: string, labels?: MetricLabel[], value?: number): void {
    const counter = this.registry.getSingleMetric(name) as
      | Counter<string>
      | undefined;
    if (!counter) return;
    counter.inc(this.toLabels(labels), value ?? 1);
  }

  observeHistogram(name: string, value: number, labels?: MetricLabel[]): void {
    const histogram = this.registry.getSingleMetric(name) as
      | Histogram<string>
      | undefined;
    if (!histogram) return;
    histogram.observe(this.toLabels(labels), value);
  }

  setGauge(name: string, value: number, labels?: MetricLabel[]): void {
    const gauge = this.registry.getSingleMetric(name) as
      | Gauge<string>
      | undefined;
    if (!gauge) return;
    gauge.set(this.toLabels(labels), value);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }

  private toLabels(labels?: MetricLabel[]): Record<string, string> {
    if (!labels || labels.length === 0) return {};
    return labels.reduce(
      (acc, l) => {
        acc[l.name] = l.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
