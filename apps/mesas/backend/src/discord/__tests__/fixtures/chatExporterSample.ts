import type { ImportRawMessage } from '../../types';

/**
 * Fixture com dados fictícios que reproduzem padrões reais encontrados no
 * DiscordChatExporter JSON do Império RPG (servidor real), sem expor dados reais.
 *
 * Padrões cobertos:
 * 1. Timestamps Discord `<t:UNIX:F>` e `<t:UNIX:t>`
 * 2. Google Forms (`forms.gle` e `docs.google.com/forms`)
 * 3. "me mande mensagem" / "me chama" / "fale comigo"
 * 4. "chama no pv" / "este perfil"
 * 5. Vagas "3 de 5" / "0/5"
 * 6. "mesa em andamento" / "1 vaga via forms"
 */
export const chatExporterSampleMessages: ImportRawMessage[] = [
  // 1. Msg com timestamp Discord `<t:UNIX:F>` e `<t:UNIX:t>`
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-timestamp',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-001',
    discord_thread_name: 'D&D 5e: Aventura Épica',
    discord_author_id: 'author-fake-1',
    discord_author_name: 'MestreFake',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-timestamp',
    content_raw: [
      '## ⚔️ Aventura Épica',
      '',
      '- **Sistema de Jogo:** D&D 5e 2024',
      '- **Dia local:** <t:1717200000:F>',
      '- **Horário:** <t:1717200000:t>',
      '- **Vagas abertas:** 4',
      '',
      'Prepare-se para uma jornada inesquecível!',
      'https://forms.gle/FakeTimestampForm',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-22T19:00:00-03:00'),
    message_edited_at: null,
  },

  // 2. Msg com Google Forms (`forms.gle` e `docs.google.com/forms`)
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-forms',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-002',
    discord_thread_name: 'Tormenta20: Coração de Rubi',
    discord_author_id: 'author-fake-2',
    discord_author_name: 'NarradorFake',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-forms',
    content_raw: [
      '**▬ Sistema:** Tormenta20',
      '**▬ Vagas Totais:** 6',
      '**▬ Vagas Disponíveis:** 3',
      '**▬ Dia:** Quinta-feira às 20h',
      '',
      'Preencha o formulário para participar:',
      'https://forms.gle/AbCdEf123',
      '',
      'Ou responda pelo Google Docs:',
      'https://docs.google.com/forms/d/e/fake123/viewform?usp=sharing',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-22T20:00:00-03:00'),
    message_edited_at: null,
  },

  // 3. Msg com "me mande uma mensagem" / "me chama" / "fale comigo"
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-mande-msg',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-003',
    discord_thread_name: 'Old Dragon: A Tumba do Imperador',
    discord_author_id: 'author-implicit-1',
    discord_author_name: 'MestreDasSombras',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-mande-msg',
    content_raw: [
      '**Sistema:** Old Dragon 2e',
      '**Vagas:** 3',
      '**Dia:** Terça-feira às 19h30',
      '',
      'Caso tenha interesse, me mande uma mensagem no privado.',
      'Estou recrutando jogadores comprometidos para esta campanha.',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-22T21:00:00-03:00'),
    message_edited_at: null,
  },

  // 4. Msg com "chama no pv" / "este perfil"
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-chama-pv',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-004',
    discord_thread_name: 'Shadowdark: Torre da Perdição',
    discord_author_id: 'author-implicit-2',
    discord_author_name: 'AventureiroSombrio',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-chama-pv',
    content_raw: [
      '**Sistema:** Shadowdark',
      '**Vagas:** 2 de 4',
      '**Dia:** Sexta-feira às 21h',
      '',
      'Se tiver dúvidas, chama no pv!',
      'Ou entre em contato por este perfil.',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-22T22:00:00-03:00'),
    message_edited_at: null,
  },

  // 5. Msg com vagas "3 de 5" / "0/5"
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-vagas-informal',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-005',
    discord_thread_name: 'Pathfinder 2e: Ascensão dos Campeões',
    discord_author_id: 'author-fake-5',
    discord_author_name: 'MestreHeroico',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-vagas-informal',
    content_raw: [
      '**Sistema:** Pathfinder 2e',
      '**Dia:** Sábado às 15h',
      '',
      'Temos 3 de 5 vagas preenchidas. Procuro mais 2 jogadores!',
      'Mesa gratuita, ambiente inclusivo.',
      'https://forms.gle/VagasInformalForm',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-23T10:00:00-03:00'),
    message_edited_at: null,
  },

  // 6. Msg com "mesa em andamento" / "1 vaga via forms"
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-em-andamento',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-006',
    discord_thread_name: 'Vampiro: A Máscara - Crônicas de Boston',
    discord_author_id: 'author-fake-6',
    discord_author_name: 'NarradorNoturno',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-em-andamento',
    content_raw: [
      '**Sistema:** Vampiro a Máscara V5',
      '**Dia:** Domingo às 19h',
      '',
      '**Vagas abertas:** Mesa em andamento',
      'Atualmente temos 1 vaga via forms para preencher.',
      '',
      'https://forms.gle/EmAndamentoForm',
    ].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-23T11:00:00-03:00'),
    message_edited_at: null,
  },

  // 7. msg-007: mensagem alvo de reply (DEB-048-14)
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-007',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-007',
    discord_thread_name: 'D&D 5e: Procura-se Jogadores',
    discord_author_id: 'author-fake-7',
    discord_author_name: 'MestreRecrutador',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-007',
    content_raw: 'Procurando jogadores para uma campanha de D&D 5e nas sextas à noite.',
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-24T14:00:00-03:00'),
    message_edited_at: null,
  },

  // 8. msg-008: reply para msg-007 (DEB-048-14)
  {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'msg-008',
    discord_channel_id: 'channel-fake',
    discord_guild_id: 'guild-001',
    discord_parent_channel_id: null,
    discord_thread_id: 'thread-007',
    discord_thread_name: 'Re: D&D 5e: Procura-se Jogadores',
    discord_author_id: 'author-fake-8',
    discord_author_name: 'JogadorInteressado',
    discord_message_url: 'https://discord.com/channels/guild-001/channel-fake/msg-008',
    content_raw: 'Tenho interesse! Me chama no privado.',
    attachments: [],
    embeds: [],
    reference: { messageId: 'msg-007' },
    message_created_at: new Date('2026-06-24T14:05:00-03:00'),
    message_edited_at: null,
  },
];

// ═══ Fixtures negativas para DEB-048-01 (JSON truncado/inválido) ═══

/** JSON string truncada (corte no meio de um objeto) */
export const truncatedJsonString = '{"guild":{"id":"111","name":"Servidor Teste"},"channel":{"id":"222","name":"canal"},"messages":[{"id":"msg-001","type":"Default","timestamp":"2025-01-01T12:00:00+00:00","author":{"id":"auth-1","name":"Jogador"},"content":"Procur';

/** Export com schema inválido: sem campo guild */
export const exportWithoutGuild = {
  channel: { id: '222', name: 'canal', category: 'Mesas', topic: null },
  messages: [{
    id: 'msg-001', type: 'Default', timestamp: '2025-01-01T12:00:00+00:00',
    author: { id: 'auth-1', name: 'Jogador', color: '#ffffff', nickname: 'Jog', isBot: false },
    content: 'Procurando jogadores',
  }],
  messageCount: 1,
};

/** Export com schema inválido: messages não é array */
export const exportWithNonArrayMessages = {
  guild: { id: '111', name: 'Servidor', iconUrl: null },
  channel: { id: '222', name: 'canal', category: 'Mesas', topic: null },
  messages: 'não é um array',
  messageCount: 1,
};

/**
 * Fase H (spec 058): JSON formatado (indentação 4 espaços, padrão de export real do
 * DiscordChatExporter) com 2 mensagens completas seguidas de corte no MEIO da 3ª mensagem
 * (download/export interrompido) — reproduz o caso real recuperado nesta spec
 * (`D:/teste_hoje2.json`). Usado pra validar `parseUploadedJsonBuffer` (Fase H).
 */
export const truncatedTailJsonBuffer = Buffer.from(`{
  "guild": {
    "id": "111",
    "name": "Servidor Teste"
  },
  "channel": {
    "id": "222",
    "name": "canal"
  },
  "messages": [
    {
      "id": "msg-001",
      "type": "Default",
      "timestamp": "2025-01-01T12:00:00+00:00",
      "timestampEdited": null,
      "author": {
        "id": "auth-1",
        "name": "Jogador1",
        "discriminator": "0",
        "nickname": null,
        "color": null
      },
      "content": "Procurando jogadores para mesa de D&D 5e",
      "attachments": [],
      "embeds": [],
      "reactions": [],
      "mentions": [],
      "inlineEmojis": []
    },
    {
      "id": "msg-002",
      "type": "Default",
      "timestamp": "2025-01-01T13:00:00+00:00",
      "timestampEdited": null,
      "author": {
        "id": "auth-2",
        "name": "Jogador2",
        "discriminator": "0",
        "nickname": null,
        "color": null
      },
      "content": "Mesa de Pathfinder 2e aos sabados",
      "attachments": [],
      "embeds": [],
      "reactions": [],
      "mentions": [],
      "inlineEmojis": []
    },
    {
      "id": "msg-003",
      "type": "Default",
      "timestamp": "2025-01-01T14:00:00+00:00",
      "timestampEdited": null,
      "author": {
        "id": "auth-3",
        "name": "Jogador3",
        "discriminator": "0",
        "nickname": null,
        "color": null`, 'utf-8');
