import { Link, useNavigate, useParams } from 'react-router-dom';
import { trackEvent } from '@artificio/analytics';
import { useSession } from '@artificio/auth/client';
import { AppShell } from '../components/AppShell';
import { AddToCollectionButton } from '../components/AddToCollectionButton';
import { CommentSection } from '../components/CommentSection';
import { RatingSection } from '../components/RatingSection';
import { useMaterial } from '../hooks/useMaterial';
import { useMaterialMetadata } from '../hooks/useMaterialMetadata';
import { useRegisterDownload } from '../hooks/useRegisterDownload';
import { useAddFavorite, useRemoveFavorite, useFavorites } from '../hooks/useFavorites';

// T4.4 (spec 073) — ficha de material. Ordem de secoes fixada em 061/spec.md:
// titulo/badges -> resumo -> CTA de acesso -> descricao -> metadados ->
// criador -> ultima atualizacao.
export function MaterialPage() {
  const { materialSlug } = useParams<{ materialSlug: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: material, isLoading, isError } = useMaterial(materialSlug);
  const { data: metadata } = useMaterialMetadata(material?.id);
  const registerDownload = useRegisterDownload();
  const favoritesQuery = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-white/70">Carregando...</div>
      </AppShell>
    );
  }

  if (isError || !material) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white">Material não encontrado</h1>
          <p className="mt-2 text-white/70">Ele pode ter sido removido ou ainda não foi publicado.</p>
        </div>
      </AppShell>
    );
  }

  // Criterio de aceite 4 da 073: destino degradado (sem URL configurada)
  // mostra aviso, nunca falha silenciosa clicando em nada.
  const hasDestination = Boolean(material.external_url);

  const isFavorite = favoritesQuery.data?.some((favorite) => favorite.id === material.id) ?? false;

  const handleAccess = () => {
    // Criterio de aceite 3: evento de funil dispara ANTES do redirecionamento;
    trackEvent('download_cta_click', {
      material_id: material.id,
      material_slug: material.slug,
      material_type: material.material_type,
    });
    // T3.1/T3.2 (spec 074) — registra download (dedup por conta no backend)
    // se logado; se nao, backend responde 401 e so o redirect acontece.
    if (user) {
      registerDownload.mutate(material.id);
    }
    // DEB-073-02 — destination_id opaco (download_destination), desacoplado
    // do slug do material; sobrevive a troca futura de slug.
    navigate(`/ir/${material.destination_id}`);
  };

  const handleToggleFavorite = () => {
    if (isFavorite) {
      removeFavorite.mutate(material.id);
    } else {
      addFavorite.mutate(material.id);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-white">{material.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/20 px-2 py-0.5">{material.material_type}</span>
        </div>

        {material.summary && <p className="mt-4 text-white/80">{material.summary}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasDestination ? (
            <button
              type="button"
              onClick={handleAccess}
              className="min-h-[44px] rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover"
            >
              Acessar material
            </button>
          ) : (
            <p role="alert" className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-200">
              Este material está temporariamente indisponível. O destino de acesso não pôde ser confirmado.
            </p>
          )}

          {user && (
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="min-h-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white hover:border-artificio-orange"
            >
              {isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            </button>
          )}

          {user && <AddToCollectionButton materialId={material.id} />}
        </div>

        {material.description && (
          <div className="mt-8 whitespace-pre-wrap text-white/80">{material.description}</div>
        )}

        {metadata?.publisher_name && (
          <p className="mt-4 text-sm text-white/60">
            Editora/selo: <span className="text-white/80">{metadata.publisher_name}</span>
          </p>
        )}

        <div className="mt-8 border-t border-white/10 pt-4 text-sm text-white/60">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {material.creator_slug && (
              <Link to={`/criadores/${material.creator_slug}`} className="hover:text-artificio-orange">
                Ver outros materiais deste criador
              </Link>
            )}
            {material.system_id && material.system_name && (
              <Link to={`/catalogo?system_id=${material.system_id}`} className="hover:text-artificio-orange">
                Ver outros materiais de {material.system_name}
              </Link>
            )}
            {material.edition_id && material.edition_name && (
              <Link to={`/catalogo?edition_id=${material.edition_id}`} className="hover:text-artificio-orange">
                Ver outros materiais de {material.edition_name}
              </Link>
            )}
          </div>
          <p className="mt-2">
            Última atualização: {new Date(material.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <RatingSection materialId={material.id} />
        <CommentSection materialId={material.id} />
      </div>
    </AppShell>
  );
}
