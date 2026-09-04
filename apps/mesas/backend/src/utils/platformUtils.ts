import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../db/types.js';

// Achado Sonar (PR #145): slugify/normalizeWebsiteUrl/isUniqueViolation/
// getErrorMessage duplicados identicamente entre communicationPlatforms.ts
// e vttPlatforms.ts. Extraido para util compartilhado.

const COMBINING_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export const slugifyPlatformName = (value: string): string => (
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_REGEX, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
);

export const normalizePlatformWebsiteUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL da plataforma inválida.');
    }
    return url.toString();
  } catch {
    throw new Error('URL da plataforma inválida.');
  }
};

export const isPlatformUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  return (error as { code?: string }).code === '23505';
};

export const getPlatformErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Erro interno';
};

/**
 * Recusa a criação de plataforma cujo nome já é APELIDO de outra.
 *
 * Medido em beta (2026-09-04): o catálogo de comunicação tinha `Google Meet`
 * E `Meet`, embora `communication_platform_aliases` já trouxesse "Meet" →
 * `google-meet` desde a migration_159. A tabela de aliases existe para
 * reconhecer a grafia alternativa; sem consultá-la na criação, a duplicata
 * entra pela porta da frente e as duas passam a aparecer lado a lado na
 * seleção. Produção estava limpa — era sujeira de beta —, mas nada impedia
 * o mesmo em produção.
 *
 * Vive aqui, e não na rota, porque a regra é do conceito "plataforma" e vale
 * igual para o catálogo de VTT (mesmo par tabela + aliases).
 */
/**
 * Guardas de catálogo compartilhadas entre `vttPlatforms` e
 * `communicationPlatforms` (achado do Sonar na PR #307: os dois arquivos
 * ficaram ~96% duplicados depois que a mesma correção foi aplicada aos dois).
 *
 * O que muda entre os catálogos são só os NOMES de tabela e coluna; a regra é
 * idêntica. Parametrizar aqui é o que impede a próxima correção de consertar
 * um lado e esquecer o outro — foi exatamente o que aconteceu com a checagem
 * de alias, ausente nos dois até esta PR.
 *
 * `sql.ref`/`sql.val` em vez de interpolar texto: os identificadores e o id
 * vão como parâmetro, não concatenados na query.
 */
type CatalogoTabelas = {
  /** Ex.: `vtt_platform_aliases` */
  readonly aliases: string;
  /** Ex.: `vtt_platforms` */
  readonly plataformas: string;
  /** FK de alias → plataforma. Ex.: `vtt_platform_id` */
  readonly fk: string;
  /** Coluna `UUID[]` em `gm_profiles`. Ex.: `preferred_vtt_platforms` */
  readonly colunaPerfil: string;
};

export const CATALOGO_VTT: CatalogoTabelas = {
  aliases: 'vtt_platform_aliases',
  plataformas: 'vtt_platforms',
  fk: 'vtt_platform_id',
  colunaPerfil: 'preferred_vtt_platforms',
};

export const CATALOGO_COMUNICACAO: CatalogoTabelas = {
  aliases: 'communication_platform_aliases',
  plataformas: 'communication_platforms',
  fk: 'communication_platform_id',
  colunaPerfil: 'preferred_communication_platforms',
};

/**
 * Recusa criar plataforma cujo nome/slug/apelido já pertence a outra.
 *
 * Roda DENTRO da transação de escrita e com `FOR UPDATE`: solta, dois pedidos
 * concorrentes passavam os dois pela checagem e criavam plataformas rivais
 * para o mesmo apelido — o `UNIQUE (plataforma, alias_slug)` da migration_159
 * é por plataforma e não barra isso.
 *
 * Compara `alias_slug` canônico, nunca `ILIKE` sobre o texto: em `ILIKE`, `%` e
 * `_` são curingas, e o nome vem do corpo da requisição (medido em beta:
 * `alias ILIKE '%'` casa 2 linhas).
 */
export async function assertAliasLivre(
  trx: Transaction<Database>,
  catalogo: CatalogoTabelas,
  slugsPedidos: readonly string[],
): Promise<void> {
  const slugs = [...new Set(slugsPedidos)];

  // `sql` cru em vez do query builder tipado: os nomes de tabela/coluna são
  // dados do catálogo, e o builder exige literais do schema. Todo valor entra
  // por `sql.val`/parâmetro; só identificadores vêm de `sql.ref`, que o
  // Kysely escapa.
  const { rows } = await sql<{ platformName: string; aliasConflitante: string }>`
    SELECT p.name AS "platformName", a.alias AS "aliasConflitante"
    FROM ${sql.ref(catalogo.aliases)} a
    JOIN ${sql.ref(catalogo.plataformas)} p ON p.id = a.${sql.ref(catalogo.fk)}
    WHERE a.alias_slug = ANY(${sql.val(slugs)}::text[])
    LIMIT 1
    FOR UPDATE OF p
  `.execute(trx);

  const conflito = rows[0];
  if (conflito) {
    throw new AliasConflictError(
      aliasConflictMessage(conflito.aliasConflitante, conflito.platformName),
    );
  }
}

/**
 * Recusa apagar plataforma ainda escolhida em algum perfil de mestre.
 *
 * `gm_profiles.preferred_*_platforms` é `UUID[]` e não tem FK que barre o
 * `DELETE` — o guard só olhava `tables`. Sem esta checagem, apagar uma
 * plataforma escolhida apenas em perfis deixava o UUID órfão no array: sumia
 * da página pública e ficava impossível de desmarcar, porque o catálogo já não
 * a listava.
 */
export async function plataformaEstaEmAlgumPerfil(
  dbOrTrx: Kysely<Database> | Transaction<Database>,
  catalogo: CatalogoTabelas,
  platformId: string,
): Promise<boolean> {
  const { rows } = await sql<{ id: string }>`
    SELECT id FROM gm_profiles
    WHERE ${sql.ref(catalogo.colunaPerfil)} @> ARRAY[${sql.val(platformId)}]::uuid[]
    LIMIT 1
  `.execute(dbOrTrx);

  return rows.length > 0;
}

/**
 * Descarta ids que não existem no catálogo, preservando a ordem dos válidos.
 *
 * Par de `plataformaEstaEmAlgumPerfil`: aquele impede apagar plataforma em uso,
 * este impede gravar referência para plataforma que não existe. Sem os dois, a
 * corrida entre um `DELETE` e um `PUT` concorrente deixa o UUID órfão no array
 * — que some da página pública e não dá mais para desmarcar, porque o catálogo
 * já não lista a plataforma (achado de review, PR #307).
 *
 * Filtra em vez de rejeitar o pedido inteiro: id inexistente no meio de uma
 * seleção válida é lixo a descartar, não motivo para recusar a gravação do
 * perfil e fazer o mestre perder o resto do que escolheu. Medido em produção
 * (2026-09-04): 0 perfis com id órfão hoje — a checagem previne, não repara.
 */
export async function filtrarIdsDoCatalogo(
  dbOrTrx: Kysely<Database> | Transaction<Database>,
  catalogo: CatalogoTabelas,
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const { rows } = await sql<{ id: string }>`
    SELECT id::text AS id FROM ${sql.ref(catalogo.plataformas)}
    WHERE id = ANY(${sql.val([...ids])}::uuid[])
  `.execute(dbOrTrx);

  const existentes = new Set(rows.map((r) => r.id));
  return ids.filter((id) => existentes.has(id));
}

/**
 * Conflito de apelido detectado DENTRO da transação de criação.
 *
 * Existe porque a checagem precisa correr junto do insert para não perder a
 * corrida entre dois pedidos concorrentes (o `UNIQUE` da migration_159 é por
 * plataforma, então não barra o mesmo alias em plataformas diferentes) — e de
 * dentro da transação não dá para responder `res.status(409)`: só abortar. O
 * catch da rota reconhece este tipo e devolve 409 em vez de 500.
 */
export class AliasConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AliasConflictError';
  }
}

export const aliasConflictMessage = (
  name: string,
  ownerPlatformName: string,
): string =>
  `"${name}" já é reconhecido como apelido de "${ownerPlatformName}". ` +
  'Use essa plataforma em vez de criar uma nova.';

// Achado Sonar (PR #287): a validação dos requisitos implicados nasceu
// duplicada byte-a-byte nas duas rotas — 3 blocos no POST e 3 no PUT, ×2
// arquivos. Mesma origem do achado da PR #145 que criou este util: a regra é
// do conceito "plataforma", não de cada catálogo, então vive aqui (AGENTS.md,
// "compartilhado por padrão; exceção por app é o defeito").

/** Colunas de requisito implicado (migration_162, spec 096 Fase 5). */
export const IMPLIES_COLUMNS = [
  'implies_pc',
  'implies_microphone',
  'implies_camera',
] as const;

export type ImpliesColumn = typeof IMPLIES_COLUMNS[number];

type ImpliesPayload = Partial<Record<ImpliesColumn, unknown>>;

/**
 * Valida os flags presentes no corpo. Devolve a mensagem de erro do primeiro
 * inválido, ou `null` se todos os definidos forem boolean.
 *
 * Chamado ANTES de qualquer escrita: flag que não é boolean derruba o pedido
 * com 400, mesma regra do `aliases` (entrada malformada não pode ter efeito).
 */
export const validateImpliesInput = (payload: ImpliesPayload): string | null => {
  for (const column of IMPLIES_COLUMNS) {
    const value = payload[column];
    if (value !== undefined && typeof value !== 'boolean') {
      return `${column} deve ser boolean.`;
    }
  }
  return null;
};

/** Valores para o INSERT: ausente vira `false`, o mesmo default da coluna. */
export const impliesInsertValues = (
  payload: ImpliesPayload
): Record<ImpliesColumn, boolean> => ({
  implies_pc: payload.implies_pc === true,
  implies_microphone: payload.implies_microphone === true,
  implies_camera: payload.implies_camera === true,
});

/**
 * Acrescenta ao `updateData` só os flags definidos no corpo — preserva o PUT
 * parcial (ex.: `handleToggleActive`, que envia apenas `is_active`, não pode
 * zerar os requisitos como efeito colateral).
 *
 * Pressupõe `validateImpliesInput` já chamado; por isso não revalida o tipo.
 */
export const applyImpliesUpdate = (
  payload: ImpliesPayload,
  updateData: Record<string, unknown>
): void => {
  for (const column of IMPLIES_COLUMNS) {
    if (payload[column] !== undefined) {
      updateData[column] = payload[column];
    }
  }
};
