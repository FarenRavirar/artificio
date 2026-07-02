import { describe, expect, it } from 'vitest';
import {
  buildParseCaseContract,
  normalizeParseLearningText,
  parseActionFromDraftStatus,
  parseActionFromNormalizedStatus,
  parseFeedbackContractSchema,
} from '../parseLearning';

function message() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    discord_guild_id: 'guild-1',
    discord_channel_id: 'channel-1',
    discord_author_id: 'author-1',
    content_raw: '  SÁBADO às 20h\nMesa gratuita https://forms.gle/teste  ',
    attachments: [{ fileName: 'cover.png' }],
    embeds: [{ title: 'Form' }],
    source_kind: 'discord_chat_exporter_json',
    discord_thread_name: 'D&D 5e: A Torre',
  };
}

describe('normalizeParseLearningText', () => {
  it('normaliza texto para hash estavel sem destruir o raw', () => {
    expect(normalizeParseLearningText('  SÁBADO\n às   20h ')).toBe('sabado as 20h');
  });
});

describe('buildParseCaseContract', () => {
  it('monta contrato versionado com hashes e features', () => {
    const contract = buildParseCaseContract({
      message: message(),
      draftId: '22222222-2222-4222-8222-222222222222',
      deterministicResult: { ok: true },
      finalResult: { status: 'needs_review' },
      finalAction: 'needs_review',
    });

    expect(contract.discord_message_id).toBe(message().id);
    expect(contract.import_message_id).toBeNull();
    expect(contract.raw_hash).toHaveLength(64);
    expect(contract.normalized_hash).toHaveLength(64);
    expect(contract.normalized_text).toBe('sabado as 20h mesa gratuita https://forms.gle/teste');
    expect(contract.features_json).toEqual(expect.objectContaining({
      attachments_count: 1,
      embeds_count: 1,
      has_form_url: true,
      has_price_signal: true,
    }));
    expect(contract.parser_version).toBe('058-fase3-v1');
  });

  it('permite caso de inbox sem FK de discord_message_id', () => {
    const contract = buildParseCaseContract({
      message: message(),
      discordMessageId: null,
      importMessageId: '33333333-3333-4333-8333-333333333333',
      deterministicResult: null,
      finalResult: null,
      finalAction: 'ignore',
    });

    expect(contract.discord_message_id).toBeNull();
    expect(contract.import_message_id).toBe('33333333-3333-4333-8333-333333333333');
  });
});

describe('parse feedback contract', () => {
  it('valida feedback imutavel minimo', () => {
    const parsed = parseFeedbackContractSchema.parse({
      parse_case_id: null,
      draft_id: '22222222-2222-4222-8222-222222222222',
      feedback_type: 'field_correction',
      field: 'price_type',
      before_value: null,
      after_value: 'paga',
      reason: 'admin-review',
      scope_json: { guild_id: 'guild-1' },
      admin_user_id: null,
    });

    expect(parsed.feedback_type).toBe('field_correction');
  });
});

describe('parse action helpers', () => {
  it('mapeia status para acoes do corpus', () => {
    expect(parseActionFromNormalizedStatus('needs_review')).toBe('needs_review');
    expect(parseActionFromNormalizedStatus('draft')).toBe('draft');
    expect(parseActionFromDraftStatus('rejected')).toBe('rejected');
    expect(parseActionFromDraftStatus('synced')).toBe('synced');
  });
});
