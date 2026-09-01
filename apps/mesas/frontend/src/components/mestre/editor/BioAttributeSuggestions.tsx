import { useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@artificio/ui';
import { authPost } from '../../../services/apiClient';

const candidateBaseSchema = z.object({
  evidence: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

const responseSchema = z.object({
  data: z.object({
    candidates: z.array(z.discriminatedUnion('field', [
      candidateBaseSchema.extend({
        field: z.literal('experience_years'),
        value: z.number().int().min(0).max(100),
      }),
      candidateBaseSchema.extend({
        field: z.enum(['specialties', 'languages', 'badges']),
        value: z.string().trim().min(1).max(120),
      }),
    ])).max(20),
  }),
});

type BioAttributeCandidate = z.infer<typeof responseSchema>['data']['candidates'][number];

const FIELD_LABELS: Record<BioAttributeCandidate['field'], string> = {
  experience_years: 'Anos de experiência',
  specialties: 'Especialidade',
  languages: 'Idioma',
  badges: 'Selo',
};

type BioAttributeSuggestionsProps = Readonly<{
  bio: string;
  onConfirm: (candidate: BioAttributeCandidate) => void;
}>;

/**
 * D11: a resposta da máquina vive somente no estado local. Nada deste
 * componente grava ao analisar; `onConfirm` só é chamado pelo botão explícito
 * de cada candidato.
 */
export function BioAttributeSuggestions({ bio, onConfirm }: BioAttributeSuggestionsProps) {
  const [candidates, setCandidates] = useState<BioAttributeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  // Bio que gerou a lista exibida. Estado derivado, comparado no render, em vez
  // de `useEffect` + `setState` — a lint deste repo reprova render em cascata.
  const [analyzedBio, setAnalyzedBio] = useState<string | null>(null);
  // Bio da análise em voo. Ref, não estado: só o retorno precisa saber se ainda
  // é a requisição corrente, e guardar em estado dispararia render por tecla.
  const requestedBioRef = useRef<string | null>(null);

  // Editar a bio invalida a lista: a `evidence` de cada candidato é trecho
  // literal do texto analisado, então uma sugestão sobrevivente citaria frase
  // que já não existe — e confirmá-la gravaria atributo tirado de bio antiga
  // (achado de review, PR #301).
  const isStale = analyzedBio !== null && analyzedBio !== bio;
  const visibleCandidates = isStale ? [] : candidates;

  const analyze = async () => {
    if (!bio.trim()) {
      setError('Escreva uma bio antes de buscar sugestões.');
      return;
    }
    const requestedBio = bio;
    requestedBioRef.current = requestedBio;
    setLoading(true);
    setError(null);
    try {
      const response = await authPost('/api/v1/gm/profile/bio-suggestions', { bio: requestedBio });
      const payload: unknown = await response.json().catch(() => null);
      // A bio mudou enquanto a análise voltava: descarta em silêncio. Escrever
      // o resultado aqui reporia na tela a lista que `isStale` acabou de
      // esconder, agora sem nada que a marcasse como velha.
      if (requestedBioRef.current !== requestedBio) return;
      if (!response.ok) {
        const message = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(message.success ? message.data.error : 'Não foi possível analisar a bio.');
      }
      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('A análise retornou um formato inválido.');
      setCandidates(parsed.data.data.candidates);
      setAnalyzedBio(requestedBio);
      setAnalyzed(true);
    } catch (cause: unknown) {
      if (requestedBioRef.current !== requestedBio) return;
      setCandidates([]);
      setAnalyzedBio(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível analisar a bio.');
    } finally {
      if (requestedBioRef.current === requestedBio) setLoading(false);
    }
  };

  const confirm = (candidate: BioAttributeCandidate) => {
    onConfirm(candidate);
    setCandidates((current) => current.filter((item) => item !== candidate));
  };

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={analyze} disabled={loading}>
          {loading ? 'Analisando bio…' : 'Sugerir atributos da bio'}
        </Button>
      </div>
      <p className="text-xs opacity-75">
        A análise apenas sugere. Nada é alterado até você confirmar cada item.
      </p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {isStale && !loading && (
        <p className="text-sm opacity-75">
          A bio mudou desde a última análise. Analise de novo para ver sugestões do texto atual.
        </p>
      )}
      {analyzed && !isStale && visibleCandidates.length === 0 && !error && (
        <p className="text-sm opacity-75">Nenhum atributo novo encontrado.</p>
      )}
      {visibleCandidates.map((candidate, index) => (
        <div key={`${candidate.field}-${candidate.value}-${index}`} className="flex flex-col gap-2 rounded border p-3">
          <strong>{FIELD_LABELS[candidate.field]}: {String(candidate.value)}</strong>
          <span className="text-sm">Trecho: “{candidate.evidence}”</span>
          <span className="text-xs opacity-75">Confiança: {Math.round(candidate.confidence * 100)}%</span>
          <div>
            <Button type="button" size="sm" onClick={() => confirm(candidate)}>
              Confirmar e aplicar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
