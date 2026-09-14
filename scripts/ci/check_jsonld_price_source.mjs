#!/usr/bin/env node
// G-F (spec 102, T5.2) — o `price` do JSON-LD tem de vir de `price_value`, nunca do
// rótulo do contato.
//
// ## O erro que este guard trava, e por que ele quase aconteceu
//
// Medido na investigação desta spec: o rótulo "Ticket / Inscrição" aparece em **106
// contatos**, e **101 dessas mesas são `price_type: 'gratuita'`**. Derivar preço do
// rótulo — que é a leitura "óbvia" para quem olha o dado de contato — publicaria
// ingresso pago em ~95% dos casos, em markup que a página não mostra. Isso é
// exatamente o perfil de divergência HTML↔schema que a ação manual de structured data
// pune (`sd-policies`: "Don't mark up content that is not visible to readers").
//
// A derivação certa já está em `priceForJsonLd` (`tableMeta.ts`), e ela deriva do
// `TableViewModel`, que por sua vez recebe `price: normalizeNumeric(table.price_value)`
// do mapper. O risco não é o código de hoje: é um refactor futuro do schema reintroduzir
// a derivação pelo rótulo, o que NÃO quebra teste nenhum — o JSON-LD continua válido,
// só mente.
//
// ## O que é verificado
//
// 1. `priceForJsonLd` lê `vm.price`/`vm.priceType` e NADA de contato/rótulo.
// 2. O `offers.price` do JSON-LD é alimentado por `priceForJsonLd`, e não por outra
//    expressão montada no lugar.
// 3. O mapper continua derivando `price` de `price_value` (a ponta de origem).
//
// Estático de propósito: o defeito é de ORIGEM DO DADO, e origem se lê no código. Um
// teste com fixture provaria o valor de hoje, não de onde ele vem — e o fixture seria
// escrito pela mesma pessoa que fizesse o refactor errado.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const TABLE_META = "apps/mesas/frontend/src/features/table/seo/tableMeta.ts";
const MAPPER = "packages/catalog-table/src/tableViewMapper.ts";

/**
 * Termos que denunciam derivação por rótulo de contato dentro do caminho do preço.
 *
 * São os nomes reais do dado que induz ao erro: o `label`/`kind` de `table_contacts` e
 * os rótulos que aparecem nele. Aparecer QUALQUER um deles dentro de `priceForJsonLd`
 * significa que o preço deixou de sair de `price_value`.
 */
const TERMOS_DE_CONTATO = [
  "contact",
  "contato",
  "label",
  "rotulo",
  "rótulo",
  "ticket",
  "inscri",
];

const failures = [];

function lerArquivo(caminhoRelativo) {
  try {
    return readFileSync(resolve(ROOT, caminhoRelativo), "utf8");
  } catch (error) {
    // Guard que morre na leitura não protege nada e falha por motivo que não é violação
    // de contrato — aconteceu nesta spec (`check_ingress_realip_contract` morrendo com
    // ENOENT num `nginx.conf` removido, desativando 14 checks em silêncio).
    failures.push(
      `${caminhoRelativo}: não foi possível ler (${error.code ?? error.message}). ` +
        `Se o arquivo mudou de lugar, atualize este guard — não o remova.`,
    );
    return null;
  }
}

/**
 * Corpo de `function <nome>(...) { ... }`, com ou sem `export`.
 *
 * Fecha a lista de parâmetros contando parênteses ANTES de procurar a `{` do corpo: a
 * primeira chave depois da assinatura costuma abrir o tipo inline do parâmetro, não o
 * corpo. Esse foi um defeito real do G-E, corrigido na PR #320 — mesma armadilha aqui.
 */
function extrairCorpo(fonte, nome) {
  const assinatura = new RegExp(String.raw`function ${nome}\s*\(`);
  const inicio = fonte.search(assinatura);
  if (inicio === -1) return null;

  const abreParen = fonte.indexOf("(", inicio);
  if (abreParen === -1) return null;

  const fimParams = fecharPar(fonte, abreParen, "(", ")");
  if (fimParams === -1) return null;

  const abre = fonte.indexOf("{", fimParams);
  if (abre === -1) return null;

  const fecha = fecharPar(fonte, abre, "{", "}");
  return fecha === -1 ? null : fonte.slice(abre, fecha + 1);
}

function fecharPar(fonte, inicio, abertura, fechamento) {
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

/** Remove comentário para não acusar termo citado em prosa explicativa. */
function semComentario(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const fonteMeta = lerArquivo(TABLE_META);
const fonteMapper = lerArquivo(MAPPER);

if (fonteMeta) {
  const corpo = extrairCorpo(fonteMeta, "priceForJsonLd");

  if (!corpo) {
    failures.push(
      `priceForJsonLd: não encontrada em ${TABLE_META}. Ela é a ÚNICA fonte autorizada ` +
        `do preço do JSON-LD — se foi renomeada ou removida, atualize este guard e ` +
        `confirme que o substituto também deriva de price_value.`,
    );
  } else {
    const codigo = semComentario(corpo);

    for (const termo of TERMOS_DE_CONTATO) {
      if (codigo.toLowerCase().includes(termo)) {
        failures.push(
          `priceForJsonLd: menciona \`${termo}\` — indício de preço derivado do RÓTULO ` +
            `DO CONTATO.\n` +
            `    "Ticket / Inscrição" está em 106 contatos, e 101 dessas mesas são ` +
            `gratuitas:\n` +
            `    derivar do rótulo publica ingresso pago em ~95% dos casos, divergente ` +
            `do HTML.\n` +
            `    O preço sai de price_value (vm.price / vm.priceType), e só dele.`,
        );
      }
    }

    // São DOIS ramos, e cada um precisa do seu dado. `vm.priceType` decide gratuita
    // (`'0'`); `vm.price` produz o valor da mesa paga. Aceitar um OU outro deixava
    // passar `if (vm.priceType === 'gratuita') return '0'; return '99.00'` — o
    // `vm.priceType` sobrevivia no corpo e o check passava verde com preço fixo em
    // toda mesa paga (achado do CodeRabbit, PR #320).
    if (!/\bvm\.priceType\b/.test(codigo)) {
      failures.push(
        `priceForJsonLd: não lê \`vm.priceType\`. É ele que separa mesa gratuita ` +
          `(\`'0'\`) de mesa paga — sem essa leitura, o ramo gratuito virou constante.`,
      );
    }

    if (!/\bvm\.price\b(?!Type)/.test(codigo)) {
      failures.push(
        `priceForJsonLd: não lê \`vm.price\`. O valor da mesa PAGA tem de sair do ` +
          `TableViewModel, que o deriva de price_value.\n` +
          `    Ler só \`vm.priceType\` cobre o ramo gratuito e publica valor fixo em ` +
          `toda mesa paga.`,
      );
    }

    // Presença do texto não prova que o dado DECIDE. Sabotando com `if (true) return '0'`
    // e `if (false) { … }`, as menções a `vm.price` continuavam no corpo e o check acima
    // passava verde — o preço já era constante. Medido ao validar este guard.
    //
    // Condição literal no caminho do preço é sempre defeito: ou o dado decide, ou o
    // valor é fixo e o schema mente sobre a mesa.
    for (const [, literal] of codigo.matchAll(/\bif\s*\(\s*(true|false)\s*[)&|]/g)) {
      failures.push(
        `priceForJsonLd: tem \`if (${literal})\` — o preço deixou de ser decidido pelo ` +
          `dado.\n` +
          `    Um ramo constante publica o mesmo preço para toda mesa, e as menções a ` +
          `vm.price\n` +
          `    sobrevivem no corpo sem decidir nada — foi assim que este guard passou ` +
          `verde numa\n` +
          `    sabotagem antes desta checagem existir.`,
      );
    }
  }

  // A função certa pode existir e o JSON-LD alimentar `offers.price` por outro caminho.
  // Sem isto, o guard travaria a derivação e deixaria passar o desvio no ponto de uso.
  const jsonLd = extrairCorpo(fonteMeta, "buildTableJsonLd");
  if (!jsonLd) {
    failures.push(`buildTableJsonLd: não encontrada em ${TABLE_META}.`);
  } else {
    const codigoJsonLd = semComentario(jsonLd);

    // Presença da chamada NÃO prova que o valor chega ao schema: mantendo
    // `const price = priceForJsonLd(vm)` e trocando só a propriedade por
    // `price: '999'`, este check passava verde com preço fixo publicado (achado P2 do
    // Codex, PR #320, reproduzido). Então são duas verificações, origem e destino.
    const capturaDoPreco = /(?:const|let)\s+(\w+)\s*=\s*priceForJsonLd\(\s*vm\s*\)/.exec(
      codigoJsonLd,
    );

    if (!capturaDoPreco) {
      failures.push(
        `buildTableJsonLd: não chama \`priceForJsonLd(vm)\`. O \`offers.price\` tem de ` +
          `vir dela — montar o preço inline no objeto do schema é o caminho pelo qual a ` +
          `derivação errada volta sem quebrar teste.`,
      );
    } else {
      const variavel = capturaDoPreco[1];
      // Aceita `price,` (shorthand) e `price: <variavel>`, e nada além disso.
      const chegaNaOferta = new RegExp(
        String.raw`price\s*(?::\s*${variavel}\s*)?[,}]`,
      ).test(codigoJsonLd.replace(/priceCurrency\s*:[^,}]*/g, ""));

      if (!chegaNaOferta) {
        failures.push(
          `buildTableJsonLd: chama \`priceForJsonLd\` e guarda em \`${variavel}\`, mas ` +
            `\`offers.price\` NÃO recebe essa variável.\n` +
            `    Derivar o preço e publicar outro valor é pior que não derivar: o schema ` +
            `mente\n` +
            `    com a aparência de estar correto, e a chamada intacta engana quem ler o ` +
            `código.`,
        );
      }
    }
  }
}

if (fonteMapper) {
  // Ponta de origem: se o mapper parar de ler `price_value`, tudo acima fica correto e
  // mesmo assim errado.
  const codigo = semComentario(fonteMapper);
  if (!/price:\s*normalizeNumeric\(\s*table\.price_value\s*\)/.test(codigo)) {
    failures.push(
      `${MAPPER}: \`price\` deixou de ser \`normalizeNumeric(table.price_value)\`. ` +
        `É a ponta de origem do preço do schema — mudança aqui propaga para o JSON-LD ` +
        `sem que nenhum dos checks acima acuse.`,
    );
  }
}

if (failures.length > 0) {
  console.error("G-F — origem do `price` do JSON-LD violada:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("G-F OK — preço do JSON-LD deriva de price_value, não do rótulo do contato.");
