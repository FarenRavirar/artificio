import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RatingSection } from './RatingSection';
import * as authClientModule from '@artificio/auth/client';
import * as useRatingModule from '../hooks/useRating';
import type { Rating } from '../types/panel';

// Spec 088 (T1.14-T1.18) — o controle de nota deixou de ser um `<select>` de
// 1 a 5 e virou cinco estrelas clicaveis.
//
// Trocar controle nativo por glifo e exatamente onde acessibilidade se perde,
// entao a maior parte destes casos existe pra provar que o controle novo e no
// MINIMO tao acessivel quanto o `<select>` que ele substitui: operavel so por
// teclado, com nome que comunica o valor, estado exposto a leitor de tela e
// alvo de toque de 44px.

function makeRating(overrides: Partial<Rating> = {}): Rating {
  return {
    id: 'rating-1',
    material_id: 'material-1',
    is_mine: false,
    score: 3,
    comment: null,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockSession(user: { id: string } | null = { id: 'user-1' }) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user,
    loading: false,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

function mockRatings(data: Rating[] = []) {
  vi.spyOn(useRatingModule, 'useRatings').mockReturnValue({
    data,
    isLoading: false,
  } as unknown as ReturnType<typeof useRatingModule.useRatings>);
}

function mockSubmit(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  vi.spyOn(useRatingModule, 'useSubmitRating').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useRatingModule.useSubmitRating>);
  return mutateAsync;
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RatingSection materialId="material-1" />
    </QueryClientProvider>,
  );
}

describe('RatingSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nao usa mais <select> de nota', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    const { container } = renderSection();

    expect(container.querySelector('select')).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  // Nome acessivel comunica o VALOR, nao a posicao: "3 de 5 estrelas" diz o
  // que a pessoa esta escolhendo, "estrela 3" nao.
  it('cada estrela tem nome acessivel com o valor que representa', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    [1, 2, 3, 4, 5].forEach((value) => {
      expect(screen.getByRole('radio', { name: `${value} de 5 estrelas` })).toBeInTheDocument();
    });
  });

  it('expoe o estado selecionado a tecnologia assistiva', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    fireEvent.click(screen.getByRole('radio', { name: '4 de 5 estrelas' }));

    expect(screen.getByRole('radio', { name: '4 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '2 de 5 estrelas' })).toHaveAttribute('aria-checked', 'false');
  });

  // O `<select>` era operavel so por teclado de graca; o controle novo tem que
  // manter isso. `<button>` responde a Enter/Espaco nativamente, entao o que
  // este caso prova e que as estrelas SAO botoes focaveis, nao spans.
  it('estrelas sao focaveis e acionaveis por teclado', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const third = screen.getByRole('radio', { name: '3 de 5 estrelas' });
    expect(third.tagName).toBe('BUTTON');

    third.focus();
    expect(third).toHaveFocus();

    fireEvent.click(third);
    expect(third).toHaveAttribute('aria-checked', 'true');
  });

  // T1.16 — a distincao entre escolhida e nao escolhida sobrevive em escala de
  // cinza: muda o PREENCHIMENTO do glifo, nao so a cor.
  it('distingue estrela escolhida por preenchimento, nao so por cor', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    fireEvent.click(screen.getByRole('radio', { name: '3 de 5 estrelas' }));

    expect(screen.getByRole('radio', { name: '3 de 5 estrelas' }).textContent).toBe('★');
    expect(screen.getByRole('radio', { name: '5 de 5 estrelas' }).textContent).toBe('☆');
  });

  it('alvo de toque tem 44px', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const star = screen.getByRole('radio', { name: '1 de 5 estrelas' });
    expect(star.className).toContain('h-11');
    expect(star.className).toContain('w-11');
  });

  // T1.17 — antes o controle abria sempre em 5, fixo. Agora reflete a nota que
  // a pessoa ja enviou, pra ela reavaliar a partir do que escolheu.
  it('reflete a nota ja enviada pelo usuario ao carregar', () => {
    mockSession({ id: 'user-1' });
    mockRatings([makeRating({ is_mine: true, score: 2 })]);
    mockSubmit();

    renderSection();

    expect(screen.getByRole('radio', { name: '2 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');
  });

  // O backend marca `is_mine` comparando internamente — `user_id` nao e
  // exposto nesta rota publica, pra nao permitir correlacionar a atividade de
  // uma conta entre materiais.
  it('ignora avaliacao de outra conta ao preencher o controle', () => {
    mockSession({ id: 'user-1' });
    mockRatings([makeRating({ id: 'rating-2', is_mine: false, score: 1 })]);
    mockSubmit();

    renderSection();

    expect(screen.getByRole('radio', { name: '1 de 5 estrelas' })).toHaveAttribute('aria-checked', 'false');
  });

  // Padrao WAI-ARIA de radiogroup. Anunciar `role="radio"` sem implementar o
  // comportamento seria pior que nao anunciar: o leitor de tela promete radio
  // e entrega botao.
  it('grupo inteiro e UMA parada de Tab (roving tabIndex)', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const stars = screen.getAllByRole('radio');
    const tabbable = stars.filter((star) => star.getAttribute('tabindex') === '0');
    // Cinco paradas de Tab seriam regressao em relacao ao `<select>`.
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('setas trocam a selecao e movem o foco', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });

    const fourth = screen.getByRole('radio', { name: '4 de 5 estrelas' });
    expect(fourth).toHaveAttribute('aria-checked', 'true');
    expect(fourth).toHaveFocus();

    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '5 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');
  });

  it('setas dao wrap nos extremos', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const group = screen.getByRole('radiogroup');
    // Comeca em 5 (default); avancar volta pro 1.
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '1 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '5 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Home e End vao aos extremos', () => {
    mockSession();
    mockRatings();
    mockSubmit();

    renderSection();

    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(screen.getByRole('radio', { name: '1 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(group, { key: 'End' });
    expect(screen.getByRole('radio', { name: '5 de 5 estrelas' })).toHaveAttribute('aria-checked', 'true');
  });

  it('envia a nota escolhida por teclado', async () => {
    mockSession();
    mockRatings();
    const mutateAsync = mockSubmit();

    renderSection();

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Home' });
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ score: 1 });
    });
  });

  it('envia a nota escolhida', async () => {
    mockSession();
    mockRatings();
    const mutateAsync = mockSubmit();

    renderSection();

    fireEvent.click(screen.getByRole('radio', { name: '4 de 5 estrelas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ score: 4 });
    });
  });

  // T1.18 — a mudanca e de controle de entrada, NAO de regra de negocio: o
  // guard de permissao (403 do backend pra conta sem download registrado)
  // continua exibindo a explicacao visivel.
  it('mantem o guard de 403 com explicacao visivel', async () => {
    mockSession();
    mockRatings();
    mockSubmit(vi.fn().mockRejectedValue(new Error('Baixe o material antes de avaliar.')));

    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Avaliar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Baixe o material antes de avaliar.');
  });

  it('nao mostra controle de nota para visitante sem sessao', () => {
    mockSession(null);
    mockRatings();
    mockSubmit();

    renderSection();

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('Entre com sua conta para avaliar.')).toBeInTheDocument();
  });
});
