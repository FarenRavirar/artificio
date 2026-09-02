import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), purgeCache: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('./purge-cache.js', () => ({ purgeCache: mocks.purgeCache }));

/** Processo filho falso: emite stdout e fecha quando o teste mandar. */
function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter; stderr: EventEmitter;
    saida(txt: string): void; fecha(code: number): void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.saida = (txt) => child.stdout.emit('data', Buffer.from(txt));
  child.fecha = (code) => child.emit('close', code);
  return child;
}

/** Deixa a microtask do `finish` (que é async por causa da purga) rodar. */
const assenta = () => new Promise((r) => setTimeout(r, 0));

let jobs: typeof import('./jobs');

beforeEach(async () => {
  vi.resetModules();
  mocks.spawn.mockReset();
  mocks.purgeCache.mockReset().mockResolvedValue({ attempted: true, ok: true, purged: 2 });
  jobs = await import('./jobs');
});

afterEach(() => vi.restoreAllMocks());

describe('runJob', () => {
  it('reporta a fase conforme o script imprime cada etapa', async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    expect(jobs.jobState()?.phase).toBe('iniciando');

    child.saida('[rebuild] export store -> json\n');
    expect(jobs.jobState()?.phase).toBe('exportando');

    child.saida('[rebuild] astro build -> dist.a\n');
    expect(jobs.jobState()?.phase).toBe('build');

    child.saida('[rebuild] pagefind -> dist.a\n');
    expect(jobs.jobState()?.phase).toBe('busca');

    child.saida('[rebuild] swap atômico\n');
    expect(jobs.jobState()?.phase).toBe('publicando');
  });

  it('purga a borda depois de um rebuild que deu certo', async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    child.fecha(0);
    await assenta();

    expect(mocks.purgeCache).toHaveBeenCalledTimes(1);
    const st = jobs.jobState();
    expect(st?.ok).toBe(true);
    expect(st?.purge?.ok).toBe(true);
    expect(st?.finishedAt).toBeTruthy();
  });

  it('NAO purga quando o rebuild falhou — o disco ainda tem o SSG anterior', async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    child.fecha(1);
    await assenta();

    expect(mocks.purgeCache).not.toHaveBeenCalled();
    expect(jobs.jobState()?.ok).toBe(false);
  });

  it('purga que falha nao transforma o rebuild em falha, mas fica registrada', async () => {
    mocks.purgeCache.mockResolvedValue({ attempted: true, ok: false, reason: 'HTTP 403' });
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    child.fecha(0);
    await assenta();

    const st = jobs.jobState();
    // Site novo no disco, borda ainda velha: o editor precisa dos DOIS fatos para
    // dizer "publicado, mas pode levar até 2h" em vez de "no ar".
    expect(st?.ok).toBe(true);
    expect(st?.purge?.ok).toBe(false);
    expect(st?.purge?.reason).toContain('403');
  });

  it('segundo rebuild durante o primeiro fica coalescido e roda depois', async () => {
    const primeiro = fakeChild();
    const segundo = fakeChild();
    mocks.spawn.mockReturnValueOnce(primeiro).mockReturnValueOnce(segundo);

    jobs.runJob('rebuild', 'rebuild');
    const r = jobs.runJob('rebuild', 'rebuild');

    expect(r.started).toBe(false);
    expect(r.queued).toBe(true);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);

    primeiro.fecha(0);
    await assenta();

    // A publicação mais recente precisa entrar no SSG; sem o trailing run ela se perderia.
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
  });

  it('erro ao spawnar tambem encerra o job em vez de deixa-lo preso', async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    child.emit('error', new Error('pnpm ausente'));
    await assenta();

    expect(jobs.jobBusy()).toBe(false);
    expect(jobs.jobState()?.ok).toBe(false);
    expect(mocks.purgeCache).not.toHaveBeenCalled();
  });

  it('jobBusy segue true durante a purga — o job so acaba quando a borda acaba', async () => {
    let liberar: (v: unknown) => void = () => {};
    mocks.purgeCache.mockReturnValue(new Promise((r) => { liberar = r; }));
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);

    jobs.runJob('rebuild', 'rebuild');
    child.fecha(0);
    await assenta();

    expect(jobs.jobBusy()).toBe(true);
    expect(jobs.jobState()?.phase).toBe('purgando');

    liberar({ attempted: true, ok: true, purged: 2 });
    await assenta();

    expect(jobs.jobBusy()).toBe(false);
  });
});
