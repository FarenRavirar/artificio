import { describe, expect, it } from 'vitest';
import { buildLearningFeedbackPlan } from '../learningFeedbackOutbox.js';

describe('buildLearningFeedbackPlan', () => {
  const parsedBefore = {
    source: { guild_id: 'guild-1' },
    table: {
      title: 'Mesa confirmada',
      description: '',
      system_id: 'dnd-5e',
      system_name: 'D&D 5e',
      _private: 'ignorar',
      _learning_applied: {
        applications: [{
          rule_id: 'rule-1',
          field: 'system_entity',
          affected_fields: ['system_id', 'system_name'],
          before: { system_id: null, system_name: 'D&D' },
          after: { system_id: 'dnd-5e', system_name: 'D&D 5e' },
        }],
      },
    },
  };

  it('separa correcoes, confirmacoes validas e regra exata recorreta', () => {
    const plan = buildLearningFeedbackPlan({
      parsedBefore,
      humanCorrected: {
        ...parsedBefore,
        table: { ...parsedBefore.table, system_id: 'pf2e', system_name: 'Pathfinder 2e' },
      },
      diff: {
        system_id: { before: 'dnd-5e', after: 'pf2e' },
        system_name: { before: 'D&D 5e', after: 'Pathfinder 2e' },
      },
      confirmedFields: ['title', 'description', 'system_name', '_private', 'inexistente'],
    });

    expect(plan.entries).toEqual(expect.arrayContaining([
      { field: 'system_id', inputValue: 'dnd-5e', outputValue: 'pf2e' },
      { field: 'system_name', inputValue: 'D&D 5e', outputValue: 'Pathfinder 2e' },
    ]));
    expect(plan.confirmedFields).toEqual(['title']);
    expect(plan.rejectedApplications).toEqual([
      expect.objectContaining({ rule_id: 'rule-1', field: 'system_entity' }),
    ]);
  });

  it('nao rejeita regra aplicada quando humano corrige campo sem relacao', () => {
    const plan = buildLearningFeedbackPlan({
      parsedBefore,
      humanCorrected: { ...parsedBefore, table: { ...parsedBefore.table, title: 'Outro título' } },
      diff: { title: { before: 'Mesa confirmada', after: 'Outro título' } },
      confirmedFields: ['system_name'],
    });

    expect(plan.rejectedApplications).toEqual([]);
    expect(plan.confirmedFields).toEqual(['system_name']);
  });
});
