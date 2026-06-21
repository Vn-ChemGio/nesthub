export interface AuditLogModuleOptions {
  typeorm: { enabled: boolean };
  enabledActions?: string[];
  excludePaths?: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  diff?: Record<string, { from: unknown; to: unknown }>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export const AUDITLOG_MODULE_OPTIONS = 'AUDITLOG_MODULE_OPTIONS';
export const AUDITLOG_REPOSITORY = 'AUDITLOG_REPOSITORY';
