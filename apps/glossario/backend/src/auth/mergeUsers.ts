export interface TxClient {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

/**
 * Funde o usuário auto-provisionado (`fromId`) no usuário legado (`toId`),
 * repontando todas as FKs antes de apagar `fromId`. DEVE rodar dentro de uma
 * transação (BEGIN/COMMIT do chamador).
 *
 * Votos: `term_votes` tem UNIQUE(term_id, user_id); em colisão mantém o mais
 * recente (spec 015) — apaga o voto mais antigo dos dois antes do repoint.
 *
 * `audit_log` é propositalmente ignorado: append-only com trigger de
 * imutabilidade. `fromId` é membro recém-provisionado (sem trilha admin); o FK
 * `actor_id ON DELETE SET NULL` cobre o caso degenerado ao apagar a row.
 */
export async function mergeUsers(client: TxClient, fromId: string, toId: string): Promise<void> {
  // 1) resolve duplicata de voto: apaga o voto de `from` quando `to` já votou o
  //    mesmo termo e é mais recente/igual...
  await client.query(
    `DELETE FROM public.term_votes a
       USING public.term_votes b
      WHERE a.term_id = b.term_id
        AND a.user_id = $1 AND b.user_id = $2
        AND a.created_at <= b.created_at`,
    [fromId, toId]
  );
  // ...e apaga o voto de `to` quando o de `from` é mais recente (mantém o de from p/ repoint).
  await client.query(
    `DELETE FROM public.term_votes b
       USING public.term_votes a
      WHERE a.term_id = b.term_id
        AND a.user_id = $1 AND b.user_id = $2
        AND a.created_at > b.created_at`,
    [fromId, toId]
  );

  // 2) repoint das FKs (antes do DELETE para não cascatear term_votes/comments/notifications)
  await client.query('UPDATE public.term_votes SET user_id = $2 WHERE user_id = $1', [fromId, toId]);
  await client.query('UPDATE public.term_comments SET user_id = $2 WHERE user_id = $1', [fromId, toId]);
  await client.query('UPDATE public.user_notifications SET user_id = $2 WHERE user_id = $1', [fromId, toId]);
  await client.query('UPDATE public.user_notifications SET actor_id = $2 WHERE actor_id = $1', [fromId, toId]);
  await client.query('UPDATE public.terms SET added_by = $2 WHERE added_by = $1', [fromId, toId]);
  await client.query('UPDATE public.terms SET reviewed_by = $2 WHERE reviewed_by = $1', [fromId, toId]);
  await client.query('UPDATE public.term_history SET changed_by = $2 WHERE changed_by = $1', [fromId, toId]);
  await client.query('UPDATE public.systems SET created_by = $2 WHERE created_by = $1', [fromId, toId]);
  await client.query('UPDATE public.scenarios SET created_by = $2 WHERE created_by = $1', [fromId, toId]);
  await client.query('UPDATE public.update_log SET created_by = $2 WHERE created_by = $1', [fromId, toId]);

  // 3) remove o usuário auto-provisionado (libera email/sso_user_id para o legado)
  await client.query('DELETE FROM public.users WHERE id = $1', [fromId]);
}
