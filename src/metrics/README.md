# nesthub/metrics

Prometheus metrics module for NestJS — HTTP request tracking, Node.js process metrics, and custom application metrics.

## What it provides

### MetricsModule

A `@Global()` dynamic module registered via `forRoot()` or `forRootAsync()`.

**Options** (`MetricsModuleOptions`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'nesthub_'` | Prefix for all metric names |
| `defaultLabels` | `Record<string, string>` | `{}` | Default labels attached to every metric |
| `collectDefaultMetrics` | `boolean` | `true` | Collect Node.js process metrics (memory, CPU, event loop) via `prom-client` |
| `endpoint.enabled` | `boolean` | — | Enable a `/metrics` HTTP endpoint |
| `endpoint.path` | `string` | `'/metrics'` | Custom path for the metrics endpoint |
| `requestDuration.enabled` | `boolean` | — | Enable request duration histogram |
| `requestDuration.excludePaths` | `string[]` | — | Paths to exclude from duration tracking |
| `requestDuration.buckets` | `number[]` | `[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]` | Histogram buckets in ms |

### MetricsService

Injectable service for recording custom metrics:

| Method | Description |
|--------|-------------|
| `incrementCounter(name, labels?, value?)` | Increment a named counter (default 1) |
| `observeHistogram(name, value, labels?)` | Record an observation into a histogram |
| `setGauge(name, value, labels?)` | Set a gauge to a value |
| `getMetrics()` | Returns the Prometheus-formatted metrics string |
| `contentType()` | Returns the `Content-Type` header value for the metrics output |

**Example:**

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from 'nesthub/metrics';

@Injectable()
export class OrderService {
  constructor(private readonly metrics: MetricsService) {}

  async createOrder() {
    this.metrics.incrementCounter('orders_created_total', [
      { name: 'status', value: 'pending' },
    ]);
    this.metrics.observeHistogram('order_processing_duration_ms', 150);
    this.metrics.setGauge('active_orders', 42);
  }
}
```

### MetricsInterceptor

A NestJS interceptor that automatically tracks every HTTP request:

- **`{prefix}http_requests_total`** (Counter) — Total request count labelled by `method`, `path`, `status`
- **`{prefix}http_request_duration_ms`** (Histogram) — Request duration in ms, same labels

**Activation:**

Register as a global interceptor in your module:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from 'nesthub/metrics';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
```

Or apply it per controller via `@UseInterceptors(MetricsInterceptor)`.

### @TrackMetric decorator

A `SetMetadata` decorator to mark specific route handlers for custom metric tracking.

```typescript
import { TrackMetric } from 'nesthub/metrics';

@TrackMetric({ name: 'checkout_total', labels: { source: 'web' } })
@Post('checkout')
async checkout() { ... }
```

### Pre-defined metrics

| Metric name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `{prefix}http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests |
| `{prefix}http_request_duration_ms` | Histogram | `method`, `path`, `status` | HTTP request duration in ms |

When `collectDefaultMetrics` is enabled (default), `prom-client`'s default Node.js metrics are also registered (event loop lag, garbage collection, memory usage, CPU, etc.).

### Interfaces

- **`MetricsModuleOptions`** — configuration for `forRoot()` / `forRootAsync()`
- **`MetricLabel`** — `{ name: string; value: string }` used in metric label tuples

## Prometheus / Grafana

### Raw output (Prometheus scrape endpoint)

Hitting the `/metrics` endpoint returns Prometheus text format:

```
# HELP nesthub_http_requests_total Total HTTP requests
# TYPE nesthub_http_requests_total counter
nesthub_http_requests_total{method="GET",path="/api/users",status="200"} 102
nesthub_http_requests_total{method="POST",path="/api/orders",status="201"} 45
nesthub_http_requests_total{method="GET",path="/api/users",status="500"} 3

# HELP nesthub_http_request_duration_ms HTTP request duration in ms
# TYPE nesthub_http_request_duration_ms histogram
nesthub_http_request_duration_ms_bucket{method="GET",path="/api/users",status="200",le="5"} 20
nesthub_http_request_duration_ms_bucket{method="GET",path="/api/users",status="200",le="10"} 55
nesthub_http_request_duration_ms_bucket{method="GET",path="/api/users",status="200",le="+Inf"} 102
nesthub_http_request_duration_ms_sum{method="GET",path="/api/users",status="200"} 4520
nesthub_http_request_duration_ms_count{method="GET",path="/api/users",status="200"} 102

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 2847.32

# HELP nodejs_heap_size_bytes Process heap size from Node.js
# TYPE nodejs_heap_size_bytes gauge
nodejs_heap_size_bytes 52428800
```

### PromQL queries

| Purpose | Query |
|----------|-------|
| Request rate (HTTP) | `rate(nesthub_http_requests_total[5m])` |
| Error rate | `rate(nesthub_http_requests_total{status=~"5.."}[5m])` |
| Error % | `sum(rate(nesthub_http_requests_total{status=~"5.."}[5m])) / sum(rate(nesthub_http_requests_total[5m])) * 100` |
| P95 latency | `histogram_quantile(0.95, rate(nesthub_http_request_duration_ms_bucket[5m]))` |
| Avg latency | `rate(nesthub_http_request_duration_ms_sum[5m]) / rate(nesthub_http_request_duration_ms_count[5m])` |
| Memory usage | `nodejs_heap_size_bytes` |
| CPU usage | `rate(process_cpu_seconds_total[5m])` |

### Suggested Grafana dashboard

You can create a dashboard with the following panels:

1. **Request rate** — Time series, `rate(nesthub_http_requests_total[5m])`, legend `{{method}} {{path}}`
2. **Error rate** — Time series, `rate(nesthub_http_requests_total{status=~"5.."}[5m])`
3. **Latency P50 / P95 / P99** — 3 time series from `histogram_quantile`
4. **Request duration heatmap** — Use `nesthub_http_request_duration_ms_bucket` with a heatmap panel
5. **Node.js memory** — `nodejs_heap_size_bytes`, `nodejs_heap_used_size_bytes`
6. **CPU usage** — `rate(process_cpu_seconds_total[5m])`

> **Note:** This module does not include a default dashboard JSON. You can import a Node.js sample dashboard from [Grafana Dashboards](https://grafana.com/grafana/dashboards/) and adjust metric names to match your configured prefix.

## Installation

```bash
npm install nesthub
npm install prom-client
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { MetricsModule } from 'nesthub/metrics';

@Module({
  imports: [
    MetricsModule.forRoot({
      prefix: 'myapp_',
      defaultLabels: { env: 'production' },
      collectDefaultMetrics: true,
    }),
  ],
})
export class AppModule {}
```

To expose the metrics endpoint, create a controller:

```typescript
import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from 'nesthub/metrics';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics() {
    return this.metrics.getMetrics();
  }
}
```

### Async registration

```typescript
MetricsModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    prefix: config.get('METRICS_PREFIX'),
    collectDefaultMetrics: true,
  }),
})
```
