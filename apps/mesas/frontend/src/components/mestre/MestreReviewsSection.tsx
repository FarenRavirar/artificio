import { useEffect, useState } from 'react';
import { GM_REVIEW_TAG_LABELS, type GmReviewItem } from '@artificio/ui';
import { MarkdownContent } from '@artificio/content-editor';
import { useAuth } from '../../contexts/useAuth';
import { authPost } from '../../services/apiClient';
import { startSsoLogin } from '../../utils/auth';
import toast from 'react-hot-toast';
import { MarkdownEditor } from '../MarkdownEditor';
// Direto do pacote: reexportar pelo adaptador quebraria o fast-refresh dele
// (react-refresh/only-export-components), que só pode exportar componentes.
import { contentOverflow } from '@artificio/content-editor';

// Espelha o limite aceito pelo backend para o comentario da avaliacao.
const REVIEW_COMMENT_MAX_LENGTH = 2_000;

interface MestreReviewsSectionProps {
  readonly slug: string;
}

// Achado Codex: resposta de /reviews é unknown até validada — normaliza cada
// item, descarta entradas com rating fora de 1-5 ou estrutura inesperada.
function normalizeReviews(data: unknown): GmReviewItem[] {
  if (!data || typeof data !== 'object' || !('data' in data)) return [];
  const rawList = (data as { data: unknown }).data;
  if (!Array.isArray(rawList)) return [];

  return rawList.filter((item): item is GmReviewItem => {
    if (!item || typeof item !== 'object') return false;
    const r = item as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      typeof r.rating === 'number' &&
      r.rating >= 1 &&
      r.rating <= 5 &&
      Array.isArray(r.tags) &&
      (r.comment === null || typeof r.comment === 'string') &&
      typeof r.created_at === 'string' &&
      typeof r.author_name === 'string' &&
      (r.author_avatar === null || typeof r.author_avatar === 'string')
    );
  });
}

async function fetchReviews(slug: string, signal?: AbortSignal): Promise<GmReviewItem[]> {
  const res = await fetch(`/api/v1/gm/perfis/${slug}/reviews`, { signal });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return normalizeReviews(data);
}

/** T8.5 (spec 081): reviews moram no perfil do mestre, não na página de mesa. */
export function MestreReviewsSection({ slug }: MestreReviewsSectionProps) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<GmReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchReviews(slug, controller.signal)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  const handleSubmit = async (data: { rating: number; tags: string[]; comment: string }) => {
    setIsSubmitting(true);
    try {
      const res = await authPost(`/api/v1/gm/perfis/${slug}/reviews`, data);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Avaliação enviada. Obrigado!');
      setReviews(await fetchReviews(slug));
      setRating(0);
      setTags([]);
      setComment('');
    } catch {
      toast.error('Não foi possível enviar a avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Sem `marginTop` próprio: o vão entre seções é do container
    // (`.mestre-section-flow`, C3). A margem local sobrevivera à remoção das
    // outras três e somava 48px ao `gap`, dando 96px só antes de Avaliações
    // (achado de review, PR #302).
    <section className="container">
      <h2 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)] mb-4">Avaliações</h2>

      {isAuthenticated ? (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--fill-subtle)] p-4">
          <h3 className="mb-3 font-[var(--weight-strong)] text-[var(--fg)]">Avaliar este mestre</h3>
          <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Nota">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} aria-label={`${value} estrela${value > 1 ? 's' : ''}`} className="text-[length:var(--text-title)] leading-[var(--leading-title)]">
                <span className={rating >= value ? 'text-[var(--state-warning-fg)]' : 'text-[var(--fg-muted)]'}>★</span>
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(GM_REVIEW_TAG_LABELS).map(([tag, label]) => (
              <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[length:var(--text-label)] leading-[var(--leading-label)] ${tags.includes(tag) ? 'border-[var(--state-brand-line)] bg-[var(--state-brand-bg)] text-[var(--state-brand-fg)]' : 'border-[var(--line)] text-[var(--fg-muted)]'}`}>
                {label}
              </button>
            ))}
          </div>
          <MarkdownEditor label="Comentário (opcional)" value={comment} onChange={setComment} maxLength={REVIEW_COMMENT_MAX_LENGTH} height={128} />
          <button type="button" onClick={() => void handleSubmit({ rating, tags, comment: comment.trim() })} disabled={rating < 1 || isSubmitting || contentOverflow(comment.trim(), REVIEW_COMMENT_MAX_LENGTH) > 0} className="mt-3 rounded-[var(--radius-md)] bg-artificio-orange px-4 py-2 font-[var(--weight-strong)] text-[var(--on-solid-fg)] disabled:opacity-50">
            Enviar avaliação
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startSsoLogin(`/mestre/${slug}`)}
          className="mb-6 text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--color-artificio-orange)] hover:underline"
        >
          Entre para avaliar este mestre
        </button>
      )}

      {!loading && reviews.length === 0 && <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-muted)]">Ainda não há avaliações para este mestre.</p>}
      {!loading && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--fill-subtle)] p-4">
              <div className="flex items-center gap-3">
                {review.author_avatar ? <img src={review.author_avatar} alt={review.author_name} className="h-8 w-8 rounded-[var(--radius-pill)] object-cover" /> : <div className="h-8 w-8 rounded-[var(--radius-pill)] bg-[var(--fill)]" />}
                <div><p className="text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-strong)] text-[var(--fg)]">{review.author_name}</p><p className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--state-warning-fg)]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p></div>
              </div>
              {review.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{review.tags.map((tag) => <span key={tag} className="rounded-[var(--radius-pill)] border border-[var(--line)] px-2 py-1 text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-muted)]">{GM_REVIEW_TAG_LABELS[tag] ?? tag}</span>)}</div>}
              {review.comment && <MarkdownContent value={review.comment} className="mt-2 text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-muted)]" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
