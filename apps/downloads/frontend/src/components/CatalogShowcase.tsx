import { useCallback, useEffect, useState } from 'react';
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
function Shelf({ id, title, sort, onError }: Readonly<ShelfDefinition & { onError: (id: string, failed: boolean) => void }>) {
  const { data, isLoading, isError } = useMaterialsCatalog({ sort, page: SHELF_PAGE });

  // Prateleira que falha e prateleira vazia sao indistinguiveis na tela (as
  // duas somem, por Requisito 16). Sozinho isso e aceitavel — uma prateleira
  // fora do ar nao justifica poluir a vitrine —, mas se TODAS falharem a
  // pagina fica muda, como se o acervo estivesse vazio. O pai agrega os
  // estados pra distinguir os dois casos (achado de review PR #214,
  // CodeRabbit).
  useEffect(() => {
    onError(id, isError);
  }, [id, isError, onError]);

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
  const [failedShelves, setFailedShelves] = useState<Record<string, boolean>>({});

  const handleShelfError = useCallback((id: string, failed: boolean) => {
    setFailedShelves((current) => (current[id] === failed ? current : { ...current, [id]: failed }));
  }, []);

  // So avisa quando TODAS falharam. Uma prateleira fora do ar entre tres nao
  // merece alarme — as outras duas ja mostram acervo, e o erro seria ruido
  // sobre uma pagina que esta funcionando.
  const allFailed = shelves.length > 0 && shelves.every((shelf) => failedShelves[shelf.id]);

  return (
    <div className="flex flex-col gap-10">
      {allFailed && (
        <p role="status" className="text-sm text-[var(--fg-muted)]">
          Não foi possível carregar o acervo agora. Tente recarregar a página.
        </p>
      )}
      {shelves.map((shelf) => (
        <Shelf key={shelf.id} {...shelf} onError={handleShelfError} />
      ))}
    </div>
  );
}
