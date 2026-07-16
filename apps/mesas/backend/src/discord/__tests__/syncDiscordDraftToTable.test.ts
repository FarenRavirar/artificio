import type { Mock } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
  },
}));

vi.mock('../syncHelpers', () => ({
  syncDraftToTable: vi.fn(),
  normalizeImportTableDraft: vi.fn(),
  uploadCoverForDraft: vi.fn(),
  readCoverSource: vi.fn(),
  withCoverUrl: vi.fn(),
  updateDraftImageUploadState: vi.fn(),
}));

import { DiscordDraftSyncValidationError, syncDiscordDraftToTable, refreshDiscordDraftImage, discordSyncConfig } from '../syncDiscordDraftToTable';
import { syncDraftToTable, normalizeImportTableDraft, uploadCoverForDraft, withCoverUrl, updateDraftImageUploadState } from '../syncHelpers';
import { db } from '../../db';
import type { ImportTableDraft } from '../types';

function makePayload(overrides: { raw_gm_name?: string | null; author_name?: string | null } = {}): ImportTableDraft {
  return {
    table: { raw_gm_name: overrides.raw_gm_name ?? null } as ImportTableDraft['table'],
    source: { author_name: overrides.author_name ?? null } as ImportTableDraft['source'],
  } as ImportTableDraft;
}

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow', 'set'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

describe('DiscordDraftSyncValidationError', () => {
  it('creates error with missing fields in message', () => {
    const error = new DiscordDraftSyncValidationError(['day_of_week', 'description']);
    expect(error.message).toContain('day_of_week');
    expect(error.message).toContain('description');
    expect(error.missingFields).toEqual(['day_of_week', 'description']);
    expect(error.name).toBe('DiscordDraftSyncValidationError');
  });

  it('works with empty missing fields', () => {
    const error = new DiscordDraftSyncValidationError([]);
    expect(error.missingFields).toEqual([]);
    expect(error.name).toBe('DiscordDraftSyncValidationError');
  });
});

describe('syncDiscordDraftToTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls syncDraftToTable with discordSyncConfig and returns result', async () => {
    const mockResult = { tableId: 'abc', created: true };
    (syncDraftToTable as Mock).mockResolvedValue(mockResult);

    const result = await syncDiscordDraftToTable('draft-1');

    expect(syncDraftToTable).toHaveBeenCalledWith('draft-1', expect.any(Object));
    expect(result).toEqual(mockResult);
  });
});

describe('discordSyncConfig.getGmName (requisito 7, spec 079)', () => {
  it('prefere raw_gm_name (extraído do texto) quando presente', () => {
    const payload = makePayload({ raw_gm_name: 'Mariana', author_name: 'EzPhilipp' });
    expect(discordSyncConfig.getGmName(payload)).toBe('Mariana');
  });

  it('cai para author_name quando raw_gm_name está ausente (comportamento estável anterior)', () => {
    const payload = makePayload({ raw_gm_name: null, author_name: 'EzPhilipp' });
    expect(discordSyncConfig.getGmName(payload)).toBe('EzPhilipp');
  });

  it('retorna null quando nem texto nem autor têm nome', () => {
    const payload = makePayload({ raw_gm_name: null, author_name: null });
    expect(discordSyncConfig.getGmName(payload)).toBeNull();
  });
});

describe('refreshDiscordDraftImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads draft, normalizes payload, uploads cover, updates state, and returns result', async () => {
    const mockDraft = {
      id: 'draft-1',
      table_id: 'table-1',
      normalized_payload: { table: { title: 'Test Mesa' }, source: { author_name: 'GM' } },
      parsed_payload: null,
      image_upload_attempts: 0,
    };
    const mockPayload = { table: { title: 'Test Mesa' }, source: { author_name: 'GM' } };
    const mockUpload = { coverUrl: 'https://img.example.com/capa.jpg', payload: mockPayload, status: 'success' as const, attempts: 1, error: null as string | null };

    const selectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(mockDraft) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);
    const updateChain = mockChain({ execute: vi.fn().mockResolvedValue(undefined) });
    (db.updateTable as Mock).mockReturnValue(updateChain);
    (normalizeImportTableDraft as Mock).mockReturnValue(mockPayload);
    (withCoverUrl as Mock).mockReturnValue(mockPayload);
    (uploadCoverForDraft as Mock).mockResolvedValue(mockUpload);
    (updateDraftImageUploadState as Mock).mockResolvedValue(undefined);

    const result = await refreshDiscordDraftImage('draft-1');

    expect(normalizeImportTableDraft).toHaveBeenCalledWith(mockDraft.normalized_payload);
    expect(withCoverUrl).toHaveBeenCalledWith(mockPayload, null);
    expect(uploadCoverForDraft).toHaveBeenCalled();
    expect(updateDraftImageUploadState).toHaveBeenCalled();
    expect(result).toEqual({
      draftId: 'draft-1',
      tableId: 'table-1',
      status: 'success',
      url: 'https://img.example.com/capa.jpg',
      error: null,
    });
  });

  it('throws when draft not found', async () => {
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(null) });
    (db.selectFrom as Mock).mockReturnValue(chain);

    await expect(refreshDiscordDraftImage('nonexistent')).rejects.toThrow('não encontrado');
  });

  it('throws when payload has no table data', async () => {
    const mockDraft = {
      id: 'draft-2',
      table_id: null,
      normalized_payload: { source: { author_name: 'GM' } },
      parsed_payload: null,
      image_upload_attempts: 0,
    };
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(mockDraft) });
    (db.selectFrom as Mock).mockReturnValue(chain);
    (normalizeImportTableDraft as Mock).mockReturnValue({ source: { author_name: 'GM' } });

    await expect(refreshDiscordDraftImage('draft-2')).rejects.toThrow('sem payload válido');
  });
});
