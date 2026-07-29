import { isPublicTable } from './tableVisibility.js';

const baseTable = {
  status: 'active',
  archived_at: null,
  origin: 'manual',
  created_at: '2026-07-28T00:00:00.000Z',
  starts_at: null,
};

describe('isPublicTable', () => {
  it('aceita mesa ativa, não arquivada e não expirada', () => {
    expect(isPublicTable(baseTable)).toBe(true);
  });

  it.each([
    ['rascunho', { ...baseTable, status: 'draft' }],
    ['arquivada', { ...baseTable, archived_at: '2026-07-28T00:00:00.000Z' }],
    ['importada expirada', { ...baseTable, origin: 'imported', created_at: '2020-01-01T00:00:00.000Z' }],
  ] as const)('rejeita mesa %s', (_label, table) => {
    expect(isPublicTable(table)).toBe(false);
  });
});
