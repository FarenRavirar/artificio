import { describe, expect, it, vi } from 'vitest';
import {
  buildLayerPrediction,
  buildParseEvalExample,
  evaluateParseLayers,
  recordParseLayerShadowDecisions,
} from '../parseEval';
import { db } from '../../db';

vi.mock('../../db', () => ({
  db: {
    insertInto: vi.fn(),
  },
}));

function payload(provider?: string) {
  return {
    confidence: 0.72,
    missing_fields: ['system_name'],
    table: {
      system_name: 'D&D 5e',
      price_type: null,
      slots_total: 4,
      contact_url: 'https://forms.gle/abc',
      _ai_suggestions: provider
        ? {
          provider,
          model: provider.includes('deepseek') ? 'deepseek-chat' : 'n/a',
          fields: { system_name: 'Dungeons & Dragons 5e', price_type: 'paga' },
        }
        : undefined,
    },
  };
}

describe('parse eval dataset', () => {
  it('deriva alvo humano a partir de feedback confirmado', () => {
    const example = buildParseEvalExample({
      id: 'case-1',
      deterministicResult: payload(),
      finalResult: payload('learning-rules+deepseek'),
      finalAction: 'needs_review',
      feedback: [
        { feedback_type: 'field_correction', field: 'price_type', after_value: 'paga' },
        { feedback_type: 'field_correction', field: 'system_name', after_value: 'Dungeons & Dragons 5e' },
      ],
    });

    expect(example).toMatchObject({
      id: 'case-1',
      expected_action: 'needs_review',
      expected_payload: {
        table: expect.objectContaining({
          price_type: 'paga',
          system_name: 'Dungeons & Dragons 5e',
        }),
      },
    });
  });

  it('separa predicoes parser, learning e DeepSeek por provider', () => {
    expect(buildLayerPrediction('parser', payload(), payload('deepseek'))).toEqual(payload());
    expect(buildLayerPrediction('learning', payload(), payload('learning-rules'))?.table).toMatchObject({
      system_name: 'Dungeons & Dragons 5e',
      price_type: 'paga',
    });
    expect(buildLayerPrediction('deepseek', payload(), payload('learning-rules'))).toBeNull();
    expect(buildLayerPrediction('deepseek', payload(), payload('learning-rules+deepseek'))?.table).toMatchObject({
      system_name: 'Dungeons & Dragons 5e',
      price_type: 'paga',
    });
  });

  it('reconhece learning já aplicado sem depender de sugestão pendente', () => {
    const final = payload();
    final.table.system_name = 'Dungeons & Dragons 5e';
    Object.assign(final.table, {
      _learning_applied: {
        provider: 'learning-rules',
        fields: { system_name: 'Dungeons & Dragons 5e' },
      },
    });

    expect(buildLayerPrediction('learning', payload(), final)?.table).toMatchObject({
      system_name: 'Dungeons & Dragons 5e',
    });
    expect(buildLayerPrediction('deepseek', payload(), final)).toBeNull();
  });

  it('mede impacto incremental por camada e campo', () => {
    const example = buildParseEvalExample({
      id: 'case-1',
      deterministicResult: payload(),
      finalResult: payload('learning-rules+deepseek'),
      finalAction: 'needs_review',
      feedback: [{ feedback_type: 'field_correction', field: 'price_type', after_value: 'paga' }],
    });

    const result = evaluateParseLayers(example ? [example] : []);
    expect(result.find((layer) => layer.layer === 'parser')?.metrics.find((m) => m.field === 'price_type')).toMatchObject({
      total: 1,
      correct: 0,
      accuracy: 0,
    });
    expect(result.find((layer) => layer.layer === 'deepseek')?.metrics.find((m) => m.field === 'price_type')).toMatchObject({
      total: 1,
      correct: 1,
      accuracy: 1,
    });
  });
});

describe('parse layer shadow', () => {
  it('registra o que cada camada teria feito sem mudar decisao real', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ execute });
    (db.insertInto as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    await recordParseLayerShadowDecisions({
      parseCaseId: 'case-1',
      draftId: 'draft-1',
      deterministicResult: payload(),
      finalResult: payload('learning-rules+deepseek'),
      finalAction: 'needs_review',
    });

    expect(db.insertInto).toHaveBeenCalledWith('discord_parse_shadow_decisions');
    expect(values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ prediction_layer: 'parser', predicted_action: 'needs_review' }),
      expect.objectContaining({ prediction_layer: 'learning', predicted_action: 'needs_review' }),
      expect.objectContaining({ prediction_layer: 'deepseek', predicted_action: 'needs_review' }),
    ]));
    expect(execute).toHaveBeenCalled();
  });
});
