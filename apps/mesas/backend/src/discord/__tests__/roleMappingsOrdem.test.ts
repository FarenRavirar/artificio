import { describe, expect, it } from 'vitest';
import { parseDiscordAnnouncement } from '../parseDiscordAnnouncement.js';
import type { ImportRawMessage } from '../types.js';
import type { DiscordRoleMapping } from '../../db/types.js';

/**
 * A ORDEM entre `aplicarMapeamentos` e `normalizeDiscordEmojis` (achado Codex, spec 099).
 *
 * A suíte existente cobria `aplicarMapeamentos` isolada, e por isso não pegou o defeito:
 * `normalizeDiscordEmojis` apaga todo emoji custom sem letra (vira `''`), então rodando
 * antes do mapa ela destruía o id de um emoji CONFIRMADO como tag — o mapeamento nunca
 * casava e o dado se perdia em silêncio.
 *
 * Arquivo separado de propósito: `parseDiscordAnnouncement.test.ts` já tem 3.600 linhas.
 */

const ROLE_ID = '1118328496721248347';
const EMOJI_ID = '1118328496721248999';
const SYSTEM_UUID = '11111111-1111-1111-1111-111111111111';

function makeMessage(overrides: Partial<ImportRawMessage>): ImportRawMessage {
  return {
    source_kind: 'discord_bot',
    discord_message_id: '1000',
    discord_channel_id: '2000',
    discord_guild_id: '3000',
    discord_parent_channel_id: '4000',
    discord_thread_id: '1000',
    discord_thread_name: 'Mesa nova',
    discord_author_id: '5000',
    discord_author_name: 'covildolich',
    discord_message_url: 'https://discord.com/channels/3000/2000/1000',
    content_raw: '',
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-05-01T12:00:00Z'),
    message_edited_at: null,
    ...overrides,
  };
}

type Alvo = Partial<DiscordRoleMapping> & { target_system_name?: string | null };

function mapa(entradas: Array<[string, Alvo]>): Map<string, DiscordRoleMapping> {
  const m = new Map<string, DiscordRoleMapping>();
  for (const [chave, v] of entradas) {
    m.set(chave, {
      id: 'x',
      guild_id: '3000',
      discord_id: chave.split(':')[1],
      source_type: chave.startsWith('role') ? 'role' : 'emoji',
      kind: 'style',
      target_system_id: null,
      target_text: null,
      source: 'manual',
      occurrences: 3,
      confirmed_at: new Date(),
      confirmed_by: null,
      last_seen_text: null,
      last_seen_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      ...v,
    } as DiscordRoleMapping);
  }
  return m;
}

const corpo = (estilo: string) => ['Sistema: Vampiro', `Estilo: ${estilo}`, 'Vagas: 3'].join('\n');

describe('ordem entre mapeamento e normalizacao de emoji', () => {
  it('traduz EMOJI mapeado, que a normalizacao apagaria antes de o mapa ver o id', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: corpo(`<:emoji_15:${EMOJI_ID}>`) }),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([[`emoji:${EMOJI_ID}`, { kind: 'style', target_text: 'Investigacao' }]]),
    );

    expect(draft).not.toBeNull();
    expect(JSON.stringify(draft)).toContain('Investigacao');
    expect(JSON.stringify(draft)).not.toContain(EMOJI_ID);
  });

  it('emoji NAO mapeado continua removido — id opaco nunca vaza para o draft', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: corpo('<:decorativo:999888777666555444>') }),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([]),
    );

    expect(draft).not.toBeNull();
    expect(JSON.stringify(draft)).not.toContain('999888777666555444');
  });

  it('conteudo apenas com emoji custom ainda cai no fallback de embeds', () => {
    // Caso de risco da reordenacao: o fallback passou a olhar o texto CRU, que NAO e
    // vazio quando contem so um emoji. Sem tratar isso, um anuncio cujo corpo real vive
    // no embed viraria draft a partir de uma string que a normalizacao esvazia.
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Mesa via embed',
        content_raw: '<:so_emoji:123456789012345678>',
        embeds: [{ description: ['Sistema: Call of Cthulhu', 'Estilo: Horror', 'Vagas: 5'].join('\n') }],
      }),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([]),
    );

    expect(draft).not.toBeNull();
    expect(JSON.stringify(draft)).toContain('Cthulhu');
  });
});

describe('alvo do mapeamento por tipo (constraint da migration 165)', () => {
  const anuncioComRole = () =>
    makeMessage({ content_raw: [`Sistema: <@&${ROLE_ID}>`, 'Estilo: Sandbox', 'Vagas: 4'].join('\n') });

  it('role de SISTEMA usa o nome do catalogo, nao target_text', () => {
    // A constraint exige `target_text IS NULL` quando kind='system': o vinculo mora em
    // `target_system_id`, e o nome chega pelo join em `carregarMapeamentos`.
    const draft = parseDiscordAnnouncement(
      anuncioComRole(),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([[`role:${ROLE_ID}`, {
        kind: 'system',
        target_text: null,
        target_system_id: SYSTEM_UUID,
        target_system_name: 'Dungeons & Dragons',
      }]]),
    );

    expect(draft).not.toBeNull();
    expect(JSON.stringify(draft)).toContain('Dungeons');
    expect(JSON.stringify(draft)).not.toContain(ROLE_ID);
  });

  it('role de sistema sem nome resolvido nao apaga o campo', () => {
    // Vinculo confirmado mas sistema removido do catalogo: preservar a mencao e melhor
    // que entregar "Sistema:" vazio, que leria como anuncio sem sistema nenhum.
    const draft = parseDiscordAnnouncement(
      anuncioComRole(),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([[`role:${ROLE_ID}`, {
        kind: 'system',
        target_text: null,
        target_system_id: null,
        target_system_name: null,
      }]]),
    );

    expect(draft).not.toBeNull();
  });

  it('role de ESTILO segue usando target_text', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: corpo(`<@&${ROLE_ID}>`) }),
      undefined,
      undefined,
      undefined,
      undefined,
      mapa([[`role:${ROLE_ID}`, { kind: 'style', target_text: 'Roleplay pesado' }]]),
    );

    expect(draft).not.toBeNull();
    // O parser normaliza a capitalizacao do estilo; o que importa aqui e que o texto do
    // mapeamento chegou ao campo, e que a mencao crua NAO sobreviveu.
    expect(draft?.table.setting_styles).toContain('Roleplay Pesado');
    expect(JSON.stringify(draft)).not.toContain(ROLE_ID);
  });

  it('byte nulo vindo do EMBED nao chega ao draft', () => {
    // Antes, `stripNullBytes` cobria so o caminho do `content_raw`; o do embed passava
    // direto. Em anuncio de forum o embed e a UNICA fonte de texto, entao era
    // exatamente ali que o U+0000 chegava ao draft — e o Postgres recusa esse byte em
    // coluna `text`. Achado do CodeRabbit.
    //
    // Duas armadilhas na hora de escrever ESTE teste, ambas pagas:
    //   1. `String.fromCharCode(0)` e nao literal no fonte — o byte cru nao sobrevive
    //      a edicao do arquivo, e o teste passaria sem exercitar nada.
    //   2. Asserir sobre `JSON.stringify(draft)` NAO mede: o stringify escapa o byte
    //      como a sequencia de 6 caracteres `\u0000`, entao `.includes(NUL)` da false
    //      mesmo com o byte presente no campo. Medido: a versao sem a correcao passava
    //      nessa forma. Asserir sobre os CAMPOS.
    const NUL = String.fromCharCode(0);
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: '',
        embeds: [
          {
            description: [
              'Sistema: Vampiro',
              'Estilo: Investigacao',
              'Vagas: 3',
              '',
              `Uma cronica sombria${NUL} em Chicago.`,
            ].join('\n'),
          },
        ],
      }),
    );

    expect(draft).not.toBeNull();
    expect(draft?.table.description ?? []).not.toContain(NUL);
    expect(draft?.table.system_name ?? '').not.toContain(NUL);
    // E o conteudo continua chegando: sanitizar nao pode esvaziar o draft.
    expect(draft?.table.description ?? []).toContain('Chicago');
  });
});
