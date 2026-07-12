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
      <h1 className="text-2xl font-bold text-white">Minhas denúncias</h1>

      {isLoading && <p className="mt-4 text-white/60">Carregando...</p>}
      {reports && reports.length === 0 && (
        <p className="mt-4 text-white/60">Você ainda não abriu nenhuma denúncia.</p>
      )}

      <ul className="mt-6 divide-y divide-white/10">
        {reports?.map((report) => (
          <li key={report.id} className="py-4">
            <p className="font-semibold text-white">
              {report.category} — <span className="text-white/60">{STATE_LABEL[report.case_state]}</span>
            </p>
            {report.details && <p className="mt-1 text-sm text-white/70">{report.details}</p>}
            {report.resolution_note && (
              <p className="mt-1 text-sm text-white/50">Resolução: {report.resolution_note}</p>
            )}
            <p className="mt-1 text-xs text-white/40">
              Aberta em {new Date(report.created_at).toLocaleDateString('pt-BR')}
            </p>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
