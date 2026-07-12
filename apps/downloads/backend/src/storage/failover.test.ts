import { describe, it, expect, vi } from 'vitest';
import { uploadWithFailover } from './failover';
import { StorageQuotaExceededError } from './types';
import type { StorageAdapter } from './types';

// T6.3 — failover simulado (mock de cota estourada), sem credencial real.

function makeAdapter(provider: StorageAdapter['provider'], behavior: 'ok' | 'quota' | 'error'): StorageAdapter {
  return {
    provider,
    upload: vi.fn(async (input) => {
      if (behavior === 'quota') throw new StorageQuotaExceededError(provider, `${provider} sem cota`);
      if (behavior === 'error') throw new Error(`${provider} falhou de verdade`);
      return { provider, key: input.key };
    }),
    getPublicUrl: (key) => `https://example.test/${key}`,
    delete: vi.fn(async () => {}),
    getUsage: vi.fn(async () => ({
      provider,
      usedBytes: 0,
      quotaBytes: null,
      classAOps: 0,
      classBOps: 0,
      quotaClassAOps: null,
      quotaClassBOps: null,
    })),
    download: vi.fn(async () => Buffer.from('x')),
  };
}

describe('uploadWithFailover', () => {
  it('usa o primeiro provider quando ele aceita o upload', async () => {
    const r2 = makeAdapter('r2', 'ok');
    const b2 = makeAdapter('b2', 'ok');

    const result = await uploadWithFailover([r2, b2], { buffer: Buffer.from('x'), key: 'a.pdf', contentType: 'application/pdf' });

    expect(result.provider).toBe('r2');
    expect(b2.upload).not.toHaveBeenCalled();
  });

  it('faz failover para o proximo provider quando o anterior estoura cota, registrando auditoria', async () => {
    const r2 = makeAdapter('r2', 'quota');
    const b2 = makeAdapter('b2', 'ok');
    const auditLog = vi.fn();

    const result = await uploadWithFailover([r2, b2], { buffer: Buffer.from('x'), key: 'a.pdf', contentType: 'application/pdf' }, auditLog);

    expect(result.provider).toBe('b2');
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ provider: 'r2', reason: expect.stringContaining('sem cota') }));
  });

  it('propaga erro nao relacionado a cota sem tentar o proximo provider', async () => {
    const r2 = makeAdapter('r2', 'error');
    const b2 = makeAdapter('b2', 'ok');

    await expect(
      uploadWithFailover([r2, b2], { buffer: Buffer.from('x'), key: 'a.pdf', contentType: 'application/pdf' }),
    ).rejects.toThrow('r2 falhou de verdade');
    expect(b2.upload).not.toHaveBeenCalled();
  });

  it('lanca erro quando todos os providers estouram cota', async () => {
    const r2 = makeAdapter('r2', 'quota');
    const b2 = makeAdapter('b2', 'quota');

    await expect(
      uploadWithFailover([r2, b2], { buffer: Buffer.from('x'), key: 'a.pdf', contentType: 'application/pdf' }),
    ).rejects.toThrow();
  });
});
