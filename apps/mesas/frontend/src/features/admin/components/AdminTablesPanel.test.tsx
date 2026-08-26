// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminTablesPanel } from './AdminTablesPanel';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
import toast from 'react-hot-toast';

// Achado real (review PR #280, coderabbit, nitpick): substituir o modulo inteiro
// fazia qualquer novo import de @artificio/ui na arvore falhar com "export ausente"
// em vez de asserção clara. Sobrescreve só `useConfirm`.
vi.mock('@artificio/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

const mockAuthGet = vi.fn();
const mockAuthDelete = vi.fn();
const mockAuthPost = vi.fn();
const mockAuthPut = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  authGet: (...args: unknown[]) => mockAuthGet(...args),
  authDelete: (...args: unknown[]) => mockAuthDelete(...args),
  authPost: (...args: unknown[]) => mockAuthPost(...args),
  authPut: (...args: unknown[]) => mockAuthPut(...args),
}));

const tablesFixture = [
  // T7.2c: `featured` ausente na primeira linha de propósito — exercita o
  // normalizador (`row.featured === true`), que precisa devolver `false` em vez
  // de `undefined` para a faceta e a coluna não quebrarem com dado antigo.
  { id: 't1', slug: 'mesa-ativa', title: 'Mesa Ativa', status: 'active', created_at: '2026-08-01', is_covil: false },
  { id: 't2', slug: '', title: 'Mesa Rascunho', status: 'draft', created_at: '2026-08-02', is_covil: true, featured: true },
];

function renderPanel() {
  return render(
    <MemoryRouter>
      <AdminTablesPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Achado real (review PR #280, coderabbit, nitpick): sem reset os mocks de
  // escrita acumulavam chamadas entre testes, e uma assercao de "chamou com X"
  // passaria por causa do teste anterior.
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  mockAuthGet.mockReset();
  mockAuthDelete.mockReset();
  mockAuthPost.mockReset();
  mockAuthPut.mockReset();
  mockAuthGet.mockResolvedValue({ ok: true, json: async () => ({ data: tablesFixture }) });
  mockAuthDelete.mockResolvedValue({ ok: true, json: async () => ({}) });
  mockAuthPost.mockResolvedValue({ ok: true, json: async () => ({}) });
  mockAuthPut.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe('AdminTablesPanel — Fase 8 (R5/R6, spec 093)', () => {
  it('busca mesas via rota admin ao montar (T8.4)', async () => {
    renderPanel();
    await waitFor(() => expect(mockAuthGet).toHaveBeenCalledWith('/api/v1/admin/tables'));
  });

  it('renderiza busca e as 3 facetas (funções 1-3; destaque entrou em T7.2c)', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar mesa...')).toBeTruthy();
    expect(screen.getByText('Status: todos')).toBeTruthy();
    expect(screen.getByText('Covil: todos')).toBeTruthy();
    expect(screen.getByText('Destaque: todos')).toBeTruthy();
  });

  it('esconde "Copiar anúncio" para mesa não-active ou sem slug (T8.3)', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    // 2 linhas; "Copiar anúncio" só aparece na mesa ativa com slug.
    expect(screen.getAllByTitle('Copiar anúncio')).toHaveLength(1);
  });

  it('expõe as 3 ações em lote ao selecionar (funções 4-6)', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[0]);
    expect(screen.getByText('Arquivar')).toBeTruthy();
    expect(screen.getByText('Desarquivar')).toBeTruthy();
    expect(screen.getByText('Apagar')).toBeTruthy();
  });

  it('expõe as 5 ações por linha (funções 7-10 + destaque de T7.2c)', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    // Por linha: Publicar/ativar/cancelar, Alternar Covil, Alternar destaque e
    // Apagar sempre; Copiar anúncio só na ativa.
    expect(screen.getAllByTitle('Publicar/ativar/cancelar')).toHaveLength(2);
    expect(screen.getAllByTitle('Alternar Covil')).toHaveLength(2);
    expect(screen.getAllByTitle('Alternar destaque')).toHaveLength(2);
    expect(screen.getAllByTitle('Apagar')).toHaveLength(2);
  });
});

// T7.2c (spec 096): `featured` tinha filtro, peso na ordenação e selo, e nenhum
// escritor — nenhuma mesa podia ser destacada. O toggle é o ponto de entrada.
describe('AdminTablesPanel — toggle de destaque (T7.2c)', () => {
  it('marca destaque na mesa que não tem, e recarrega a lista', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    mockAuthGet.mockClear();

    fireEvent.click(screen.getAllByTitle('Alternar destaque')[0]);

    await waitFor(() =>
      expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/admin/tables/t1', { featured: true }),
    );
    await waitFor(() => expect(mockAuthGet).toHaveBeenCalledWith('/api/v1/admin/tables'));
  });

  it('remove o destaque da mesa que já tem', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Rascunho')).toBeTruthy();

    fireEvent.click(screen.getAllByTitle('Alternar destaque')[1]);

    await waitFor(() =>
      expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/admin/tables/t2', { featured: false }),
    );
  });

  it('avisa o admin quando a escrita falha, sem recarregar a lista', async () => {
    mockAuthPut.mockResolvedValue({
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Erro ao atualizar mesa.' }),
    });
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    mockAuthGet.mockClear();

    fireEvent.click(screen.getAllByTitle('Alternar destaque')[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockAuthGet).not.toHaveBeenCalled();
  });
});

// Achado real (review PR #280, coderabbit, nitpick): a suíte original só checava
// que os controles renderizam. Estes exercitam o comportamento — qual rota é
// chamada, com que payload, e se a lista é refeita depois da escrita.
describe('AdminTablesPanel — comportamento das ações', () => {
  it('ação em lote chama authPost com os ids selecionados e a ação', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[0]);
    fireEvent.click(screen.getByText('Arquivar'));

    await waitFor(() => expect(mockAuthPost).toHaveBeenCalled());
    const [url, payload] = mockAuthPost.mock.calls[0];
    expect(url).toBe('/api/v1/admin/tables/batch');
    expect(payload).toEqual({ ids: ['t1'], action: 'archive' });
  });

  // Achado real (review PR #280, coderabbit, integridade de dados): o toast reportava
  // ids.length; a rota devolve a contagem real via RETURNING.
  it('reporta a contagem devolvida pela rota, nao a quantidade selecionada', async () => {
    mockAuthPost.mockResolvedValue({ ok: true, json: async () => ({ data: { updated: 1 } }) });
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[0]);
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[1]);
    fireEvent.click(screen.getByText('Arquivar'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 mesa(s) arquivada(s).'));
  });

  it('apagar linha chama authDelete com o id e refaz a busca', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    expect(mockAuthGet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByTitle('Apagar')[0]);

    await waitFor(() => expect(mockAuthDelete).toHaveBeenCalledWith('/api/v1/admin/tables/t1'));
    await waitFor(() => expect(mockAuthGet).toHaveBeenCalledTimes(2));
  });

  it('publica rascunho (draft -> active) via authPut', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Rascunho')).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('Publicar/ativar/cancelar')[1]);

    await waitFor(() => expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/admin/tables/t2', { status: 'active' }));
  });

  it('cancela mesa ativa (active -> cancelled) via authPut', async () => {
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('Publicar/ativar/cancelar')[0]);

    await waitFor(() => expect(mockAuthPut).toHaveBeenCalledWith('/api/v1/admin/tables/t1', { status: 'cancelled' }));
  });

  it('esconde a ação de status em mesa full/ended, que o handler recusaria', async () => {
    mockAuthGet.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 't3', slug: 'cheia', title: 'Mesa Cheia', status: 'full', created_at: '2026-08-03', is_covil: false },
          { id: 't4', slug: 'fim', title: 'Mesa Encerrada', status: 'ended', created_at: '2026-08-04', is_covil: false },
        ],
      }),
    });
    renderPanel();
    expect(await screen.findByText('Mesa Cheia')).toBeTruthy();

    expect(screen.queryAllByTitle('Publicar/ativar/cancelar')).toHaveLength(0);
    // As demais ações por linha continuam disponíveis — o gate de T8.2 segue atendido.
    expect(screen.getAllByTitle('Alternar Covil')).toHaveLength(2);
  });

  // Achado real (review PR #280, coderabbit, outside-diff): as mutações só tratavam
  // response.ok. Com a rede caindo a promise rejeitava sem captura e a tela ficava
  // idêntica — o admin não sabia se a ação partiu.
  it('rejeição de rede na exclusão vira toast de erro, não silêncio', async () => {
    mockAuthDelete.mockRejectedValue(new Error('network down'));
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();

    fireEvent.click(screen.getAllByTitle('Apagar')[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao apagar mesa.'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('rejeição de rede na ação em lote vira toast de erro', async () => {
    mockAuthPost.mockRejectedValue(new Error('network down'));
    renderPanel();
    expect(await screen.findByText('Mesa Ativa')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[0]);
    fireEvent.click(screen.getByText('Arquivar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro na ação em lote.'));
  });

  it('falha na busca vira mensagem de erro na tela, não acervo vazio silencioso', async () => {
    mockAuthGet.mockResolvedValue({
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Sem permissão' }),
    });
    renderPanel();

    expect(await screen.findByText('Sem permissão')).toBeTruthy();
  });
});
