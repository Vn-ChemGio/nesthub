export type LogLevel =
  | 'fatal'
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace'
  | 'silent';

export interface LoggerModuleOptions {
  level?: LogLevel;
  prettyPrint?: boolean;
  redact?: string[];
  correlationId?: {
    enabled?: boolean;
    headerName?: string;
    generate?: () => string;
  };
  requestLogging?: {
    enabled?: boolean;
    excludePaths?: string[];
    logHeaders?: string[];
    logBody?: boolean;
  };
  transports?: LoggerTransport[];
}

export interface LoggerTransport {
  target: string;
  level?: LogLevel;
  options?: Record<string, unknown>;
}

export interface CorrelationIdOptions {
  enabled?: boolean;
  headerName?: string;
  generate?: () => string;
}
