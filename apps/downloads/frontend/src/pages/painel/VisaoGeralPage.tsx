import { useSession } from '@artificio/auth/client';
import { Link } from 'react-router-dom';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';

export function VisaoGeralPage() {
  const { user } = useSession();
  const { data: materials, isLoading, isError } = useMyMaterials();

  const states = [
    ['published', 'Publicados'],
    ['in_review', 'Em revisão'],
    ['draft', 'Rascunhos'],
    ['rejected', 'Rejeitados'],
    ['withdrawn', 'Retirados'],
  ] as const;
  // Achado de review (PR #230, CodeRabbit): uma passada de agrupamento em vez de
  // um filter por contador + dois filters de lista — a lista era varrida 7x.
  const list = materials ?? [];
  const byState = new Map<string, typeof list>();
  for (const material of list) {
    const bucket = byState.get(material.editorial_state) ?? [];
    bucket.push(material);
    byState.set(material.editorial_state, bucket);
  }
  const rejected = byState.get('rejected') ?? [];
  const published = byState.get('published') ?? [];

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Olá, {user?.name ?? 'usuário'}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {states.map(([state, label]) => (
          <div key={state} className="rounded-md border border-[var(--line)] p-4">
            {/* Achado de review (PR #230, CodeRabbit): durante o carregamento —
                e igualmente quando a requisição falha — a lista é undefined.
                Mostrar "0" e o convite de primeiro material faria o autor com
                acervo publicado achar que perdeu tudo. Falha de rede não é
                acervo vazio. */}
            <p className="text-3xl font-bold text-artificio-orange">{isLoading || isError ? '—' : byState.get(state)?.length ?? 0}</p>
            <p className="text-sm text-[var(--fg-muted)]">{label}</p>
          </div>
        ))}
      </div>

      {isError && (
        <p role="alert" className="mt-8 rounded-md border border-red-500/50 p-5 text-sm text-[var(--fg)]">
          Não foi possível carregar seus materiais agora. Nada foi perdido — recarregue a página em instantes.
        </p>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <section className="mt-8 rounded-md border border-artificio-orange p-5">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Publique seu primeiro material</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Comece com título e tipo. Você poderá completar e retomar o rascunho depois.</p>
          <Link to="/painel/materiais/novo" className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-artificio-orange px-4 font-semibold text-white">Criar rascunho</Link>
        </section>
      )}

      {rejected.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Precisa de correção</h2>
          <ul className="mt-3 space-y-3">
            {rejected.map((material) => (
              <li key={material.id} className="rounded-md border border-red-500/50 p-4">
                <p className="font-semibold text-[var(--fg)]">{material.title}</p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">Motivo: {material.rejection_reason ?? 'A moderação não informou um motivo.'}</p>
                <Link to={`/painel/materiais/${material.id}/editar`} className="mt-2 inline-block text-sm font-semibold text-artificio-orange">Corrigir material</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {published.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Acompanhe suas publicações</h2>
          <ul className="mt-3 space-y-3">
            {published.map((material) => (
              <li key={material.id} className="rounded-md border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--fg)]">{material.title}</p>
                  <Link to={`/materiais/${material.slug}`} className="text-sm font-semibold text-artificio-orange">Ver no catálogo</Link>
                </div>
                <p className="mt-2 text-sm text-[var(--fg-muted)]">
                  {material.avg_rating === null || material.avg_rating === undefined ? 'Sem avaliações' : `${material.avg_rating.toFixed(1)} / 5 em ${material.rating_count ?? 0} avaliações`}
                  {' · '}{material.comment_count ?? 0} comentários · {material.download_count ?? 0} downloads
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PainelShell>
  );
}
