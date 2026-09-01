// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MasterPart } from './MasterPart';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorApi } from '../hooks/useTableEditor';

/**
 * Teste da parte "Mestre e contato" — foco no contrato do botão de
 * sincronizar (T4.0q): texto EXATO definido pelo mantenedor, condição de
 * exibição (perfil existe E campo herdado editado) e o clique como única
 * escrita mesa→perfil. O editor de contatos (ContactMethodsEditor) e o
 * ContentEditor são mockados — o comportamento deles vive em
 * contactXss.test.tsx e no pacote @artificio/content-editor.
 */

vi.mock('../../../components/mestre/ContactMethodsEditor', () => ({
  ContactMethodsEditor: () => <div data-testid="contact-methods-editor" />,
}));
vi.mock('@artificio/content-editor', () => ({
  ContentEditor: ({ value }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="content-editor">{value}</div>
  ),
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
    gmProfilePreview: null,
    inheritedEdits: { displayName: false, bio: false, contacts: false },
    hasInheritedEdit: false,
    syncProfileToMaster: vi.fn(async () => true),
    syncingProfile: false,
    ...overrides,
  };
}

const SYNC_BUTTON_TEXT = 'Sincronizar com o Perfil Principal de Mestre';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
  );
});

describe('botão de sincronizar (T4.0q)', () => {
  it('não renderiza sem perfil de mestre', () => {
    render(<MasterPart api={makeApi({ hasGmProfile: false, hasInheritedEdit: true })} />);
    expect(screen.queryByRole('button', { name: SYNC_BUTTON_TEXT })).not.toBeInTheDocument();
  });

  it('não renderiza com perfil mas sem campo herdado editado', () => {
    render(<MasterPart api={makeApi({ hasGmProfile: true, hasInheritedEdit: false })} />);
    expect(screen.queryByRole('button', { name: SYNC_BUTTON_TEXT })).not.toBeInTheDocument();
  });

  it('renderiza com perfil E edição herdada, com o texto EXATO do mantenedor', () => {
    render(<MasterPart api={makeApi({ hasGmProfile: true, hasInheritedEdit: true })} />);
    expect(
      screen.getByRole('button', { name: SYNC_BUTTON_TEXT }),
    ).toBeInTheDocument();
  });

  it('clique chama syncProfileToMaster (a única escrita mesa→perfil do editor)', () => {
    const syncProfileToMaster = vi.fn(async () => true);
    render(
      <MasterPart
        api={makeApi({ hasGmProfile: true, hasInheritedEdit: true, syncProfileToMaster })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: SYNC_BUTTON_TEXT }));
    expect(syncProfileToMaster).toHaveBeenCalledTimes(1);
  });
});

describe('prévia do perfil público (spec 099 B10)', () => {
  const snapshot = {
    id: 'p-1',
    slug: 'mestre-corvo',
    nickname: 'Mestre Corvo',
    bioLong: 'Bio do perfil.',
    contactMethods: [],
    preferredVttPlatforms: [],
    languages: ['pt-BR'],
    tagline: 'Aventuras épicas toda quinta',
  };

  it('não renderiza sem snapshot do perfil (loading/none/error)', () => {
    render(<MasterPart api={makeApi({ gmProfilePreview: null })} />);
    expect(screen.queryByLabelText('Prévia do perfil')).not.toBeInTheDocument();
  });

  it('renderiza o hero real com o texto REAL do perfil (tagline atual aparece)', () => {
    render(<MasterPart api={makeApi({ gmProfilePreview: snapshot })} />);
    expect(screen.getByLabelText('Prévia do perfil')).toBeInTheDocument();
    // Texto real do snapshot — nada de valor fake nem réplica do hero.
    expect(screen.getByText('Aventuras épicas toda quinta')).toBeInTheDocument();
    expect(screen.getByText('Mestre Corvo')).toBeInTheDocument();
  });

  it('sem nickname, o display_name cai para o nome da conta (COALESCE do GET público)', () => {
    render(
      <MasterPart
        api={makeApi({ gmProfilePreview: { ...snapshot, nickname: '' } })}
        userName="Conta Do Mestre"
      />,
    );
    expect(screen.getByText('Conta Do Mestre')).toBeInTheDocument();
  });
});
