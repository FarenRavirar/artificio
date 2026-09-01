// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileEditPage from './ProfileEditPage';
import type { FullProfile } from '../types/profileTypes';

/**
 * Página de edição de perfil — indicador de autosave (spec 099 B8) e remoção
 * do campo Preço Médio (B9/D4).
 *
 * `useProfileContext` é mockado com objeto mutável (padrão `vi.hoisted` já
 * usado nos testes do editor): os testes mudam `saving`/`saveError` e
 * re-renderizam para exercitar os estados do indicador. Os componentes
 * filhos pesados (AvatarField, ImageUploader, GmProfileFields, etc.) são
 * stubs — o comportamento deles é coberto nos testes próprios.
 */

const { mockCtx } = vi.hoisted(() => {
  // Tipado como FullProfile para o teste da prévia (B10) poder escrever
  // campos opcionais do gm (tagline) — sem o tipo, o literal recusa a chave.
  const profile: FullProfile = {
    user: {
      id: 'u1',
      email: 'a@b.com',
      username: 'mago',
      location: null,
      role: 'gm',
      created_at: '2026-01-01',
    },
    profile: {
      display_name: 'Mago',
      bio: null,
      avatar_url: null,
      avatar_crop_data: null,
      avatar_width: null,
      avatar_height: null,
      languages: [],
    },
    player: null,
    gm: {
      id: 'g1',
      user_id: 'u1',
      slug: 'mago',
      nickname: null,
      bio_long: null,
      avatar_url: null,
      avatar_crop_data: null,
      avatar_width: null,
      avatar_height: null,
      banner_url: null,
      banner_crop_data: null,
      banner_width: null,
      banner_height: null,
      languages: [],
      specialties: [],
      discord_connected: false,
      discord_username: null,
      covil_verified: false,
      experience_years: null,
      gm_style: null,
      tools: null,
      game_format: null,
    },
    systems: { favorite: [], gm: [] },
  };

  const mockCtx = {
    profile,
    loading: false,
    saving: false,
    error: null,
    saveError: null as string | null,
    refetch: vi.fn(),
    updateUser: vi.fn(),
    updateProfile: vi.fn(),
    updatePlayer: vi.fn(),
    updateGm: vi.fn(),
    addSystem: vi.fn(),
    removeSystem: vi.fn(),
  };

  return { mockCtx };
});

vi.mock('../contexts/useProfileContext', () => ({
  useProfileContext: () => mockCtx,
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));

vi.mock('../components/UserSystemsSelector', () => ({
  UserSystemsSelector: () => <div data-testid="user-systems-selector" />,
}));

vi.mock('../components/LinksManager', () => ({
  LinksManager: () => <div data-testid="links-manager" />,
}));

vi.mock('../components/AvatarField', () => ({
  AvatarField: () => <div data-testid="avatar-field" />,
}));

vi.mock('../components/ImageUploader', () => ({
  ImageUploader: () => <div data-testid="image-uploader" />,
}));

vi.mock('../components/MarkdownEditor', () => ({
  MarkdownEditor: () => <textarea aria-label="Bio" readOnly />,
}));

vi.mock('../components/mestre/editor/GmProfileFields', () => ({
  TaglineField: () => <div data-testid="tagline-field" />,
  ClosedGroupSection: () => <div data-testid="closed-group-section" />,
  ProfileTagsSection: () => <div data-testid="profile-tags-section" />,
  SellingPointsEditor: () => <div data-testid="selling-points-editor" />,
  PromoBadgeField: () => <div data-testid="promo-badge-field" />,
  BioLongField: () => <div data-testid="bio-long-field" />,
  ExperienceYearsField: () => <div data-testid="experience-years-field" />,
}));

vi.mock('../utils/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../services/analytics', () => ({
  track: vi.fn(),
}));

function renderPage() {
  return render(<ProfileEditPage />);
}

const indicator = (container: HTMLElement) =>
  container.querySelector('.autosave-indicator');

describe('ProfileEditPage — indicador de autosave (spec 099 B8)', () => {
  it('monta .autosave-indicator em todas as tabs (geral, jogador e mestre)', () => {
    const { container } = renderPage();

    expect(indicator(container)).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Jogador' }));
    expect(indicator(container)).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));
    expect(indicator(container)).not.toBeNull();
  });

  it('reflete os estados saving → saved → error', async () => {
    const { container, rerender } = renderPage();

    // saving
    act(() => {
      mockCtx.saving = true;
    });
    rerender(<ProfileEditPage />);
    expect(indicator(container)).toHaveClass('saving');
    expect(screen.getByText('Salvando…')).toBeTruthy();

    // transição saving → false mostra "Salvo"
    act(() => {
      mockCtx.saving = false;
    });
    rerender(<ProfileEditPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(indicator(container)).toHaveClass('saved');
    expect(screen.getByText('Salvo')).toBeTruthy();

    // erro tem prioridade sobre os demais estados
    act(() => {
      mockCtx.saveError = 'Biografia deve ter no máximo 2000 caracteres';
    });
    rerender(<ProfileEditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(indicator(container)).toHaveClass('error');
    expect(screen.getByText('Erro ao salvar')).toBeTruthy();
    expect(indicator(container)).toHaveAttribute(
      'title',
      'Biografia deve ter no máximo 2000 caracteres'
    );
  });
});

describe('ProfileEditPage — campo Preço Médio removido (spec 099 B9 / D4)', () => {
  it('não renderiza o campo average_price na aba mestre', () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    expect(screen.queryByLabelText('Preço Médio (R$)')).not.toBeInTheDocument();
    expect(container.querySelector('#average_price')).toBeNull();
  });
});

describe('ProfileEditPage — prévia do perfil público (spec 099 B10)', () => {
  it('renderiza o texto REAL do editor na prévia (tagline atual do profile.gm)', () => {
    // Valor ATUAL dos campos do editor (nada de dado fake): o que o
    // profile.gm carrega é o que a prévia deve espelhar.
    mockCtx.profile.gm!.tagline = 'Aventuras épicas toda quinta';
    mockCtx.profile.gm!.nickname = null;

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    expect(screen.getByLabelText('Prévia do perfil')).toBeInTheDocument();
    expect(screen.getByText('Aventuras épicas toda quinta')).toBeInTheDocument();
    // Sem nickname, o display_name cai para o perfil do usuário (COALESCE do
    // GET público: nickname → display_name → slug). Escopo na prévia: o h1 da
    // página também mostra "Mago".
    const preview = screen.getByLabelText('Prévia do perfil');
    expect(within(preview).getByText('Mago')).toBeInTheDocument();
  });
});
