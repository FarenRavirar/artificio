import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import type { Termo } from '../types/glossario';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { vote_score: 1 } }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', full_name: 'Teste', email: 'teste@example.com', role: 'member' },
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@artificio/analytics', () => ({
  trackViewTermo: vi.fn(),
}));

vi.mock('@artificio/ui', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

import api from '../services/api';

const baseTermo: Termo = {
  id: 'termo/com&caracteres?especiais',
  name_en: 'Armor Class',
  name_pt: 'Classe de Armadura',
  nucleus: 'oficial',
  status: 'verificado',
};

describe('ResultCard — encodeURIComponent em chamadas de API (achado Sonar PR #151)', () => {
  it('codifica termo.id ao votar, mesmo contendo caracteres especiais de URL', async () => {
    render(<ResultCard termo={baseTermo} />);

    const voteButton = screen.getByTitle('Gostei');
    fireEvent.click(voteButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/social/${encodeURIComponent(baseTermo.id)}/vote`,
        { direction: 'up' },
      );
    });

    // Garante que a URL efetivamente enviada não contém o "/" cru do id —
    // se contivesse, seria path traversal/quebra de rota no backend.
    const calledUrl = (api.post as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).not.toContain('termo/com&caracteres?especiais');
    expect(calledUrl).toBe('/social/termo%2Fcom%26caracteres%3Fespeciais/vote');
  });
});
