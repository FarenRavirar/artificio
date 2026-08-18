import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PerfilPage } from './PerfilPage';
import * as authClientModule from '@artificio/auth/client';
import * as creatorRoleModule from '../../hooks/useCreatorRole';

vi.mock('@artificio/content-editor', () => ({
  // Mesma conta do pacote real: o mock precisa responder igual, senão o teste
  // valida um componente que barra o submit por regra diferente da de produção.
  contentOverflow: (value: string, maxLength?: number) =>
    maxLength === undefined ? 0 : Math.max(0, value.length - maxLength),
  ContentEditor: ({ label, value, onChange, disabled }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  ),
}));


function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/painel/perfil']}>
      <PerfilPage />
    </MemoryRouter>,
  );
}

function mockSession(overrides: Partial<ReturnType<typeof authClientModule.useSession>> = {}) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: { id: 'user-1', name: 'Fulano', email: 'fulano@example.com' },
    loading: false,
    ...overrides,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

function mockCreatorProfile(profile: { slug: string; display_name: string; bio: string | null } | null = null) {
  vi.spyOn(creatorRoleModule, 'useCreatorMe').mockReturnValue({
    data: { role: 'user', profile },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof creatorRoleModule.useCreatorMe>);

  const mutateAsync = vi.fn().mockResolvedValue({ role: 'user', profile });
  vi.spyOn(creatorRoleModule, 'useUpdateOwnCreatorProfile').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof creatorRoleModule.useUpdateOwnCreatorProfile>);
  return mutateAsync;
}

describe('PerfilPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe título da página', () => {
    mockSession();
    mockCreatorProfile();

    renderPage();

    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
  });

  it('mostra nome e e-mail do usuário logado', () => {
    mockSession();
    mockCreatorProfile();

    renderPage();

    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.getByText('fulano@example.com')).toBeInTheDocument();
  });

  it('não quebra quando não há usuário na sessão', () => {
    mockSession({ user: null });
    mockCreatorProfile();

    renderPage();

    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText('Nome da conta')).toBeInTheDocument();
    expect(screen.getByText('E-mail')).toBeInTheDocument();
  });

  it('carrega nome público, bio e endereço fixo existentes', async () => {
    mockSession();
    mockCreatorProfile({ slug: 'fulano-rpg', display_name: 'Fulano RPG', bio: '**Autor**' });

    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Nome público' })).toHaveValue('Fulano RPG');
    expect(screen.getByRole('textbox', { name: 'Bio pública' })).toHaveValue('**Autor**');
    expect(screen.getByRole('link', { name: '/criadores/fulano-rpg' })).toHaveAttribute('href', '/criadores/fulano-rpg');
  });

  it('usa nome da conta como ponto de partida antes do primeiro salvamento', async () => {
    mockSession();
    mockCreatorProfile(null);

    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Nome público' })).toHaveValue('Fulano');
    expect(screen.queryByText(/Endereço público fixo/)).not.toBeInTheDocument();
  });

  it('salva somente nome público e bio, sem campo de slug', async () => {
    mockSession();
    const mutateAsync = mockCreatorProfile(null);
    renderPage();

    const nameInput = await screen.findByRole('textbox', { name: 'Nome público' });
    fireEvent.change(nameInput, { target: { value: 'Nome Público' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio pública' }), { target: { value: 'Minha bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil público' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ display_name: 'Nome Público', bio: 'Minha bio' });
    });
    expect(screen.queryByLabelText(/slug|endereço/i)).not.toBeInTheDocument();
  });
});
