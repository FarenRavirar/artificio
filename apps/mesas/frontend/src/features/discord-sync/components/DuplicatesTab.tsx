import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { DuplicateCandidate, DuplicateCandidateDecision } from '../types';

interface DuplicatesTabProps {
  readonly draftId: string;
  readonly listDuplicateCandidates: (draftId: string) => Promise<DuplicateCandidate[]>;
  readonly resolveDuplicateCandidate: (candidateId: string, status: DuplicateCandidateDecision) => Promise<DuplicateCandidate>;
}

const matchKindLabel: Record<DuplicateCandidate['match_kind'], string> = {
  exact: 'Duplicata exata',
  probable: 'Provável duplicata',
};

const statusLabel: Record<DuplicateCandidate['status'], string> = {
  candidate: 'Aguardando revisão',
  confirmed_duplicate: 'Confirmada como duplicata',
  rejected_duplicate: 'Rejeitada (não é duplicata)',
  update_existing: 'Marcada p/ atualizar existente',
};

function signalBadges(signals: Record<string, unknown>): string[] {
  const labels: Array<[string, string]> = [
    ['raw_hash_exact', 'texto idêntico'],
    ['normalized_hash_exact', 'texto normalizado igual'],
    ['same_form_url', 'mesmo link de inscrição'],
    ['same_channel', 'mesmo canal'],
    ['same_author', 'mesmo autor'],
    ['same_system_hint', 'mesmo sistema'],
  ];
  return labels.filter(([key]) => signals[key] === true).map(([, label]) => label);
}

export function DuplicatesTab({ draftId, listDuplicateCandidates, resolveDuplicateCandidate }: DuplicatesTabProps) {
  const [candidates, setCandidates] = useState<DuplicateCandidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDuplicateCandidates(draftId)
      .then((data) => {
        if (cancelled) return;
        setCandidates(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao buscar candidatos de duplicata.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [draftId, listDuplicateCandidates]);

  const handleResolve = async (candidateId: string, status: DuplicateCandidateDecision) => {
    setResolvingId(candidateId);
    try {
      const updated = await resolveDuplicateCandidate(candidateId, status);
      setCandidates((prev) => (prev ?? []).map((c) => (c.id === candidateId ? updated : c)));
      toast.success('Decisão registrada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar decisão.');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return <p className="text-white/50 text-sm">Buscando candidatos de duplicata...</p>;
  if (error) return <p className="text-red-300 text-sm" role="alert">{error}</p>;
  if (!candidates || candidates.length === 0) {
    return <p className="text-white/50 text-sm">Nenhum candidato de duplicata encontrado para este draft.</p>;
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => {
        const badges = signalBadges(candidate.signals);
        const isPending = candidate.status === 'candidate';
        return (
          <div key={candidate.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${candidate.match_kind === 'exact' ? 'bg-red-500/20 text-red-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {matchKindLabel[candidate.match_kind]}
              </span>
              <span className="text-white/50 text-xs">score: {(candidate.score * 100).toFixed(0)}%</span>
              <span className="text-white/50 text-xs">{statusLabel[candidate.status]}</span>
              {candidate.candidate_draft_status && (
                <span className="text-white/40 text-xs">draft candidato: {candidate.candidate_draft_status}</span>
              )}
            </div>

            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {badges.map((badge) => (
                  <span key={badge} className="px-2 py-0.5 rounded bg-white/10 text-white/60 text-xs">{badge}</span>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs text-white/60 line-clamp-3">{candidate.candidate_normalized_text}</p>

            {isPending && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(candidate.id, 'confirmed_duplicate')}
                  disabled={resolvingId === candidate.id}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                >
                  É duplicata
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(candidate.id, 'update_existing')}
                  disabled={resolvingId === candidate.id}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                >
                  Atualizar existente
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(candidate.id, 'rejected_duplicate')}
                  disabled={resolvingId === candidate.id}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 text-xs rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                >
                  Não é duplicata
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
