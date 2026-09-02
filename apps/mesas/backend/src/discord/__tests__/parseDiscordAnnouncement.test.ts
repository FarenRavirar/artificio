import { parseDiscordAnnouncement, classifyConfidence, isSuspiciousUrl, isHomebrewSystem, classifyHomebrew, cleanDescriptionText, stripNullBytes } from '../parseDiscordAnnouncement.js';
import { normalizeDiscordTableDraft } from '../normalizeDiscordTableDraft.js';
import type { ImportRawMessage } from '../types.js';
import type { DiscordRoleMapping } from '../../db/types.js';
import { chatExporterSampleMessages } from './fixtures/chatExporterSample.js';
import { parserPhase11Samples } from './fixtures/parserPhase11Samples.js';
import { gap4KingmakerAnnouncement } from './fixtures/gap4Kingmaker.js';

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

describe('parseDiscordAnnouncement — labelAliases (DEB-052-02)', () => {
  it('rotulo de sistema desconhecido nao e reconhecido sem alias aprendido', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Mesa sem título',
        content_raw: 'Jogo do dia: Vampiro: A Máscara\nVagas: 3',
      }),
    );

    expect(draft?.table?.system_name ?? null).not.toBe('Vampiro: A Máscara');
  });

  it('rotulo aprendido via label_alias passa a ser reconhecido pelo campo system_name', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Mesa sem título',
        content_raw: 'Jogo do dia: Vampiro: A Máscara\nVagas: 3',
      }),
      [],
      undefined,
      undefined,
      { system_name: ['jogo do dia'] },
    );

    expect(draft?.table?.system_name).toBe('Vampiro: A Máscara');
  });

  it('consome aliases aprendidos de vagas, preço e descrição', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Cadeiras livres: 3',
          'Contribuição da aventura: 30',
          'Enredo compartilhado: Uma investigação no litoral.',
        ].join('\n'),
      }),
      [],
      undefined,
      undefined,
      {
        slots_open: ['cadeiras livres'],
        price_value: ['contribuição da aventura'],
        description: ['enredo compartilhado'],
      },
    );

    expect(draft?.table.slots_open).toBe(3);
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value).toBe(30);
    expect(draft?.table.description).toBe('Uma investigação no litoral.');
  });

  it('alias aprendido de contato confirma URL de domínio desconhecido', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Canal do narrador: https://dm.example/join\nVagas: 3' }),
      [],
      undefined,
      undefined,
      { contact_url: ['canal do narrador'] },
    );

    expect(draft?.table.contact_url).toBe('https://dm.example/join');
    expect(draft?.missing_fields).not.toContain('contact_url:unconfirmed');
  });
});

describe('parseDiscordAnnouncement — requisitos técnicos conservadores', () => {
  it('captura obrigação explícita de PC e microfone por sinais do corpus real', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: 'Plataformas: Discord e Foundry\nNecessário ter PC. Ter um microfone com qualidade aceitável.',
    }));

    expect(draft?.table.requires_pc).toBe(true);
    expect(draft?.table.requires_microphone).toBe(true);
    expect(draft?.table.requires_camera).toBeNull();
  });

  it('preserva falso explícito para requisito opcional ou não obrigatório', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: 'Não sendo obrigatório ter um PC, mas desejável. Câmera opcional.',
    }));

    expect(draft?.table.requires_pc).toBe(false);
    expect(draft?.table.requires_camera).toBe(false);
  });

  it('infere PC obrigatório por VTT detectado e microfone obrigatório por Discord detectado (achado do mantenedor 2026-07-16)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Plataformas: Discord e Foundry\nVagas: 4' }),
      [],
      undefined,
      {
        vtt: [{ id: 'foundry', name: 'Foundry VTT', aliases: ['Foundry'] }],
        communication: [{ id: 'discord', name: 'Discord', aliases: [] }],
      },
    );

    expect(draft?.table.vtt_platform_id).toBe('foundry');
    expect(draft?.table.communication_platform_id).toBe('discord');
    // VTT sempre roda em navegador/app desktop — exige computador estrutural,
    // mesmo sem menção textual explícita ("necessário ter PC").
    expect(draft?.table.requires_pc).toBe(true);
    // Discord como plataforma de comunicação implica chamada de voz — exige
    // microfone estrutural, mesmo sem menção textual explícita.
    expect(draft?.table.requires_microphone).toBe(true);
  });

  it('reconhece "Roll 20" (com espaço, texto livre) contra alias "Roll20" (sem espaço, catálogo) — achado real do mantenedor 2026-07-17, anúncio "Ātman: Nowhere kings"', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Plataformas: Discord e Roll 20 (necessário PC)\nVagas: 4' }),
      [],
      undefined,
      {
        vtt: [{ id: 'roll20', name: 'Roll20', aliases: [] }],
        communication: [{ id: 'discord', name: 'Discord', aliases: [] }],
      },
    );

    expect(draft?.table.vtt_platform_id).toBe('roll20');
    expect(draft?.table.communication_platform_id).toBe('discord');
  });

  it('não cola letra+dígito de plataformas distintas em falso positivo (ex.: "Discord e Roll20" nunca vira match de "discorderoll20")', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Plataformas: Discord e Roll 20\nVagas: 4' }),
      [],
      undefined,
      { vtt: [{ id: 'fake', name: 'DiscordeRoll20', aliases: [] }], communication: [] },
    );

    expect(draft?.table.vtt_platform_id).toBeNull();
  });

  it('extrai rules_notes ("Regras da mesa") do texto colado — achado real do mantenedor 2026-07-17, campo existia só no form manual', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Título: Ātman: Nowhere kings',
          'Sistema: Nobilis 2ed',
          '### Regras da mesa:',
          '1. Respeito acima de tudo',
          '2. Foco narrativo',
          '4. Compromisso com as sessões',
          '5. Comunicação aberta',
          '### - Sinopse da História:',
          '> Há, por trás do mundo ordinário, uma realidade mais profunda.',
        ].join('\n'),
      }),
      [],
    );

    expect(draft?.table.rules_notes).toContain('Respeito acima de tudo');
    expect(draft?.table.rules_notes).toContain('Comunicação aberta');
    expect(draft?.table.rules_notes).not.toContain('Sinopse');
  });

  it('texto explícito continua tendo prioridade sobre a inferência por VTT/Discord', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Plataformas: Discord e Foundry\nNão é necessário ter PC, jogamos por celular.\nVagas: 4' }),
      [],
      undefined,
      {
        vtt: [{ id: 'foundry', name: 'Foundry VTT', aliases: ['Foundry'] }],
        communication: [{ id: 'discord', name: 'Discord', aliases: [] }],
      },
    );

    // Negação explícita no texto vence a inferência estrutural do VTT.
    expect(draft?.table.requires_pc).toBe(false);
    expect(draft?.table.requires_microphone).toBe(true);
  });

  it('sinal contraditório não escolhe lado e força revisão', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: 'PC não obrigatório; para esta modalidade, computador obrigatório.',
    }));

    expect(draft?.table.requires_pc).toBeNull();
    expect(draft?.missing_fields).toContain('requires_pc:ambiguous');
    expect(draft?.table._notes).toContain('Requisito de PC contraditório — revisar manualmente.');
  });

  it('captura abreviação MIC acompanhada de qualidade exigida', () => {
    const draft = parseDiscordAnnouncement(makeMessage({ content_raw: 'Requisito: um MIC audível.' }));
    expect(draft?.table.requires_microphone).toBe(true);
  });
});

describe('normalizeTitleCapitalization — stopword apos pontuacao de clausula (CodeRabbit PR #144)', () => {
  it('titulo com stopword logo apos ":" preserva capitalizacao de inicio de clausula, nao rebaixa pra minusculo', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Sistema: A Lenda dos Cinco Anéis',
        content_raw: 'Vagas: 3',
      }),
    );

    expect(draft?.table?.title).toContain('A Lenda');
    expect(draft?.table?.title).not.toContain('a Lenda');
  });
});

describe('parseDiscordAnnouncement', () => {
  it('limpa markdown real da descrição sem corromper slugs, URLs e underscores legítimos', () => {
    expect(cleanDescriptionText('**Descrição:** inscricao_mesa d_and_d https://site.test/a_b `ok`')).toBe(
      'Descrição: inscricao_mesa d_and_d https://site.test/a_b ok',
    );
  });

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

  // Bug real medido em produção (2026-08-11): duas mesas importadas gravaram
  // `contact_url` com marcação markdown grudada — `)__` e `**` — e o botão de
  // inscrição não chegava ao Google Forms. `)`/`]` desbalanceados já eram
  // removidos; ênfase (`*`/`_`/`~`/crase) não era.
  it.each([
    ['[Inscrição](https://forms.gle/mVvUiUTq7Z5yJTWT9)__', 'link markdown seguido de ênfase'],
    ['**https://forms.gle/b3uwFZeGNLQViQ1U7**', 'ênfase não pareada envolvendo a URL'],
    ['https://forms.gle/mVvUiUTq7Z5yJTWT9)__.', 'ênfase, parêntese e pontuação final'],
    ['~~https://forms.gle/b3uwFZeGNLQViQ1U7~~', 'strikethrough'],
    ['`https://forms.gle/b3uwFZeGNLQViQ1U7`', 'code span'],
  ])('limpa marcação markdown grudada na contact_url (%s)', (contatoRaw) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Dungeons & Dragons',
          'Mesa: A Torre dos Tres Sabores',
          'Tipo: Campanha',
          'Modalidade: Online',
          'Vagas: 4',
          `Contato: ${contatoRaw}`,
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_url).toMatch(/^https:\/\/forms\.gle\/[A-Za-z0-9]+$/);
    expect(draft?.missing_fields).not.toContain('contact_url:suspicious');
  });

  // Relato do mantenedor (2026-08-11, draft "Blue Lock - Awakening"): a imagem
  // do embed do anúncio virou `contact_url` e passou como "link válido" — a
  // URL é bem formada, e a validação só olhava forma, nunca função. Já tinha
  // acontecido com YouTube e Spotify.
  it.each([
    ['https://i.pinimg.com/736x/48/08/4b/48084b3c88077a68eda0c950aced01c6.jpg', 'imagem do Pinterest'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'vídeo do YouTube'],
    ['https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'playlist do Spotify'],
    ['https://cdn.discordapp.com/attachments/1/2/banner.png', 'anexo do Discord'],
    ['https://exemplo.com/regras-da-mesa.pdf', 'PDF de material'],
  ])('não elege %s como contact_url', (midiaUrl) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Fate Core',
          'Mesa: Blue Lock Awakening',
          'Tipo: Campanha',
          'Modalidade: Online',
          'Vagas: 4',
          `Capa: ${midiaUrl}`,
        ].join('\n'),
      }),
    );

    // A mídia não ocupa o campo. Não afirmamos sobre `missing_fields` aqui: o
    // fixture usa label "Capa:", que segue outro caminho de extração — o que
    // este teste garante é que a URL de mídia nunca vira contato.
    expect(draft?.table.contact_url).toBeNull();
  });

  // A mídia sai da disputa, e o formulário real — que aparece DEPOIS dela no
  // texto — passa a ser eleito. Antes, `allMatches[0]` entregava a imagem.
  it('elege o formulário real quando há mídia antes dele no anúncio', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Fate Core',
          'Mesa: Blue Lock Awakening',
          'Tipo: Campanha',
          'Modalidade: Online',
          'Vagas: 4',
          'Capa: https://i.pinimg.com/736x/48/08/4b/48084b3c88077a68eda0c950aced01c6.jpg',
          'Inscrição: https://forms.gle/mVvUiUTq7Z5yJTWT9',
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_url).toBe('https://forms.gle/mVvUiUTq7Z5yJTWT9');
  });

  // O ramo de label APRENDIDO (`labelAliases.contact_url`) pulava o filtro de
  // mídia e ainda devolvia `confident: true`, que suprime a marcação de
  // revisão. Label aprendido diz onde olhar, não que a URL serve.
  it('ignora mídia na linha do label aprendido e devolve o formulário', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Fate Core',
          'Mesa: Blue Lock Awakening',
          'Modalidade: Online',
          'Vagas: 4',
          'Ficha de interesse: https://i.pinimg.com/736x/48/08/4b/48084b3c.jpg https://forms.gle/mVvUiUTq7Z5yJTWT9',
        ].join('\n'),
      }),
      [],
      undefined,
      undefined,
      { contact_url: ['ficha de interesse'] },
    );

    expect(draft?.table.contact_url).toBe('https://forms.gle/mVvUiUTq7Z5yJTWT9');
    expect(draft?.missing_fields).not.toContain('contact_url:suspicious');
  });

  // Não virou allowlist de domínio: o achado de 2026-07-10 (site pessoal de GM
  // bloqueado indevidamente) continua valendo, e o filtro novo só recusa por
  // evidência positiva de mídia.
  it('mantém site pessoal de GM como contact_url válida', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Fate Core',
          'Mesa: Mesa do Yan',
          'Tipo: Campanha',
          'Modalidade: Online',
          'Vagas: 4',
          'Contato: https://dm.yanbraga.com/join',
        ].join('\n'),
      }),
    );

    expect(draft?.table.contact_url).toBe('https://dm.yanbraga.com/join');
    expect(draft?.missing_fields).not.toContain('contact_url:suspicious');
  });

  // Relato do mantenedor (2026-08-11, draft "Pokémon Mystery Dungeon"): o
  // título veio como "369323334355255297" — o snowflake do mestre, idêntico a
  // `host_discord_id` e à menção em `_raw_evidence.user_mentions`. Duas causas
  // somadas: "Título da Campanha:" não era label reconhecido (caiu no fallback
  // de thread-name) e nada recusava snowflake como título.
  it('reconhece "Título da Campanha:" como label de título', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '<@369323334355255297>',
        content_raw: [
          '<@369323334355255297>',
          'Título da Campanha: Pokémon Mystery Dungeon: O Silêncio Vindo do Céu',
          'Sistema: Pokémon RPG',
          'Modalidade: Online',
          'Vagas: 3',
          'Dias da mesa: Segunda-Feira',
        ].join('\n'),
      }),
    );

    expect(draft?.table.title).toBe('Pokémon Mystery Dungeon: O Silêncio Vindo do Céu');
  });

  it.each([
    ['<@369323334355255297>', 'menção de usuário'],
    ['<@!369323334355255297>', 'menção de usuário com apelido'],
    ['<@&369323334355255297>', 'menção de cargo'],
    ['<#1012065641282404481>', 'menção de canal'],
    ['<t:1754870400:F>', 'timestamp'],
    ['369323334355255297', 'snowflake solto'],
  ])('nunca usa %s como título (%s)', (threadName) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: threadName,
        content_raw: ['Sistema: Pokémon RPG', 'Modalidade: Online', 'Vagas: 3'].join('\n'),
      }),
    );

    // `null` é o resultado desejado: token cru do Discord não tem nome legível,
    // então o draft cai em revisão pedindo o nome real da mesa.
    expect(draft?.table.title).toBeNull();
  });

  // O piso de 17 dígitos existe para não recusar título legitimamente numérico.
  it('mantém título numérico curto e legítimo', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Mesa: 1974',
          'Sistema: Ordem Paranormal',
          'Modalidade: Online',
          'Vagas: 4',
        ].join('\n'),
      }),
    );

    expect(draft?.table.title).toBe('1974');
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

  it('keeps Vagas: 0/6 ambiguous because it may mean open/total or filled/total', () => {
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

  it('keeps an unqualified 5/5 pair ambiguous despite equal numbers', () => {
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

  // Semântica vem do rótulo, não da ordem/tamanho dos números.
  it('resolves composite label "Vagas Disponíveis: N/M" as open/total', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '**📌Dia/Horário:** Terça, às 19h:30min.',
          '**📌Vagas Disponíveis:** 1/4',
          '**📌Sistema:** T20 JdA',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.slots_open).toBe(1);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('resolves composite label "Vagas Ocupadas: N/M" as filled/total', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '- **Sistema**: Dungeons & Dragons 5e',
          '- **Vagas Ocupadas**: 0/6 atualmente (mínimo 4 jogadores)',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(6);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('does not treat a single filled count as open capacity', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas ocupadas: 2\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBeNull();
    expect(draft?.table.slots_open).toBeNull();
  });

  it('resolves symbol bullet "» Vagas disponíveis: N/M" by the canonical pair rule', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '» Sistema: Ordem Paranormal',
          '» Vagas disponíveis: 4/6 (2 vagas)',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(4);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it.each([
    ['__**VAGAS:**__ 2/5', 5, 2, 5],
    ['**▬ Nº de Vagas: ** 1/4', 4, 1, 4],
    ['▬ Nº de Vagas: 4 / 5', 5, 4, 5],
    ['🔢 Vagas 1/5:', 5, 1, 5],
    ['**Quantas vagas:**Sexta-Feira 5/6', 6, 5, 6],
    ['- *Vagas:* 0/5', 5, 0, 5],
    ['» Vagas disponíveis: 4/1 Vagas Abertas', 4, 4, 1],
  ])('keeps decorated generic/conflicting slot pair %s ambiguous', (slotLine, total, first, second) => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: `${slotLine}\nSistema: D&D 5e\nContato: https://forms.gle/example` }),
    );

    expect(draft?.table.slots_total).toBe(total);
    expect(draft?.table.slots_open).toBeNull();
    expect(draft?.table._slots_ambiguity).toEqual({ first, second, source: 'x_slash_y' });
  });

  // — Fase 1 da spec 093 (R7, R8, R9): guard de data + qualificador "de M" —

  it('Gap 4 (anúncio Kingmaker sintético): "1 disponível de 4" vira {total:4, open:1}, não 25 nem {null,null}', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: gap4KingmakerAnnouncement }),
    );

    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.slots_open).toBe(1);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('Camada D: "2 abertas de 6" é lida como open/total', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 2 abertas de 6\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(2);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('Camada D: "3 ocupadas de 5" é lida como filled/total', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 3 ocupadas de 5\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBe(2);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('guard de data: "dia 25/08" em linha com "jogadores" não vira par de vaga', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\njogo já dia 25/08, os jogadores confirmados\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBeNull();
    expect(draft?.table.slots_open).toBeNull();
  });

  it('guard de data: "25/08/2026" (forma completa) não vira par de vaga', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nPróximo jogo dia 25/08/2026, aguardo os jogadores\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBeNull();
    expect(draft?.table.slots_open).toBeNull();
  });

  // Achado de review (PR #278): data sem zero à esquerda falhava o sinal 2 e
  // "Dia 25/8" virava slots_total:25.
  it('guard de data: "Dia 25/8" (mês sem zero à esquerda) não vira par de vaga', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nDia 25/8, os jogadores confirmados\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBeNull();
    expect(draft?.table.slots_open).toBeNull();
  });

  // Contraprova do guard acima: o sinal usa o PRIMEIRO número (dia do mês > 20),
  // não a faixa do segundo — senão este caso real (real.txt:179) seria rejeitado.
  it('guard de data NÃO rejeita "Participantes: 30/24", que é vaga legítima', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nParticipantes: 30/24 restando 6 vagas\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).not.toBeNull();
  });

  it('Camada C: entre dois pares "/", o semântico vence o genérico mesmo vindo depois', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 3/5\nVagas Ocupadas: 2/6\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(6);
    expect(draft?.table.slots_open).toBe(4);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('preserva "8/25" como par ambíguo (sem guard de faixa — sinal 3 descartado)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 8/25\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(25);
    expect(draft?.table.slots_open).toBeNull();
    expect(draft?.table._slots_ambiguity).toEqual({ first: 8, second: 25, source: 'x_slash_y' });
  });

  it('preserva "1 vaga / grupo de 5 pessoas" como open/total (slotsGroupSize)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 1 vaga / grupo de 5 pessoas\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBe(1);
    expect(draft?.table._slots_ambiguity).toBeNull();
  });

  it('não regride: "Participantes: 30/24 restando 6 vagas" segue ambíguo (30/24)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\n▬ Participantes: 30/24 restando 6 vagas.\nContato: https://forms.gle/example' }),
    );

    expect(draft?.table.slots_total).toBe(30);
    expect(draft?.table.slots_open).toBeNull();
    expect(draft?.table._slots_ambiguity).toEqual({ first: 30, second: 24, source: 'x_slash_y' });
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

  it('extracts raw_gm_name as text from Mestre/Narrador/GM/DM label (requisito 7, spec 079)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** Dungeons & Dragons',
          '▬ **Mestre:** Mariana',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.raw_gm_name).toBe('Mariana');
  });

  it('raw_gm_name captures free text even when publisher note explains they are not the GM (achado real: "Narrador: um conhecido meu, apenas estou postando por ele")', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          '▬ **Sistema:** City of Mist',
          '▬ **Narrador:** um conhecido meu, apenas estou postando por ele',
          '▬ **Data & Horário:** Segunda-feira das 20h às 00h',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.raw_gm_name).toBe('um conhecido meu, apenas estou postando por ele');
  });

  it('raw_gm_name is null when the value is only a Discord mention (covered by host_discord_id instead)', () => {
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

    expect(draft?.table.raw_gm_name).toBeNull();
    expect(draft?.table.host_discord_id).toBe('225275653333843970');
  });

  it('keeps raw_gm_name null without a host label (regression: field stays optional)', () => {
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

    expect(draft?.table.raw_gm_name).toBeNull();
  });

  it('preserves generic slash ambiguity during normalization', () => {
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

    expect(normalized.draft.table.slots_total).toBe(6);
    expect(normalized.draft.table.slots_open).toBeNull();
    expect(normalized.draft.missing_fields).toContain('slots_open:ambiguous_x_of_y');
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

  it('detects system in label-newline-value format without ":" (DEB-058-04, spec 058 Fase A)', () => {
    const systems = [
      { id: 'pf2e', name: 'Pathfinder 2e', name_pt: null, aliases: ['Pathfinder Segunda Edição'] },
    ];

    // Caso real que disparou a investigação: draft "Ruins of Gauntlight" — texto
    // colado de WordPress/site, label numa linha, valor na linha seguinte, sem ':'.
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Abomination Vaults: Ruins of Gauntlight',
        content_raw: [
          'Sistema',
          'Pathfinder 2e',
          'Dias e horários da mesa',
          'Aos sábados, horarios a combinar',
          'Vagas disponíveis',
          '4 Vagas.',
          'https://forms.gle/example',
        ].join('\n'),
      }),
      systems,
    );

    expect(draft?.table.system_id).toBe('pf2e');
  });

  it('extracts vtt_platform_id, communication_platform_id, age_rating and setting fields from Ruins of Gauntlight example (Fase B/C, spec 058)', () => {
    const systems = [
      { id: 'pf2e', name: 'Pathfinder 2e', name_pt: null, aliases: [] },
    ];
    const vttPlatforms = [{ id: 'foundry', name: 'Foundry VTT', aliases: [] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];

    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Abomination Vaults: Ruins of Gauntlight',
        content_raw: [
          'Sistema',
          'Pathfinder 2e',
          'Classificação Indicativa',
          '+18',
          'Plataformas',
          'Foundry VTT, Discord',
          'Estilo: Fantasia / Investigação / Mistério',
        ].join('\n'),
      }),
      systems,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.age_rating).toBe('+18');
    expect(draft?.table.setting_styles).toEqual(['Fantasia', 'Investigação', 'Mistério']);
  });

  // — Fase 3 da spec 093: rótulo "Tema(s)", aliases e normalização de setting_styles —

  it('reconhece "Tema(s): a, b, c" como setting_styles capitalizado e remove o rótulo da descrição (R10/R19)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Tema(s): a, b, c',
          'Vagas: 4',
          '',
          'Uma campanha épica de exploração.',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.setting_styles).toEqual(['A', 'B', 'C']);
    expect(draft?.table.description).toContain('Uma campanha épica');
    expect(draft?.table.description).not.toContain('Tema(s)');
  });

  it('reconhece "Tema" e "Temas" como sinônimos de estilo, preservando preposição interna (R10/R19)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Tema: exploração, gestão de reino, fatia de vida',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.setting_styles).toEqual(['Exploração', 'Gestão de Reino', 'Fatia de Vida']);
  });

  it('separa multi-valores por • · & e remove menção crua de role (R20)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Estilo: dark fantasy • exploração & sword <@&1012065638598049918>',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.setting_styles).toEqual(['Dark Fantasy', 'Exploração', 'Sword']);
  });

  // Achado real (review PR #280, codex, P2): `\s*&\s*` partia nome composto —
  // "D&D" virava ["D","D"]. O separador exige espaco dos dois lados.
  it('nao parte nome composto com & colado (D&D, Hack&Slash), mas ainda separa " & "', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Estilo: Hack&Slash & dark fantasy',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.setting_styles).toEqual(['Hack&Slash', 'Dark Fantasy']);
  });

  // Achado real (review PR #280, coderabbit, inline): a sigla precisa sobreviver ao
  // split E a normalizacao — "D&D" nao pode virar "D&d" ao ser gravada.
  it('preserva sigla D&D como estilo, separando so o & isolado', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Pathfinder',
          'Estilo: D&D & Hack&Slash',
          'Vagas: 4',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.setting_styles).toEqual(['D&D', 'Hack&Slash']);
  });

  it('remove "Classificação Indicativa" da descrição (Gap 5 segundo sintoma, spec 093)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Classificação Indicativa: +18',
          'Vagas: 4',
          '',
          'Uma aventura sombria.',
          'Contato: https://forms.gle/example',
        ].join('\n'),
      }),
    );

    expect(draft?.table.age_rating).toBe('+18');
    expect(draft?.table.description).toContain('Uma aventura sombria');
    expect(draft?.table.description).not.toMatch(/Classifica[çc][ãa]o Indicativa/i);
  });

  it('reconhece "Fantasy Grounds Classic" como fantasy-grounds-unity via alias (R4, spec 093)', () => {
    const vttPlatforms = [
      { id: 'fantasy-grounds-unity', name: 'Fantasy Grounds Unity', aliases: ['Fantasy Grounds', 'FGU', 'FGC', 'Fantasy Grounds Classic'] },
      { id: 'foundry-vtt', name: 'Foundry VTT', aliases: ['Foundry', 'FoundryVTT'] },
    ];
    const communicationPlatforms = [{ id: 'discord', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Plataformas: Fantasy Grounds Classic, Discord\nVagas: 4\nSistema: D&D 5e',
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe('fantasy-grounds-unity');
  });

  it.each([
    ['Roll 20', 'roll20'],
    ['Tale Spire', 'talespire'],
    ['QuestPortal', 'quest-portal'],
    ['Table Plop', 'tableplop'],
  ])('reconhece o alias "%s" como %s (R3, spec 093)', (alias, expectedId) => {
    const vttPlatforms = [
      { id: 'roll20', name: 'Roll20', aliases: ['Roll 20'] },
      { id: 'talespire', name: 'TaleSpire', aliases: ['Tale Spire'] },
      { id: 'quest-portal', name: 'Quest Portal', aliases: ['QuestPortal'] },
      { id: 'tableplop', name: 'Tableplop', aliases: ['Table Plop'] },
    ];
    const communicationPlatforms = [{ id: 'discord', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: `Plataformas: ${alias}, Discord\nVagas: 4\nSistema: D&D 5e`,
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe(expectedId);
  });

  it.each([
    ['Meet', 'google-meet'],
    ['Teams', 'microsoft-teams'],
  ])('reconhece o alias de comunicação "%s" como %s (R16, spec 093)', (alias, expectedId) => {
    const vttPlatforms: { id: string; name: string; aliases: string[] }[] = [];
    const communicationPlatforms = [
      { id: 'discord', name: 'Discord', aliases: [] },
      { id: 'google-meet', name: 'Google Meet', aliases: ['Meet'] },
      { id: 'microsoft-teams', name: 'Microsoft Teams', aliases: ['Teams'] },
    ];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: `Plataformas: ${alias}\nVagas: 4\nSistema: D&D 5e`,
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.communication_platform_id).toBe(expectedId);
  });

  it('trata faixa etária acima de 18 (ex.: "20+") como +18 — não existe faixa mais restrita no enum (achado do mantenedor 2026-07-16)', () => {
    const draft = parseDiscordAnnouncement(makeMessage({ content_raw: 'Faixa Etária: 20+\nVagas: 4' }));
    expect(draft?.table.age_rating).toBe('+18');
  });

  it('marca day_of_week como "to_define" quando dia e horário estão explicitamente "a decidir com os jogadores" (caso real "As Crônicas do Norte", achado 2026-07-16)', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: [
        'Sistema: Dharma + (suplemento de Everlast)',
        'Dias e horários da mesa: A decidir com os jogadores!',
        'Vagas disponíveis: 3',
        'Classificação Indicativa: +16',
        'Plataformas: Discord e Owlbear Rodeo',
      ].join('\n'),
    }));
    expect(draft?.table.day_of_week).toBe('to_define');
    expect(draft?.table.start_time).toBeNull();
  });

  // Achados do mantenedor (2026-08-31, anúncio real "Ameaça sob Otari"): o
  // texto declarava "dia da semana a definir, 8 às 11 horas da manhã" e o
  // parser devolvia day_of_week=null E start_time=null — perdendo as DUAS
  // informações que o mestre havia escrito. Dois defeitos independentes: o
  // interposto "da semana" quebrava os padrões de sentinela, e a hora por
  // extenso não batia com nenhum dos dois formatos aceitos ("19h"/"19:00").
  describe('agenda: "a definir" com interposto e hora por extenso', () => {
    const OTARI = 'Dia e horário: dia da semana a definir, 8 às 11 horas da manhã\nVagas: 2';

    it('"dia da semana a definir" marca to_define (o interposto fazia os padrões falharem)', () => {
      const draft = parseDiscordAnnouncement(makeMessage({ content_raw: OTARI }));
      expect(draft?.table.day_of_week).toBe('to_define');
    });

    it('hora por extenso ("8 às 11 horas") vira start_time — o início do intervalo', () => {
      const draft = parseDiscordAnnouncement(makeMessage({ content_raw: OTARI }));
      expect(draft?.table.start_time).toBe('08:00');
    });

    it('"das 19 às 23 horas" captura o início, não o fim', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Sessões quintas, das 19 às 23 horas\nVagas: 4',
      }));
      expect(draft?.table.start_time).toBe('19:00');
    });

    it('"sem dia fixo" é sentinela, e o horário do mesmo texto é preservado', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Data e Hora: Sem dia Fixo porém sempre as 19h\nVagas: 3',
      }));
      expect(draft?.table.day_of_week).toBe('to_define');
      expect(draft?.table.start_time).toBe('19:00');
    });

    // Duracao vs horario: "N horas" serve para os dois, e o parser so pode
    // gravar `start_time` quando o texto marca HORARIO. Tres guards, um por
    // forma de duracao que ja produziu horario inventado:
    //  - hora avulsa sem marcador ("de 3 horas") — achado Codex P1;
    //  - faixa ligada por "a"/"ate", que nao sao marcadores ("de 3 a 5 horas");
    //  - valor fora de 0-23 ("24 horas").
    // Horario inventado e pior que campo vazio: alem de errado, tira o campo
    // dos avisos de revisao do importador, entao ninguem confere.
    it.each([
      ['hora avulsa sem marcador', 'Sessões de 3 horas de duração'],
      ['faixa ligada por "a"', 'Sessões de 3 a 5 horas de duração'],
      ['faixa ligada por "até"', 'Mesas de 2 até 4 horas'],
      ['valor fora de 0-23', 'Maratona de 24 horas de campanha'],
    ])('duração (%s) não vira start_time', (_caso, texto) => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: `${texto}\nVagas: 4`,
      }));
      expect(draft?.table.start_time).toBeNull();
    });

    // O outro lado do mesmo guard: restringir o conector nao pode calar o
    // horario real. "ate" aparece como conector legitimo na fixture, sempre
    // com a hora em formato de relogio — que o padrao de relogio resolve antes.
    it.each([
      ['duração antes do horário', 'Sessões de 4 horas, as 20 horas', '20:00'],
      ['"até" com hora de relógio', 'Segundas-feiras das 20h até às 23:30h', '20:00'],
    ])('horário real é lido (%s)', (_caso, texto, esperado) => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: `${texto}\nVagas: 4`,
      }));
      expect(draft?.table.start_time).toBe(esperado);
    });


    // Achados de review (PR #300), os tres na mesma area de agenda.
    it('hora invalida no meio do texto nao descarta o horario valido seguinte', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Erro de digitacao 99h, o certo e 20h\nVagas: 4',
      }));
      expect(draft?.table.start_time).toBe('20:00');
    });

    it('"as" no fim de palavra nao vira marcador de horario', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Aulas 3 horas por semana\nVagas: 4',
      }));
      expect(draft?.table.start_time).toBeNull();
    });

    it('"sem horario fixo" nao marca o DIA como a definir', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Sistema: D&D 5e\nSem horario fixo, combinamos no grupo\nVagas: 4',
      }));
      expect(draft?.table.day_of_week).toBeNull();
    });

    it('"sem dia fixo" continua marcando o dia como a definir', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Sem dia fixo, combinamos no grupo\nVagas: 4',
      }));
      expect(draft?.table.day_of_week).toBe('to_define');
    });

    it('"vou definir a data depois" NÃO é sentinela (frase livre, não declaração)', () => {
      const draft = parseDiscordAnnouncement(makeMessage({
        content_raw: 'Ainda vou definir a data depois de fechar o elenco\nVagas: 4',
      }));
      expect(draft?.table.day_of_week).toBeNull();
    });
  });

  it('assume slots_total=5 quando só slots_open é declarado (achado 2026-07-16, mesmo caso "As Crônicas do Norte")', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: 'Vagas disponíveis: 3\nSistema: D&D 5e',
    }));
    expect(draft?.table.slots_open).toBe(3);
    expect(draft?.table.slots_total).toBe(5);
  });

  it('reconhece typo de plataforma via fuzzy matching (ex.: "owbear" → Owlbear Rodeo, achado do mantenedor 2026-07-16, caso real "Duskwood")', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Plataformas: Discord, owbear\nVagas: 4\nSistema: D&D 5e',
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );
    expect(draft?.table.vtt_platform_id).toBe('owlbear');
  });

  it('não aplica fuzzy matching quando a similaridade é baixa demais (evita falso positivo)', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Plataformas: Zoom\nVagas: 4\nSistema: D&D 5e',
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );
    expect(draft?.table.vtt_platform_id).toBeNull();
  });

  it('não aplica fuzzy matching no corpo inteiro quando não há label de plataforma (achado Codex, PR #171: falso positivo em texto livre)', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    // "Owlbear" (7 chars) tem similaridade alta com "sobrevivência"/outros tokens
    // longos do corpo livre por acaso — sem label "Plataformas:" dedicado, o fuzzy
    // não deve rodar contra fullText, só o match exato (que aqui não existe).
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Vagas: 4\nSistema: D&D 5e\nResumo: uma aventura de sobrevivência e suspense no pântano sombrio',
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );
    expect(draft?.table.vtt_platform_id).toBeNull();
  });

  // Relato do mantenedor (2026-08-11, draft "Digimon RPG - Neon Hounds"):
  // `vtt_platform_id: null` com `_vtt_source_hint: "Discord"`. O anúncio cita a
  // VTT numa linha DIFERENTE da de comunicação, e `platformsLabelValue` captura
  // só o primeiro label — a VTT nunca chegava a ser comparada com o catálogo.
  it('reconhece VTT citada fora da linha de plataformas (caso real "Neon Hounds")', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Digimon RPG',
          'Vagas: 4',
          'Plataforma: Discord',
          'Mapas e combate rodam no Owlbear Rodeo.',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe('owlbear');
    expect(draft?.table.communication_platform_id).toBe('discord-plat');
    // O hint tem de apontar o trecho que originou o match — gravar "Discord"
    // (o label) ensinaria ao learning que Discord é a VTT.
    expect(draft?.table._vtt_source_hint).toContain('Owlbear');
    expect(draft?.table._vtt_source_hint).not.toBe('Discord');
  });

  it('reconhece VTT em anúncio sem label "Plataforma:" dedicado', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: Digimon RPG',
          'Vagas: 4',
          'Usamos Owlbear Rodeo para os mapas.',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe('owlbear');
  });

  // Caso real relatado pelo mantenedor (2026-09-01, draft "Lua Branca",
  // aaf736bc-34d2-4383-a1ff-d3739ccffd6e): "Local: Discord + Owlbear Rodeo"
  // devolvia `vtt_platform_id: null`. Nenhum dos dois caminhos alcancava a
  // linha — nao ha label "Plataforma(s)", o rotulo e "Local" e nao "Local do
  // jogo", e a linha nao casa PLATFORM_CONTEXT_LINE_RE (medido: false), que
  // exige verbo de uso.
  it('reconhece VTT no rotulo "Local:" (sem "do jogo"), com a comunicacao na mesma linha', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Mesa Gratuita',
          'Sistema: D&D 5e',
          'Local: Discord + Owlbear Rodeo',
          'Vagas: 5',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe('owlbear');
    expect(draft?.table.communication_platform_id).toBe('discord-plat');
  });

  // "Local" puro entra por ULTIMO: quando o anuncio separa os dois labels, o
  // dedicado continua vencendo — senao a correcao acima quebraria o caso que a
  // PR #171 consertou ("Local do Jogo: Discord" + "Plataformas: Roll20").
  it('label "Plataforma(s)" dedicado ainda vence "Local"', () => {
    const vttPlatforms = [{ id: 'roll20', name: 'Roll20', aliases: [] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Local: Servidor proprio no Discord',
          'Plataformas: Roll20',
          'Vagas: 4',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    expect(draft?.table.vtt_platform_id).toBe('roll20');
  });

  // Mesa presencial nao vira falso positivo: o valor de "Local" continua
  // passando pelo catalogo, que nao casa endereco.
  it('"Local" com endereco presencial nao inventa VTT', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Local: Bar do Ze, rua das Flores 42',
          'Vagas: 5',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: [] },
    );

    expect(draft?.table.vtt_platform_id).toBeNull();
  });

  // "owlbear" como CRIATURA na sinopse não é plataforma. O que distingue os
  // dois usos está no texto (verbo de uso vs. narrativa), então o parser tem
  // de ler isso — não o revisor corrigir depois no painel.
  it('não confunde criatura na sinopse com VTT de mesmo nome', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: [
          'Sistema: D&D 5e',
          'Vagas: 4',
          'A party enfrenta um owlbear selvagem na floresta.',
        ].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: [] },
    );

    expect(draft?.table.vtt_platform_id).toBeNull();
  });

  it.each([
    ['Usamos Owlbear Rodeo para os mapas.', 'verbo de uso'],
    ['Os combates rodam no Owlbear Rodeo.', 'combate + verbo'],
    ['As sessões acontecem no Owlbear Rodeo.', 'sessão + local'],
    ['Mapas: Owlbear Rodeo', 'label de mapas'],
  ])('reconhece VTT em prosa com sinal de uso (%s)', (linha) => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: ['Sistema: D&D 5e', 'Vagas: 4', linha].join('\n'),
      }),
      [],
      undefined,
      { vtt: vttPlatforms, communication: [] },
    );

    expect(draft?.table.vtt_platform_id).toBe('owlbear');
  });

  it('extrai setting_name do label "Época" (sinônimo de ambientação, achado do mantenedor 2026-07-16, caso real "Duskwood")', () => {
    const draft = parseDiscordAnnouncement(makeMessage({
      content_raw: 'Época: atual\nVagas: 4\nSistema: D&D 5e',
    }));
    expect(draft?.table.setting_name).toBe('atual');
  });

  it('caso real completo "somewhere in Duskwood" (achado do mantenedor 2026-07-16, texto exato exportado do Discord, D:/teste [part 2].json) — fuzzy de plataforma, Época e menção sem link não contam como contato explícito', () => {
    const vttPlatforms = [{ id: 'owlbear', name: 'Owlbear Rodeo', aliases: ['Owlbear'] }];
    const communicationPlatforms = [{ id: 'discord-plat', name: 'Discord', aliases: [] }];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'somewhere in Duskwood',
        content_raw: [
          '# » Título:somewhere in Duskwood',
          ' ',
          '▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
          '» Sistema: +2D6 ',
          '',
          '» Dias e horários da mesa: Quarta - feira ',
          '20:00 - 22:00/23:00',
          '',
          '» Vagas disponíveis: 0/4',
          '',
          '» Classificação Indicativa: +16 ',
          '',
          '» Plataformas: Discord, owbear ',
          '',
          '» Regras & observações: ',
          '',
          'Respeito com todos, Sem metagame, sem avacalhar com o jogo dos outros jogadores, Deixar um ambiente confortável para todos, qualquer incômodo falar diretamente com o mestre para que possamos resolver o assunto.',
          '',
          '» Época: atual ',
          '',
          '» Estilo: Investigação, sobrevivência, suspense, terror ',
          '',
          '',
          '» Entrar em contato com: <@994729259153248256> ',
          '▬▬▬▬▬▬▬▬▬▬▬▬',
          '» Resumo da história:',
          'Um grupo de amigos Consegue finalmente um tempo de férias, para esquecer os problemas de trabalho, família etc.',
        ].join('\n'),
      }),
      undefined,
      undefined,
      { vtt: vttPlatforms, communication: communicationPlatforms },
    );

    // Fuzzy: "owbear" (typo) reconhece Owlbear Rodeo mesmo sem alias exato.
    expect(draft?.table.vtt_platform_id).toBe('owlbear');
    // "Época" reconhecida como sinônimo de ambientação/cenário.
    expect(draft?.table.setting_name).toBe('atual');
    // Menção <@id> preenche contact_discord (exibição), mas NÃO é link —
    // contact_url continua null. O filtro requireExplicitContact (utils.ts)
    // não deve tratar isso como contato usável.
    expect(draft?.table.contact_discord).toBe('<@994729259153248256>');
    expect(draft?.table.contact_url).toBeNull();
  });

  it('extracts explicit cadence (quinzenal) and infers type=campanha when missing (DEB-058 41% gap)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'Mesa sem tipo explícito',
        content_raw: 'Constância: Quinzenalmente\nSextas, 20h\nhttps://forms.gle/example',
      }),
    );

    expect(draft?.table.frequency).toBe('quinzenal');
    expect(draft?.table.type).toBe('campanha');
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

  // Achado do mantenedor (2026-08-31): a busca tem que descer como um humano
  // procura — sistema (nome ou alias), depois edição (nome ou alias), depois
  // variante. A travessia de `findSystemMatch` já fazia isso, mas parava na
  // edição quando o nome da VARIANTE era uma palavra de edição ("Remaster",
  // "Anniversary"): `normalizeSystemName` as tira da base por serem
  // qualificador, então o nó ficava sem baseTokens e sem editionTokens, dava
  // score 0 e era eliminado pelo filtro `score > 0`.
  //
  // Medido no catálogo de produção (`site/catalog_nodes`, a fonte real — não
  // `mesas_rpg.systems`, que é legada): 20 nós têm nome inteiramente composto
  // dessas palavras — 17 variantes + 3 edições, incluindo
  // `pathfinder/pathfinder--2e/remaster` e 16 ramos "Anniversary" de
  // Vampire/Mage/Shadowrun. Nenhum era alcançável, e o mestre escolhia na mão.
  //
  // Cadastrar alias resolveria UM nó; o defeito era do matcher e valia para os
  // 20 (só a variante `2024` do D&D tinha alias — daí "D&D 5.5" funcionar e
  // "Pathfinder 2e Remaster" não).
  describe('travessia até a variante quando o nome dela é palavra de edição', () => {
    const pathfinder = [
      { id: 'pf', name: 'Pathfinder', name_pt: null, aliases: ['PF', 'Pathfinder 2e'], node_type: 'system', parent_id: null },
      { id: 'pf-1e', name: '1e', name_pt: null, aliases: [], node_type: 'edition', parent_id: 'pf' },
      { id: 'pf-2e', name: '2e', name_pt: null, aliases: [], node_type: 'edition', parent_id: 'pf' },
      { id: 'pf-2e-rpg', name: 'Roleplaying Game', name_pt: null, aliases: [], node_type: 'variant', parent_id: 'pf-2e' },
      { id: 'pf-2e-remaster', name: 'Remaster', name_pt: null, aliases: [], node_type: 'variant', parent_id: 'pf-2e' },
    ];

    it('"Pathfinder 2e Remaster" chega na variante, sem alias cadastrado', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: Pathfinder 2e Remaster\nVagas: 4' }),
        pathfinder,
      );
      expect(draft?.table.system_id).toBe('pf-2e-remaster');
    });

    it('sem a palavra da variante, para na edição — não inventa a variante', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: Pathfinder 2e\nVagas: 4' }),
        pathfinder,
      );
      expect(draft?.table.system_id).toBe('pf-2e');
    });

    it('a edição errada não é escolhida pela palavra da variante', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: Pathfinder 1e\nVagas: 4' }),
        pathfinder,
      );
      expect(draft?.table.system_id).toBe('pf-1e');
    });

    // O mesmo caminho para "Anniversary", que se repete em 16 ramos do
    // catálogo — confirma que a correção é do matcher, não um caso especial
    // do Pathfinder.
    it('vale para "Anniversary", que se repete em vários sistemas', () => {
      const vampire = [
        { id: 'v', name: 'Vampire', name_pt: null, aliases: [], node_type: 'system', parent_id: null },
        { id: 'v-5e', name: '5e', name_pt: null, aliases: [], node_type: 'edition', parent_id: 'v' },
        { id: 'v-5e-anniv', name: 'Anniversary', name_pt: null, aliases: [], node_type: 'variant', parent_id: 'v-5e' },
      ];
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: Vampire 5e Anniversary\nVagas: 4' }),
        vampire,
      );
      expect(draft?.table.system_id).toBe('v-5e-anniv');
    });
  });

  it('prefers an exact edition before falling back to the parent system', () => {
    const systems = [
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'], node_type: 'system', parent_id: null },
      { id: 'dnd-5e', name: 'D&D 5e', name_pt: null, aliases: ['Dungeons & Dragons 5e'], node_type: 'edition', parent_id: 'dnd' },
      { id: 'dnd-2024', name: 'D&D 2024', name_pt: null, aliases: ['D&D 5.5e'], node_type: 'edition', parent_id: 'dnd' },
    ];
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: 'A Mina Perdida',
        content_raw: 'Sistema: Dungeons & Dragons 5e\nVagas: 4\nSexta 20h\nContato: https://forms.gle/example',
      }),
      systems,
    );

    expect(draft?.table.system_id).toBe('dnd-5e');
    expect(draft?.table.system_name).toBe('D&D 5e');
    expect(draft?.table._system_source_hint).toBe('Dungeons & Dragons 5e');
  });

  it('transports deterministic catalog alternatives below the selected system', () => {
    const systems = [
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D'], node_type: 'system', parent_id: null },
      { id: 'dnd-5e', name: 'D&D 5e', name_pt: null, aliases: ['Dungeons & Dragons 5e'], node_type: 'edition', parent_id: 'dnd' },
      { id: 'dnd-2024', name: 'D&D 2024', name_pt: null, aliases: ['D&D 5.5e'], node_type: 'edition', parent_id: 'dnd' },
    ];
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas: 4\nSexta 20h\nContato: https://forms.gle/example' }),
      systems,
    );

    expect(draft?.table._system_candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ system_id: 'dnd' }),
    ]));
    expect(draft?.table._system_candidates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ system_id: draft?.table.system_id }),
    ]));
  });

  it('prefers canonical acronym and edition over a colliding alias from another system', () => {
    const systems = [
      { id: 'gamma', name: 'Gamma World', name_pt: null, aliases: ['D&D'], node_type: 'system', parent_id: null },
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: [], node_type: 'system', parent_id: null },
      { id: 'dnd-5e', name: 'Dungeons & Dragons 5e', name_pt: null, aliases: [], node_type: 'edition', parent_id: 'dnd' },
    ];
    for (const spelling of ['D&D 5ª Edição', 'D&D 5e', 'D&D 5ed']) {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: `Sistema: ${spelling}\nVagas: 4\nSexta 20h\nContato: https://forms.gle/example` }),
        systems,
      );

      expect(draft?.table.system_id).toBe('dnd-5e');
      expect(draft?.table.system_name).toBe('Dungeons & Dragons 5e');
      expect(draft?.table._system_candidates).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ system_id: 'gamma' }),
      ]));
    }
  });

  it('resolves base token first and then an edition-only child inside that root', () => {
    const systems = [
      { id: 'gamma', name: 'Gamma World', name_pt: null, aliases: ['D&D'], node_type: 'system', parent_id: null, slug: 'gamma-world', path_slug: 'gamma-world' },
      { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: [], node_type: 'system', parent_id: null, slug: 'dnd', path_slug: 'dnd' },
      { id: 'dnd-5e', name: '5th Edition', name_pt: '5ª Edição', aliases: [], node_type: 'edition', parent_id: 'dnd', slug: '5e', path_slug: 'dnd/5e' },
    ];
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Sistema: D&D 5e\nVagas disponíveis: 2/6\nContato: https://forms.gle/example' }),
      systems,
    );

    expect(draft?.table.system_id).toBe('dnd-5e');
    expect(draft?.table.system_name).toBe('5th Edition');
    expect(draft?.table._system_candidates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ system_id: 'gamma' }),
    ]));
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

    // DEB-048-26 + correção 2026-07-07: quem publicou é o contato padrão, mas
    // usando o ID (snowflake, sempre mencionável/contactável) — nome de
    // exibição do servidor não serve pra contato real (achado do mantenedor).
    expect(draft?.table.contact_discord).toBe('author-999');
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

  describe('extractPrice/collectLabelContinuation/calcConfidence — fixture de regressão do corpus real (DEB-058-05, T9.9/T9.10/T9.11/T9.18)', () => {
    it('mesa paga com "sessão 0 gratuita" não vira gratuita, descrição não trunca no 1º parágrafo, confiança não bate 100% (caso real D:\\teste.json — Temporada de Fantasmas)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: [
            '# **Temporada de Fantasmas (Season of Ghosts)**',
            '',
            '***[Mesa paga]***',
            '',
            '- **Título**: Temporada de Fantasmas (Season of Ghosts)',
            '- **Sistema**: Pathfinder 2e remaster',
            '- **Dias e horários da mesa**: Sabados, Semanal / 18:00 até no minimo 22:00',
            '- **Plataforma**:Discord e Foundry vtt (Necessário PC',
            '- **Nivel**: 1-13',
            '- **Valor**: 30,00 Por Sessão (sessão 0 gratuita)',
            '- **Vagas**: 4',
            '- **Faixa Etária**: 16+',
            '',
            '## Sinopse',
            '',
            'A pequena cidade de Ribeirão Vimeiro tem um grande problema: **está amaldiçoada!**',
            '',
            'Quando um grupo de heróis acorda na floresta após um festival para celebrar o último dia da primavera e a chegada do verão — época conhecida localmente como o Festival da Encenação —, eles descobrem que sua cidade natal foi invadida por monstros, um clima estranho e fantasmas horripilantes. Mas essas manifestações do mal ancestral que ameaça Ribeirão Vimeiro não são nada comparadas aos segredos assustadores que aguardam para serem descobertos em...',
            '',
            '### **Temporada dos Fantasmas**',
          ].join('\n'),
        }),
      );

      expect(draft?.table.price_type).toBe('paga');
      expect(draft?.table.price_value).toBe(30);
      expect(draft?.table._price_ambiguity).toBe(false);
      expect(draft?.table.description).toContain('está amaldiçoada');
      expect(draft?.table.description).toContain('Ribeirão Vimeiro não são nada comparadas');
      // Sem ambiguidade real neste caso (preço resolvido com confiança, sem
      // conflito de sinais) — confiança alta é correta aqui. O ponto de
      // T9.11 é que ambiguidade REAL (testada em describe própria de
      // extractDiscordTimestamp/extractPrice conflitante) desconta, não que
      // todo draft tenha que ficar abaixo de 1.
      expect(draft?.table.description).not.toContain('Temporada dos Fantasmas');
      expect(draft?.confidence).toBeGreaterThan(0.85);
    });

    it('ambiguidade real (preço conflitante) desconta confiança — mesmo draft não pode bater 100% (T9.11)', () => {
      const withoutAmbiguity = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: D&D\nVagas: 4\nHorário: sábado 19h\nValor: R$ 30\nDescrição: uma aventura épica.' }),
      );
      const withAmbiguity = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: D&D\nVagas: 4\nHorário: sábado 19h\nMesa gratuita, mas cobramos mensalidade dos participantes\nDescrição: uma aventura épica.' }),
      );

      expect(withAmbiguity?.table._price_ambiguity).toBe(true);
      expect(withAmbiguity!.confidence).toBeLessThan(withoutAmbiguity!.confidence);
    });

    it('mantem labels explicitos de gratuidade como gratuita, sem virar ambiguidade', () => {
      const cases = [
        'Valor: gratuito',
        'Valor: sem custo',
        'sem pagamento',
        'nao e paga',
      ];

      for (const priceLine of cases) {
        const draft = parseDiscordAnnouncement(
          makeMessage({
            content_raw: `Sistema: DnD\nVagas: 4\nHorario: sabado 19h\n${priceLine}\nDescricao: aventura curta.`,
          }),
        );

        expect(draft?.table.price_type).toBe('gratuita');
        expect(draft?.table._price_ambiguity).toBe(false);
      }
    });

    it('descricao multi-paragrafo para antes de label solto seguinte', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: [
            'Sinopse',
            'Primeiro paragrafo da aventura.',
            '',
            'Vagas',
            '4',
            'Sistema',
            'DnD',
          ].join('\n'),
        }),
      );

      expect(draft?.table.description).toBe('Primeiro paragrafo da aventura.');
      expect(draft?.table.slots_total).toBe(4);
      expect(draft?.table.system_name).toBe('DnD');
    });
  });

  describe('extractType — cascata por evidência indireta (DEB-058-05, T9.13)', () => {
    it('reconhece campanha em andamento sem a palavra "campanha" (caso real D:\\teste.json — Daggerheart: As Witherlands)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: '▬** Sistema:** Daggerheart\n▬ **Vagas:** 1/6 - **Em andamento**\n▬ **Classificação:** +18 anos\n## Sinopse\nUma terra esquecida.',
        }),
      );
      expect(draft?.table.type).toBe('campanha');
    });

    it('reconhece campanha por número de sessões citado como duração ("4~6 Sessões")', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D 24\nDuração: 4~6 Sessões | Porta de entrada para uma campanha mais longa.\nVagas: 2/5',
        }),
      );
      expect(draft?.table.type).toBe('campanha');
    });

    it('não decide tipo sem nenhum sinal direto/indireto no corpo (fallback de thread_name é comportamento pré-existente separado)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          discord_thread_name: '',
          content_raw: 'Sistema: D&D\nVagas: 3\nHorário: sábado 19h\nSinopse: uma aventura qualquer.',
        }),
      );
      expect(draft?.table.type).toBeNull();
    });
  });

  describe('extractSlots — label específico vence sobre número solto (DEB-058-05, T9.15)', () => {
    it('regra explícita (não coincidência de ordem): "Vagas Totais: X" + "Vagas Disponíveis: Y" no mesmo anúncio resolve total=X, open=Y (caso real D:\\teste.json — DISCERNIR)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: '▬ **Sistema:** CAIN\n▬ **Vagas Totais:** 6\n▬ **Vagas Disponíveis:** 2\n▬ **Classificação Indicativa:** +18 anos',
        }),
      );
      expect(draft?.table.slots_total).toBe(6);
      expect(draft?.table.slots_open).toBe(2);
    });

    it('mesmo com vagas_open igual a vagas_total (mesa cheia de vagas), label específico continua correto (caso real — Heróis das Fronteiras)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: '▬**Sistema:** D&D 5.5e\n▬ **Vagas Totais:** 6\n▬ **Vagas Disponíveis:** 6\n▬ **Classificação Indicativa:** +18 anos',
        }),
      );
      expect(draft?.table.slots_total).toBe(6);
      expect(draft?.table.slots_open).toBe(6);
    });
  });

  describe('extractDiscordTimestamp — múltiplos horários marcam ambiguidade (DEB-058-05, T9.16)', () => {
    it('2 timestamps Discord com dia/horário diferentes marcam _schedule_ambiguity e entram em missing_fields (caso real D:\\teste.json — Ravenloft: Curse of Strahd)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D 24\nData & Horários:\n* Terça (<t:1783465200:t> - 20:00h). Quinzenal\n* Sábado (<t:1783803600:t> - 18:00h). Quinzenal\nVagas: 3/6',
        }),
      );
      expect(draft?.table._schedule_ambiguity).toBe(true);
      expect(draft?.missing_fields).toContain('day_of_week:multiple_schedules');
      expect(draft?.table._notes).toEqual(expect.arrayContaining([
        expect.stringContaining('Múltiplos horários detectados'),
      ]));
    });

    it('1 timestamp Discord único não marca ambiguidade', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D 24\nHorário: <t:1783465200:t>\nVagas: 3/6',
        }),
      );
      expect(draft?.table._schedule_ambiguity).toBe(false);
      expect(draft?.missing_fields).not.toContain('day_of_week:multiple_schedules');
    });

    it('mesmo timestamp repetido (dia/horário idêntico) não marca ambiguidade', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D 24\nHorário: <t:1783465200:t> (lembrete: <t:1783465200:R>)\nVagas: 3/6',
        }),
      );
      expect(draft?.table._schedule_ambiguity).toBe(false);
    });
  });

  describe('extractContactUrl — domínio conhecido de contato vence sobre link institucional (DEB-058-05, T9.17)', () => {
    // INVERTIDO em 2026-08-24 por decisão do mantenedor: MesaQuest é plataforma
    // CONCORRENTE de anúncio de mesas, não canal de recrutamento do Artifício.
    // Saiu de KNOWN_CONTACT_URL_PATTERNS e entrou em NON_RECRUITMENT_HOST_RE.
    // Até esta data o teste afirmava o oposto (prioriza MesaQuest), fixado pela
    // spec 058 T9.17 quando o domínio era lido só como "link de inscrição real".
    // O caso real (Ravenloft/Heróis de Thylea) é preservado de propósito: é a
    // evidência de que o parser precisa escolher entre duas URLs no mesmo texto.
    it('com múltiplas URLs, NÃO usa MesaQuest (concorrente) como contato — caso real D:\\teste.json (Ravenloft/Heróis de Thylea)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D 24\n[Diferenciais](https://docs.google.com/document/d/1CD9zEjDtaT_a8E19IOwNvt59j4z4N1rYkrB9ujME1AY/edit?usp=sharing)\nValores, candidatura e detalhes: https://mesaquest.com.br/mesas/01KW06F7Q679103K384ZH550SH\nVagas: 3/6',
        }),
      );
      expect(draft?.table.contact_url).not.toBe('https://mesaquest.com.br/mesas/01KW06F7Q679103K384ZH550SH');
    });

    it('URL de plataforma concorrente é recusada como contato (isSuspiciousUrl), para não contar como "contato confirmado" na importação', () => {
      expect(isSuspiciousUrl('https://mesaquest.com.br/mesas/01KW06F7Q679103K384ZH550SH')).toBe(true);
      expect(isSuspiciousUrl('https://startplaying.games/gm/algum-mestre')).toBe(true);
      expect(isSuspiciousUrl('https://www.startplaying.games/play/12345')).toBe(true);
      // Contraprova: os domínios de inscrição legítimos continuam passando.
      expect(isSuspiciousUrl('https://forms.gle/abc123')).toBe(false);
      expect(isSuspiciousUrl('https://discord.gg/abc123')).toBe(false);
    });

    it('prioriza linktr.ee sobre site institucional generico quando ambos aparecem', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D\nSite: https://sanctumveritatis.com/setentrional\nInscrições: https://linktr.ee/euviajanterpg\nVagas: 3/6',
        }),
      );
      expect(draft?.table.contact_url).toBe('https://linktr.ee/euviajanterpg');
    });

    it('sem URL conhecida, mantém comportamento antigo: pega a primeira URL do texto', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D\nSite: https://sanctumveritatis.com/setentrional\nVídeo: https://www.youtube.com/watch?v=fv_KvD2jmsk\nVagas: 3/6',
        }),
      );
      expect(draft?.table.contact_url).toBe('https://sanctumveritatis.com/setentrional');
    });

    it('CodeRabbit PR #144: URL solta sem domínio conhecido nem contexto de contato entra em missing_fields (unconfirmed), não vira ready cego', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D\nSite: https://sanctumveritatis.com/setentrional\nVídeo: https://www.youtube.com/watch?v=fv_KvD2jmsk\nVagas: 3/6',
        }),
      );
      expect(draft?.table.contact_url).toBe('https://sanctumveritatis.com/setentrional');
      expect(draft?.missing_fields).toContain('contact_url:unconfirmed');
    });

    it('URL sem domínio conhecido mas em linha com contexto de contato ("Inscrições:") não entra em unconfirmed', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: D&D\nInscrições: https://dm.yanbraga.com/join\nVagas: 3/6',
        }),
      );
      expect(draft?.table.contact_url).toBe('https://dm.yanbraga.com/join');
      expect(draft?.missing_fields).not.toContain('contact_url:unconfirmed');
    });

  describe('Fase 11 - descricao estruturada, tokens Discord, URL e experiencia', () => {
    it('fallback de descricao remove labels estruturados e preserva texto livre', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: [
            'Titulo: Onde as Mascaras Observam',
            'Sistema: DnD',
            'Estilo: misterio',
            'Vagas: 4',
            '',
            'A Expedicao:',
            'Os personagens chegam ao vale durante uma noite sem lua.',
            '',
            'Mestre: Fulano',
          ].join('\n'),
        }),
      );

      expect(draft?.table.description).toContain('A Expedicao:');
      expect(draft?.table.description).toContain('Os personagens chegam');
      expect(draft?.table.description).not.toContain('Sistema:');
      expect(draft?.table.description).not.toContain('Vagas:');
      expect(draft?.table.description).not.toContain('Mestre:');
    });

    it('descricao final remove mentions e timestamps Discord crus', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Aventura sombria <@&123456> <#987654> <t:1781647200:F>\nContato: <@123456>',
        }),
      );

      expect(draft?.table.description).toBe('Aventura sombria');
    });

    it('remove parenteses e colchetes sobrando de markdown-link na URL extraida', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: DnD\nVagas: 4\nInscricoes: [Sanctum](https://sanctumveritatis.com/setentrional)\nOutro: [Form](https://forms.gle/BJ1]',
        }),
      );

      expect(draft?.table.contact_url).toBe('https://forms.gle/BJ1');
    });

    it('remove wrappers finais intercalados de URL extraida', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: 'Sistema: DnD\nVagas: 4\nInscricoes: https://forms.gle/BJ1)]',
        }),
      );

      expect(draft?.table.contact_url).toBe('https://forms.gle/BJ1');
    });

    it('remove URL conhecida de contato da descricao quando ja virou contact_url', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: [
            'Sistema: DnD',
            'Vagas: 4',
            'Sinopse: Uma mesa investigativa.',
            'Inscricoes: https://forms.gle/teste123',
          ].join('\n'),
        }),
      );

      expect(draft?.table.contact_url).toBe('https://forms.gle/teste123');
      expect(draft?.table.description).toBe('Uma mesa investigativa.');
    });

    it('remove markdown-link de contato inteiro da descricao sem deixar wrapper quebrado', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({
          content_raw: [
            'Sistema: DnD',
            'Vagas: 4',
            'Sinopse: Uma mesa investigativa. Inscreva-se [Form](https://forms.gle/teste123)',
          ].join('\n'),
        }),
      );

      expect(draft?.table.contact_url).toBe('https://forms.gle/teste123');
      expect(draft?.table.description).toBe('Uma mesa investigativa. Inscreva-se');
      expect(draft?.table.description).not.toMatch(/\[[^\]]*\]\(|\[[^\]]*\]\(\)/);
    });

    it('extrai nivel de experiencia de jogador por sinal explicito', () => {
      const iniciante = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Iniciantes sao bem-vindos nesta aventura.' }),
      );
      const veterano = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Experiencia obrigatoria; nao recomendado para iniciante.' }),
      );

      expect(iniciante?.table.experience_level).toBe('iniciante');
      expect(veterano?.table.experience_level).toBe('veterano');
    });

    it('extrai complexidade da mesa por sinal explicito', () => {
      const iniciante = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Mesa para iniciantes com regras guiadas.' }),
      );
      const avancado = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Complexidade: avancado, combate tatico pesado.' }),
      );

      expect(iniciante?.table.table_level).toBe('iniciante');
      expect(avancado?.table.table_level).toBe('avancado');
    });

    it('resolve cenario por catalogo e preserva raw_scenario_hint quando nao casa', () => {
      const scenarios = [{ id: 'scenario-1', name: 'Forgotten Realms', aliases: ['Faerun'] }];
      const matched = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nCenario: Faerun\nVagas: 4\nSinopse: aventura.' }),
        [],
        undefined,
        { scenarios },
      );
      const unknown = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Sistema: DnD\nCenario: Mundo autoral de vidro\nVagas: 4\nSinopse: aventura.' }),
        [],
        undefined,
        { scenarios },
      );

      expect(matched?.table.scenario_id).toBe('scenario-1');
      expect(matched?.table.raw_scenario_hint).toBeNull();
      expect(unknown?.table.scenario_id).toBeNull();
      expect(unknown?.table.raw_scenario_hint).toBe('Mundo autoral de vidro');
    });

    it.each(parserPhase11Samples)('fixture sanitizada $source: $name', ({ message }) => {
      const draft = parseDiscordAnnouncement(message);
      expect(draft).not.toBeNull();
      expect(draft?.table.description).not.toMatch(/\b(?:Sistema|Vagas|Mestre|Estilo)\s*:/i);
      expect(draft?.table.description).not.toMatch(/<@[!&]?\d+>|<#\d+>|<t:\d+:[tTdDfFR]>/);
      if (draft?.table.contact_url) {
        expect(draft.table.contact_url).not.toMatch(/[)\]]$/);
      }
    });
  });
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

  // Achado do mantenedor (2026-07-10): allowlist deixou de ser gate de bloqueio —
  // site pessoal de GM real fora da lista curta não pode travar o draft de virar
  // 'ready'. Só URL malformada (sem esquema http/https, domínio inválido) é suspeita.
  it('URL bem formada fora da allowlist não é suspeita (site pessoal de GM)', () => {
    expect(isSuspiciousUrl('https://meusite.com/formulario')).toBe(false);
    expect(isSuspiciousUrl('https://bit.ly/abc')).toBe(false);
    expect(isSuspiciousUrl('https://tinyurl.com/xyz')).toBe(false);
    expect(isSuspiciousUrl('https://dm.yanbraga.com/join')).toBe(false);
  });

  it('URL malformada é suspeita', () => {
    expect(isSuspiciousUrl('ftp://meusite.com/formulario')).toBe(true);
    expect(isSuspiciousUrl('não é uma url')).toBe(true);
    expect(isSuspiciousUrl('javascript:alert(1)')).toBe(true);
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

    it('slotsViaLabel: rótulo genérico X/Y permanece ambíguo ("Lugares: 2/5")', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa\n» Lugares: 2/5\n» Data: Sexta 21h' }),
      );
      expect(draft?.table.slots_total).toBe(5);
      expect(draft?.table.slots_open).toBeNull();
      expect(draft?.table._slots_ambiguity).toEqual({ first: 2, second: 5, source: 'x_slash_y' });
    });

    it('preserva ambiguidade mesmo quando o maior número vem primeiro ("Lugares: 5/2")', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa\n» Lugares: 5/2\n» Data: Sexta 21h' }),
      );
      expect(draft?.table.slots_total).toBe(5);
      expect(draft?.table.slots_open).toBeNull();
      expect(draft?.table._slots_ambiguity).toEqual({ first: 5, second: 2, source: 'x_slash_y' });
    });

    it('URL não é engolida como continuação do rótulo anterior (Sistema)', () => {
      const draft = parseDiscordAnnouncement(
        makeMessage({ content_raw: 'Mesa\nSistema: D&D\nhttps://forms.gle/abc\nVagas: 5' }),
      );
      expect(draft?.table.raw_system_hint).toBe('D&D');
    });
  });
});

describe('stripNullBytes (achado 2026-07-15: JSONB do Postgres rejeita 0x00)', () => {
  it('remove caractere nulo preservando o resto do texto', () => {
    const input = `Mesa${String.fromCharCode(0)} de teste`;
    expect(stripNullBytes(input)).toBe('Mesa de teste');
  });

  it('não afeta texto sem caractere nulo', () => {
    expect(stripNullBytes('Mesa de teste normal')).toBe('Mesa de teste normal');
  });

  it('parseDiscordAnnouncement sanitiza 0x00 no content_raw antes de extrair campos', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: `Mesa Dragonlance${String.fromCharCode(0)}\nSistema: D&D\nVagas: 3`,
      }),
    );
    expect(draft?.table.description ?? '').not.toContain(String.fromCharCode(0));
    expect(draft?.table.raw_system_hint ?? '').not.toContain(String.fromCharCode(0));
    expect(JSON.stringify(draft)).not.toContain('\\u0000');
  });
});

// ─── Fase 6 (spec 096, T6.6/A9) — fixtures do §Gap 4 do plan.md ───────────
// Uma fixture por falha; as extrações do parseDiscordAnnouncement que mudaram
// nesta fase. F1 (catálogos no preview) é coberta por gmPanel.parsePreview.test.ts
// e F2 (schedules×sessions) pelo frontend (editorMapping/previewMerge — a
// correção T3.1 já faz o mapper ler `schedules`; a fixture fixa o contrato atual).
describe('Fase 6 (spec 096) — fixtures do §Gap 4', () => {
  it('F3: "Vagas: 4 (2 abertas)" extrai slots_total=4 e slots_open=2 (o parêntese é o total de abertas)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nVagas: 4 (2 abertas)' }),
    );
    expect(draft?.table.slots_total).toBe(4);
    expect(draft?.table.slots_open).toBe(2);
    expect(draft?.table.slots_filled).toBe(2);
  });

  it('F3-b: "Vagas: 5 (2 ocupadas)" extrai slots_total=5 e slots_open=3 (parêntese de ocupadas)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nVagas: 5 (2 ocupadas)' }),
    );
    expect(draft?.table.slots_total).toBe(5);
    expect(draft?.table.slots_open).toBe(3);
  });

  it('F3-c: parêntese fora da faixa de vagas (ex.: data) não vira slot', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nData: 25 (2 abertas) não conta\nVagas: 6' }),
    );
    expect(draft?.table.slots_total).toBe(6);
  });

  it('F4: "Contato: Discord @ricardo" vira contato discord com o @username', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nContato: Discord @ricardo' }),
    );
    expect(draft?.table.contact_discord).toBe('@ricardo');
  });

  it('F4-b: email em linha de contato NÃO vira @username (o @ está no meio do token)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nContato: fulano@email.com' }),
    );
    expect(draft?.table.contact_discord).not.toBe('@email.com');
  });

  it('F4-c: menção <@id> continua vencendo o @username quando os dois aparecem', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nContato: <@123456789012345678> ou @ricardo' }),
    );
    expect(draft?.table.contact_discord).toBe('<@123456789012345678>');
  });

  it('F5: "necessário ter PC e microfone" extrai pc=true E mic=true (coordenação)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nRequisitos: necessário ter PC e microfone' }),
    );
    expect(draft?.table.requires_pc).toBe(true);
    expect(draft?.table.requires_microphone).toBe(true);
  });

  it('F5-b: "não é necessário ter PC e microfone" NÃO marca nada (negação distribuída)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nRequisitos: não é necessário ter PC e microfone' }),
    );
    expect(draft?.table.requires_pc).not.toBe(true);
    expect(draft?.table.requires_microphone).not.toBe(true);
  });

  it('F7: "Mensal: 40" extrai price_type=paga e price_value_monthly=40', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nMensal: 40' }),
    );
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value_monthly).toBe(40);
  });

  it('F7-b: "Doações: R$ 10" em mesa gratuita extrai accepts_donations + valor sugerido, SEM virar mesa paga', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: gratuito\nDoações: R$ 10' }),
    );
    expect(draft?.table.price_type).toBe('gratuita');
    expect(draft?.table.accepts_donations).toBe(true);
    expect(draft?.table.suggested_donation_value).toBe(10);
  });

  it('F7-b2: "Doação: R$ 10" no SINGULAR tem o mesmo tratamento do plural (não vira preço da mesa)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: gratuito\nDoação: R$ 10' }),
    );
    expect(draft?.table.price_type).toBe('gratuita');
    expect(draft?.table.price_value).toBeNull();
    expect(draft?.table.accepts_donations).toBe(true);
    expect(draft?.table.suggested_donation_value).toBe(10);
  });

  it('F7-d: "R$ 40/mês" preenche SÓ price_value_monthly (o mesmo número não vira preço por sessão)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: R$ 40/mês' }),
    );
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value_monthly).toBe(40);
    expect(draft?.table.price_value).toBeNull();
  });

  it('F7-e: mensal e por sessão juntos preservam os DOIS valores distintos', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: R$ 30 por sessão\nMensalidade: R$ 100' }),
    );
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.price_value).toBe(30);
    expect(draft?.table.price_value_monthly).toBe(100);
  });

  it('F7-c: mesa paga que cita doações NÃO carrega accepts_donations (contrato do validator)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: R$ 30\nTambém aceitamos doações' }),
    );
    expect(draft?.table.price_type).toBe('paga');
    expect(draft?.table.accepts_donations).toBe(false);
  });

  it('F7-f: "Não aceitamos doações" NÃO marca accepts_donations (negação vence a palavra solta)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: gratuito\nNão aceitamos doações' }),
    );
    expect(draft?.table.price_type).toBe('gratuita');
    expect(draft?.table.accepts_donations).toBe(false);
  });

  it('F7-g: "Sem doações" e "nada de contribuição voluntária" também não marcam aceite', () => {
    const semDoacoes = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: gratuito\nSem doações' }),
    );
    expect(semDoacoes?.table.accepts_donations).toBe(false);
    const nadaDe = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nValor: gratuito\nNada de contribuição voluntária' }),
    );
    expect(nadaDe?.table.accepts_donations).toBe(false);
  });

  it('F4-b: linha de contato Discord posterior a outra linha de contato ainda é lida', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Título: Mesa\nContato: WhatsApp 11 99999-8888\nContato: Discord @ricardo',
      }),
    );
    expect(draft?.table.contact_discord).toBe('@ricardo');
  });

  // ── Achados do mantenedor no draft 85f669da (2026-09-02) ──────────────────
  // Os tres vieram do mesmo anuncio real ("O Reinado da Rainha-Dragao").

  it('emoji customizado <:nome:id> nao vaza para o titulo', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '',
        content_raw: '# <:emoji_19:1544085548493439017> O Reinado da Rainha-Dragao\nSistema: Daggerheart',
      }),
    );
    // Antes saia ":emoji 19:1544085548493439017 o Reinado da Rainha-Dragao":
    // stripDecorativeMarkup preserva `:` e digitos, entao o marcador virava texto.
    expect(draft?.table.title).not.toContain('emoji');
    expect(draft?.table.title).not.toContain('1544085548493439017');
    expect(draft?.table.title).toContain('Reinado da Rainha');
  });

  it('emoji de LETRA vira a letra, em vez de sumir com a inicial da palavra', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '',
        content_raw:
          'Titulo: Mesa\nSistema: Daggerheart\n<:regional_indicator_e:1544078433875927091>ra uma vez, na terra de Whelvia.',
      }),
    );
    // Remover o emoji sem repor a letra publicaria "ra uma vez".
    expect(draft?.table.description ?? '').toContain('Era uma vez');
  });

  it('"Imagem" sozinho no fim nao entra na descricao', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '',
        content_raw: 'Titulo: Mesa\nSistema: Daggerheart\nVenha contar sua historia!\nImagem',
      }),
    );
    const desc = draft?.table.description ?? '';
    expect(desc).toContain('Venha contar sua historia');
    // Rotulo do anexo, nao conteudo do anuncio.
    expect(desc.trimEnd().endsWith('Imagem')).toBe(false);
  });

  it('"Imagem" no meio de uma frase e preservado (nao e rotulo)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '',
        content_raw: 'Titulo: Mesa\nSistema: Daggerheart\nImagem de capa feita pelo mestre.',
      }),
    );
    expect(draft?.table.description ?? '').toContain('Imagem de capa');
  });

  it('"Dias e horarios da mesa: A decidir" cai em to_define, nao em null', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        discord_thread_name: '',
        content_raw:
          'Titulo: Mesa\nSistema: Daggerheart\nDias e horarios da mesa: A decidir, mande mensagem!',
      }),
    );
    // O "da mesa:" interposto derrubava o padrao, e o dia virava null — a UI
    // pedia selecao de um dado que o mestre ja declarara como indefinido.
    expect(draft?.table.day_of_week).toBe('to_define');
  });

  it('F4-c: menção <@id> em qualquer linha de contato vence @username de outra linha', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({
        content_raw: 'Título: Mesa\nContato: Discord @ricardo\nContato: chamar <@123456789>',
      }),
    );
    expect(draft?.table.contact_discord).toBe('<@123456789>');
  });

  it('F8: sistema que não casa no catálogo preserva raw_system_hint (sem inventar correspondência)', () => {
    const draft = parseDiscordAnnouncement(
      makeMessage({ content_raw: 'Título: Mesa\nSistema: Xyz Nada a Ver' }),
      [],
    );
    expect(draft?.table.system_id).toBeNull();
    expect(draft?.table.raw_system_hint).toBe('Xyz Nada a Ver');
  });
});
