import { describe, expect, it } from 'vitest';
import { validateSystemParentType, validateSystemSuggestionHierarchy } from './systemHierarchy.js';

describe('validateSystemParentType', () => {
  it.each([
    ['system', null],
    ['edition', 'system'],
    ['variant', 'edition'],
  ] as const)('accepts %s under %s', (nodeType, parentType) => {
    expect(validateSystemParentType(nodeType, parentType)).toBeNull();
  });

  it.each([
    ['system', 'system'],
    ['edition', null],
    ['edition', 'edition'],
    ['variant', null],
    ['variant', 'system'],
    ['variant', 'variant'],
  ] as const)('rejects %s under %s', (nodeType, parentType) => {
    expect(validateSystemParentType(nodeType, parentType)).not.toBeNull();
  });
});

describe('validateSystemSuggestionHierarchy', () => {
  const catalog = new Map([
    ['root', 'system'],
    ['edition', 'edition'],
    ['variant', 'variant'],
  ] as const);

  it('accepts the universal three-level chain', () => {
    expect(validateSystemSuggestionHierarchy([
      { node_type: 'system', parent_id: null, parent_suggestion_index: null },
      { node_type: 'edition', parent_id: null, parent_suggestion_index: 0 },
      { node_type: 'variant', parent_id: null, parent_suggestion_index: 1 },
    ], catalog)).toBeNull();
  });

  it('rejects a variant directly below a system', () => {
    expect(validateSystemSuggestionHierarchy([
      { node_type: 'variant', parent_id: 'root', parent_suggestion_index: null },
    ], catalog)).toBe('Variante no item 1 precisa ser filha de edição.');
  });

  it('rejects levels beyond variant', () => {
    expect(validateSystemSuggestionHierarchy([
      { node_type: 'variant', parent_id: 'variant', parent_suggestion_index: null },
    ], catalog)).toBe('Variante no item 1 precisa ser filha de edição.');
  });
});
