import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduleFacets } from './useScheduleFacets';
import { DAYPART_VALUES, WEEKDAY_VALUES } from '../utils/catalogFilterOptions';

/**
 * Achado P2 do Codex na PR #327: resposta 200 com envelope ou lista malformada
 * produzia `loaded: true` com todas as contagens em zero, e o
 * `ScheduleFacetPicker` desabilita a opção cujo contador é zero
 * (`ScheduleFacetPicker.tsx:105`). O filtro inteiro ficava inerte em cima de
 * dado que nunca foi medido.
 *
 * O contrato que estes testes fixam: `loaded` só é `true` quando as duas listas
 * chegaram em forma de array. Em qualquer outra forma a carga é uma falha, e
 * falha mantém tudo clicável.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('useScheduleFacets', () => {
  beforeEach(() => {
    // O hook loga a falha no console por desenho; silenciar mantém a saída do
    // teste legível sem esconder o caminho de erro.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marca `loaded` e preenche zero explícito quando as duas listas chegam', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      data: {
        weekdays: [{ value: 'sexta', count: 14 }],
        dayparts: [{ value: 'noite', count: 55 }],
      },
    })));

    const { result } = renderHook(() => useScheduleFacets());

    await waitFor(() => expect(result.current.counts.loaded).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.counts.weekdays.sexta).toBe(14);
    expect(result.current.counts.dayparts.noite).toBe(55);
    // Opção do registro ausente do GROUP BY vale zero, não ausência.
    expect(Object.keys(result.current.counts.weekdays)).toHaveLength(WEEKDAY_VALUES.length);
    expect(Object.keys(result.current.counts.dayparts)).toHaveLength(DAYPART_VALUES.length);
  });

  it('não marca `loaded` quando o envelope vem sem `data`', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));

    const { result } = renderHook(() => useScheduleFacets());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.counts.loaded).toBe(false);
  });

  it.each([
    ['weekdays', { weekdays: { segunda: 10 }, dayparts: [] }],
    ['dayparts', { weekdays: [], dayparts: null }],
  ])('não marca `loaded` quando `%s` não é array', async (_axis, data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data })));

    const { result } = renderHook(() => useScheduleFacets());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.counts.loaded).toBe(false);
    // Sem contagem medida, o picker precisa das opções clicáveis: contador
    // vazio é melhor que opção desabilitada por dado inexistente.
    expect(result.current.counts.weekdays).toEqual({});
    expect(result.current.counts.dayparts).toEqual({});
  });

  it('não marca `loaded` em resposta HTTP de erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, 500)));

    const { result } = renderHook(() => useScheduleFacets());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.counts.loaded).toBe(false);
  });
});
