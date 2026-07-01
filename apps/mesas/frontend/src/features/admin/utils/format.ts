/** Data pt-BR (só dia); "-" para valor ausente/inválido. Compartilhado pelas telas do admin. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

/** Data + hora pt-BR; "Nunca" para valor ausente/inválido. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nunca' : date.toLocaleString('pt-BR');
}
