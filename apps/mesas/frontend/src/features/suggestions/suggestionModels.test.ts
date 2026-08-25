import { describe, expect, it } from 'vitest';
import {
  normalizeScenarioSuggestion,
  normalizeSuggestionList,
  normalizeSystemSuggestion,
  normalizeVttSuggestionResult,
  readApiErrorMessage,
  readBackendMessage,
  readPayloadData,
  validateVttSuggestionName,
} from './suggestionModels';

const ISO_A = '2026-08-20T10:00:00.000Z';
const ISO_B = '2026-08-24T18:30:00.000Z';

const jsonResponse = (body: unknown): Response =>
  ({ ok: true, json: async () => body }) as unknown as Response;

const htmlResponse = (): Response =>
  ({
    ok: false,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  }) as unknown as Response;

const systemRaw = {
  id: 'sys-1',
  user_id: 'user-1',
  name: 'Vampiro: A Máscara',
  name_pt: null,
  node_type: 'system',
  parent_id: null,
  batch_id: null,
  batch_index: null,
  parent_suggestion_index: null,
  description: 'Um clássico **gótico**.',
  aliases: ['Vampiro'],
  status: 'approved',
  reviewed_by: 'admin-1',
  reviewed_at: ISO_B,
  rejection_reason: null,
  user_notified: false,
  created_at: ISO_A,
  updated_at: ISO_A,
  resolution_type: 'create_system',
  resolved_system_id: 'cat-1',
  created_system_id: null,
  created_alias_id: null,
  resolution_notes: null,
  resolution_payload: {},
  resolved_at: ISO_B,
};

describe('normalizeSystemSuggestion', () => {
  it('mapeia um registro completo do listMineHandler', () => {
    const result = normalizeSystemSuggestion(systemRaw);
    expect(result).toMatchObject({
      id: 'sys-1',
      name: 'Vampiro: A Máscara',
      node_type: 'system',
      description: 'Um clássico **gótico**.',
      aliases: ['Vampiro'],
      status: 'approved',
      rejection_reason: null,
      created_at: ISO_A,
      reviewed_at: ISO_B,
    });
    expect(result?.name_pt).toBeNull();
  });

  it('descarta registro sem id ou sem nome', () => {
    expect(normalizeSystemSuggestion({ ...systemRaw, id: null })).toBeNull();
    expect(normalizeSystemSuggestion({ ...systemRaw, name: '   ' })).toBeNull();
    expect(normalizeSystemSuggestion(null)).toBeNull();
    expect(normalizeSystemSuggestion('texto')).toBeNull();
  });

  it('status e node_type desconhecidos caem nos fallbacks documentados, sem descartar o item', () => {
    const result = normalizeSystemSuggestion({
      ...systemRaw,
      status: 'changes_requested',
      node_type: 'homebrew',
    });
    expect(result?.status).toBe('pending');
    expect(result?.node_type).toBe('system');
  });

  it('datas inválidas viram null e aliases malformados viram lista vazia', () => {
    const result = normalizeSystemSuggestion({
      ...systemRaw,
      created_at: 'ontem',
      reviewed_at: 123,
      aliases: 'não-é-array',
    });
    expect(result?.created_at).toBeNull();
    expect(result?.reviewed_at).toBeNull();
    expect(result?.aliases).toEqual([]);
  });

  it('rejection_reason chega preservado quando o item foi recusado', () => {
    const result = normalizeSystemSuggestion({
      ...systemRaw,
      status: 'rejected',
      rejection_reason: 'Já existe no catálogo.',
    });
    expect(result?.status).toBe('rejected');
    expect(result?.rejection_reason).toBe('Já existe no catálogo.');
  });
});

describe('normalizeScenarioSuggestion', () => {
  const scenarioRaw = {
    id: 'scn-1',
    user_id: 'user-1',
    name: 'Fantasia Urbana',
    name_pt: null,
    description: 'Sombrio e **contemporâneo**.',
    aliases: null,
    subgenres: ['Fantasia', 'Sombrio'],
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    user_notified: false,
    created_at: ISO_A,
    updated_at: ISO_A,
  };

  it('mapeia registro completo', () => {
    const result = normalizeScenarioSuggestion(scenarioRaw);
    expect(result).toMatchObject({
      id: 'scn-1',
      name: 'Fantasia Urbana',
      subgenres: ['Fantasia', 'Sombrio'],
      status: 'pending',
      aliases: [],
      reviewed_at: null,
    });
  });

  it('subgenres ausente vira lista vazia', () => {
    const result = normalizeScenarioSuggestion({ ...scenarioRaw, subgenres: undefined });
    expect(result?.subgenres).toEqual([]);
  });
});

describe('normalizeSuggestionList', () => {
  it('filtra itens inválidos sem quebrar a lista inteira', () => {
    const items = normalizeSuggestionList(
      { data: [systemRaw, { id: null, name: 'quebrado' }, null] },
      normalizeSystemSuggestion,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('sys-1');
  });

  it('payload sem data-array devolve lista vazia', () => {
    expect(normalizeSuggestionList(null, normalizeSystemSuggestion)).toEqual([]);
    expect(normalizeSuggestionList({ data: 'x' }, normalizeSystemSuggestion)).toEqual([]);
    expect(normalizeSuggestionList({ other: [] }, normalizeSystemSuggestion)).toEqual([]);
  });
});

describe('validateVttSuggestionName', () => {
  it('espelha as mensagens do backend (vttPlatforms.ts:130-138)', () => {
    expect(validateVttSuggestionName('')).toBe('Nome da plataforma é obrigatório.');
    expect(validateVttSuggestionName('    ')).toBe('Nome da plataforma é obrigatório.');
    expect(validateVttSuggestionName('x'.repeat(101))).toBe(
      'Nome da plataforma muito longo (máximo 100 caracteres).',
    );
    expect(validateVttSuggestionName('x'.repeat(100))).toBeNull();
    expect(validateVttSuggestionName('  Foundry VTT  ')).toBeNull();
  });
});

describe('normalizeVttSuggestionResult / readPayloadData / readBackendMessage', () => {
  it('normaliza o eco 201 do POST /vtt-platforms/suggest', () => {
    const payload = {
      data: { id: 'vtt-1', suggested_name: 'Foundry VTT', created_at: ISO_A },
      message: 'Sugestão enviada com sucesso! Será analisada pela equipe.',
    };
    const result = normalizeVttSuggestionResult(readPayloadData(payload));
    expect(result).toEqual({ id: 'vtt-1', suggested_name: 'Foundry VTT', created_at: ISO_A });
    expect(readBackendMessage(payload)).toBe('Sugestão enviada com sucesso! Será analisada pela equipe.');
  });

  it('eco sem nome é descartado; payload sem data devolve null', () => {
    expect(normalizeVttSuggestionResult({ id: 'x' })).toBeNull();
    expect(readPayloadData(null)).toBeNull();
    expect(readPayloadData({ sem: 'data' })).toBeNull();
    expect(readBackendMessage({ message: '   ' })).toBeNull();
  });
});

describe('readApiErrorMessage', () => {
  it('extrai a mensagem do body { error }', async () => {
    const message = await readApiErrorMessage(
      jsonResponse({ error: 'Já existe uma sugestão pendente para "Foundry VTT".' }),
      'fallback',
    );
    expect(message).toBe('Já existe uma sugestão pendente para "Foundry VTT".');
  });

  it('usa fallback quando o corpo não é JSON', async () => {
    const message = await readApiErrorMessage(htmlResponse(), 'Erro ao enviar sugestão.');
    expect(message).toBe('Erro ao enviar sugestão.');
  });

  it('usa fallback quando error não é string', async () => {
    const message = await readApiErrorMessage(jsonResponse({ error: 123 }), 'fallback');
    expect(message).toBe('fallback');
  });
});
