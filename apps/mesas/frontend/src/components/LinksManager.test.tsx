// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinksManager } from './LinksManager';
import { RECOMMENDED_GAIN } from './mestre/editor/profileEditorDomain';
import type { UserLink } from '../hooks/useLinks';

/**
 * LinksManager (spec 099, B6/B7): campo `links` recomendado — data-ob/data-field
 * + frase do ganho — e associação do erro de adição ao input via
 * aria-describedby. O componente é compartilhado por ProfileEditPage e
 * PainelMestrePage; uma edição cobre as duas telas.
 *
 * `useLinks` é mockado (comportamento dele é de rede); `useConfirm` é mockado
 * via mock parcial do pacote para preservar os primitivos reais.
 */

const { addLink, linksState } = vi.hoisted(() => ({
  addLink: vi.fn(),
  linksState: { links: [] as UserLink[] },
}));

vi.mock('../hooks/useLinks', () => ({
  useLinks: () => ({
    links: linksState.links,
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

describe('LinksManager — todo tipo que o backend grava renderiza', () => {
  // Incidente de 2026-10-11: o backend (`detectLinkType`) classifica `wa.me`
  // como `whatsapp`, mas o mapa de ícones desta tela não tinha a chave. O
  // `<Icon />` recebia `undefined`, o React lançava e o ErrorBoundary da rota
  // derrubava a aba Mestre inteira de quem tinha um link de WhatsApp.
  beforeEach(() => {
    linksState.links = [];
  });

  function link(overrides: Partial<UserLink>): UserLink {
    return {
      id: 'l1',
      user_id: 'u1',
      url: 'https://example.com/',
      type: 'website',
      title: null,
      description: null,
      thumbnail_url: null,
      sort_order: 0,
      created_at: '2026-09-30T00:00:00Z',
      updated_at: '2026-09-30T00:00:00Z',
      ...overrides,
    };
  }

  it.each([
    ['whatsapp', 'https://wa.me/qr/ABC', 'WhatsApp'],
    ['instagram', 'https://instagram.com/x', 'Instagram'],
    ['facebook', 'https://facebook.com/x', 'Facebook'],
    ['tiktok', 'https://tiktok.com/@x', 'TikTok'],
    ['linkedin', 'https://linkedin.com/in/x', 'LinkedIn'],
    ['podcast', 'https://anchor.fm/x', 'Podcast'],
  ] as const)('tipo %s mostra ícone e rótulo', (type, url, label) => {
    linksState.links = [link({ type, url })];
    render(<LinksManager />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('tipo desconhecido cai no genérico em vez de derrubar a tela', () => {
    linksState.links = [link({ type: 'mastodon' as UserLink['type'] })];
    render(<LinksManager />);
    expect(screen.getByText('Link')).toBeTruthy();
  });

  it('URL que o construtor URL recusa não derruba a tela', () => {
    linksState.links = [link({ url: 'nao-e-url' })];
    render(<LinksManager />);
    expect(screen.getAllByText('nao-e-url').length).toBeGreaterThan(0);
  });
});
