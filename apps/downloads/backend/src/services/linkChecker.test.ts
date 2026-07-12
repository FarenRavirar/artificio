import { checkLink } from './linkChecker';

// T7.2 (spec 075) — checkLink deve rejeitar IP privado/loopback/link-local/
// metadado de nuvem SEM nunca chegar a disparar fetch (mitigacao SSRF).

describe('checkLink — bloqueio SSRF', () => {
  it('rejeita loopback IPv4', async () => {
    const result = await checkLink('http://127.0.0.1/secret');
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/privado|reservado/i);
  });

  it('rejeita rede privada 10.x', async () => {
    const result = await checkLink('http://10.0.0.5/internal');
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/privado|reservado/i);
  });

  it('rejeita rede privada 192.168.x', async () => {
    const result = await checkLink('http://192.168.1.1/');
    expect(result.isHealthy).toBe(false);
    expect(result.errorDetail).toMatch(/privado|reservado/i);
  });

  it('rejeita metadado de nuvem 169.254.169.254', async () => {
    const result = await checkLink('http://169.254.169.254/latest/meta-data/');
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
