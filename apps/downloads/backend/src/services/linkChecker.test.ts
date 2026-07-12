import { checkLink } from './linkChecker';

// T7.2 (spec 075) — checkLink deve rejeitar IP privado/loopback/link-local/
// metadado de nuvem SEM nunca chegar a disparar fetch (mitigacao SSRF).

describe('checkLink — bloqueio SSRF', () => {
  it.each([
    ['loopback IPv4', 'http://127.0.0.1/secret'],
    ['rede privada 10.x', 'http://10.0.0.5/internal'],
    ['rede privada 172.16.x', 'http://172.16.0.1/'],
    ['rede privada 192.168.x', 'http://192.168.1.1/'],
    ['metadado de nuvem 169.254.169.254', 'http://169.254.169.254/latest/meta-data/'],
  ])('rejeita %s', async (_label, url) => {
    const result = await checkLink(url);
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/privado|reservado|metadado/i);
  });

  it('rejeita loopback IPv6', async () => {
    const result = await checkLink('http://[::1]/');
    expect(result.isHealthy).toBe(false);
  });

  it('rejeita protocolo nao http/https', async () => {
    const result = await checkLink('file:///etc/passwd');
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/protocolo/i);
  });

  it('rejeita URL invalida', async () => {
    const result = await checkLink('nao-e-uma-url');
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/inválida/i);
  });
});
