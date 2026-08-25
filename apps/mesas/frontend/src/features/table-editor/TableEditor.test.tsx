// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultEditorState } from './hooks/useTableEditor';
import type { TableEditorApi } from './hooks/useTableEditor';
import { TableEditor } from './TableEditor';

/**
 * Teste da CASCA do editor: lateral com as 7 partes, navegação, pendências,
 * rodapé (A4) e modal de rascunho (A15). O hook e as parts são mockados —
 * o maquinário do hook vive em hooks/useTableEditor.test.tsx e os campos das
 * parts ganham teste próprio na onda 2. Aqui o contrato testado é o do
 * TableEditor: ele DERIVA o que renderiza do api e navega corretamente.
 */

const { useTableEditorMock } = vi.hoisted(() => ({ useTableEditorMock: vi.fn() }));
const mockUseTableEditor = useTableEditorMock as ReturnType<typeof vi.fn<() => TableEditorApi>>;

vi.mock('./hooks/useTableEditor', async () => {
  const actual = await vi.importActual<typeof import('./hooks/useTableEditor')>(
    './hooks/useTableEditor',
  );
  return {
    ...actual,
    useTableEditor: useTableEditorMock,
  };
});

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', role: 'gm', name: 'Mestre Teste' },
    isAuthenticated: true,
    isLoading: false,
    refreshSession: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('./parts/IdentityPart', () => ({ IdentityPart: () => <div data-testid="part-identity" /> }));
vi.mock('./parts/WhenPart', () => ({ WhenPart: () => <div data-testid="part-when" /> }));
vi.mock('./parts/WherePart', () => ({ WherePart: () => <div data-testid="part-where" /> }));
vi.mock('./parts/ValuesPart', () => ({ ValuesPart: () => <div data-testid="part-values" /> }));
vi.mock('./parts/AudiencePart', () => ({
  AudiencePart: () => <div data-testid="part-audience" />,
}));
vi.mock('./parts/MasterPart', () => ({ MasterPart: () => <div data-testid="part-master" /> }));
vi.mock('./parts/ExtrasPart', () => ({ ExtrasPart: () => <div data-testid="part-extras" /> }));
// A prévia usa o TableCardComponent REAL (react-query/router/useAuth) — a
// casca não provê esses providers; o contrato da prévia (mapper + card +
// "Ver como jogador") é testado em components/CardPreview.test.tsx.
vi.mock('./components/CardPreview', () => ({
  CardPreview: () => <div data-testid="card-preview" />,
}));

function makeApi(overrides: Partial<TableEditorApi> = {}): TableEditorApi {
  return {
    state: createDefaultEditorState(),
    patch: vi.fn(),
    replaceState: vi.fn(),
    validateFieldOnBlur: vi.fn(),
    errors: {},
    revealedPending: false,
    publish: vi.fn(async () => true),
    publishError: null,
    publishing: false,
    isDirty: false,
    draftStatus: 'idle',
    isEditing: false,
    isActive: false,
    showRestoreModal: false,
    savedDraft: null,
    handleRestoreDraft: vi.fn(),
    handleDiscardDraft: vi.fn(),
    firstErrorFieldToFocus: null,
    gmProfileLoading: false,
    hasGmProfile: false,
    inheritedEdits: { displayName: false, bio: false, contacts: false },
    hasInheritedEdit: false,
    syncProfileToMaster: vi.fn(async () => true),
    syncingProfile: false,
    ...overrides,
  };
}

const PART_BY_ID: Record<string, string> = {
  identity: 'Identidade',
  when: 'Quando joga',
  where: 'Onde joga',
  values: 'Valores',
  audience: 'Para quem é',
  master: 'Mestre e contato',
  extras: 'Regras e extras',
};

function renderEditor(api: TableEditorApi) {
  mockUseTableEditor.mockReturnValue(api);
  return render(<TableEditor initialData={undefined} onPublished={vi.fn()} onBack={vi.fn()} />);
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
  );
});

describe('casca do editor', () => {
  it('renderiza topbar, lateral com as 7 partes e documento em Identidade', () => {
    renderEditor(makeApi());

    expect(screen.getByText('Rascunho')).toBeInTheDocument(); // selo de criação
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    // Progresso derivado de obrigatórios sem erro (default: 3 de 7).
    expect(screen.getByText(/preenchido$/)).toBeInTheDocument();
    expect(screen.getByText('43% preenchido')).toBeInTheDocument();

    const sidebar = screen.getByRole('navigation', { name: 'Partes do anúncio' });
    for (const label of Object.values(PART_BY_ID)) {
      expect(within(sidebar).getByRole('button', { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole('region', { name: 'Identidade' })).toBeInTheDocument();
    expect(screen.getByTestId('part-identity')).toBeInTheDocument();
    expect(screen.queryByTestId('part-when')).not.toBeInTheDocument();
  });

  it('prévia do card (R22/T4.2b) renderiza na lateral', () => {
    renderEditor(makeApi());
    expect(screen.getByTestId('card-preview')).toBeInTheDocument();
  });

  it('selo e rótulo do botão refletem o estado: No ar × Rascunho × criação', () => {
    const active = renderEditor(makeApi({ isEditing: true, isActive: true }));
    expect(active.getByText('No ar')).toBeInTheDocument();
    expect(active.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    active.unmount();

    const draft = renderEditor(makeApi({ isEditing: true, isActive: false }));
    expect(draft.getByText('Rascunho')).toBeInTheDocument();
    expect(draft.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    draft.unmount();
  });

  it('indicador de autosave segue o draftStatus do hook', () => {
    const saving = renderEditor(makeApi({ draftStatus: 'saving' }));
    expect(screen.getByText('Salvando rascunho…')).toBeInTheDocument();
    saving.unmount();

    renderEditor(makeApi({ draftStatus: 'saved' }));
    expect(screen.getByText('Rascunho salvo')).toBeInTheDocument();
  });

  it('clique em Publicar chama api.publish', () => {
    const publish = vi.fn(async () => true);
    renderEditor(makeApi({ publish }));

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe('navegação entre as partes', () => {
  it('troca de parte ao clicar na lateral, cobrindo as 7', () => {
    renderEditor(makeApi());

    for (const [id, label] of Object.entries(PART_BY_ID)) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('region', { name: label })).toBeInTheDocument();
      expect(screen.getByTestId(`part-${id}`)).toBeInTheDocument();
    }
  });

  it('A4: revealedPending navega para a parte do primeiro erro e foca o documento', async () => {
    const api = makeApi();
    const { rerender } = renderEditor(api);
    expect(screen.getByTestId('part-identity')).toBeInTheDocument();

    const apiWithPending = makeApi({
      errors: { slotsOpen: 'Vagas abertas não pode ser maior que vagas totais.' },
      revealedPending: true,
      firstErrorFieldToFocus: 'slotsOpen',
    });
    mockUseTableEditor.mockReturnValue(apiWithPending);
    rerender(<TableEditor initialData={undefined} onPublished={vi.fn()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Quando joga' })).toBeInTheDocument();
      expect(screen.getByTestId('part-when')).toBeInTheDocument();
    });
  });
});

describe('pendências na lateral e no rodapé (A4)', () => {
  it('lateral mostra a contagem de pendências por parte', () => {
    renderEditor(
      makeApi({
        errors: {
          title: 'Título obrigatório',
          description: 'Descrição obrigatória',
          slotsOpen: 'Vagas abertas não pode ser maior que vagas totais.',
        },
      }),
    );

    const sidebar = screen.getByRole('navigation', { name: 'Partes do anúncio' });
    expect(within(sidebar).getByLabelText('2 pendência(s)')).toBeInTheDocument();
    expect(within(sidebar).getByLabelText('1 pendência(s)')).toBeInTheDocument();
  });

  it('rodapé lista as partes pendentes e o clique salta para a parte', () => {
    renderEditor(makeApi({ errors: { title: 'x', slotsOpen: 'y' } }));

    const footer = screen.getByRole('status');
    expect(
      within(footer).getByText('Campos obrigatórios faltando em:'),
    ).toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: 'Identidade' })).toBeInTheDocument();
    const whenButton = within(footer).getByRole('button', { name: 'Quando joga' });
    expect(whenButton).toBeInTheDocument();

    fireEvent.click(whenButton);
    expect(screen.getByRole('region', { name: 'Quando joga' })).toBeInTheDocument();
    expect(screen.getByTestId('part-when')).toBeInTheDocument();
  });

  it('sem erros o rodapé fica em silêncio', () => {
    renderEditor(makeApi());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('modal de rascunho (A15)', () => {
  it('Continuar chama handleRestoreDraft e Descartar chama handleDiscardDraft', () => {
    const handleRestoreDraft = vi.fn();
    const handleDiscardDraft = vi.fn();
    renderEditor(makeApi({ showRestoreModal: true, handleRestoreDraft, handleDiscardDraft }));

    expect(
      screen.getByRole('dialog', { name: 'Rascunho encontrado' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Encontramos um rascunho salvo. Deseja continuar de onde parou?'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(handleRestoreDraft).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Descartar'));
    expect(handleDiscardDraft).toHaveBeenCalledTimes(1);
  });

  it('sem rascunho salvo o modal não renderiza', () => {
    renderEditor(makeApi());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('erro de publish', () => {
  it('publishError aparece como alerta acessível', () => {
    renderEditor(makeApi({ publishError: 'Erro ao criar mesa' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao criar mesa');
  });
});

describe('nome do cenário (B4) — via authGet (wrapper padrão) + leitura defensiva', () => {
  it('com cenário selecionado busca GET /api/v1/scenarios/:id na MESMA engine dos catálogos', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { name: 'Curse of Strahd' } }),
    } as Response);
    renderEditor(
      makeApi({ state: { ...createDefaultEditorState(), selectedScenarioId: 'scen-1' } }),
    );

    // fetch cru não existe mais: a chamada passa pelo authGet (resolveUrl +
    // executeHttpRequest), que chega ao fetch global com a URL pública.
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/scenarios/scen-1'),
        expect.anything(),
      );
    });
  });

  it('payload com shape inesperado não derruba o editor (name não-string → null)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { name: 42 } }),
    } as Response);
    const { container } = renderEditor(
      makeApi({ state: { ...createDefaultEditorState(), selectedScenarioId: 'scen-1' } }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/scenarios/scen-1'),
        expect.anything(),
      );
    });
    // Editor segue renderizado — o nome não-string virou null sem crash.
    expect(container.querySelector('.table-editor')).toBeInTheDocument();
  });
});
