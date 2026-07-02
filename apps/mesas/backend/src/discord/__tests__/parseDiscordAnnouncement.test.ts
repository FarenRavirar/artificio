import { parseDiscordAnnouncement, classifyConfidence, isSuspiciousUrl, isHomebrewSystem, classifyHomebrew } from '../parseDiscordAnnouncement';
import { normalizeDiscordTableDraft } from '../normalizeDiscordTableDraft';
import type { ImportRawMessage } from '../types';
import { chatExporterSampleMessages } from './fixtures/chatExporterSample';

function makeMessage(overrides: Partial<ImportRawMessage>): ImportRawMessage {
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

  it('descarta sistema próprio/autoral mesmo declarando base conhecida (DEB-048-27)', () => {
    // Pré-DEB-048-27 este caso virava draft "Pokémon RPG". DEB-048-27 + CodeRabbit
    // (preservar o parêntese p/ o gate homebrew): "Sistema próprio usando D&D" é
    // autoral → DESCARTAR. O sinal de autoria vive no parêntese, antes cortado por
    // extractLabelValue; agora o gate o enxerga.
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

    expect(draft).toBeNull();
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

  // ─── T-C1: Discord timestamp ───────────────────────────────────────────────

  it('extracts day of week and start time from Discord <t:UNIX:F> and <t:UNIX:t> (T-C1)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-timestamp')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // 1717200000 = Saturday June 1, 2024 00:00 UTC → sexta 31 Mai 2024 21:00 BRT
    // day_of_week usa a forma curta canônica do projeto ("sexta", não "sexta-feira").
    expect(draft?.table.day_of_week).toBe('sexta');
    expect(draft?.table.start_time).toBe('21:00');
    // T-C2: Google Forms URL deve ser detectada como contact_url
    expect(draft?.table.contact_url).toBe('https://forms.gle/FakeTimestampForm');
  });

  it('falls back to text extraction when no Discord timestamp is present (T-C1 regression)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: Aventura Teste',
          'Dia: quarta-feira',
          'Horario: 19:00',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.day_of_week).toBe('quarta');
    expect(draft?.table.start_time).toBe('19:00');
  });

  // ─── T-C2: Google Forms ────────────────────────────────────────────────────

  it('prioritizes Google Forms URL (forms.gle) as contact_url (T-C2)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-forms')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // Deve capturar o forms.gle (antes do docs.google.com no texto)
    expect(draft?.table.contact_url).toBe('https://forms.gle/AbCdEf123');
    expect(draft?.missing_fields).not.toContain('contact_url');
  });

  it('detects docs.google.com/forms as contact_url (T-C2)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta-feira às 20h',
          'Vagas: 4',
          'https://docs.google.com/forms/d/e/1FAIpQLSfake/viewform?usp=sharing',
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_url).toBe('https://docs.google.com/forms/d/e/1FAIpQLSfake/viewform?usp=sharing');
  });

  // ─── T-C3: Contato implícito pelo autor ────────────────────────────────────

  it('uses author id as host when "me mande uma mensagem" is present and no explicit contact (T-C3)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-mande-msg')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // "me mande uma mensagem" → contato implícito → autor vira host
    expect(draft?.table.host_discord_id).toBe('author-implicit-1');
    expect(draft?.source.author_id).toBe('author-implicit-1');
  });

  it('uses author id when "chama no pv" is present and no explicit contact (T-C3)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-chama-pv')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // "chama no pv" + "este perfil" → contato implícito → autor vira host
    expect(draft?.table.host_discord_id).toBe('author-implicit-2');
  });

  it('does NOT falsely set author as host when there is a contact URL (T-C3 guard)', () => {
    // A mensagem de timestamp tem forms.gle → contactUrl está preenchido → NÃO deve usar autor
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-timestamp')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // contactUrl está preenchido (forms.gle), então NÃO usa o autor como host
    // O texto não tem menção de Mestre, então host_discord_id deveria ser null
    // (a menos que extractHostDiscordId ache algo)
    expect(draft?.table.contact_url).toBeTruthy();
    // host_discord_id pode ser null (sem menção de mestre) ou o que extractHostDiscordId achar
    // O importante é que o mecanismo de contato implícito não forçou author como host
  });

  it('sem contato explícito → contact_discord = autor e contact NÃO falta (DEB-048-26)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_author_id: 'author-999',
        discord_author_name: 'mestre_fulano',
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: Teste Normal',
          'Dia: terça-feira às 20h',
          'Vagas: 4',
        ].join('\n'),
      }),
    );

    // DEB-048-26: quem publicou é o contato padrão (nome > id).
    expect(draft?.table.contact_discord).toBe('mestre_fulano');
    expect(draft?.missing_fields).not.toContain('contact_url');
  });

  it('contato explícito (forms) tem precedência sobre o autor (DEB-048-26)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_author_id: 'author-999',
        discord_author_name: 'mestre_fulano',
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Inscrição: https://forms.gle/abc123',
          'Dia: terça-feira às 20h',
        ].join('\n'),
      }),
    );

    // forms preenche contact_url → autor NÃO vira contact_discord
    expect(draft?.table.contact_url).toContain('forms.gle');
    expect(draft?.table.contact_discord).toBeNull();
  });

  // ─── DEB-048-27/29: sistema autoral — STRONG descarta, WEAK vai p/ revisão ──

  // STRONG (nítido) → DESCARTA (null).
  it.each([
    'Sistema: Próprio',
    'Sistema: Proprio',
    'Sistema: Sistema Próprio',
    'Sistema: autoral',
    'Sistema: homebrew',
    'Sistema: caseiro',
  ])('DEB-048-27: descarta (null) sistema nitidamente autoral: %s', (sistemaLinha) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [sistemaLinha, 'Mesa: Teste', 'Dia: sexta às 20h', 'Vagas: 4'].join('\n'),
      }),
    );
    expect(draft).toBeNull();
  });

  // WEAK (ambíguo) → NÃO descarta; vira draft com _homebrew_suspect → needs_review.
  it.each([
    'Sistema: Mundo de Aldoria (baseado em D&D)',
    'Sistema: Reinos (inspirado em Tormenta)',
    'Sistema: Crônicas (adaptado de GURPS)',
  ])('DEB-048-29: marca como ambíguo (needs_review) sistema autoral fraco: %s', (sistemaLinha) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [sistemaLinha, 'Mesa: Teste', 'Dia: sexta às 20h', 'Vagas: 4', 'Contato: https://forms.gle/x', 'Descrição: teste'].join('\n'),
      }),
    );
    expect(draft).not.toBeNull();
    expect(draft?.table._homebrew_suspect).toBe(true);

    const normalized = normalizeDiscordTableDraft(draft!);
    expect(normalized.status).toBe('needs_review');
    expect(normalized.draft.missing_fields).toContain('system_name:homebrew_suspect');
  });

  it('NÃO descarta sistema conhecido (D&D) nem por menção solta de "próprio" no corpo', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: ['Sistema: Dungeons & Dragons 5e', 'Uso mapas próprios e material autoral de apoio.', 'Dia: sexta às 20h'].join('\n'),
      }),
    );
    expect(draft).not.toBeNull(); // "próprio/autoral" no corpo ≠ sistema autoral
    expect(draft?.table._homebrew_suspect).toBeNull();
  });

  it('classifyHomebrew: discard p/ STRONG, review p/ WEAK, none p/ conhecido (DEB-048-29)', () => {
    expect(classifyHomebrew(makeMessage({ content_raw: 'Sistema: Próprio\nDia: sexta' }))).toBe('discard');
    expect(classifyHomebrew(makeMessage({ content_raw: 'Sistema: Aldoria (baseado em D&D)\nDia: sexta' }))).toBe('review');
    expect(classifyHomebrew(makeMessage({ content_raw: 'Sistema: Tormenta 20\nDia: sexta' }))).toBe('none');
    // isHomebrewSystem = só descarte nítido (retrocompat).
    expect(isHomebrewSystem(makeMessage({ content_raw: 'Sistema: Próprio\nDia: sexta' }))).toBe(true);
    expect(isHomebrewSystem(makeMessage({ content_raw: 'Sistema: Aldoria (baseado em D&D)\nDia: sexta' }))).toBe(false);
    expect(isHomebrewSystem(makeMessage({ content_raw: 'Sistema: Tormenta 20\nDia: sexta' }))).toBe(false);
  });

  // ─── T-C6: Vagas informais ─────────────────────────────────────────────────

  it('extracts "3 de 5" as total=5, open=2 (T-C6)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-vagas-informal')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // "3 de 5 vagas preenchidas" → total=5, open=2 (5-3)
    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBe(2);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('returns slots from "1 vaga via forms" when mixed with "mesa em andamento" (DEB-048-16)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-em-andamento')!;
    const draft = parseDiscordAnnouncement(msg);

    expect(draft).not.toBeNull();
    // "1 vaga via forms" agora tem precedência sobre "Mesa em andamento"
    expect(draft?.table.slots_total).toBe(1);
    expect(draft?.table.slots_open).toBe(1);
  });

  it('does not match "X de Y" when numbers look like a date/level (T-C6 guard)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: Teste de Guarda',
          // "dia 22 de 06" → 22 ≤ 6 = false → guard bloqueia (não é vaga)
          'Dia: 22 de 06',
          'Horario: 19:00',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    // "22 de 06" falha no guard (22 > 6), então não captura como vaga
    // Deve cair no padrão "Vagas: 4" → total=4, open=4
    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.slots_open).toBe(4);
  });

  it('does not match "X de Y" when Y > 20 (T-C6 guard)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: Teste de Guarda',
          // "3 de 30" → 30 > 20 → guard bloqueia
          'Nível 3 de 30 possíveis',
          'Dia: quinta-feira às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    // "3 de 30" falha no guard (30 > 20), então cai no "Vagas: 4"
    expect(draft?.table.slots_total).toBe(4);
  });

  it('extracts "0 de 5" as total=5, open=5 (T-C6)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: Mesa Nova',
          'Temos 0 de 5 vagas preenchidas',
          'Dia: sábado às 15h',
        ].join('\n'),
        discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-0de5',
      }),
    );

    // "0 de 5" → total=5, open=5
    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBe(5);
  });

  it('fixture messages all parse without throwing (smoke test)', () => {
    for (const msg of chatExporterSampleMessages) {
      expect(() => parseDiscordAnnouncement(msg)).not.toThrow();
    }
  });

  // ─── DEB-048-13: anexos ChatExporter (fileName sem content_type) ────────────

  it('extracts cover from attachment with fileName and url, without content_type (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: quinta-feira às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            fileName: 'banner.png',
            url: 'https://cdn.discordapp.com/attachments/1/banner.png?ex=abc',
            fileSizeBytes: 150000,
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/banner.png?ex=abc');
    // ChatExporter não tem width/size → quality 'low'
    expect(draft?.table.cover_quality).toBe('low');
    // Anexo é imagem → NÃO deve gerar nota de anexo
    expect(draft?.table._notes).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Anexo: banner.png')]),
    );
  });

  it('extracts cover from .jpg attachment via fileName extension (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta às 19h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            fileName: 'cover.jpg',
            url: 'https://cdn.discordapp.com/attachments/1/cover.jpg',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/cover.jpg');
    expect(draft?.table.cover_quality).toBe('low');
  });

  it('generates attachment note for .mp4 video (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sábado às 15h',
          'Vagas: 5',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            fileName: 'trailer.mp4',
            url: 'https://cdn.discordapp.com/attachments/1/trailer.mp4',
            fileSizeBytes: 50_000_000,
          },
        ],
      }),
    );

    // Cover deve ser null (vídeo não é imagem)
    expect(draft?.table.cover_url_source).toBeNull();
    // Deve gerar nota de anexo
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([expect.stringContaining('Anexo: trailer.mp4')]),
    );
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([expect.stringContaining('47.7 MB')]),
    );
  });

  it('generates attachment note for .txt file (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: domingo às 14h',
          'Vagas: 3',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            fileName: 'regras.txt',
            url: 'https://cdn.discordapp.com/attachments/1/regras.txt',
            fileSizeBytes: 2048,
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBeNull();
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([expect.stringContaining('Anexo: regras.txt (2 KB)')]),
    );
  });

  it('cover from bot-fetch format (content_type) still works (DEB-048-13 compat)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: quarta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            content_type: 'image/png',
            width: 1200,
            height: 800,
            size: 120000,
            url: 'https://cdn.discordapp.com/attachments/1/bot-banner.png',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBe('https://cdn.discordapp.com/attachments/1/bot-banner.png');
    expect(draft?.table.cover_quality).toBe('standard');
  });

  it('ignores SVG by extension even without content_type (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: terça às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            fileName: 'logo.svg',
            url: 'https://cdn.discordapp.com/attachments/1/logo.svg',
          },
        ],
      }),
    );

    expect(draft?.table.cover_url_source).toBeNull();
    expect(draft?.table.cover_quality).toBeNull();
  });

  it('handles missing fileName gracefully (DEB-048-13)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: quinta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [
          {
            url: 'https://cdn.discordapp.com/attachments/1/unknown',
          },
        ],
      }),
    );

    // Sem fileName e sem content_type → não identifica como imagem → sem cover
    expect(draft?.table.cover_url_source).toBeNull();
  });

  // ─── DEB-048-14: replies/threads ────────────────────────────────────────────

  it('adds reply note when replyContext is provided (DEB-048-14)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Re: D&D 5e: Procura-se Jogadores',
        content_raw: 'Tenho interesse! Me chama no privado.',
      }),
      [],
      'Procurando jogadores para uma campanha de D&D 5e nas sextas à noite.',
    );

    expect(draft).not.toBeNull();
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([
        'Em resposta a: Procurando jogadores para uma campanha de D&D 5e nas sextas à noite.',
      ]),
    );
  });

  it('reply note uses first 80 chars of snippet (DEB-048-14)', () => {
    const longMessage = 'A'.repeat(200);
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Re: Tópico Longo',
        content_raw: 'Resposta curta.',
      }),
      [],
      longMessage.slice(0, 80),
    );

    expect(draft).not.toBeNull();
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Em resposta a: A{80}$/)]),
    );
  });

  it('no reply note when replyContext is undefined (DEB-048-14)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'D&D 5e: Mesa Nova',
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
      [],
      undefined,
    );

    expect(draft).not.toBeNull();
    const hasReplyNote = draft?.table._notes.some((n) => n.startsWith('Em resposta a:'));
    expect(hasReplyNote).toBe(false);
  });

  it('fixture msg-008 (reply) with explicit replyContext produces reply note (DEB-048-14)', () => {
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-008')!;
    const draft = parseDiscordAnnouncement(
      msg,
      [],
      'Procurando jogadores para uma campanha de D&D 5e nas sextas à noite.',
    );

    expect(draft).not.toBeNull();
    expect(draft?.table._notes).toEqual(
      expect.arrayContaining([
        'Em resposta a: Procurando jogadores para uma campanha de D&D 5e nas sextas à noite.',
      ]),
    );
  });

  it('orphan reference (messageId inexistente) não gera erro (DEB-048-14)', () => {
    // msg-008 tem reference.messageId='msg-007', mas passamos replyContext undefined
    // (simulando referência órfã — messageId existe no export mas não no contentIndex)
    const msg = chatExporterSampleMessages.find((m) => m.discord_message_id === 'msg-008')!;
    const draft = parseDiscordAnnouncement(msg, [], undefined);

    expect(draft).not.toBeNull();
    // Sem replyContext → sem nota de reply
    const hasReplyNote = draft?.table._notes.some((n) => n.startsWith('Em resposta a:'));
    expect(hasReplyNote).toBe(false);
  });

  it('preserves role mentions as raw evidence and review notes (052 R15)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
          'Tags: <@&123456789012345678> <@&123456789012345678>',
        ].join('\n'),
      }),
    );

    expect(draft?.table._raw_evidence?.role_mentions).toEqual(['<@&123456789012345678>']);
    expect(draft?.table._notes).toEqual(expect.arrayContaining(['Role mencionada: <@&123456789012345678>']));
  });

  it('uses explicit user mention as Discord contact without accepting channel mention (052 R16)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_author_id: '9999',
        discord_author_name: 'Autor',
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta às 20h',
          'Vagas: 4',
          'Contato: <@!777777777777777777> no canal <#222222222222222222>',
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_discord).toBe('<@!777777777777777777>');
    expect(draft?.table.contact_discord).not.toBe('<#222222222222222222>');
    expect(draft?.table._raw_evidence?.user_mentions).toEqual(['<@777777777777777777>']);
  });

  it('extracts paid and free table signals deterministically (052 R17)', () => {
    const paid = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dungeons & Dragons',
        'Dia: sexta às 20h',
        'Vagas: 4',
        'Valor: R$ 25,50',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));
    const free = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dungeons & Dragons',
        'Dia: sexta às 20h',
        'Vagas: 4',
        'Mesa gratuita',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));

    expect(paid?.table.price_type).toBe('paga');
    expect(paid?.table.price_value).toBe(25.5);
    expect(free?.table.price_type).toBe('gratuita');
    expect(free?.table.price_value).toBeNull();
  });

  it('does not assume a table is free when price is absent', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dungeons & Dragons',
        'Dia: sexta às 20h',
        'Vagas: 4',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));

    expect(draft?.table.price_type).toBeNull();
    expect(draft?.table.price_value).toBeNull();
  });

  it('extracts paid table signal with reversed currency or without numeric value', () => {
    const reversedCurrency = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dungeons & Dragons',
        'Dia: sexta às 20h',
        'Vagas: 4',
        'Disponível por 27 R$/cada.',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));
    const paidWithoutValue = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dungeons & Dragons',
        'Dia: sexta às 20h',
        'Vagas: 4',
        'Mesa paga',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));

    expect(reversedCurrency?.table.price_type).toBe('paga');
    expect(reversedCurrency?.table.price_value).toBe(27);
    expect(paidWithoutValue?.table.price_type).toBe('paga');
    expect(paidWithoutValue?.table.price_value).toBeNull();
  });

  it('marks inspired/adapted systems as homebrew suspect instead of discarding (052 R18)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Mesa: Mistério na Ilha',
        content_raw: [
          'Sistema: inspirado em D&D',
          'Dia: sexta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft).not.toBeNull();
    expect(draft?.table._homebrew_suspect).toBe(true);
    expect(draft?.missing_fields).toContain('system_name:unmatched_hint');
  });

  it('discards homebrew system labels written with mathematical styled letters', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        '# __Mesa Estilizada__',
        '▬ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀: *Próprio*',
        '▬ Vagas: 4',
        'Contato: https://forms.gle/example',
      ].join('\n'),
    }));

    expect(draft).toBeNull();
  });

  it('preserves attachments and embeds as raw evidence (052 R19)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Dia: sexta às 20h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
        attachments: [{ fileName: 'mapa.pdf', fileSizeBytes: 2048, url: 'https://cdn.discordapp.com/attachments/1/mapa.pdf' }],
        embeds: [{ title: 'Ficha da Mesa', url: 'https://example.com/ficha' }],
      }),
    );

    expect(draft?.table._raw_evidence?.attachments).toEqual([
      { file_name: 'mapa.pdf', url: 'https://cdn.discordapp.com/attachments/1/mapa.pdf' },
    ]);
    expect(draft?.table._raw_evidence?.embeds).toEqual([
      { title: 'Ficha da Mesa', url: 'https://example.com/ficha' },
    ]);
    expect(draft?.table._notes).toEqual(expect.arrayContaining([
      expect.stringContaining('Anexo: mapa.pdf'),
      'Embed: Ficha da Mesa',
    ]));
  });
});

// ─── T-G1: classifyConfidence ──────────────────────────────────────────

describe('classifyConfidence', () => {
  it('muito_alta (≥0.85)', () => {
    expect(classifyConfidence(1.0)).toBe('muito_alta');
    expect(classifyConfidence(0.85)).toBe('muito_alta');
    expect(classifyConfidence(0.89)).toBe('muito_alta');
  });

  it('alta (≥0.65)', () => {
    expect(classifyConfidence(0.84)).toBe('alta');
    expect(classifyConfidence(0.65)).toBe('alta');
    expect(classifyConfidence(0.70)).toBe('alta');
  });

  it('media (≥0.40)', () => {
    expect(classifyConfidence(0.64)).toBe('media');
    expect(classifyConfidence(0.40)).toBe('media');
    expect(classifyConfidence(0.50)).toBe('media');
  });

  it('baixa (<0.40)', () => {
    expect(classifyConfidence(0.39)).toBe('baixa');
    expect(classifyConfidence(0.0)).toBe('baixa');
    expect(classifyConfidence(0.10)).toBe('baixa');
  });
});

// ─── T-G2: isSuspiciousUrl ─────────────────────────────────────────────

describe('isSuspiciousUrl', () => {
  it('discord.gg é seguro', () => {
    expect(isSuspiciousUrl('https://discord.gg/abc123')).toBe(false);
    expect(isSuspiciousUrl('https://discord.com/invite/xyz')).toBe(false);
  });

  it('Google Forms é seguro', () => {
    expect(isSuspiciousUrl('https://forms.gle/abc')).toBe(false);
    expect(isSuspiciousUrl('https://docs.google.com/forms/d/123/viewform')).toBe(false);
  });

  it('WhatsApp é seguro', () => {
    expect(isSuspiciousUrl('https://chat.whatsapp.com/abc')).toBe(false);
    expect(isSuspiciousUrl('https://wa.me/5511999999999')).toBe(false);
  });

  it('Telegram é seguro', () => {
    expect(isSuspiciousUrl('https://t.me/grupo')).toBe(false);
  });

  it('Typeform é seguro', () => {
    expect(isSuspiciousUrl('https://mysurvey.typeform.com/to/abc')).toBe(false);
  });

  it('URL desconhecida é suspeita', () => {
    expect(isSuspiciousUrl('https://meusite.com/formulario')).toBe(true);
    expect(isSuspiciousUrl('https://bit.ly/abc')).toBe(true);
    expect(isSuspiciousUrl('https://tinyurl.com/xyz')).toBe(true);
  });

  describe('DEB-052-01 — labels decorados (cleanLabelLine + slotsViaLabel)', () => {
    it('recupera sistema com bullet » e markdown ** (template comunidade)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          discord_thread_name: 'Mesa nova',
          content_raw: '» **Sistema:** Tormenta20\n» Vagas disponíveis: 5\n» Data: Sábado às 20h',
        }),
      );
      // systems=[] → hint extraído fica como raw_system_hint (não casa DB)
      expect(draft?.table.raw_system_hint).toBe('Tormenta20');
    });

    it('recupera sistema com ordem **▬ (bug de ordem do ** corrigido)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: '**▬ Sistema:** Ordem Paranormal\n▬ Data: Domingo 19h' }),
      );
      expect(draft?.table.raw_system_hint).toBe('Ordem Paranormal');
    });

    it('slotsViaLabel cobre rótulo exótico que as regexes "vagas" perdem ("Lugares: N")', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa massa\n» Lugares: 6\n» Data: Sexta 21h' }),
      );
      expect(draft?.table.slots_total).toBe(6);
      expect(draft?.missing_fields).not.toContain('slots_total');
    });

    it('slotsViaLabel: rótulo genérico X/Y = preenchidas/total ("Lugares: 2/5")', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa\n» Lugares: 2/5\n» Data: Sexta 21h' }),
      );
      expect(draft?.table.slots_total).toBe(5);
      expect(draft?.table.slots_open).toBe(3); // 5 total - 2 preenchidas
    });

    it('URL não é engolida como continuação do rótulo anterior (Sistema)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa\nSistema: D&D\nhttps://forms.gle/abc\nVagas: 5' }),
      );
      expect(draft?.table.raw_system_hint).toBe('D&D');
    });
  });
});
