import { describe, it, expect } from 'vitest';
import { mapTableApiToInitialData } from './mapTableApiToInitialData';

describe('mapTableApiToInitialData', () => {
  it('inclui id no objeto retornado (bug real: editar mesa criava mesa nova por id ausente)', () => {
    const result = mapTableApiToInitialData({ id: 'table-uuid-123', title: 'Mesa X' });
    expect(result.id).toBe('table-uuid-123');
  });

  it('id fica undefined quando ausente no payload da API', () => {
    const result = mapTableApiToInitialData({ title: 'Mesa sem id' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para string vazia (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: '', title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para string whitespace-only (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: '   ', title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('id fica undefined para valor nao-string (nao pode ativar modo edicao)', () => {
    const result = mapTableApiToInitialData({ id: 12345, title: 'Mesa X' });
    expect(result.id).toBeUndefined();
  });

  it('retorna objeto vazio para payload invalido, sem quebrar', () => {
    const result = mapTableApiToInitialData(null);
    expect(result).toEqual({});
  });

  it('popula price_value_monthly do payload na edicao', () => {
    const result = mapTableApiToInitialData({ price_value_monthly: 40 });
    expect(result.form?.price_value_monthly).toBe('40');
  });

  it('price_value_monthly fica vazio quando ausente no payload (mesa sem pacote mensal)', () => {
    const result = mapTableApiToInitialData({ price_type: 'paga', price_value: 55 });
    expect(result.form?.price_value_monthly).toBe('');
  });

  it('popula accepts_donations do payload na edicao (mesa gratuita que aceita doacoes)', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita', accepts_donations: true });
    expect(result.form?.accepts_donations).toBe(true);
  });

  it('accepts_donations fica false quando ausente no payload (mesa sem doacoes)', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita' });
    expect(result.form?.accepts_donations).toBe(false);
  });

  it('popula suggested_donation_value do payload como string na edicao', () => {
    const result = mapTableApiToInitialData({ accepts_donations: true, suggested_donation_value: 10 });
    expect(result.form?.suggested_donation_value).toBe('10');
  });

  it('suggested_donation_value fica vazio quando ausente no payload', () => {
    const result = mapTableApiToInitialData({ price_type: 'gratuita', accepts_donations: true });
    expect(result.form?.suggested_donation_value).toBe('');
  });

  it('price_type ausente vira gratuita, nao o valor fantasma legado free (achado Codex PR #283)', () => {
    const result = mapTableApiToInitialData({ title: 'Mesa X' });
    expect(result.form?.price_type).toBe('gratuita');
  });
});

/**
 * Fixture no formato REAL da resposta de GET /api/v1/gm/tables/:id
 * (gmPanel.ts:564-576): linha flat de `tables` (selectAll) + `contacts` +
 * `schedules` (selectAll de table_schedules, ordenado por sort_order) +
 * `slots_available` calculado. `is_covil` é coluna real da linha; `sessions`
 * e `is_covil_mesa` NÃO existem em resposta nenhuma.
 */
function makeRealGmPanelTable(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Mesa Covil real',
    is_covil: true,
    schedules: [
      {
        id: 'sched-1',
        table_id: '11111111-1111-1111-1111-111111111111',
        day_of_week: 'sexta',
        start_time: '19:00:00',
        end_time: '22:00:00',
        frequency: 'semanal',
        slots_per_session: 4,
        is_ongoing: false,
        notes: null,
        sort_order: 0,
        created_at: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'sched-2',
        table_id: '11111111-1111-1111-1111-111111111111',
        day_of_week: 'sábado',
        start_time: '14:00:00',
        end_time: null,
        frequency: 'semanal',
        slots_per_session: null,
        is_ongoing: false,
        notes: null,
        sort_order: 1,
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    contacts: [],
    ...overrides,
  };
}

describe('mapTableApiToInitialData — resposta real de GET /gm/tables/:id', () => {
  it('preserva todos os schedules reais da API (bug 2: lia data.sessions, que nunca existe na resposta)', () => {
    const result = mapTableApiToInitialData(makeRealGmPanelTable());

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions?.[0].day_of_week).toBe('sexta');
    expect(result.sessions?.[1].day_of_week).toBe('sábado');
  });

  it('is_covil true da API vira isCovilMesa true (bug 1: lia is_covil_mesa, que nunca existe)', () => {
    const result = mapTableApiToInitialData(makeRealGmPanelTable());

    expect(result.isCovilMesa).toBe(true);
  });

  it('is_covil false da API vira isCovilMesa false (mesa comum não vira Covil)', () => {
    const result = mapTableApiToInitialData(makeRealGmPanelTable({ is_covil: false }));

    expect(result.isCovilMesa).toBe(false);
  });

  it('schedules vazio cai no defaultSession com os hints da linha (fallback preservado)', () => {
    const result = mapTableApiToInitialData(
      makeRealGmPanelTable({
        schedules: [],
        schedule_day_status: 'defined',
        schedule_time_status: 'defined',
        schedule_day_hint: 'quarta',
        schedule_time_hint: '20:00',
      }),
    );

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions?.[0].day_of_week).toBe('quarta');
    expect(result.sessions?.[0].start_time).toBe('20:00');
  });
});

describe('mapTableApiToInitialData — age_rating (achado Codex, PR #285)', () => {
  // A coluna e nullable e faixa nula significa "nao informado". O fallback
  // 'livre' que existia aqui materializava uma faixa que o mestre nunca
  // escolheu, e o payload de edicao a gravava — inclusive editando outro
  // campo. 10 mesas em producao estao com faixa nula.
  it('faixa ausente vira string vazia, nao "livre"', () => {
    const result = mapTableApiToInitialData({ id: 'table-1', title: 'Mesa X' });
    expect(result.form?.age_rating).toBe('');
  });

  it('faixa null explicita vira string vazia, nao "livre"', () => {
    const result = mapTableApiToInitialData({ id: 'table-1', title: 'Mesa X', age_rating: null });
    expect(result.form?.age_rating).toBe('');
  });

  it('faixa real e preservada', () => {
    const result = mapTableApiToInitialData({ id: 'table-1', title: 'Mesa X', age_rating: '+16' });
    expect(result.form?.age_rating).toBe('+16');
  });

  it('"livre" salvo de verdade e preservado (distinto de ausente)', () => {
    const result = mapTableApiToInitialData({ id: 'table-1', title: 'Mesa X', age_rating: 'livre' });
    expect(result.form?.age_rating).toBe('livre');
  });
});
