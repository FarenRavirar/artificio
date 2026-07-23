import { GestaoShell } from '../../components/GestaoShell';
import { useAdminLinks, useCheckLink } from '../../hooks/useAdminLinks';

// T5.1-T5.3 (spec 075) — status de link por material, checagem sob demanda.
export function GestaoLinksPage() {
  const { data: links, isLoading } = useAdminLinks();
  const checkLink = useCheckLink();

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Links</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {links && links.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhum link checado ainda.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {links?.map((link) => (
          <li key={link.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--fg)]">{link.material_title}</p>
              <p className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                <span aria-hidden="true">{link.is_healthy ? '✅' : '⚠️'}</span>
                {link.is_healthy ? 'saudável' : `degradado (${link.error_detail ?? link.http_status ?? 'sem resposta'})`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => checkLink.mutateAsync(link.material_id).catch(() => undefined)}
              disabled={checkLink.isPending}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Checar agora
            </button>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}
