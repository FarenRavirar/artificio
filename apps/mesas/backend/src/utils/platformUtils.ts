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
