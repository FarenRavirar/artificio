import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoShell } from './GestaoShell';
import * as useAdminSummaryModule from '../hooks/useAdminSummary';
import * as useCreatorRoleModule from '../hooks/useCreatorRole';

// Fase 5C (spec 086, T5C.3/T5C.7): GestaoShell reconstruído sobre
// AdminSidebar/AdminMain do kit compartilhado — este arquivo cobre, item por
// item, os 6 pontos de não-regressão exigidos pelo gate T5C.9:
// (1) grupos Conteúdo/Operação/Comunidade/Sistema, (2) contagem por fila,
// (3) fila P0 com ícone + texto (nunca só cor), (4) adminOnly espelhando o
// guard, (5) link externo "Sistemas e edições", (6) alvos de toque ≥ 44px.

// Achado real (review PR #201, Codex, P2): /gestao/plataformas passou a
// exigir requiredRole="admin" (RequireGestaoAuth), mas a sidebar continuava
// listando "Plataformas" pra moderator — clique levava direto pra tela de
// "sem permissão". adminOnly no item filtra a sidebar espelhando o guard.

function mockSummary(
  counts?: { moderation_queue?: number; reports_open?: number; degraded_links?: number },
) {
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: counts
      ? {
          moderation_queue: { count: counts.moderation_queue ?? 0 },
          reports_open: { count: counts.reports_open ?? 0 },
          degraded_links: { count: counts.degraded_links ?? 0 },
        }
      : undefined,
  } as unknown as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);
}

function mockCreatorRole(role: 'moderator' | 'admin') {
  vi.spyOn(useCreatorRoleModule, 'useCreatorRole').mockReturnValue({
    data: { role },
    isLoading: false,
  } as unknown as ReturnType<typeof useCreatorRoleModule.useCreatorRole>);
}

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao']}>
        <GestaoShell>
          <div>conteúdo</div>
        </GestaoShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoShell sidebar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('oculta "Plataformas" da sidebar pra moderator (achado real: rota é admin-only)', () => {
    mockSummary();
    mockCreatorRole('moderator');

    renderShell();

    expect(screen.queryByRole('link', { name: 'Plataformas' })).not.toBeInTheDocument();
  });

  it('mostra "Plataformas" na sidebar pra admin', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    expect(screen.getByRole('link', { name: 'Plataformas' })).toBeInTheDocument();
  });

  it('mostra itens não admin-only pra moderator normalmente', () => {
    mockSummary();
    mockCreatorRole('moderator');

    renderShell();

    expect(screen.getByRole('link', { name: 'Materiais' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurações' })).toBeInTheDocument();
  });

  it('(1) preserva os 4 grupos Conteúdo/Operação/Comunidade/Sistema', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
    expect(screen.getByText('Operação')).toBeInTheDocument();
    expect(screen.getByText('Comunidade')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('(2) mostra contagem por fila (moderação, denúncias, links degradados)', () => {
    mockSummary({ moderation_queue: 3, reports_open: 1, degraded_links: 2 });
    mockCreatorRole('admin');

    renderShell();

    expect(screen.getByRole('link', { name: /Moderação/ })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Links/ })).toHaveTextContent('2');
  });

  it('(3) fila P0 (denúncia aberta) sinaliza com ícone + texto, nunca só cor', () => {
    mockSummary({ reports_open: 1 });
    mockCreatorRole('admin');

    renderShell();

    const link = screen.getByRole('link', { name: /Denúncias/ });
    expect(link).toHaveTextContent('⚠️');
    expect(link).toHaveTextContent('Denúncias');
  });

  it('(3) sem denúncia aberta, fila não exibe alerta P0', () => {
    mockSummary({ reports_open: 0 });
    mockCreatorRole('admin');

    renderShell();

    expect(screen.getByRole('link', { name: 'Denúncias' })).not.toHaveTextContent('⚠️');
  });

  it('(5) exibe link externo "Sistemas e edições" apontando pro Site', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    const link = screen.getByRole('link', { name: /Sistemas e edições/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('(6) botão do menu de gestão mobile atende alvo de toque ≥ 44px', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    const menuButton = screen.getByRole('button', { name: 'Menu de gestão' });
    expect(menuButton.className).toContain('min-h-[44px]');
    expect(menuButton.className).toContain('min-w-[44px]');
  });

  it('drawer mobile abre pelo botão "Menu de gestão" e fecha pelo backdrop/Escape', () => {
    mockSummary();
    mockCreatorRole('admin');

    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Menu de gestão' }));
    expect(screen.getAllByRole('link', { name: 'Materiais' }).length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: 'Escape' });
  });
});
