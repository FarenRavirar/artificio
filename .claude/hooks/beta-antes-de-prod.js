#!/usr/bin/env node
// beta-antes-de-prod — PreToolUse(Bash|PowerShell): bloqueia o dispatch de deploy
// de PRODUCAO quando o beta do mesmo modulo esta atras do que producao vai receber.
//
// Por que existe: em 2026-09-23 o agente disparou `deploy.yml` com `env=prod` para
// o `mesas` sem ter deployado o beta. O ultimo deploy de beta com sucesso era de
// `2ba3ed7`; producao recebeu `79cebf5`, dois merges a frente. Nada impediu:
// `deploy-runbook.md` dizia "beta antes de prod" so como texto, os environments
// `beta`/`production` do GitHub nao tem protection rule, e nenhum workflow compara
// os dois ambientes. Regra que so existe em texto nao para ninguem.
//
// Como verifica (medido, nao inferido):
//   1. alvo de prod  = SHA de `main` no GitHub (e o que `_deploy-module.yml` faz
//      `reset --hard origin/main` em `/opt/artificio`);
//   2. beta do modulo = head_sha do run de `deploy.yml` mais recente cujo job
//      "Deploy <modulo> beta" terminou em `success`;
//   3. compare `alvo...beta` no GitHub: `identical` ou `ahead` = beta contem prod,
//      libera; qualquer outro status = prod ficaria a frente do beta, bloqueia.
//
// O clone `/opt/artificio-beta` NAO serve de medida: e um clone so para todos os
// modulos, e o deploy de qualquer um move o HEAD de todos. Por isso a fonte e o
// job de deploy por modulo, nao o git da VM.
//
// Modulo sem beta (`env_override: "prod"` no manifesto — `links`, `accounts`,
// D042) passa direto: nao ha beta para estar atras.
//
// Falha FECHADA, ao contrario dos outros gates deste diretorio: so roda quando o
// comando ja e um deploy de producao, entao bloquear na duvida custa um dispatch
// adiado; liberar na duvida e exatamente o incidente que motivou o hook.

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { lerPayload } = require(path.join(__dirname, 'ler-payload.js'));

// Quantos runs de deploy.yml com sucesso olhar para achar o ultimo beta do modulo.
// Cada run custa uma chamada de API; 30 cobre semanas de deploy neste repo.
const MAX_RUNS = 30;
// Teto de paginas de 100 runs. Se o beta nao aparecer em 500 runs, o hook bloqueia
// (falha fechada) em vez de varrer o historico inteiro.
const MAX_PAGINAS = 5;

function tirarAspas(v) {
  return String(v).replace(/^['"]|['"]$/g, '');
}

/**
 * Le um comando e devolve `{ modulo }` se ele for um dispatch de deploy que
 * resolve para PRODUCAO; `null` para qualquer outra coisa.
 */
// `gh` so conta em POSICAO DE COMANDO: inicio, depois de `;`/`&`/`|`/`(`/quebra de
// linha, ou como argumento de `-c` (`bash -lc "gh ..."`). Sem isto o texto dentro
// de uma string — o payload de teste num `printf '{"command":"gh workflow run..."}'`
// — era lido como dispatch real e barrado (medido em 2026-09-23).
//
// Entre a fronteira e o `gh` o shell aceita prefixos que não mudam o comando:
// atribuição de variável (`GH_PROMPT_DISABLED=1 gh ...`), os wrappers `env`,
// `command`, `exec`, `nohup`, `time`, `sudo`, e caminho absoluto (`/usr/bin/gh`).
// Sem reconhecê-los, `VAR=1 gh workflow run ... env=prod` passava pelo gate
// (achado do Codex na PR #333).
const PREFIXOS = String.raw`(?:(?:env|command|exec|nohup|time|sudo)\s+|[A-Za-z_]\w*=\S*\s+)*`;
const GH_RUN = new RegExp(
  String.raw`(?:^|[;&|(\n]|\s-[a-z]*c\s+['"])\s*` + PREFIXOS + String.raw`(?:\S*/)?gh\s+workflow\s+run\s+(['"]?)([\w./-]+)\1`,
);

function analisarComando(cmd) {
  const texto = String(cmd).replace(/[ \t]+/g, ' ');
  const m = texto.match(GH_RUN);
  if (!m) return null;
  const workflow = path.basename(m[2]).replace(/\.ya?ml$/, '');

  const campos = {};
  const re = /(?:^|\s)(?:-f|-F|--field|--raw-field)(?:\s+|=)(['"]?)([\w-]+)=([^\s'"]*)\1/g;
  let c;
  while ((c = re.exec(texto))) campos[c[2]] = tirarAspas(c[3]);

  if (workflow === 'break-glass-deploy-prod') {
    return { modulo: campos.module || 'mesas' };
  }
  if (workflow !== 'deploy') return null;
  if (campos.mode !== 'deploy' || !campos.module) return null;

  const refM = texto.match(/(?:^|\s)(?:--ref|-r)(?:\s+|=)(['"]?)([^\s'"]+)\1/);
  // Sem --ref o gh usa o branch default do repo, que aqui e `dev`.
  const ref = refM ? refM[2].replace(/^refs\/heads\//, '') : 'dev';
  const env = campos.env && campos.env !== 'default' ? campos.env : (ref === 'dev' ? 'beta' : 'prod');
  return env === 'prod' ? { modulo: campos.module } : null;
}

function moduloSemBeta(modulo, raiz) {
  const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, '.github', 'deploy-manifest.json'), 'utf8'));
  const entrada = (manifesto.modules || []).find((x) => x.module === modulo);
  if (!entrada) throw new Error(`modulo "${modulo}" nao existe em .github/deploy-manifest.json`);
  return entrada.env_override === 'prod';
}

function ghApi(rota, jq, cwd) {
  return execFileSync('gh', ['api', rota, '--jq', jq], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function ultimoBetaComSucesso(modulo, cwd) {
  // Run de `pull_request` nunca deploya (`deploy=false` no build-matrix) e e a
  // maioria dos runs: pula-los corta a consulta de ~30 s para poucos segundos.
  //
  // SEM `?status=success` na URL, de proposito. Medido em 2026-09-23: com
  // `status=success&per_page=100` a API devolveu runs de 2026-09-04 no topo, e com
  // `per_page=5` os do dia — o filtro no servidor nao garante ordem nem janela.
  // Resultado: o hook leu o beta do `mesas` em `0c8531b` com um deploy de beta em
  // `0806233` terminado com sucesso minutos antes, e barrou producao sem motivo.
  // Filtrar `conclusion` e ordenar por `created_at` aqui nao depende disso.
  //
  // Paginado (achado do CodeRabbit na PR #333): uma pagina e 100 runs, e runs de PR
  // dominam — com mais de 100 runs recentes que nao deployam, o beta ficava fora da
  // janela e o hook barrava producao. Para ao juntar MAX_RUNS candidatos, ao chegar
  // numa pagina incompleta (fim da lista) ou no teto de paginas, que limita o custo.
  const runs = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
    const lote = JSON.parse(ghApi(
      `repos/{owner}/{repo}/actions/workflows/deploy.yml/runs?per_page=100&page=${pagina}`,
      '[.workflow_runs[] | {id, head_sha, event, conclusion, created_at}]',
      cwd,
    ));
    runs.push(...lote.filter((r) => r.event !== 'pull_request' && r.conclusion === 'success'));
    if (lote.length < 100 || runs.length >= MAX_RUNS) break;
  }
  runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  runs.splice(MAX_RUNS);
  const alvo = `Deploy ${modulo} beta`;
  for (const { id, head_sha: sha } of runs) {
    const jobs = ghApi(
      `repos/{owner}/{repo}/actions/runs/${id}/jobs?per_page=100`,
      '.jobs[] | select(.conclusion == "success") | .name',
      cwd,
    ).split('\n');
    if (jobs.some((n) => n.endsWith(alvo))) return { run: id, sha };
  }
  return null;
}

/**
 * Decide. Devolve `null` para liberar, ou o texto do motivo para bloquear.
 * `consultar` e injetavel para a suite testar a decisao sem rede.
 */
function decidir(cmd, raiz, consultar) {
  const alvo = analisarComando(cmd);
  if (!alvo) return null;
  const { modulo } = alvo;
  if (moduloSemBeta(modulo, raiz)) return null;

  const { prod, beta, status } = consultar(modulo);
  if (!beta) {
    return `Nenhum deploy de beta com sucesso do \`${modulo}\` nos ultimos ${MAX_RUNS} runs de deploy.yml. `
      + `Producao iria para \`${prod.slice(0, 7)}\` sem beta nenhum atras dele.`;
  }
  if (status === 'identical' || status === 'ahead') return null;
  return `Beta do \`${modulo}\` esta em \`${beta.sha.slice(0, 7)}\` (run ${beta.run}); producao iria para `
    + `\`${prod.slice(0, 7)}\` (main). Compare main...beta = \`${status}\`: producao ficaria A FRENTE do beta.`;
}

function consultarGitHub(modulo, cwd) {
  const prod = ghApi('repos/{owner}/{repo}/commits/main', '.sha', cwd);
  const beta = ultimoBetaComSucesso(modulo, cwd);
  const status = beta ? ghApi(`repos/{owner}/{repo}/compare/${prod}...${beta.sha}`, '.status', cwd) : null;
  return { prod, beta, status };
}

function bloquear(motivo, modulo) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[beta-antes-de-prod] ${motivo}\n\n`
        + `Deploye o beta primeiro e confira que terminou em success:\n`
        + `  gh workflow run deploy.yml --ref dev -f module=${modulo || '<modulo>'} -f mode=deploy -f env=beta\n`
        + `Depois reemita o deploy de producao. Deploy de beta tambem exige autorizacao nominal (AGENTS.md §Autorizacao).`,
    },
  }));
}

if (require.main === module) {
  lerPayload((raw) => {
    let command = '';
    try {
      command = JSON.parse(raw)?.tool_input?.command ?? '';
    } catch {
      process.exit(0); // payload ilegivel: nao ha comando de deploy para barrar
    }
    if (!command || !GH_RUN.test(command.replace(/[ \t]+/g, ' '))) process.exit(0);

    const raiz = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
    let modulo;
    try {
      modulo = analisarComando(command)?.modulo;
      const motivo = decidir(command, raiz, (m) => consultarGitHub(m, raiz));
      if (motivo) bloquear(motivo, modulo);
    } catch (erro) {
      bloquear(`Nao consegui verificar se o beta esta a frente de producao: ${String(erro.message || erro).split('\n')[0]}`, modulo);
    }
    process.exit(0);
  });
}

module.exports = { analisarComando, decidir };
