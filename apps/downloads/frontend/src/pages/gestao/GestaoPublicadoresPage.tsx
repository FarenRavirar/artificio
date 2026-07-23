import { GestaoShell } from '../../components/GestaoShell';

// T1.1 (spec 075) — publicadores: nao ha rota de listagem paginada de todos
// os criadores ainda (so busca individual por slug em /criadores/:slug);
// placeholder ate existir listagem real (debito).
export function GestaoPublicadoresPage() {
  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Publicadores</h1>
      <p className="mt-4 text-[var(--fg-muted)]">
        Não há rota de listagem de todos os publicadores ainda (só busca individual por slug em /criadores/:slug).
        Listagem paginada fica como débito para próxima rodada.
      </p>
    </GestaoShell>
  );
}
