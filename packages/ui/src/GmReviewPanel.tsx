import { useState } from "react";
import { Panel, Badge, Button, Textarea } from "./primitives.js";

export const GM_REVIEW_TAG_LABELS: Record<string, string> = {
  pontual: "Pontual",
  bom_narrador: "Bom narrador",
  justo_com_regras: "Justo com as regras",
  cria_bom_ambiente: "Cria bom ambiente",
  flexivel_horarios: "Flexível com horários",
  responde_rapido: "Responde rápido",
  organizado: "Organizado",
  recomendaria: "Recomendaria a outros",
};

export interface GmReviewItem {
  id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

export interface GmReviewSummaryProps {
  /**
   * Aceita `unknown` de propósito: `avg_rating` é `NUMERIC` no Postgres e o
   * parser default do `pg` entrega **string** (`"4.50"`), não number. Tipar como
   * `number | null` não impedia isso em runtime — só escondia o problema até
   * `.toFixed()` estourar `TypeError: e.toFixed is not a function` e derrubar a
   * árvore React inteira (tela azul em mesas.artificiorpg.com, 2026-08-28).
   * A normalização mora aqui, no pacote compartilhado, para valer em todo app
   * consumidor em vez de depender de cada backend lembrar do cast.
   */
  readonly avgRating: unknown;
  readonly reviewsCount: unknown;
  readonly className?: string;
}

/**
 * Converte valor externo (string do `pg`, number, null) em number finito ou null.
 * Exportado porque o mesmo `avg_rating` chega cru em telas que não usam
 * `GmReviewSummary` (MestreHero, PainelMestrePage) e precisam do mesmo tratamento.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Resumo compacto de rating — usável em card do catálogo e sidebar (T3.7/T8.6). */
export function GmReviewSummary({ avgRating: rawAvgRating, reviewsCount: rawReviewsCount, className }: GmReviewSummaryProps) {
  const avgRating = toFiniteNumber(rawAvgRating);
  const reviewsCount = toFiniteNumber(rawReviewsCount) ?? 0;

  if (reviewsCount === 0 || avgRating === null) {
    return (
      <span className={`text-xs text-[var(--fg-muted)] ${className ?? ""}`.trim()}>
        Sem avaliações ainda
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold text-amber-300 ${className ?? ""}`.trim()}>
      ★ {avgRating.toFixed(1)}
      <span className="text-xs font-normal text-[var(--fg-muted)]">({reviewsCount})</span>
    </span>
  );
}

export interface GmReviewListProps {
  readonly reviews: GmReviewItem[];
}

/** Lista completa de reviews individuais (T8.5) — usada no perfil público do mestre. */
export function GmReviewList({ reviews }: GmReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-[var(--fg-muted)]">Ainda não há avaliações para este mestre.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl border border-[var(--line)] bg-[var(--fill-subtle)] p-4">
          <div className="flex items-center gap-3">
            {review.author_avatar ? (
              <img src={review.author_avatar} alt={review.author_name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[var(--fill)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--fg)]">{review.author_name}</p>
              <p className="text-xs text-amber-300">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
            </div>
          </div>

          {review.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <Badge key={tag} variant="neutral">{GM_REVIEW_TAG_LABELS[tag] ?? tag}</Badge>
              ))}
            </div>
          )}

          {review.comment && (
            <p className="mt-2 text-sm text-[var(--fg-muted)] whitespace-pre-wrap">{review.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export interface GmReviewFormProps {
  readonly onSubmit: (data: { rating: number; tags: string[]; comment: string }) => Promise<void>;
  readonly isSubmitting?: boolean;
}

/** Formulário de novo review — só usuário logado deve ver este componente (guard fica na página consumidora). */
export function GmReviewForm({ onSubmit, isSubmitting }: GmReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async () => {
    if (rating < 1) return;
    await onSubmit({ rating, tags, comment: comment.trim() });
    setRating(0);
    setTags([]);
    setComment("");
  };

  return (
    <Panel header="Avaliar este mestre" tone="default">
      <div className="flex gap-1 mb-3" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            aria-label={`${value} estrela${value > 1 ? "s" : ""}`}
            className="text-2xl"
          >
            <span className={rating >= value ? "text-amber-300" : "text-[var(--fg-muted)]"}>★</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(GM_REVIEW_TAG_LABELS).map(([tag, label]) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            onClick={() => toggleTag(tag)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              tags.includes(tag)
                ? "border-orange-500 bg-orange-500/20 text-orange-100"
                : "border-[var(--line)] bg-[var(--fill-subtle)] text-[var(--fg-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 2000))}
        placeholder="Comentário (opcional)"
        rows={3}
      />

      <div className="mt-3">
        <Button onClick={handleSubmit} disabled={rating < 1 || isSubmitting}>
          Enviar avaliação
        </Button>
      </div>
    </Panel>
  );
}
