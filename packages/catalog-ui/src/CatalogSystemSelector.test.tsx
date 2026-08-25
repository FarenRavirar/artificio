// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogSystemSelector } from './CatalogSystemSelector.js';
import type { CatalogUiNode } from './types.js';

const tree: CatalogUiNode[] = [
  {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    name_pt: null,
    canonical_slug: 'dungeons-dragons',
    parent_id: null,
    node_type: 'system',
    path_slug: 'dungeons-dragons',
    aliases: ['D&D', 'DnD'],
    children: [
      {
        id: 'dnd-3-5',
        name: '3.5e',
        name_pt: null,
        canonical_slug: '3-5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/3-5e',
        aliases: [],
        children: [],
      },
      {
        id: 'dnd-5e',
        name: '5e',
        name_pt: '5ª edição',
        canonical_slug: '5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/5e',
        aliases: ['5th ed'],
        children: [
          {
            id: 'dnd-2024',
            name: '2024',
            name_pt: null,
            canonical_slug: '2024',
            parent_id: 'dnd-5e',
            node_type: 'variant',
            path_slug: 'dungeons-dragons/5e/2024',
            aliases: [],
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'vampiro',
    name: 'Vampire',
    name_pt: 'Vampiro',
    canonical_slug: 'vampire',
    parent_id: null,
    node_type: 'system',
    path_slug: 'vampire',
    aliases: [],
    children: [],
  },
];

const baseProps = {
  tree,
  selectedIds: [] as string[],
  onSelectionChange: vi.fn(),
  idPrefix: 'selector',
};

describe('CatalogSystemSelector (R18/A21 — três colunas)', () => {
  it('não lista sistemas antes de digitar (raiz só com busca)', () => {
    render(<CatalogSystemSelector {...baseProps} />);

    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();
    expect(screen.queryByText('Vampire')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
  });

  it('renderiza as três colunas lado a lado, cada uma com busca própria', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <CatalogSystemSelector {...baseProps} onSelectionChange={onSelectionChange} />
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd']);

    rerender(
      <CatalogSystemSelector
        {...baseProps}
        selectedIds={['dnd']}
        onSelectionChange={onSelectionChange}
      />
    );

    // Coluna Edição: lista E busca própria.
    expect(screen.getByText('Edição')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar edições...')).toBeInTheDocument();
    expect(screen.getByText('3.5e')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^5e/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd-5e']);

    rerender(
      <CatalogSystemSelector
        {...baseProps}
        selectedIds={['dnd-5e']}
        onSelectionChange={onSelectionChange}
      />
    );

    // Coluna Variante: lista E busca própria.
    expect(screen.getByText('Variante')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar variantes...')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();

    // Caminho escolhido visível (nó selecionado até aqui: sistema › edição).
    expect(screen.getByText('Dungeons & Dragons › 5e')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^2024/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd-2024']);

    rerender(
      <CatalogSystemSelector
        {...baseProps}
        selectedIds={['dnd-2024']}
        onSelectionChange={onSelectionChange}
      />
    );

    // Caminho completo após escolher a variante.
    expect(screen.getByText('Dungeons & Dragons › 5e › 2024')).toBeInTheDocument();
  });

  it('omite coluna sem filho: sistema sem edição para no primeiro nível', () => {
    render(<CatalogSystemSelector {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Vamp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Vampire/ }));

    // 'Vampire' aparece na opção (lista) e no caminho selecionado — nada mais.
    expect(screen.getAllByText('Vampire')).toHaveLength(2);
    expect(screen.queryByText('Edição')).not.toBeInTheDocument();
    expect(screen.queryByText('Variante')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filtrar edições...')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filtrar variantes...')).not.toBeInTheDocument();
  });

  it('a busca da coluna Edição filtra as opções da própria coluna', () => {
    render(<CatalogSystemSelector {...baseProps} selectedIds={['dnd']} />);

    expect(screen.getByText('3.5e')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filtrar edições...'), {
      target: { value: '3.5' },
    });

    expect(screen.getByText('3.5e')).toBeInTheDocument();
    expect(screen.queryByText('5e')).not.toBeInTheDocument();
  });

  it('mostra aliases nas opções e no caminho selecionado', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <CatalogSystemSelector {...baseProps} onSelectionChange={onSelectionChange} />
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    // Aliases completos na própria linha da opção.
    expect(screen.getByText('D&D · DnD')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    rerender(
      <CatalogSystemSelector
        {...baseProps}
        selectedIds={['dnd']}
        onSelectionChange={onSelectionChange}
      />
    );

    // Opção (lista continua visível) + caminho selecionado.
    expect(screen.getAllByText('D&D · DnD').length).toBeGreaterThanOrEqual(2);
    // Nome presente na opção e no caminho.
    expect(screen.getAllByText('Dungeons & Dragons').length).toBeGreaterThanOrEqual(2);
  });

  it('não renderiza "nome PT" nem parágrafo técnico (superfície de seleção)', () => {
    render(<CatalogSystemSelector {...baseProps} selectedIds={['dnd']} />);

    expect(screen.queryByText(/nome PT:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cada nível é um nó/)).not.toBeInTheDocument();
  });

  it('clicar no nó já selecionado limpa a seleção', () => {
    const onSelectionChange = vi.fn();
    render(<CatalogSystemSelector {...baseProps} selectedIds={['dnd']} onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('CatalogSystemSelector — fonte server-side (R18)', () => {
  it('fetchSystemOptions recebe o termo digitado e renderiza os resultados', async () => {
    const fetchSystemOptions = vi.fn().mockResolvedValue([tree[0]]);

    render(
      <CatalogSystemSelector
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="selector"
        fetchSystemOptions={fetchSystemOptions}
      />
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'dnd' },
    });

    await waitFor(() =>
      expect(fetchSystemOptions).toHaveBeenCalledWith('dnd', expect.any(AbortSignal))
    );
    expect(await screen.findByText('Dungeons & Dragons')).toBeInTheDocument();
  });

  it('fetchNodePath: caminho da seleção ANTERIOR não aparece enquanto o novo carrega', async () => {
    // Achado CodeRabbit (PR #286): o caminho remoto vivia num estado sem dono,
    // então trocar de sistema exibia a linhagem do sistema anterior até a nova
    // resposta chegar — o usuário via "Vampire › 5ª Edição" sob um D&D recém
    // escolhido.
    const vampire = { ...tree[1], children: [] };
    const dnd = { ...tree[0], children: [] };

    let resolveSecond: ((path: unknown[]) => void) | undefined;
    const fetchNodePath = vi
      .fn()
      .mockResolvedValueOnce([vampire])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve as (path: unknown[]) => void;
          }),
      );

    const { rerender } = render(
      <CatalogSystemSelector
        selectedIds={[vampire.id]}
        onSelectionChange={vi.fn()}
        idPrefix="selector"
        fetchSystemOptions={vi.fn().mockResolvedValue([])}
        fetchNodePath={fetchNodePath}
      />
    );

    expect(await screen.findByText(vampire.name)).toBeInTheDocument();

    // Troca a seleção; a busca do novo caminho fica PENDENTE.
    rerender(
      <CatalogSystemSelector
        selectedIds={[dnd.id]}
        onSelectionChange={vi.fn()}
        idPrefix="selector"
        fetchSystemOptions={vi.fn().mockResolvedValue([])}
        fetchNodePath={fetchNodePath}
      />
    );

    await waitFor(() => expect(fetchNodePath).toHaveBeenCalledTimes(2));
    // O ponto do teste: o caminho antigo sumiu no mesmo render da troca.
    expect(screen.queryByText(vampire.name)).not.toBeInTheDocument();

    resolveSecond?.([dnd]);
    expect(await screen.findByText(dnd.name)).toBeInTheDocument();
  });

  it('fetchChildOptions abre a coluna Edição sob demanda (parent_id) e coluna vazia não aparece', async () => {
    const system = { ...tree[0], children: [] };
    const edition = { ...tree[0].children[1], children: [] };
    const fetchSystemOptions = vi.fn().mockResolvedValue([system]);
    const fetchChildOptions = vi
      .fn()
      .mockResolvedValueOnce([edition]) // filhos do sistema
      .mockResolvedValueOnce([]); // filhos da edição → sem variante

    render(
      <CatalogSystemSelector
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="selector"
        fetchSystemOptions={fetchSystemOptions}
        fetchChildOptions={fetchChildOptions}
      />
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    expect(await screen.findByText('Dungeons & Dragons')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    await waitFor(() =>
      expect(fetchChildOptions).toHaveBeenCalledWith(system, expect.any(AbortSignal))
    );
    expect(await screen.findByText('Edição')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^5e/ }));

    await waitFor(() => expect(fetchChildOptions).toHaveBeenCalledTimes(2));
    // Sem variantes: coluna não aparece.
    await waitFor(() => expect(screen.queryByText('Variante')).not.toBeInTheDocument());
  });

  it('busca sem resultado oferece sugerir com o termo digitado', async () => {
    const fetchSystemOptions = vi.fn().mockResolvedValue([]);
    const onSuggest = vi.fn();

    render(
      <CatalogSystemSelector
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="selector"
        fetchSystemOptions={fetchSystemOptions}
        onSuggest={onSuggest}
      />
    );

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'shadowdark' },
    });

    expect(await screen.findByText('Nenhum sistema encontrado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir' }));
    expect(onSuggest).toHaveBeenCalledWith('shadowdark');
  });

  it('sem fetch, usa a árvore local como fallback (comportamento atual)', () => {
    render(<CatalogSystemSelector {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Vamp' },
    });

    expect(screen.getByText('Vampire')).toBeInTheDocument();
    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();
  });
});
