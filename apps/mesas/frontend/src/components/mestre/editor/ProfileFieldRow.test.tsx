// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Linha + modal do editor de perfil (spec 100, D2 / T4.2).
 *
 * O que este arquivo protege é o DESCARTE. `updateGm` faz optimistic update no
 * enqueue (`ProfileContext.tsx`), pintando `queryClient` antes dos 500ms do
 * autosave — então um modal que escrevesse durante a digitação deixaria o valor
 * "descartado" visível na tela E no cache, e o X de D2 seria decorativo.
 *
 * Por isso as asserções olham `queryClient.getQueryData`, não só o DOM: o cache
 * é onde a perda de dado apareceria primeiro, e é o que a tela lê depois.
 *
 * Descarte tem TRÊS vias no `Modal` do pacote — botão X, tecla ESC e clique no
 * backdrop —, todas caindo no mesmo `onClose`. Cobrir só o X deixaria ESC e
 * backdrop como caminho de perda silenciosa.
 */

const { updateGm, flushGm, queryClient } = vi.hoisted(() => {
  return {
    updateGm: vi.fn(),
    flushGm: vi.fn(async () => true),
    queryClient: { data: new Map<string, unknown>() },
  };
});

// Espelha o comportamento real: `updateGm` pinta o cache NO ENQUEUE.
updateGm.mockImplementation(async (patch: Record<string, unknown>) => {
  const atual = (queryClient.data.get('profile:me') ?? {}) as Record<string, unknown>;
  queryClient.data.set('profile:me', { ...atual, ...patch });
});

vi.mock('../../../contexts/useProfileContext', () => ({
  useProfileContext: () => ({ updateGm, flushGm }),
}));

import { ProfileFieldRow } from './ProfileFieldRow';

function renderRow(value = 'Valor original') {
  return render(
    <ProfileFieldRow<string>
      label="Slogan"
      displayValue={value || null}
      value={value}
      toPatch={(draft) => ({ tagline: draft })}
    >
      {(draft, setDraft) => (
        <input aria-label="Slogan" value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}
    </ProfileFieldRow>,
  );
}

const abrir = () =>
  fireEvent.click(document.querySelector<HTMLElement>('.profile-field-row-trigger')!);

const digitar = (texto: string) => {
  const corpo = document.querySelector<HTMLElement>('.artificio-modal-body')!;
  fireEvent.change(within(corpo).getByLabelText('Slogan'), { target: { value: texto } });
};

const cache = () => (queryClient.data.get('profile:me') as { tagline?: string } | undefined);

beforeEach(() => {
  updateGm.mockClear();
  flushGm.mockClear();
  queryClient.data.clear();
  queryClient.data.set('profile:me', { tagline: 'Valor original' });
});

describe('ProfileFieldRow — linha', () => {
  it('exibe o valor atual', () => {
    renderRow('Mesas imersivas');
    expect(screen.getByText('Mesas imersivas')).toBeTruthy();
  });

  // D21: o vazio convida, não informa ausência.
  it('linha vazia exibe "Adicionar"', () => {
    renderRow('');
    expect(screen.getByText('Adicionar')).toBeTruthy();
  });
});

describe('ProfileFieldRow — salvar', () => {
  it('persiste e fecha o modal', async () => {
    renderRow();
    abrir();
    digitar('Novo slogan');

    // Enquanto o modal está aberto, NADA foi escrito — nem no cache.
    expect(updateGm).not.toHaveBeenCalled();
    expect(cache()?.tagline).toBe('Valor original');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateGm).toHaveBeenCalledWith({ tagline: 'Novo slogan' }));
    expect(flushGm).toHaveBeenCalledTimes(1);
    expect(cache()?.tagline).toBe('Novo slogan');
    await waitFor(() => expect(document.querySelector('.artificio-modal')).toBeNull());
  });

  // `flushGm` devolve `false` quando a gravação falha e o patch volta ao buffer
  // do provider. Fechar mesmo assim jogaria fora o rascunho na falha de rede —
  // justamente quando o mestre mais precisa dele (achado de review, PR #306).
  it('gravação que falha mantém o modal aberto com o texto na tela', async () => {
    flushGm.mockResolvedValueOnce(false);
    renderRow();
    abrir();
    digitar('Texto que não pôde ser salvo');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(flushGm).toHaveBeenCalled());
    expect(document.querySelector('.artificio-modal')).not.toBeNull();
    const corpo = document.querySelector<HTMLElement>('.artificio-modal-body')!;
    expect(within(corpo).getByLabelText('Slogan')).toHaveValue('Texto que não pôde ser salvo');
  });

  it('duplo clique em Salvar não grava duas vezes', async () => {
    renderRow();
    abrir();
    digitar('Novo slogan');

    const salvar = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);

    await waitFor(() => expect(updateGm).toHaveBeenCalledTimes(1));
  });
});

describe('ProfileFieldRow — as três vias de descarte (D2)', () => {
  const casos: Array<[string, () => void]> = [
    ['botão X', () => fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))],
    ['tecla ESC', () => fireEvent.keyDown(document, { key: 'Escape' })],
    [
      'clique no backdrop',
      () => fireEvent.click(document.querySelector<HTMLElement>('.artificio-modal-backdrop')!),
    ],
  ];

  it.each(casos)('descarta por %s, mantendo o valor no cache', async (_nome, fechar) => {
    renderRow();
    abrir();
    digitar('Texto que deve ser jogado fora');

    fechar();

    await waitFor(() => expect(document.querySelector('.artificio-modal')).toBeNull());
    expect(updateGm).not.toHaveBeenCalled();
    expect(flushGm).not.toHaveBeenCalled();
    // O cache é o teste que importa: é lá que o optimistic update apareceria.
    expect(cache()?.tagline).toBe('Valor original');
  });

  it('reabrir depois de descartar mostra o valor do perfil, não o rascunho', async () => {
    renderRow();
    abrir();
    digitar('Rascunho abandonado');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(document.querySelector('.artificio-modal')).toBeNull());

    abrir();
    const corpo = document.querySelector<HTMLElement>('.artificio-modal-body')!;
    expect(within(corpo).getByLabelText('Slogan')).toHaveValue('Valor original');
  });
});
