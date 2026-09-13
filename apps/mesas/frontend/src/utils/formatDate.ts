/**
 * Datas formatadas com fuso FIXO (spec 102 T4.2).
 *
 * Sob SSR, `toLocaleDateString('pt-BR')` sem `timeZone` usa o fuso do processo
 * Node no servidor e o do sistema operacional no cliente. Para timestamp
 * próximo da virada do dia e visitante em fuso diferente do servidor, o HTML sai
 * com um dia e a hidratação calcula outro: o React descarta o trecho do servidor
 * e o crawler indexa uma data diferente da que o visitante enxerga. Achado do
 * Codex (P2) na PR #319.
 *
 * `America/Sao_Paulo` é o fuso do produto — o mesmo que o backend já aplica em
 * `parseDiscordAnnouncement.ts:1625` ao interpretar horário de anúncio. Um fuso
 * só nos dois lados é o que torna servidor e cliente concordarem por construção,
 * em vez de por coincidência de ambiente.
 */
export const TIMEZONE_PRODUTO = 'America/Sao_Paulo';

/**
 * Data por extenso ("13 de setembro de 2026"). Usada no encerramento da mesa,
 * que é renderizado no servidor.
 */
export function formatarDataLonga(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE_PRODUTO,
  });
}

/**
 * Data curta ("13/09/2026"). Usada no início da mesa, também renderizado no
 * servidor.
 */
export function formatarDataCurta(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { timeZone: TIMEZONE_PRODUTO });
}
