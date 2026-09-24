// Suite do beta-antes-de-prod. Roda com: node beta-antes-de-prod.test.js
// Testa a decisao sem rede (consulta injetada). A verificacao contra o GitHub real
// e feita rodando o hook com o payload no stdin — ver o cabecalho do hook.
const path = require('node:path');
const { analisarComando, decidir } = require(path.join(__dirname, 'beta-antes-de-prod.js'));

const RAIZ = path.resolve(__dirname, '..', '..');
const PROD = '79cebf5c103af6b6627eafec5b0d1528a714b8ef';
const BETA_ATRAS = { run: '35633005300', sha: '2ba3ed7000000000000000000000000000000000' };
const consulta = (status, beta = BETA_ATRAS) => () => ({ prod: PROD, beta, status });
const nuncaConsulta = () => { throw new Error('nao deveria consultar o GitHub'); };

const CASOS = [
  // [nome, comando, consulta, esperado]
  ['incidente 2026-09-23: prod com beta atras', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['prod com beta igual', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('identical'), 'PASSA'],
  ['prod com beta a frente', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('ahead'), 'PASSA'],
  ['prod com beta divergente', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('diverged'), 'BLOQUEIA'],
  ['prod sem beta nenhum', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta(null, null), 'BLOQUEIA'],
  ['prod por ref main sem env', 'gh workflow run deploy.yml --ref main -f module=site -f mode=deploy', consulta('behind'), 'BLOQUEIA'],
  ['prod com --field e aspas', 'gh workflow run "deploy.yml" --ref=main --field module=glossario --field mode=deploy --field env="prod"', consulta('behind'), 'BLOQUEIA'],
  ['prod dentro de cd &&', 'cd /c/projetos/artificio && gh workflow run deploy.yml --ref main -f module=downloads -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['break-glass', 'gh workflow run break-glass-deploy-prod.yml -f module=mesas -f confirm=BREAK_GLASS', consulta('behind'), 'BLOQUEIA'],
  ['deploy de beta', 'gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta', nuncaConsulta, 'PASSA'],
  ['dev sem env resolve beta', 'gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy', nuncaConsulta, 'PASSA'],
  ['mode=ci nao deploya', 'gh workflow run deploy.yml --ref main -f module=mesas -f mode=ci -f env=prod', nuncaConsulta, 'PASSA'],
  ['links nao tem beta', 'gh workflow run deploy.yml --ref main -f module=links -f mode=deploy -f env=prod', nuncaConsulta, 'PASSA'],
  ['accounts nao tem beta', 'gh workflow run deploy.yml --ref main -f module=accounts -f mode=deploy -f env=prod', nuncaConsulta, 'PASSA'],
  ['promote nao e deploy', 'gh workflow run promote-prod-fast-forward.yml --ref main -f confirm=PROMOTE_DEV_TO_MAIN', nuncaConsulta, 'PASSA'],
  ['gh run list', 'gh run list --workflow deploy.yml', nuncaConsulta, 'PASSA'],
  ['bash -lc aninhado', 'bash -lc "gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod"', consulta('behind'), 'BLOQUEIA'],
  // Achado do Codex na PR #333: prefixos de shell escondiam o comando do gate.
  ['atribuicao de variavel antes', 'GH_PROMPT_DISABLED=1 gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['wrapper env com variavel', 'env GH_PROMPT_DISABLED=1 gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['wrapper command', 'command gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  // Segunda rodada do Codex na PR #333: opcoes dos wrappers.
  ['env -i', 'env -i gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['sudo -u usuario', 'sudo -u deploy gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['time -p', 'time -p gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['echo com texto entre aspas', 'echo "rode gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod depois"', nuncaConsulta, 'PASSA'],
  ['caminho absoluto', '/usr/bin/gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  ['depois de ; e quebra de linha', 'echo x;\ngh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod', consulta('behind'), 'BLOQUEIA'],
  // Falso positivo real de 2026-09-23: o payload de teste do proprio hook.
  ['texto dentro de string do printf', `printf '%s' '{"tool_input":{"command":"gh workflow run deploy.yml --ref main -f module=site -f mode=deploy -f env=prod"}}' | node hook.js`, nuncaConsulta, 'PASSA'],
];

let falhas = 0;
for (const [nome, cmd, consultar, esperado] of CASOS) {
  let obtido;
  try {
    obtido = decidir(cmd, RAIZ, consultar) ? 'BLOQUEIA' : 'PASSA';
  } catch (e) {
    obtido = `ERRO: ${e.message}`;
  }
  const ok = obtido === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome} -> ${obtido}${ok ? '' : ` (esperado ${esperado})`}`);
}

// Modulo inexistente nao pode passar em silencio: o hook converte o erro em bloqueio.
try {
  decidir('gh workflow run deploy.yml --ref main -f module=xpto -f mode=deploy -f env=prod', RAIZ, consulta('identical'));
  console.log('FALHA modulo inexistente -> nao lancou'); falhas += 1;
} catch {
  console.log('ok    modulo inexistente -> lanca (vira bloqueio)');
}

if (analisarComando('gh workflow run deploy.yml -f module=mesas -f mode=deploy') !== null) {
  console.log('FALHA sem --ref deveria resolver dev/beta'); falhas += 1;
} else {
  console.log('ok    sem --ref resolve dev (beta)');
}

console.log(falhas === 0 ? `\n${CASOS.length + 2}/${CASOS.length + 2} OK` : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
