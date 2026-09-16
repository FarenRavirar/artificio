import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './App';

vi.mock('./pages/CatalogoPage', () => ({
  CatalogoPage: () => <div>catálogo unificado</div>,
}));

/** Onde o router parou, depois de resolver redirects. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname}{search}</output>;
}

function renderRotas(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('rotas públicas do catálogo unificado', () => {
  it.each(['/','/catalogo'])('%s renderiza a mesma experiência de catálogo', (path) => {
    renderRotas(path);

    expect(screen.getByText('catálogo unificado')).toBeInTheDocument();
  });
});

// Guard de T7.6 (spec 102): `/busca` é ALIAS de `/catalogo`, não página própria.
//
// A lupa do header em ≤860px precisa de destino, e ele não pode ser uma URL indexável
// nova: `CatalogoPage` declara `useCanonicalUrl('/')` para consolidar em `/` a autoridade
// de todos os recortes da mesma listagem. Uma `/busca` real disputaria essa autoridade.
describe('/busca — alias do catálogo (T7.6)', () => {
  it('leva ao catálogo, sem página própria', () => {
    renderRotas('/busca');

    expect(screen.getByText('catálogo unificado')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/catalogo');
  });

  it('PRESERVA o `?q=` da busca', () => {
    // O defeito que este caso trava: `<Navigate to="/catalogo" />` com `to` em STRING
    // descarta `location.search`. O usuário buscaria "mapa", cairia no catálogo sem
    // termo nenhum e nada acusaria erro — a busca sumiria no meio do caminho.
    renderRotas('/busca?q=mapa');

    expect(screen.getByTestId('location')).toHaveTextContent('/catalogo?q=mapa');
  });

  it('preserva os demais filtros junto do termo', () => {
    renderRotas('/busca?q=mapa&material_type=adventure&page=2');

    expect(screen.getByTestId('location'))
      .toHaveTextContent('/catalogo?q=mapa&material_type=adventure&page=2');
  });
});
