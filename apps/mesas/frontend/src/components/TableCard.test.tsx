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

  it('mantém o link externo da plataforma VTT interativo sobre o link de fundo', () => {
    const queryClient = new QueryClient();
    const tableWithVtt: TableCard = {
      ...table,
      vtt_platform: {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'foundry-vtt',
        name: 'Foundry VTT',
        logo_filename: 'foundry.svg',
        website_url: 'https://foundryvtt.com/',
      },
    };
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={tableWithVtt} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const vttLink = container.querySelector<HTMLAnchorElement>('a[href="https://foundryvtt.com/"]');
    expect(vttLink).not.toBeNull();
    expect(vttLink).toHaveClass('pointer-events-auto');
    expect(vttLink).toHaveAttribute('target', '_blank');
    expect(vttLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // O CTA visível é decorativo; o Link de fundo é o único elemento acessível,
  // então seu nome acessível tem que bater com o rótulo visível (WCAG 2.5.3).
  it('alinha o aria-label do link do card ao CTA visível em ambos os estados', () => {
    const queryClient = new QueryClient();
    const { container, rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={table} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.querySelector('article > a')).toHaveAttribute(
      'aria-label',
      'Entrar na mesa: Mesa teste',
    );

    const endedTable: TableCard = { ...table, status: 'ended' };
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={endedTable} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.querySelector('article > a')).toHaveAttribute(
      'aria-label',
      'Ver detalhes: Mesa teste',
    );
  });

  it('renderiza o indicador de foco do link do card acima do conteúdo sem bloquear controles', () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={table} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const cardLink = container.querySelector('article > a[href="/mesas/mesa-teste"]');
    const focusRing = container.querySelector('[data-card-focus-ring]');
    expect(cardLink).toHaveClass('peer/card-link');
    expect(focusRing).toHaveClass('pointer-events-none', 'z-20');
    expect(focusRing?.className).toContain('peer-focus-visible/card-link:outline');
  });
});

// R24/A27 (spec 096): faixa etária visível no card do catálogo. Faixas reais
// ganham selo; 'livre' legítima e ausente (null) ficam em silêncio.
describe('TableCardComponent — faixa etária (R24/A27)', () => {
  function renderCard(card: TableCard) {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TableCardComponent table={card} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return container;
  }

  it('exibe o selo quando a mesa tem faixa etária real (+16)', () => {
    const container = renderCard({ ...table, age_rating: '+16' });
    expect(container.querySelector('article')).not.toBeNull();
    expect(container.textContent).toContain('+16');
    expect(container.textContent).toContain('🔞');
  });

  it('exibe o marcador "Livre" para mesa livre, sem o selo de restrição', () => {
    // Decisão do mantenedor (2026-08-24): ao escolher Livre, tem que aparecer
    // no card — mas discreto, sem o 🔞 (A27: "não ganha selo ruidoso").
    const container = renderCard({ ...table, age_rating: 'livre' });
    expect(container.textContent).toContain('Mesa teste');
    expect(container.textContent).toContain('Livre');
    expect(container.textContent).not.toContain('🔞');
  });

  it('não quebra e não exibe marcador quando a faixa é ausente (null)', () => {
    const container = renderCard({ ...table, age_rating: null });
    expect(container.textContent).toContain('Mesa teste');
    expect(container.textContent).not.toContain('🔞');
    expect(container.textContent).not.toContain('Livre');
  });

  it('não exibe marcador para valor fora do enum (lista positiva)', () => {
    // Valor inesperado (ex.: 'Livre' capitalizado vindo de backend antigo)
    // fica em silêncio — nunca vira selo com texto estranho.
    const container = renderCard({
      ...table,
      age_rating: 'Livre' as unknown as NonNullable<TableCard['age_rating']>,
    });
    expect(container.textContent).toContain('Mesa teste');
    expect(container.textContent).not.toContain('Livre');
    expect(container.textContent).not.toContain('🔞');
  });
});
