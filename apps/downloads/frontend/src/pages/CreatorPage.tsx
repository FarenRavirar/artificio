import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useCreator } from '../hooks/useCreator';

// T4.1 (spec 073) — /criadores/:slug, aceitando credito sem conta associada.
export function CreatorPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: creator, isLoading, isError } = useCreator(slug);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-[var(--fg-muted)]">Carregando...</div>
      </AppShell>
    );
  }

  if (isError || !creator) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-[var(--fg)]">Criador não encontrado</h1>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)]">{creator.display_name}</h1>
        {creator.bio && <p className="mt-2 text-[var(--fg-muted)]">{creator.bio}</p>}

        <h2 className="mt-8 mb-4 text-lg font-semibold text-[var(--fg)]">Materiais publicados</h2>
        {creator.materials.length === 0 ? (
          <p className="text-[var(--fg-muted)]">Nenhum material publicado ainda.</p>
        ) : (
          <ul className="space-y-3">
            {creator.materials.map((material) => (
              <li key={material.id}>
                <Link
                  to={`/materiais/${material.slug}`}
                  className="block rounded-md border border-[var(--line)] p-3 hover:border-artificio-orange"
                >
                  <span className="font-medium text-[var(--fg)]">{material.title}</span>
                  {material.summary && <p className="mt-1 text-sm text-[var(--fg-muted)]">{material.summary}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
