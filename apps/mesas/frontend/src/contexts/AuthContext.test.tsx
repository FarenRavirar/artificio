import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from './AuthContext';

const sessionUser = { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' as const, avatar: null };

// /me fica pendente até o teste liberar: prova que a página não monta durante a hidratação.
const me = vi.hoisted(() => ({ release: () => {}, response: null as Promise<unknown> | null }));

vi.mock('@artificio/auth/client', () => ({
  getAccountsOrigin: () => 'https://accounts.test',
  // Sessão já resolvida no primeiro render: user + loading=false juntos (batch do useSession real).
  useSession: () => ({ user: sessionUser, loading: false }),
}));

vi.mock('../services/apiClient', () => ({
  authGet: vi.fn(() => me.response),
}));

describe('AuthProvider + ProtectedRoute', () => {
  it('não monta a página protegida antes de hidratar o perfil local (evita GET duplicado abortado)', async () => {
    me.response = new Promise((resolve) => {
      me.release = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: { user: { id: 'u1', role: 'admin' }, profile: { display_name: 'A' } } }),
      });
    });

    const mounts = vi.fn();
    function Page() {
      useEffect(() => { mounts(); }, []);
      return <p>pagina</p>;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute requiredRole="admin">
            <Page />
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Validando sessão...')).toBeTruthy();
    expect(mounts).not.toHaveBeenCalled();

    me.release();

    await waitFor(() => expect(screen.getByText('pagina')).toBeTruthy());
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
