import { describe, expect, it } from 'vitest';
import { parseDiscordAnnouncement } from '../parseDiscordAnnouncement.js';
import type { ImportRawMessage } from '../types.js';

/**
 * "Mestre responsavel" recebendo o RODAPE do anuncio (incidente de producao).
 *
 * Mesa `alem-de-celestia-mtk69wt3`, vista em producao em 2026-09-02: o campo publico
 * exibia "Caso tenha interesse em participar, peco que preencha este formulario com
 * atencao: https://forms.gle/... A sessao 0 ... sera neste Sabado as 18h." no lugar do
 * nome do mestre.
 *
 * Cadeia do defeito: o valor real de `Mestre:` era so a mencao `<@id>`;
 * `stripSeparatorLines` removia os `▬▬▬` que separavam o campo do rodape;
 * `collectLabelContinuation` agregava o rodape como continuacao; e a guarda
 * `if (!withoutMention) return null` — que existe exatamente para "mestre e so mencao" —
 * nunca disparava, porque o texto agregado nao estava vazio.
 */

function makeMessage(contentRaw: string): ImportRawMessage {
  return {
    source_kind: 'discord_bot',
    discord_message_id: '1000',
    discord_channel_id: '2000',
    discord_guild_id: '3000',
    discord_parent_channel_id: '4000',
    discord_thread_id: '1000',
    discord_thread_name: 'Alem de Celestia',
    discord_author_id: '5000',
    discord_author_name: 'anunciante',
    discord_message_url: 'https://discord.com/channels/3000/2000/1000',
    content_raw: contentRaw,
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-09-01T12:00:00Z'),
    message_edited_at: null,
  };
}

/** Trecho REAL da mensagem que gerou a mesa, medido no banco de producao. */
const ANUNCIO_REAL = [
  '» Título: Além de Celestia',
  '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  '» Sistema: D&D 5.5 (2024).',
  '» Vagas disponíveis: 2.',
  '',
  'Mestre: <@1523737563557400608>',
  '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  'Caso tenha interesse em participar, peço que preencha este formulário com atenção: https://forms.gle/rKfERrcrnWHtAdRV6',
  'A sessão 0 para eu explicar mais sobre a mesa será neste Sábado às 18h.',
].join('\n');

describe('nome do mestre nao absorve o rodape do anuncio', () => {
  it('mestre que e so mencao devolve null, nao o convite de inscricao', () => {
    const draft = parseDiscordAnnouncement(makeMessage(ANUNCIO_REAL));

    expect(draft).not.toBeNull();
    // `host_discord_id` ja carrega a identidade; o nome textual fica ausente, que e o
    // correto — parágrafo no lugar do nome e pior que nome ausente.
    expect(draft?.table.raw_gm_name).toBeNull();
    expect(draft?.table.host_discord_id).toBe('1523737563557400608');
  });

  it('nao vaza a URL do formulario para o campo de nome', () => {
    const draft = parseDiscordAnnouncement(makeMessage(ANUNCIO_REAL));
    expect(draft?.table.raw_gm_name ?? '').not.toContain('forms.gle');
    expect(draft?.table.raw_gm_name ?? '').not.toContain('interesse em participar');
  });

  it('nome REAL seguido do rodape mantem so o nome', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage(
        [
          '» Sistema: D&D 5.5',
          'Mestre: Mariana',
          'Caso tenha interesse em participar, preencha: https://forms.gle/abc',
        ].join('\n'),
      ),
    );

    expect(draft?.table.raw_gm_name).toBe('Mariana');
  });

  it('texto livre legitimo continua preservado (nao e rodape)', () => {
    // Caso ja coberto pela suite existente: o anunciante explica que nao e o mestre.
    // O corte NAO pode engolir isto.
    const draft = parseDiscordAnnouncement(
      makeMessage(
        ['» Sistema: D&D 5.5', 'Narrador: um conhecido meu, apenas estou postando por ele'].join('\n'),
      ),
    );

    expect(draft?.table.raw_gm_name).toBe('um conhecido meu, apenas estou postando por ele');
  });
});
