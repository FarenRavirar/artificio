import { describe, expect, it } from 'vitest';
import { validateCatalogHierarchyShape } from './catalog';

describe('validateCatalogHierarchyShape', () => {
  it.each([
    ['system', null],
    ['edition', 'system'],
    ['variant', 'edition'],
  ] as const)('accepts %s under %s', (nodeType, parentType) => {
    expect(validateCatalogHierarchyShape(nodeType, parentType)).toBeNull();
  });

  it.each([
    ['system', 'system'],
    ['edition', null],
    ['edition', 'edition'],
    ['variant', null],
    ['variant', 'system'],
  ] as const)('rejects %s under %s', (nodeType, parentType) => {
    expect(validateCatalogHierarchyShape(nodeType, parentType)).not.toBeNull();
  });
});
