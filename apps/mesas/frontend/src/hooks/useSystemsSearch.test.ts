// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemsSearch } from './useSystemsSearch';

/**
 * Busca server-side do catálogo (spec 099, fase G — G5b).
 *
 * O que estes testes protegem não é o `fetch`, é o que ele carrega de caro: o
 * FILTRO DE RAÍZES e a MARGEM DO LIMITE, aprendidos na spec 096 (R18/A21).
 * Uma cópia deste código sem essas duas linhas parece funcionar — a busca
 * responde, a lista aparece — e erra em silêncio: escolher uma edição listada
 * como se fosse sistema pula um nível e a coluna seguinte passa a exibir
 * variantes. Foi por isso que o hook virou fonte única em vez de ser copiado
 * para o editor de perfil.
 */

const authGet = vi.hoisted(() => vi.fn());

vi.mock('../utils/authenticatedFetch', () => ({ authGet }));

const jsonResponse = (data: unknown) => ({
  ok: true,
  json: async () => ({ data }),
});

const node = (id: string, parent_id: string | null) => ({
  id,
  name: id,
  name_pt: null,
  slug: id,
  parent_id,
  node_type: parent_id === null ? 'system' : 'edition',
  path_slug: id,
  aliases: [],
  children: [],
});

beforeEach(() => {
  authGet.mockReset();
});

describe('useSystemsSearch — busca de sistemas (G5b)', () => {
  it('devolve SÓ raízes: `?search=` achata a árvore e mistura os níveis', async () => {
    // A rota responde `flattenTree(filterCatalogTree(...))`, então buscar "5e"
    // traz a edição junto do sistema. Sem o filtro, o usuário escolheria a
    // edição na coluna Sistema e pularia um nível inteiro.
    authGet.mockResolvedValue(jsonResponse([node('dnd', null), node('dnd-5e', 'dnd')]));

    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchSystemOptions('5e', new AbortController().signal);

    expect(nodes.map((n) => n.id)).toEqual(['dnd']);
  });

  it('pede MAIS do que exibe: sem margem, a coluna sai vazia', async () => {
    authGet.mockResolvedValue(jsonResponse([]));

    const { result } = renderHook(() => useSystemsSearch());
    await result.current.fetchSystemOptions('5e', new AbortController().signal);

    const url = String(authGet.mock.calls[0][0]);
    // O servidor corta ANTES de sabermos quais nós são raiz: pedir só os 5
    // exibidos devolveria 5 edições e nenhuma raiz para mostrar.
    expect(url).toContain('limit=25');
    expect(url).toContain('search=5e');
  });

  it('corta em 5 o que chega a ser exibido', async () => {
    authGet.mockResolvedValue(
      jsonResponse(Array.from({ length: 12 }, (_, i) => node(`sys-${i}`, null))),
    );

    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchSystemOptions('a', new AbortController().signal);

    expect(nodes).toHaveLength(5);
  });

  it('resposta não-ok vira erro, não lista vazia silenciosa', async () => {
    authGet.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useSystemsSearch());
    await expect(
      result.current.fetchSystemOptions('a', new AbortController().signal),
    ).rejects.toThrow('Falha ao buscar sistemas.');
  });
});

describe('useSystemsSearch — filhos sob demanda', () => {
  it('pede por `parent_id` e devolve os filhos normalizados', async () => {
    authGet.mockResolvedValue(jsonResponse([node('dnd-5e', 'dnd')]));

    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchChildOptions('dnd', new AbortController().signal);

    expect(String(authGet.mock.calls[0][0])).toContain('parent_id=dnd');
    expect(nodes.map((n) => n.id)).toEqual(['dnd-5e']);
  });
});

describe('useSystemsSearch — nomes dos ids já salvos', () => {
  it('resolve a seleção inteira numa requisição só', async () => {
    authGet.mockResolvedValue(jsonResponse([node('a', null), node('b', null)]));

    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchSystemsByIds(
      ['a', 'b'],
      new AbortController().signal,
    );

    // Uma chamada, não uma por id — é o que torna a busca sob demanda viável
    // numa tela de seleção múltipla.
    expect(authGet).toHaveBeenCalledTimes(1);
    const url = String(authGet.mock.calls[0][0]);
    expect(url).toContain('id=a%2Cb');
    // `limit` acompanha a quantidade pedida: o default da rota é menor que uma
    // seleção grande e cortaria os últimos nomes sem avisar.
    expect(url).toContain('limit=2');
    expect(nodes).toHaveLength(2);
  });

  it('lista vazia não vira requisição', async () => {
    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchSystemsByIds([], new AbortController().signal);

    expect(authGet).not.toHaveBeenCalled();
    expect(nodes).toEqual([]);
  });

  it('id que sumiu do catálogo some da resposta, sem virar erro', async () => {
    // Contrato da rota (systems.ts:60-63): devolve só o que existe. A contagem
    // do consumidor continua vindo dos ids salvos.
    authGet.mockResolvedValue(jsonResponse([node('a', null)]));

    const { result } = renderHook(() => useSystemsSearch());
    const nodes = await result.current.fetchSystemsByIds(
      ['a', 'sumiu'],
      new AbortController().signal,
    );

    expect(nodes.map((n) => n.id)).toEqual(['a']);
  });
});
