import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogShowcase } from './CatalogShowcase';
import * as useMaterialsCatalogModule from '../hooks/useMaterialsCatalog';
import type { Material, MaterialListResponse } from '../types/material';

// Spec 087 (T2.4) — a vitrine e composta de prateleiras independentes, cada uma
// com sua propria consulta. O ponto sensivel e a falha: prateleira que falha e
// prateleira vazia somem igual (Requisito 16), entao so o agregado distingue
// "acervo novo" de "backend fora do ar" (achado de review PR #214, CodeRabbit).

const SHELVES = [
  { id: 'recentes', title: 'Recém adicionados', sort: 'recent' as const },
  { id: 'visitados', title: 'Mais visitados', sort: 'trending' as const },
];

function makeMaterial(): Material {
  return {
    id: 'mat-1',
    slug: 'material-1',
    title: 'Material 1',
    summary: null,
    description: null,
    material_type: 'adventure',
    access_kind: 'external_link',
    external_url: 'https://example.test/a.pdf',
    creator_id: 'user-1',
    creator_slug: 'criador-1',
    editorial_state: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

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
