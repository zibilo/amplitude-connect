import { AuditLogEntry } from '@/types/payroll';

// In-memory audit log store (would be PostgreSQL in production)
let auditLogs: AuditLogEntry[] = [];

/**
 * Add an entry to the audit log
 */
export function logAuditEvent(
  action: AuditLogEntry['action'],
  description: string,
  details?: Record<string, unknown>
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    action,
    description,
    user: 'Système', // Would come from auth in production
    details
  };
  
  auditLogs.unshift(entry); // Add to beginning
  
  // Keep only last 1000 entries in memory
  if (auditLogs.length > 1000) {
    auditLogs = auditLogs.slice(0, 1000);
  }
  
  // Also log to console for debugging
  console.log(`[AUDIT] ${entry.timestamp.toISOString()} - ${action}: ${description}`);
  
  return entry;
}

/**
 * Get all audit logs
 */
export function getAuditLogs(): AuditLogEntry[] {
  return [...auditLogs];
}

/**
 * Get audit logs filtered by action type
 */
export function getAuditLogsByAction(action: AuditLogEntry['action']): AuditLogEntry[] {
  return auditLogs.filter(log => log.action === action);
}

/**
 * Get audit logs for a specific date range
 */
export function getAuditLogsByDateRange(start: Date, end: Date): AuditLogEntry[] {
  return auditLogs.filter(log => 
    log.timestamp >= start && log.timestamp <= end
  );
}

/**
 * Clear all audit logs (for testing)
 */
export function clearAuditLogs(): void {
  auditLogs = [];
}

/**
 * Export audit logs to JSON
 */
export function exportAuditLogs(): string {
  return JSON.stringify(auditLogs, null, 2);
}

/**
 * Format action type for display
 */
export function formatActionType(action: AuditLogEntry['action']): string {
  const labels: Record<AuditLogEntry['action'], string> = {
    import: 'Import',
    export: 'Export',
    validation: 'Validation',
    reconciliation: 'Réconciliation',
    error: 'Erreur'
  };
  return labels[action] || action;
}

/**
 * Get action color class
 */
export function getActionColorClass(action: AuditLogEntry['action']): string {
  const colors: Record<AuditLogEntry['action'], string> = {
    import: 'bg-info/15 text-info',
    export: 'bg-success/15 text-success',
    validation: 'bg-primary/15 text-primary',
    reconciliation: 'bg-accent/15 text-accent-foreground',
    error: 'bg-destructive/15 text-destructive'
  };
  return colors[action] || 'bg-muted text-muted-foreground';
}
