import type { ImportRawMessage } from '../../types';

type Phase11Sample = {
  name: string;
  source: 'teste.json' | 'teste [part 2].json' | 'teste [part 3].json';
  message: ImportRawMessage;
};

const baseMessage: Omit<ImportRawMessage, 'discord_message_id' | 'content_raw'> = {
  source_kind: 'discord_chat_exporter_json',
  discord_channel_id: 'sanitized-channel',
  discord_guild_id: 'sanitized-guild',
  discord_parent_channel_id: null,
  discord_thread_id: null,
  discord_thread_name: null,
  discord_author_id: 'sanitized-author',
  discord_author_name: 'Autor Sanitizado',
  discord_message_url: null,
  attachments: [],
  embeds: [],
  message_created_at: new Date('2026-07-01T00:00:00Z'),
  message_edited_at: null,
};

export const parserPhase11Samples: Phase11Sample[] = [
  {
    name: 'fallback remove labels estruturados',
    source: 'teste [part 2].json',
    message: {
      ...baseMessage,
      discord_message_id: 'phase11-001',
      content_raw: [
        'Titulo: The Witherwild',
        'Sistema: DnD',
        'Estilo: fantasia sombria',
        'Vagas: 4',
        '',
        'A Expedicao:',
        'Um grupo atravessa a floresta vermelha em busca de respostas.',
        '',
        'Mestre: Sanitizado',
      ].join('\n'),
    },
  },
  {
    name: 'remove tokens Discord crus',
    source: 'teste.json',
    message: {
      ...baseMessage,
      discord_message_id: 'phase11-002',
      content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Mesa sombria <@&123> <#456> <t:1781647200:F>',
    },
  },
  {
    name: 'normaliza markdown-link de contato',
    source: 'teste [part 3].json',
    message: {
      ...baseMessage,
      discord_message_id: 'phase11-003',
      content_raw: 'Sistema: DnD\nVagas: 4\nSinopse: Inscreva-se.\nContato: [Form](https://forms.gle/sanitizado]',
    },
  },
];
