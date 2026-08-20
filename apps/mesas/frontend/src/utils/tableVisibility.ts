// R2 (spec 093): espelho da regra de expiração de mesa importada.
//
// ESPELHO de apps/mesas/backend/src/utils/tableVisibility.ts — a regra é
// idêntica e deve permanecer sincronizada. Backend e frontend são raízes de
// build separadas (não há pacote compartilhado de domínio mesas; migração para
// `@artificio/*` é decisão do mantenedor, ver spec 086). Não alterar uma sem
// sincronizar a outra (AGENTS.md §Compartilhado por padrão).
//
// Motivo de existir no frontend: o botão "Copiar anúncio" do draft (R1) só deve
// renderizar quando a mesa está publicada E ainda visível (D1/R2).
// `isTableAnnounceable` (features/table/share/whatsappAnnouncement.ts) cobre
// `status === 'active' && !archived_at`, mas não a expiração de importado — que
// vive só no backend (a rota pública `GET /tables/:slug` aplica
// `!isImportedTableExpired`). Sem este espelho, o preview prometeria um anúncio
// cujo link a rota pública responde 410.

/**
 * Momento em que a divulgação importada deixa de ser pública: `starts_at` ou 5
 * dias após a criação, o que vencer primeiro. Espelho do backend
 * `importedTableExpiryDate`.
 */
export function importedTableExpiryDate(table: {
  created_at: string;
  starts_at: string | null;
}): Date {
  const limite5Dias = new Date(table.created_at);
  limite5Dias.setDate(limite5Dias.getDate() + 5);

  const limiteEvento = table.starts_at ? new Date(table.starts_at) : limite5Dias;
  return limiteEvento < limite5Dias ? limiteEvento : limite5Dias;
}

/**
 * Mesa importada expira 5 dias após criação, ou na data do evento
 * (`starts_at`), o que vencer primeiro. Espelho do backend
 * `isImportedTableExpired`.
 */
export function isImportedTableExpired(table: {
  origin?: string | null;
  created_at: string;
  starts_at: string | null;
}): boolean {
  if (table.origin !== 'imported') return false;
  const expiry = importedTableExpiryDate(table);
  // Achado de review (PR #279): data inválida produz `Invalid Date`, e QUALQUER
  // comparação com ela devolve `false` (medido: `new Date() >= new Date('lixo')`
  // → false). Sem este guard a função respondia "não expirado" para
  // `created_at` corrompido — falha ABERTA, o oposto do que ela existe para
  // fazer: o botão apareceria e o link responderia 410. Data que não dá para
  // calcular é tratada como expirada.
  if (Number.isNaN(expiry.getTime())) return true;
  return new Date() >= expiry;
}
