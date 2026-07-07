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
  lookupFieldLearning: vi.fn().mockResolvedValue([]),
  recordFieldLearning: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../discord/learningRules', () => ({
  lookupLearningRules: vi.fn().mockResolvedValue({ hits: [], conflicts: [] }),
  recordLearningRuleApplications: vi.fn().mockResolvedValue(undefined),
  recordLearningRulesFromCorrections: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../discord/syncHelpers', () => ({
  uploadCoverForDraft: vi.fn(),
  updateDraftImageUploadState: vi.fn(),
}));

vi.mock('../../discord/shared', () => ({
  loadSystemsForParser: vi.fn(),
  loadVttPlatformsForParser: vi.fn().mockResolvedValue([]),
  loadCommunicationPlatformsForParser: vi.fn().mockResolvedValue([]),
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
import { lookupFieldLearning } from '../../discord/fieldLearning';
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
    (lookupFieldLearning as Mock).mockResolvedValue([]);
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

  it('applies learning-store suggestions even when DeepSeek mode is off', async () => {
    delete process.env.MESAS_AI_AUTOMATION_MODE;
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997' },
      table: {
        title: 'Mesa aprendida',
        system_name: 'D&D 5e',
        system_id: null,
        raw_system_hint: 'D&D 5e',
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
      missing_fields: [],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (lookupLearningRules as Mock).mockResolvedValue({
      hits: [{ ruleId: 'rule-1', field: 'system_name', value: 'D&D 5.2', confidence: 0.91, scopeType: 'guild' }],
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
          _ai_suggestions: expect.objectContaining({
            provider: 'learning-rules',
            fields: expect.objectContaining({ system_name: 'D&D 5.2' }),
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
