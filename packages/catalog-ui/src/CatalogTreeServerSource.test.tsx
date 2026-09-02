// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogTree } from './CatalogTree.js';
import type { CatalogUiNode } from './types.js';

/**
 * Fonte server-side no `CatalogTree` (spec 099, fase G — G7).
 *
 * O pacote oferecia busca sob demanda OU seleção múltipla, nunca as duas: o
 * `CatalogSystemSelector` tem os `fetch*` mas é single-select, e o
 * `CatalogTree` faz multi mas só aceitava árvore local. Quem precisava das duas
 * pagava o catálogo inteiro — medido na API de beta em 2026-09-01: **487.965
 * bytes** (1.289 nós) contra **2.040** de uma busca.
 *
 * As props são aditivas: os testes de `CatalogTree.test.tsx` continuam
 * passando sem alteração, e é isso que prova que o consumidor existente não
 * mudou de comportamento.
 */

const node = (id: string, name: string, children: CatalogUiNode[] = []): CatalogUiNode => ({
  id,
  name,
  name_pt: null,
  canonical_slug: id,
  parent_id: null,
  node_type: 'system',
  path_slug: id,
  aliases: [],
  children,
});

const pathfinder = node('pf', 'Pathfinder');
const pf2 = node('pf2', '2ª edição');

describe('CatalogTree — fonte server-side (G7)', () => {
  it('não pede nada enquanto não há termo digitado', async () => {
    const fetchSystemOptions = vi.fn(async () => [pathfinder]);

    render(
      <CatalogTree
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
      />,
    );

    // A regra de "sem busca não mostra nada" é o que impede o catálogo inteiro
    // de vazar a caixa; no caminho server-side ela também evita a requisição.
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(fetchSystemOptions).not.toHaveBeenCalled();
  });

  it('busca no servidor e mostra o que voltou, sem árvore local', async () => {
    const fetchSystemOptions = vi.fn(async () => [pathfinder]);

    render(
      <CatalogTree
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });

    await waitFor(() => expect(fetchSystemOptions).toHaveBeenCalled());
    expect(fetchSystemOptions.mock.calls[0][0]).toBe('pathf');
    await waitFor(() => expect(screen.getByText('Pathfinder')).toBeInTheDocument());
  });

  it('mantém a seleção múltipla — o que faltava para o editor de perfil', async () => {
    const onSelectionChange = vi.fn();
    const fetchSystemOptions = vi.fn(async () => [pathfinder]);

    render(
      <CatalogTree
        selectedIds={['outro']}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
        selectedNodes={[node('outro', 'Call of Cthulhu')]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });
    await waitFor(() => expect(screen.getByText('Pathfinder')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pathfinder'));

    // Acrescenta, não substitui: é a diferença entre isto e o
    // `CatalogSystemSelector`, que é single-select. Trocar um pelo outro seria
    // regressão para quem escolhe N sistemas.
    expect(onSelectionChange).toHaveBeenCalledWith(['outro', 'pf']);
  });

  it('nomeia a seleção existente por `selectedNodes`, sem baixar a árvore', () => {
    render(
      <CatalogTree
        selectedIds={['pf']}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={async () => []}
        selectedNodes={[pathfinder]}
      />,
    );

    // Sem esta prop o usuário veria a contagem certa e os nomes sumidos — pior
    // do que carregar o catálogo, que é o que a G7 evita.
    expect(screen.getByText('Pathfinder')).toBeInTheDocument();
  });

  it('carrega os filhos sob demanda ao descer um nível', async () => {
    const fetchChildOptions = vi.fn(async () => [pf2]);

    render(
      <CatalogTree
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={async () => [pathfinder]}
        fetchChildOptions={fetchChildOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });
    await waitFor(() => expect(screen.getByText('Pathfinder')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pathfinder'));

    await waitFor(() => expect(fetchChildOptions).toHaveBeenCalled());
    // O nó veio da busca SEM `children` preenchido: se o nível lesse a árvore,
    // a coluna sairia vazia mesmo com o fetch respondendo.
    await waitFor(() => expect(screen.getByText('2ª edição')).toBeInTheDocument());
  });

  it('distingue "não achei" de "não consegui buscar"', async () => {
    const fetchSystemOptions = vi.fn(async () => {
      throw new Error('network down');
    });

    render(
      <CatalogTree
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });

    // Sem o aviso, falha de rede lê como "esse sistema não existe no catálogo",
    // e o usuário desiste de um sistema que está lá.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText('Nenhum sistema encontrado')).not.toBeInTheDocument();
  });

  it('descarta payload malformado em vez de quebrar o render', async () => {
    // Resposta de HTTP é `unknown`: o tipo é promessa de compilação. Nó sem
    // `name` derrubaria o matcher em `normalizeText(undefined)`.
    const fetchSystemOptions = vi.fn(async () =>
      [{ id: 'x' }, pathfinder] as unknown as CatalogUiNode[],
    );

    render(
      <CatalogTree
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });

    await waitFor(() => expect(screen.getByText('Pathfinder')).toBeInTheDocument());
  });

  it('sem `fetchSystemOptions`, continua filtrando a árvore local', async () => {
    render(
      <CatalogTree
        tree={[pathfinder]}
        selectedIds={[]}
        onSelectionChange={() => {}}
        idPrefix="systems"
        mode="multi"
      />,
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'pathf' },
    });
    expect(screen.getByText('Pathfinder')).toBeInTheDocument();
  });
});
