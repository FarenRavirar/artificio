import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useCatalogFilters } from './useCatalogFilters';

function CatalogFiltersHarness() {
  const { draftSearch, setDraftSearch, submitSearch } = useCatalogFilters();

  return (
    <>
      <input
        aria-label="Busca"
        value={draftSearch}
        onChange={(event) => setDraftSearch(event.target.value)}
      />
      <button type="button" onClick={submitSearch}>Confirmar</button>
    </>
  );
}

function makeRouter(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  return createMemoryRouter(
    [{ path: '*', element: <CatalogFiltersHarness /> }],
    { initialEntries, initialIndex },
  );
}

describe('useCatalogFilters — histórico da busca confirmada', () => {
  it('Back restaura a busca confirmada anterior', async () => {
    const router = makeRouter(['/']);
    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Busca' }), {
      target: { value: 'vampiro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(router.state.location.search).toBe('?search=vampiro'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Busca' }), {
      target: { value: 'dnd' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(router.state.location.search).toBe('?search=dnd'));

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => {
      expect(router.state.location.search).toBe('?search=vampiro');
      expect(screen.getByRole('textbox', { name: 'Busca' })).toHaveValue('vampiro');
    });
  });

  it('normalização silenciosa substitui a entrada inválida', async () => {
    const router = makeRouter(['/anterior', '/?sort=ending_soon']);
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.search).toBe(''));
    await act(async () => {
      await router.navigate(-1);
    });

    expect(router.state.location.pathname).toBe('/anterior');
  });
});
