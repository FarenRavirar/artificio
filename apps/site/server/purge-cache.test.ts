import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeCache } from './purge-cache';

const ENV = { ...process.env };

function comCredenciais(site = 'https://artificiorpg.com') {
  process.env.CLOUDFLARE_PURGE_TOKEN = 'tok';
  process.env.CLOUDFLARE_ZONE_ID = 'zona';
  process.env.PUBLIC_SITE_URL = site;
}

/**
 * Resposta de SUCESSO como a Cloudflare de fato responde: `200` **e** `success: true`
 * no envelope. Os dois importam — a API responde 200 com `success: false` em erro de
 * negócio (token sem escopo na zona, prefixo fora dela), e é justamente esse caso que
 * fazia a purga falhada ser anunciada como "no ar".
 */
const respostaOk = () => ({
  ok: true,
  text: async () => '',
  json: async () => ({ success: true, errors: [], result: { id: 'zona' } }),
});

/** Corpo JSON da n-ésima chamada ao fetch. */
function corpo(spy: ReturnType<typeof vi.fn>, n = 0): Record<string, unknown> {
  return JSON.parse((spy.mock.calls[n][1] as RequestInit).body as string);
}

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe('purgeCache', () => {
  it('nao tenta purgar sem credencial — ambiente sem Cloudflare na frente', async () => {
    delete process.env.CLOUDFLARE_PURGE_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await purgeCache();

    expect(r.attempted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('nao tenta purgar sem PUBLIC_SITE_URL — sem host nao ha prefixo valido', async () => {
    comCredenciais('');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await purgeCache();

    expect(r.attempted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('purga por prefixo do host, cobrindo o site inteiro numa chamada', async () => {
    comCredenciais();
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    const r = await purgeCache();

    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // `prefixes` e nao `files`: medido, purga por URL exata nao invalidou a home.
    expect(corpo(fetchSpy).prefixes).toEqual(['artificiorpg.com/', 'www.artificiorpg.com/']);
    expect(corpo(fetchSpy).files).toBeUndefined();
  });

  it('nunca manda purge_everything: a zona serve os outros subdominios', async () => {
    comCredenciais();
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    await purgeCache();

    expect(corpo(fetchSpy).purge_everything).toBeUndefined();
  });

  it('subdominio purga so a si mesmo — nao existe www.beta.<host>', async () => {
    // Medido em 2026-09-02: beta aponta para `beta.artificiorpg.com`. O par com `www.`
    // so faz sentido no apex; num subdominio seria prefixo morto na chamada.
    comCredenciais('https://beta.artificiorpg.com');
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    await purgeCache();

    expect(corpo(fetchSpy).prefixes).toEqual(['beta.artificiorpg.com/']);
  });

  it('nao duplica o host quando PUBLIC_SITE_URL ja e o www', async () => {
    comCredenciais('https://www.artificiorpg.com');
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    await purgeCache();

    expect(corpo(fetchSpy).prefixes).toEqual(['www.artificiorpg.com/']);
  });

  it('barra final sobrando na env nao vira prefixo com barra dupla', async () => {
    comCredenciais('https://artificiorpg.com/');
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    await purgeCache();

    for (const p of corpo(fetchSpy).prefixes as string[]) expect(p).not.toContain('//');
  });

  it('manda o token no Authorization', async () => {
    comCredenciais();
    const fetchSpy = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', fetchSpy);

    await purgeCache();

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(fetchSpy.mock.calls[0][0]).toContain('/zones/zona/purge_cache');
  });

  it('falha de rede vira ok:false com motivo — nunca sucesso silencioso', async () => {
    comCredenciais();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const r = await purgeCache();

    // O rebuild em si deu certo; o que falhou foi a borda. Confundir os dois faria o
    // editor anunciar "no ar" para um site que ainda serve a versao antiga.
    expect(r.attempted).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('ECONNRESET');
  });

  it('HTTP de erro da API tambem vira ok:false, com o status junto', async () => {
    comCredenciais();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' }));

    const r = await purgeCache();

    expect(r.ok).toBe(false);
    expect(r.reason).toContain('403');
    expect(r.reason).toContain('forbidden');
  });

  it('HTTP 200 com success:false e FALHA — o caso que o status HTTP sozinho esconde', async () => {
    // A Cloudflare responde 200 em erro de negocio: token sem `Cache Purge` nesta zona,
    // prefixo fora dela, zona errada. Aceitar so `resp.ok` fazia a purga falhada
    // reportar sucesso, o editor anunciava "Publicado e no ar", e a borda seguia
    // servindo o HTML velho — o incidente de 2026-09-02 de novo, agora com selo de
    // sucesso por cima. Achado do CodeRabbit.
    comCredenciais();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      json: async () => ({
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
      }),
    }));

    const r = await purgeCache();

    expect(r.attempted).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('10000');
    expect(r.reason).toContain('Authentication error');
  });

  it('envelope ilegivel tambem e falha — nao da para afirmar que purgou', async () => {
    comCredenciais();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }));

    const r = await purgeCache();

    expect(r.ok).toBe(false);
    expect(r.reason).toContain('success');
  });
});
