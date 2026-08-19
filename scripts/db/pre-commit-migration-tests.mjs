import { spawnSync } from 'node:child_process';

// Por que este hook existe (incidente real, 2026-08-19, PR #277):
//
// Um comentário SQL dentro de `sql\`...\`` continha uma interpolação de
// template. Para o TypeScript aquilo é um template literal válido — `tsc`
// passou verde. Para o Postgres, o placeholder nasceu DENTRO do `--`, sem cast,
// e o parse falhou inteiro com `42P18 could not determine data type of
// parameter $N`. É um defeito que só existe na fronteira das duas linguagens:
// nenhum verificador de uma delas sozinho enxerga.
//
// O teste que pegava isso EXISTIA (`communityReadIntegration.test.ts`), mas usa
// `describe.skipIf(!pool)` — sem `COMMUNITY_TEST_DATABASE_URL` ele pula em
// silêncio, e localmente não havia banco. O autor viu "9 skipped" (uma seta
// discreta) e commitou. O CI foi a primeira execução real, e reprovou.
//
// A regra do mantenedor: rodar o teste pesado SÓ quando o commit toca schema, e
// que a decisão não dependa da memória de quem commita. Daí um hook, e não uma
// linha de documentação.
//
// Escopo deliberadamente estreito: só dispara com migration/schema staged.
// Commit de frontend, doc ou spec não paga o custo.

const MIGRATION_PATTERNS = [
  /^apps\/[^/]+\/database\/.*\.sql$/,
  /^apps\/[^/]+\/db\/migrations\/.*\.sql$/,
  /^apps\/accounts\/src\/scripts\/prepareCommunityTestDatabase\.ts$/,
];

// Arquivos que MONTAM SQL cru. Não são migration, mas quebram exatamente do
// mesmo jeito: o defeito de 2026-08-19 estava aqui, não numa migration.
const RAW_SQL_PATTERNS = [
  /^apps\/accounts\/src\/community.*\.ts$/,
];

/** App → comandos de teste de integração, na ordem. */
const APP_SUITES = {
  accounts: {
    prepare: ['--filter', '@artificio/accounts', 'test:db:prepare'],
    test: ['--filter', '@artificio/accounts', 'test'],
    // Sem banco o alvo é pulado em silêncio — a falha que este hook existe para
    // impedir. Melhor recusar o commit e dizer o que falta do que passar verde
    // sem ter rodado nada.
    requiresEnv: 'COMMUNITY_TEST_DATABASE_URL',
  },
};

function run(command, args, options = {}) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
      encoding: 'utf-8',
      ...options,
    });
  }
  return spawnSync(command, args, { encoding: 'utf-8', ...options });
}

function output(command, args) {
  const result = run(command, args);
  return result.status === 0 ? result.stdout.trim() : '';
}

function appOf(filePath) {
  const match = /^apps\/([^/]+)\//.exec(filePath);
  return match ? match[1] : null;
}

function isRelevant(filePath) {
  return MIGRATION_PATTERNS.some((re) => re.test(filePath))
    || RAW_SQL_PATTERNS.some((re) => re.test(filePath));
}

if (process.env.SKIP_MIGRATION_TESTS === '1') {
  console.log('db pre-commit: SKIP_MIGRATION_TESTS=1; pulando testes de integração.');
  process.exit(0);
}

const staged = output('git', ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
const relevant = staged.filter(isRelevant);

if (relevant.length === 0) {
  process.exit(0);
}

const apps = [...new Set(relevant.map(appOf).filter(Boolean))].filter((app) => APP_SUITES[app]);

if (apps.length === 0) {
  console.log('db pre-commit: SQL staged, mas nenhum app com suíte de integração configurada.');
  process.exit(0);
}

console.log('db pre-commit: schema/SQL staged — rodando testes de integração.');
for (const file of relevant) console.log(`  - ${file}`);

for (const app of apps) {
  const suite = APP_SUITES[app];

  if (suite.requiresEnv && !process.env[suite.requiresEnv]) {
    console.error(`\ndb pre-commit: ${app} exige ${suite.requiresEnv} e ela não está definida.`);
    console.error('Sem o banco, os testes de integração são PULADOS em silêncio — foi assim');
    console.error('que o erro 42P18 chegou ao CI em 2026-08-19 (PR #277).');
    console.error('\nSaídas:');
    console.error(`  1. Definir ${suite.requiresEnv} e commitar de novo.`);
    console.error('  2. SKIP_MIGRATION_TESTS=1 git commit ... (assume que o CI é a primeira');
    console.error('     execução real; use só quando não houver Postgres disponível).');
    process.exit(1);
  }

  if (suite.prepare) {
    console.log(`\ndb pre-commit: preparando banco de teste de ${app}.`);
    const prepared = run('pnpm', suite.prepare, { stdio: 'inherit' });
    if (prepared.status !== 0) {
      console.error(`\ndb pre-commit: preparação do banco de ${app} falhou. Commit bloqueado.`);
      process.exit(prepared.status ?? 1);
    }
  }

  console.log(`\ndb pre-commit: rodando suíte de ${app}.`);
  const tested = run('pnpm', suite.test, { stdio: 'inherit' });
  if (tested.status !== 0) {
    console.error(`\ndb pre-commit: suíte de ${app} falhou. Commit bloqueado.`);
    process.exit(tested.status ?? 1);
  }
}

console.log('\ndb pre-commit: ok.');
