// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreSectionGroup } from './MestreSectionGroup';

/**
 * Estado vazio do grupo (spec 100, D20 / T3.1a).
 *
 * Este teste existe por causa de um defeito real da primeira versão do
 * componente: ela contava os filhos com `Children.toArray`, que descarta
 * `null` — mas o que chega ao grupo é o ELEMENTO React de cada filho, e vários
 * deles (`MestreBio`, `MestreHighlights`, `MestreSellingPoints`,
 * `MestreClosedGroupSection`) só decidem retornar `null` DENTRO de si. O grupo
 * nunca sumiria, e um mestre recém-criado veria três títulos sobre corpo vazio.
 */
function FilhoVazio() {
  return null;
}

describe('MestreSectionGroup — D20', () => {
  it('renderiza título e corpo quando há conteúdo', () => {
    render(
      <MestreSectionGroup id="sobre" title="Sobre" hasContent>
        <p>Conteúdo real</p>
      </MestreSectionGroup>,
    );
    expect(screen.getByRole('heading', { name: 'Sobre' })).toBeTruthy();
    expect(screen.getByText('Conteúdo real')).toBeTruthy();
  });

  it('some inteiro — título junto — quando não há conteúdo', () => {
    const { container } = render(
      <MestreSectionGroup id="sobre" title="Sobre" hasContent={false}>
        <p>Não deve aparecer</p>
      </MestreSectionGroup>,
    );
    expect(container.querySelector('.mestre-group')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Sobre' })).toBeNull();
  });

  // A regressão que motivou o componente a receber `hasContent`: com filhos que
  // retornam `null` por dentro, contar elementos daria "tem conteúdo".
  it('filho que retorna null por dentro não sustenta o grupo', () => {
    const { container } = render(
      <MestreSectionGroup id="sobre" title="Sobre" hasContent={false}>
        <FilhoVazio />
        <FilhoVazio />
      </MestreSectionGroup>,
    );
    expect(container.querySelector('.mestre-group')).toBeNull();
  });

  it('associa o título ao grupo para leitor de tela', () => {
    const { container } = render(
      <MestreSectionGroup id="contato" title="Contato" hasContent>
        <p>x</p>
      </MestreSectionGroup>,
    );
    const grupo = container.querySelector('.mestre-group');
    expect(grupo?.getAttribute('aria-labelledby')).toBe('contato-titulo');
    expect(document.getElementById('contato-titulo')?.textContent).toBe('Contato');
  });
});
