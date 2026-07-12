import { useState, type FormEvent } from 'react';
import { useSession } from '@artificio/auth/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../services/apiClient';

const commentSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  user_id: z.string(),
  body: z.string(),
  created_at: z.string(),
});
const commentsListSchema = z.array(commentSchema);

// T4.2/T4.3 (spec 074) — comentario exige conta accounts. (criterio de
// aceite 6); retirada so via denuncia (UI ja existe na ficha via denuncia,
// nao ha exclusao propria aqui).
export function CommentSection({ materialId }: { materialId: string }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const commentsQuery = useQuery({
    queryKey: ['downloads', 'comments', materialId],
    queryFn: async () => {
      const response = await apiGet(`/api/v1/comments/${materialId}`);
      if (!response.ok) throw new Error(`Falha ao buscar comentários: HTTP ${response.status}`);
      return commentsListSchema.parse(await response.json());
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiPost('/api/v1/comments', { material_id: materialId, body });
      if (!response.ok) throw new Error(`Falha ao comentar: HTTP ${response.status}`);
    },
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['downloads', 'comments', materialId] });
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      await submitMutation.mutateAsync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao comentar.');
    }
  };

  return (
    <div className="mt-10 border-t border-white/10 pt-6">
      <h2 className="text-lg font-semibold text-white">Comentários</h2>

      {user ? (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Escreva um comentário..."
            className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-white"
          />
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Comentar
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-white/60">Entre com sua conta para comentar.</p>
      )}

      <ul className="mt-6 space-y-3">
        {commentsQuery.data?.map((comment) => (
          <li key={comment.id} className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/80">
            {comment.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
