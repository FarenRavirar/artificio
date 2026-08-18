import { useState, type FormEvent } from 'react';
import { useSession } from '@artificio/auth/client';
import { ContentEditor, MarkdownContent, contentOverflow } from '@artificio/content-editor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../services/apiClient';
import { ReportButton } from './ReportButton';

// Espelha o limite aceito pelo backend para o corpo do comentario.
const BODY_MAX_LENGTH = 2000;

const commentSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  user_id: z.string(),
  body: z.string().nullable(),
  removed_at: z.string().nullable(),
  removed_by_moderation: z.boolean(),
  created_at: z.string(),
});
const commentsListSchema = z.array(commentSchema);

// T4.2/T4.3 (spec 074) — comentario exige conta accounts. (criterio de
// aceite 6). D111 item 6 + decisão de 2026-07-29: a ferramenta única de
// denúncia recebe o comentário como alvo; retirada só ocorre quando a
// moderação acata o caso. Não há exclusão própria nem remoção automática.
export function CommentSection({ materialId }: Readonly<{ materialId: string }>) {
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
    <div className="mt-10 border-t border-[var(--line)] pt-6">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Comentários</h2>

      {user ? (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
          <ContentEditor
            value={body}
            onChange={setBody}
            label="Comentário"
            placeholder="Escreva um comentário..."
            minHeight={132}
            maxLength={BODY_MAX_LENGTH}
          />
          <button
            type="submit"
            // O editor avisa sobre o excesso mas não trunca mais, então quem
            // submete é que barra (achado P1 do Codex, PR #275).
            disabled={submitMutation.isPending || contentOverflow(body, BODY_MAX_LENGTH) > 0}
            className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Comentar
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">Entre com sua conta para comentar.</p>
      )}

      {commentsQuery.isLoading && <p className="mt-6 text-sm text-[var(--fg-muted)]">Carregando comentários...</p>}
      {commentsQuery.isError && <p className="mt-6 text-sm text-red-400">Falha ao carregar comentários.</p>}

      <ul className="mt-6 space-y-3">
        {commentsQuery.data?.map((comment) => (
          <li key={comment.id} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm text-[var(--fg-muted)]">
            {comment.removed_by_moderation ? (
              <p className="italic">Comentário removido pela moderação.</p>
            ) : (
              <>
                <MarkdownContent value={comment.body ?? ''} />
                <ReportButton target={{ commentId: comment.id }} />
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
