import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MaterialCover } from './MaterialCover';

// Spec 103 (T2.4): o componente nao tinha teste nenhum, e foi assim que os
// atributos de carregamento ficaram de fora. Medido no catalogo de producao:
// 15 capas somando 4.207.820 bytes, todas buscadas no primeiro paint porque
// nao havia `loading`.

afterEach(cleanup);

const CAPA = 'https://img.itch.zone/aW1nLzI5NjAxMDA2LnBuZw==/original/jg3R2e.png';

describe('MaterialCover — carregamento', () => {
  it('capa de card nao baixa antes de entrar na viewport', () => {
    render(<MaterialCover src={CAPA} title="Aventura" size="card" />);
    const img = screen.getByAltText('Capa de Aventura');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('fetchpriority', 'auto');
  });

  it('capa da ficha e prioritaria — ali ela e o elemento principal', () => {
    render(<MaterialCover src={CAPA} title="Aventura" size="detail" />);
    const img = screen.getByAltText('Capa de Aventura');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('decoding', 'sync');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('`card` e o padrao quando `size` nao e informado', () => {
    render(<MaterialCover src={CAPA} title="Aventura" />);
    expect(screen.getByAltText('Capa de Aventura')).toHaveAttribute('loading', 'lazy');
  });

  it('capa que falha cai no placeholder, sem `<img>` quebrada na tela', () => {
    render(<MaterialCover src={CAPA} title="Aventura" size="card" />);
    fireEvent.error(screen.getByAltText('Capa de Aventura'));
    expect(screen.queryByAltText('Capa de Aventura')).toBeNull();
  });

  it('sem `src` nao renderiza `<img>` nenhuma', () => {
    render(<MaterialCover src={null} title="Aventura" size="card" />);
    expect(screen.queryByAltText('Capa de Aventura')).toBeNull();
  });
});
