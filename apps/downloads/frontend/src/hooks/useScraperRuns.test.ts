import { evaluateRunAcceptance, resolvePollInterval, type ScraperRun } from './useScraperRuns';

// Spec 089 (T5.4) — os seis critérios de aceite por run. O caso que motiva o
// teste é o da run que "completa" sem ter criado nada: executeScraperRun
// (backend/src/routes/scraper.ts:60) grava status='completed' sem olhar
// contador, então status sozinho nunca prova run saudável.

function makeRun(overrides: Partial<ScraperRun> = {}): ScraperRun {
  return {
    id: 'run-1',
    source_platform: 'opera_rpg',
    trigger_kind: 'manual',
    status: 'completed',
    items_found: 10,
    items_created: 7,
    items_skipped_duplicate: 2,
    items_skipped_not_portuguese: 1,
    items_skipped_error: 0,
    item_log_failures: 0,
    item_log_error_detail: null,
    error_detail: null,
    started_at: '2026-07-28T10:00:00.000Z',
    finished_at: '2026-07-28T10:05:00.000Z',
    ...overrides,
  };
}

// Achado de review PR #224 (Codex, P1): GET /runs compartilhava o orçamento de
// escrita (60 req/15min) e o polling perpétuo de 3s o esgotava em ~3min.
describe('resolvePollInterval', () => {
  it('mantém o polling enquanto há run ativa', () => {
    expect(resolvePollInterval([makeRun({ status: 'running' })])).toBe(3000);
  });

  it('para o polling quando nenhuma run está ativa', () => {
    expect(resolvePollInterval([makeRun({ status: 'completed' }), makeRun({ status: 'failed' })])).toBe(false);
  });

  it('para o polling com lista vazia', () => {
    expect(resolvePollInterval([])).toBe(false);
  });

  // Outra aba ou o cron podem ter iniciado run antes da primeira carga.
  it('mantém o polling enquanto a lista não carregou', () => {
    expect(resolvePollInterval(undefined)).toBe(3000);
  });
});

describe('evaluateRunAcceptance', () => {
  it('aprova run saudável com a soma fechando', () => {
    expect(evaluateRunAcceptance(makeRun())).toEqual({ passed: true, failures: [] });
  });

  it('reprova run completed que não achou nada', () => {
    const result = evaluateRunAcceptance(
      makeRun({ items_found: 0, items_created: 0, items_skipped_duplicate: 0, items_skipped_not_portuguese: 0 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('items_found = 0');
    expect(result.failures).toContain('items_created = 0');
  });

  it('reprova run que achou itens mas não criou nenhum', () => {
    const result = evaluateRunAcceptance(
      makeRun({ items_found: 5, items_created: 0, items_skipped_duplicate: 5, items_skipped_not_portuguese: 0 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('items_created = 0');
  });

  it('reprova run com item em erro', () => {
    const result = evaluateRunAcceptance(
      makeRun({ items_found: 10, items_created: 7, items_skipped_duplicate: 2, items_skipped_not_portuguese: 0, items_skipped_error: 1 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('items_skipped_error = 1');
  });

  it('reprova run concluída quando a auditoria por item perdeu linhas', () => {
    const result = evaluateRunAcceptance(makeRun({
      item_log_failures: 3,
      item_log_error_detail: 'value too long for type character varying(20)',
    }));
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('item_log_failures = 3');
  });

  it('reprova quando a soma não fecha — item sumiu sem categoria', () => {
    const result = evaluateRunAcceptance(
      makeRun({ items_found: 10, items_created: 5, items_skipped_duplicate: 1, items_skipped_not_portuguese: 1 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.startsWith('found (10) ≠'))).toBe(true);
  });

  it('reprova run que falhou', () => {
    const result = evaluateRunAcceptance(makeRun({ status: 'failed', error_detail: 'timeout' }));
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('status = failed');
  });

  it('trata contador nulo de run antiga como zero, sem quebrar', () => {
    const result = evaluateRunAcceptance(
      makeRun({ items_found: null, items_created: null, items_skipped_duplicate: null, items_skipped_not_portuguese: null, items_skipped_error: null, item_log_failures: null }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('items_found = 0');
  });
});
