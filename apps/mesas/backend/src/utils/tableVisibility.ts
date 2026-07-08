/**
 * Mesa importada expira 5 dias após criação, ou na data do evento
 * (`starts_at`), o que vencer primeiro. Usado tanto no detalhe público
 * (`routes/tables.ts`, `GET /:slug`) quanto no Open Graph (`routes/og.ts`)
 * — extraído pra evitar a regra divergir entre os dois pontos de leitura
 * (achado CodeRabbit, spec 059/060, 2026-07-08).
 */
export function isImportedTableExpired(table: {
  origin: string | null;
  created_at: Date | string;
  starts_at: Date | string | null;
}): boolean {
  if (table.origin !== 'imported') return false;

  const limite5Dias = new Date(table.created_at);
  limite5Dias.setDate(limite5Dias.getDate() + 5);

  const limiteEvento = table.starts_at ? new Date(table.starts_at) : limite5Dias;
  const validadeFinal = limiteEvento < limite5Dias ? limiteEvento : limite5Dias;

  return new Date() >= validadeFinal;
}
