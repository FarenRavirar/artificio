import { logout } from '@artificio/auth/client';
import { GestaoShell } from '../../components/GestaoShell';

// T1.1 (spec 075) — mesma acao de logout do painel de usuario (074), no
// contexto admin.
export function GestaoConfiguracoesPage() {
  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Configurações</h1>
      <button
        type="button"
        onClick={() => logout()}
        className="mt-6 min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)]"
      >
        Sair
      </button>
    </GestaoShell>
  );
}
