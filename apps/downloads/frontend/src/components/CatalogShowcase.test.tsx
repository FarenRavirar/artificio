import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogShowcase } from './CatalogShowcase';
import * as useMaterialsCatalogModule from '../hooks/useMaterialsCatalog';
import type { MaterialListResponse } from '../types/material';
import { makeMaterial } from '../test/fixtures';

// Spec 087 (T2.4) — a vitrine e composta de prateleiras independentes, cada uma
// com sua propria consulta. O ponto sensivel e a falha: prateleira que falha e
// prateleira vazia somem igual (Requisito 16), entao so o agregado distingue
// "acervo novo" de "backend fora do ar" (achado de review PR #214, CodeRabbit).

const SHELVES = [
  { id: 'recentes', title: 'Recém adicionados', sort: 'recent' as const },
  { id: 'visitados', title: 'Mais visitados', sort: 'trending' as const },
];

function renderShowcase() {
  return render(
    <MemoryRouter>
      <CatalogShowcase shelves={SHELVES} />
    </MemoryRouter>,
  );
}

describe('CatalogShowcase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('avisa quando todas as prateleiras falham', async () => {
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderShowcase();

    expect(await screen.findByRole('status')).toHaveTextContent(/não foi possível carregar o acervo/i);
  });

  // Uma prateleira fora do ar entre as outras nao merece alarme: o resto da
  // pagina esta funcionando e o aviso seria ruido.
  it('não avisa quando ao menos uma prateleira carrega', async () => {
    const ok: MaterialListResponse = {
      items: [makeMaterial()],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    };
    let call = 0;
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockImplementation(() => {
      call += 1;
      return (call === 1
        ? { data: undefined, isLoading: false, isError: true }
        : { data: ok, isLoading: false, isError: false }
      ) as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>;
    });

    renderShowcase();

    expect(await screen.findByRole('heading', { name: 'Mais visitados' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('não avisa no caminho feliz', async () => {
    const ok: MaterialListResponse = {
      items: [makeMaterial()],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: ok,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderShowcase();

    expect(await screen.findByRole('heading', { name: 'Recém adicionados' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
