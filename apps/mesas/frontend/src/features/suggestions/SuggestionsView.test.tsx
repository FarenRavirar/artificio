// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuggestionsView } from './SuggestionsView';

const apiState = vi.hoisted(() => ({
  systems: [] as unknown[],
  scenarios: [] as unknown[],
  systemsFail: false,
  scenariosFail: false,
  suggestResult: null as { ok: boolean; error?: string } | null,
}));

vi.mock('../../utils/authenticatedFetch', () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
}));

import { authGet, authPost } from '../../utils/authenticatedFetch';

const ISO_A = '2026-08-20T10:00:00.000Z';

const systemPending = {
  id: 'sys-1',
  name: 'Vampiro: A Máscara',
  node_type: 'system',
  description: null,
  status: 'pending',
  rejection_reason: null,
  created_at: ISO_A,
  reviewed_at: null,
};

const systemApproved = {
  id: 'sys-2',
  name: 'Chamado de Cthulhu',
  node_type: 'edition',
  description: 'Terror **investigativo**.',
  status: 'approved',
  rejection_reason: null,
  created_at: ISO_A,
  reviewed_at: '2026-08-24T18:30:00.000Z',
};

const systemRejected = {
  id: 'sys-3',
  name: 'Sistema Caseiro do João',
  node_type: 'system',
  description: null,
  status: 'rejected',
  rejection_reason: 'Já existe no catálogo.',
  created_at: ISO_A,
  reviewed_at: null,
};

const scenarioApproved = {
  id: 'scn-1',
  name: 'Fantasia Urbana',
  subgenres: ['Fantasia', 'Sombrio'],
  description: null,
  status: 'approved',
  rejection_reason: null,
  created_at: ISO_A,
  reviewed_at: null,
};

function mockAuthGet() {
  vi.mocked(authGet).mockImplementation(async (endpoint: string) => {
    if (endpoint.includes('/system-suggestions/mine')) {
      return {
        ok: !apiState.systemsFail,
        json: async () => ({ data: apiState.systems }),
      } as Response;
    }
    if (endpoint.includes('/scenario-suggestions/mine')) {
      return {
        ok: !apiState.scenariosFail,
        json: async () => ({ data: apiState.scenarios }),
      } as Response;
    }
    return { ok: false, json: async () => ({ error: 'Rota inesperada' }) } as Response;
  });
}

function mockAuthPost() {
  vi.mocked(authPost).mockImplementation(async (_endpoint: string, body?: unknown) => {
    if (apiState.suggestResult) {
      return {
        ok: apiState.suggestResult.ok,
        json: async () => ({ error: apiState.suggestResult?.error }),
      } as Response;
    }
    const suggestedName =
      body && typeof body === 'object' && 'suggested_name' in body
        ? String((body as { suggested_name: unknown }).suggested_name)
        : '';
    return {
      ok: true,
      json: async () => ({
        data: { id: 'vtt-1', suggested_name: suggestedName, created_at: ISO_A },
        message: 'Sugestão enviada com sucesso! Será analisada pela equipe.',
      }),
    } as Response;
  });
}

describe('SuggestionsView', () => {
  beforeEach(() => {
    apiState.systems = [];
    apiState.scenarios = [];
    apiState.systemsFail = false;
    apiState.scenariosFail = false;
    apiState.suggestResult = null;
    vi.clearAllMocks();
    mockAuthGet();
    mockAuthPost();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('lista sugestões de sistemas e cenários com badge de status e motivo de recusa', async () => {
    apiState.systems = [systemPending, systemApproved, systemRejected];
    apiState.scenarios = [scenarioApproved];

    render(<SuggestionsView />);

    expect(await screen.findByText('Vampiro: A Máscara')).toBeInTheDocument();
    expect(screen.getByText('Chamado de Cthulhu')).toBeInTheDocument();
    expect(screen.getByText('Sistema Caseiro do João')).toBeInTheDocument();
    expect(screen.getByText('Fantasia Urbana')).toBeInTheDocument();

    expect(screen.getByText('Em análise')).toBeInTheDocument();
    expect(screen.getAllByText('Aprovada')).toHaveLength(2);
    expect(screen.getByText('Recusada')).toBeInTheDocument();

    expect(screen.getByText('Motivo da recusa')).toBeInTheDocument();
    expect(screen.getByText('Já existe no catálogo.')).toBeInTheDocument();

    // Rótulo de tipo: system → "Sistema" (2 itens), edition → "Edição", cenário → "Cenário"
    expect(screen.getAllByText(/Sistema · Enviada em/)).toHaveLength(2);
    expect(screen.getByText(/Edição · Enviada em/)).toBeInTheDocument();
    expect(screen.getByText(/Cenário · Enviada em/)).toBeInTheDocument();
  });

  it('mostra estado vazio nas duas listas quando não há sugestões', async () => {
    render(<SuggestionsView />);

    await waitFor(() => expect(screen.getAllByText('Nada por aqui ainda')).toHaveLength(2));
    expect(screen.getByRole('heading', { name: 'Não encontrou sua plataforma VTT?' })).toBeInTheDocument();
  });

  it('mostra erro com tentar novamente quando um endpoint falha', async () => {
    apiState.systemsFail = true;
    apiState.scenarios = [scenarioApproved];

    render(<SuggestionsView />);

    expect(await screen.findByText('Não foi possível carregar sugestões de sistemas')).toBeInTheDocument();
    expect(screen.getByText('Fantasia Urbana')).toBeInTheDocument();

    const callsBefore = vi.mocked(authGet).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(vi.mocked(authGet).mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('valida o nome localmente antes de chamar o backend', async () => {
    render(<SuggestionsView />);

    // Consome o fetch inicial (evita update fora de act) antes de interagir.
    await screen.findAllByText('Nada por aqui ainda');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }));

    expect(await screen.findByText('Nome da plataforma é obrigatório.')).toBeInTheDocument();
    expect(authPost).not.toHaveBeenCalled();
  });

  it('envia a sugestão de VTT e mostra o sucesso com o eco normalizado', async () => {
    render(<SuggestionsView />);

    await screen.findAllByText('Nada por aqui ainda');

    fireEvent.change(screen.getByLabelText(/nome da plataforma/i), {
      target: { value: 'Foundry VTT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }));

    expect(
      await screen.findByText('Sugestão "Foundry VTT" enviada! Será analisada pela equipe.'),
    ).toBeInTheDocument();
    expect(authPost).toHaveBeenCalledWith('/api/v1/vtt-platforms/suggest', {
      suggested_name: 'Foundry VTT',
    });
    expect(screen.getByLabelText(/nome da plataforma/i)).toHaveValue('');
  });

  it('exibe a mensagem de erro do backend (ex.: 409 duplicado) no banner', async () => {
    apiState.suggestResult = {
      ok: false,
      error: 'Já existe uma sugestão pendente para "Foundry VTT".',
    };

    render(<SuggestionsView />);

    await screen.findAllByText('Nada por aqui ainda');

    fireEvent.change(screen.getByLabelText(/nome da plataforma/i), {
      target: { value: 'Foundry VTT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }));

    expect(
      await screen.findByText('Já existe uma sugestão pendente para "Foundry VTT".'),
    ).toBeInTheDocument();
    // O campo não é limpo em erro — o usuário pode corrigir e reenviar.
    expect(screen.getByLabelText(/nome da plataforma/i)).toHaveValue('Foundry VTT');
  });
});
