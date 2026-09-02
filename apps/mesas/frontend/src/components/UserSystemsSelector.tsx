import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SystemPicker } from './SystemPicker';
import { useSystemsSearch } from '../hooks/useSystemsSearch';
import type { SystemTreeNode } from '../types/systems';
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
  const { fetchSystemOptions, fetchChildOptions, fetchSystemsByIds } = useSystemsSearch();

  // A referência do fetch entra por REF, não por dependência do efeito: o hook
  // devolve funções memoizadas, mas o efeito abaixo faz setState, e uma
  // implementação (ou um mock de teste) que recrie a função a cada render
  // fecharia o ciclo render→efeito→setState→render. Medido: com a função na
  // lista de dependências, o teste do GmProfileFields travou sem terminar.
  //
  // A ESCRITA da ref vive em efeito, não no corpo do render — render descartado
  // antes de comitar deixaria a ref apontando para o callback de um render que
  // nunca existiu. Mesmo padrão do `GmProfileFields` e do `CatalogTree`.
  const fetchSystemsByIdsRef = useRef(fetchSystemsByIds);
  useEffect(() => {
    fetchSystemsByIdsRef.current = fetchSystemsByIds;
  }, [fetchSystemsByIds]);

  // Spec 099 B9: além de contar, LISTAR os nomes dos sistemas selecionados.
  // Nome resolve pelo catálogo (system_id → nó) — nunca se grava nome, só o
  // id; id que não existe mais no catálogo é omitido da lista (a contagem
  // continua sendo a verdade dos ids salvos no servidor).
  //
  // G5b: a resolução deixou de vir do catálogo inteiro e passa por
  // `?id=a,b,c`. Uma requisição, só os ids salvos.
  const [selectedNodes, setSelectedNodes] = useState<SystemTreeNode[]>([]);
  // Guarda a CHAVE que falhou, não um booleano: assim o aviso desaparece
  // sozinho quando a seleção muda, sem precisar de setState no início do
  // efeito (que encadearia um render extra a cada passagem).
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);

  // Chave estável da seleção: sem isto, o array novo a cada render do pai
  // refaria a requisição em loop.
  const selectedKey = selectedSystemIds.join(',');

  useEffect(() => {
    resolveAbortRef.current?.abort();

    const ids = selectedKey ? selectedKey.split(',') : [];
    if (ids.length === 0) {
      // Sem `setSelectedNodes([])` síncrono: a lista visível é derivada de
      // `selectedKey` no render, logo abaixo.
      return;
    }

    const controller = new AbortController();
    resolveAbortRef.current = controller;

    fetchSystemsByIdsRef.current(ids, controller.signal)
      .then((nodes) => {
        if (controller.signal.aborted) return;
        setSelectedNodes(nodes);
        setFailedKey(null);
      })
      .catch((error: unknown) => {
        // Resposta de uma seleção que já foi trocada não é falha desta tela.
        if (controller.signal.aborted) return;
        if ((error as Error)?.name === 'AbortError') return;
        // A contagem continua correta (vem dos ids salvos); o que falha é só
        // exibir os nomes. Melhor dizer isso do que mostrar lista vazia, que
        // leria como "perdi seus sistemas".
        setSelectedNodes([]);
        setFailedKey(selectedKey);
      });

    return () => controller.abort();
  }, [selectedKey]);

  // Só avisa se a falha for da seleção ATUAL: uma falha antiga não pode
  // acusar erro sobre uma seleção que já mudou.
  const resolveFailed = failedKey !== null && failedKey === selectedKey;

  useEffect(() => () => resolveAbortRef.current?.abort(), []);

  // Derivado, não estado: filtra pelo que está selecionado AGORA. Enquanto a
  // resolução do lote novo não chega — e no caso de seleção vazia, em que o
  // efeito nem dispara —, exibir nome de sistema que já saiu seria mostrar
  // dado errado. Mesmo padrão do `GmProfileFields`.
  const visibleSelectedNodes = useMemo(
    () => selectedNodes.filter((node) => selectedSystemIds.includes(node.id)),
    [selectedNodes, selectedSystemIds],
  );

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
          Não foi possível carregar os nomes dos sistemas escolhidos. Eles continuam salvos.
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
