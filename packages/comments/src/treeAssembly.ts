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
export function assembleTree({
  rows,
  maxComments = MAX_COMMENTS_PER_READ,
  maxBytes = MAX_BYTES_PER_READ,
}: AssemblyInput): AssemblyResult {
  const branches = groupIntoBranches(rows);

  const included: string[] = [];
  const more: MoreNode[] = [];
  let usedComments = 0;
  let usedBytes = 0;
  let cutting = false;
  /** Sort-key da última raiz servida — é daí que a continuação retoma. */
  let lastServedRootSortKey = '';

  for (const branch of branches) {
    if (cutting) {
      // Depois do primeiro corte, todo ramo seguinte é adiado — servir um ramo
      // posterior porque "é pequeno" quebraria a ordem e faria a expansão
      // duplicar ou pular item.
      more.push({
        parent_id: null,
        count: branch.members.length,
        after: lastServedRootSortKey,
      });
      continue;
    }

    const fitsCount = usedComments + branch.members.length <= maxComments;
    const fitsBytes = usedBytes + branch.bytes <= maxBytes;

    if (fitsCount && fitsBytes) {
      for (const member of branch.members) included.push(member.id);
      usedComments += branch.members.length;
      usedBytes += branch.bytes;
      lastServedRootSortKey = branch.rootSortKey;
      continue;
    }

    cutting = true;

    // Ramo que não cabe depois de já termos servido algo é adiado inteiro: o
    // cliente tem conteúdo para renderizar e o `more` dá o caminho adiante.
    if (included.length > 0) {
      more.push({
        parent_id: null,
        count: branch.members.length,
        after: lastServedRootSortKey,
      });
      continue;
    }

    // Primeiro ramo estourando sozinho: trunca no teto em vez de servir inteiro
    // (decisão 3 — sem memória sem teto) ou de devolver nada (cliente sem
    // conteúdo e sem progresso). Prefixo da ordem de leitura nunca orfana.
    let taken = 0;
    let takenBytes = 0;
    for (const member of branch.members) {
      if (taken + 1 > maxComments || takenBytes + member.size_bytes > maxBytes) break;
      included.push(member.id);
      taken += 1;
      takenBytes += member.size_bytes;
    }

    usedComments += taken;
    usedBytes += takenBytes;

    const remaining = branch.members.length - taken;
    if (remaining > 0) {
      more.push({
        parent_id: branch.rootId,
        count: remaining,
        after: taken === 0 ? branch.rootSortKey : branch.members[taken - 1].sort_key,
      });
    }
  }

  // `more` de ramo truncado (`parent_id` da raiz) é preservado como está: ele
  // aponta para dentro daquele ramo, e agregá-lo à continuação das raízes
  // perderia a informação de onde retomar.
  const branchMore = more.filter((node) => node.parent_id !== null);
  const rootMore = more.filter((node) => node.parent_id === null);

  // Já as raízes adiadas consecutivas viram um único `more` de continuação: o
  // cliente pede "o resto a partir daqui", não ramo a ramo.
  const collapsed: MoreNode[] = [
    ...branchMore,
    ...(rootMore.length === 0
      ? []
      : [
          {
            parent_id: null,
            count: rootMore.reduce((total, node) => total + node.count, 0),
            after: lastServedRootSortKey,
          },
        ]),
  ];

  return { included, more: collapsed, truncated: collapsed.length > 0 };
}
