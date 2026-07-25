import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificacoesPage } from './NotificacoesPage';
import * as useNotificationsModule from '../../hooks/useNotifications';
import type { Notification } from '../../types/panel';

// Débito (27 páginas sem teste de componente) — cobertura de
// NotificacoesPage: loading/vazio, render da lista (lida/não lida) e
// fluxo de marcar como lida.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    kind: 'material_approved',
    material_id: 'material-1',
    body: 'Seu material foi aprovado',
    read_at: null,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/notificacoes']}>
        <NotificacoesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockNotifications(overrides: Partial<ReturnType<typeof useNotificationsModule.useNotifications>> = {}) {
  vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useNotificationsModule.useNotifications>);
}

function mockMarkNotificationRead(mutate = vi.fn()) {
  vi.spyOn(useNotificationsModule, 'useMarkNotificationRead').mockReturnValue({
    mutate,
  } as unknown as ReturnType<typeof useNotificationsModule.useMarkNotificationRead>);
  return mutate;
}

describe('NotificacoesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockNotifications({ data: undefined, isLoading: true });
    mockMarkNotificationRead();

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há notificações', () => {
    mockNotifications({ data: [], isLoading: false });
    mockMarkNotificationRead();

    renderPage();

    expect(screen.getByText('Nenhuma notificação.')).toBeInTheDocument();
  });

  it('renderiza notificação não lida com botão de marcar como lida', () => {
    mockNotifications({ data: [makeNotification()], isLoading: false });
    mockMarkNotificationRead();

    renderPage();

    expect(screen.getByText('Seu material foi aprovado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como lida' })).toBeInTheDocument();
  });

  it('não mostra botão de marcar como lida para notificação já lida', () => {
    mockNotifications({
      data: [makeNotification({ id: 'notification-2', body: 'Já lida', read_at: '2026-07-02T00:00:00.000Z' })],
      isLoading: false,
    });
    mockMarkNotificationRead();

    renderPage();

    expect(screen.getByText('Já lida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como lida' })).not.toBeInTheDocument();
  });

  it('marca uma notificação como lida ao clicar no botão', () => {
    mockNotifications({ data: [makeNotification()], isLoading: false });
    const mutate = mockMarkNotificationRead();

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lida' }));

    expect(mutate).toHaveBeenCalledWith('notification-1');
  });
});
