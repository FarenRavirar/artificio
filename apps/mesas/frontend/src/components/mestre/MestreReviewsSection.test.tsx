// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Gate de sessão da seção de avaliações (spec 100, T3.4a / D12).
 *
 * O componente passou a consumir `GmReviewForm` do `@artificio/ui`, e o pacote
 * documenta que o guard é do CONSUMIDOR — renderizar o formulário sem checar
 * `useAuth` exporia a escrita de avaliação a visitante deslogado. Este teste
 * existe porque essa regressão não quebraria tipo nem lint: o formulário
 * simplesmente apareceria para todo mundo.
 */

const mockUseAuth = vi.fn();
const mockAuthPost = vi.fn();
const mockStartSsoLogin = vi.fn();

vi.mock('../../contexts/useAuth', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../services/apiClient', () => ({ authPost: (...args: unknown[]) => mockAuthPost(...args) }));
vi.mock('../../utils/auth', () => ({ startSsoLogin: (...args: unknown[]) => mockStartSsoLogin(...args) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { MestreReviewsSection } from './MestreReviewsSection';

const review = {
  id: 'r1',
  rating: 5,
  tags: [],
  comment: 'Excelente mestre.',
  created_at: '2026-09-01T12:00:00.000Z',
  author_name: 'Jogador',
  author_avatar: null,
};

beforeEach(() => {
  mockUseAuth.mockReset();
  mockAuthPost.mockReset();
  mockStartSsoLogin.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: [review] }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MestreReviewsSection — gate de sessão', () => {
  it('deslogado vê o convite de login e NÃO o formulário', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<MestreReviewsSection slug="mestre-teste" />);

    expect(screen.getByRole('button', { name: /entre para avaliar/i })).toBeTruthy();
    // O formulário do pacote monta um radiogroup de nota; ausente dele, não há
    // caminho de escrita na tela.
    expect(screen.queryByRole('radiogroup')).toBeNull();

    await waitFor(() => expect(screen.getByText('Excelente mestre.')).toBeTruthy());
  });

  it('logado vê o formulário do pacote e não o convite de login', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<MestreReviewsSection slug="mestre-teste" />);

    expect(screen.queryByRole('button', { name: /entre para avaliar/i })).toBeNull();
    await waitFor(() => expect(screen.getByRole('radiogroup')).toBeTruthy());
  });

  it('envia pela rota autenticada e recarrega a lista', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockAuthPost.mockResolvedValue({ ok: true });

    render(<MestreReviewsSection slug="mestre-teste" />);

    fireEvent.click(await screen.findByRole('radio', { name: /5 estrela/i }));
    fireEvent.click(screen.getByRole('button', { name: /enviar avalia/i }));

    await waitFor(() =>
      expect(mockAuthPost).toHaveBeenCalledWith(
        '/api/v1/gm/perfis/mestre-teste/reviews',
        expect.objectContaining({ rating: 5 }),
      ),
    );

    // Refetch: a montagem faz 1 GET, o envio bem-sucedido faz o segundo.
    await waitFor(() =>
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2),
    );
  });
});
