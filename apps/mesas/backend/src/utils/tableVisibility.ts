// Achado real (Sonar, Low, fase 7 da spec 089): um alias mantém uniforme o
// contrato aceito pelas projeções do banco e pelos fixtures serializados.
type DateValue = Date | string;

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

  const limite5Dias = new Date(table.created_at);
  limite5Dias.setDate(limite5Dias.getDate() + 5);

  const limiteEvento = table.starts_at ? new Date(table.starts_at) : limite5Dias;
  const validadeFinal = limiteEvento < limite5Dias ? limiteEvento : limite5Dias;

  return new Date() >= validadeFinal;
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
