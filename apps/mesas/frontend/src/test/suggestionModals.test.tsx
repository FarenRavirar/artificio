// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SystemSuggestionModal } from '../components/SystemSuggestionModal';
import { invalidateSystemsCatalogCache } from '../hooks/useSystemsCatalog';

const authState = vi.hoisted(() => ({ role: 'gm' as 'gm' | 'admin' }));
const catalogState = vi.hoisted(() => ({ tree: [] as unknown[] }));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', role: authState.role },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
  },
}));

describe('SystemSuggestionModal', () => {
  beforeEach(() => {
    catalogState.tree = [];
    invalidateSystemsCatalogCache();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            data: url.includes('/api/v1/systems/admin')
              ? { id: 'system-1', name: 'Sistema Teste' }
              : { id: 'suggestion-1' },
          }),
        } as Response;
      }

      if (url.includes('/api/v1/systems')) {
        return {
          ok: true,
          json: async () => ({ data: catalogState.tree }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ error: 'Unexpected request' }),
      } as Response;
    });
  });

  afterEach(() => {
    authState.role = 'gm';
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('nao submete o formulario de mesa ao enviar sugestao', async () => {
    const onOuterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <form onSubmit={onOuterSubmit}>
        <SystemSuggestionModal isOpen onClose={onClose} onSuccess={onSuccess} />
      </form>,
    );

    fireEvent.change(screen.getByPlaceholderText(/vampire/i), {
      target: { value: 'Sistema Teste' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar sugest/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('admin cria sistema direto no catalogo', async () => {
    authState.role = 'admin';
    const onOuterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onSuccess = vi.fn();

    render(
      <form onSubmit={onOuterSubmit}>
        <SystemSuggestionModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />
      </form>,
    );

    fireEvent.change(screen.getByPlaceholderText(/vampire/i), {
      target: { value: 'Sistema Teste' },
    });
    const aliasesInput = screen.getByLabelText('Aliases (um por linha)');
    const logoInput = screen.getByLabelText('Logo (opcional)');
    const websiteInput = screen.getByLabelText('Website Oficial (opcional)');

    fireEvent.change(aliasesInput, {
      target: { value: 'ST\nSistema T' },
    });
    fireEvent.change(logoInput, {
      target: { value: 'sistema-teste.svg' },
    });
    fireEvent.change(websiteInput, {
      target: { value: 'https://example.com/sistema' },
    });

    await waitFor(() => {
      expect(aliasesInput).toHaveValue('ST\nSistema T');
      expect(logoInput).toHaveValue('sistema-teste.svg');
      expect(websiteInput).toHaveValue('https://example.com/sistema');
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar sugest/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'system-1', name: 'Sistema Teste' }));

    const postCalls = vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    const postCall = postCalls.at(-1);
    expect(String(postCall?.[0])).toContain('/api/v1/systems/admin');
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      name: 'Sistema Teste',
      node_type: 'system',
      aliases: ['ST', 'Sistema T'],
      logo_filename: 'sistema-teste.svg',
      website_url: 'https://example.com/sistema',
    });
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('admin escolhe sistema para edição e edição para variante', async () => {
    authState.role = 'admin';
    catalogState.tree = [{
      id: 'root', name: 'Sistema Raiz', name_pt: null, slug: 'sistema-raiz',
      parent_id: null, node_type: 'system', path_slug: 'sistema-raiz', aliases: [],
      children: [{
        id: 'edition', name: 'Edição Um', name_pt: null, slug: 'edicao-um',
        parent_id: 'root', node_type: 'edition', path_slug: 'sistema-raiz/edicao-um', aliases: [],
        children: [{
          id: 'variant', name: 'Variante Um', name_pt: null, slug: 'variante-um',
          parent_id: 'edition', node_type: 'variant', path_slug: 'sistema-raiz/edicao-um/variante-um',
          aliases: [], children: [],
        }],
      }],
    }];

    render(<SystemSuggestionModal isOpen onClose={vi.fn()} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const typeSelect = screen.getAllByRole('combobox')[0]!;
    fireEvent.change(typeSelect, { target: { value: 'edition' } });
    let parentSelect = screen.getAllByRole('combobox')[1]!;
    expect(parentSelect).toHaveTextContent('Sistema Raiz');
    expect(parentSelect).not.toHaveTextContent('Edição Um');

    fireEvent.change(typeSelect, { target: { value: 'variant' } });
    parentSelect = screen.getAllByRole('combobox')[1]!;
    expect(parentSelect).not.toHaveTextContent('Sistema Raiz');
    expect(parentSelect).toHaveTextContent('Edição Um');
    expect(parentSelect).not.toHaveTextContent('Variante Um');
    expect(screen.queryByText(/Subsistema/i)).not.toBeInTheDocument();
  });
});
