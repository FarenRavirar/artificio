import { useState, type FormEvent } from 'react';
import { GestaoShell } from '../../components/GestaoShell';
import { useAdminCreators } from '../../hooks/useAdminCreators';

// T2.7 (spec 082) — listagem paginada de todos os publicadores, com busca
// por nome/slug (antes so havia busca individual por slug, publica).
export function GestaoPublicadoresPage() {
  const [searchDraft, setSearchDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminCreators({ q: q || undefined, page });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQ(searchDraft.trim());
  };

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Publicadores</h1>

      <form onSubmit={handleSearch} className="mt-4 flex max-w-md gap-2">
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Buscar por nome ou identificador..."
          className="min-h-[44px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-artificio-orange"
        >
          Buscar
        </button>
      </form>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {isError && (
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm text-red-400">{error instanceof Error ? error.message : 'Falha ao carregar publicadores.'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-[var(--line)] px-3 py-1 text-sm text-[var(--fg)]"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {data?.items.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhum publicador encontrado.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {data?.items.map((creator) => (
          <li key={creator.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--fg)]">{creator.display_name}</p>
              <p className="text-xs text-[var(--fg-muted)]">{creator.slug} · {creator.role}</p>
            </div>
          </li>
        ))}
      </ul>

      {data && data.total > data.page_size && (
        <div className="mt-4 flex items-center gap-3 text-sm text-[var(--fg-muted)]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="min-h-[36px] rounded-md border border-[var(--line)] px-3 py-1 text-[var(--fg)] disabled:opacity-40"
          >
            Anterior
          </button>
          <span>{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="min-h-[36px] rounded-md border border-[var(--line)] px-3 py-1 text-[var(--fg)] disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </GestaoShell>
  );
}
