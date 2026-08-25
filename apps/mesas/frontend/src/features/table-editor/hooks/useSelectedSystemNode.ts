import { useEffect, useState } from 'react';
import { authGet } from '../../../utils/authenticatedFetch';
import { normalizeSystemsResponse } from '../../../hooks/useSystemsCatalog';
import type { SystemTreeNode } from '../../../types/systems';

/**
 * O nó do catálogo correspondente ao sistema selecionado, buscado por id.
 *
 * O editor precisa de três coisas do catálogo, todas sobre ESTE nó: `path_slug`
 * (elegibilidade DDAL) e `name`/`logo_filename`/`website_url` (selo do card da
 * prévia). Antes isso vinha de `useSystemsCatalog()`, que baixa a árvore inteira
 * (`?view=tree`): **503.907 bytes por abertura do editor**, medido no §Gap 9 da
 * spec 096 — exatamente o que o A21 proíbe ("a chamada usa search/limit/
 * parent_id, nunca view=tree").
 *
 * `?id=` é o filtro que a rota ganhou para este caso: `search` casa nome, slug,
 * path_slug e alias, mas nunca id, então não havia como pedir "este nó".
 *
 * Falha de rede devolve `null` — o card perde o selo do sistema e o DDAL fica
 * inelegível (o backend revalida no submit e é a autoridade), nunca quebra o
 * editor.
 */
export interface SelectedSystemNodeState {
  node: SystemTreeNode | null;
  /**
   * `false` enquanto a busca do id atual não voltou. Quem decide POR AUSÊNCIA
   * de dado precisa esperar: o DDAL, por exemplo, desmarcaria o selo do mestre
   * tratando o `null` em voo como "sistema não elegível".
   */
  resolved: boolean;
  /**
   * A busca voltou, mas FALHOU (rede/HTTP). `node` é `null` sem que isso diga
   * nada sobre o sistema — só que não deu para consultá-lo. Sem este sinal, uma
   * queda de rede é indistinguível de "o catálogo não conhece este id", e quem
   * decide por ausência de dado age como se o nó não existisse.
   */
  failed: boolean;
}

export function useSelectedSystemNode(systemId: string): SelectedSystemNodeState {
  // O id resolvido viaja JUNTO do nó: assim o retorno é derivado por comparação
  // (`fetched.id === systemId`) em vez de exigir um setState síncrono no effect
  // para limpar o nó anterior — o que dispara render em cascata
  // (react-hooks/set-state-in-effect). Trocar de sistema devolve `null` no
  // mesmo render, sem passo intermediário mostrando o sistema antigo.
  const [fetched, setFetched] = useState<
    { id: string; node: SystemTreeNode | null; failed: boolean } | null
  >(null);

  useEffect(() => {
    if (!systemId) return;

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const params = new URLSearchParams({ id: systemId });
        const response = await authGet(`/api/v1/systems?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Falha ao carregar o sistema selecionado.');
        const json: unknown = await response.json();
        if (!active) return;
        setFetched({ id: systemId, node: normalizeSystemsResponse(json)[0] ?? null, failed: false });
      } catch {
        if (active) setFetched({ id: systemId, node: null, failed: true });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [systemId]);

  // Sem sistema escolhido não há o que buscar: resolvido, e vazio.
  if (!systemId) return { node: null, resolved: true, failed: false };
  // Busca do id ATUAL ainda não voltou (ou é resposta de um id anterior).
  if (fetched?.id !== systemId) return { node: null, resolved: false, failed: false };
  return { node: fetched.node, resolved: true, failed: fetched.failed };
}
