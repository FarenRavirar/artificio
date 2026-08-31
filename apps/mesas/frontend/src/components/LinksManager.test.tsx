// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinksManager } from './LinksManager';
import { RECOMMENDED_GAIN } from './mestre/editor/profileEditorDomain';

/**
 * LinksManager (spec 099, B6/B7): campo `links` recomendado — data-ob/data-field
 * + frase do ganho — e associação do erro de adição ao input via
 * aria-describedby. O componente é compartilhado por ProfileEditPage e
 * PainelMestrePage; uma edição cobre as duas telas.
 *
 * `useLinks` é mockado (comportamento dele é de rede); `useConfirm` é mockado
 * via mock parcial do pacote para preservar os primitivos reais.
 */

const { addLink } = vi.hoisted(() => ({ addLink: vi.fn() }));

vi.mock('../hooks/useLinks', () => ({
  useLinks: () => ({
    links: [],
    loading: false,
    error: null,
    addLink,
    removeLink: vi.fn(async () => true),
    reorderLinks: vi.fn(async () => true),
    refresh: vi.fn(async () => {}),
  }),
}));

vi.mock('@artificio/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificio/ui')>();
  return {
    ...actual,
    useConfirm: () => ({ confirm: async () => true }),
  };
});

function urlInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Cole o link aqui (YouTube, Spotify, etc)') as HTMLInputElement;
}

describe('LinksManager — recomendado (B6)', () => {
  beforeEach(() => {
    addLink.mockReset();
    addLink.mockResolvedValue({ ok: true });
  });

  it('wrapper marcado como recomendado com data-field="links"', () => {
    const { container } = render(<LinksManager />);
    const wrapper = container.querySelector('.links-manager');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute('data-ob', 'recommended');
    expect(wrapper).toHaveAttribute('data-field', 'links');
  });

  it('renderiza a frase do ganho do registro', () => {
    render(<LinksManager />);
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.links}.`)).toBeTruthy();
  });
});

describe('LinksManager — aria-describedby do erro (B7)', () => {
  beforeEach(() => {
    addLink.mockReset();
  });

  it('sem erro de adição, o input não tem o atributo (regra: sem hint/erro, sem atributo)', () => {
    render(<LinksManager />);
    expect(urlInput()).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('links-add-error')).toBeNull();
  });

  it('com erro de adição, o input aponta para o <p> do erro', async () => {
    addLink.mockResolvedValue({ ok: false, error: 'Limite de 10 links atingido' });
    render(<LinksManager />);

    fireEvent.change(urlInput(), { target: { value: 'https://youtube.com/canal' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    await waitFor(() => expect(screen.getByText('Limite de 10 links atingido')).toBeTruthy());

    expect(urlInput()).toHaveAttribute('aria-describedby', 'links-add-error');
    expect(document.getElementById('links-add-error')).not.toBeNull();
  });
});
