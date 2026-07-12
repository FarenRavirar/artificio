import { logout } from '@artificio/auth/client';
import { PainelShell } from '../../components/PainelShell';

export function ConfiguracoesPage() {
  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-white">Configurações</h1>
      <button
        type="button"
        onClick={() => logout()}
        className="mt-6 min-h-[44px] rounded-md border border-white/20 px-6 py-2 text-white hover:border-red-400"
      >
        Sair da conta
      </button>
    </PainelShell>
  );
}
