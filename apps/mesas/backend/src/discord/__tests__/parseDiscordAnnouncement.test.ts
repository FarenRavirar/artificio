import { parseDiscordAnnouncement } from '../parseDiscordAnnouncement';
import { normalizeDiscordTableDraft } from '../normalizeDiscordTableDraft';
import type { DiscordRawMessage } from '../types';

function makeMessage(overrides: Partial<DiscordRawMessage>): DiscordRawMessage {
  return {
    source_kind: 'discord_bot',
    discord_message_id: '1000',
    discord_channel_id: '2000',
    discord_guild_id: '3000',
    discord_parent_channel_id: '4000',
    discord_thread_id: '1000',
    discord_thread_name: 'Dungeons & Dragons: Tomb of Annihilation',
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

describe('parseDiscordAnnouncement', () => {
  it('returns null for forum starters without body and without text in embeds (T-F1-04)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_message_id: '1499747163977027634',
        discord_channel_id: '1499747163977027634',
        discord_thread_id: '1499747163977027634',
        discord_thread_name: 'Forgotten Realms™: Uma Campanha Sandbox',
        content_raw: '',
        embeds: [],
        attachments: [],
      }),
    );

    expect(draft).toBeNull();
  });

  it('still extracts a draft when the body is empty but embeds carry text (T-F1-05)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Dungeons & Dragons™: Deicídio',
        content_raw: '',
        embeds: [
          {
            description: '▬ Sistema: Dungeons & Dragons\n▬ Vagas Totais: 4\nQuartas-feiras às 20h\nhttps://forms.gle/example',
          },
        ],
      }),
    );

    expect(draft).not.toBeNull();
    expect(draft?.table.title).toBe('Deicídio');
  });

  it('returns null for the full batch of empty-content Covil starters (T-F1-04 batch)', () => {
    const titles = [
      'Forgotten Realms™: Uma Campanha Sandbox',
      'Dungeons & Dragons™: Deicídio',
      'Tormenta20™: A Libertação de Valkaria',
      'Planescape™: Legends of the Outer Planes',
      'Fundação 0: Lucro, Ossos e Reputação',
      'Crystal Heart™: O Último Manuscrito',
      'Dungeons & Dragons™: Wrath of the River King',
      'Mage: The Awakeking™: Pó de Osso e Água de Poço',
      'Dungeons & Dragons: Dragons Delves™',
      'Waterdeep: Dragon Heist™ + Dungeon of the Mad Mage™',
      'Doomed Forgotten Realms™: Rise and Fall of Vecna',
      'Dungeons & Dragons: Chains of Asmodeus™',
    ];

    const drafts = titles.map((threadName, index) =>
      parseDiscordAnnouncement(
        makeMessage({
          discord_message_id: `starter-${index}`,
          discord_channel_id: `starter-${index}`,
          discord_thread_id: `starter-${index}`,
          discord_thread_name: threadName,
          content_raw: '',
          embeds: [],
        }),
      ),
    );

    expect(drafts).toHaveLength(12);
    expect(drafts.every((d) => d === null)).toBe(true);
  });

  it('extracts structured table fields from announcement text', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: A Torre dos Tres Sabores',
          'Tipo: Campanha',
          'Modalidade: Online',
          'Preco: R$ 25',
          'Vagas: 4',
          'Dia: sexta',
          'Horario: 20:00',
          'Frequencia: semanal',
          'Contato: https://forms.gle/example',
          'Descricao: Uma aventura culinaria em uma torre magica.',
        ].join('\n'),
      }),
    );

    expect(draft?.table.title).toBe('A Torre dos Tres Sabores');
    expect(draft?.table.system_name).toBe('Dungeons & Dragons');
    expect(draft?.table.type).toBe('campanha');
    expect(draft?.table.modality).toBe('online');
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value).toBe(25);
    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.day_of_week).toBe('sexta');
    expect(draft?.table.start_time).toBe('20:00');
    expect(draft?.table.frequency).toBe('semanal');
    expect(draft?.table.contact_url).toBe('https://forms.gle/example');
    expect(draft?.missing_fields).not.toContain('title');
  });

  it('extracts Covil forum body fields with markdown labels and session-zero note', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Forgotten Realms™: Uma Campanha Sandbox',
        content_raw: [
          '▬ **Sistema:** *Dungeons & Dragons 2024®*',
          '▬ **Nível:** 3 ao 20',
          '▬** Mestre:**',
          '- <@186160570133643265>',
          '▬ **Estilo/Temática:** Sandbox, aventura, sobrevivência, diplomacia, exploração e alta fantasia.',
          '▬ **Local:** Discord + Foundry VTT (Necessário ter PC).',
          '▬ **Data & Horários:**',
          'Quartas-feiras das 21h às 00h',
          '▬ **Vagas Totais:** 6',
          '▬ **Vagas Disponíveis:** 0',
          '▬ **Mesa Paga:** R$ 35,00 por sessão (Sessão Zero gratuita).',
          'Caso se interesse pela aventura, basta enviar um ticket em <#1295552443337281576>',
        ].join('\n'),
      }),
    );

    expect(draft?.table.system_name).toBe('Dungeons & Dragons 2024');
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value).toBe(35);
    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(0);
    expect(draft?.table.day_of_week).toBe('quarta');
    expect(draft?.table.start_time).toBe('21:00');
    expect(draft?.missing_fields).not.toContain('slots_total');
  });

  it('extracts canonical total and open slots without ambiguity (spec 017 T-F1-A-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horários:** Quartas-feiras das 21h às 00h',
          '▬ **Vagas Totais:** 6',
          '▬ **Vagas Disponíveis:** 0',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(0);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('keeps slash slots ambiguous when Covil writes Vagas: 0/6 (spec 017 T-F1-A-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          '▬ **Vagas:** 0/6',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBeNull();
    expect(draft?.table._slots_ambiguity).toEqual({ first: 0, second: 6, source: 'x_slash_y' });
  });

  it('keeps slash slots ambiguous even when both numbers match (spec 017 T-F1-A-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          '▬ **Vagas:** 5/5',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBeNull();
    expect(draft?.table._slots_ambiguity).toEqual({ first: 5, second: 5, source: 'x_slash_y' });
  });

  it('extracts simple Vagas: N as total and open slots without ambiguity (spec 017 T-F1-A-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.slots_open).toBe(4);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('keeps Vagas: 0 as an explicit closed table instead of missing slots (spec 017 Fase E regression)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Terças-feiras das 19h às 23h',
          '▬ **Vagas:** 0 VAGA - EM ANDAMENTO',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    const normalized = normalizeDiscordTableDraft(draft!);

    expect(draft?.table.slots_total).toBe(0);
    expect(draft?.table.slots_open).toBe(0);
    expect(draft?.missing_fields).not.toContain('slots_total');
    expect(normalized.draft.missing_fields).not.toContain('slots_total');
  });

  it('does not infer weekly frequency for one-shots (spec 017 T-F1-A-04)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '⚠️ **One-shot Gratuita** ⚠️',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          '▬ **Vagas:** 0/6',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.type).toBe('one-shot');
    expect(draft?.table.frequency).toBeNull();
  });

  it('infers weekly frequency for campaigns with day_of_week (spec 017 T-F1-A-04)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          'Tipo: Campanha',
          '▬ **Data & Horário:** Quarta-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.type).toBe('campanha');
    expect(draft?.table.day_of_week).toBe('quarta');
    expect(draft?.table.frequency).toBe('semanal');
  });

  it('does not infer frequency for campaigns without day_of_week (spec 017 T-F1-A-04)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          'Tipo: Campanha',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.type).toBe('campanha');
    expect(draft?.table.day_of_week).toBeNull();
    expect(draft?.table.frequency).toBeNull();
  });

  it('does not infer frequency for open tables (spec 017 T-F1-A-04)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          'Mesa aberta para iniciantes',
          '▬ **Data & Horário:** Quarta-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.type).toBe('aberta');
    expect(draft?.table.frequency).toBeNull();
  });

  it('extracts host_discord_id from Mestre mention on the same line (spec 017 T-F1-A-05)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Mestre:** <@225275653333843970>',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.host_discord_id).toBe('225275653333843970');
  });

  it('extracts host_discord_id from GM mention (spec 017 T-F1-A-05)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **GM:** <@99999>',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.host_discord_id).toBe('99999');
  });

  it('extracts host_discord_id when Mestre label and mention are split across lines (spec 017 T-F1-A-05)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬** Mestre:**',
          '- <@186160570133643265>',
          '▬ **Data & Horários:** Quartas-feiras das 21h às 00h',
          '▬ **Vagas Totais:** 6',
          '▬ **Vagas Disponíveis:** 0',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.host_discord_id).toBe('186160570133643265');
  });

  it('keeps host_discord_id null without a host line (spec 017 T-F1-A-05)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.host_discord_id).toBeNull();
  });

  it('marks ambiguous slash slots as missing slots_open during normalization (spec 017 T-F1-A-06)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          '▬ **Vagas:** 0/6',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [{ id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] }],
    );

    expect(draft).not.toBeNull();
    const normalized = normalizeDiscordTableDraft(draft!, [
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] },
    ]);

    expect(normalized.draft.missing_fields).toContain('slots_open:ambiguous_x_of_y');
    expect(normalized.status).toBe('needs_review');
  });

  it('matches systems by specific names before generic aliases and version suffixes', () => {
    const systems = [
      { id: 'gamma', name: 'Gamma World', name_pt: null, aliases: ['D&D'] },
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D 5e'] },
      { id: 'tormenta', name: 'Tormenta', name_pt: null, aliases: [] },
    ];

    const dndDraft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Planescape™: Legends of the Outer Planes',
        content_raw: '▬ Sistema: Dungeons & Dragons 5.5e\n▬ Vagas Totais: 5\nQuartas-feiras às 20h\nhttps://forms.gle/example',
      }),
      systems,
    );
    const tormentaDraft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Tormenta20™: A Libertação de Valkaria',
        content_raw: '▬ Sistema: Tormenta20\n▬ Vagas Totais: 3\nQuartas-feiras às 20h\nhttps://forms.gle/example',
      }),
      systems,
    );

    expect(dndDraft?.table.system_id).toBe('dnd');
    expect(tormentaDraft?.table.system_id).toBe('tormenta');
  });

  it('uses Discord channel mentions as contact when no external URL exists', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Dungeons & Dragons™: Wrath of the River King',
        content_raw: [
          '▬ Sistema: Dungeons & Dragons 5.5',
          '▬ Data & Horário:',
          '- Sextas-feiras das 19h30 às 23h',
          '▬ Vagas Totais: 6',
          '▬ Vagas Disponíveis: 6',
          '▬ Mesa Paga: R$ 25,00 por sessão',
          'Caso se interesse pela aventura, basta enviar um ticket em <#1295552443337281576>',
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_discord).toBe('<#1295552443337281576>');
    expect(draft?.missing_fields).not.toContain('contact_url');
  });

  it('suggests unknown systems from the explicit system field instead of thread scenario titles', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Forgotten Realms™: Uma Campanha Sandbox',
        content_raw: [
          '▬ Sistema: One Two Six (Sistema Inédito)',
          '▬ Data & Horário:',
          '- Sextas-feiras das 18h às 21h',
          '▬ Vagas Totais: 6',
          '▬ Vagas Disponíveis: 6',
          '▬ Mesa Paga: R$ 20,00 por sessão',
          'Caso se interesse pela aventura, basta enviar um ticket em <#1295552443337281576>',
        ].join('\n'),
      }),
      [{ id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] }],
    );

    expect(draft?.table.raw_system_hint).toBe('One Two Six');
    expect(draft?.table.system_name).toBe('One Two Six');
    expect(draft?.missing_fields).toContain('system_name:unmatched_hint');
    expect(draft?.table.raw_system_hint).not.toBe('Forgotten Realms');
  });

  it('preserves unknown systems from the thread title when the body has no explicit system field', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Shadowdark: Torre da Lua',
        content_raw: [
          '▬ Data & Horário:',
          '- Sextas-feiras das 18h às 21h',
          '▬ Vagas Totais: 6',
          '▬ Vagas Disponíveis: 6',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [{ id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] }],
    );

    expect(draft?.table.title).toBe('Torre da Lua');
    expect(draft?.table.system_name).toBe('Shadowdark');
    expect(draft?.table.raw_system_hint).toBe('Shadowdark');
    expect(draft?.missing_fields).toContain('system_name:unmatched_hint');
  });

  it('strips parenthetical notes from unknown system hints (spec 017 T-F1-B-01)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Pokémon: Jornada em Kanto',
        content_raw: [
          '▬ **Sistema:** Pokémon RPG (Sistema próprio usando D&D como base, em fase de desenvolvimento)',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [{ id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] }],
    );

    expect(draft?.table.raw_system_hint).toBe('Pokémon RPG');
    expect(draft?.table.system_name).toBe('Pokémon RPG');
  });

  it('matches D&D after stripping parenthetical notes and version suffix (spec 017 T-F1-B-01)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'D&D: Aventura Retrocompatível',
        content_raw: [
          '▬ **Sistema:** D&D 5.5 (com retrocompatibilidade)',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [{ id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'] }],
    );

    expect(draft?.table.system_id).toBe('dnd');
    expect(draft?.table.system_name).toBe('Dungeons & Dragons');
    expect(draft?.table.raw_system_hint).toBeNull();
  });

  it('matches Starfinder after stripping 2e version suffix and records a note (spec 017 T-F1-B-01)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Starfinder: Operação Órbita',
        content_raw: [
          '▬ **Sistema:** Starfinder 2e',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [{ id: 'starfinder', name: 'Starfinder', name_pt: null, aliases: [] }],
    );

    expect(draft?.table.system_id).toBe('starfinder');
    expect(draft?.table.system_name).toBe('Starfinder');
    expect(draft?.table.raw_system_hint).toBeNull();
    expect(draft?.table._notes).toContain('version_mismatch:2e');
  });

  it('extracts standard cover image from Discord attachments (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'image/jpeg',
            width: 1194,
            height: 804,
            size: 550698,
            url: 'https://cdn.discordapp.com/attachments/1/banner.jpg?ex=abc',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/banner.jpg?ex=abc');
    expect(draft?.table.cover_quality).toBe('standard');
  });

  it('flags small cover images as low quality (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'image/png',
            width: 400,
            height: 300,
            size: 30000,
            url: 'https://cdn.discordapp.com/attachments/1/small.png?ex=abc',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/small.png?ex=abc');
    expect(draft?.table.cover_quality).toBe('low');
  });

  it('ignores SVG attachments for cover extraction (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'image/svg+xml',
            width: 1194,
            height: 804,
            size: 550698,
            url: 'https://cdn.discordapp.com/attachments/1/vector.svg?ex=abc',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBeNull();
    expect(draft?.table.cover_quality).toBeNull();
  });

  it('ignores non-image attachments for cover extraction (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'application/pdf',
            size: 550698,
            url: 'https://cdn.discordapp.com/attachments/1/handout.pdf?ex=abc',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBeNull();
    expect(draft?.table.cover_quality).toBeNull();
  });

  it('keeps cover fields null when no attachments exist (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [],
      }),
    );

    expect(draft?.table.cover_url_source).toBeNull();
    expect(draft?.table.cover_quality).toBeNull();
  });

  it('uses the first image attachment as cover source (spec 017 T-F1-C-02)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'application/pdf',
            size: 550698,
            url: 'https://cdn.discordapp.com/attachments/1/handout.pdf?ex=abc',
          },
          {
            content_type: 'image/jpeg',
            width: 1200,
            height: 800,
            size: 120000,
            url: 'https://cdn.discordapp.com/attachments/1/first.jpg?ex=abc',
          },
          {
            content_type: 'image/jpeg',
            width: 1200,
            height: 800,
            size: 120000,
            url: 'https://cdn.discordapp.com/attachments/1/second.jpg?ex=abc',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/first.jpg?ex=abc');
    expect(draft?.table.cover_quality).toBe('standard');
  });

  it('ignores empty non-starter replies so they do not create duplicate drafts', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_message_id: 'reply-1',
        discord_thread_id: 'thread-1',
        discord_channel_id: 'thread-1',
        content_raw: '',
      }),
    );

    expect(draft).toBeNull();
  });
});
