import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

vi.mock('./pages/CatalogoPage', () => ({
  CatalogoPage: () => <div>catálogo unificado</div>,
}));

describe('rotas públicas do catálogo unificado', () => {
  it.each(['/','/catalogo'])('%s renderiza a mesma experiência de catálogo', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('catálogo unificado')).toBeInTheDocument();
  });
});
