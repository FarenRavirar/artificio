import { useState, type FormEvent } from 'react';
import { useSession } from '@artificio/auth/client';
import toast from 'react-hot-toast';
import { useRatings, useSubmitRating } from '../hooks/useRating';

// D111 item 5 (spec 074) — avaliacao so disponivel apos download registrado
// pela mesma conta; guard mostra explicacao visivel, nunca so desabilita
// sem contexto (criterio de aceite 5).
export function RatingSection({ materialId }: Readonly<{ materialId: string }>) {
  const { user } = useSession();
  const { data: ratings } = useRatings(materialId);
  const submitMutation = useSubmitRating(materialId);
  const [score, setScore] = useState(5);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBlockedReason(null);
    try {
      await submitMutation.mutateAsync({ score });
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
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
          <select
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value} className="bg-[var(--surface)]">
                {value}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="min-h-[44px] rounded-md bg-artificio-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
    </div>
  );
}
