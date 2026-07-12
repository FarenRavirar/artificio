import { useSession } from '@artificio/auth/client';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';

export function VisaoGeralPage() {
  const { user } = useSession();
  const { data: materials } = useMyMaterials();

  const published = materials?.filter((m) => m.editorial_state === 'published').length ?? 0;
  const inReview = materials?.filter((m) => m.editorial_state === 'in_review').length ?? 0;
  const draft = materials?.filter((m) => m.editorial_state === 'draft').length ?? 0;

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-white">Olá, {user?.name ?? 'usuário'}</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-white/10 p-4">
          <p className="text-3xl font-bold text-artificio-orange">{published}</p>
          <p className="text-sm text-white/60">Materiais publicados</p>
        </div>
        <div className="rounded-md border border-white/10 p-4">
          <p className="text-3xl font-bold text-artificio-orange">{inReview}</p>
          <p className="text-sm text-white/60">Em revisão</p>
        </div>
        <div className="rounded-md border border-white/10 p-4">
          <p className="text-3xl font-bold text-artificio-orange">{draft}</p>
          <p className="text-sm text-white/60">Rascunhos</p>
        </div>
      </div>
    </PainelShell>
  );
}
