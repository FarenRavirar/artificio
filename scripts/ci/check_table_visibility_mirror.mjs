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
// A dupla 1↔2 já tem trava: `tableVisibility.equivalence.test.ts`, que executa as duas
// contra Postgres real. **O espelho (3) não é comparado por ninguém**, e o próprio
// arquivo admite estar divergente ("segue divergente porque unificá-lo exige um pacote
// compartilhado que ainda não existe").
//
// E a trava existente tem um limite medido: ela é `describe.skipIf(!MESAS_TEST_DATABASE_URL)`.
// No CI, que não sobe banco para o `mesas`, ela se declara ausente em vez de falhar —
// então hoje NENHUM gate obrigatório compara as formas da regra.
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
function extrairCorpo(fonte, nome) {
  const assinatura = new RegExp(`export function ${nome}\\s*\\(`);
  const inicio = fonte.search(assinatura);
  if (inicio === -1) return null;

  const abreParen = fonte.indexOf("(", inicio);
  if (abreParen === -1) return null;

  let paren = 0;
  let fimParams = -1;
  for (let i = abreParen; i < fonte.length; i += 1) {
    if (fonte[i] === "(") paren += 1;
    else if (fonte[i] === ")") {
      paren -= 1;
      if (paren === 0) {
        fimParams = i;
        break;
      }
    }
  }
  if (fimParams === -1) return null;

  const abre = fonte.indexOf("{", fimParams);
  if (abre === -1) return null;

  let profundidade = 0;
  for (let i = abre; i < fonte.length; i += 1) {
    if (fonte[i] === "{") profundidade += 1;
    else if (fonte[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return fonte.slice(abre, i + 1);
    }
  }
  return null;
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
    const corpoBackend = extrairCorpo(fonteBackend, nome);
    const corpoFrontend = extrairCorpo(fonteFrontend, nome);

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
