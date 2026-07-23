import { Link } from 'react-router-dom';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';

const STATE_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirado',
};

// T1.2 (spec 074) — lista todos os estados editoriais do proprio autor.
export function MeusMateriaisPage() {
  const { data: materials, isLoading } = useMyMaterials();

  return (
    <PainelShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--fg)]">Meus materiais</h1>
        <Link
          to="/painel/materiais/novo"
          className="min-h-[44px] rounded-md bg-artificio-orange px-4 py-2 text-sm font-semibold text-white hover:bg-artificio-orange-hover"
        >
          Novo material
        </Link>
      </div>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}

      {materials?.length === 0 && (
        <p className="mt-4 text-[var(--fg-muted)]">Você ainda não publicou nenhum material.</p>
      )}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {materials?.map((material) => (
          <li key={material.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-semibold text-[var(--fg)]">{material.title}</p>
              <p className="text-xs text-[var(--fg-muted)]">{STATE_LABEL[material.editorial_state] ?? material.editorial_state}</p>
            </div>
            <Link
              to={`/painel/materiais/${material.id}/editar`}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-white hover:border-artificio-orange"
            >
              Editar
            </Link>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
