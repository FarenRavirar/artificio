import { describe, expect, it } from 'vitest';
import { inboxSyncConfig } from './syncImportDraftToTable.js';
import type { ImportTableDraft } from '../discord/types.js';

function makePayload(overrides: { raw_gm_name?: string | null; author_name?: string | null } = {}): ImportTableDraft {
  return {
    table: { raw_gm_name: overrides.raw_gm_name ?? null } as ImportTableDraft['table'],
    source: { author_name: overrides.author_name ?? null } as ImportTableDraft['source'],
  } as ImportTableDraft;
}

describe('inboxSyncConfig.getGmName (requisito 7, spec 079)', () => {
  it('admin logado (adminDisplayName) tem prioridade máxima — confirmação humana explícita', () => {
    const payload = makePayload({ raw_gm_name: 'Mariana', author_name: null });
    expect(inboxSyncConfig.getGmName(payload, 'Admin Logado')).toBe('Admin Logado');
  });

  it('sem adminDisplayName, prefere raw_gm_name extraído do texto', () => {
    const payload = makePayload({ raw_gm_name: 'Mariana' });
    expect(inboxSyncConfig.getGmName(payload, undefined)).toBe('Mariana');
  });

  it('cai para author_name (sempre null em texto colado manual) quando raw_gm_name ausente', () => {
    const payload = makePayload({ raw_gm_name: null, author_name: null });
    expect(inboxSyncConfig.getGmName(payload, undefined)).toBeNull();
  });
});
