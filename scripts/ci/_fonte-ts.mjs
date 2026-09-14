// Leitura estrutural de fonte TypeScript para os guards de CI.
//
// ## Por que existe
//
// Três guards (`check_post_canonical`, `check_jsonld_price_source`,
// `check_table_visibility_mirror`) precisam recortar uma função ou um objeto literal do
// código e inspecionar o texto. Cada um nasceu com a própria cópia do algoritmo, e as
// cópias divergiram: `fecharPar` e `indiceDoFechamento` eram a MESMA função com nomes
// diferentes, e `neutralizarNaoCodigo` foi duplicada byte a byte em dois arquivos
// (medido: 39 linhas idênticas; Sonar acusou 14,4% e 13,9% de duplicação).
//
// O problema não é o número do Sonar — é o que a duplicação fez antes. O bug que estas
// funções corrigem (contar `}` dentro de comentário) existia nos DOIS guards, e foi
// corrigido em um e esquecido no outro até alguém medir. Helper duplicado é regra
// duplicada, e regra duplicada diverge: é a mesma razão pela qual
// `check_table_visibility_mirror` existe.
//
// ## O que estas funções NÃO são
//
// Não são um parser de TypeScript. Cobrem comentário de linha, comentário de bloco,
// aspas simples/duplas e template literal — o que os arquivos inspecionados usam hoje.
// Regex literal (`/.../`) não é tratada: não ocorre nos alvos atuais, e se passar a
// ocorrer, o caminho é um parser de verdade, não um remendo aqui.

/**
 * Índice do delimitador que FECHA o par aberto em `inicio`, ou `-1`.
 *
 * Conta profundidade de `abertura`/`fechamento` a partir de `inicio`. Roda sobre a
 * fonte NEUTRALIZADA — passar a fonte crua é o defeito que este módulo existe para
 * evitar.
 */
export function fecharPar(fonte, inicio, abertura, fechamento) {
  let profundidade = 0;
  for (let i = inicio; i < fonte.length; i += 1) {
    if (fonte[i] === abertura) profundidade += 1;
    else if (fonte[i] === fechamento) {
      profundidade -= 1;
      if (profundidade === 0) return i;
    }
  }
  return -1;
}

/**
 * Mesma fonte, com comentários e literais substituídos por espaço — posições e
 * comprimento preservados, para que todo índice calculado aqui valha na fonte original.
 *
 * Por que existe: contar chaves na fonte crua faz uma `}` dentro de comentário ou string
 * fechar o corpo cedo, e o guard passa a inspecionar um PEDAÇO da função. Medido nos
 * dois guards (achado P2 do Codex, PR #320, reproduzido): com `// }` presente e uma
 * divergência real depois do corte, ambos devolviam OK com exit 0 — inoperantes em
 * silêncio, que é o pior modo de falha para um guard.
 *
 * Preservar posição é o ponto: quem chama calcula índices aqui e fatia a fonte original,
 * então o texto devolvido ao guard continua sendo o código real, com comentários.
 */
export function neutralizarNaoCodigo(fonte) {
  const saida = fonte.split("");
  let i = 0;
  const apagarAte = (fim) => {
    for (; i < fim && i < fonte.length; i += 1) {
      if (fonte[i] !== "\n") saida[i] = " ";
    }
  };

  while (i < fonte.length) {
    const c = fonte[i];
    const prox = fonte[i + 1];

    if (c === "/" && prox === "/") {
      const fim = fonte.indexOf("\n", i);
      apagarAte(fim === -1 ? fonte.length : fim);
      continue;
    }
    if (c === "/" && prox === "*") {
      const fim = fonte.indexOf("*/", i + 2);
      apagarAte(fim === -1 ? fonte.length : fim + 2);
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const aspas = c;
      let j = i + 1;
      while (j < fonte.length) {
        if (fonte[j] === "\\") j += 2;
        else if (fonte[j] === aspas) break;
        else j += 1;
      }
      apagarAte(Math.min(j + 1, fonte.length));
      continue;
    }
    i += 1;
  }

  return saida.join("");
}

/**
 * Corpo da função `nome` (`{ … }` incluído), ou `null`.
 *
 * `exportada: true` exige `export function`; `false` aceita qualquer `function`.
 *
 * **A primeira `{` depois da assinatura NÃO é o corpo** quando o parâmetro tem tipo
 * inline (`table: { created_at: DateValue; … }`): pegá-la faz o guard comparar
 * DECLARAÇÃO DE TIPO em vez de lógica, e acusar divergência legítima — o backend recebe
 * `Date | string` do Kysely, o frontend recebe JSON e sempre `string`. Por isso fecha a
 * lista de parâmetros contando parênteses, pula o tipo de retorno, e só a `{` seguinte
 * é o corpo.
 */
export function extrairCorpo(fonte, nome, { exportada = false } = {}) {
  const busca = neutralizarNaoCodigo(fonte);

  // `String.raw` para o padrão não virar escape duplo (`\\s` lido como `\s`) — a forma
  // com barras duplicadas funciona, mas é onde se erra ao editar depois.
  const prefixo = exportada ? "export function" : "function";
  const assinatura = new RegExp(String.raw`${prefixo} ${nome}\s*\(`);
  const inicio = busca.search(assinatura);
  if (inicio === -1) return null;

  const abreParen = busca.indexOf("(", inicio);
  if (abreParen === -1) return null;

  const fimParams = fecharPar(busca, abreParen, "(", ")");
  if (fimParams === -1) return null;

  const abre = busca.indexOf("{", fimParams);
  if (abre === -1) return null;

  const fecha = fecharPar(busca, abre, "{", "}");
  return fecha === -1 ? null : fonte.slice(abre, fecha + 1);
}

/**
 * Corpo do objeto literal atribuído a `propriedade` (`{ … }`), ou `null`.
 *
 * Existe porque procurar uma chave no corpo inteiro de uma função aceita qualquer
 * ocorrência solta: medido em `buildTableJsonLd` com `const decoy = { price }` ao lado
 * de `offers.price: '999'` — o guard devolvia OK com preço fixo publicado.
 */
export function extrairObjeto(fonte, propriedade) {
  const busca = neutralizarNaoCodigo(fonte);
  const chave = new RegExp(String.raw`\b${propriedade}\s*:\s*\{`);
  const inicio = busca.search(chave);
  if (inicio === -1) return null;

  const abre = busca.indexOf("{", inicio);
  if (abre === -1) return null;

  const fecha = fecharPar(busca, abre, "{", "}");
  return fecha === -1 ? null : fonte.slice(abre, fecha + 1);
}
