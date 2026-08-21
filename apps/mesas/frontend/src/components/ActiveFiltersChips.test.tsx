// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveFiltersChips } from './ActiveFiltersChips';

/**
 * Spec 094 Fase 2 (T2.10): labels dos chips, remoção isolada e limpeza dos
 * filtros avançados (type, selo, estilos) — R10.
 */

const baseFilters = {
  search: '',
  system: '',
  modality: '',
  priceType: '',
  experience: '',
  type: '',
  seal: undefined,
  styles: [],
  sort: 'popular',
};

describe('ActiveFiltersChips — labels (fonte única catalogFilterOptions)', () => {
  it('renderiza label de tipo vindo da fonte única', () => {
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, type: 'campanha' }}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Campanha')).toBeInTheDocument();
  });

  it('renderiza label de selo vindo da fonte única', () => {
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, seal: 'covil-do-lich' }}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Covil do Lich')).toBeInTheDocument();
  });

  it('renderiza cada estilo como chip próprio e a busca com aspas', () => {
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, search: 'vamp', styles: ['horror', 'investigacao'] }}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Busca: "vamp"')).toBeInTheDocument();
    expect(screen.getByText('horror')).toBeInTheDocument();
    expect(screen.getByText('investigacao')).toBeInTheDocument();
  });
});

describe('ActiveFiltersChips — remoção isolada (R10)', () => {
  it('remover um estilo chama onRemove("styles", valor) sem afetar os demais', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, styles: ['horror', 'investigacao'] }}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /horror/ }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('styles', 'horror');
    expect(onRemove).not.toHaveBeenCalledWith('styles', 'investigacao');
  });

  it('remover o chip de tipo chama onRemove("type", valor)', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, type: 'oneshot-serie' }}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Série de one-shots/ }));

    expect(onRemove).toHaveBeenCalledWith('type', 'oneshot-serie');
  });

  it('remover o chip de selo chama onRemove("seal", valor)', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, seal: 'ddal' }}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /DDAL/ }));

    expect(onRemove).toHaveBeenCalledWith('seal', 'ddal');
  });

  it('limpeza de todos os avançados (type+selo+estilos) emite uma remoção por chip', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersChips
        filters={{
          ...baseFilters,
          type: 'campanha',
          seal: 'ddal',
          styles: ['horror'],
        }}
        onRemove={onRemove}
      />
    );

    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(3);

    chips.forEach((chip) => fireEvent.click(chip));

    expect(onRemove).toHaveBeenCalledTimes(3);
    expect(onRemove).toHaveBeenCalledWith('type', 'campanha');
    expect(onRemove).toHaveBeenCalledWith('seal', 'ddal');
    expect(onRemove).toHaveBeenCalledWith('styles', 'horror');
  });

  it('sort não-default vira chip removível (chama onRemove("sort", valor))', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFiltersChips
        filters={{ ...baseFilters, sort: 'slots' }}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais vagas/ }));

    expect(onRemove).toHaveBeenCalledWith('sort', 'slots');
  });
});
