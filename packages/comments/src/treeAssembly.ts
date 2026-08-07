import type { CommentSort } from './treeCursor.js';

/**
 * T2.3 — montagem da árvore e corte pelo teto (requisito 6; decisões 3, 8).
 *
 * ## Por que isto é separado da query
 *
 * `plan.md` §Árvore: "no volume normal, uma leitura monta a árvore inteira. O
 * teto 1.000 comentários/2 MiB produz nós `more` por ramo, nunca lista plana
 * nem filho órfão". A regra difícil não é buscar as linhas — é **onde cortar**.
 *
 * Cortar é decisão pura sobre uma lista já ordenada, então mora aqui, no pacote
 * livre de banco, onde o caso de 1.500 comentários do aceite roda em teste sem
 * PostgreSQL. A query (`apps/accounts`, dono dos comentários por
 * `plan.md` §Arquivos afetados) entrega as linhas ordenadas; esta função decide
 * o que entra, o que vira `more` e qual sort-key cada `more` carrega.
 *
 * ## O invariante que manda no algoritmo
 *
 * **Nunca filho órfão.** Um filho sem o pai na resposta é pior que faltar o
 * ramo inteiro: o cliente não tem onde pendurá-lo e ou some silenciosamente ou
 * aparece como raiz falsa. Por isso o corte é **por ramo de raiz**, não por
 * posição na lista: quando uma raiz não cabe inteira, ela e toda a sua descendência
 * ficam de fora e viram um `more` — nunca metade dela.
 *
 * Dentro de um ramo que cabe, os filhos entram junto do pai. É o que garante
 * que expansão na mesma revisão não duplique nem perca item: cada comentário
 * pertence a exatamente um ramo, e cada ramo é servido inteiro ou adiado inteiro.
 */

/** `spec.md` 8a — teto defensivo, o que ocorrer primeiro. */
export const MAX_COMMENTS_PER_READ = 1000;
export const MAX_BYTES_PER_READ = 2 * 1024 * 1024;

/**
 * Linha vinda da query, já ordenada entre irmãos pelo sort pedido.
 * Só os campos que a montagem precisa — o payload público completo é do handler.
 */
export interface AssemblyRow {
  id: string;
  parent_id: string | null;
  depth: number;
  /** Bytes aproximados que esta linha ocupa no payload. */
  size_bytes: number;
  /** Chave de ordenação já serializada, para o cursor retomar depois dela. */
  sort_key: string;
}

/** Nó `more` do `contrato-http-v1.md` §2. */
export interface MoreNode {
  /** Ramo a expandir. `null` = continuação das raízes. */
  parent_id: string | null;
  /** Quantos comentários ficaram de fora naquele ramo. */
  count: number;
  /** Sort-key do último item servido antes do corte. */
  after: string;
}

export interface AssemblyInput {
  rows: readonly AssemblyRow[];
  sort: CommentSort;
  maxComments?: number;
  maxBytes?: number;
}

export interface AssemblyResult {
  /** IDs que entram na resposta, na ordem de leitura da árvore. */
  included: string[];
  /** Ramos adiados, um por raiz que não coube. */
  more: MoreNode[];
  /** `true` quando algum ramo ficou de fora. */
  truncated: boolean;
}

interface Branch {
  rootId: string;
  /** Raiz primeiro, depois descendentes em ordem de leitura. */
  members: AssemblyRow[];
  bytes: number;
  /** Sort-key da raiz — é por ela que o cursor retoma. */
  rootSortKey: string;
}

/**
 * Agrupa as linhas por ramo de raiz, preservando a ordem de leitura.
 *
 * Linha cujo pai não veio na consulta é **descartada**, não promovida a raiz:
 * promover inventaria hierarquia que o banco não afirma, e é justamente o filho
 * órfão que o aceite proíbe. Pai ausente aqui significa que a query recortou o
 * conjunto — o ramo correto virá pela expansão daquele `more`.
 */
function groupIntoBranches(rows: readonly AssemblyRow[]): Branch[] {
  const branches: Branch[] = [];
  const byRoot = new Map<string, Branch>();
  /** id do comentário → id da raiz do ramo dele. */
  const rootOf = new Map<string, string>();

  for (const row of rows) {
    if (row.parent_id === null) {
      const branch: Branch = {
        rootId: row.id,
        members: [row],
        bytes: row.size_bytes,
        rootSortKey: row.sort_key,
      };
      branches.push(branch);
      byRoot.set(row.id, branch);
      rootOf.set(row.id, row.id);
      continue;
    }

    const rootId = rootOf.get(row.parent_id);
    if (rootId === undefined) continue; // pai ausente: descarta, nunca promove

    const branch = byRoot.get(rootId);
    if (branch === undefined) continue;

    branch.members.push(row);
    branch.bytes += row.size_bytes;
    rootOf.set(row.id, rootId);
  }

  return branches;
}

/**
 * Monta a árvore respeitando o teto.
 *
 * Um ramo entra **inteiro ou não entra** — exceto quando ele sozinho já estoura
 * o teto. Nesse caso o ramo é **truncado no limite**, servindo o prefixo que
 * cabe e adiando o resto num `more` do próprio ramo.
 *
 * O teto é rígido, não uma meta: a decisão 3 diz que "uma thread **não pode
 * consumir memória sem teto** no `accounts.`, que **também sustenta o SSO**".
 * Servir uma raiz gigante inteira "porque é a primeira" derrubaria o login de
 * todos os apps por causa de uma thread — que é precisamente o risco que o cap
 * existe para conter.
 *
 * Truncar o prefixo é seguro para o invariante de órfão porque a ordem de
 * leitura põe todo pai antes dos seus descendentes: um prefixo dessa ordem é
 * sempre uma subárvore fechada no topo.
 */
/** Orçamento consumido pelos ramos já servidos. */
interface Budget {
  comments: number;
  bytes: number;
}

/** Um ramo cabe inteiro quando nem a contagem nem o tamanho estouram. */
function branchFits(branch: Branch, used: Budget, maxComments: number, maxBytes: number): boolean {
  return (
    used.comments + branch.members.length <= maxComments
    && used.bytes + branch.bytes <= maxBytes
  );
}

/**
 * Serve o maior prefixo do ramo que cabe no orçamento restante.
 *
 * Usado só no ramo que sozinho estoura o teto. Prefixo da ordem de leitura
 * nunca orfana, porque essa ordem põe todo pai antes dos descendentes — então
 * um prefixo dela é sempre subárvore fechada no topo.
 */
function takePrefix(
  branch: Branch,
  maxComments: number,
  maxBytes: number,
): { ids: string[]; comments: number; bytes: number } {
  const ids: string[] = [];
  let bytes = 0;

  for (const member of branch.members) {
    if (ids.length + 1 > maxComments || bytes + member.size_bytes > maxBytes) break;
    ids.push(member.id);
    bytes += member.size_bytes;
  }

  return { ids, comments: ids.length, bytes };
}

/**
 * Colapsa os `more` acumulados no formato final.
 *
 * `more` de ramo truncado (`parent_id` da raiz) é preservado como está: aponta
 * para dentro daquele ramo, e agregá-lo à continuação das raízes perderia a
 * informação de onde retomar. Já as raízes adiadas consecutivas viram um único
 * `more` de continuação — o cliente pede "o resto a partir daqui", não ramo a
 * ramo.
 */
function collapseMore(more: readonly MoreNode[], lastServedRootSortKey: string): MoreNode[] {
  const branchMore = more.filter((node) => node.parent_id !== null);
  const rootMore = more.filter((node) => node.parent_id === null);

  if (rootMore.length === 0) return branchMore;

  return [
    ...branchMore,
    {
      parent_id: null,
      count: rootMore.reduce((total, node) => total + node.count, 0),
      after: lastServedRootSortKey,
    },
  ];
}

export function assembleTree({
  rows,
  maxComments = MAX_COMMENTS_PER_READ,
  maxBytes = MAX_BYTES_PER_READ,
}: AssemblyInput): AssemblyResult {
  const branches = groupIntoBranches(rows);

  const included: string[] = [];
  const more: MoreNode[] = [];
  const used: Budget = { comments: 0, bytes: 0 };
  let cutting = false;
  /** Sort-key da última raiz servida — é daí que a continuação retoma. */
  let lastServedRootSortKey = '';

  for (const branch of branches) {
    // Depois do primeiro corte, todo ramo seguinte é adiado — servir um ramo
    // posterior porque "é pequeno" quebraria a ordem e faria a expansão
    // duplicar ou pular item.
    //
    // Um ramo que não cabe depois de já termos servido algo cai no mesmo caso:
    // o cliente tem conteúdo para renderizar e o `more` dá o caminho adiante.
    const fits = !cutting && branchFits(branch, used, maxComments, maxBytes);

    if (fits) {
      for (const member of branch.members) included.push(member.id);
      used.comments += branch.members.length;
      used.bytes += branch.bytes;
      lastServedRootSortKey = branch.rootSortKey;
      continue;
    }

    const truncaEsteRamo = !cutting && included.length === 0;
    cutting = true;

    if (!truncaEsteRamo) {
      more.push({
        parent_id: null,
        count: branch.members.length,
        after: lastServedRootSortKey,
      });
      continue;
    }

    // Primeiro ramo estourando sozinho: trunca no teto em vez de servir inteiro
    // (decisão 3 — sem memória sem teto) ou de devolver nada (cliente sem
    // conteúdo e sem progresso).
    const prefix = takePrefix(branch, maxComments, maxBytes);
    included.push(...prefix.ids);
    used.comments += prefix.comments;
    used.bytes += prefix.bytes;

    // A raiz truncada é a última servida na ordem de leitura, então é dela que
    // a continuação das raízes retoma (achado de review, PR #245). Sem esta
    // linha `lastServedRootSortKey` seguia `''`, e todo ramo posterior emitia
    // `more.after: ''` — que o banco lê como "desde o começo", devolvendo a
    // árvore inteira de novo em vez do resto.
    lastServedRootSortKey = branch.rootSortKey;

    const remaining = branch.members.length - prefix.comments;
    if (remaining > 0) {
      more.push({
        parent_id: branch.rootId,
        count: remaining,
        after:
          prefix.comments === 0
            ? branch.rootSortKey
            : branch.members[prefix.comments - 1].sort_key,
      });
    }
  }

  const collapsed = collapseMore(more, lastServedRootSortKey);

  return { included, more: collapsed, truncated: collapsed.length > 0 };
}
