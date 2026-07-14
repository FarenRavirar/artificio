import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  listTableDuplicateCandidates,
  resolveTableDuplicateCandidate,
  scanTableDuplicateCandidates,
  type TableDuplicateCandidate,
  type TableDuplicateDecision,
} from '../api/tableDuplicatesApi';

function readDraftTitle(candidate: TableDuplicateCandidate): string {
  const payload = candidate.candidate_draft_payload ?? candidate.candidate_draft_parsed_payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Rascunho';
  const table = (payload as Record<string, unknown>).table;
  if (!table || typeof table !== 'object' || Array.isArray(table)) return 'Rascunho';
  const title = (table as Record<string, unknown>).title;
  return typeof title === 'string' && title.trim() ? title : 'Rascunho';
}

const decisions: Array<{ status: TableDuplicateDecision; label: string }> = [
  { status: 'confirmed_duplicate', label: 'Confirmar duplicata' },
  { status: 'rejected_duplicate', label: 'Não é duplicata' },
  { status: 'update_existing', label: 'Atualizar existente' },
];

export function TableDuplicatesPanel() {
  const [candidates, setCandidates] = useState<TableDuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCandidates(await listTableDuplicateCandidates());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar duplicatas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // SonarCloud PR #159: catch explícito evita promise solta sem operador void;
    // load já mostra toast e fecha loading, fallback cobre rejeição inesperada.
    const timer = setTimeout(() => { load().catch(() => undefined); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const result = await scanTableDuplicateCandidates();
      toast.success(`${result.tablePairs} par(es) mesa×mesa; ${result.draftPairs} draft×mesa.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao verificar duplicatas.');
    } finally {
      setScanning(false);
    }
  };

  const resolve = async (id: string, status: TableDuplicateDecision) => {
    setResolvingId(id);
    try {
      await resolveTableDuplicateCandidate(id, status);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar decisão.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/60">Comparação sob demanda. Nenhuma mesa é alterada ou apagada automaticamente.</p>
        <button type="button" onClick={scan} disabled={scanning || loading} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {scanning ? 'Verificando…' : 'Checar duplicatas'}
        </button>
      </div>

      {loading && <p className="py-6 text-center text-sm text-white/50">Carregando…</p>}
      {!loading && candidates.length === 0 && <p className="py-6 text-center text-sm text-white/50">Nenhum candidato. Rode a verificação.</p>}

      {candidates.map((candidate) => {
        const isDraftPair = Boolean(candidate.candidate_draft_id);
        return (
          <article key={candidate.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-200">{Math.round(candidate.score * 100)}% provável</span>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <a className="text-orange-300 underline" href={`/mesas/${candidate.table_slug}`} target="_blank" rel="noreferrer">{candidate.table_title}</a>
                  {/* Achado bot review PR #159: /gestao/catalogo?tableId= não é rota tratada; deep link real é /painel?edit=. */}
                  <a className="text-white/50 underline" href={`/painel?edit=${candidate.table_id}`}>editar</a>
                  <span className="text-white/30">×</span>
                  {isDraftPair ? (
                    <a className="text-cyan-300 underline" href={`/gestao/mesas/rascunhos?draft=${candidate.candidate_draft_id}`}>{readDraftTitle(candidate)}</a>
                  ) : (
                    <>
                      <a className="text-orange-300 underline" href={`/mesas/${candidate.candidate_table_slug}`} target="_blank" rel="noreferrer">{candidate.candidate_table_title}</a>
                      <a className="text-white/50 underline" href={`/painel?edit=${candidate.candidate_table_id}`}>editar</a>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs text-white/50">{candidate.status}</span>
            </div>

            {candidate.status === 'candidate' && (
              <div className="mt-4 flex flex-wrap gap-2">
                {decisions.map((decision) => (
                  <button key={decision.status} type="button" disabled={resolvingId !== null || loading} onClick={() => resolve(candidate.id, decision.status)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50">
                    {decision.label}
                  </button>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
