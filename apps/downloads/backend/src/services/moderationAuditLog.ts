// DEB-076-01 (spec 076) — trilha de auditoria de moderacao separada de log
// generico. Linha JSON grepavel por prefixo `[moderation-audit]` (mesmo
// padrao de `[storage-failover]` em storage/failover.ts), agregavel via
// `docker logs | grep` sem precisar de infra nova de observabilidade.

export type ModerationAuditAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'archive'
  | 'report_decide';

export interface ModerationAuditEntry {
  action: ModerationAuditAction;
  actorUserId: string;
  materialId?: string;
  reportId?: string;
  reason?: string | null;
}

export function logModerationAudit(entry: ModerationAuditEntry): void {
  console.log('[moderation-audit]', JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
}
