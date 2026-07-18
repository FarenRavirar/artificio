import { useEffect, useState } from 'react';
import { GmReviewList, GmReviewForm, type GmReviewItem } from '@artificio/ui';
import { useAuth } from '../../contexts/useAuth';
import { authPost } from '../../services/apiClient';
import { startSsoLogin } from '../../utils/auth';
import toast from 'react-hot-toast';

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
  const res = await fetch(`/api/v1/gm/${slug}/reviews`, { signal });
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
      const res = await authPost(`/api/v1/gm/${slug}/reviews`, data);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Avaliação enviada. Obrigado!');
      setReviews(await fetchReviews(slug));
    } catch {
      toast.error('Não foi possível enviar a avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="container" style={{ marginTop: '3rem' }}>
      <h2 className="text-xl font-bold text-white mb-4">Avaliações</h2>

      {isAuthenticated ? (
        <div className="mb-6">
          <GmReviewForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startSsoLogin(`/mestre/${slug}`)}
          className="mb-6 text-sm text-[var(--color-artificio-orange)] hover:underline"
        >
          Entre para avaliar este mestre
        </button>
      )}

      {!loading && <GmReviewList reviews={reviews} />}
    </section>
  );
}
