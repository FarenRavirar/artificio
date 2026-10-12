import { PROFILE_CONTACT_CHANNELS, type ContactChannel } from './contactUrls.js';

/**
 * Canal de contato do perfil do mestre: os 7 de `CONTACT_CHANNELS`, fonte única
 * (spec 096 R12). A rota `contact-click` aceitava só 4 e devolvia 400, em
 * silêncio para o frontend, para `phone`, `facebook` e `instagram` (achado do
 * Codex na PR #338). O CHECK da migration_167 usa a mesma lista.
 */
export function isGmContactChannel(value: unknown): value is ContactChannel {
  return typeof value === 'string' && PROFILE_CONTACT_CHANNELS.has(value);
}

/**
 * Agrega as linhas de `gm_profile_contact_events` por canal. Linha do banco é
 * `unknown` até ser normalizada (regra do repo, achado do Codex na PR #338):
 * payload que não é array, canal fora da lista ou contagem não numérica fica
 * de fora em vez de derrubar o endpoint de insights com 500.
 */
export function summarizeProfileContacts(rows: unknown): { total: number; by_channel: Record<string, number> } {
  const byChannel: Record<string, number> = {};
  if (Array.isArray(rows)) {
    for (const row of rows as unknown[]) {
      if (typeof row !== 'object' || row === null) continue;
      const { channel, count } = row as Record<string, unknown>;
      const n = Number(count);
      if (!isGmContactChannel(channel) || !Number.isFinite(n) || n < 0) continue;
      byChannel[channel] = (byChannel[channel] ?? 0) + n;
    }
  }
  return {
    total: Object.values(byChannel).reduce((sum, n) => sum + n, 0),
    by_channel: byChannel,
  };
}
