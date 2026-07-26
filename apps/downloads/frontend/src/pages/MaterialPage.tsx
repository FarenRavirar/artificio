import { ClipboardList, Clock, Dices } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trackEvent } from '@artificio/analytics';
import { useSession } from '@artificio/auth/client';
import { AppShell } from '../components/AppShell';
import { AddToCollectionButton } from '../components/AddToCollectionButton';
import { CommentSection } from '../components/CommentSection';
import { RatingSection } from '../components/RatingSection';
import { SystemChainBadge } from '../components/SystemChainBadge';
import { useMaterial } from '../hooks/useMaterial';
import { useMaterialMetadata } from '../hooks/useMaterialMetadata';
import { useRegisterDownload } from '../hooks/useRegisterDownload';
import { useAddFavorite, useRemoveFavorite, useFavorites } from '../hooks/useFavorites';

function Tile({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return (
    <div className="flex flex-col items-center gap-1 border-r border-[var(--admin-border)] px-3 py-3 text-center last:border-r-0">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span aria-hidden="true" className="text-[var(--color-artificio-orange)]">{icon}</span>
      <span className="text-sm font-semibold text-[var(--fg)]">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--admin-border)] py-2 text-sm last:border-b-0">
      <span className="font-semibold text-[var(--fg)]">{label}</span>
      <span className="text-right text-[var(--fg-muted)]">{value}</span>
    </div>
  );
}

// T4.4 (spec 073) — ficha de material. Ordem de secoes fixada em 061/spec.md:
// titulo/badges -> resumo -> CTA de acesso -> descricao -> metadados ->
// criador -> ultima atualizacao. Fase 7 (spec 086): reconstrucao fiel aos
// prints (temp/mais prints com aprenddizados.png, outra captura.png,
// apresentacao dos dados do produto...png) — header 2 colunas, faixa de
// tiles com icone, bloco DETALHES 2 colunas, descricao rica.
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
        <div className="mx-auto max-w-3xl px-4 py-16 text-[var(--fg-muted)]">Carregando...</div>
      </AppShell>
    );
  }

  if (isError || !material) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-[var(--fg)]">Material não encontrado</h1>
          <p className="mt-2 text-[var(--fg-muted)]">Ele pode ter sido removido ou ainda não foi publicado.</p>
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

  // T7.6 — filtros/tags como chips clicaveis levando ao catalogo filtrado
  // (mesmo contrato de query params, D073); facet/path viram um unico
  // parametro de busca textual, ja que o catalogo nao tem filtro por facet
  // estruturado (Fase 8 trata a sidebar/chips do catalogo em si).
  const filterChips = (metadata?.source_filters ?? []).map((filter) => filter.path[filter.path.length - 1]);

  const hasDetails = Boolean(
    metadata?.credits ||
      metadata?.creation_method ||
      filterChips.length > 0 ||
      metadata?.file_size_text ||
      metadata?.file_format ||
      metadata?.page_count ||
      metadata?.source_category,
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div>
            {material.cover_image_url ? (
              <img
                src={material.cover_image_url}
                alt={`Capa de ${material.title}`}
                className="w-full rounded-lg border border-[var(--admin-border)] object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-sm text-[var(--fg-muted)]">
                Sem capa
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[var(--fg)]">{material.title}</h1>
            {metadata?.scenario && (
              <p className="mt-1 text-[var(--fg-muted)]">Para {metadata.scenario}</p>
            )}
            {metadata?.credits && (
              <p className="mt-1 text-[var(--fg-muted)]">Por {metadata.credits}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                {material.material_type}
              </span>
              {/* T9.4 (spec 084) — D119: metadata.language sempre 'pt' pra
                  material publicado (CHECK/NOT NULL no schema); exibe quando
                  metadata ja carregou. */}
              {metadata?.language && (
                <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                  Em português
                </span>
              )}
              <SystemChainBadge
                systemName={material.system_name}
                editionName={material.edition_name}
                variantName={material.variant_name}
              />
            </div>

            {material.summary && <p className="mt-4 text-[var(--fg-muted)]">{material.summary}</p>}

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
                <p role="alert" className="artificio-banner-warning rounded-md border px-4 py-3">
                  Este material está temporariamente indisponível. O destino de acesso não pôde ser confirmado.
                </p>
              )}

              {user && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-artificio-orange"
                >
                  {isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                </button>
              )}

              {user && <AddToCollectionButton materialId={material.id} />}
            </div>
          </div>
        </div>

        {/*
          T7.3 — faixa de tiles, padrao real confirmado no print
          (temp/outra captura.png): SEMPRE 3 tiles — Cenario/Formato/
          Adicionado ao catalogo, igual a loja de origem (que mostra "N/D"
          em vez de esconder o tile quando o dado falta). Achado do gate de
          fase (T7.10): a versao anterior usava Numero de paginas como
          segundo tile e escondia a faixa toda quando faltava page_count/
          file_format — divergia do print, que sempre mostra os 3 e usa
          "N/D" como valor, nunca omite a secao (requisito 15).
        */}
        <div className="mt-6 grid grid-cols-1 divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Tile icon={<Dices className="h-5 w-5" />} label="Cenário" value={metadata?.scenario ?? 'N/D'} />
          <Tile icon={<ClipboardList className="h-5 w-5" />} label="Formato" value={metadata?.file_format ?? 'N/D'} />
          <Tile
            icon={<Clock className="h-5 w-5" />}
            label="Adicionado ao catálogo"
            value={new Date(material.created_at).toLocaleDateString('pt-BR')}
          />
        </div>

        {metadata?.description_html ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Descrição</h2>
            {/*
              T7.5 — HTML ja sanitizado no backend (sanitizeRichHtml, Fase 2)
              antes de persistir E antes de servir (routes/materialMetadata.ts).
              Seguro renderizar cru aqui porque a fronteira de seguranca e o
              servidor, nunca o cliente (regra petrea AGENTS.md: HTML de
              usuario e hostil). Quebraria se alguem passasse a aceitar HTML
              de outra rota/writer sem passar pelo mesmo sanitizador.
            */}
            <div
              className="prose prose-sm mt-2 max-w-none text-[var(--fg-muted)]"
              dangerouslySetInnerHTML={{ __html: metadata.description_html }}
            />
          </div>
        ) : (
          material.description && (
            <div className="mt-8 whitespace-pre-wrap text-[var(--fg-muted)]">{material.description}</div>
          )
        )}

        {/* T7.4 — bloco DETALHES 2 colunas, padrao do print "apresentacao dos
            dados do produto...png": cenario/autores/artistas/metodo/filtros
            a esquerda; tamanho/formato/paginas/categoria a direita. */}
        {hasDetails && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Detalhes</h2>
            <div className="mt-3 grid grid-cols-1 gap-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:grid-cols-2">
              <div>
                {metadata?.scenario && <DetailRow label="Cenário" value={metadata.scenario} />}
                {metadata?.credits && <DetailRow label="Autor(es)" value={metadata.credits} />}
                {metadata?.creation_method && <DetailRow label="Método de criação" value={metadata.creation_method} />}
                {filterChips.length > 0 && (
                  <DetailRow
                    label="Filtros"
                    value={
                      <div className="flex flex-wrap justify-end gap-2">
                        {filterChips.map((chip) => (
                          <Link
                            key={chip}
                            to={`/catalogo?q=${encodeURIComponent(chip)}`}
                            className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs hover:border-artificio-orange"
                          >
                            {chip}
                          </Link>
                        ))}
                      </div>
                    }
                  />
                )}
              </div>
              <div>
                {metadata?.file_size_text && <DetailRow label="Tamanho do arquivo" value={metadata.file_size_text} />}
                {metadata?.file_format && <DetailRow label="Formato" value={metadata.file_format} />}
                {metadata?.page_count && <DetailRow label="Páginas" value={String(metadata.page_count)} />}
                {metadata?.source_category && <DetailRow label="Categoria" value={metadata.source_category} />}
              </div>
            </div>
          </div>
        )}

        {metadata?.publisher_name && (
          <p className="mt-4 text-sm text-[var(--fg-muted)]">
            Editora/selo: <span className="text-[var(--fg-muted)]">{metadata.publisher_name}</span>
          </p>
        )}

        <div className="mt-8 border-t border-[var(--line)] pt-4 text-sm text-[var(--fg-muted)]">
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
