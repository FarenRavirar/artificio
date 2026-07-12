import { describe, it, expect } from 'vitest';
import { assertValidTransition, canTransition, InvalidEditorialTransitionError } from './editorialStateMachine';

// T7.2 — maquina de estados: transicoes validas/invalidas.

describe('editorialStateMachine', () => {
  it.each([
    ['draft', 'in_review'],
    ['in_review', 'published'],
    ['in_review', 'rejected'],
    ['published', 'withdrawn'],
    ['rejected', 'in_review'],
  ] as const)('permite transicao %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  it.each([
    ['draft', 'published'],
    ['draft', 'rejected'],
    ['draft', 'withdrawn'],
    ['published', 'draft'],
    ['published', 'in_review'],
    ['withdrawn', 'draft'],
    ['withdrawn', 'in_review'],
    ['withdrawn', 'published'],
    ['rejected', 'published'],
    ['rejected', 'draft'],
  ] as const)('rejeita transicao %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertValidTransition(from, to)).toThrow(InvalidEditorialTransitionError);
  });
});
