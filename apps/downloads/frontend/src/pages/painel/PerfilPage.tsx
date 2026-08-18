import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ContentEditor, contentOverflow } from '@artificio/content-editor';
import { useSession } from '@artificio/auth/client';
import { PainelShell } from '../../components/PainelShell';
import { useCreatorMe, useUpdateOwnCreatorProfile, type CreatorMe } from '../../hooks/useCreatorRole';

// Espelha o limite aceito pelo backend para a bio publica.
const BIO_MAX_LENGTH = 2000;

function PublicProfileForm({
  profile,
  accountName,
}: Readonly<{
  profile: CreatorMe['profile'];
  accountName: string;
}>) {
  const updateProfile = useUpdateOwnCreatorProfile();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? accountName);
  const [bio, setBio] = useState(profile?.bio ?? '');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({ display_name: displayName, bio: bio.trim() || null });
      toast.success('Perfil público salvo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5">
      <label className="block text-sm font-medium text-[var(--fg)]">
        Nome público{' '}
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          maxLength={120}
          disabled={updateProfile.isPending}
          className="mt-1 min-h-[44px] w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)]"
        />
      </label>

      <ContentEditor
        label="Bio pública"
        value={bio}
        onChange={setBio}
        maxLength={BIO_MAX_LENGTH}
        minHeight={160}
        disabled={updateProfile.isPending}
        placeholder="Conte sobre seu trabalho e os materiais que publica."
      />

      {profile && (
        <p className="text-sm text-[var(--fg-muted)]">
          Endereço público fixo:{' '}
          <Link className="text-artificio-orange underline" to={`/criadores/${profile.slug}`}>
            /criadores/{profile.slug}
          </Link>
        </p>
      )}

      <button
        type="submit"
        // O editor avisa sobre o excesso mas não trunca mais, então quem
        // submete é que barra (achado P1 do Codex, PR #275).
        disabled={
          updateProfile.isPending ||
          displayName.trim().length === 0 ||
          contentOverflow(bio.trim(), BIO_MAX_LENGTH) > 0
        }
        className="min-h-[44px] rounded-md bg-artificio-orange px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {updateProfile.isPending ? 'Salvando...' : 'Salvar perfil público'}
      </button>
    </form>
  );
}

// Spec 089 T9.2 — dados da conta SSO seguem somente leitura; nome público e
// bio são editáveis. O slug é criado pelo backend no primeiro salvamento e
// fica imutável para não quebrar links públicos.
export function PerfilPage() {
  const { user } = useSession();
  const creatorMe = useCreatorMe();

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Perfil</h1>

      <section className="mt-6 max-w-2xl rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Conta Artifício</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Dados do login, gerenciados pela sua conta Artifício.</p>
        <dl className="mt-4 space-y-3 text-[var(--fg-muted)]">
          <div><dt className="font-medium text-[var(--fg)]">Nome da conta</dt><dd>{user?.name ?? '—'}</dd></div>
          <div><dt className="font-medium text-[var(--fg)]">E-mail</dt><dd>{user?.email ?? '—'}</dd></div>
        </dl>
      </section>

      <section className="mt-6 max-w-2xl rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Perfil público</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Informações mostradas na sua página de criador.</p>

        {creatorMe.isLoading && (
          <p className="mt-4 text-sm text-[var(--fg-muted)]">Carregando perfil público...</p>
        )}
        {creatorMe.isError && (
          <p role="alert" className="mt-4 text-sm text-[var(--error)]">Não foi possível carregar seu perfil público.</p>
        )}
        {creatorMe.data && (
          <PublicProfileForm
            key={creatorMe.data.profile?.slug ?? 'new-profile'}
            profile={creatorMe.data.profile}
            accountName={user?.name ?? ''}
          />
        )}
      </section>
    </PainelShell>
  );
}
