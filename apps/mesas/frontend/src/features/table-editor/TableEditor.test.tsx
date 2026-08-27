// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultEditorState } from './hooks/useTableEditor';
import type { TableEditorApi } from './hooks/useTableEditor';
import { TableEditor } from './TableEditor';

/** Diretório deste arquivo, relativo à raiz do app (cwd do vitest). */
const DIR = resolve(process.cwd(), 'src/features/table-editor');

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
    applyParserPreview: vi.fn(),
    parserFilledFields: new Set<string>(),
    parserSignals: null,
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

/**
 * A1 (spec 096) — a coluna de trabalho tem de ser ALCANÇÁVEL.
 *
 * O critério escrito em `spec.md:1097` é `scrollHeight <= clientHeight` em cada
 * parte. Medido em beta (2026-08-26), a parte `identity` reprovava esse
 * critério nas DUAS resoluções que ele nomeia — 2166px de excedente a
 * 1366×768 e 1854px a 1920×1080. O `overflow:hidden` não fazia A1 passar: ele
 * ESCONDIA a falha, cortando 774px de formulário — cinco campos, dois deles
 * obrigatórios (`Descrição da mesa`, `Sistema da mesa`) — sem barra, com a
 * roda do mouse inerte e sem nenhum ancestral rolável, enquanto o rodapé
 * acusava "Campos obrigatórios faltando em: Identidade".
 *
 * O R1 corrigido pelo mantenedor (`spec.md:15-19`, 2026-08-25) proíbe rolagem
 * INTERNA — gaveta, sub-área com barra própria —, e diz que "a página em si
 * rola normalmente"; a leitura literal de "documento travado em
 * `overflow:hidden`" é nomeada ali como NÃO sendo o desenho. Era essa leitura
 * que o código tinha.
 *
 * jsdom não faz layout: `scrollHeight` é sempre 0 aqui, então medir o critério
 * numérico neste ambiente daria verde vazio (E022). O que este teste trava é a
 * REGRESSÃO estrutural: que nenhum nível da casca volte a `overflow:hidden` e
 * que os wrappers das partes não voltem a `h-full overflow-hidden`. A medição
 * numérica de A1 é de navegador real.
 */
describe('A1 — conteúdo da parte não pode ficar inalcançável', () => {
  // Lê os ARQUIVOS-FONTE das 7 parts: neste teste as parts estão mockadas, e
  // um assert sobre o DOM renderizado passaria com o defeito reinjetado
  // (verificado — o teste anterior não mordia). A fonte é o que prova.
  const PARTS = [
    'IdentityPart',
    'WhenPart',
    'WherePart',
    'ValuesPart',
    'AudiencePart',
    'MasterPart',
    'ExtrasPart',
  ];

  it.each(PARTS)('%s não corta o próprio conteúdo com h-full/overflow-hidden', (part) => {
    const fonte = readFileSync(
      resolve(DIR, 'parts', `${part}.tsx`),
      'utf8',
    );

    // O wrapper interno cortava ANTES de o pai poder rolar: `h-full
    // overflow-hidden` estava repetido nos 7 arquivos, e por isso a parte
    // `identity` escondia 774px — cinco campos, dois obrigatórios.
    expect(fonte).not.toMatch(/max-w-\[900px\][^"]*overflow-hidden/);
    expect(fonte).not.toMatch(/max-w-\[900px\][^"]*h-full/);
  });

  it('a casca deixa a coluna de trabalho rolar em vez de cortar', () => {
    // Comentários de bloco no CSS contêm chaves, então recortar a regra por
    // regex é frágil: compara-se o arquivo com os comentários removidos.
    const css = readFileSync(resolve(DIR, 'TableEditor.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );

    // R1 corrigido pelo mantenedor (spec.md:15-19, 2026-08-25): o que se
    // proíbe é rolagem INTERNA (gaveta, sub-área com barra própria); "a página
    // em si rola normalmente", e a leitura literal de "documento travado em
    // overflow:hidden" é nomeada ali como NÃO sendo o desenho. Era essa
    // leitura que o código tinha, e ela escondia 774px de formulário.
    // Quem rola é o DOCUMENTO (achado de review, PR #290, Codex P1): com o
    // overflow em cada parte, toda parte virava uma subárea rolável
    // independente — a "caixinha que rola dentro da página" que o R1 proíbe.
    expect(css).toMatch(/\.table-editor-document\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).not.toMatch(/\.table-editor-document\s*\{[^}]*overflow:\s*hidden/);
    // E a parte NÃO pode ter barra própria de volta.
    expect(css).not.toMatch(/\.table-editor-part\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).not.toMatch(/\.table-editor-part\s*\{[^}]*overflow:\s*hidden/);
  });

  it('a nav de partes expõe o gancho da media query de tela estreita', () => {
    // Sem esta classe a regra que vira a lateral em faixa horizontal abaixo de
    // 720px deixa de casar em silêncio, e o formulário volta a receber 90px de
    // largura em 390px (medido antes da correção).
    const { container } = renderEditor(makeApi());

    expect(container.querySelector('.table-editor-parts-nav')).toBeInTheDocument();
  });

  it('trocar de parte volta o documento ao topo', () => {
    // Achado de review (PR #290, Codex P2): a <section> é a mesma em todas as
    // partes — só os filhos condicionais trocam —, então o scrollTop sobrevivia
    // à navegação. Medido com duas partes altas: 800px de scroll persistiam
    // intactos na parte de destino, escondendo os primeiros campos dela.
    const { container } = renderEditor(makeApi());
    const doc = container.querySelector('.table-editor-document') as HTMLElement;
    expect(doc).toBeInTheDocument();

    // jsdom não faz layout, então `scrollTop` fica em 0 sozinho: simula-se a
    // posição rolada antes de trocar de parte para que o assert tenha o que
    // provar. Foi este teste que denunciou o uso de `Element.scrollTo`, que o
    // jsdom não implementa — e que teria quebrado o editor no mesmo ambiente.
    doc.scrollTop = 800;

    fireEvent.click(screen.getByRole('button', { name: 'Valores' }));

    expect(doc.scrollTop).toBe(0);
  });

  it('a casca declara o ponto de quebra para tela estreita', () => {
    const css = readFileSync(resolve(DIR, 'TableEditor.css'), 'utf8');

    // Antes da correção não havia NENHUMA media query no arquivo e nenhuma
    // classe responsiva no diretório: o grid `300px` fixo deixava 90px para o
    // formulário inteiro em 390px, com 428 elementos estourando a viewport.
    expect(css).toMatch(/@media[^{]*max-width:\s*719px/);
  });

  it('a casca empilha ACIMA do header do AppShell', () => {
    const css = readFileSync(resolve(DIR, 'TableEditor.css'), 'utf8');
    const shell = readFileSync(
      resolve(process.cwd(), '../../../packages/ui/src/styles.css'),
      'utf8',
    );

    // O par medido, não um número solto: o header sticky do pacote cobria os
    // primeiros 104px do editor porque 40 < 50, escondendo a barra de estado
    // inteira ("Voltar ao painel", "Publicar", % preenchido). Duas rodadas de
    // correção de ALTURA não adiantaram nada — o defeito era empilhamento.
    //
    // O teste lê os DOIS arquivos e compara, em vez de fixar `z-index: 60` à
    // mão: se o pacote subir o header, este teste falha e aponta a causa, que é
    // exatamente o que faltou da primeira vez. Comparar contra uma constante
    // repetida aqui não pegaria isso.
    // Comentários fora ANTES de casar: o bloco que documenta esta correção cita
    // `z-index: 50` no texto, e o `[\s\S]*?` casava a menção em vez da
    // declaração — o teste lia 50 e reprovava a correção que estava certa.
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
    const cssCode = strip(css);
    const shellCode = strip(shell);

    const editorZ = Number(/\.table-editor\s*\{[^}]*?z-index:\s*(\d+)/.exec(cssCode)?.[1]);
    const headerZ = Number(
      /\.artificio-header\[data-sticky="true"\]\s*\{[^}]*?z-index:\s*(\d+)/.exec(shellCode)?.[1],
    );
    const modalZ = Number(
      /\.artificio-modal-root[^{]*\{[^}]*?z-index:\s*(\d+)/.exec(shellCode)?.[1],
    );

    expect(Number.isFinite(editorZ)).toBe(true);
    expect(Number.isFinite(headerZ)).toBe(true);
    expect(Number.isFinite(modalZ)).toBe(true);

    expect(editorZ).toBeGreaterThan(headerZ);
    // E abaixo do modal: o diálogo "Rascunho encontrado" abre SOBRE o editor e
    // precisa continuar cobrindo — subir demais troca um defeito por outro.
    expect(editorZ).toBeLessThan(modalZ);
  });
});
