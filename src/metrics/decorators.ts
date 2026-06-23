import { SetMetadata } from '@nestjs/common';

export const METRICS_TRACK_KEY = 'metrics:track';

export interface TrackMetricOptions {
  name?: string;
  labels?: Record<string, string>;
}

export const TrackMetric = (options?: TrackMetricOptions) =>
  SetMetadata(METRICS_TRACK_KEY, options ?? {});
