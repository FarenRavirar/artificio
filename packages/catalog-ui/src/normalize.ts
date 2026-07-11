/** Normalização única do pacote: strip de diacríticos + lowercase.
 * Unifica normalizeText (mesas, sem strip de acento) e normalize (site-admin, com strip)
 * numa só função — busca "edicao" deve achar "edição" nos dois consumidores. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}
