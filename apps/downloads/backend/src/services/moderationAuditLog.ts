// DEB-076-01 (spec 076) — trilha de auditoria de moderacao separada de log
// generico. Linha JSON grepavel por prefixo `[moderation-audit]` (mesmo
// padrao de `[storage-failover]` em storage/failover.ts), agregavel via
// `docker logs | grep` sem precisar de infra nova de observabilidade.

export type ModerationAuditAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'archive'
  | 'report_decide'
  // Spec 086 (Fase 4) — decisão de triagem de sugestão de sistema/taxonomia.
  | 'system_suggestion_decide';

export interface ModerationAuditEntry {
  action: ModerationAuditAction;
  actorUserId: string;
  materialId?: string;
  reportId?: string;
  suggestionId?: string;
  reason?: string | null;
}

export function logModerationAudit(entry: ModerationAuditEntry): void {
  console.log('[moderation-audit]', JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
}
