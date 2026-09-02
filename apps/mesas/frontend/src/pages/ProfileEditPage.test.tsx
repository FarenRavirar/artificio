// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileEditPage from './ProfileEditPage';
import type { FullProfile } from '../types/profileTypes';
import {
  PROFILE_PARTS,
  profilePartDomId,
} from '../components/mestre/editor/profileEditorParts';

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
    // Fase G: a porta para o link oficial grava o pendente antes de abrir.
    // `true` = gravou (ou nada havia pendente) e pode abrir.
    flushGm: vi.fn(async () => true),
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

// A casca da fase G lê a contagem de links direto do hook (pendências da parte
// "Onde te achar"), e não mais só pelo LinksManager mockado acima. Sem este
// mock o hook chama `useAuth` e o harness quebra por falta de AuthProvider.
vi.mock('../hooks/useLinks', () => ({
  useLinks: () => ({
    links: [],
    loading: false,
    error: null,
    addLink: vi.fn(),
    removeLink: vi.fn(),
    reorderLinks: vi.fn(),
    refresh: vi.fn(),
  }),
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

// O contexto mockado é COMPARTILHADO (vi.hoisted) e vários testes escrevem
// nele (tagline, experience_years, flushGm). Sem este reset a ordem dos testes
// passa a importar e uma falha aparece no teste errado.
beforeEach(() => {
  mockCtx.saving = false;
  mockCtx.saveError = null;
  mockCtx.flushGm = vi.fn(async () => true);
  mockCtx.profile.gm!.tagline = null;
  mockCtx.profile.gm!.nickname = null;
  mockCtx.profile.gm!.experience_years = null;
});

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

/**
 * A prévia embutida (B10) foi SUBSTITUÍDA pela porta para o link oficial na
 * fase G (spec §13.11, decisão do mantenedor 2026-09-01: "a prévia tem que
 * direcionar como uma nova aba para onde vai ficar o link oficial").
 *
 * O teste antigo afirmava que a `MestreProfilePreview` renderizava o texto do
 * editor dentro da aba. Ele não foi apagado por falhar: a asserção deixou de
 * descrever o produto. O que o A13 exige agora é o oposto — endereço público
 * real visível, aba nova, e NENHUM espelho dentro do editor.
 */
describe('ProfileEditPage — porta para o link oficial (spec 099 G4, §13.11)', () => {
  it('mostra o endereço público real e não espelha a página dentro do editor', () => {
    mockCtx.profile.gm!.tagline = 'Aventuras épicas toda quinta';
    mockCtx.profile.gm!.nickname = null;

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    // A rota canônica é `/mestre/<slug>` (§13.15): a que tem consumidores no
    // app. `/mestres/<id>` existe mas ninguém chega nela.
    const slug = mockCtx.profile.gm!.slug;
    expect(screen.getByText(new RegExp(`/mestre/${slug}$`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir em nova aba' })).toBeInTheDocument();

    // Espelho dentro do editor reprova A13.
    expect(screen.queryByLabelText('Prévia do perfil')).not.toBeInTheDocument();
  });

  it('grava o pendente ANTES de abrir a aba', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir em nova aba' }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockCtx.flushGm).toHaveBeenCalled();
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining(`/mestre/${mockCtx.profile.gm!.slug}`),
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      open.mockRestore();
    }
  });

  it('NÃO abre a aba quando a gravação falha', async () => {
    // Abrir aqui levaria o mestre a uma página sem o que ele acabou de
    // escrever — exatamente o engano que o flush existe para evitar.
    mockCtx.flushGm = vi.fn(async () => false);

    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir em nova aba' }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(open).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    } finally {
      open.mockRestore();
    }
  });
});

/**
 * As 5 partes de spec §13.5 e a lateral que navega entre elas (G1/G3/G4).
 */
describe('ProfileEditPage — casca do editor de mestre (spec 099 G1/G3/G4)', () => {
  it('renderiza as 5 partes como seções tituladas de um documento contínuo', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    for (const part of PROFILE_PARTS) {
      expect(container.querySelector(`#${profilePartDomId(part.id)}`)).not.toBeNull();
      // Todas montadas ao mesmo tempo: é âncora, não troca de view — o mestre
      // continua podendo revisar livremente.
      expect(screen.getByRole('region', { name: part.label })).toBeInTheDocument();
    }
  });

  it('a lateral marca a parte ativa com aria-current="location"', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    const nav = screen.getByRole('navigation', { name: 'Partes do perfil' });
    const current = within(nav).getAllByRole('button', { current: 'location' });
    // `location`, não `page`: a página não muda, só a posição no documento.
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(PROFILE_PARTS[0].label);
  });

  it('a lateral conta as pendências da parte e o número cai ao preencher', () => {
    // "Quem é você" tem 2 recomendados (tagline, experienceYears).
    mockCtx.profile.gm!.tagline = null;
    mockCtx.profile.gm!.experience_years = null;

    const { rerender } = renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mestre' }));

    // Escopo no BOTÃO da parte, não na nav inteira: outras partes têm as suas
    // pendências (links vazios dão 1 em "Onde te achar"), e uma asserção pela
    // nav casaria com a parte errada.
    const nav = screen.getByRole('navigation', { name: 'Partes do perfil' });
    const botaoQuem = () =>
      within(nav).getByRole('button', { name: /Quem é você/ });
    expect(
      within(botaoQuem()).getByLabelText('2 campo(s) recomendado(s) por preencher'),
    ).toBeInTheDocument();

    // Preencher um deve derrubar a contagem na mesma sessão (A12).
    act(() => {
      mockCtx.profile.gm!.tagline = 'Aventuras épicas toda quinta';
    });
    rerender(<ProfileEditPage />);

    expect(
      within(botaoQuem()).getByLabelText('1 campo(s) recomendado(s) por preencher'),
    ).toBeInTheDocument();
  });
});
