// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenarioSelector } from './ScenarioSelector';

// Regressão do achado do mantenedor (2026-08-27, medido no beta): a lista
// renderizava o catálogo INTEIRO antes de o mestre digitar qualquer coisa —
// 7418px de conteúdo numa caixa de 240px, 118 itens, 30x a altura da caixa.
// O sintoma na tela era o mesmo de que ele reclamava desde 25-08 ("não dá para
// ver várias coisas"), e sobrevivia à correção de z-index porque é outra causa.
// Estes testes travam as duas metades do conserto: cortar a lista ociosa, e
// dizer ao mestre quantos ficaram de fora.

const cenarios = Array.from({ length: 118 }, (_, i) => ({
  id: `s${i}`,
  name: `Cenario ${i}`,
  name_pt: null,
  slug: `cenario-${i}`,
  subgenres: i === 7 ? ['cyberpunk'] : [],
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: cenarios }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// `startsWith`, não igualdade: o botão de um cenário COM subgênero renderiza
// nome + subgêneros no mesmo elemento, e um regex ancorado no fim não casaria.
const itensNaLista = () =>
  screen.getAllByRole('button').filter((b) => /^Cenario \d+/.test(b.textContent ?? ''));

describe('ScenarioSelector — sem busca não há lista', () => {
  it('estado ocioso não renderiza nenhum cenário', async () => {
    render(<ScenarioSelector selectedScenarioId={null} onSelect={vi.fn()} />);

    // Espera a carga da API terminar antes de afirmar que a lista está vazia —
    // senão o teste passaria só por chegar antes do fetch.
    await screen.findByText(/Digite acima para buscar entre os 118 cenários/i);
    expect(itensNaLista()).toHaveLength(0);
  });

  it('ao buscar, devolve TODOS os resultados do termo', async () => {
    render(<ScenarioSelector selectedScenarioId={null} onSelect={vi.fn()} />);
    await screen.findByText(/Digite acima para buscar/i);

    // "Cenario 1" casa por substring: 1, 10-19 e 100-117 → 1 + 10 + 18 = 29
    // dentro do corpus de 118 (0..117).
    fireEvent.change(screen.getByPlaceholderText(/Buscar cenário/i), {
      target: { value: 'Cenario 1' },
    });

    await waitFor(() => expect(itensNaLista().length).toBe(29));
  });

  it('busca casa subgênero, não só o nome — o PT/EN só troca o rótulo', async () => {
    render(<ScenarioSelector selectedScenarioId={null} onSelect={vi.fn()} />);
    await screen.findByText(/Digite acima para buscar/i);

    fireEvent.change(screen.getByPlaceholderText(/Buscar cenário/i), {
      target: { value: 'cyberpunk' },
    });

    // Só o item 7 do corpus tem esse subgênero.
    await waitFor(() => expect(itensNaLista().length).toBe(1));
    expect(screen.getByText('Cenario 7')).toBeTruthy();
  });

  it('termo sem resultado avisa, em vez de ficar em branco', async () => {
    render(<ScenarioSelector selectedScenarioId={null} onSelect={vi.fn()} />);
    await screen.findByText(/Digite acima para buscar/i);

    fireEvent.change(screen.getByPlaceholderText(/Buscar cenário/i), {
      target: { value: 'zzzzz' },
    });

    await screen.findByText(/Nenhum cenário encontrado com esse termo/i);
  });
});
