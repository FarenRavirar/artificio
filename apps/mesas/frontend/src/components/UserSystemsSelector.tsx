import React, { useCallback, useMemo } from 'react';
import { SystemPicker } from './SystemPicker';
import { useSystemsSearch } from '../hooks/useSystemsSearch';
import { useResolvedSystemNodes } from '../hooks/useResolvedSystemNodes';
import './UserSystemsSelector.css';

interface UserSystemsSelectorProps {
  type: 'favorite' | 'gm';
  selectedSystemIds: string[];
  onAdd: (systemId: string) => void;
  onRemove: (systemId: string) => void;
}

/**
 * Componente para selecionar sistemas favoritos ou sistemas que o usuário mestra.
 *
 * **Spec 099, fase G (G5b): carrega sob demanda.** Antes montava
 * `useSystemsCatalog()`, que baixa a árvore inteira no primeiro render —
 * medido na API de beta em 2026-09-01: **487.965 bytes** (1.289 nós) para
 * escolher de 1 a 5 sistemas, contra **2.040** de uma busca. Agora a busca é
 * server-side e só os sistemas JÁ selecionados são resolvidos, numa requisição
 * por lista de ids.
 *
 * Continua `mode="multi"`: trocar pelo `CatalogSystemSelector` (que já tinha a
 * busca sob demanda) seria regressão, porque ele é single-select e aqui se
 * escolhe N sistemas. Foi para isso que o `CatalogTree` ganhou as fontes
 * server-side na G7.
 */
export const UserSystemsSelector = React.memo(function UserSystemsSelector({
  type,
  selectedSystemIds,
  onAdd,
  onRemove,
}: UserSystemsSelectorProps) {
  const { fetchSystemOptions, fetchChildOptions } = useSystemsSearch();
  // A resolução dos nomes dos ids salvos vive no `useResolvedSystemNodes` (G6):
  // era mecânica idêntica à do `GmProfileFields` — ref para não reentrar,
  // chave estável da seleção, aviso amarrado à seleção atual. Extraída depois
  // de o Sonar medir a duplicação na PR #304, não por antecipação.
  const { nodes: visibleSelectedNodes, failed: resolveFailed, retry: retryResolve } =
    useResolvedSystemNodes(selectedSystemIds);


  const selectedSystems = useMemo(
    () => visibleSelectedNodes.map((node) => ({ id: node.id, name: node.name })),
    [visibleSelectedNodes],
  );

  const handleSelectionChange = useCallback((nextIds: string[]) => {
    for (const systemId of selectedSystemIds) {
      if (!nextIds.includes(systemId)) {
        onRemove(systemId);
      }
    }

    for (const systemId of nextIds) {
      if (!selectedSystemIds.includes(systemId)) {
        onAdd(systemId);
      }
    }
  }, [selectedSystemIds, onAdd, onRemove]);

  // G5b: não há mais estado de "carregando o catálogo" nem de "falhou ao
  // carregar o catálogo" bloqueando a tela inteira — nada é baixado no primeiro
  // render. O campo de busca aparece de imediato e o que pode falhar (a busca,
  // a resolução dos nomes) se reporta no lugar onde acontece.
  return (
    <div className="user-systems-selector">
      <div className="systems-selector-header">
        <p className="systems-count">
          {selectedSystemIds.length} {type === 'favorite' ? 'favorito(s)' : 'sistema(s) que você mestra'}
        </p>
      </div>

      {resolveFailed && (
        <p className="user-systems-selector-resolve-error" role="alert">
          Não foi possível carregar os nomes dos sistemas escolhidos. Eles continuam salvos.{' '}
          {/* Sem o botão, falha transitória só se recuperava trocando a seleção
              ou recarregando a página: o efeito depende de `selectedKey`, que
              não muda. Achado do Codex na PR #304. */}
          <button type="button" className="underline underline-offset-2" onClick={retryResolve}>
            Tentar de novo
          </button>
        </p>
      )}

      {selectedSystems.length > 0 && (
        <div className="selected-systems-list">
          <div className="selected-systems-container">
            {selectedSystems.map(({ id, name }) => (
              <span key={id} className="selected-system-badge">{name}</span>
            ))}
          </div>
        </div>
      )}

      <SystemPicker
        selectedIds={selectedSystemIds}
        selectedNodes={visibleSelectedNodes}
        fetchSystemOptions={fetchSystemOptions}
        fetchChildOptions={fetchChildOptions}
        onSelectionChange={handleSelectionChange}
        idPrefix={`profile-${type}`}
        mode="multi"
        role="user"
      />
    </div>
  );
});
