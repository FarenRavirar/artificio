#!/usr/bin/env node
// G-E (spec 102, T5.2) — trava a QUARTA divergência da regra de visibilidade de mesa.
//
// ## Por que existe
//
// "Mesa visível" está escrita em três formas, de propósito:
//
//   1. `apps/mesas/backend/src/utils/tableVisibility.ts`  — predicado sobre objeto
//   2. o `importedTableIsCurrentSql` do mesmo arquivo      — predicado dentro do `where`
//   3. `apps/mesas/frontend/src/utils/tableVisibility.ts` — ESPELHO no frontend
//
// A dupla 1↔2 já tem trava ATIVA: `tableVisibility.equivalence.test.ts` executa as duas
// contra Postgres real, e o `ci.yml` fornece `MESAS_TEST_DATABASE_URL` no passo "Mesas
// visibility equivalence on PostgreSQL 16" — o `describe.skipIf` só desliga o teste
// localmente, nunca no CI. Isso foi um achado de review da PR #315 e já está resolvido.
//
// **O que NENHUM gate cobria é o espelho (3)**, e só ele: vive em outra raiz de build e
// o próprio arquivo admite estar divergente ("segue divergente porque unificá-lo exige
// um pacote compartilhado que ainda não existe"). Este guard cobre esse lado, e não
// substitui nem duplica o teste de equivalência.
//
// A regra já divergiu TRÊS vezes em produção:
//   - detalhe ↔ Open Graph (achado CodeRabbit, spec 059/060)
//   - sitemap ↔ SSR (spec 102 T1.4: 51 de 92 URLs anunciadas eram soft-404)
//   - o espelho do frontend, ainda hoje
//
// Corrigir as três sem travar a quarta é consertar sintoma — exatamente o que esta
// spec existe para não fazer.
//
// ## Por que comparação estática, e não teste
//
// O espelho vive em outra raiz de build (frontend), e importá-lo do backend não compila.
// Um teste teria de duplicar a regra uma quarta vez para comparar — o defeito de novo.
// Este guard compara o TEXTO NORMALIZADO das funções espelhadas: se alguém editar um
// lado e não o outro, os corpos deixam de bater e o CI falha nomeando a função.
//
// Não valida semântica — isso é trabalho do teste de equivalência contra Postgres.
// Valida que as duas cópias continuam sendo a MESMA cópia, que é o que falhou 3 vezes.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extrairCorpo } from "./_fonte-ts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const BACKEND = "apps/mesas/backend/src/utils/tableVisibility.ts";
const FRONTEND = "apps/mesas/frontend/src/utils/tableVisibility.ts";

/**
 * Funções que existem NAS DUAS raízes e precisam permanecer idênticas.
 *
 * `isPublicTable`, `classifyTablePublicDisposition` e `importedTableIsCurrentSql` são
 * só do backend — o frontend não decide resposta HTTP nem monta query. Cobrá-las aqui
 * produziria falso-positivo permanente.
 */
const FUNCOES_ESPELHADAS = ["importedTableExpiryDate", "isImportedTableExpired"];

/**
 * Identificadores que os corpos espelhados podem chamar sem que este guard exija prova.
 *
 * Tudo o que NÃO está aqui e é chamado no corpo precisa ser, ele mesmo, uma função
 * espelhada e comparada — senão a comparação de texto vira teatro: dois corpos
 * idênticos delegando a helpers locais que devolvem valores diferentes passam verdes.
 *
 * **Furo real, reproduzido antes de existir esta lista** (achado P2 do Codex na PR
 * #320): extraindo `limite5Dias.getDate() + 5` para um `expiryDays()` local em cada
 * raiz — `5` no backend, `7` no frontend — os corpos ficam iguais ao byte e o guard
 * saía `G-E OK`, exit 0. A regra divergia em 2 dias sem nada falhar.
 *
 * Globais de plataforma entram porque são idênticos por definição nas duas raízes.
 */
const CHAMADAS_PERMITIDAS = new Set([
  "Date",
  "Number",
  "isNaN",
  "getTime",
  "getDate",
  "setDate",
  // Espelhada e comparada por este mesmo guard — delegar a ela é seguro.
  "importedTableExpiryDate",
]);

/**
 * Sintaxe da linguagem, não dependência. Fica separado de CHAMADAS_PERMITIDAS de
 * propósito: aquela lista é decisão sobre REGRA (o que pode ficar fora da comparação),
 * esta é só ruído do parser grosseiro. Misturar as duas faria a lista de regra crescer
 * com entradas que ninguém precisa justificar.
 */
const PALAVRAS_CHAVE = new Set([
  "if",
  "else",
  "for",
  "of",
  "in",
  "return",
  "switch",
  "case",
  "while",
  "do",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "new",
  "const",
  "let",
  "var",
  "function",
  "true",
  "false",
  "null",
  "undefined",
]);

/** Único parâmetro das funções espelhadas; não é dependência externa. */
const PARAMETRO = "table";

const failures = [];

function lerArquivo(caminhoRelativo) {
  try {
    return readFileSync(resolve(ROOT, caminhoRelativo), "utf8");
  } catch (error) {
    // Guard que morre na leitura não protege nada, e falha por motivo que não é
    // violação de contrato. Aconteceu nesta mesma spec: `check_ingress_realip_contract`
    // lia um `nginx.conf` removido e morria com ENOENT antes da primeira asserção,
    // desativando 14 checks em silêncio (commit b7a03ed → corrigido em 3d6ff5c).
    failures.push(
      `${caminhoRelativo}: não foi possível ler (${error.code ?? error.message}). ` +
        `Se o arquivo mudou de lugar, atualize este guard — não o remova.`,
    );
    return null;
  }
}

/**
 * Extrai o corpo de `export function <nome>(...) { ... }` por contagem de chaves.
 *
 * Regex sozinha não fecha o corpo certo: a função tem `if` aninhado e template com
 * chave. Contar abre/fecha é o que sobrevive a isso.
 *
 * **A primeira `{` depois da assinatura NÃO é o corpo** — nestas funções ela abre o
 * tipo inline do parâmetro (`table: { created_at: DateValue; … }`). Pegá-la fazia o
 * guard comparar DECLARAÇÃO DE TIPO em vez de lógica, e acusar divergência onde há
 * diferença legítima: o backend recebe `Date | string` do Kysely, o frontend recebe
 * JSON e sempre `string`. Medido ao escrever este guard — ele nasceu vermelho por
 * isso, com o código dos dois lados idêntico.
 *
 * Então: fecha a lista de parâmetros contando parênteses, pula o tipo de retorno, e
 * só a `{` seguinte é o corpo.
 */
/**
 * `extrairCorpo` vem de `_fonte-ts.mjs` — compartilhado com os outros guards.
 *
 * Estas funções viveram duplicadas aqui e no `check_jsonld_price_source` (medido: 39
 * linhas idênticas byte a byte; Sonar acusou 13,9% de duplicação). O custo real não foi
 * o número: o bug de contar `}` dentro de comentário existia nos DOIS, e foi corrigido
 * em um e esquecido no outro até alguém medir. Helper duplicado é regra duplicada — a
 * mesma razão pela qual ESTE guard existe.
 */

/**
 * Identificadores chamados como função dentro do corpo, menos os permitidos.
 *
 * Roda sobre o corpo JÁ SEM COMENTÁRIO — senão `isImportedTableExpired` citado em
 * prosa viraria falso-positivo. O padrão casa `nome(` e `.metodo(`; `new Date(...)`
 * entra como `Date`, que está na lista de permitidos.
 *
 * Deliberadamente grosseiro: não é parser de TypeScript. Falso-positivo aqui custa uma
 * entrada em CHAMADAS_PERMITIDAS, com o motivo escrito ao lado — e esse custo é o
 * ponto, porque obriga quem adiciona a justificar por que aquela chamada não precisa
 * ser comparada. Falso-NEGATIVO é o que este guard existe para não ter.
 */
function chamadasNaoVerificadas(corpo) {
  const semComentario = corpo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const encontradas = new Set();

  for (const [, nome] of semComentario.matchAll(/\.?\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!CHAMADAS_PERMITIDAS.has(nome)) encontradas.add(nome);
  }

  // Identificador NÃO chamado divergia igual: extraindo o prazo para um `EXPIRY_DAYS`
  // local em cada raiz (5 no backend, 7 no frontend), os corpos ficavam idênticos e o
  // guard passava verde — a checagem só olhava `nome(`. Achado P2 do Codex na PR #320,
  // segunda rodada sobre a mesma classe de furo (a primeira foi o helper chamado).
  //
  // Qualquer identificador livre que não seja declarado no corpo, parâmetro, propriedade
  // (`x.y`), palavra-chave ou permitido é dependência externa não verificada.
  const declaradosNoCorpo = new Set();
  for (const [, nome] of semComentario.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    declaradosNoCorpo.add(nome);
  }

  // Literal de string é conteúdo, não identificador: `table.origin !== 'imported'` fazia
  // o guard exigir que `imported` fosse espelhado. Sai antes da varredura, junto com as
  // propriedades (`x.y`), que também não são referência livre.
  const semLiterais = semComentario
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

  const semPropriedades = semLiterais.replace(/\.\s*[A-Za-z_$][\w$]*/g, "");
  for (const [, nome] of semPropriedades.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (PALAVRAS_CHAVE.has(nome)) continue;
    if (declaradosNoCorpo.has(nome)) continue;
    if (nome === PARAMETRO) continue;
    if (CHAMADAS_PERMITIDAS.has(nome)) continue;
    encontradas.add(nome);
  }

  // `if`/`for`/`return`/`switch`/`while`/`catch` casam o padrão mas são palavras-chave,
  // não chamadas. Listá-las aqui em vez de em CHAMADAS_PERMITIDAS mantém aquela lista
  // como o que ela é: decisão sobre REGRA, não sobre sintaxe.
  for (const palavraChave of ["if", "for", "return", "switch", "while", "catch", "typeof"]) {
    encontradas.delete(palavraChave);
  }

  return [...encontradas];
}

/**
 * Normaliza o que é legitimamente diferente entre as duas raízes, e só isso.
 *
 * Comentários saem porque cada lado explica o próprio contexto (o do frontend cita o
 * botão "Copiar anúncio"; o do backend, a rota pública). Espaço colapsa porque
 * formatação não é semântica. O que NÃO se normaliza é nome de variável, operador,
 * ordem de comparação ou literal — é exatamente aí que a divergência mora.
 */
function normalizar(corpo) {
  return corpo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const fonteBackend = lerArquivo(BACKEND);
const fonteFrontend = lerArquivo(FRONTEND);

if (fonteBackend && fonteFrontend) {
  for (const nome of FUNCOES_ESPELHADAS) {
    // `exportada: true`: as funções espelhadas são `export function` nos dois lados, e
    // exigir o `export` evita casar uma homônima interna que não é a regra comparada.
    const corpoBackend = extrairCorpo(fonteBackend, nome, { exportada: true });
    const corpoFrontend = extrairCorpo(fonteFrontend, nome, { exportada: true });

    if (!corpoBackend) {
      failures.push(`${nome}: não encontrada em ${BACKEND}.`);
      continue;
    }
    if (!corpoFrontend) {
      failures.push(
        `${nome}: não encontrada em ${FRONTEND}. O espelho existe para o frontend não ` +
          `reimplementar a regra — se a função saiu, ou ela virou pacote compartilhado ` +
          `(atualize este guard) ou o espelho foi perdido.`,
      );
      continue;
    }

    // Delegação a helper não verificado torna a comparação de texto inútil (ver
    // CHAMADAS_PERMITIDAS). Checa os DOIS lados: basta um deles delegar para que
    // corpos idênticos deixem de provar regra idêntica.
    for (const [raiz, corpo] of [
      [BACKEND, corpoBackend],
      [FRONTEND, corpoFrontend],
    ]) {
      for (const chamada of chamadasNaoVerificadas(corpo)) {
        failures.push(
          `${nome} (${raiz}): depende de \`${chamada}\`, que este guard não compara.\n` +
            `    Corpo idêntico ao do outro lado NÃO prova regra idêntica quando parte dela\n` +
            `    vive num helper OU numa constante local — medido nos dois casos, com os\n` +
            `    corpos iguais ao byte e os valores divergindo (5 vs 7 dias).\n` +
            `    Ou espelhe \`${chamada}\` e adicione-a a FUNCOES_ESPELHADAS, ou — se for\n` +
            `    global de plataforma — a CHAMADAS_PERMITIDAS.`,
        );
      }
    }

    if (normalizar(corpoBackend) !== normalizar(corpoFrontend)) {
      failures.push(
        `${nome}: corpo DIVERGE entre backend e o espelho do frontend.\n` +
          `    backend:  ${BACKEND}\n` +
          `    espelho:  ${FRONTEND}\n` +
          `    A regra de visibilidade já divergiu 3x em produção (spec 059/060, ` +
          `spec 102 T1.4, e o próprio espelho). Sincronize os dois lados ou promova a ` +
          `regra a pacote compartilhado — não silencie este guard.`,
      );
    }
  }

  // O espelho existe SÓ enquanto não há pacote compartilhado. Se um dia houver, este
  // guard deve morrer junto com a duplicação — e não sobreviver comparando duas cópias
  // que já não precisavam existir.
  if (!fonteFrontend.includes("ESPELHO de apps/mesas/backend")) {
    failures.push(
      `${FRONTEND}: perdeu o cabeçalho que o declara espelho do backend. Esse comentário ` +
        `é o que avisa o próximo editor de que existe outra cópia (AGENTS.md §Regras ` +
        `Gerais de Código — comentário que explica decisão não se apaga).`,
    );
  }
}

if (failures.length > 0) {
  console.error("G-E — espelho da regra de visibilidade de mesa DIVERGIU:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `G-E OK — ${FUNCOES_ESPELHADAS.length} funções idênticas entre backend e espelho do frontend.`,
);
