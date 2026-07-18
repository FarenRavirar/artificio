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
  avgRating: number | null;
  reviewsCount: number;
  className?: string;
}

/** Resumo compacto de rating — usável em card do catálogo e sidebar (T3.7/T8.6). */
export function GmReviewSummary({ avgRating, reviewsCount, className }: GmReviewSummaryProps) {
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
  reviews: GmReviewItem[];
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
  onSubmit: (data: { rating: number; tags: string[]; comment: string }) => Promise<void>;
  isSubmitting?: boolean;
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
