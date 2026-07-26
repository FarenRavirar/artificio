import { useMaterialsCatalog } from '../hooks/useMaterialsCatalog';
import { MaterialShelf } from './MaterialShelf';
import type { SortOption } from '../types/material';

export interface ShelfDefinition {
  id: string;
  title: string;
  sort: SortOption;
}

// Prateleira sempre mostra a primeira pagina do criterio — quem quiser o
// resto usa "Ver tudo" e cai no modo resultado paginado.
const SHELF_PAGE = 1;

// Uma prateleira = uma consulta. Componente proprio porque cada prateleira
// precisa do seu `useMaterialsCatalog`, e hook nao pode ser chamado dentro de
// `.map()` no componente pai sem virar chamada condicional.
function Shelf({ id, title, sort }: Readonly<ShelfDefinition>) {
  const { data, isLoading } = useMaterialsCatalog({ sort, page: SHELF_PAGE });

  return (
    <MaterialShelf
      shelfId={id}
      title={title}
      seeAllTo={`/catalogo?sort=${sort}`}
      items={data?.items ?? []}
      isLoading={isLoading}
    />
  );
}

// Spec 087 (T2.4) — modo vitrine: as 3 prateleiras da home.
//
// "Mais visitados" e "Mais bem avaliados" dependem do corte de elegibilidade
// do backend (Fase 1B): material so-visualizado, sem nenhum download, nao
// entra na ordenacao `trending` — some da lista em vez de ir pro fim. Isso e
// garantido em SQL (services/materialMetrics.ts), nao aqui; o frontend so
// consome a ordem que veio.
//
// Prateleira sem item elegivel nao renderiza (MaterialShelf devolve null),
// entao acervo novo nao mostra secao vazia prometendo conteudo.
export function CatalogShowcase({ shelves }: Readonly<{ shelves: readonly ShelfDefinition[] }>) {
  return (
    <div className="flex flex-col gap-10">
      {shelves.map((shelf) => (
        <Shelf key={shelf.id} {...shelf} />
      ))}
    </div>
  );
}
