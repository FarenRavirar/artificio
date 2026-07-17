import type { Mock } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
  },
}));

vi.mock('../../discord', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../discord')>();
  return {
    ...actual,
    parseDiscordAnnouncement: vi.fn(),
    normalizeDiscordTableDraft: vi.fn(),
  };
});

vi.mock('../../discord/llmAssist', () => ({
  assistDiscordParse: vi.fn(),
  assistDiscordParseWithContextPack: vi.fn(),
}));

vi.mock('../../discord/parseRetrieval', () => ({
  loadRetrievalContextForCurrent: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../discord/fieldLearning', () => ({
  LEARNABLE_FIELDS: [
    'title',
    'system_name',
    'day_of_week',
    'start_time',
    'slots_total',
    'slots_open',
    'price_type',
    'price_value',
    'contact_url',
    'description',
  ],
}));

vi.mock('../../discord/learningRules', () => ({
  lookupLearningRules: vi.fn().mockResolvedValue({ hits: [], conflicts: [] }),
  recordLearningRuleApplications: vi.fn().mockResolvedValue(undefined),
  recordLearningRulesFromCorrections: vi.fn().mockResolvedValue(undefined),
  recordSystemEntityRule: vi.fn().mockResolvedValue(undefined),
  recordEntityHintRule: vi.fn().mockResolvedValue(undefined),
  recordLabelAliasFromCorrection: vi.fn().mockResolvedValue(undefined),
  loadActiveLabelAliases: vi.fn().mockResolvedValue({}),
  ENTITY_HINT_FIELDS: ['vtt_entity', 'communication_entity', 'scenario_entity'],
}));

vi.mock('../../discord/syncHelpers', () => ({
  uploadCoverForDraft: vi.fn(),
  updateDraftImageUploadState: vi.fn(),
}));

vi.mock('../../discord/shared', () => ({
  loadSystemsForParser: vi.fn(),
  loadVttPlatformsForParser: vi.fn().mockResolvedValue([]),
  loadCommunicationPlatformsForParser: vi.fn().mockResolvedValue([]),
  loadScenariosForParser: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/adminNotifications', () => ({
  notifyAdmins: vi.fn(),
}));

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { processDiscordMessageToDraft, validateReparseMessageIds, MAX_REPARSE_MESSAGE_IDS } from './utils';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { db } from '../../db';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../../discord';
import { assistDiscordParseWithContextPack } from '../../discord/llmAssist';
import { lookupLearningRules, recordLearningRuleApplications } from '../../discord/learningRules';
import { uploadCoverForDraft, updateDraftImageUploadState } from '../../discord/syncHelpers';
import type { DiscordImportMessagesTable } from '../../db/types';
import type { Selectable } from 'kysely';

function chain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'where', 'set', 'values', 'returning', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
  const value: Record<string, Mock> = {};
  for (const method of methods) value[method] = vi.fn().mockReturnThis();
  return Object.assign(value, overrides);
}

function message(): Selectable<DiscordImportMessagesTable> {
  return {
    id: 'message-uuid',
    source_id: 'source-1',
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: '1441138618755448997',
    discord_channel_id: 'channel-1',
    discord_guild_id: 'guild-1',
    discord_parent_channel_id: null,
    discord_thread_id: null,
    discord_thread_name: 'Mesa sem título',
    discord_author_id: 'author-1',
    discord_author_name: 'GM',
    discord_message_url: 'https://discord.com/channels/guild-1/channel-1/1441138618755448997',
    content_raw: 'Anúncio grande o bastante para acionar o assistente LLM com baixa confiança e campos faltantes.',
    attachments: [],
    embeds: [],
    reference: null,
    content_hash: 'hash-1',
    message_created_at: new Date('2026-06-26T10:00:00Z'),
    message_edited_at: null,
    status: 'pending',
    parse_error: null,
    created_at: new Date('2026-06-26T10:00:00Z'),
    updated_at: new Date('2026-06-26T10:00:00Z'),
  };
}

describe('processDiscordMessageToDraft', () => {
  beforeEach(() => {
    process.env.MESAS_AI_AUTOMATION_MODE = 'suggest';
    delete process.env.MESAS_AI_KILL_SWITCH;
    vi.clearAllMocks();
    (parseDiscordAnnouncement as Mock).mockReset();
    (normalizeDiscordTableDraft as Mock).mockReset();
    (assistDiscordParseWithContextPack as Mock).mockReset();
    (lookupLearningRules as Mock).mockResolvedValue({ hits: [], conflicts: [] });
    (recordLearningRuleApplications as Mock).mockResolvedValue(undefined);

    (db.selectFrom as Mock).mockReturnValue(chain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }));
    (db.updateTable as Mock).mockReturnValue(chain({ execute: vi.fn().mockResolvedValue(undefined) }));
    (db.insertInto as Mock).mockReturnValue(chain({ executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'draft-uuid' }) }));
    (uploadCoverForDraft as Mock).mockResolvedValue(null);
    (updateDraftImageUploadState as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.MESAS_AI_AUTOMATION_MODE;
    delete process.env.MESAS_AI_KILL_SWITCH;
  });

  it('awaits DeepSeek and stores suggestions separately before inserting the draft', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997', message_url: 'https://discord.com/channels/guild-1/channel-1/1441138618755448997' },
      table: {
        title: null,
        system_name: null,
        system_id: null,
        raw_system_hint: null,
        type: 'campanha',
        modality: 'online',
        price_type: null,
        price_value: null,
        slots_total: null,
        slots_filled: null,
        slots_open: null,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: null,
        contact_discord: null,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.25,
      confidence_tier: 'baixa',
      missing_fields: ['title', 'system_name', 'price_type', 'slots_total', 'contact_url'],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (assistDiscordParseWithContextPack as Mock).mockResolvedValue({
      model: 'deepseek-chat',
      extracted: {
        title: 'A Torre Partida',
        system_hint: 'D&D 5E',
        price_type: 'gratuita',
        slots_total: 5,
        contact_url: 'https://forms.gle/teste',
      },
    });

    await expect(processDiscordMessageToDraft(message(), [], undefined, 'admin-1')).resolves.toBe('parsed');

    const insertChain = (db.insertInto as Mock).mock.results[0]?.value as { values: Mock };
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      normalized_payload: expect.objectContaining({
        table: expect.objectContaining({
          title: null,
          system_name: null,
          price_type: null,
          slots_total: null,
          contact_url: null,
          _ai_suggestions: expect.objectContaining({
            provider: 'deepseek',
            model: 'deepseek-chat',
            fields: expect.objectContaining({
              title: 'A Torre Partida',
              system_name: 'D&D 5E',
              price_type: 'gratuita',
              slots_total: 5,
              contact_url: 'https://forms.gle/teste',
            }),
          }),
          _notes: expect.arrayContaining(['Sugestões IA disponíveis; revisar antes de aplicar.']),
        }),
        missing_fields: ['title', 'system_name', 'price_type', 'slots_total', 'contact_url'],
      }),
    }));
  });

  it('applies active human learning to the draft even when DeepSeek mode is off', async () => {
    delete process.env.MESAS_AI_AUTOMATION_MODE;
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa aprendida',
        system_name: 'D&D 5e',
        system_id: null,
        raw_system_hint: 'D&D 5e',
        _system_source_hint: 'D&D 5e',
        type: 'campanha',
        modality: 'online',
        price_type: null,
        price_value: null,
        slots_total: null,
        slots_filled: null,
        slots_open: null,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: 'Mesa com sistema corrigido anteriormente.',
        contact_discord: null,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _price_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.8,
      confidence_tier: 'alta',
      missing_fields: ['system_name:unmatched_hint'],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (lookupLearningRules as Mock).mockResolvedValue({
      hits: [{
        ruleId: 'rule-1',
        field: 'system_entity',
        value: { system_id: 'dnd-52', system_name: 'D&D 5.2' },
        inputToken: 'd&d 5e',
        confidence: 0.91,
        scopeType: 'guild',
      }],
      conflicts: [],
    });

    await expect(processDiscordMessageToDraft(message(), [], undefined, 'admin-1')).resolves.toBe('parsed');

    expect(assistDiscordParseWithContextPack).not.toHaveBeenCalled();
    expect(recordLearningRuleApplications).toHaveBeenCalledWith(expect.objectContaining({
      hits: expect.arrayContaining([expect.objectContaining({ ruleId: 'rule-1' })]),
      outcome: 'applied',
      reason: 'draft_enrichment',
    }));
    const insertChain = (db.insertInto as Mock).mock.results[0]?.value as { values: Mock };
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      normalized_payload: expect.objectContaining({
        table: expect.objectContaining({
          system_name: 'D&D 5.2',
          system_id: 'dnd-52',
          _learning_applied: expect.objectContaining({
            provider: 'learning-rules',
            fields: expect.objectContaining({ system_id: 'dnd-52', system_name: 'D&D 5.2' }),
            applications: [expect.objectContaining({
              rule_id: 'rule-1',
              field: 'system_entity',
              affected_fields: ['system_id', 'system_name'],
              confidence: 0.91,
              evidence: { text: 'D&D 5e', start: null, end: null },
            })],
          }),
          _notes: expect.arrayContaining([
            expect.stringContaining('Aprendizado humano aplicado automaticamente'),
          ]),
        }),
        missing_fields: [],
      }),
    }));
    const insertedPayload = insertChain.values.mock.calls[0]?.[0]?.normalized_payload;
    expect(insertedPayload.table._ai_suggestions).toBeUndefined();
  });

  it('aplica aprendizado de vtt_entity ao draft (achado do mantenedor 2026-07-17, IMPERATIVO: generalização além de system_entity — correção manual de VTT agora ensina o sistema)', async () => {
    delete process.env.MESAS_AI_AUTOMATION_MODE;
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa com VTT corrigido antes',
        system_name: 'D&D 5e',
        system_id: 'dnd-5e',
        raw_system_hint: null,
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        price_value: null,
        slots_total: 4,
        slots_filled: null,
        slots_open: null,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: 'Mesa com VTT já corrigido em anúncio anterior.',
        contact_discord: null,
        contact_url: 'https://forms.gle/x',
        host_discord_id: null,
        vtt_platform_id: null,
        _vtt_source_hint: 'Roll 20',
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _price_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.8,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (lookupLearningRules as Mock).mockResolvedValue({
      hits: [{
        ruleId: 'rule-vtt-1',
        field: 'vtt_entity',
        value: { vtt_platform_id: 'roll20' },
        inputToken: 'roll 20',
        confidence: 0.91,
        scopeType: 'guild',
      }],
      conflicts: [],
    });

    await expect(processDiscordMessageToDraft(message(), [], undefined, 'admin-1')).resolves.toBe('parsed');

    const insertChain = (db.insertInto as Mock).mock.results[0]?.value as { values: Mock };
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      normalized_payload: expect.objectContaining({
        table: expect.objectContaining({
          vtt_platform_id: 'roll20',
          _vtt_source_hint: null,
          _learning_applied: expect.objectContaining({
            fields: expect.objectContaining({ vtt_platform_id: 'roll20' }),
            applications: [expect.objectContaining({
              rule_id: 'rule-vtt-1',
              field: 'vtt_entity',
              affected_fields: ['vtt_platform_id'],
            })],
          }),
        }),
      }),
    }));
  });

  it('asks DeepSeek only for missing or ambiguous target fields', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa quase completa',
        system_name: 'D&D',
        system_id: null,
        raw_system_hint: 'D&D',
        type: 'campanha',
        modality: 'online',
        price_type: null,
        price_value: null,
        slots_total: 4,
        slots_filled: null,
        slots_open: 2,
        day_of_week: 'sexta',
        start_time: '20:00',
        frequency: null,
        description: 'Mesa com um campo faltante.',
        contact_discord: null,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _price_ambiguity: true,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.9,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (assistDiscordParseWithContextPack as Mock).mockResolvedValue({
      model: 'deepseek-chat',
      extracted: { price_type: 'paga' },
    });

    await expect(processDiscordMessageToDraft({
      ...message(),
      content_raw: 'Long enough announcement with one missing price field and all other fields already parsed correctly for the LLM target-field test.',
    }, [], undefined, 'admin-1')).resolves.toBe('parsed');

    expect(lookupLearningRules).toHaveBeenCalled();
    expect(assistDiscordParseWithContextPack).toHaveBeenCalledWith(expect.objectContaining({
      targetFields: ['price_type', 'price_value'],
      draft: expect.objectContaining({
        table: expect.objectContaining({
          title: 'Mesa quase completa',
          system_name: 'D&D',
          day_of_week: 'sexta',
          start_time: '20:00',
          slots_total: 4,
          slots_open: 2,
        }),
      }),
    }));
  });

  it('rejects existing non-terminal paid draft when paid imports are disabled', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa paga',
        system_name: 'D&D',
        system_id: null,
        raw_system_hint: 'D&D',
        type: 'campanha',
        modality: 'online',
        price_type: 'paga',
        price_value: 25,
        slots_total: 4,
        slots_filled: null,
        slots_open: 4,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: null,
        contact_discord: null,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.9,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (db.selectFrom as Mock).mockReturnValue(chain({
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'draft-existing', status: 'needs_review' }),
    }));
    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);

    await expect(processDiscordMessageToDraft(message(), [], undefined, 'admin-1', false)).resolves.toBe('discarded');

    expect(db.updateTable).toHaveBeenCalledWith('discord_import_messages');
    expect(db.updateTable).toHaveBeenCalledWith('discord_import_table_drafts');

    const draftUpdate = (db.updateTable as Mock).mock.results
      .map((result) => result.value as { set: Mock; where: Mock })
      .find((value) => value.set.mock.calls.some(([payload]) => payload?.status === 'rejected'));

    expect(draftUpdate?.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
    expect(draftUpdate?.where).toHaveBeenCalledWith('id', '=', 'draft-existing');
    expect(draftUpdate?.where).toHaveBeenCalledWith('status', 'not in', ['synced', 'rejected']);
  });

  // Achado do bot chatgpt-codex-connector (PR #140): contact_discord pode ser
  // fallback pro AUTOR da mensagem (DEB-048-26), não contato publicado de
  // verdade. requireExplicitContact deve rejeitar esse fallback.
  it('discards message when requireExplicitContact is true and contact_discord is only the author fallback', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa sem contato explícito',
        system_name: 'D&D',
        system_id: null,
        raw_system_hint: 'D&D',
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        price_value: null,
        slots_total: 4,
        slots_filled: null,
        slots_open: 4,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: null,
        contact_discord: 'author-1',
        contact_discord_explicit: false,
        contact_url: null,
        host_discord_id: 'author-1',
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.9,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (db.selectFrom as Mock).mockReturnValue(chain({ executeTakeFirst: vi.fn().mockResolvedValue(null) }));
    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);

    await expect(
      processDiscordMessageToDraft(message(), [], undefined, 'admin-1', true, undefined, true),
    ).resolves.toBe('discarded');

    const messageUpdate = (db.updateTable as Mock).mock.results
      .map((result) => result.value as { set: Mock })
      .find((value) => value.set.mock.calls.some(([payload]) => payload?.status === 'ignored'));
    expect(messageUpdate?.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'ignored' }));
  });

  // Achado do mantenedor (2026-07-16): menção Discord <@id> sozinha não é
  // contato usável — ID cru não é clicável/pesquisável fora do servidor.
  // requireExplicitContact agora exige contact_url (link) de verdade, não
  // mais aceita contact_discord_explicit como substituto. Teste invertido:
  // antes provava que a menção bastava, agora prova que não basta mais.
  it('discards when requireExplicitContact is true and only an explicit mention exists (no contact_url)', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa com contato explícito',
        system_name: 'D&D',
        system_id: null,
        raw_system_hint: 'D&D',
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        price_value: null,
        slots_total: 4,
        slots_filled: null,
        slots_open: 4,
        day_of_week: 'sexta',
        start_time: '20:00',
        frequency: null,
        description: 'descricao',
        contact_discord: 'contato-explicito',
        contact_discord_explicit: true,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.9,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (db.selectFrom as Mock).mockReturnValue(chain({ executeTakeFirst: vi.fn().mockResolvedValue(null) }));
    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));

    await expect(
      processDiscordMessageToDraft(message(), [], undefined, 'admin-1', true, undefined, true),
    ).resolves.toBe('discarded');
  });

  it('keeps parsing when requireExplicitContact is true and contact_url exists', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448998' },
      table: {
        title: 'Mesa com link de contato',
        system_name: 'D&D',
        system_id: null,
        raw_system_hint: 'D&D',
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        price_value: null,
        slots_total: 4,
        slots_filled: null,
        slots_open: 4,
        day_of_week: 'sexta',
        start_time: '20:00',
        frequency: null,
        description: 'descricao',
        contact_discord: null,
        contact_discord_explicit: false,
        contact_url: 'https://forms.gle/exemplo',
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.9,
      confidence_tier: 'alta',
      missing_fields: [],
    };

    (db.selectFrom as Mock).mockReturnValue(chain({ executeTakeFirst: vi.fn().mockResolvedValue(null) }));
    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));

    await expect(
      processDiscordMessageToDraft(message(), [], undefined, 'admin-1', true, undefined, true),
    ).resolves.toBe('parsed');
  });
});

describe('validateReparseMessageIds', () => {
  it('rejeita messageIds acima do teto (achado CodeRabbit PR #124)', () => {
    const tooMany = Array.from({ length: MAX_REPARSE_MESSAGE_IDS + 1 }, (_, i) => `msg-${i}`);
    expect(() => validateReparseMessageIds(tooMany)).toThrow(DiscordChatExporterValidationError);
  });

  it('aceita messageIds exatamente no teto', () => {
    const atLimit = Array.from({ length: MAX_REPARSE_MESSAGE_IDS }, (_, i) => `msg-${i}`);
    expect(validateReparseMessageIds(atLimit)).toEqual(atLimit);
  });

  it('undefined passa direto (sem messageIds no payload)', () => {
    expect(validateReparseMessageIds(undefined)).toBeUndefined();
  });
});
