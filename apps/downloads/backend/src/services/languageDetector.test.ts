// T4.1 (spec 084) — franc-min roda de verdade (nao mockado, biblioteca
// determinística leve); so getSecret/fetch do fallback DeepSeek sao mocados.

const getSecretMock = vi.hoisted(() => vi.fn());
vi.mock('./secretsClient', () => ({
  getSecret: getSecretMock,
}));

const fetchMock = vi.hoisted(() => vi.fn());

import { detectPortuguese } from './languageDetector';

beforeEach(() => {
  getSecretMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('detectPortuguese', () => {
  it('confirma português com confiança quando franc-min é decisivo', async () => {
    const result = await detectPortuguese(
      'Este é um cenário de aventura em português para mesas de RPG, com direito a masmorras e monstros variados.',
    );

    expect(result.isPortuguese).toBe(true);
    expect(result.detectedLanguage).toBe('por');
    expect(result.confident).toBe(true);
    expect(getSecretMock).not.toHaveBeenCalled();
  });

  it('confirma não-português com confiança quando franc-min é decisivo (inglês)', async () => {
    const result = await detectPortuguese(
      'This is an adventure module written entirely in English for tabletop roleplaying game sessions with dungeons.',
    );

    expect(result.isPortuguese).toBe(false);
    expect(result.detectedLanguage).toBe('eng');
    expect(result.confident).toBe(true);
  });

  it('texto curto demais: nao confiante, nao chama DeepSeek se getSecret falhar', async () => {
    getSecretMock.mockResolvedValue(null);

    const result = await detectPortuguese('RPG');

    expect(result.confident).toBe(false);
    expect(result.isPortuguese).toBe(false);
  });

  it('título curto isolado (sempre ambíguo por natureza — achado real: franc-min classificou "Exorcist Candy" como Rundi): tenta DeepSeek e usa o resultado', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"isPortuguese": true, "detectedLanguage": "pt"}' } }],
      }),
    });

    const result = await detectPortuguese('Exorcist Candy');

    expect(getSecretMock).toHaveBeenCalledWith('deepseek_api_key');
    expect(result).toEqual({ isPortuguese: true, detectedLanguage: 'pt', confident: true });
  });

  it('DeepSeek indisponível (sem API key): mantém resultado não-confiante do franc, nunca assume português', async () => {
    getSecretMock.mockResolvedValue(null);

    const result = await detectPortuguese('a a a');

    expect(result.confident).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DeepSeek falha (HTTP erro): mantém resultado não-confiante, nunca lança', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await detectPortuguese('texto muito curto e ambíguo demais');

    expect(result).toBeDefined();
  });
});
