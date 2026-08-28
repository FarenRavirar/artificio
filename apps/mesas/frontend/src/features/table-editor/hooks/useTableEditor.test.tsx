// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { useAutosave } from '../../create-table/hooks/useAutosave';
import { draftStorage } from '../../create-table/utils/draftStorage';
import { authGet, authPost, authPut, authPatch } from '../../../utils/authenticatedFetch';
import { createDefaultEditorState, EDITOR_DRAFT_KEY, useTableEditor } from './useTableEditor';
import type { TableEditorState } from '../types';
import type { DraftStatus } from '../../create-table/hooks/useAutosave';

/**
 * Hook central do editor (T4.4/T4.6/T4.7) + perfil do mestre (T4.0p/T4.0p2/
 * T4.0q). Mockados os vizinhos de efeito: useAutosave (cache local),
 * draftStorage (modal de restauração), o quarteto auth* (rede) e useAuth
 * (nome da conta, fallback do nickname do perfil novo). O que se testa aqui é
 * a MÁQUINA de estados do useTableEditor: publish (A4), autosave remoto,
 * restauração de rascunho, herança do perfil (A19), criação do perfil no
 * primeiro publish (T4.0p2) e sincronização deliberada (T4.0q/A20).
 */
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }));

vi.mock('../../create-table/hooks/useAutosave', () => ({
  useAutosave: vi.fn(),
}));
vi.mock('../../create-table/utils/draftStorage', () => ({
  draftStorage: { load: vi.fn(), clear: vi.fn(), save: vi.fn(), exists: vi.fn() },
}));
vi.mock('../../../utils/authenticatedFetch', () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
  authPut: vi.fn(),
  authPatch: vi.fn(),
}));
// Instrumentação (T4.0i): o pacote é no-op sem window.gtag, mas os testes de
// eventos precisam do mock para ASSERTAR as chamadas.
vi.mock('@artificio/analytics', () => ({
  trackEvent: trackEventMock,
}));
// useAuth exposto como vi.fn para o teste reconfigurar o nome da conta
// (fallback do nickname na criação do perfil — T4.0p2).
vi.mock('../../../contexts/useAuth', () => ({
  useAuth: useAuthMock,
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const mockUseAutosave = vi.mocked(useAutosave);
const mockDraftStorage = vi.mocked(draftStorage);
const mockAuthGet = vi.mocked(authGet);
const mockAuthPost = vi.mocked(authPost);
const mockAuthPut = vi.mocked(authPut);
const mockAuthPatch = vi.mocked(authPatch);
const mockClearDraft = vi.fn();

const okResponse = (data: unknown = {}) =>
  Promise.resolve({ ok: true, json: async () => data } as Response);
const failResponse = (json: Record<string, unknown> = {}, status = 400) =>
  Promise.resolve({ ok: false, status, json: async () => json } as unknown as Response);

/** Perfil de mestre existente devolvido por GET /gm/me (shape real do backend). */
function makeProfileData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p-1',
    slug: 'mestre-corvo',
    nickname: 'Mestre Corvo',
    bio_long: 'Bio longa do perfil do mestre.',
    languages: ['pt-BR'],
    specialties: ['dark-fantasy'],
    contact_methods: [
      { channel: 'whatsapp', value: '+5511999999999', label: 'Zap' },
    ],
    ...overrides,
  };
}

/** Configura o GET /gm/me: null = 404 (mestre SEM perfil). */
function mockProfileFetch(profile: Record<string, unknown> | null = null) {
  if (profile === null) {
    mockAuthGet.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'not found' }) } as unknown as Response),
    );
  } else {
    mockAuthGet.mockImplementation(() => okResponse({ data: profile }));
  }
}

/** Estado válido o bastante para publish passar pela validação (A4). */
function makeValidState(overrides: Partial<TableEditorState> = {}): TableEditorState {
  return {
    ...createDefaultEditorState(),
    title: 'Mesa de teste do editor',
    description: 'Descrição completa o suficiente para passar na validação mínima de dez.',
    selectedSystemId: 'sys-1',
    contacts: [{ channel: 'whatsapp', value: '+5511999999999', label: '', discord_server_url: '' }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  mockUseAutosave.mockReturnValue({
    draftStatus: 'idle' as DraftStatus,
    lastSaved: null,
    clearDraft: mockClearDraft,
  });
  mockDraftStorage.load.mockReturnValue(null);
  useAuthMock.mockReturnValue({
    user: { id: 'u-1', role: 'gm', name: 'Mestre Teste' },
    isAuthenticated: true,
    isLoading: false,
    refreshSession: vi.fn(),
    logout: vi.fn(),
  });
  // Default: mestre SEM perfil (404) — nenhuma herança, nenhuma criação de
  // perfil; os testes que precisam de perfil configuram mockProfileFetch.
  mockProfileFetch(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('publish — criação, edição ativa e edição de rascunho', () => {
  it('criação: POST /gm/tables SEM status → PATCH /status com active → onPublished uma vez', async () => {
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    const [postUrl, postPayload] = mockAuthPost.mock.calls[0];
    expect(postUrl).toBe('/api/v1/gm/tables');
    expect('status' in (postPayload as Record<string, unknown>)).toBe(false);
    expect(mockAuthPut).not.toHaveBeenCalled();
    expect(mockAuthPatch).toHaveBeenCalledTimes(1);
    expect(mockAuthPatch).toHaveBeenCalledWith('/api/v1/gm/tables/t-1/status', {
      status: 'active',
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('criação: PATCH falhando NÃO deixa a mesa criada órfã — o republish reusa o id via PUT, sem segundo POST', async () => {
    // O id do POST não era guardado: se o PATCH falhava, remoteDraftId seguia
    // null e a tentativa seguinte fazia OUTRO POST, duplicando a mesa e
    // deixando a primeira como rascunho órfão no painel.
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-criada' } }));
    mockAuthPatch.mockImplementationOnce(() => failResponse({ error: 'falha ao promover' }));
    mockAuthPatch.mockImplementation(() => okResponse());
    mockAuthPut.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished }),
    );

    await act(async () => {
      await result.current.publish();
    });
    expect(onPublished).not.toHaveBeenCalled();

    // Segunda tentativa: a mesa já existe — PUT no id guardado, zero POST novo.
    let republished: boolean | undefined;
    await act(async () => {
      republished = await result.current.publish();
    });

    expect(republished).toBe(true);
    // Zero POST NOVO de mesa: o único /gm/tables é o da primeira tentativa.
    // (o outro POST é /gm/profile — mestre sem perfil, criado a cada publish
    // enquanto o GET /gm/me segue 404, comportamento já documentado no hook.)
    const tablePosts = mockAuthPost.mock.calls.filter(([url]) => url === '/api/v1/gm/tables');
    expect(tablePosts).toHaveLength(1);
    expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/gm/tables/t-criada', expect.anything());
    expect(mockAuthPatch).toHaveBeenLastCalledWith('/api/v1/gm/tables/t-criada/status', {
      status: 'active',
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('criação: resposta SEM id é falha de publicação, não sucesso silencioso', async () => {
    // Sem id não há como promover; antes o fluxo pulava o PATCH e mesmo assim
    // limpava o rascunho e chamava onPublished, com a mesa parada em draft.
    mockAuthPost.mockImplementation(() => okResponse({ data: {} }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(mockAuthPatch).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
    expect(result.current.publishError).toBeTruthy();
  });

  it('criação com rascunho remoto do autosave: publish REUSA o id via PUT e promove o MESMO id (zero segundo POST)', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-draft' } }));
    mockAuthPut.mockImplementation(() => okResponse());
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    // Anunciante: fora do caminho de criação de perfil — o teste isola o
    // encadeamento autosave→publish. actualGmName preenchido: o validator
    // exige nome do mestre real para anunciante.
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          actualGmName: 'Mestre Real da Mesa',
        }),
        onPublished,
      }),
    );

    // Autosave remoto: digitar + debounce 2,5s → POST cria o rascunho no
    // servidor e o hook guarda o id.
    act(() => {
      result.current.patch({ title: 'Título do rascunho remoto' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    expect(mockAuthPost).toHaveBeenCalledWith(
      '/api/v1/gm/tables',
      expect.objectContaining({ title: 'Título do rascunho remoto' }),
    );

    // Publicar com o rascunho já no servidor: PUT no MESMO id do autosave.
    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    // Zero segundo POST — a mesa não é duplicada.
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    expect(mockAuthPut).toHaveBeenCalledTimes(1);
    const [putUrl, putPayload] = mockAuthPut.mock.calls[0];
    expect(putUrl).toBe('/api/v1/gm/tables/t-draft');
    expect('status' in (putPayload as Record<string, unknown>)).toBe(false);
    // O PATCH promove o MESMO id do PUT — o rascunho do autosave é a mesa
    // publicada (sem órfão).
    expect(mockAuthPatch).toHaveBeenCalledTimes(1);
    expect(mockAuthPatch).toHaveBeenCalledWith('/api/v1/gm/tables/t-draft/status', {
      status: 'active',
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('edição de mesa ativa: PUT sem status e SEM PATCH de promoção', async () => {
    mockAuthPut.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'active' },
        onPublished,
      }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    expect(mockAuthPut).toHaveBeenCalledTimes(1);
    const [putUrl, putPayload] = mockAuthPut.mock.calls[0];
    expect(putUrl).toBe('/api/v1/gm/tables/t-9');
    expect('status' in (putPayload as Record<string, unknown>)).toBe(false);
    expect(mockAuthPost).not.toHaveBeenCalled();
    expect(mockAuthPatch).not.toHaveBeenCalled();
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('edição de rascunho: PUT + PATCH /status para publicar', async () => {
    mockAuthPut.mockImplementation(() => okResponse());
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'draft' },
        onPublished,
      }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    expect(mockAuthPut).toHaveBeenCalledTimes(1);
    expect(mockAuthPatch).toHaveBeenCalledTimes(1);
    expect(mockAuthPatch).toHaveBeenCalledWith('/api/v1/gm/tables/t-9/status', {
      status: 'active',
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('publicar com pendências: valida, revela e NENHUM fetch acontece (A4)', async () => {
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({ initialData: createDefaultEditorState(), onPublished }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(result.current.revealedPending).toBe(true);
    expect(result.current.errors.title).toBe('Título obrigatório');
    expect(result.current.firstErrorFieldToFocus).toBe('title');
    expect(mockAuthPost).not.toHaveBeenCalled();
    expect(mockAuthPut).not.toHaveBeenCalled();
    expect(mockAuthPatch).not.toHaveBeenCalled();
    expect(mockClearDraft).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('falha na rede vira publishError e publish false, sem derrubar', async () => {
    mockAuthPost.mockImplementation(() => failResponse({ error: 'Erro de contrato do backend' }));
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished }),
    );

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(result.current.publishError).toBe('Erro de contrato do backend');
    expect(onPublished).not.toHaveBeenCalled();
  });
});

describe('autosave remoto — debounce 2,5s, só rascunho', () => {
  it('POST na criação guarda o id; saves seguintes viram PUT', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-77' } }));
    mockAuthPut.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    // Só dispara quando isDirty: sem mudança, o timer não salva nada.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mockAuthPost).not.toHaveBeenCalled();

    act(() => {
      result.current.patch({ title: 'Título novo' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    expect(mockAuthPost).toHaveBeenCalledWith(
      '/api/v1/gm/tables',
      expect.objectContaining({ title: 'Título novo' }),
    );

    act(() => {
      result.current.patch({ description: 'Outra descrição bem longa para o save remoto.' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPut).toHaveBeenCalledTimes(1);
    expect(mockAuthPut).toHaveBeenCalledWith(
      '/api/v1/gm/tables/t-77',
      expect.objectContaining({ description: 'Outra descrição bem longa para o save remoto.' }),
    );
  });

  it('mesa ATIVA nunca é tocada pelo autosave', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'active' },
        onPublished: vi.fn(),
      }),
    );

    act(() => {
      result.current.patch({ title: 'Mudança que espera o clique de salvar' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mockAuthPost).not.toHaveBeenCalled();
    expect(mockAuthPut).not.toHaveBeenCalled();
    expect(mockAuthPatch).not.toHaveBeenCalled();
  });

  // Relato de produção 2026-08-27: 7 POST /gm/tables com 400 idêntico numa
  // sessão. O autosave reenviava o mesmo corpo recusado a cada tecla e o toast
  // genérico escondia o motivo que o backend já mandava em `{ error, field }`.
  it('400 no autosave mostra o motivo do servidor e NÃO reenvia o mesmo corpo', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() =>
      failResponse({ error: 'Sistema inválido ou não encontrado no catálogo.', field: 'system_id' }),
    );
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    act(() => {
      result.current.patch({ title: 'Primeira tentativa' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });

    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Não foi possível salvar o rascunho: Sistema inválido ou não encontrado no catálogo. (campo: system_id)',
    );

    // Sem mudança real de conteúdo, o ciclo seguinte não repete o POST recusado.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);

    // Achado Codex (PR #292): digitar em campo NÃO relacionado não pode
    // destravar o autosave — o `system_id` recusado continua igual, então o
    // POST tomaria o mesmo 400 e a rajada voltaria.
    act(() => {
      result.current.patch({ title: 'Mexendo em outro campo' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);

    // Corrigir o CAMPO APONTADO pelo backend é o que libera a retentativa.
    act(() => {
      result.current.patch({ selectedSystemId: 'sistema-valido-agora' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(2);
  });

  // Achado Codex (PR #292): 401/403/404 não são "o corpo está errado" — o mesmo
  // payload passa a valer sem edição nenhuma quando a condição se resolve.
  // `POST /gm/tables` responde 403 enquanto o perfil de mestre não existe.
  it('403 no autosave NÃO trava o retry: mesmo payload volta a ser tentado', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() =>
      failResponse({ error: 'Perfil de mestre não encontrado.' }, 403),
    );
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    act(() => {
      result.current.patch({ title: 'Primeira tentativa' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);

    // Perfil passa a existir; o conteúdo é o mesmo e precisa ser reenviado.
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-403' } }));
    act(() => {
      result.current.patch({ title: 'Segunda tentativa' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(2);
  });

  it('falha de fetch no autosave não derruba a digitação (toast)', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() => Promise.reject(new Error('rede caiu')));
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    act(() => {
      result.current.patch({ title: 'Sobrevive à falha' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Não foi possível salvar o rascunho no servidor.',
    );
    // O hook continua utilizável: nova mudança tenta salvar de novo.
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-78' } }));
    act(() => {
      result.current.patch({ title: 'Tenta de novo' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(2);
  });

  it('POST do autosave EM VOO: o publish aguarda o id em vez de criar a mesa de novo', async () => {
    // Achado Codex (PR #286): o guard `if (!active) return` descartava o id de
    // uma mesa que o servidor JÁ tinha criado. O publish então via
    // remoteDraftId === null e emitia outro POST — dois rascunhos da mesma mesa
    // no painel. O id passa a ser gravado antes do guard, e o publish espera a
    // criação em voo.
    vi.useFakeTimers();

    let resolvePost: ((value: Response) => void) | undefined;
    mockAuthPost.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }) as Promise<Response>,
    );
    mockAuthPut.mockImplementation(() => okResponse());
    mockAuthPatch.mockImplementation(() => okResponse());

    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          actualGmName: 'Mestre Real da Mesa',
        }),
        onPublished: vi.fn(),
      }),
    );

    // Digitar + debounce dispara o POST do autosave, que fica PENDENTE.
    act(() => {
      result.current.patch({ title: 'Rascunho em voo' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(mockAuthPost).toHaveBeenCalledTimes(1);

    // Publicar com o POST ainda no ar; a resposta chega no meio da cadeia.
    let published: boolean | undefined;
    await act(async () => {
      const publishing = result.current.publish();
      resolvePost?.({ ok: true, json: async () => ({ data: { id: 't-em-voo' } }) } as Response);
      published = await publishing;
    });

    expect(published).toBe(true);
    // O ponto do teste: nenhum POST novo — o publish reusou o id em voo.
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/gm/tables/t-em-voo', expect.anything());
    expect(mockAuthPatch).toHaveBeenCalledWith('/api/v1/gm/tables/t-em-voo/status', {
      status: 'active',
    });
  });

  it('C1: publish com timer de autosave pendente NÃO gera POST concorrente (timer cancelado + guard)', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-race' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    // Anunciante: fora do caminho de criação de perfil — o teste isola o
    // encadeamento autosave→publish (mesma técnica do teste de rascunho
    // remoto acima). actualGmName preenchido: exigido pelo validator.
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          actualGmName: 'Mestre Real da Mesa',
        }),
        onPublished,
      }),
    );

    // Digitar arma o timer de 2,5s do autosave remoto; publicar ANTES de ele
    // disparar (a cadeia de publish levaria >2,5s com rede real — o timer
    // antigo disparava no meio com closure velho e duplicava a mesa).
    act(() => {
      result.current.patch({ title: 'Publicado antes do autosave' });
    });

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });
    expect(published).toBe(true);

    // Deixa qualquer timer pendente disparar se ainda existir.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    // Só o POST do publish — o autosave cancelado não duplica a mesa nem
    // deixa rascunho órfão.
    expect(mockAuthPost).toHaveBeenCalledTimes(1);
    const [postUrl, postPayload] = mockAuthPost.mock.calls[0];
    expect(postUrl).toBe('/api/v1/gm/tables');
    expect(postPayload).toMatchObject({ title: 'Publicado antes do autosave' });
    expect(mockAuthPut).not.toHaveBeenCalled();
    expect(mockAuthPatch).toHaveBeenCalledTimes(1);
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('C3: autosave remoto NÃO envia parse_case_id; o publish envia (loop fecha só no submit)', async () => {
    vi.useFakeTimers();
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-draft' } }));
    mockAuthPut.mockImplementation(() => okResponse());
    mockAuthPatch.mockImplementation(() => okResponse());
    const onPublished = vi.fn();
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          actualGmName: 'Mestre Real da Mesa',
          parseCaseId: 'case-1',
        }),
        onPublished,
      }),
    );

    act(() => {
      result.current.patch({ title: 'Draft com preview do parser' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    const autosavePayload = mockAuthPost.mock.calls[0][1] as Record<string, unknown>;
    // O id do preview NÃO é reenviado a cada 2,5s de digitação
    // (types.ts:163-168: reenviado no submit; reenvio contamina
    // discord_parse_cases).
    expect('parse_case_id' in autosavePayload).toBe(false);

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });
    expect(published).toBe(true);
    const publishPayload = mockAuthPut.mock.calls[0][1] as Record<string, unknown>;
    expect(publishPayload.parse_case_id).toBe('case-1');
  });

  it('C4a: save rejeitado APÓS desmonte não dispara toast (active guard no catch)', async () => {
    vi.useFakeTimers();
    let rejectPost!: (err: unknown) => void;
    mockAuthPost.mockImplementation(
      () =>
        new Promise<Response>((_, reject) => {
          rejectPost = reject;
        }),
    );
    const hook = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );
    const { result } = hook;

    act(() => {
      result.current.patch({ title: 'Save em voo' });
    });
    // Timer dispara e o POST fica pendente — desmontar com o save em voo.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    hook.unmount();

    await act(async () => {
      rejectPost(new Error('rede caiu depois do unmount'));
    });

    // Sem o active guard, o catch chamaria toast.error após o desmonte.
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });
});

describe('rascunho local — modal de restauração (A15)', () => {
  it('handleRestoreDraft restaura o estado e limpa parseCaseId', async () => {
    mockDraftStorage.load.mockReturnValue({
      ...makeValidState(),
      title: 'Rascunho salvo localmente',
      parseCaseId: 'case-sujo',
    } as TableEditorState);
    const { result } = renderHook(() =>
      useTableEditor({ initialData: undefined, onPublished: vi.fn() }),
    );

    await waitFor(() => expect(result.current.showRestoreModal).toBe(true));
    expect(mockDraftStorage.load).toHaveBeenCalledWith(EDITOR_DRAFT_KEY);

    act(() => {
      result.current.handleRestoreDraft();
    });

    expect(result.current.state.title).toBe('Rascunho salvo localmente');
    expect(result.current.state.parseCaseId).toBeNull();
    expect(result.current.showRestoreModal).toBe(false);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Rascunho restaurado');
  });

  it('handleDiscardDraft limpa o storage e fecha o modal', async () => {
    mockDraftStorage.load.mockReturnValue(makeValidState() as TableEditorState);
    const { result } = renderHook(() =>
      useTableEditor({ initialData: undefined, onPublished: vi.fn() }),
    );

    await waitFor(() => expect(result.current.showRestoreModal).toBe(true));

    act(() => {
      result.current.handleDiscardDraft();
    });

    expect(mockDraftStorage.clear).toHaveBeenCalledWith(EDITOR_DRAFT_KEY);
    expect(result.current.showRestoreModal).toBe(false);
  });

  it('em edição (com id) o modal não abre: o dado do servidor vence', async () => {
    mockDraftStorage.load.mockReturnValue(makeValidState() as TableEditorState);
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9' },
        onPublished: vi.fn(),
      }),
    );

    // Flush das microtasks do effect de restauração.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.showRestoreModal).toBe(false);
    expect(mockDraftStorage.load).not.toHaveBeenCalled();
  });

  it('B1: campo de array que não é array → draft descartado, editor nasce limpo', async () => {
    mockDraftStorage.load.mockReturnValue({
      ...makeValidState(),
      contacts: 'corrompido', // não-array onde o publish faz .filter
    } as unknown as TableEditorState);
    const { result } = renderHook(() =>
      useTableEditor({ initialData: undefined, onPublished: vi.fn() }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.showRestoreModal).toBe(false);
    expect(result.current.savedDraft).toBeNull();
    // O draft inválido é LIMPO do storage para não reaparecer.
    expect(mockDraftStorage.clear).toHaveBeenCalledWith(EDITOR_DRAFT_KEY);
    // Estado nasce do default: contatos são uma lista, não o valor sujo.
    expect(Array.isArray(result.current.state.contacts)).toBe(true);
    expect(result.current.state.title).toBe('');
  });

  it('B1: schedules não-array e elemento de contato inválido também descartam', async () => {
    mockDraftStorage.load.mockReturnValue({
      ...makeValidState(),
      schedules: 42,
    } as unknown as TableEditorState);
    const first = renderHook(() =>
      useTableEditor({ initialData: undefined, onPublished: vi.fn() }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(first.result.current.showRestoreModal).toBe(false);
    expect(mockDraftStorage.clear).toHaveBeenCalledWith(EDITOR_DRAFT_KEY);
    first.unmount();

    // Elemento de contato sem value string (crasharia em c.value.trim()).
    mockDraftStorage.load.mockReturnValue({
      ...makeValidState(),
      contacts: [{ channel: 'whatsapp' }],
    } as unknown as TableEditorState);
    const second = renderHook(() =>
      useTableEditor({ initialData: undefined, onPublished: vi.fn() }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(second.result.current.showRestoreModal).toBe(false);
    expect(mockDraftStorage.clear).toHaveBeenCalledWith(EDITOR_DRAFT_KEY);
    second.unmount();
  });
});

describe('rascunho local — autosave ligado só na criação (C2)', () => {
  it('criação passa enabled: true — recuperação de rascunho da criação preservada', async () => {
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    const calls = mockUseAutosave.mock.calls;
    const lastOptions = calls[calls.length - 1][1] as Record<string, unknown>;
    expect(lastOptions).toMatchObject({ key: EDITOR_DRAFT_KEY, enabled: true });
  });

  it('edição passa enabled: false — rascunho local NÃO grava conteúdo de mesa existente', async () => {
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'draft' },
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    // Sem isso: edita mesa → volta sem publicar → Nova mesa → modal
    // "Rascunho encontrado" com o conteúdo da mesa anterior (C2).
    const calls = mockUseAutosave.mock.calls;
    const lastOptions = calls[calls.length - 1][1] as Record<string, unknown>;
    expect(lastOptions).toMatchObject({ key: EDITOR_DRAFT_KEY, enabled: false });
  });

  it('publicar chama clearDraft — rascunho local não sobrevive à mesa publicada', async () => {
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(mockClearDraft).toHaveBeenCalledTimes(1);
  });
});

describe('perfil do mestre — herança (T4.0p, A19)', () => {
  it('pré-carrega nickname/bio/contatos do perfil e NÃO marca dirty (herdar não é editar)', async () => {
    mockProfileFetch(makeProfileData());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          masterDisplayName: '',
          tableGmBio: '',
          contacts: createDefaultEditorState().contacts, // uma linha vazia
        }),
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.state.masterDisplayName).toBe('Mestre Corvo');
    expect(result.current.state.tableGmBio).toBe('Bio longa do perfil do mestre.');
    expect(result.current.state.contacts).toEqual([
      { channel: 'whatsapp', value: '+5511999999999', label: 'Zap', discord_server_url: '' },
    ]);
    // Sem marca de origem: o campo vir preenchido já comunica (decisão
    // 2026-08-24). Herdar é estado inicial, não edição — dirty criaria
    // rascunho remoto só por abrir o editor.
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasGmProfile).toBe(true);
    expect(result.current.hasInheritedEdit).toBe(false);
  });

  it('mesa em edição com valor salvo mantém o salvo e nasce já "editada" (A19)', async () => {
    mockProfileFetch(makeProfileData());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: {
          ...makeValidState(),
          id: 't-9',
          status: 'active',
          masterDisplayName: 'Nome Desta Mesa',
          tableGmBio: 'Bio desta mesa.',
        },
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    // O valor salvo da mesa vence o perfil; o perfil permanece intacto.
    expect(result.current.state.masterDisplayName).toBe('Nome Desta Mesa');
    expect(result.current.state.tableGmBio).toBe('Bio desta mesa.');
    // Contatos da mesa também nascem "editados": o state salvo tem o mesmo
    // whatsapp SEM o label 'Zap' do perfil — é uma lista diferente.
    expect(result.current.inheritedEdits).toEqual({
      displayName: true,
      bio: true,
      contacts: true,
    });
    expect(result.current.hasInheritedEdit).toBe(true);
  });

  it('anunciante não herda nada e nunca tem "edição herdada" (botão fora)', async () => {
    mockProfileFetch(makeProfileData());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          masterDisplayName: '',
          tableGmBio: '',
          contacts: createDefaultEditorState().contacts,
        }),
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.state.masterDisplayName).toBe('');
    expect(result.current.state.tableGmBio).toBe('');
    expect(result.current.state.contacts[0].value).toBe('');
    // Sem o filtro por publisherRole no inheritedEdits, o anunciante com
    // perfil veria o botão de sincronizar mandando vazio para o perfil.
    expect(result.current.hasInheritedEdit).toBe(false);
  });

  it('editar campo herdado liga hasInheritedEdit; editar de volta ao perfil desliga', async () => {
    mockProfileFetch(makeProfileData());
    const { result } = renderHook(() =>
      useTableEditor({
        // Contatos vazios: a herança puxa os do perfil e o baseline fica
        // idêntico ao estado — o teste isola a edição de masterDisplayName.
        initialData: makeValidState({
          masterDisplayName: '',
          tableGmBio: '',
          contacts: createDefaultEditorState().contacts,
        }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.hasInheritedEdit).toBe(false);

    act(() => {
      result.current.patch({ masterDisplayName: 'Outro Nome' });
    });
    expect(result.current.inheritedEdits.displayName).toBe(true);
    expect(result.current.hasInheritedEdit).toBe(true);

    // Editar de volta ao valor do perfil desfaz a edição (comparação com o
    // snapshot, não flag por keystroke).
    act(() => {
      result.current.patch({ masterDisplayName: 'Mestre Corvo' });
    });
    expect(result.current.hasInheritedEdit).toBe(false);
  });

  it('publish com campos herdados NÃO editados omite as chaves do payload (A19)', async () => {
    mockProfileFetch(makeProfileData());
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    await act(async () => {
      await result.current.publish();
    });

    const [postUrl, postPayload] = mockAuthPost.mock.calls[0];
    expect(postUrl).toBe('/api/v1/gm/tables');
    const payload = postPayload as Record<string, unknown>;
    expect('master_display_name' in payload).toBe(false);
    expect('table_gm_bio' in payload).toBe(false);
    // Contatos herdados SÃO gravados na mesa (a página pública não tem
    // fallback de contatos para o perfil — é isso que fecha o elo perfil→mesa).
    expect(payload.contacts).toEqual([
      expect.objectContaining({ channel: 'whatsapp', value: '+5511999999999' }),
    ]);
  });

  it('publish com campo herdado EDITADO grava o valor na mesa, sem tocar o perfil', async () => {
    mockProfileFetch(makeProfileData());
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    act(() => {
      result.current.patch({ tableGmBio: 'Bio personalizada DESTA mesa.' });
    });
    await act(async () => {
      await result.current.publish();
    });

    const payload = mockAuthPost.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.table_gm_bio).toBe('Bio personalizada DESTA mesa.');
    // masterDisplayName não editado continua OMITIDO (espelha o perfil).
    expect('master_display_name' in payload).toBe(false);
  });
});

describe('perfil do mestre — criação no primeiro publish (T4.0p2)', () => {
  it('mestre SEM perfil: publish cria o perfil ANTES da mesa, com nickname/bio/contatos da mesa', async () => {
    // beforeEach já deixa o GET /gm/me em 404 (mestre sem perfil).
    mockAuthPost.mockImplementation((url: string) =>
      url === '/api/v1/gm/profile'
        ? okResponse({ data: makeProfileData() })
        : okResponse({ data: { id: 't-1' } }),
    );
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          masterDisplayName: 'Mestre Novo',
          tableGmBio: 'Bio nova.',
          contacts: [
            { channel: 'whatsapp', value: '+5511988887777', label: '', discord_server_url: '' },
          ],
        }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    // Ordem PERFIL primeiro, depois a mesa (decisão da spec: uma escrita só,
    // o perfil nasce junto com a mesa).
    const [profileUrl, profilePayload] = mockAuthPost.mock.calls[0];
    const [tableUrl] = mockAuthPost.mock.calls[1];
    expect(profileUrl).toBe('/api/v1/gm/profile');
    expect(tableUrl).toBe('/api/v1/gm/tables');
    expect(profilePayload).toEqual({
      slug: 'mestre-novo', // slugifyFromNickname
      nickname: 'Mestre Novo',
      bio_long: 'Bio nova.',
      contact_methods: [
        { channel: 'whatsapp', value: '+5511988887777', label: null },
      ],
    });
    // Depois da criação, o baseline zera (nada está "editado" ainda).
    expect(result.current.hasInheritedEdit).toBe(false);
    expect(result.current.hasGmProfile).toBe(true);
  });

  it('se a mesa falhar DEPOIS, o perfil fica criado (comportamento aceito, documentado)', async () => {
    mockAuthPost.mockImplementation((url: string) =>
      url === '/api/v1/gm/profile'
        ? okResponse({ data: makeProfileData() })
        : failResponse({ error: 'Mesa recusada pelo backend' }),
    );
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: 'Mestre Novo', tableGmBio: 'Bio nova.' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(result.current.publishError).toBe('Mesa recusada pelo backend');
    // O POST do perfil aconteceu e ficou — a próxima tentativa de publish
    // reaproveita (o GET /gm/me volta a vê-lo).
    expect(mockAuthPost).toHaveBeenCalledTimes(2);
    expect(mockAuthPost.mock.calls[0][0]).toBe('/api/v1/gm/profile');
    expect(mockAuthPost.mock.calls[1][0]).toBe('/api/v1/gm/tables');
  });

  it('GET /gm/me com erro NÃO cria perfil às cegas (pode duplicar perfil existente)', async () => {
    mockAuthGet.mockImplementation(() => Promise.reject(new Error('rede caiu')));
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: 'Mestre Novo', tableGmBio: 'Bio nova.' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    await act(async () => {
      await result.current.publish();
    });

    // Só a mesa; nenhum POST /gm/profile (o backend valida slug, não user_id —
    // criar às cegas poderia duplicar perfil de mestre que já existe).
    expect(mockAuthPost.mock.calls.every(([url]) => url === '/api/v1/gm/tables')).toBe(true);
  });

  it('sem nickname (nem nome da conta) bloqueia a criação do perfil e não cria a mesa', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u-1', role: 'gm', name: '' },
      isAuthenticated: true,
      isLoading: false,
      refreshSession: vi.fn(),
      logout: vi.fn(),
    });
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(result.current.publishError).toBe(
      'Informe o nome de exibição do mestre para criar seu perfil.',
    );
    expect(mockAuthPost).not.toHaveBeenCalled();
  });

  it('slug em conflito (409) tenta sufixo numérico até criar', async () => {
    mockAuthPost.mockImplementation((url: string, payload: unknown) => {
      if (url !== '/api/v1/gm/profile') return okResponse({ data: { id: 't-1' } });
      const slug = (payload as { slug?: string }).slug;
      return slug === 'mestre-novo'
        ? failResponse({ error: 'slug em uso' }, 409)
        : okResponse({ data: makeProfileData() });
    });
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: 'Mestre Novo', tableGmBio: 'Bio nova.' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    const slugs = mockAuthPost.mock.calls
      .filter(([url]) => url === '/api/v1/gm/profile')
      .map(([, payload]) => (payload as { slug: string }).slug);
    expect(slugs).toEqual(['mestre-novo', 'mestre-novo-1']);
  });

  it('erro que NÃO é 409 aborta o publish com a mensagem do backend (sem retry de slug)', async () => {
    mockAuthPost.mockImplementation((url: string) =>
      url === '/api/v1/gm/profile'
        ? failResponse({ error: 'Perfil bloqueado por moderação' }, 422)
        : okResponse({ data: { id: 't-1' } }),
    );
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: 'Mestre Novo' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(false);
    expect(result.current.publishError).toBe('Perfil bloqueado por moderação');
    // Um POST só: status != 409 não tenta sufixo numérico.
    const tentativas = mockAuthPost.mock.calls.filter(([url]) => url === '/api/v1/gm/profile');
    expect(tentativas).toHaveLength(1);
  });

  it('criação sem corpo legível ainda publica — o perfil FOI criado (res.ok)', async () => {
    mockAuthPost.mockImplementation((url: string) =>
      url === '/api/v1/gm/profile'
        ? Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.reject(new Error('sem corpo')),
          } as unknown as Response)
        : okResponse({ data: { id: 't-1' } }),
    );
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: 'Mestre Novo', tableGmBio: 'Bio nova.' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let published: boolean | undefined;
    await act(async () => {
      published = await result.current.publish();
    });

    expect(published).toBe(true);
    // Fallback aplicado: o mestre passa a ter perfil mesmo sem corpo na
    // resposta (o snapshot vem do estado da mesa).
    expect(result.current.hasGmProfile).toBe(true);
  });
});

describe('perfil do mestre — sincronizar (T4.0q, A20)', () => {
  it('salvar a mesa SEM clicar em sincronizar nunca toca gm_profiles (A20)', async () => {
    mockProfileFetch(makeProfileData());
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    act(() => {
      result.current.patch({ masterDisplayName: 'Nome Editado', tableGmBio: 'Bio editada.' });
    });
    await act(async () => {
      await result.current.publish();
    });

    // Nenhum POST/PUT em /gm/profile: o publish só grava a mesa. A única
    // escrita mesa→perfil é o clique no botão de sincronizar.
    expect(
      mockAuthPost.mock.calls.some(([url]) => url === '/api/v1/gm/profile'),
    ).toBe(false);
    expect(
      mockAuthPut.mock.calls.some(([url]) => url === '/api/v1/gm/profile'),
    ).toBe(false);
  });

  it('syncProfileToMaster grava nickname/bio/contatos via PUT /gm/profile e zera o baseline', async () => {
    mockProfileFetch(makeProfileData());
    mockAuthPut.mockImplementation(() => okResponse({ data: makeProfileData() }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    act(() => {
      result.current.patch({
        masterDisplayName: 'Nome Promovido',
        tableGmBio: 'Bio promovida.',
        contacts: [
          { channel: 'email', value: 'mestre@example.com', label: 'E-mail', discord_server_url: '' },
        ],
      });
    });
    expect(result.current.hasInheritedEdit).toBe(true);

    let synced: boolean | undefined;
    await act(async () => {
      synced = await result.current.syncProfileToMaster();
    });

    expect(synced).toBe(true);
    expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/gm/profile', {
      nickname: 'Nome Promovido',
      bio_long: 'Bio promovida.',
      contact_methods: [
        { channel: 'email', value: 'mestre@example.com', label: 'E-mail' },
      ],
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Perfil sincronizado!');
    // Baseline = estado atual: o botão some até a próxima edição.
    expect(result.current.hasInheritedEdit).toBe(false);
  });

  it('sync sem perfil não escreve nada (toast de erro)', async () => {
    // beforeEach: GET /gm/me em 404 — mestre sem perfil.
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    let synced: boolean | undefined;
    await act(async () => {
      synced = await result.current.syncProfileToMaster();
    });

    expect(synced).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Perfil de mestre não encontrado para sincronizar.',
    );
    expect(mockAuthPut).not.toHaveBeenCalled();
  });

  it('falha do PUT no sync mantém o baseline (botão continua) e mostra o erro do backend', async () => {
    mockProfileFetch(makeProfileData());
    mockAuthPut.mockImplementation(() => failResponse({ error: 'Erro do backend' }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ masterDisplayName: '', tableGmBio: '' }),
        onPublished: vi.fn(),
      }),
    );
    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));

    act(() => {
      result.current.patch({ masterDisplayName: 'Nome Promovido' });
    });

    let synced: boolean | undefined;
    await act(async () => {
      synced = await result.current.syncProfileToMaster();
    });

    expect(synced).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Erro do backend');
    expect(result.current.hasInheritedEdit).toBe(true);
  });
});

describe('instrumentação (T4.0i) — eventos de analytics do editor', () => {
  it('montagem dispara editor_open UMA vez, com mode e mesa_id do estado inicial', () => {
    renderHook(() => useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }));
    expect(trackEventMock).toHaveBeenCalledWith('editor_open', {
      mode: 'create',
      mesa_id: undefined,
    });
    expect(trackEventMock.mock.calls.filter(([name]) => name === 'editor_open')).toHaveLength(1);

    trackEventMock.mockClear();
    renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'draft', slug: 'mesa-x' },
        onPublished: vi.fn(),
      }),
    );
    expect(trackEventMock).toHaveBeenCalledWith('editor_open', {
      mode: 'edit',
      mesa_id: 't-9',
    });
  });

  it('publish com sucesso dispara editor_publish com o id publicado', async () => {
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(trackEventMock).toHaveBeenCalledWith('editor_publish', {
      mesa_id: 't-1',
      mode: 'create',
    });
  });

  it('publish com pendências (A4) NÃO dispara editor_publish', async () => {
    const { result } = renderHook(() =>
      useTableEditor({ initialData: createDefaultEditorState(), onPublished: vi.fn() }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(trackEventMock).not.toHaveBeenCalledWith('editor_publish', expect.anything());
  });

  it('abandono: unmount com rascunho sujo não publicado dispara; limpo ou mesa ativa não', async () => {
    // Sujo + rascunho (criação sem id) → dispara.
    const sujo = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );
    act(() => {
      sujo.result.current.patch({ title: 'Mudou e saiu sem publicar' });
    });
    trackEventMock.mockClear();
    sujo.unmount();
    expect(trackEventMock).toHaveBeenCalledWith('editor_abandon', {
      mesa_id: undefined,
      mode: 'create',
    });

    // Limpo (abriu e saiu sem tocar) → não dispara.
    trackEventMock.mockClear();
    const limpo = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );
    limpo.unmount();
    expect(trackEventMock).not.toHaveBeenCalledWith('editor_abandon', expect.anything());

    // Mesa ATIVA com mudanças não salvas → não dispara: já está publicada, não
    // é abandono de rascunho (a definição sensível do evento).
    trackEventMock.mockClear();
    const ativa = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'active' },
        onPublished: vi.fn(),
      }),
    );
    act(() => {
      ativa.result.current.patch({ title: 'Mudou e saiu sem salvar' });
    });
    ativa.unmount();
    expect(trackEventMock).not.toHaveBeenCalledWith('editor_abandon', expect.anything());
  });

  it('aplicar prévia do parser (replaceState com parseCaseId) dispara editor_parser_use', async () => {
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    await act(async () => {
      result.current.replaceState({ ...makeValidState(), parseCaseId: 'case-1' });
    });
    expect(trackEventMock).toHaveBeenCalledWith('editor_parser_use', {
      parse_case_id: 'case-1',
    });

    // Restaurar rascunho limpa o parseCaseId (replaceState com null) — não
    // conta como uso do parser.
    trackEventMock.mockClear();
    await act(async () => {
      result.current.replaceState({ ...makeValidState(), parseCaseId: null });
    });
    expect(trackEventMock).not.toHaveBeenCalledWith('editor_parser_use', expect.anything());
  });
});

// ─── Fase 6 (spec 096): T6.4 (herança VTT/idioma) e T6.2/T6.5 (parser) ──────

describe('Fase 6 — herança de VTT e idioma (T6.4, R7)', () => {
  it('criação herda a plataforma VTT preferida (UUID) e o idioma do perfil, sem marcar dirty', async () => {
    mockProfileFetch(makeProfileData({
      preferred_vtt_platforms: ['vtt-uuid-roll20'],
      languages: ['en'],
    }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({ vttPlatformId: '', language: 'pt-BR' }),
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    // O UUID entra no estado; o WherePart converte para slug quando o
    // catálogo carrega (mesma mecânica da edição de mesa legada).
    expect(result.current.state.vttPlatformId).toBe('vtt-uuid-roll20');
    expect(result.current.state.language).toBe('en');
    // Herdar é estado inicial, não edição (dirty criaria rascunho remoto só
    // por abrir o editor).
    expect(result.current.isDirty).toBe(false);
  });

  it('mesa em edição mantém o idioma salvo — a herança de language é só na criação', async () => {
    mockProfileFetch(makeProfileData({ languages: ['en'] }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'draft', language: 'pt-BR' },
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.state.language).toBe('pt-BR');
  });

  it('mesa em edição com VTT vazio herda a preferida (mesma regra dos demais campos: só preenche vazio)', async () => {
    mockProfileFetch(makeProfileData({ preferred_vtt_platforms: ['vtt-uuid-foundry'] }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: { ...makeValidState(), id: 't-9', status: 'draft', vttPlatformId: '' },
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.state.vttPlatformId).toBe('vtt-uuid-foundry');
  });

  it('anunciante não herda VTT nem idioma', async () => {
    mockProfileFetch(makeProfileData({
      preferred_vtt_platforms: ['vtt-uuid-roll20'],
      languages: ['en'],
    }));
    const { result } = renderHook(() =>
      useTableEditor({
        initialData: makeValidState({
          publisherRole: 'announcer',
          vttPlatformId: '',
          language: 'pt-BR',
        }),
        onPublished: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gmProfileLoading).toBe(false));
    expect(result.current.state.vttPlatformId).toBe('');
    expect(result.current.state.language).toBe('pt-BR');
  });
});

describe('Fase 6 — prévia do parser: marcas e sinais (T6.2, R5)', () => {
  it('applyParserPreview registra os campos preenchidos e os sinais; replaceState limpa ambos', async () => {
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    const signals = {
      missingFields: ['day_of_week'],
      priceAmbiguous: true,
      scheduleAmbiguous: false,
      slotsAmbiguous: null,
      rawSystemHint: null,
    };

    await act(async () => {
      result.current.applyParserPreview(
        { ...makeValidState(), parseCaseId: 'case-1', title: 'Título do anúncio' },
        ['title'],
        signals,
      );
    });

    expect(result.current.state.title).toBe('Título do anúncio');
    expect(result.current.parserFilledFields.has('title')).toBe(true);
    expect(result.current.parserFilledFields.has('description')).toBe(false);
    expect(result.current.parserSignals).toEqual(signals);

    // Trocar o estado inteiro (ex.: restaurar rascunho) desfaz as marcas —
    // "veio do anúncio" só vale para a prévia desta sessão.
    await act(async () => {
      result.current.replaceState({ ...makeValidState(), parseCaseId: null });
    });
    expect(result.current.parserFilledFields.size).toBe(0);
    expect(result.current.parserSignals).toBeNull();
  });

  it('campo editado pelo mestre perde a marca "Pelo anúncio"; os demais permanecem', async () => {
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    await act(async () => {
      result.current.applyParserPreview(
        { ...makeValidState(), parseCaseId: 'case-1', title: 'Título do anúncio' },
        ['title', 'priceType'],
        null,
      );
    });
    expect(result.current.parserFilledFields.has('title')).toBe(true);
    expect(result.current.parserFilledFields.has('priceType')).toBe(true);

    // O mestre reescreve o título: aquele campo passa a ser manual, os outros
    // continuam vindos do anúncio.
    await act(async () => {
      result.current.patch({ title: 'Título reescrito pelo mestre' });
    });
    expect(result.current.parserFilledFields.has('title')).toBe(false);
    expect(result.current.parserFilledFields.has('priceType')).toBe(true);
  });

  it('T6.5: publicar NUNCA é bloqueado por campo preenchido pelo parser — estado 100% do anúncio publica', async () => {
    mockAuthPost.mockImplementation(() => okResponse({ data: { id: 't-1' } }));
    mockAuthPatch.mockImplementation(() => okResponse());
    const { result } = renderHook(() =>
      useTableEditor({ initialData: makeValidState(), onPublished: vi.fn() }),
    );

    // Aplica a prévia "adivinhando" todos os obrigatórios (título, sistema,
    // vagas, contato) e com sinais de ambiguidade abertos.
    await act(async () => {
      result.current.applyParserPreview(
        makeValidState(),
        ['title', 'description', 'selectedSystemId', 'slotsTotal', 'slotsOpen', 'contacts'],
        {
          missingFields: [],
          priceAmbiguous: true,
          scheduleAmbiguous: true,
          slotsAmbiguous: { first: 2, second: 4 },
          rawSystemHint: 'Xyz',
        },
      );
    });

    // Nenhuma ambiguidade bloqueia: o publish segue para a escrita.
    const published = await act(async () => result.current.publish());
    expect(published).toBe(true);
    expect(mockAuthPost).toHaveBeenCalledWith('/api/v1/gm/tables', expect.anything());
  });
});
