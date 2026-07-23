import { Link } from 'react-router-dom';
import { PainelShell } from '../../components/PainelShell';
import { useFavorites, useRemoveFavorite } from '../../hooks/useFavorites';

export function FavoritosPage() {
  const { data: favorites, isLoading } = useFavorites();
  const removeMutation = useRemoveFavorite();

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Favoritos</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {favorites?.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhum favorito ainda.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {favorites?.map((favorite) => (
          <li key={favorite.id} className="flex items-center justify-between gap-4 py-3">
            <Link to={`/materiais/${favorite.slug}`} className="font-semibold text-[var(--fg)] hover:text-artificio-orange">
              {favorite.title}
            </Link>
            <button
              type="button"
              onClick={() => removeMutation.mutate(favorite.id)}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-red-400"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
