import { useRef, useState } from 'react';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
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
    /*
     * F7.6a (spec 100): o bloco vivia solto no fluxo do campo de bio, sem
     * moldura própria — sugestão de máquina e conteúdo autoral do mestre ficavam
     * indistinguíveis, num editor cujo resto é "o que você escreveu".
     *
     * A separação é de forma, não de legenda: moldura própria, título com
     * ícone e o pontilhado que já se usa no repo para "ainda não é definitivo"
     * (o `+N` do hero, spec 100 F6.1c). Nenhum tamanho ou peso novo — a régua
     * do editor tem 2 tamanhos e o requisito 5 os fecha; medido em §8h, o
     * defeito nunca foi a fonte.
     */
    <section className="bio-suggestions" aria-live="polite">
      <h4 className="bio-suggestions-title">
        <Sparkles className="w-4 h-4" aria-hidden="true" /> Sugestões automáticas
      </h4>
      <p className="bio-suggestions-note">
        A análise apenas sugere. Nada é alterado até você confirmar cada item.
      </p>
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={analyze} disabled={loading}>
          {loading ? 'Analisando bio…' : 'Sugerir atributos da bio'}
        </Button>
      </div>
      {error && <p role="alert" className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-error">{error}</p>}
      {isStale && !loading && (
        <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] opacity-75">
          A bio mudou desde a última análise. Analise de novo para ver sugestões do texto atual.
        </p>
      )}
      {analyzed && !isStale && visibleCandidates.length === 0 && !error && (
        <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] opacity-75">Nenhum atributo novo encontrado.</p>
      )}
      {visibleCandidates.map((candidate, index) => (
        // F7.6b: cartão de PROPOSTA, não de dado salvo. A borda pontilhada é o
        // que carrega a diferença — o mesmo vocabulário do indicador de
        // continuação do hero — e o rótulo "Proposta" a nomeia sem depender de
        // cor. `border` genérico não dizia nada: lia como campo já gravado.
        <article
          key={`${candidate.field}-${candidate.value}-${index}`}
          className="bio-suggestion-card"
        >
          <span className="bio-suggestion-tag">Proposta</span>
          <strong>{FIELD_LABELS[candidate.field]}: {String(candidate.value)}</strong>
          <span className="text-[length:var(--text-support)] leading-[var(--leading-support)]">Trecho: “{candidate.evidence}”</span>
          <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] opacity-75">Confiança: {Math.round(candidate.confidence * 100)}%</span>
          <div>
            <Button type="button" size="sm" onClick={() => confirm(candidate)}>
              Confirmar e aplicar
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
