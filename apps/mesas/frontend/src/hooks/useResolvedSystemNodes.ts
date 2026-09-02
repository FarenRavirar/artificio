import { useEffect, useRef, useState } from 'react';
import type { SystemTreeNode } from '../types/systems';
import { useSystemsSearch } from './useSystemsSearch';

/**
 * Resolve os NOMES dos sistemas já escolhidos a partir dos ids salvos.
 *
 * Extraído na spec 099 (fase G, G6) depois de a duplicação estar MEDIDA, não
 * antes: `GmProfileFields` e `UserSystemsSelector` carregavam ~40 linhas
 * idênticas desta mecânica — os próprios comentários de lá diziam "mesma
 * mecânica do UserSystemsSelector". O Sonar mediu 29,8% e 21,3% de linhas
 * duplicadas nos dois arquivos na PR #304. Dois consumidores com comportamento
 * idêntico é o gatilho de extração; um só teria sido abstração prematura.
 *
 * Só se grava id, nunca nome: id que sumiu do catálogo é omitido da lista, e a
 * contagem continua sendo a verdade dos ids salvos no servidor.
 */
export function useResolvedSystemNodes(selectedIds: readonly string[]): {
  /** Nós resolvidos, já filtrados pela seleção corrente. */
  nodes: SystemTreeNode[];
  /** A resolução da seleção ATUAL falhou (falha antiga não acusa erro). */
  failed: boolean;
} {
  const { fetchSystemsByIds } = useSystemsSearch();
  const [resolvedNodes, setResolvedNodes] = useState<SystemTreeNode[]>([]);
  // Guarda a CHAVE que falhou, não um booleano: o aviso some sozinho quando a
  // seleção muda, sem setState no início do efeito (que encadearia um render
  // extra a cada passagem).
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A função entra por REF, não por dependência: o hook devolve funções
  // memoizadas, mas o efeito faz setState, e uma implementação (ou um mock de
  // teste) que a recrie a cada render fecharia o ciclo
  // render→efeito→setState→render. Medido: com a função na lista de
  // dependências, o teste do GmProfileFields travou sem terminar.
  //
  // A ESCRITA da ref vive em efeito, não no corpo do render — render descartado
  // antes de comitar deixaria a ref apontando para o callback de um render que
  // nunca existiu (`react-hooks/refs`).
  const fetchRef = useRef(fetchSystemsByIds);
  useEffect(() => {
    fetchRef.current = fetchSystemsByIds;
  }, [fetchSystemsByIds]);

  // Chave estável da seleção: sem isto, o array novo a cada render do pai
  // refaria a requisição em loop.
  const selectedKey = selectedIds.join(',');

  useEffect(() => {
    abortRef.current?.abort();

    const ids = selectedKey ? selectedKey.split(',') : [];
    if (ids.length === 0) {
      // Sem `setResolvedNodes([])` síncrono: a lista visível é derivada de
      // `selectedKey` no render, abaixo.
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    fetchRef.current(ids, controller.signal)
      .then((nodes) => {
        if (controller.signal.aborted) return;
        setResolvedNodes(nodes);
        // Limpa o aviso só quando uma resolução nova dá certo — zerar no início
        // do efeito seria setState síncrono no corpo dele.
        setFailedKey(null);
      })
      .catch((error: unknown) => {
        // Resposta de uma seleção que já foi trocada não é falha desta tela:
        // sem esta guarda, abortar por troca de seleção acendia o alerta.
        if (controller.signal.aborted) return;
        if ((error as Error)?.name === 'AbortError') return;
        // Os ids seguem salvos; o que falta é só o NOME na etiqueta. Sem o
        // aviso, a lista some e lê como "o site apagou meus sistemas".
        setResolvedNodes([]);
        setFailedKey(selectedKey);
      });

    return () => controller.abort();
  }, [selectedKey]);

  // Derivado, não estado: enquanto a resolução do lote novo não chega, exibir
  // nome de sistema que não está mais selecionado seria mostrar dado errado.
  const nodes = selectedKey
    ? resolvedNodes.filter((node) => selectedIds.includes(node.id))
    : [];

  return { nodes, failed: failedKey !== null && failedKey === selectedKey };
}
