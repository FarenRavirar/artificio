// Leitura ESTRUTURAL de fonte TypeScript para os guards de CI, via AST.
//
// ## Por que AST, e não regex
//
// Estes helpers já existiram como casamento de texto, e a abordagem não convergiu.
// Medido em 2026-09-14, três rodadas do Codex na PR #320, todas na mesma classe de furo:
//
//   1ª  `price` procurado no corpo inteiro de `buildTableJsonLd`  → recortei `offers`
//   2ª  `}` dentro de comentário fechava o corpo cedo             → neutralizei literais
//   3ª  `price` dentro de objeto ANINHADO em `offers`             → (seria outra regex)
//
// O padrão era o método, não o descuido: cada correção era uma regex mais específica, e
// a rodada seguinte achava o caso que ela não cobria. Reproduzido antes desta reescrita:
// `offers: { decoy: { price } }` devolvia `G-F OK` exit 0; e `EXPIRY_DAYS` divergente
// usado via `${...}` em template literal passava pelo G-E, porque a neutralização apagava
// o literal inteiro, interpolação junto.
//
// A causa era responder perguntas ESTRUTURAIS com texto: "esta propriedade é filha
// DIRETA de `offers`?", "este identificador é referência livre?", "onde termina o corpo
// desta função?". Cada resposta correta exigia mais um caso especial, e o espaço de casos
// não é finito.
//
// Com AST as três viram exatas por construção: propriedade direta é filha do
// `ObjectLiteralExpression`, identificador livre sai do escopo real, e o corpo é o nó.
//
// `typescript` já é devDependency de `scripts/` — não é pacote novo. O mesmo recurso já é
// usado por `scripts/check-test-typecheck-coverage.test.mjs`.

import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

/**
 * AST de um arquivo TS/TSX. `isTsx` importa para `.tsx`, onde `<T>` é JSX, não cast.
 *
 * Sem type-checker de propósito: o programa completo exigiria resolver o projeto inteiro
 * (tsconfig, node_modules, paths) por guard, e nenhuma pergunta aqui precisa de tipos —
 * todas são sintáticas.
 */
export function parseFonte(codigo, { isTsx = false } = {}) {
  return ts.createSourceFile(
    isTsx ? "fonte.tsx" : "fonte.ts",
    codigo,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Percorre todos os nós descendentes, incluindo o próprio. */
function* percorrer(node) {
  yield node;
  for (const filho of node.getChildren()) yield* percorrer(filho);
}

/**
 * Declaração da função `nome`, ou `null`.
 *
 * `exportada: true` exige o modificador `export` — evita casar uma homônima interna que
 * não é a regra comparada.
 */
export function acharFuncao(sourceFile, nome, { exportada = false } = {}) {
  for (const node of percorrer(sourceFile)) {
    if (!ts.isFunctionDeclaration(node)) continue;
    if (node.name?.text !== nome) continue;
    if (exportada) {
      const temExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!temExport) continue;
    }
    return node;
  }
  return null;
}

/**
 * Texto do corpo (`{ … }`) da função `nome`, ou `null`.
 *
 * Substitui a contagem de chaves: o corpo é o nó `body`, então `}` em comentário ou
 * string não fecha nada cedo, e o tipo inline do parâmetro (`table: { … }`) nunca é
 * confundido com o corpo — era um defeito real da versão por texto.
 */
export function extrairCorpo(codigo, nome, { exportada = false, isTsx = false } = {}) {
  const fn = acharFuncao(parseFonte(codigo, { isTsx }), nome, { exportada });
  return fn?.body ? fn.body.getText() : null;
}

/**
 * Nomes das propriedades DIRETAS do objeto literal atribuído a `propriedade`.
 *
 * "Direta" é a palavra operante, e é o que a regex não sabia dizer: em
 * `offers: { decoy: { price } }` o `price` é neto, não filho, e a versão por texto o
 * aceitava como se fosse a propriedade da oferta (medido: `G-F OK` exit 0 com a oferta
 * publicando valor errado).
 *
 * Devolve `null` quando a propriedade não existe ou não é objeto literal — quem chama
 * distingue "estrutura mudou" de "propriedade ausente".
 */
export function propriedadesDiretas(node, propriedade) {
  const objeto = acharObjetoDe(node, propriedade);
  if (!objeto) return null;

  const nomes = new Set();
  for (const prop of objeto.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name) nomes.add(prop.name.getText());
    else if (ts.isShorthandPropertyAssignment(prop)) nomes.add(prop.name.getText());
  }
  return nomes;
}

/**
 * Valor atribuído à propriedade DIRETA `nome` dentro do objeto de `propriedade`.
 *
 * `price: precoDerivado` devolve o texto `precoDerivado`; `price` (shorthand) devolve
 * `price`. `null` quando a propriedade direta não existe.
 */
export function valorDaPropriedadeDireta(node, propriedade, nome) {
  const objeto = acharObjetoDe(node, propriedade);
  if (!objeto) return null;

  for (const prop of objeto.properties) {
    if (ts.isPropertyAssignment(prop) && prop.name?.getText() === nome) {
      return prop.initializer.getText();
    }
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.getText() === nome) {
      return prop.name.getText();
    }
  }
  return null;
}

/** Primeiro objeto literal atribuído a `propriedade` dentro de `node`. */
function acharObjetoDe(node, propriedade) {
  for (const n of percorrer(node)) {
    if (!ts.isPropertyAssignment(n)) continue;
    if (n.name?.getText() !== propriedade) continue;
    if (ts.isObjectLiteralExpression(n.initializer)) return n.initializer;
  }
  return null;
}

/**
 * Identificadores LIVRES do corpo: referências a algo declarado fora dele.
 *
 * Substitui a varredura por regex, que tinha dois furos medidos: apagava o template
 * literal inteiro (levando junto o que estava em `${...}` — uma constante divergente
 * usada assim passava despercebida) e não distinguía propriedade de referência.
 *
 * Aqui, o percurso é por nó: `x.y` só conta `x`, `{ price }` em shorthand conta `price`,
 * `` `${EXPIRY_DAYS}` `` conta `EXPIRY_DAYS`, e o que é declarado dentro do corpo
 * (`const`/`let`/`var`, parâmetros, funções locais) é excluído por escopo, não por lista.
 */
export function identificadoresLivres(fn) {
  const declarados = new Set();

  for (const p of fn.parameters) {
    for (const n of percorrer(p.name)) {
      if (ts.isIdentifier(n)) declarados.add(n.text);
    }
  }

  const corpo = fn.body;
  if (!corpo) return [];

  for (const node of percorrer(corpo)) {
    if (ts.isVariableDeclaration(node) && node.name) {
      for (const n of percorrer(node.name)) {
        if (ts.isIdentifier(n)) declarados.add(n.text);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) declarados.add(node.name.text);
  }

  const livres = new Set();
  for (const node of percorrer(corpo)) {
    if (!ts.isIdentifier(node)) continue;

    const pai = node.parent;
    // `x.y` → só `x` é referência; `y` é nome de propriedade.
    if (pai && ts.isPropertyAccessExpression(pai) && pai.name === node) continue;
    // `{ y: … }` → `y` é nome, não referência. O shorthand `{ y }` É referência.
    if (pai && ts.isPropertyAssignment(pai) && pai.name === node) continue;
    // Nome do próprio binding (`const y = …`, parâmetro, função local).
    if (pai && ts.isVariableDeclaration(pai) && pai.name === node) continue;
    if (pai && ts.isParameter(pai) && pai.name === node) continue;
    // Tipos não são valores: `table: DateValue` não é dependência de runtime.
    if (pai && ts.isTypeReferenceNode(pai)) continue;

    if (declarados.has(node.text)) continue;
    livres.add(node.text);
  }

  return [...livres];
}

/**
 * Texto do corpo normalizado para comparação estrutural entre duas raízes.
 *
 * O `getText()` de cada nó já vem sem comentário quando se reconstrói a partir da AST —
 * então o que resta normalizar é só espaço. Nome de variável, operador, ordem de
 * comparação e literal continuam íntegros: é exatamente aí que a divergência mora.
 */
export function corpoNormalizado(fn) {
  if (!fn?.body) return null;
  return fn.body
    .getText()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `true` quando o corpo tem `if (true)` ou `if (false)` — condição literal.
 *
 * Por nó, não por regex: `if (true)` escrito dentro de uma string ou comentário não
 * conta, e `if (true && x)` conta, porque o literal está na raiz da condição.
 */
export function condicoesLiterais(fn) {
  const achadas = [];
  if (!fn?.body) return achadas;

  for (const node of percorrer(fn.body)) {
    if (!ts.isIfStatement(node)) continue;
    const cond = node.expression;
    const literal = (e) =>
      e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword;

    if (literal(cond)) achadas.push(cond.getText());
    else if (ts.isBinaryExpression(cond) && (literal(cond.left) || literal(cond.right))) {
      achadas.push(literal(cond.left) ? cond.left.getText() : cond.right.getText());
    }
  }
  return achadas;
}

/**
 * `true` se o corpo lê `objeto.propriedade` em algum ponto.
 *
 * Por nó: uma menção em comentário ou string não conta, e `vm.price` não é confundido
 * com `vm.priceType` — a versão por regex precisava de lookahead para isso.
 */
export function lePropriedade(fn, objeto, propriedade) {
  if (!fn?.body) return false;

  for (const node of percorrer(fn.body)) {
    if (!ts.isPropertyAccessExpression(node)) continue;
    if (node.expression.getText() !== objeto) continue;
    if (node.name.text === propriedade) return true;
  }
  return false;
}

/**
 * Nome da variável que recebe `chamada(...)` dentro do corpo, ou `null`.
 *
 * `const price = priceForJsonLd(vm)` → `"price"`.
 */
export function variavelQueRecebe(fn, chamada) {
  if (!fn?.body) return null;

  for (const node of percorrer(fn.body)) {
    if (!ts.isVariableDeclaration(node)) continue;
    const init = node.initializer;
    if (!init || !ts.isCallExpression(init)) continue;
    if (init.expression.getText() !== chamada) continue;
    return node.name.getText();
  }
  return null;
}

export { ts };
