// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogAdvancedFilters } from './CatalogAdvancedFilters';
import type { CatalogFilters, StyleFacet } from '../services/catalogService';

/**
 * Spec 094 Fase 2 (T2.10): paridade dos filtros secundários — UMA definição
 * canônica desktop/mobile; `type` renderiza só as opções com resultado público
 * (T0.2a); `featured`/`audience`/`state`/`city` ausentes; selos mutuamente
 * exclusivos; estilos vêm de `style-facets` via props (sem fetch próprio).
 */

const styleFacets: StyleFacet[] = [
  { style: 'investigacao', count: 12 },
  { style: 'exploracao', count: 9 },
  { style: 'combate', count: 8 },
];

const baseProps = {
  filters: {
    experience: '' as CatalogFilters['experience'],
    type: '' as CatalogFilters['type'],
    seal: '' as CatalogFilters['seal'],
    styles: [] as CatalogFilters['styles'],
  },
  styleFacets,
  onExperienceChange: vi.fn(),
  onTypeChange: vi.fn(),
  onSealToggle: vi.fn(),
  onStyleToggle: vi.fn(),
  idPrefix: 'catalog-advanced-desktop',
};

describe('CatalogAdvancedFilters — experiência', () => {
  it('omite nível sem resultado público e mantém os níveis aptos por R22', () => {
    render(<CatalogAdvancedFilters {...baseProps} />);

    const select = screen.getByLabelText('Experiência');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Qualquer nível' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Iniciante' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Intermediário' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Veterano' })).toBeInTheDocument();
  });

  it('mudança emite o valor tipado via onExperienceChange', () => {
    const onExperienceChange = vi.fn();
    render(<CatalogAdvancedFilters {...baseProps} onExperienceChange={onExperienceChange} />);

    fireEvent.change(screen.getByLabelText('Experiência'), { target: { value: 'veterano' } });

    expect(onExperienceChange).toHaveBeenCalledWith('veterano');
  });
});

describe('CatalogAdvancedFilters — tipo (política T0.2a/R22)', () => {
  it('renderiza somente campanha e oneshot-serie; one-shot e aberta são omitidas', () => {
    render(<CatalogAdvancedFilters {...baseProps} />);

    const select = screen.getByLabelText('Tipo de mesa');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Todos os tipos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Campanha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Série de one-shots' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'One-shot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Mesa aberta' })).not.toBeInTheDocument();
  });

  it('mudança emite o valor tipado via onTypeChange', () => {
    const onTypeChange = vi.fn();
    render(<CatalogAdvancedFilters {...baseProps} onTypeChange={onTypeChange} />);

    fireEvent.change(screen.getByLabelText('Tipo de mesa'), { target: { value: 'campanha' } });

    expect(onTypeChange).toHaveBeenCalledWith('campanha');
  });
});

describe('CatalogAdvancedFilters — facetas excluídas (D0.2/T0.2a)', () => {
  it('featured, audience, state e city não possuem controle nenhum', () => {
    render(<CatalogAdvancedFilters {...baseProps} />);

    expect(screen.queryByLabelText(/featured/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/público/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/estado|UF/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Público/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Localização/)).not.toBeInTheDocument();
  });
});

describe('CatalogAdvancedFilters — selos (R12)', () => {
  it('omite DDAL e Covil do Lich enquanto ambos têm zero resultado público (R22)', () => {
    render(<CatalogAdvancedFilters {...baseProps} />);

    expect(screen.queryByText('Selos')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'DDAL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Covil do Lich/ })).not.toBeInTheDocument();
  });
});

describe('CatalogAdvancedFilters — estilos via style-facets (R11/T2.7)', () => {
  it('renderiza facetas recebidas por props (sem lista fixa nem fetch próprio)', () => {
    const onStyleToggle = vi.fn();
    render(<CatalogAdvancedFilters {...baseProps} onStyleToggle={onStyleToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /investigacao/ }));
    expect(onStyleToggle).toHaveBeenCalledWith('investigacao');

    expect(screen.getByRole('button', { name: /exploracao/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /combate/ })).toBeInTheDocument();
  });

  it('estilos selecionados aparecem como aria-pressed=true', () => {
    render(
      <CatalogAdvancedFilters
        {...baseProps}
        filters={{ ...baseProps.filters, styles: ['investigacao'] }}
      />
    );

    expect(screen.getByRole('button', { name: /investigacao/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /combate/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CatalogAdvancedFilters — unicidade de IDs por superfície', () => {
  it('usa o idPrefix recebido nos controles com id', () => {
    render(<CatalogAdvancedFilters {...baseProps} idPrefix="catalog-advanced-mobile" />);

    expect(document.getElementById('catalog-advanced-mobile-experience')).not.toBeNull();
    expect(document.getElementById('catalog-advanced-mobile-type')).not.toBeNull();
  });
});
