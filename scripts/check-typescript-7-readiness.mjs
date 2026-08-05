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
 */

import { exec } from 'node:child_process';
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
 * typescript-eslint têm forma estável (`>=X <Y`), então basta ler o teto.
 *
 * Conservador por desenho: na dúvida responde "não aceita", porque um falso
 * DESTRAVADO custa uma migração quebrada, e um falso BLOQUEADO custa rodar o
 * comando de novo no mês seguinte.
 */
function acceptsTypeScript7(range) {
  if (typeof range !== 'string' || range.length === 0) return false;

  const upperBound = range.match(/<\s*(\d+)\.(\d+)\.(\d+)/);
  if (upperBound) {
    const major = Number(upperBound[1]);
    return major > 7 || (major === 7 && Number(upperBound[2]) >= 0 && range.includes('<8'));
  }

  // Sem teto explícito: aceita se mencionar 7 de forma inequívoca.
  return /(^|\s|\|\|)[>^~]?=?\s*7\./.test(range);
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

main().catch((error) => {
  console.error(`Erro inesperado: ${error.message}`);
  process.exit(0);
});
