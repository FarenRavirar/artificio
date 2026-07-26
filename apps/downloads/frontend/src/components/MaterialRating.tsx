interface MaterialRatingProps {
  /** Media bayesiana ja calculada pelo backend (services/materialMetrics.ts). */
  avgRating: number | null | undefined;
  /** Contagem bruta de avaliacoes — unico gatilho de exibicao do bloco. */
  ratingCount: number | null | undefined;
}

const STAR_COUNT = 5;

// Intl com locale explicito em vez de `toFixed(1).replace('.', ',')` (achado
// de review PR #214, CodeRabbit): o replace assume que o separador decimal e
// sempre ponto, o que quebraria se a formatacao passasse a depender do locale
// do runtime. pt-BR fixo porque o produto e pt-BR.
const ratingFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatRating(value: number): string {
  return ratingFormatter.format(value);
}

function pluralizeReviews(count: number): string {
  return count === 1 ? '1 avaliação' : `${count} avaliações`;
}

// Spec 087 (T2.5) — estrelas do card/ficha.
//
// Tres travas que a direcao de design (plan.md §Estrelas) fixa e que nao podem
// se perder num refactor futuro:
//
// 1. Os glifos sao <span>, NUNCA <button>. O card inteiro e um alvo de clique
//    unico (MaterialCard usa `before:absolute before:inset-0` no <Link>), entao
//    qualquer elemento focavel aqui roubaria o clique e quebraria a navegacao
//    pra ficha. Avaliar dentro do card e mudanca de comportamento, fora do
//    escopo desta spec.
// 2. Meia-estrela por gradiente, nao arredondamento. 4,4 nao sao 4 estrelas
//    cheias: o preenchimento parcial e a informacao.
// 3. `ratingCount === 0` (ou ausente) some com o bloco inteiro, sem texto
//    substituto tipo "Sem avaliações" — material novo nao carrega o estigma de
//    uma ausencia anunciada (Requisito 15).
export function MaterialRating({ avgRating, ratingCount }: Readonly<MaterialRatingProps>) {
  const count = ratingCount ?? 0;
  if (count <= 0 || avgRating === null || avgRating === undefined) return null;

  const clamped = Math.min(Math.max(avgRating, 0), STAR_COUNT);

  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="flex items-center gap-0.5 text-[13px] leading-none">
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          // Fracao preenchida DESTA estrela: 1 quando o valor ja passou dela,
          // 0 quando nem chegou, e o resto decimal na estrela em que o valor
          // cai. Ex.: 4,4 → quatro cheias e a quinta com 40%.
          const fill = Math.min(Math.max(clamped - index, 0), 1);
          // Arredonda a PORCENTAGEM (nao a nota): `4.4 - 4` em ponto flutuante
          // da 0.40000000000000036, que vazaria como
          // `40.000000000000036%` pro CSS. Uma casa decimal e mais precisao do
          // que o olho distingue num glifo de 13px.
          const percent = `${Math.round(fill * 1000) / 10}%`;
          return (
            <span
              key={index}
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--artificio-brand) ${percent}, var(--line-strong) ${percent})`,
              }}
            >
              ★
            </span>
          );
        })}
      </span>
      <span
        aria-hidden="true"
        className="text-[13px] font-semibold tabular-nums text-[var(--fg)]"
        style={{ fontFamily: 'var(--artificio-font-display)' }}
      >
        {formatRating(clamped)}
      </span>
      <span aria-hidden="true" className="text-xs text-[var(--fg-muted)]">
        ({pluralizeReviews(count)})
      </span>
      <span className="sr-only">
        Avaliação {formatRating(clamped)} de {STAR_COUNT} em {pluralizeReviews(count)}
      </span>
    </div>
  );
}
