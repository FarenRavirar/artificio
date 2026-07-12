import { describe, it, expect, vi, beforeEach } from 'vitest';

// T6.3 (cota) — checa cota ANTES de operar, com margem de 10% (regra petrea
// do mantenedor: zero risco de cobranca no free tier do R2).

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    insertInto: dbMocks.insertInto,
    updateTable: dbMocks.updateTable,
  },
}));

import { assertWithinQuota } from './usageTracker';

function mockExistingRow(row: { bytes_used: number; class_a_ops: number; class_b_ops: number }) {
  dbMocks.selectFrom.mockReturnValue({
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue({ provider: 'r2', year_month: '2026-07', ...row }),
  });
}

describe('assertWithinQuota', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
    dbMocks.updateTable.mockReset();
  });

  it('permite upload dentro da cota de bytes', async () => {
    mockExistingRow({ bytes_used: 0, class_a_ops: 0, class_b_ops: 0 });

    await expect(
      assertWithinQuota('r2', { maxBytes: 1000, maxClassAOps: null, maxClassBOps: null }, 500, 'a'),
    ).resolves.toBeUndefined();
  });

  it('rejeita upload que estouraria a cota de bytes (margem de seguranca)', async () => {
    mockExistingRow({ bytes_used: 900, class_a_ops: 0, class_b_ops: 0 });

    await expect(
      assertWithinQuota('r2', { maxBytes: 1000, maxClassAOps: null, maxClassBOps: null }, 200, 'a'),
    ).rejects.toThrow('quota_bytes_exceeded:r2');
  });

  it('rejeita operacao que estouraria cota de operacoes Classe A', async () => {
    mockExistingRow({ bytes_used: 0, class_a_ops: 900_000, class_b_ops: 0 });

    await expect(
      assertWithinQuota('r2', { maxBytes: null, maxClassAOps: 900_000, maxClassBOps: null }, 1, 'a'),
    ).rejects.toThrow('quota_class_a_exceeded:r2');
  });

  it('rejeita operacao que estouraria cota de operacoes Classe B', async () => {
    mockExistingRow({ bytes_used: 0, class_a_ops: 0, class_b_ops: 9_000_000 });

    await expect(
      assertWithinQuota('r2', { maxBytes: null, maxClassAOps: null, maxClassBOps: 9_000_000 }, 1, 'b'),
    ).rejects.toThrow('quota_class_b_exceeded:r2');
  });

  it('nao conta operacao Classe B contra o limite de Classe A', async () => {
    mockExistingRow({ bytes_used: 0, class_a_ops: 900_000, class_b_ops: 0 });

    await expect(
      assertWithinQuota('r2', { maxBytes: null, maxClassAOps: 900_000, maxClassBOps: null }, 1, 'b'),
    ).resolves.toBeUndefined();
  });
});
