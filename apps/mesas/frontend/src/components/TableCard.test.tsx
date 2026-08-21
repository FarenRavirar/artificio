// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TableCardComponent } from './TableCard';
import type { TableCard } from '../types/tables';

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../utils/auth', () => ({ startSsoLogin: vi.fn() }));

const table: TableCard = {
  id: 'table-1',
  slug: 'mesa-teste',
  title: 'Mesa teste',
  description: null,
  cover_url: null,
  status: 'active',
  type: 'campanha',
  audience: 'livre',
  modality: 'online',
  price_type: 'gratuita',
  price_value: null,
  slots_total: 5,
  slots_filled: 1,
  slots_open: 4,
  language: 'pt-BR',
  experience_level: 'intermediario',
  featured: false,
  publisher_role: 'gm',
  actual_gm_name: null,
  contacts: [],
  system_name: 'Dungeons & Dragons',
  system_slug: 'dungeons-dragons',
  gm_slug: 'mestre-teste',
  gm_avatar_url: null,
  gm_display_name: 'Mestre Teste',
  gm_bio_long: null,
  is_ddal: false,
  is_covil: false,
  created_at: '2026-08-21T00:00:00.000Z',
};

describe('TableCardComponent — semântica de links', () => {
  it('mantém links do card e do mestre como irmãos, sem âncora ou botão aninhado', () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={table} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.querySelector('a a')).toBeNull();
    expect(container.querySelector('a button')).toBeNull();
    expect(container.querySelector('article > a[href="/mesas/mesa-teste"]')).not.toBeNull();
    expect(container.querySelector('a[href="/mestre/mestre-teste"]')).not.toBeNull();
  });
});
