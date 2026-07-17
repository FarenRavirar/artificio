import {
  buildMerge,
  MAX_MERGED_ERRORS,
  type MergeableFeedback,
} from '../devFeedbackMerge.js';

const base = (over: Partial<MergeableFeedback>): MergeableFeedback => ({
  id: over.id ?? 'id',
  kind: over.kind ?? 'bug',
  title: over.title ?? 'titulo',
  description: over.description ?? 'desc',
  contact_email: over.contact_email ?? null,
  screenshot_url: over.screenshot_url ?? null,
  page_url: over.page_url ?? null,
  route_path: over.route_path ?? null,
  environment: over.environment ?? null,
  created_at: over.created_at ?? new Date('2026-06-02T00:00:00Z'),
  console_errors: over.console_errors ?? [],
  network_errors: over.network_errors ?? [],
  merged_sources: over.merged_sources ?? [],
});

describe('buildMerge', () => {
  it('une console/network errors com dedup', () => {
    const primary = base({
      id: 'p',
      console_errors: [{ level: 'error', message: 'A' }],
      network_errors: [{ url: '/x', method: 'GET', status: 500 }],
    });
    const src = base({
      id: 's',
      console_errors: [{ level: 'error', message: 'A' }, { level: 'warn', message: 'B' }],
      network_errors: [{ url: '/y', method: 'POST', status: 404 }],
    });
    const out = buildMerge(primary, [src]);
    // 'A' duplicado some; resta A, B
    expect(out.console_errors).toHaveLength(2);
    expect(out.network_errors).toHaveLength(2);
  });

  it('cria snapshot completo de cada secundario em merged_sources', () => {
    const primary = base({ id: 'p', merged_sources: [] });
    const src = base({
      id: 's1',
      title: 'sec',
      description: 'descricao secundaria',
      contact_email: 'a@b.com',
      screenshot_url: 'http://img/1.jpg',
      route_path: '/painel',
    });
    const out = buildMerge(primary, [src]);
    expect(out.merged_sources).toHaveLength(1);
    const snap = out.merged_sources[0] as Record<string, unknown>;
    expect(snap.id).toBe('s1');
    expect(snap.title).toBe('sec');
    expect(snap.description).toBe('descricao secundaria');
    expect(snap.contact_email).toBe('a@b.com');
    expect(snap.screenshot_url).toBe('http://img/1.jpg');
    expect(snap.route_path).toBe('/painel');
  });

  it('preserva merged_sources ja existentes no destino (append)', () => {
    const primary = base({ id: 'p', merged_sources: [{ id: 'old' }] });
    const out = buildMerge(primary, [base({ id: 'new' })]);
    expect(out.merged_sources).toHaveLength(2);
    expect((out.merged_sources[0] as Record<string, unknown>).id).toBe('old');
    expect((out.merged_sources[1] as Record<string, unknown>).id).toBe('new');
  });

  it('limita o total de erros ao cap', () => {
    const many = Array.from({ length: MAX_MERGED_ERRORS + 30 }, (_, i) => ({ level: 'error', message: `e${i}` }));
    const primary = base({ id: 'p', console_errors: many });
    const out = buildMerge(primary, [base({ id: 's', console_errors: [{ level: 'error', message: 'extra' }] })]);
    expect(out.console_errors.length).toBe(MAX_MERGED_ERRORS);
  });

  it('agrega multiplos secundarios', () => {
    const primary = base({ id: 'p' });
    const out = buildMerge(primary, [base({ id: 's1' }), base({ id: 's2' }), base({ id: 's3' })]);
    expect(out.merged_sources).toHaveLength(3);
  });
});
