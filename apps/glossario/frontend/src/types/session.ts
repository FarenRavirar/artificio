import type { User } from '../context/auth-context';

/**
 * Normalizador da sessão local do glossário (`GET /auth/me`).
 *
 * Não reusa `normalizeUser` de `packages/auth/src/client.ts` porque são sessões
 * diferentes e os tipos não coincidem: o pacote descreve a sessão SSO central
 * (`name`, `avatar`, `roleVersion`, papéis `user|moderator|admin`), enquanto o
 * glossário mantém sessão própria resolvida por account-linking no backend
 * (`full_name`, `username`, `is_global_moderator`, papéis `admin|member`).
 * Passar um pelo outro devolveria `null` para toda sessão válida.
 *
 * Por que isto importa mais que os outros normalizadores deste app: `role` e
 * `is_global_moderator` são decisão de PERMISSÃO, não de render. Hoje o payload
 * ia direto para o estado, e quem lê depois decide acesso com base nele —
 * `App.tsx:250` protege a área administrativa com `user.role !== 'admin'`, e
 * `ResultCard.tsx` libera exclusão de comentário alheio por `role` /
 * `is_global_moderator` (achado de review, PR #260).
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Papel desconhecido, ausente ou malformado vira `member` — o MENOR privilégio.
 * A direção do fallback é a decisão de segurança desta função: um payload
 * corrompido tem que fechar portas, nunca abrir. Só a string exata `'admin'`
 * concede acesso administrativo.
 */
function asRole(v: unknown): User['role'] {
  return v === 'admin' ? 'admin' : 'member';
}

/**
 * Membro na listagem administrativa (`GET /users/admin`). Tipo próprio, e não
 * `User`: aqui não há sessão nem papel — é o cadastro de outra pessoa, com o
 * estado de banimento que o admin manipula.
 */
export interface Member {
  id: string;
  full_name: string;
  username: string;
  email: string;
  banned: boolean;
  created_at: string;
}

export function normalizeMember(v: unknown): Member | null {
  if (!isRecord(v)) return null;
  const id = typeof v.id === 'string' ? v.id : typeof v.id === 'number' ? String(v.id) : '';
  if (!id) return null;
  return {
    id,
    full_name: asText(v.full_name),
    username: asText(v.username),
    email: asText(v.email),
    // Só `true` marca banido. A direção do fallback é deliberada e oposta à do
    // `role`: aqui o valor "seguro" é NÃO marcar alguém como banido por causa de
    // um campo malformado — acusar indevidamente é pior que mostrar como ativo,
    // e o backend continua sendo quem aplica o bloqueio de fato.
    banned: v.banned === true,
    created_at: asText(v.created_at),
  };
}

export function normalizeMembers(v: unknown): Member[] {
  if (!Array.isArray(v)) return [];
  const out: Member[] = [];
  for (const item of v) {
    const membro = normalizeMember(item);
    if (membro) out.push(membro);
  }
  return out;
}

/**
 * Aplica sobre a sessão vigente apenas os campos de PERFIL que a resposta
 * trouxer, preservando o que só a sessão sabe (`role`, `is_global_moderator`).
 *
 * Existe porque `PATCH /users/profile` responde com o perfil, não com a sessão:
 * gravar a resposta inteira em `setUser` rebaixaria um admin a `member` no
 * instante em que ele salvasse o próprio nome, e uma resposta vazia o
 * deslogaria. Permissão nunca vem de rota de perfil.
 */
export function mergeProfileIntoSession(atual: User | null, resposta: unknown): User | null {
  if (!atual) return null;
  if (!isRecord(resposta)) return atual;

  const fullName = typeof resposta.full_name === 'string' ? resposta.full_name : atual.full_name;
  const username = typeof resposta.username === 'string' && resposta.username !== ''
    ? resposta.username
    : atual.username;
  const email = typeof resposta.email === 'string' ? resposta.email : atual.email;

  return { ...atual, full_name: fullName, username, email };
}

/**
 * Devolve `null` quando a resposta não descreve uma sessão utilizável — o
 * chamador trata como "não logado", que é o estado seguro. `id` é obrigatório
 * porque é ele que compara autoria (`user.id === comment.user_id`): sem id, a
 * comparação daria falso para tudo, ou pior, casaria com um `user_id` vazio.
 */
export function normalizeSessionUser(v: unknown): User | null {
  if (!isRecord(v)) return null;

  const id = typeof v.id === 'string' ? v.id : typeof v.id === 'number' ? String(v.id) : '';
  if (!id) return null;

  const username = typeof v.username === 'string' && v.username !== '' ? v.username : undefined;

  return {
    id,
    full_name: asText(v.full_name),
    username,
    email: asText(v.email),
    role: asRole(v.role),
    // Só `true` literal concede moderação global. `'true'`, `1` e qualquer
    // outro valor "quase verdadeiro" são payload suspeito, não permissão.
    is_global_moderator: v.is_global_moderator === true,
  };
}
