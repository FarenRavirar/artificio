import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSession } from '@artificio/auth/client';
import toast from 'react-hot-toast';
import { ContentEditor, MarkdownContent, contentOverflow } from '@artificio/content-editor';
import { useRatings, useSubmitRating } from '../hooks/useRating';

// Espelha o limite aceito pelo backend para o comentario da avaliacao.
const COMMENT_MAX_LENGTH = 1_000;

// D111 item 5 (spec 074) — avaliacao so disponivel apos download registrado
// pela mesma conta; guard mostra explicacao visivel, nunca so desabilita
// sem contexto (criterio de aceite 5).
export function RatingSection({ materialId }: Readonly<{ materialId: string }>) {
  const { user } = useSession();
  const { data: ratings } = useRatings(materialId);
  const submitMutation = useSubmitRating(materialId);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  // Spec 088 (T1.17) — o controle reflete a nota que o usuario JA enviou, em
  // vez do `useState(5)` fixo de antes: a pessoa ve o que avaliou e reavalia a
  // partir desse estado, nao de um 5 que ela nunca escolheu.
  const myRating = user ? ratings?.find((rating) => rating.is_mine) : undefined;
  const [lastSyncedRatingId, setLastSyncedRatingId] = useState<string | null>(null);
  if (myRating && myRating.id !== lastSyncedRatingId) {
    setLastSyncedRatingId(myRating.id);
    setScore(myRating.score);
    setComment(myRating.comment ?? '');
  }

  // Refs das cinco estrelas: mover a selecao por teclado tem que mover o FOCO
  // junto, senao o usuario perde a referencia de onde esta no grupo.
  const starRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusScore = (next: number) => {
    setScore(next);
    starRefs.current[next - 1]?.focus();
  };

  // Padrao WAI-ARIA de radiogroup: setas trocam a selecao (com wrap nos
  // extremos), Home/End vao ao primeiro/ultimo. Sem isso, `role="radio"`
  // anunciaria um comportamento que o controle nao tem.
  const handleStarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = score === 5 ? 1 : score + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = score === 1 ? 5 : score - 1;
    } else if (event.key === 'Home') {
      next = 1;
    } else if (event.key === 'End') {
      next = 5;
    }

    if (next === null) return;
    // Sem isto, as setas tambem rolariam a pagina.
    event.preventDefault();
    focusScore(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBlockedReason(null);
    try {
      await submitMutation.mutateAsync({ score, comment: comment.trim() || null });
      toast.success('Avaliação enviada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao avaliar.';
      setBlockedReason(message);
    }
  };

  const average = ratings && ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <div className="mt-10 border-t border-[var(--line)] pt-6">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Avaliações</h2>
      {average && <p className="mt-1 text-sm text-[var(--fg-muted)]">Média: {average} / 5 ({ratings?.length} avaliações)</p>}

      {!user && <p className="mt-4 text-sm text-[var(--fg-muted)]">Entre com sua conta para avaliar.</p>}

      {user && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {/* Spec 088 (T1.14-T1.16) — cinco estrelas clicaveis no lugar do
              `<select>` de 1 a 5.
              Trocar controle nativo por glifo e exatamente onde acessibilidade
              se perde, entao o grupo reimplementa o que o `<select>` dava de
              graca: `radiogroup` com nome, `aria-checked` expondo a selecao a
              tecnologia assistiva, e nome acessivel comunicando o VALOR
              ("3 de 5 estrelas"), nao a posicao.
              O alvo de toque e 44px (`h-11 w-11`) sem colisao visual entre as
              estrelas, e o estado selecionado difere por PREENCHIMENTO
              (`★` vs `☆`), nao so por cor — a distincao sobrevive em escala de
              cinza (T1.16).

              NAVEGACAO POR TECLADO (padrao WAI-ARIA de radiogroup): anunciar
              `role="radio"` sem implementar o comportamento seria pior que nao
              anunciar nada — o leitor de tela promete rádio e entrega botao.
              Duas partes:
              1. Roving tabIndex — o grupo INTEIRO e uma unica parada de Tab
                 (so a estrela selecionada tem `tabIndex=0`), igual ao
                 `<select>` que este controle substitui. Cinco paradas seriam
                 uma regressao pra quem navega so por teclado.
              2. Setas movem a selecao dentro do grupo, com wrap; Home/End vao
                 aos extremos. `preventDefault` impede a pagina de rolar. */}
          <div
            role="radiogroup"
            aria-label="Sua nota"
            className="flex items-center"
            onKeyDown={handleStarKeyDown}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = value === score;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${value} de 5 estrelas`}
                  // Roving tabIndex: so a opcao ativa e alcancavel por Tab.
                  tabIndex={selected ? 0 : -1}
                  ref={(node) => {
                    starRefs.current[value - 1] = node;
                  }}
                  onClick={() => setScore(value)}
                  className={`flex h-11 w-11 items-center justify-center rounded-md text-2xl leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-artificio-orange ${
                    value <= score ? 'text-artificio-orange' : 'text-[var(--fg-muted)]'
                  }`}
                >
                  <span aria-hidden="true">{value <= score ? '★' : '☆'}</span>
                </button>
              );
            })}
          </div>
          <ContentEditor label="Comentário da avaliação (opcional)" value={comment} onChange={setComment} maxLength={COMMENT_MAX_LENGTH} minHeight={128} />
          <button
            type="submit"
            // O editor avisa sobre o excesso mas não trunca mais, então quem
            // submete é que barra: sem isto o texto acima do limite viraria um
            // 400 do backend em vez de correção na tela (achado P1 do Codex,
            // PR #275).
            disabled={submitMutation.isPending || contentOverflow(comment, COMMENT_MAX_LENGTH) > 0}
            className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Avaliar
          </button>
        </form>
      )}

      {blockedReason && (
        <p role="alert" className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {blockedReason}
        </p>
      )}

      {ratings?.some((rating) => rating.comment) && (
        <div className="mt-6 space-y-3">
          {ratings.filter((rating) => rating.comment).map((rating) => (
            <div key={rating.id} className="rounded-md border border-[var(--line)] p-3">
              <p className="mb-2 text-sm text-amber-300">{'★'.repeat(rating.score)}{'☆'.repeat(5 - rating.score)}</p>
              <MarkdownContent value={rating.comment!} className="text-sm text-[var(--fg-muted)]" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
