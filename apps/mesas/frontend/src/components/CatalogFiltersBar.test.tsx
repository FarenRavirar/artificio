// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogFiltersBar } from './CatalogFiltersBar';
import { ResultsHeader } from './ResultsHeader';
import type { CatalogFilters } from '../services/catalogService';
import { SORT_OPTIONS } from '../utils/catalogFilterOptions';

/**
 * Spec 094 Fase 2 (T2.10): uma busca geral única, submissão por botão/Enter
 * (promoção do draft é da página/hook), atalhos como aliases de filtros reais,
 * chips, limpar tudo, IDs únicos, teclado e matriz de paridade desktop/mobile
 * (aceite 14).
 */

const mockMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function makeFilters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return {
    search: '',
    system: '',
    modality: '',
    priceType: '',
    experience: '',
    seal: '',
    styles: [],
    type: '',
    sort: 'popular',
    page: 1,
    limit: 24,
    ...overrides,
  };
}

const baseProps = {
  filters: makeFilters(),
  draftSearch: '',
  onDraftSearchChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  systemsTree: [],
  systemsLoading: false,
  systemsError: null,
  selectedSystemId: null,
  onSystemSelect: vi.fn(),
  onModalityChange: vi.fn(),
  onPriceChange: vi.fn(),
  onExperienceChange: vi.fn(),
  onTypeChange: vi.fn(),
  onSealToggle: vi.fn(),
  onStyleToggle: vi.fn(),
  styleFacets: [],
  advancedCount: 0,
  systemName: undefined,
  onRemoveFilter: vi.fn(),
  onClearFilters: vi.fn(),
  onOpenMobileFilters: vi.fn(),
  mobileFiltersOpen: false,
};

describe('CatalogFiltersBar — busca geral única (R1/D0.3)', () => {
  it('existe exatamente um input com nome acessível "Buscar mesas" e nenhuma busca de sistema montada', () => {
    render(<CatalogFiltersBar {...baseProps} />);

    expect(screen.getAllByLabelText('Buscar mesas')).toHaveLength(1);
    expect(screen.getByRole('searchbox', { name: 'Buscar mesas' })).toBeInTheDocument();
    // Busca interna de sistemas só existe com o seletor aberto (aceite 3).
    expect(screen.queryByLabelText('Buscar sistema')).not.toBeInTheDocument();
  });

  it('digitar mexe só no draft; submissão do form promove via onSearchSubmit', () => {
    const onDraftSearchChange = vi.fn();
    const onSearchSubmit = vi.fn();

    render(
      <CatalogFiltersBar
        {...baseProps}
        onDraftSearchChange={onDraftSearchChange}
        onSearchSubmit={onSearchSubmit}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar mesas' }), {
      target: { value: 'vamp' },
    });

    expect(onDraftSearchChange).toHaveBeenCalledWith('vamp');
    expect(onSearchSubmit).not.toHaveBeenCalled();

    // Botão "Buscar" e Enter convergem no evento submit do form (comportamento
    // nativo do browser; jsdom não simula submit por clique/Enter, então o
    // teste dispara o evento submit diretamente).
    fireEvent.submit(screen.getByRole('search'));
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);

    const submitButton = screen.getByRole('button', { name: /Buscar/ });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('Enter no campo submete a busca exatamente uma vez', () => {
    const onSearchSubmit = vi.fn();
    render(<CatalogFiltersBar {...baseProps} onSearchSubmit={onSearchSubmit} />);

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Buscar mesas' }), { key: 'Enter' });

    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it('IDs do DOM são únicos na barra montada', () => {
    render(<CatalogFiltersBar {...baseProps} />);

    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);

    for (const expected of [
      'catalog-search',
      'catalog-system-trigger',
      'catalog-modality',
      'catalog-price',
      'catalog-more-filters',
      'catalog-search-submit',
    ]) {
      expect(document.getElementById(expected)).not.toBeNull();
    }
  });

  it('não dispara onSearchSubmit ao digitar (nenhuma request por caractere)', () => {
    const onSearchSubmit = vi.fn();

    render(<CatalogFiltersBar {...baseProps} onSearchSubmit={onSearchSubmit} />);

    const input = screen.getByRole('searchbox', { name: 'Buscar mesas' });
    fireEvent.change(input, { target: { value: 'v' } });
    fireEvent.change(input, { target: { value: 'va' } });
    fireEvent.change(input, { target: { value: 'vam' } });

    expect(onSearchSubmit).not.toHaveBeenCalled();
  });
});

describe('CatalogFiltersBar — atalhos como aliases de filtros reais (R10–R12)', () => {
  it('omite atalhos sem resultado público conforme R22', () => {
    render(<CatalogFiltersBar {...baseProps} />);

    expect(screen.queryByRole('button', { name: /Para iniciantes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'DDAL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Covil do Lich/ })).not.toBeInTheDocument();
  });

  it('"Mesas gratuitas" e "Online" são aliases de priceType/modality', () => {
    const onPriceChange = vi.fn();
    const onModalityChange = vi.fn();

    render(
      <CatalogFiltersBar
        {...baseProps}
        onPriceChange={onPriceChange}
        onModalityChange={onModalityChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Mesas gratuitas/ }));
    expect(onPriceChange).toHaveBeenCalledWith('gratuita');

    fireEvent.click(screen.getByRole('button', { name: 'Online' }));
    expect(onModalityChange).toHaveBeenCalledWith('online');
  });

  it('omite modalidades sem resultado público do seletor primário', () => {
    render(<CatalogFiltersBar {...baseProps} />);

    expect(screen.getByRole('option', { name: 'Online' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Presencial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Híbrida' })).not.toBeInTheDocument();
  });
});

describe('CatalogFiltersBar — chips e limpar tudo (R10)', () => {
  it('com filtros ativos renderiza chips removíveis e "Limpar tudo"', () => {
    const onClearFilters = vi.fn();
    const onRemoveFilter = vi.fn();

    render(
      <CatalogFiltersBar
        {...baseProps}
        filters={makeFilters({ search: 'vamp', type: 'campanha' })}
        onClearFilters={onClearFilters}
        onRemoveFilter={onRemoveFilter}
      />
    );

    expect(screen.getByText('Busca: "vamp"')).toBeInTheDocument();
    expect(screen.getByText('Campanha')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Limpar tudo/ }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('sem filtros ativos não renderiza chips nem "Limpar tudo"', () => {
    render(<CatalogFiltersBar {...baseProps} />);

    expect(screen.queryByRole('button', { name: /Limpar tudo/ })).not.toBeInTheDocument();
  });

  it('renderiza chip e limpar tudo quando apenas o sort não padrão está ativo', () => {
    render(<CatalogFiltersBar {...baseProps} filters={makeFilters({ sort: 'slots' })} />);

    expect(screen.getByRole('button', { name: /Remover filtro Mais vagas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpar tudo/ })).toBeInTheDocument();
  });
});

describe('CatalogFiltersBar — "Mais filtros" (R4, painel desktop / drawer mobile)', () => {
  it('desktop: abre painel avançado com badge de quantidade; Escape fecha e devolve foco', () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;

    render(<CatalogFiltersBar {...baseProps} advancedCount={2} />);

    const moreButton = screen.getByRole('button', { name: /Mais filtros/ });
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('2 filtros avançados ativos')).toBeInTheDocument();

    fireEvent.click(moreButton);

    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('catalog-advanced-panel')).not.toBeNull();
    // Mesma definição canônica de campos (fonte única catalogFilterOptions).
    expect(screen.getByLabelText('Experiência')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de mesa')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.getElementById('catalog-advanced-panel')).toBeNull();
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(moreButton);
  });

  it('mobile: botão "Mais filtros" abre o drawer via callback (não monta painel inline)', () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;
    const onOpenMobileFilters = vi.fn();

    render(<CatalogFiltersBar {...baseProps} onOpenMobileFilters={onOpenMobileFilters} />);

    fireEvent.click(screen.getByRole('button', { name: /Mais filtros/ }));

    expect(onOpenMobileFilters).toHaveBeenCalledTimes(1);
    expect(document.getElementById('catalog-advanced-panel')).toBeNull();
  });

  it('aria-expanded reflete o drawer mobile quando aberto (R9)', () => {
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;

    render(<CatalogFiltersBar {...baseProps} mobileFiltersOpen />);

    expect(screen.getByRole('button', { name: /Mais filtros/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CatalogFiltersBar — matriz de paridade desktop/mobile (aceite 14)', () => {
  it.each(SORT_OPTIONS.map((option) => [option.value, option.label]))(
    'sort %s emite o mesmo valor por interação nas duas larguras',
    (sort, label) => {
      const desktopChange = vi.fn();
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(true)) as unknown as typeof window.matchMedia;
      const desktop = render(
        <ResultsHeader count={25} sort="popular" onSortChange={desktopChange} isLoading={false} hasMore={false} />,
      );
      fireEvent.change(screen.getByLabelText('Ordenar por:'), { target: { value: sort } });
      desktop.unmount();

      const mobileChange = vi.fn();
      window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList(false)) as unknown as typeof window.matchMedia;
      render(<ResultsHeader count={25} sort="popular" onSortChange={mobileChange} isLoading={false} hasMore={false} />);
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Ordenar por:'), { target: { value: sort } });

      expect(desktopChange).toHaveBeenCalledWith(sort);
      expect(mobileChange).toHaveBeenCalledWith(sort);
    }
  );
});
