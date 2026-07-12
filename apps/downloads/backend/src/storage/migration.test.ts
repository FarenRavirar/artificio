import { describe, it, expect, vi } from 'vitest';
import { migrateItem, runMigrationBatch } from './migration';
import type { StorageAdapter } from './types';

// T6.4 — teste de migracao com reconciliacao de checksum, sem credencial real.

function makeAdapter(provider: StorageAdapter['provider'], store: Map<string, Buffer>): StorageAdapter {
  return {
    provider,
    upload: vi.fn(async (input) => {
      store.set(input.key, input.buffer);
      return { provider, key: input.key };
    }),
    getPublicUrl: (key) => `https://example.test/${provider}/${key}`,
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getUsage: vi.fn(async () => ({
      provider,
      usedBytes: 0,
      quotaBytes: null,
      classAOps: 0,
      classBOps: 0,
      quotaClassAOps: null,
      quotaClassBOps: null,
    })),
    download: vi.fn(async (key: string) => {
      const buffer = store.get(key);
      if (!buffer) throw new Error(`objeto nao encontrado: ${key}`);
      return buffer;
    }),
  };
}

describe('migrateItem', () => {
  it('migra e apaga da origem quando o checksum bate', async () => {
    const sourceStore = new Map([['a.pdf', Buffer.from('conteudo real')]]);
    const destStore = new Map<string, Buffer>();
    const source = makeAdapter('fastio', sourceStore);
    const destination = makeAdapter('r2', destStore);

    const result = await migrateItem({ key: 'a.pdf', contentType: 'application/pdf' }, source, destination);

    expect(result.status).toBe('migrated');
    expect(sourceStore.has('a.pdf')).toBe(false);
    expect(destStore.get('a.pdf')?.toString()).toBe('conteudo real');
  });

  it('nao apaga da origem quando o checksum diverge', async () => {
    const sourceStore = new Map([['a.pdf', Buffer.from('conteudo real')]]);
    const destStore = new Map<string, Buffer>();
    const source = makeAdapter('fastio', sourceStore);
    const destination = makeAdapter('r2', destStore);

    // Simula corrupcao no destino: upload grava um buffer diferente do lido.
    destination.upload = vi.fn(async (input) => {
      destStore.set(input.key, Buffer.from('corrompido'));
      return { provider: 'r2' as const, key: input.key };
    });

    const result = await migrateItem({ key: 'a.pdf', contentType: 'application/pdf' }, source, destination);

    expect(result.status).toBe('checksum_mismatch');
    expect(sourceStore.has('a.pdf')).toBe(true);
    expect(source.delete).not.toHaveBeenCalled();
  });

  it('retorna status error e preserva origem quando download falha', async () => {
    const sourceStore = new Map<string, Buffer>();
    const destStore = new Map<string, Buffer>();
    const source = makeAdapter('fastio', sourceStore);
    const destination = makeAdapter('r2', destStore);

    const result = await migrateItem({ key: 'inexistente.pdf', contentType: 'application/pdf' }, source, destination);

    expect(result.status).toBe('error');
    expect(result.error).toContain('objeto nao encontrado');
  });
});

describe('runMigrationBatch', () => {
  it('processa todos os items independentemente, mesmo com falha em um deles', async () => {
    const sourceStore = new Map([
      ['ok.pdf', Buffer.from('bom')],
    ]);
    const destStore = new Map<string, Buffer>();
    const source = makeAdapter('fastio', sourceStore);
    const destination = makeAdapter('r2', destStore);

    const results = await runMigrationBatch(
      [{ key: 'ok.pdf', contentType: 'application/pdf' }, { key: 'falta.pdf', contentType: 'application/pdf' }],
      source,
      destination,
    );

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('migrated');
    expect(results[1].status).toBe('error');
  });
});
