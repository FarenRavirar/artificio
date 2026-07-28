const getSecretMock = vi.hoisted(() => vi.fn());
vi.mock('./secretsClient', () => ({ getSecret: getSecretMock }));

const fetchMock = vi.hoisted(() => vi.fn());

import fs from 'node:fs';
import path from 'node:path';
import { detectPortuguese } from './languageDetector';

beforeEach(() => {
  getSecretMock.mockReset();
  getSecretMock.mockResolvedValue(null);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('detectPortuguese', () => {
  it('confirma português com ISO 639-3 quando franc-min é decisivo', async () => {
    const result = await detectPortuguese(
      'Este é um cenário de aventura em português para mesas de RPG, com direito a masmorras e monstros variados.',
    );

    expect(result).toMatchObject({
      isPortuguese: true,
      detectedLanguage: 'por',
      confident: true,
      method: 'franc',
      reason: 'franc_confident',
    });
    expect(getSecretMock).not.toHaveBeenCalled();
  });

  it('confirma inglês com ISO 639-3 quando franc-min é decisivo', async () => {
    const result = await detectPortuguese(
      'This is an adventure module written entirely in English for tabletop roleplaying game sessions with dungeons.',
    );

    expect(result).toMatchObject({
      isPortuguese: false,
      detectedLanguage: 'eng',
      confident: true,
      method: 'franc',
    });
  });

  it.each([
    ['português com acento', 'Você cria personagens e escolhe ações.', true],
    ['português sem acento', 'Voce cria personagens e escolhe acoes.', true],
    ['espanhol', 'El jugador explora un escenario medieval.', false],
    ['galego', 'O xogador explora un escenario medieval.', false],
    ['texto misto', 'RPG não dungeon adventure.', false],
    ['título próprio', 'Exorcist Candy', false],
    ['sem descrição', 'RPG', false],
  ])('heurística curta conservadora: %s', async (_label, text, expected) => {
    const result = await detectPortuguese(text);

    expect(result.isPortuguese && result.confident).toBe(expected);
    if (expected) {
      expect(result).toMatchObject({
        detectedLanguage: 'por',
        method: 'short_text_heuristic',
      });
    }
  });

  it('DeepSeek usa modelo vigente, JSON mode e devolve ISO 639-3', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"detectedLanguage":"por"}' } }] }),
    });

    const result = await detectPortuguese('Exorcist Candy');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(request).toMatchObject({
      model: 'deepseek-v4-flash',
      response_format: { type: 'json_object' },
    });
    expect(result).toEqual({
      isPortuguese: true,
      detectedLanguage: 'por',
      confident: true,
      method: 'deepseek',
      reason: 'deepseek_json_iso639_3',
    });
  });

  it('código ISO 639-1 do desempate é inválido e nunca aprova', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"detectedLanguage":"pt"}' } }] }),
    });

    const result = await detectPortuguese('Exorcist Candy');

    expect(result.confident).toBe(false);
    expect(result.isPortuguese).toBe(false);
    expect(result.method).toBe('indeterminate');
    expect(result.reason).toContain('deepseek_invalid_iso639_3');
  });

  it.each(['zzz', 'und'])('código %s fora do conjunto de línguas suportadas é inválido', async (code) => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ detectedLanguage: code }) } }] }),
    });

    const result = await detectPortuguese('Exorcist Candy');

    expect(result).toMatchObject({
      isPortuguese: false,
      confident: false,
      method: 'indeterminate',
    });
    expect(result.reason).toContain('deepseek_invalid_iso639_3');
  });

  it('não decodifica novamente texto já normalizado pela fronteira do parser', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"detectedLanguage":"eng"}' } }] }),
    });

    await detectPortuguese('Exorcist &lt; Candy');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(request.messages[1]?.content).toBe('Exorcist &lt; Candy');
  });

  it('falha do desempate permanece indeterminada e nunca aprova', async () => {
    getSecretMock.mockResolvedValue('fake-api-key');
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const result = await detectPortuguese('texto curto e ambíguo');

    expect(result.confident).toBe(false);
    expect(result.isPortuguese).toBe(false);
    expect(result.method).toBe('indeterminate');
    expect(result.reason).toContain('deepseek_http_503');
  });

  it('corpus real rotulado tem zero falso positivo', async () => {
    const corpusPath = path.resolve(__dirname, '../../test/fixtures/spec-089/language-corpus.json');
    const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as Array<{
      id: string;
      text: string;
      isPortuguese: boolean;
    }>;
    expect(corpus).toHaveLength(11);
    const matrix = {
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      indeterminate: 0,
    };

    for (const sample of corpus) {
      const result = await detectPortuguese(sample.text);
      const approved = result.isPortuguese && result.confident;
      if (!result.confident || result.method === 'indeterminate') matrix.indeterminate += 1;
      else if (approved && sample.isPortuguese) matrix.truePositive += 1;
      else if (!approved && !sample.isPortuguese) matrix.trueNegative += 1;
      else if (approved) matrix.falsePositive += 1;
      else matrix.falseNegative += 1;
    }

    expect(matrix.falsePositive).toBe(0);
    expect(matrix).toEqual({
      truePositive: 4,
      trueNegative: 1,
      falsePositive: 0,
      falseNegative: 0,
      indeterminate: 6,
    });
  });
});
