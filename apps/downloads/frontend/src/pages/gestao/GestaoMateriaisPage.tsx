import { Link } from 'react-router-dom';
import { GestaoShell } from '../../components/GestaoShell';
import { useMaterialsCatalog } from '../../hooks/useMaterialsCatalog';

const STATE_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirado',
};

// T1.1 (spec 075) — visao geral de materiais publicados (busca/lista ja
// existente na 073, aqui reusada no contexto admin); auditoria por item
// aponta pra /gestao/auditoria/:id.
export function GestaoMateriaisPage() {
  const { data, isLoading } = useMaterialsCatalog({});

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Materiais</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {data?.items.map((material) => (
          <li key={material.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--fg)]">{material.title}</p>
              <p className="text-xs text-[var(--fg-muted)]">{STATE_LABEL[material.editorial_state] ?? material.editorial_state}</p>
            </div>
            <Link
              to={`/gestao/auditoria/${material.id}`}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-artificio-orange"
            >
              Auditoria
            </Link>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}
