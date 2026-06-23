export interface MetricsModuleOptions {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
  endpoint?: {
    enabled?: boolean;
    path?: string;
  };
  requestDuration?: {
    enabled?: boolean;
    excludePaths?: string[];
    buckets?: number[];
  };
}

export interface MetricLabel {
  name: string;
  value: string;
}
