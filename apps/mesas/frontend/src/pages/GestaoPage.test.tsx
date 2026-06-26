// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfirmProvider } from "@artificio/ui";

const authState = vi.hoisted(() => ({ role: 'admin' as 'admin' | 'gm' | 'player' }));

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', role: authState.role },
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./SystemsAdminView', () => ({
  SystemsAdminView: () => <div data-testid="systems-admin-view">Systems Admin</div>,
}));
vi.mock('./ScenariosAdminView', () => ({
  ScenariosAdminView: () => <div data-testid="scenarios-admin-view">Scenarios Admin</div>,
}));
vi.mock('../modules/admin/platforms/PlatformsPage', () => ({
  PlatformsPage: () => <div data-testid="platforms-page">Platforms</div>,
}));
vi.mock('../modules/admin/activity/components/ActivityPanel', () => ({
  ActivityPanel: () => <div data-testid="activity-panel">Activity</div>,
}));
vi.mock('../components/ScenarioEditModal', () => ({
  ScenarioEditModal: () => <div data-testid="scenario-edit-modal">Scenario Edit</div>,
}));
vi.mock('../modules/admin/hydration/HydrationAdminPanel', () => ({
  HydrationAdminPanel: () => <div data-testid="hydration-panel">Hydration</div>,
}));
vi.mock('../components/InlineDeleteConfirmation', () => ({
  InlineDeleteConfirmation: ({ onOpen, onConfirm }: { onOpen: () => void; onConfirm: () => void }) => (
    <button data-testid="btn-delete" onClick={() => { onOpen(); onConfirm(); }}>Excluir</button>
  ),
}));
vi.mock('../features/discord-sync/components/DiscordSyncPanel', () => ({
  DiscordSyncPanel: () => <div data-testid="discord-sync-panel">Discord Sync</div>,
}));
vi.mock('../components/SystemSuggestionResolutionDrawer', () => ({
  SystemSuggestionResolutionDrawer: () => <div data-testid="resolution-drawer">Resolution</div>,
}));
vi.mock('../modules/admin/dev-feedback/DevFeedbackPanel', () => ({
  DevFeedbackPanel: () => <div data-testid="dev-feedback-panel">Dev Feedback</div>,
}));
vi.mock('../features/inbox/components/InboxPanel', () => ({
  InboxPanel: () => <div data-testid="inbox-panel">Inbox</div>,
}));

import { GestaoPage } from './GestaoPage';

describe('GestaoPage', () => {
  beforeEach(() => {
    authState.role = 'admin';
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza titulo "Gestao Administrativa"', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Gestão Administrativa')).toBeInTheDocument();
    });
  });

  it('mostra todas as abas de navegacao', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Gerenciar Conteúdo')).toBeInTheDocument();
      expect(screen.getByText('Sugestões de Sistemas')).toBeInTheDocument();
      expect(screen.getByText('Atividades')).toBeInTheDocument();
      expect(screen.getByText('Hidratação de Dados')).toBeInTheDocument();
      expect(screen.getByText('Discord Sync')).toBeInTheDocument();
      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    });
  });

  it('renderiza null quando usuario nao e admin', () => {
    authState.role = 'gm';
    const { container } = render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);
    expect(container.innerHTML).toBe('');
  });

  it('redireciona quando role nao e admin', async () => {
    authState.role = 'gm';
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('mostra CRUD como aba padrao', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('systems-admin-view')).toBeInTheDocument();
    });
  });

  it('troca para aba Discord Sync', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Discord Sync')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discord Sync'));

    await waitFor(() => {
      expect(screen.getByTestId('discord-sync-panel')).toBeInTheDocument();
    });
  });

  it('troca para aba Atividades', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Atividades')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Atividades'));

    await waitFor(() => {
      expect(screen.getByTestId('activity-panel')).toBeInTheDocument();
    });
  });

  it('troca para aba Hidratacao de Dados', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Hidratação de Dados')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hidratação de Dados'));

    await waitFor(() => {
      expect(screen.getByTestId('hydration-panel')).toBeInTheDocument();
    });
  });

  it('troca para aba Sugestoes de Sistemas', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Sugestões de Sistemas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sugestões de Sistemas'));

    await waitFor(() => {
      expect(screen.getByText('Pendentes')).toBeInTheDocument();
      expect(screen.getByText('Aprovadas')).toBeInTheDocument();
      expect(screen.getByText('Rejeitadas')).toBeInTheDocument();
      expect(screen.getByText('Todas')).toBeInTheDocument();
    });
  });

  it('mostra subtabs do CRUD', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Sistemas')).toBeInTheDocument();
      expect(screen.getByText('Plataformas')).toBeInTheDocument();
      expect(screen.getByText('Cenários')).toBeInTheDocument();
      expect(screen.getByText('Mesas')).toBeInTheDocument();
    });
  });

  it('navega para subtab Plataformas', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Plataformas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Plataformas'));

    await waitFor(() => {
      expect(screen.getByTestId('platforms-page')).toBeInTheDocument();
    });
  });

  it('navega para subtab Cenarios', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Cenários')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cenários'));

    await waitFor(() => {
      expect(screen.getByTestId('scenarios-admin-view')).toBeInTheDocument();
    });
  });

  it('navega para subtab Mesas', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Mesas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mesas'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar mesas...')).toBeInTheDocument();
    });
  });

  it('renderiza Inbox', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Inbox')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Inbox'));

    await waitFor(() => {
      expect(screen.getByTestId('inbox-panel')).toBeInTheDocument();
    });
  });

  it('renderiza Desenvolvimento', async () => {
    render(<ConfirmProvider><GestaoPage /></ConfirmProvider>);

    await waitFor(() => {
      expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Desenvolvimento'));

    await waitFor(() => {
      expect(screen.getByTestId('dev-feedback-panel')).toBeInTheDocument();
    });
  });
});
