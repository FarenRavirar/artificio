import { useSession } from '@artificio/auth/client';
import { PainelShell } from '../../components/PainelShell';

// T1.5 (spec 074) — perfil de conta so-leitura nesta rodada (dados vem do
// SSO accounts.); edicao de perfil publico de criador fica em spec futura
// se vier a ser pedida (nao ha rota de escrita em download_creator hoje).
export function PerfilPage() {
  const { user } = useSession();

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Perfil</h1>
      <div className="mt-6 max-w-md space-y-3 text-[var(--fg-muted)]">
        <p><span className="text-[var(--fg-muted)]">Nome:</span> {user?.name}</p>
        <p><span className="text-[var(--fg-muted)]">E-mail:</span> {user?.email}</p>
      </div>
    </PainelShell>
  );
}
