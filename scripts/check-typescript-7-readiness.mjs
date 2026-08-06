#!/usr/bin/env node
/**
 * Spec 091 — verificação executável do critério de destravamento do TypeScript 7.
 *
 * ## Por que existe
 *
 * O monorepo está em `typescript ~6.0.3` e não pode migrar para o 7 ainda. O motivo
 * não é trabalho pendente nosso — é o ecossistema. Sem um comando que responda
 * "ainda não" com o dado na mão, o item vira folclore: alguém tenta migrar de novo,
 * quebra o lint type-aware de 12 pacotes e redescobre o mesmo bloqueio.
 *
 * ## Critério único
 *
 * `typescript-eslint` precisa aceitar `7.x`. Ele declara o range suportado em
 * `peerDependencies.typescript` de `@typescript-eslint/typescript-estree`, e o
 * parser dele é o que sustenta `projectService` nos 12 pacotes com lint type-aware.
 *
 * **A API do compilador NÃO é critério.** Uma versão anterior desta verificação
 * exigia também que o TypeScript voltasse a expor a API fora de `./unstable/*`.
 * Isso nunca vai acontecer: o TS 7 é o typescript-go, e a API passou a ser servida
 * por IPC (`tsc --api`, JSON-RPC ou MessagePack) em vez de `require('typescript')`.
 * Manter aquela condição faria o script responder BLOQUEADO para sempre.
 *
 * ## Uso
 *
 *   node scripts/check-typescript-7-readiness.mjs
 *
 * Sob demanda, **fora do CI**: o CI não deve ficar vermelho porque o ecossistema
 * não mudou. Sai `0` em qualquer resultado — quem lê é humano, não gate.
 *
 * A leitura do range (`acceptsTypeScript7`) **é** coberta pelo CI: está exportada
 * e testada em `check-typescript-7-readiness.test.mjs`, que roda no
 * `turbo run test` junto com o resto do repo. O resultado do script depende do
 * npm e por isso não é testável; a decisão sobre o range não depende de nada
 * externo, e é justamente onde já houve um falso DESTRAVADO (PR #243).
 */

import { exec } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(exec);

const ESTREE = '@typescript-eslint/typescript-estree';

/**
 * Consulta o npm sem instalar nada.
 *
 * Usa `exec` (linha de comando única) em vez de `execFile`: no Windows o `npm` é
 * um `.cmd`, e o `execFile` recusa executá-lo desde a correção de CVE-2024-27980,
 * falhando com `spawn EINVAL`. `execFile` + `shell: true` também funcionaria, mas
 * o Node emite `DEP0190` porque argumentos passados assim não são escapados.
 *
 * Nada aqui vem de entrada externa: `pkg` e `field` são literais definidos neste
 * arquivo. Se algum dia virarem parâmetro, esta função precisa voltar a `execFile`
 * sem shell — o comentário fica para que a troca não seja feita no automático.
 */
async function npmView(pkg, field) {
  const { stdout } = await run(`npm view ${pkg} ${field} --json`, {
    windowsHide: true,
  });
  const raw = stdout.trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

/**
 * Um range aceita 7.x?
 *
 * Checagem textual de propósito: trazer `semver` só para isto acrescentaria
 * dependência a um script que roda fora do build. Os ranges publicados pelo
 * typescript-eslint têm forma estável (`>=X <Y`), então dá para ler os dois
 * limites diretamente.
 *
 * **Os dois limites importam.** Uma versão anterior lia só o teto, e por isso
 * `>=8.0.0 <9.0.0` respondia "aceita": o `<9` passava na checagem de major, e o
 * `>=8` — que exclui todo o 7.x — era ignorado. Isso é o falso DESTRAVADO que o
 * comentário abaixo diz custar caro (achado de review, PR #243).
 *
 * Conservador por desenho: na dúvida responde "não aceita", porque um falso
 * DESTRAVADO custa uma migração quebrada, e um falso BLOQUEADO custa rodar o
 * comando de novo no mês seguinte.
 */
export function acceptsTypeScript7(range) {
  if (typeof range !== 'string' || range.length === 0) return false;

  // Ranges com `||` são alternativas independentes: basta uma comportar o 7.x.
  const alternatives = range.split('||');
  if (alternatives.length > 1) {
    return alternatives.some((alternative) => acceptsTypeScript7(alternative));
  }

  // Compara major.minor.patch inteiros, não só o major: comparar só o major
  // rejeitava `>=7.5.0 <7.6.0`, que é válido, e aceitava `>=7.5.0 <=7.2.0`, que
  // é vazio (achado de review, PR #243).
  const lowerBound = /(>=?)\s*(\d+)\.(\d+)\.(\d+)/.exec(range);
  const upperBound = /(<=?)\s*(\d+)\.(\d+)\.(\d+)/.exec(range);

  // Intervalo pedido: [7.0.0, 8.0.0). O range aceita alguma release 7.x quando
  // se sobrepõe a ele.
  const SETE = [7, 0, 0];
  const OITO = [8, 0, 0];

  const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const versionOf = (m) => [Number(m[2]), Number(m[3]), Number(m[4])];

  if (lowerBound) {
    const low = versionOf(lowerBound);
    // Piso em 8.0.0 ou acima (ou `>7.x.y` a partir de 8): nenhuma 7.x cabe.
    if (compare(low, OITO) >= 0) return false;

    if (upperBound) {
      const high = versionOf(upperBound);
      const inclusiveUpper = upperBound[1] === '<=';
      // Intervalo vazio (`>=7.5.0 <=7.2.0`) não aceita nada.
      const empty = inclusiveUpper ? compare(low, high) > 0 : compare(low, high) >= 0;
      if (empty) return false;
      // Teto abaixo de 7.0.0 exclui todo o 7.x; `<7.0.0` exclusivo também.
      return inclusiveUpper ? compare(high, SETE) >= 0 : compare(high, SETE) > 0;
    }

    // Sem teto: qualquer piso abaixo de 8.0.0 alcança alguma release 7.x.
    return true;
  }

  if (upperBound) {
    const high = versionOf(upperBound);
    const inclusiveUpper = upperBound[1] === '<=';
    return inclusiveUpper ? compare(high, SETE) >= 0 : compare(high, SETE) > 0;
  }

  // Sem limite explícito: só um range que já começa em 7 de forma inequívoca.
  //
  // O `trim()` antes do teste existe para o regex não precisar de `(^|\s)` junto
  // de `\s*`: dois grupos de espaço adjacentes podem particionar a mesma entrada
  // de várias formas, e isso é backtracking super-linear (achado do Sonar,
  // PR #243). Sem espaço à esquerda para dividir, o padrão é linear.
  return /^[\^~]?=?7\./.test(range.trim());
}

async function main() {
  console.log('Spec 091 — destravamento do TypeScript 7\n');

  let range;
  try {
    range = await npmView(ESTREE, 'peerDependencies.typescript');
  } catch (error) {
    console.error(`Falha ao consultar o npm: ${error.message}`);
    console.error('Sem rede ou npm indisponível — o critério não pôde ser avaliado.');
    process.exit(0);
  }

  const [tsLatest, estreeLatest] = await Promise.all([
    npmView('typescript', 'dist-tags.latest').catch(() => '(desconhecido)'),
    npmView(ESTREE, 'version').catch(() => '(desconhecido)'),
  ]);

  console.log(`  typescript (latest no npm) : ${tsLatest}`);
  console.log(`  ${ESTREE} : ${estreeLatest}`);
  console.log(`  range de typescript aceito : ${range}\n`);

  if (acceptsTypeScript7(range)) {
    console.log('DESTRAVADO — typescript-eslint aceita 7.x.');
    console.log('');
    console.log('Próximos passos, nesta ordem:');
    console.log('  1. Subir typescript-eslint e typescript nos package.json.');
    console.log('  2. Rodar lint, build e test do repo inteiro, com contagem.');
    console.log('  3. Conferir que os 8 pacotes CJS seguem emitindo CommonJS carregável');
    console.log('     por require() — bundler já foi validado sob o TS 7.');
    return;
  }

  console.log('BLOQUEADO — typescript-eslint ainda não aceita 7.x.');
  console.log('');
  console.log('Enquanto isto não mudar, `~6.0.3` é a escolha correta, e os tsconfig');
  console.log('do repo não são débito. Nada a fazer além de reexecutar mais tarde.');
}

// Só executa quando chamado como comando. O teste importa `acceptsTypeScript7`
// deste mesmo arquivo, e sem este guard o import dispararia `npm view` — teste
// batendo na rede é teste que falha por motivo errado.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Erro inesperado: ${error.message}`);
    process.exit(0);
  });
}
