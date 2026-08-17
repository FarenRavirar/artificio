import { sql, type RawBuilder } from 'kysely';

// Achado real (Sonar, Low, fase 7 da spec 089): um alias mantém uniforme o
// contrato aceito pelas projeções do banco e pelos fixtures serializados.
type DateValue = Date | string;

/** Predicado SQL equivalente a `isImportedTableExpired`, para queries públicas. */
export function importedTableIsCurrentSql(tableAlias: string): RawBuilder<boolean> {
  const origin = sql.ref(`${tableAlias}.origin`);
  const startsAt = sql.ref(`${tableAlias}.starts_at`);
  const createdAt = sql.ref(`${tableAlias}.created_at`);

  return sql<boolean>`(
    ${origin} IS DISTINCT FROM 'imported'
    OR LEAST(
      COALESCE(${startsAt}, ${createdAt} + INTERVAL '5 days'),
      ${createdAt} + INTERVAL '5 days'
    ) > NOW()
  )`;
}

/**
 * Mesa importada expira 5 dias após criação, ou na data do evento
 * (`starts_at`), o que vencer primeiro. Usado tanto no detalhe público
 * (`routes/tables.ts`, `GET /:slug`) quanto no Open Graph (`routes/og.ts`)
 * — extraído pra evitar a regra divergir entre os dois pontos de leitura
 * (achado CodeRabbit, spec 059/060, 2026-07-08).
 */
export function isImportedTableExpired(table: {
  origin: string | null;
  created_at: DateValue;
  starts_at: DateValue | null;
}): boolean {
  if (table.origin !== 'imported') return false;
  return new Date() >= importedTableExpiryDate(table);
}

/**
 * Momento em que a divulgação importada deixa de ser pública: `starts_at` ou 5
 * dias após a criação, o que vencer primeiro.
 *
 * Extraída de `isImportedTableExpired` para a tela "Mesa Encerrada" (relato de
 * produção 2026-08-11) poder **exibir** essa data, e não só decidir com ela.
 * Importada não tem `archived_at` — ninguém a encerrou, ela venceu —, então
 * sem esta função a tela não teria data nenhuma para mostrar.
 *
 * As duas continuam com uma fonte só de propósito: a regra já divergiu entre
 * detalhe e Open Graph antes (achado CodeRabbit, spec 059/060), e é o motivo
 * deste arquivo existir.
 */
export function importedTableExpiryDate(table: {
  created_at: DateValue;
  starts_at: DateValue | null;
}): Date {
  const limite5Dias = new Date(table.created_at);
  limite5Dias.setDate(limite5Dias.getDate() + 5);

  const limiteEvento = table.starts_at ? new Date(table.starts_at) : limite5Dias;
  return limiteEvento < limite5Dias ? limiteEvento : limite5Dias;
}

/**
 * Regra única de visibilidade pública. Mantém catálogo, detalhe e interações
 * coerentes: rascunho, arquivada ou importada expirada não é pública
 * (spec 089, T6B.1 + achado das rotas de interação).
 */
export function isPublicTable(table: {
  status: string;
  archived_at: DateValue | null;
  origin: string | null;
  created_at: DateValue;
  starts_at: DateValue | null;
}): boolean {
  return table.status === 'active' && !table.archived_at && !isImportedTableExpired(table);
}

/** Forma mínima que as duas funções de comentário consultam. */
export interface TableLifecycleInput {
  status: string;
  archived_at: DateValue | null;
  origin: string | null;
  created_at: DateValue;
  starts_at: DateValue | null;
}

/**
 * Estados terminais explícitos. Listar em vez de negar `isPublicTable` é a
 * mesma escolha de `routes/tables.ts:617`, pelo motivo registrado lá: um valor
 * novo no enum não deve virar "encerrada" por omissão — ele cai no ramo de
 * rascunho, que é o fechado, e não no de leitura pública.
 */
const TERMINAL_STATUSES = new Set(['ended', 'cancelled']);

/**
 * Estados que nunca foram públicos. `full` **não** entra aqui: mesa lotada
 * segue pública e visível, só não aceita mais gente — decidido e documentado
 * em `routes/tables.ts:610-611`, que devolve `200` para ela.
 */
const NEVER_PUBLIC_STATUSES = new Set(['draft', 'pending_review']);

/**
 * T7.3 (spec 090, requisito 26a) — o ciclo de vida da mesa decide o que é
 * comentável.
 *
 * ## Por que não dá para reusar `isPublicTable` sozinha
 *
 * Ela colapsa seis estados em um booleano, e o comentário precisa de **três**
 * respostas, não duas. Mesa encerrada continua com a conversa legível — fechar
 * a leitura apagaria da vista discussão que aconteceu enquanto a mesa existia —
 * mas não aceita fala nova. Rascunho não tem nem uma coisa nem outra.
 * `isPublicTable` devolve `false` para os dois casos e não os distingue.
 *
 * ## Espelha a resposta HTTP que o módulo já dá
 *
 * Isto não é política nova: é a mesma tabela de `routes/tables.ts:605-631`,
 * onde `full` → `200`, terminal/arquivada/expirada → `410` e
 * rascunho/revisão → `404`. Divergir dali criaria mesa que abre para o
 * visitante e recusa o comentário dele, ou o contrário.
 */
export function canReadTableComments(table: TableLifecycleInput): boolean {
  return !NEVER_PUBLIC_STATUSES.has(table.status);
}

/**
 * Escrita nova, revalidada **a cada criação e a cada resposta** (requisito 26a,
 * OWASP Business Logic): o estado da mesa muda entre a hora em que a página
 * carregou e a hora em que o botão foi clicado, então decidir isto no
 * carregamento deixaria a janela aberta.
 *
 * Falha fechada por construção — só devolve `true` para o conjunto que
 * `isPublicTable` aprova, mais `full`, pelo motivo em `NEVER_PUBLIC_STATUSES`.
 */
export function canWriteTableComments(table: TableLifecycleInput): boolean {
  if (NEVER_PUBLIC_STATUSES.has(table.status)) return false;
  if (TERMINAL_STATUSES.has(table.status)) return false;
  if (table.archived_at) return false;
  if (isImportedTableExpired(table)) return false;
  return table.status === 'active' || table.status === 'full';
}
