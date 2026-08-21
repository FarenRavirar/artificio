// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogSystemPopover } from './CatalogSystemPopover';
import type { SystemTreeNode } from '../types/systems';

/**
 * Spec 094 Fase 2 (T2.10): abrir/fechar, busca acessível "Buscar sistema" que
 * só existe aberto, Escape sem limpar seleção, retorno de foco ao gatilho,
 * ausência visual de parágrafo/"nome PT"/alias badge em `selection` e busca
 * por alias preservada (R8/R9/R16/R18/D0.5).
 */

const tree: SystemTreeNode[] = [
  {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    name_pt: 'Dungeons & Dragons',
    slug: 'dungeons-dragons',
    parent_id: null,
    node_type: 'system',
    path_slug: 'dungeons-dragons',
    aliases: ['D&D', 'DnD'],
    children: [
      {
        id: 'dnd-5e',
        name: '5e',
        name_pt: '5ª edição',
        slug: '5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/5e',
        aliases: ['5th ed'],
        children: [],
      },
    ],
  },
  {
    id: 'vampiro',
    name: 'Vampire',
    name_pt: 'Vampiro',
    slug: 'vampire',
    parent_id: null,
    node_type: 'system',
    path_slug: 'vampire',
    aliases: [],
    children: [],
  },
];

const mockMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const baseProps = {
  tree,
  loading: false,
  error: null,
  selectedSystemId: null,
  onSelect: vi.fn(),
};

describe('CatalogSystemPopover — gatilho e abertura', () => {
  it('gatilho mostra "Sistema" sem seleção e o caminho do nó selecionado', () => {
    const { rerender } = render(<CatalogSystemPopover {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sistema' })).toHaveAttribute('aria-expanded', 'false');

    rerender(<CatalogSystemPopover {...baseProps} selectedSystemId="dnd-5e" />);
    expect(screen.getByRole('button', { name: /Dungeons & Dragons › 5e/ })).toBeInTheDocument();
  });

  it('busca de sistema não existe fechado e existe aberto, com nome acessível "Buscar sistema"', () => {
    render(<CatalogSystemPopover {...baseProps} />);

    expect(screen.queryByLabelText('Buscar sistema')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));

    expect(screen.getByLabelText('Buscar sistema')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar sistema')).toHaveAttribute('type', 'search');
  });

  it('ao abrir, o foco vai para a busca interna de sistemas', async () => {
    render(<CatalogSystemPopover {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Buscar sistema'));
    });
  });
});

describe('CatalogSystemPopover — fechamento (R8/R16)', () => {
  it('no mobile contém Tab e Shift+Tab dentro do dialog', () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;
    render(<CatalogSystemPopover {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    const dialog = screen.getByRole('dialog', { name: 'Selecionar sistema' });
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled])',
    ));
    const first = focusables[0];
    const last = focusables.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    last?.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('Escape fecha sem limpar seleção e devolve o foco ao gatilho', () => {
    const onSelect = vi.fn();
    render(<CatalogSystemPopover {...baseProps} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: 'Sistema' });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByLabelText('Buscar sistema')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape com seleção ativa fecha sem limpar a seleção (gatilho mantém o nome)', () => {
    render(<CatalogSystemPopover {...baseProps} selectedSystemId="dnd" />);

    const trigger = screen.getByRole('button', { name: /Dungeons & Dragons/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    // Seleção preservada: gatilho continua mostrando o nó, sem chamada onSelect.
    expect(screen.getByRole('button', { name: /Dungeons & Dragons/ })).toBeInTheDocument();
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });

  it('clique fora (desktop) fecha o popover', () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;

    render(<CatalogSystemPopover {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(screen.getByLabelText('Buscar sistema')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByLabelText('Buscar sistema')).not.toBeInTheDocument();
  });
});

describe('CatalogSystemPopover — presentation selection (R18/D0.5)', () => {
  it('não renderiza parágrafo técnico, "nome PT" nem badge de aliases', () => {
    render(<CatalogSystemPopover {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'Dungeons' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
    expect(screen.queryByText(/Cada nível é um nó/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nome PT:/)).not.toBeInTheDocument();
    expect(screen.queryByText('D&D +1')).not.toBeInTheDocument();
  });

  it('busca por alias ainda encontra e seleciona o nó', () => {
    const onSelect = vi.fn();
    render(<CatalogSystemPopover {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'DnD' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
    expect(screen.queryByText('Vampire')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));
    expect(onSelect).toHaveBeenCalledWith('dnd');
  });

  it('busca por nome PT também encontra o nó', () => {
    render(<CatalogSystemPopover {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(screen.getByLabelText('Buscar sistema'), {
      target: { value: 'Vampiro' },
    });

    expect(screen.getByText('Vampire')).toBeInTheDocument();
    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();
  });
});

describe('CatalogSystemPopover — estados de carregamento', () => {
  it('loading mostra "Carregando sistemas..." dentro do painel', () => {
    render(<CatalogSystemPopover {...baseProps} loading />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));

    expect(screen.getByText('Carregando sistemas...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar sistema')).not.toBeInTheDocument();
  });

  it('erro mostra "Sistemas indisponíveis." dentro do painel', () => {
    render(<CatalogSystemPopover {...baseProps} error="Falha de rede." />);

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));

    expect(screen.getByText('Sistemas indisponíveis.')).toBeInTheDocument();
  });
});
