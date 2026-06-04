// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SystemSuggestionModal } from '../components/SystemSuggestionModal';

const authState = vi.hoisted(() => ({ role: 'gm' as 'gm' | 'admin' }));

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
          json: async () => ({ data: [] }),
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

    fireEvent.click(screen.getByRole('button', { name: /enviar sugest/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'system-1', name: 'Sistema Teste' }));

    const postCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(String(postCall?.[0])).toContain('/api/v1/systems/admin');
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      name: 'Sistema Teste',
      node_type: 'system',
    });
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });
});
