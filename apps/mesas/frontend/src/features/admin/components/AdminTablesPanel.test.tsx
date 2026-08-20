// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminTablesPanel } from './AdminTablesPanel';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@artificio/ui', () => ({
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
  { id: 't1', slug: 'mesa-ativa', title: 'Mesa Ativa', status: 'active', created_at: '2026-08-01', is_covil: false },
  { id: 't2', slug: '', title: 'Mesa Rascunho', status: 'draft', created_at: '2026-08-02', is_covil: true },
];

function renderPanel() {
  return render(
    <MemoryRouter>
      <AdminTablesPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockAuthGet.mockReset();
  mockAuthGet.mockResolvedValue({ ok: true, json: async () => ({ data: tablesFixture }) });
});

describe('AdminTablesPanel — Fase 8 (R5/R6, spec 093)', () => {
  it('busca mesas via rota admin ao montar (T8.4)', async () => {
    renderPanel();
    await waitFor(() => expect(mockAuthGet).toHaveBeenCalledWith('/api/v1/admin/tables'));
  });

  it('renderiza busca e as 2 facetas (funções 1-3)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('Mesa Ativa')).toBeTruthy());
    expect(screen.getByPlaceholderText('Buscar mesa...')).toBeTruthy();
    expect(screen.getByText('Status: todos')).toBeTruthy();
    expect(screen.getByText('Covil: todos')).toBeTruthy();
  });

  it('esconde "Copiar anúncio" para mesa não-active ou sem slug (T8.3)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('Mesa Ativa')).toBeTruthy());
    // 2 linhas; "Copiar anúncio" só aparece na mesa ativa com slug.
    expect(screen.getAllByTitle('Copiar anúncio').length).toBe(1);
  });

  it('expõe as 3 ações em lote ao selecionar (funções 4-6)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('Mesa Ativa')).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText('Selecionar linha')[0]);
    expect(screen.getByText('Arquivar')).toBeTruthy();
    expect(screen.getByText('Desarquivar')).toBeTruthy();
    expect(screen.getByText('Apagar')).toBeTruthy();
  });

  it('expõe as 4 ações por linha (funções 7-10)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('Mesa Ativa')).toBeTruthy());
    // Por linha: Publicar/ativar/cancelar, Alternar Covil, Apagar sempre;
    // Copiar anúncio só na ativa.
    expect(screen.getAllByTitle('Publicar/ativar/cancelar').length).toBe(2);
    expect(screen.getAllByTitle('Alternar Covil').length).toBe(2);
    expect(screen.getAllByTitle('Apagar').length).toBe(2);
  });
});
