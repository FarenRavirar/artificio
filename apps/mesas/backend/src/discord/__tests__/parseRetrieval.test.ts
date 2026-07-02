import { describe, expect, it } from 'vitest';
import type { DiscordParseCase } from '../../db/types';
import {
  buildDuplicateSignals,
  buildRetrievalContext,
  extractStructuralUrls,
  scoreDuplicateCandidate,
  type RetrievedParseCase,
} from '../parseRetrieval';

function parseCase(overrides: Partial<DiscordParseCase> = {}): DiscordParseCase {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    discord_message_id: null,
    import_message_id: null,
    draft_id: null,
    import_run_id: null,
    guild_id: 'guild-1',
    channel_id: 'channel-1',
    author_id: 'author-1',
    raw_hash: 'raw-a',
    normalized_hash: 'norm-a',
    normalized_text: 'mesa dnd 5e https://forms.gle/abc',
    features_json: {
      form_urls: ['https://forms.gle/abc'],
      attachment_urls: ['https://cdn.discordapp.com/cover.png'],
    },
    deterministic_result_json: null,
    retrieval_context_json: null,
    llm_context_hash: null,
    final_result_json: { payload: { system_name: 'Dungeons & Dragons 5e' } },
    final_action: 'needs_review',
    parser_version: '058-fase3-v1',
    prompt_version: null,
    model: null,
    created_at: new Date('2026-07-01T00:00:00Z'),
    updated_at: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function retrieved(overrides: Partial<RetrievedParseCase> = {}): RetrievedParseCase {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    draft_id: null,
    final_action: 'needs_review',
    raw_hash: 'raw-b',
    normalized_hash: 'norm-b',
    normalized_text: 'mesa dnd 5e https://forms.gle/abc',
    guild_id: 'guild-1',
    channel_id: 'channel-1',
    author_id: 'author-2',
    features_json: { form_urls: ['https://forms.gle/abc'] },
    final_result_json: { payload: { system_name: 'Dungeons & Dragons 5e' } },
    text_similarity: 0.7,
    has_field_correction: false,
    has_publish_feedback: false,
    has_discard_feedback: false,
    ...overrides,
  };
}

describe('parse retrieval signals', () => {
  it('extrai links estruturais do texto e das features', () => {
    expect(extractStructuralUrls(parseCase()).form_urls).toEqual(['https://forms.gle/abc']);
    expect(extractStructuralUrls(parseCase()).attachment_urls).toEqual(['https://cdn.discordapp.com/cover.png']);
  });

  it('prioriza duplicata exata por hash bruto ou normalizado', () => {
    const current = parseCase();
    const exact = retrieved({ raw_hash: 'raw-a', text_similarity: 0.2 });
    const normalized = retrieved({ normalized_hash: 'norm-a', text_similarity: 0.2 });

    expect(scoreDuplicateCandidate(buildDuplicateSignals(current, exact))).toBe(1);
    expect(scoreDuplicateCandidate(buildDuplicateSignals(current, normalized))).toBe(0.97);
  });

  it('usa sinais estruturais para elevar candidato provavel', () => {
    const current = parseCase();
    const candidate = retrieved({
      text_similarity: 0.62,
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      author_id: 'author-1',
    });

    const signals = buildDuplicateSignals(current, candidate);
    expect(signals.same_form_url).toBe(true);
    expect(signals.same_system_hint).toBe(true);
    expect(scoreDuplicateCandidate(signals)).toBeGreaterThanOrEqual(0.75);
  });
});

describe('buildRetrievalContext', () => {
  it('separa duplicatas, similares, positivos, negativos e corrigidos', () => {
    const current = parseCase();
    const context = buildRetrievalContext(current, [
      retrieved({ id: 'dup', raw_hash: 'raw-a', final_action: 'needs_review' }),
      retrieved({ id: 'positive', final_action: 'synced', text_similarity: 0.4, has_publish_feedback: true }),
      retrieved({ id: 'negative', final_action: 'discard', text_similarity: 0.4, has_discard_feedback: true }),
      retrieved({ id: 'corrected', text_similarity: 0.4, has_field_correction: true }),
    ]);

    expect(context.duplicate_candidates.map((item) => item.id)).toContain('dup');
    expect(context.similar_cases.length).toBeGreaterThan(0);
    expect(context.positive_examples.map((item) => item.id)).toEqual(['positive']);
    expect(context.negative_examples.map((item) => item.id)).toEqual(['negative']);
    expect(context.corrected_examples.map((item) => item.id)).toEqual(['corrected']);
  });
});
