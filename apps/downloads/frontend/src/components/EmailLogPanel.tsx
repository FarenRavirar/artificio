import { useAdminEmailLog, useRetryEmailLog } from '../hooks/useAdminEmailLog';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado',
  failed: 'Falhou',
  skipped_no_email: 'Sem e-mail',
};

// T6.2/T6.3 (spec 083) — e-mails com falha/skip, reenvio manual pelo admin.
export function EmailLogPanel() {
  const { data: failedLogs } = useAdminEmailLog('failed');
  const { data: skippedLogs } = useAdminEmailLog('skipped_no_email');
  const retry = useRetryEmailLog();

  const logs = [...(failedLogs?.items ?? []), ...(skippedLogs?.items ?? [])];

  if (logs.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-[var(--fg)]">E-mails não enviados</h2>
      <ul className="mt-4 divide-y divide-[var(--line)]">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm text-[var(--fg)]">
                <span aria-hidden="true">⚠️</span>
                {STATUS_LABEL[log.status] ?? log.status} — {log.kind === 'material_rejected' ? 'reprovação' : 'aprovação'}
              </p>
              <p className="text-xs text-[var(--fg-muted)]">{log.error_detail ?? 'E-mail do autor não resolvido.'}</p>
            </div>
            <button
              type="button"
              onClick={() => retry.mutateAsync(log.id).catch(() => undefined)}
              disabled={retry.isPending}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] disabled:opacity-40"
            >
              Reenviar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
