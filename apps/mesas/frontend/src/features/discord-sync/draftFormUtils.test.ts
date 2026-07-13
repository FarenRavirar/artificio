// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  isRecord, asRecord, asString, asNumberString, asStringArray, asSlotsAmbiguity,
  formatFileSize, parseOptionalNonNegativeInt, parseOptionalMoney,
  validateForm, buildDraftFieldInsights, buildForm, buildUpdatedPayload, buildMissingFields,
  MAX_COVER_FILE_SIZE_BYTES, COVER_MIME_TYPES,
} from './draftFormUtils';
import type { DraftForm, DraftFrequency } from './draftFormUtils';
import type { DiscordDraftPayload, DiscordDraftTablePayload } from './types';

describe('isRecord', () => {
  it('retorna true para objeto', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('str')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord([])).toBe(false);
  });
});

describe('asRecord', () => {
  it('retorna o objeto ou fallback vazio', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toEqual({});
    expect(asRecord('str')).toEqual({});
  });
});

describe('asString', () => {
  it('retorna string ou vazio', () => {
    expect(asString('hello')).toBe('hello');
    expect(asString(42)).toBe('');
    expect(asString(null)).toBe('');
    expect(asString(undefined)).toBe('');
  });
});

describe('asNumberString', () => {
  it('retorna string do numero ou vazio', () => {
    expect(asNumberString(42)).toBe('42');
    expect(asNumberString(0)).toBe('0');
    expect(asNumberString(null)).toBe('');
    expect(asNumberString(undefined)).toBe('');
    expect(asNumberString(NaN)).toBe('');
    expect(asNumberString(Infinity)).toBe('');
  });
});

describe('asStringArray', () => {
  it('filtra apenas strings do array', () => {
    expect(asStringArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(asStringArray(['a', 42, null, 'c'])).toEqual(['a', 'c']);
    expect(asStringArray(null)).toEqual([]);
    expect(asStringArray('str')).toEqual([]);
  });
});

describe('asSlotsAmbiguity', () => {
  it('retorna null se nao for objeto valido', () => {
    expect(asSlotsAmbiguity(null)).toBeNull();
    expect(asSlotsAmbiguity('str')).toBeNull();
    expect(asSlotsAmbiguity({})).toBeNull();
  });

  it('retorna objeto se tiver first/second numericos e source x_slash_y', () => {
    const result = asSlotsAmbiguity({ first: 3, second: 5, source: 'x_slash_y' });
    expect(result).toEqual({ first: 3, second: 5, source: 'x_slash_y' });
  });

  it('retorna null se source for diferente', () => {
    expect(asSlotsAmbiguity({ first: 3, second: 5, source: 'other' })).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('formata bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formata KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048575)).toBe('1024.0 KB');
  });

  it('formata MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });
});

describe('parseOptionalNonNegativeInt', () => {
  it('retorna null para vazio', () => {
    expect(parseOptionalNonNegativeInt('')).toBeNull();
    expect(parseOptionalNonNegativeInt('  ')).toBeNull();
  });

  it('parseia inteiro nao negativo', () => {
    expect(parseOptionalNonNegativeInt('0')).toBe(0);
    expect(parseOptionalNonNegativeInt('5')).toBe(5);
    expect(parseOptionalNonNegativeInt('100')).toBe(100);
  });

  it('retorna null para negativo ou nao inteiro', () => {
    expect(parseOptionalNonNegativeInt('-1')).toBeNull();
    expect(parseOptionalNonNegativeInt('1.5')).toBeNull();
    expect(parseOptionalNonNegativeInt('abc')).toBeNull();
  });
});

describe('parseOptionalMoney', () => {
  it('retorna null para vazio', () => {
    expect(parseOptionalMoney('')).toBeNull();
  });

  it('parseia valor com virgula', () => {
    expect(parseOptionalMoney('10,50')).toBe(10.5);
    expect(parseOptionalMoney('0')).toBe(0);
    expect(parseOptionalMoney('100')).toBe(100);
  });

  it('retorna null para negativo ou invalido', () => {
    expect(parseOptionalMoney('-5')).toBeNull();
    expect(parseOptionalMoney('abc')).toBeNull();
  });
});

describe('validateForm', () => {
  const validForm: DraftForm = {
    title: 'Mesa Teste',
    description: 'Descricao',
    system_id: 'sys-1',
    system_name: 'D&D',
    type: 'campanha',
    modality: 'online',
    price_type: 'gratuita',
    price_value: '',
    slots_total: '4',
    slots_open: '2',
    day_of_week: 'sábado',
    start_time: '19:00',
    frequency: 'semanal',
    contact_url: 'https://discord.gg/abc',
    contact_discord: '',
    cover_url: '',
    cover_url_source: '',
    cover_quality: '',
    age_rating: '',
    experience_level: '',
    table_level: '',
    setting_name: '',
    setting_styles: '',
    requires_pc: false,
    requires_camera: false,
    requires_microphone: false,
    session_zero_free: false,
    scenario_id: '',
    vtt_platform_id: '',
    communication_platform_id: '',
  };

  it('retorna vazio para formulario valido', () => {
    expect(validateForm(validForm)).toEqual([]);
  });

  it('retorna campos obrigatorios faltando', () => {
    // start_time '' é válido agora ("a definir", achado 2026-07-13) — usa
    // valor malformado pra testar o caso genuinamente faltando/inválido.
    const missing = validateForm({
      ...validForm,
      title: '',
      description: '',
      system_id: '',
      slots_total: '',
      slots_open: '',
      contact_url: '',
      contact_discord: '',
      day_of_week: '' as DraftForm['day_of_week'],
      start_time: '19h',
    });
    expect(missing).toContain('Título');
    expect(missing).toContain('Descrição');
    expect(missing).toContain('Sistema');
    expect(missing).toContain('Contato');
    expect(missing).toContain('Dia');
    expect(missing).toContain('Horário');
  });

  it('aceita day_of_week "to_define" e start_time vazio como "a definir" (achado 2026-07-13)', () => {
    const missing = validateForm({ ...validForm, day_of_week: 'to_define', start_time: '' });
    expect(missing).not.toContain('Dia');
    expect(missing).not.toContain('Horário');
  });

  it('retorna Vagas como pendente se ambos slots forem vazios', () => {
    const missing = validateForm({ ...validForm, slots_total: '', slots_open: '' });
    expect(missing).toContain('Vagas');
  });

  it('vagas sao validas se pelo menos um slot tiver valor', () => {
    const missing1 = validateForm({ ...validForm, slots_total: '4', slots_open: '' });
    expect(missing1).not.toContain('Vagas');
    const missing2 = validateForm({ ...validForm, slots_total: '', slots_open: '2' });
    expect(missing2).not.toContain('Vagas');
  });

  it('contato valido se pelo menos um campo preenchido', () => {
    const missing1 = validateForm({ ...validForm, contact_url: 'https://example.com', contact_discord: '' });
    expect(missing1).not.toContain('Contato');
    const missing2 = validateForm({ ...validForm, contact_url: '', contact_discord: 'user#1234' });
    expect(missing2).not.toContain('Contato');
  });

  it('retorna Frequencia como pendente se for valor fora do enum', () => {
    // "outra" foi removida do tipo (achado 2026-07-13, form manual nunca teve
    // essa opcao) — testa fora do enum via cast, igual aos outros campos.
    const missing = validateForm({ ...validForm, frequency: 'fora_do_enum' as DraftFrequency });
    expect(missing).toContain('Frequência');
  });
});

describe('buildForm', () => {
  function makePayload(table: Partial<DiscordDraftTablePayload>): DiscordDraftPayload {
    return { table } as unknown as DiscordDraftPayload;
  }

  it('constroi DraftForm a partir de payload', () => {
    const form = buildForm(makePayload({
      title: 'Mesa Teste',
      description: 'Desc',
      system_id: 'sys-1',
      system_name: 'D&D',
      type: 'one-shot',
      modality: 'presencial',
      price_type: 'paga',
      price_value: 25,
      slots_total: 4,
      slots_open: 1,
      day_of_week: 'sábado',
      start_time: '20:00',
      frequency: 'quinzenal',
      contact_url: 'https://example.com',
      contact_discord: '',
      cover_url: 'https://img.com/capa.jpg',
      cover_url_source: '',
      cover_quality: 'standard',
    }));
    expect(form.title).toBe('Mesa Teste');
    expect(form.type).toBe('one-shot');
    expect(form.modality).toBe('presencial');
    expect(form.price_type).toBe('paga');
    expect(form.price_value).toBe('25');
    expect(form.slots_total).toBe('4');
    expect(form.slots_open).toBe('1');
    expect(form.day_of_week).toBe('sábado');
    expect(form.start_time).toBe('20:00');
    expect(form.frequency).toBe('quinzenal');
    expect(form.cover_url).toBe('https://img.com/capa.jpg');
    expect(form.cover_quality).toBe('standard');
  });

  it('usa defaults para campos vazios', () => {
    const form = buildForm(makePayload({}));
    expect(form.type).toBe('campanha');
    expect(form.modality).toBe('online');
    expect(form.price_type).toBe('gratuita');
    expect(form.frequency).toBe('semanal');
    expect(form.day_of_week).toBe('');
    expect(form.slots_total).toBe('');
  });
});

describe('buildMissingFields', () => {
  function makeBase(extra?: Partial<DiscordDraftPayload>): DiscordDraftPayload {
    return { missing_fields: [], table: {}, ...extra } as unknown as DiscordDraftPayload;
  }

  it('inclui campos que estao vazios no form', () => {
    const base = makeBase({ table: { raw_system_hint: 'D&D' } as DiscordDraftTablePayload });
    // start_time '' é válido agora ("a definir", achado 2026-07-13) — usa
    // valor malformado pra testar o caso genuinamente faltando/inválido.
    const form: DraftForm = {
      title: '', description: 'ok', system_id: '', system_name: '',
      type: '' as DraftForm['type'], modality: 'online', price_type: 'gratuita', price_value: '',
      slots_total: '', slots_open: '', day_of_week: '' as DraftForm['day_of_week'],
      start_time: '19h', frequency: 'semanal', contact_url: '', contact_discord: '',
      cover_url: '', cover_url_source: '', cover_quality: '',
      age_rating: '', experience_level: '', table_level: '', setting_name: '', setting_styles: '',
      requires_pc: false, requires_camera: false, requires_microphone: false, session_zero_free: false,
      scenario_id: '', vtt_platform_id: '', communication_platform_id: '',
    };
    const missing = buildMissingFields(base, form);
    expect(missing).toContain('title');
    expect(missing).toContain('system_name');
    expect(missing).toContain('system_name:unmatched_hint');
    expect(missing).toContain('type');
    expect(missing).toContain('slots_total');
    expect(missing).toContain('contact_url');
    expect(missing).toContain('day_of_week');
    expect(missing).toContain('start_time');
  });

  it('nao inclui day_of_week/start_time quando sao "a definir" (achado 2026-07-13)', () => {
    const base = makeBase({ table: { raw_system_hint: 'D&D' } as DiscordDraftTablePayload });
    const form: DraftForm = {
      title: 'ok', description: 'ok', system_id: 'sys-1', system_name: '',
      type: 'campanha', modality: 'online', price_type: 'gratuita', price_value: '',
      slots_total: '4', slots_open: '4', day_of_week: 'to_define',
      start_time: '', frequency: 'semanal', contact_url: 'https://example.com', contact_discord: '',
      cover_url: '', cover_url_source: '', cover_quality: '',
      age_rating: '', experience_level: '', table_level: '', setting_name: '', setting_styles: '',
      requires_pc: false, requires_camera: false, requires_microphone: false, session_zero_free: false,
      scenario_id: '', vtt_platform_id: '', communication_platform_id: '',
    };
    const missing = buildMissingFields(base, form);
    expect(missing).not.toContain('day_of_week');
    expect(missing).not.toContain('start_time');
  });
});

describe('buildUpdatedPayload', () => {
  function makeBase(): DiscordDraftPayload {
    return { table: {}, missing_fields: [] } as unknown as DiscordDraftPayload;
  }

  it('constroi payload atualizado a partir do form', () => {
    const form: DraftForm = {
      title: 'Atualizado', description: 'Nova desc', system_id: 'sys-1', system_name: 'D&D',
      type: 'campanha', modality: 'online', price_type: 'gratuita', price_value: '',
      slots_total: '6', slots_open: '3', day_of_week: 'sábado', start_time: '20:00',
      frequency: 'semanal', contact_url: 'https://example.com', contact_discord: '',
      cover_url: '', cover_url_source: '', cover_quality: '',
      age_rating: '', experience_level: '', table_level: '', setting_name: '', setting_styles: '',
      requires_pc: false, requires_camera: false, requires_microphone: false, session_zero_free: false,
      scenario_id: '', vtt_platform_id: '', communication_platform_id: '',
    };
    const payload = buildUpdatedPayload(makeBase(), form);
    expect(payload.kind).toBe('table_draft');
    expect((payload.table as Record<string, unknown>).title).toBe('Atualizado');
    expect((payload.table as Record<string, unknown>).slots_total).toBe(6);
    expect((payload.table as Record<string, unknown>).slots_open).toBe(3);
  });

  it('preco paga persiste price_value como numero', () => {
    const form: DraftForm = {
      title: 'Mesa', description: 'Desc', system_id: 'sys-1', system_name: 'D&D',
      type: 'campanha', modality: 'online', price_type: 'paga', price_value: '15,50',
      slots_total: '4', slots_open: '2', day_of_week: 'sábado', start_time: '20:00',
      frequency: 'semanal', contact_url: '', contact_discord: 'user#1234',
      cover_url: '', cover_url_source: '', cover_quality: '',
      age_rating: '', experience_level: '', table_level: '', setting_name: '', setting_styles: '',
      requires_pc: false, requires_camera: false, requires_microphone: false, session_zero_free: false,
      scenario_id: '', vtt_platform_id: '', communication_platform_id: '',
    };
    const payload = buildUpdatedPayload(makeBase(), form);
    expect((payload.table as Record<string, unknown>).price_value).toBe(15.5);
  });

  it('preco gratuito zera price_value', () => {
    const form: DraftForm = {
      title: 'Mesa', description: 'Desc', system_id: 'sys-1', system_name: 'D&D',
      type: 'campanha', modality: 'online', price_type: 'gratuita', price_value: '50',
      slots_total: '4', slots_open: '2', day_of_week: 'sábado', start_time: '20:00',
      frequency: 'semanal', contact_url: '', contact_discord: 'user#1234',
      cover_url: '', cover_url_source: '', cover_quality: '',
      age_rating: '', experience_level: '', table_level: '', setting_name: '', setting_styles: '',
      requires_pc: false, requires_camera: false, requires_microphone: false, session_zero_free: false,
      scenario_id: '', vtt_platform_id: '', communication_platform_id: '',
    };
    const payload = buildUpdatedPayload(makeBase(), form);
    expect((payload.table as Record<string, unknown>).price_value).toBeNull();
  });
});

describe('buildDraftFieldInsights', () => {
  it('marca campo preenchido pelo parser e anexa evidencia bruta', () => {
    const payload = {
      table: {
        title: 'Mesa',
        contact_discord: '<@123>',
        _raw_evidence: { user_mentions: ['<@123>'] },
      },
    } as unknown as DiscordDraftPayload;

    const insights = buildDraftFieldInsights(payload, payload);

    expect(insights.title?.source).toBe('parser');
    expect(insights.title?.evidence).toContain('Valor extraído do anúncio.');
    expect(insights.contact_discord?.evidence).toContain('1 menção(ões) de usuário no anúncio.');
  });

  it('marca humano quando normalizado diverge do parse bruto', () => {
    const parsed = { table: { title: 'Mesa original' } } as unknown as DiscordDraftPayload;
    const current = { table: { title: 'Mesa corrigida' } } as unknown as DiscordDraftPayload;

    const insights = buildDraftFieldInsights(parsed, current);

    expect(insights.title).toEqual({
      source: 'humano',
      evidence: ['Valor alterado na revisão.'],
    });
  });

  it('marca sugestoes pendentes de learning-store ou DeepSeek', () => {
    const parsed = { table: {} } as unknown as DiscordDraftPayload;
    const current = {
      table: {
        _ai_suggestions: {
          provider: 'learning-rules+deepseek',
          model: 'deepseek-chat',
          fields: { system_name: 'D&D 5e' },
        },
      },
    } as unknown as DiscordDraftPayload;

    const insights = buildDraftFieldInsights(parsed, current);

    expect(insights.system_name).toMatchObject({
      source: 'learning-store',
      suggestion: 'D&D 5e',
      provider: 'learning-rules+deepseek',
      model: 'deepseek-chat',
    });
  });
});

describe('MAX_COVER_FILE_SIZE_BYTES', () => {
  it('deve ser 5 MB', () => {
    expect(MAX_COVER_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('COVER_MIME_TYPES', () => {
  it('deve conter jpeg, png e webp', () => {
    expect(COVER_MIME_TYPES).toContain('image/jpeg');
    expect(COVER_MIME_TYPES).toContain('image/png');
    expect(COVER_MIME_TYPES).toContain('image/webp');
  });
});
