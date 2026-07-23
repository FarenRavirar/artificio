import { PainelShell } from '../../components/PainelShell';
import { useMyReports } from '../../hooks/useMyReports';

const STATE_LABEL: Record<string, string> = {
  open: 'Aberta',
  in_review: 'Em análise',
  resolved: 'Resolvida',
  dismissed: 'Dispensada',
};

// DEB-074-02 (spec 074/075) resolvido — lista denuncias abertas pelo proprio
// usuario via GET /reports/mine.
export function DenunciasPage() {
  const { data: reports, isLoading } = useMyReports();

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Minhas denúncias</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {reports?.length === 0 && (
        <p className="mt-4 text-[var(--fg-muted)]">Você ainda não abriu nenhuma denúncia.</p>
      )}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {reports?.map((report) => (
          <li key={report.id} className="py-4">
            <p className="font-semibold text-[var(--fg)]">
              {report.category} — <span className="text-[var(--fg-muted)]">{STATE_LABEL[report.case_state]}</span>
            </p>
            {report.details && <p className="mt-1 text-sm text-[var(--fg-muted)]">{report.details}</p>}
            {report.resolution_note && (
              <p className="mt-1 text-sm text-[var(--fg-muted)]">Resolução: {report.resolution_note}</p>
            )}
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Aberta em {new Date(report.created_at).toLocaleDateString('pt-BR')}
            </p>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
