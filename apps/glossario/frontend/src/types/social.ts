/**
 * Normalizadores de payload social/estrutura do glossário.
 *
 * Regra pétrea do projeto: todo dado vindo de API/banco/JSON é `unknown` até
 * passar por normalizador tipado, antes de entrar em estado React, props ou
 * render. Proibido `.map`/`.filter`/`.length`/spread sobre payload externo sem
 * `Array.isArray` ou schema.
 *
 * Por que um módulo, e não uma guarda inline em cada `setState`: `Edition`
 * estava declarada em TRÊS arquivos com formatos divergentes (`ResultCard`,
 * `AddTermModal`, `AdminStructurePage`), cada um confiando no payload à sua
 * maneira. Sem tipo único não existe normalizador único, e a próxima tela a
 * consumir edições repetiria o mesmo descuido. Aqui o formato é definido uma
 * vez e a validação vem junto (achado de review, PR #260).
 *
 * A forma é deliberadamente tolerante: campo ausente vira valor neutro em vez
 * de descartar o registro inteiro. Uma resposta parcial deve degradar a UI, não
 * apagá-la — mas nunca ao ponto de deixar `undefined` chegar ao render.
 */

// ── Primitivos ──────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Aceita number vindo do Postgres como string (`id`, `system_id` via driver). */
export function asId(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function asText(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown): boolean {
  return v === true;
}

/** Ordem manual da árvore de estrutura; `0` é o neutro quando não vem número. */
function asPosition(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Aplica `normalize` a cada item de um payload que deveria ser array,
 * descartando o que não vira registro válido. Payload que não é array vira
 * lista vazia — nunca `undefined` chegando a um `.map` de render.
 */
function asList<T>(v: unknown, normalize: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    const normalized = normalize(item);
    if (normalized !== null) out.push(normalized);
  }
  return out;
}

// ── Edições ─────────────────────────────────────────────────────────────────

/**
 * União dos três formatos que conviviam no app. Os campos que só a tela de
 * administração usava (`slug`, `status`, `position`) ficam sempre presentes com
 * valor neutro: é mais barato que manter dois tipos quase iguais, e evita que
 * um consumidor leia `undefined` porque o endpoint devolveu a forma curta.
 */
export interface Edition {
  id: string;
  name: string;
  system_id: string;
  slug: string;
  status: string;
  position: number;
}

export function normalizeEdition(v: unknown): Edition | null {
  if (!isRecord(v)) return null;
  const id = asId(v.id);
  // Sem `id` a edição é inutilizável: vira `key` de lista e alvo de rota.
  if (!id) return null;
  return {
    id,
    name: asText(v.name),
    system_id: asId(v.system_id),
    slug: asText(v.slug),
    status: asText(v.status),
    position: asPosition(v.position),
  };
}

export function normalizeEditions(v: unknown): Edition[] {
  return asList(v, normalizeEdition);
}

// ── Sistemas ────────────────────────────────────────────────────────────────

export interface System {
  id: string;
  name: string;
  slug: string;
  status: string;
  position: number;
}

/**
 * `System` e `Scenario` são hoje o mesmo registro de árvore (id/nome/slug/
 * status/posição) vindos de endpoints diferentes. A normalização é uma só; os
 * dois tipos e as duas funções públicas continuam separados de propósito,
 * porque são conceitos distintos do domínio e podem divergir sem que o
 * consumidor precise saber que compartilhavam implementação.
 */
function normalizeNoDeArvore(v: unknown): System | null {
  if (!isRecord(v)) return null;
  const id = asId(v.id);
  if (!id) return null;
  return {
    id,
    name: asText(v.name),
    slug: asText(v.slug),
    status: asText(v.status),
    position: asPosition(v.position),
  };
}

export function normalizeSystem(v: unknown): System | null {
  return normalizeNoDeArvore(v);
}

export function normalizeSystems(v: unknown): System[] {
  return asList(v, normalizeSystem);
}

// ── Cenários ────────────────────────────────────────────────────────────────

export interface Scenario {
  id: string;
  name: string;
  slug: string;
  status: string;
  position: number;
}

export function normalizeScenario(v: unknown): Scenario | null {
  return normalizeNoDeArvore(v);
}

export function normalizeScenarios(v: unknown): Scenario[] {
  return asList(v, normalizeScenario);
}

// ── Categorias ──────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  slug: string;
  status: string;
  position: number;
}

export function normalizeCategory(v: unknown): Category | null {
  if (!isRecord(v)) return null;
  const id = asId(v.id);
  if (!id) return null;
  const parent = asId(v.parent_id);
  return {
    id,
    name: asText(v.name),
    type: asText(v.type),
    // `parent_id` distingue raiz de filha na árvore: ausência é `null`
    // explícito, não string vazia, para o filtro `!c.parent_id` continuar
    // significando "categoria raiz".
    parent_id: parent === '' ? null : parent,
    slug: asText(v.slug),
    status: asText(v.status),
    position: asPosition(v.position),
  };
}

export function normalizeCategories(v: unknown): Category[] {
  return asList(v, normalizeCategory);
}

// ── Comentários ─────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  body: string;
  author_name: string;
  /**
   * Ausente quando o payload não traz timestamp utilizável. Deliberadamente
   * opcional, e não `''`: string vazia atravessava o `asText` como se fosse
   * data, chegava a `new Date('')` no render e imprimia "Invalid Date" na
   * lista de comentários. Ausência o consumidor sabe tratar; data inválida ele
   * renderiza (achado de review, PR #261).
   */
  created_at?: string;
  deleted: boolean;
  user_id: string;
}

/**
 * Aceita apenas string que o `Date` consegue interpretar. Vale para todo
 * timestamp exibido: o custo de recusar é um traço na tela, o de aceitar é
 * "Invalid Date" onde o usuário espera uma data.
 */
export function asTimestamp(v: unknown): string | undefined {
  if (typeof v !== 'string' || v === '') return undefined;
  return Number.isNaN(new Date(v).getTime()) ? undefined : v;
}

/**
 * Data para exibição, com traço quando não há timestamp. Fica junto do
 * normalizador de propósito: a garantia de nunca imprimir "Invalid Date" tem
 * que valer para todos os consumidores, não depender de cada tela lembrar.
 */
export function formatarDataCurta(v: string | undefined): string {
  if (!v) return '—';
  const data = new Date(v);
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
}

export function normalizeComment(v: unknown): Comment | null {
  if (!isRecord(v)) return null;
  const id = asId(v.id);
  if (!id) return null;
  return {
    id,
    body: asText(v.body),
    author_name: asText(v.author_name),
    created_at: asTimestamp(v.created_at),
    // `deleted` só é verdadeiro se vier explicitamente `true`: qualquer outra
    // coisa (ausente, `null`, `0`) tem que renderizar o comentário normal, não
    // esconder conteúdo por causa de um campo malformado.
    deleted: asBool(v.deleted),
    user_id: asId(v.user_id),
  };
}

export function normalizeComments(v: unknown): Comment[] {
  return asList(v, normalizeComment);
}

// ── Voto ────────────────────────────────────────────────────────────────────

/**
 * `null` quando a resposta não traz um placar utilizável — o chamador deve
 * manter o valor anterior em vez de zerar a UI. O backend responde
 * `{ vote_score }` (`voteController.ts`), mas um `500` com corpo HTML ou um
 * proxy no meio do deploy devolvem qualquer coisa, e `setVoteScore(undefined)`
 * quebraria o render do placar.
 */
export function normalizeVoteScore(v: unknown): number | null {
  if (!isRecord(v)) return null;
  const score = v.vote_score;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}
