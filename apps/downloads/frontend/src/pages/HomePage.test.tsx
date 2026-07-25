import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';


function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  it('renderiza título e chamada principal', () => {
    renderPage();

    expect(screen.getByText('Materiais gratuitos de RPG')).toBeInTheDocument();
    expect(
      screen.getByText(/Aventuras, fichas, mapas e mais/i),
    ).toBeInTheDocument();
  });

  it('link "Explorar catálogo" aponta para /catalogo', () => {
    renderPage();

    const link = screen.getByRole('link', { name: 'Explorar catálogo' });
    expect(link).toHaveAttribute('href', '/catalogo');
  });

  it('renderiza Header e Footer do shell compartilhado', () => {
    renderPage();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});
