import { describe, it, expect } from 'vitest';
import { formStateToPayload, normalizePriceType } from './mapper';
import type { FormState } from '../types/createTable.types';

/**
 * Fixture minima mas completa do schema real (tsconfig.test.json type-checka
 * o arquivo inteiro, entao o estado precisa satisfazer FormState de verdade).
 */
function makeState(overrides: {
  price_type?: string;
  price_value?: string;
  price_value_monthly?: string;
  accepts_donations?: boolean;
  suggested_donation_value?: string;
  table_level?: string;
  slots_total?: string;
  slots_open?: string;
  age_rating?: string;
} = {}): FormState {
  const state: FormState = {
    form: {
      title: 'Mesa de teste',
      description: '',
      type: 'campanha',
      modality: 'online',
      audience: 'livre',
      age_rating: overrides.age_rating ?? 'livre',
      price_type: overrides.price_type ?? 'paga',
      price_value: overrides.price_value ?? '25',
      price_value_monthly: overrides.price_value_monthly,
      accepts_donations: overrides.accepts_donations ?? false,
      suggested_donation_value: overrides.suggested_donation_value,
      slots_total: overrides.slots_total ?? '4',
      slots_open: overrides.slots_open ?? '4',
      experience_level: 'todos',
      table_level: overrides.table_level ?? '',
      language: 'pt-BR',
    },
    selectedSystemId: 'system-1',
    selectedScenarioId: null,
    sessions: [{
      day_of_week: 'segunda',
      start_time: '19:00',
      end_time: '22:00',
      frequency: 'semanal',
      is_ongoing: false,
      notes: '',
      sort_order: 0,
    }],
    vttPlatformId: '',
    gamePlatformCustom: '',
    communicationPlatformId: '',
    communicationPlatformCustom: '',
    publisherRole: 'gm',
    actualGmName: '',
    contacts: [{ channel: 'whatsapp', value: '', label: '', discord_server_url: '' }],
    rulesNotes: '',
    bannerUrl: '',
    bannerCropData: null,
    bannerWidth: null,
    bannerHeight: null,
    isCovilMesa: false,
    ddal: {
      is_ddal: false,
      ddal_code: '',
      ddal_name: '',
      ddal_tier: '',
      ddal_season: '',
      ddal_duration: '',
      ddal_format: '',
      ddal_org_code: '',
      ddal_setting: '',
      ddal_rules_notes: '',
    },
    masterDisplayName: '',
    campaignLength: '',
    levelRange: '',
    billingText: '',
    sessionZeroFree: false,
    synopsis: '',
    styleText: '',
    listingExcerpt: '',
    technicalRequirements: '',
    requiresPc: false,
    requiresCamera: false,
    requiresMicrophone: false,
    settingName: '',
    settingStyles: [],
    synopsisNarrative: '',
    benefitsText: '',
    tableGmBio: '',
    parseCaseId: null,
  };

  // price_value é `string` no tipo, mas draft storage pode entregar undefined;
  // `in` distingue "não passou" (default '25') de "passou undefined" (caso real).
  if ('price_value' in overrides) {
    state.form.price_value = overrides.price_value as string;
  }

  return state;
}

describe('formStateToPayload — price_value_monthly', () => {
  it('string nao numerica vira campo ausente no payload (auditoria A4: NaN serializava como null e limpava o campo)', () => {
    const payload = formStateToPayload(makeState({ price_value_monthly: 'abc' }));
    expect(payload.price_value_monthly).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('price_value_monthly');
  });

  it('numero valido passa inteiro', () => {
    const payload = formStateToPayload(makeState({ price_value_monthly: '40' }));
    expect(payload.price_value_monthly).toBe(40);
  });

  it('decimal valido passa como number', () => {
    const payload = formStateToPayload(makeState({ price_value_monthly: '39.90' }));
    expect(payload.price_value_monthly).toBe(39.9);
  });

  it('string vazia vira null no payload (auditoria final #1: vazio = limpar no banco, backend zera)', () => {
    const payload = formStateToPayload(makeState({ price_value_monthly: '' }));
    expect(payload.price_value_monthly).toBeNull();
    expect(JSON.stringify(payload)).toContain('"price_value_monthly":null');
  });

  it('campo indefinido vira campo ausente (backend preserva o valor salvo)', () => {
    const payload = formStateToPayload(makeState({ price_value_monthly: undefined }));
    expect(payload.price_value_monthly).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('price_value_monthly');
  });
});

describe('formStateToPayload — price_value', () => {
  it('string nao numerica vira campo ausente no payload serializado (mesmo guard NaN da correcao pos-auditoria, sessao 26-08-22_1)', () => {
    const payload = formStateToPayload(makeState({ price_value: 'abc' }));
    expect(payload.price_value).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('"price_value":');
  });

  it('numero valido passa inteiro', () => {
    const payload = formStateToPayload(makeState({ price_value: '40' }));
    expect(payload.price_value).toBe(40);
  });

  it('string vazia vira campo ausente', () => {
    const payload = formStateToPayload(makeState({ price_value: '' }));
    expect(payload.price_value).toBeUndefined();
  });

  it('campo indefinido vira campo ausente', () => {
    const payload = formStateToPayload(makeState({ price_value: undefined }));
    expect(payload.price_value).toBeUndefined();
  });
});

describe('formStateToPayload — doações (mesa gratuita)', () => {
  it('envia accepts_donations true quando marcado', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: true }));
    expect(payload.accepts_donations).toBe(true);
  });

  it('envia accepts_donations false quando desmarcado (nunca omite o flag)', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: false }));
    expect(payload.accepts_donations).toBe(false);
  });

  it('valor sugerido válido passa como number', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: true, suggested_donation_value: '10' }));
    expect(payload.suggested_donation_value).toBe(10);
  });

  it('valor sugerido decimal passa como number', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: true, suggested_donation_value: '9.90' }));
    expect(payload.suggested_donation_value).toBe(9.9);
  });

  it('valor sugerido vazio vira null no payload (auditoria final #2: desmarcar doações zera no banco)', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: true, suggested_donation_value: '' }));
    expect(payload.suggested_donation_value).toBeNull();
    expect(JSON.stringify(payload)).toContain('"suggested_donation_value":null');
  });

  it('valor sugerido não numérico vira campo ausente (guard Number.isFinite)', () => {
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: true, suggested_donation_value: 'abc' }));
    expect(payload.suggested_donation_value).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('suggested_donation_value');
  });

  it('valor sugerido ausente com doações desmarcadas vira null (zera o salvo — desmarcar limpa a sugestão, achado Codex PR #283)', () => {
    // Comportamento antigo (undefined = omitir) preservaria o valor sugerido
    // salvo junto de accepts_donations false — estado que o backend rejeita.
    const payload = formStateToPayload(makeState({ price_type: 'gratuita', accepts_donations: false, suggested_donation_value: undefined }));
    expect(payload.suggested_donation_value).toBeNull();
    expect(JSON.stringify(payload)).toContain('"suggested_donation_value":null');
  });

  it('valor residual com doações desmarcadas vira null, não rejeita o save (achado Codex PR #283)', () => {
    // Usuário digitou sugestão, desmarcou "Aceita doações" e o state reteve o
    // texto (input escondido). Enviar o residual dispararia 400 "Valor
    // sugerido exige marcar 'Aceita doações'" e quebraria o save sem mensagem.
    const payload = formStateToPayload(makeState({
      price_type: 'gratuita',
      accepts_donations: false,
      suggested_donation_value: '20',
    }));
    expect(payload.accepts_donations).toBe(false);
    expect(payload.suggested_donation_value).toBeNull();
    expect(JSON.stringify(payload)).toContain('"suggested_donation_value":null');
  });
});

describe('formStateToPayload — campos por modalidade (endurecimento A2)', () => {
  it('mesa paga: price_value número e doações zeradas (false/null), mesmo com state residual de doação', () => {
    const payload = formStateToPayload(makeState({
      price_type: 'paga',
      price_value: '55',
      price_value_monthly: '40',
      accepts_donations: true,
      suggested_donation_value: '10',
    }));

    expect(payload.price_value).toBe(55);
    expect(payload.price_value_monthly).toBe(40);
    expect(payload.accepts_donations).toBe(false);
    expect(payload.suggested_donation_value).toBeNull();
    expect(JSON.stringify(payload)).toContain('"suggested_donation_value":null');
  });

  it('mesa gratuita: preços zerados (null) e doações conforme o state', () => {
    const payload = formStateToPayload(makeState({
      price_type: 'gratuita',
      accepts_donations: true,
      suggested_donation_value: '10',
    }));

    expect(payload.price_value).toBeNull();
    expect(payload.price_value_monthly).toBeNull();
    expect(payload.accepts_donations).toBe(true);
    expect(payload.suggested_donation_value).toBe(10);
    expect(JSON.stringify(payload)).toContain('"price_value":null');
    expect(JSON.stringify(payload)).toContain('"price_value_monthly":null');
  });

  it('transição paga→gratuita com valores residuais de preço: payload zera os preços no banco', () => {
    // State residual de mesa que era paga (preços ainda preenchidos) trocada
    // para gratuita: sem o zero por modalidade, o payload mandaria os preços
    // junto e o validador A2 do backend rejeitaria a troca.
    const payload = formStateToPayload(makeState({
      price_type: 'gratuita',
      price_value: '55',
      price_value_monthly: '40',
      accepts_donations: true,
      suggested_donation_value: '10',
    }));

    expect(payload.price_value).toBeNull();
    expect(payload.price_value_monthly).toBeNull();
    expect(payload.accepts_donations).toBe(true);
    expect(payload.suggested_donation_value).toBe(10);
  });

  it('transição gratuita→paga com valores residuais de doação: payload zera as doações', () => {
    const payload = formStateToPayload(makeState({
      price_type: 'paga',
      price_value: '55',
      accepts_donations: true,
      suggested_donation_value: '10',
    }));

    expect(payload.price_value).toBe(55);
    expect(payload.accepts_donations).toBe(false);
    expect(payload.suggested_donation_value).toBeNull();
  });
});

describe('normalizePriceType — legado free/paid (achado Codex PR #283)', () => {
  it("'free' vira 'gratuita' (valor fantasma do form antigo; nunca existiu no banco)", () => {
    expect(normalizePriceType('free')).toBe('gratuita');
  });

  it("'paid' (draft antigo em inglês) vira 'paga'", () => {
    expect(normalizePriceType('paid')).toBe('paga');
  });

  it('undefined/null viram gratuita (default do produto)', () => {
    expect(normalizePriceType(undefined)).toBe('gratuita');
    expect(normalizePriceType(null)).toBe('gratuita');
  });

  it('valores atuais passam intactos', () => {
    expect(normalizePriceType('gratuita')).toBe('gratuita');
    expect(normalizePriceType('paga')).toBe('paga');
  });
});

describe('formStateToPayload — age_rating e table_level (T3.2, spec 096)', () => {
  it('envia age_rating escolhida no form (+18 não vira o default do banco)', () => {
    const payload = formStateToPayload(makeState({ age_rating: '+18' }));
    expect(payload.age_rating).toBe('+18');
    expect(JSON.stringify(payload)).toContain('"age_rating":"+18"');
  });

  it('envia table_level escolhida no form (avancado não vira o default do banco)', () => {
    const payload = formStateToPayload(makeState({ table_level: 'avancado' }));
    expect(payload.table_level).toBe('avancado');
    expect(JSON.stringify(payload)).toContain('"table_level":"avancado"');
  });

  it('table_level vazio (não escolhido) omite o campo — create usa o DEFAULT do banco e PUT preserva o salvo', () => {
    const payload = formStateToPayload(makeState({ table_level: '' }));
    expect(payload.table_level).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('table_level');
  });

  it('table_level "todos" (valor real do enum do banco) é enviado', () => {
    const payload = formStateToPayload(makeState({ table_level: 'todos' }));
    expect(payload.table_level).toBe('todos');
  });
});

describe('formStateToPayload — gm_avatar_url fora do contrato do form (T3.2c, spec 096)', () => {
  it('payload não contém gm_avatar_url (decisão 2026-08-23 opção C; o alias da resposta da API continua)', () => {
    const payload = formStateToPayload(makeState({}));
    expect('gm_avatar_url' in payload).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('gm_avatar_url');
  });
});

describe('formStateToPayload — slots_filled (T3.2d, spec 096)', () => {
  it('deriva slots_filled = total - abertas (mesma semântica do parser, parseDiscordAnnouncement.ts:2820)', () => {
    const payload = formStateToPayload(makeState({ slots_total: '4', slots_open: '2' }));
    expect(payload.slots_filled).toBe(2);
    expect(JSON.stringify(payload)).toContain('"slots_filled":2');
  });

  it('todas as vagas abertas → slots_filled 0 (mesa nova padrão)', () => {
    const payload = formStateToPayload(makeState({ slots_total: '4', slots_open: '4' }));
    expect(payload.slots_filled).toBe(0);
  });

  it('recrutamento fechado (0 abertas) → slots_filled igual ao total', () => {
    const payload = formStateToPayload(makeState({ slots_total: '4', slots_open: '0' }));
    expect(payload.slots_filled).toBe(4);
  });

  it('abertas maiores que o total (estado inválido) clampa para 0 em vez de negativo', () => {
    const payload = formStateToPayload(makeState({ slots_total: '4', slots_open: '9' }));
    expect(payload.slots_filled).toBe(0);
  });
});
