import { spawnSync } from 'node:child_process';

// Causa raiz corrigida (2026-07-07): pre-push já rodava verify:api e bloqueava
// push se docs/api ficasse sujo — mas o COMMIT já tinha sido feito com
// artefatos desatualizados (números de linha stale). Push então regenerava
// dentro do hook, mas o commit pushado continuava com o estado velho, e o CI
// (que roda no commit exato) achava divergência de novo. Fix: rodar a mesma
// checagem no pre-commit e AUTO-STAGE as regenerações — garante que todo
// commit já nasce com docs/api/generated sincronizado, sem depender de rodar
// verify:api manualmente na ordem certa antes do commit.

const WATCHED_PREFIXES = [
  'apps/',
  'packages/',
  'scripts/api/',
  'docs/api/openapi/',
];

const WATCHED_FILES = new Set([
  'docs/api/.api-allowlist.json',
  'package.json',
  'pnpm-lock.yaml',
]);
const pnpm = 'pnpm';

function run(command, args, options = {}) {
  if (process.platform === 'win32' && command === pnpm) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
      encoding: 'utf-8',
      ...options,
    });
  }

  return spawnSync(command, args, {
    encoding: 'utf-8',
    ...options,
  });
}

function output(command, args) {
  const result = run(command, args);
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function hasRelevantChange(filePath) {
  return WATCHED_FILES.has(filePath) || WATCHED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

if (process.env.SKIP_API_VERIFY === '1') {
  console.log('api-governance pre-commit: SKIP_API_VERIFY=1; pulando verify:api.');
  process.exit(0);
}

const staged = output('git', ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);

if (!staged.some(hasRelevantChange)) {
  console.log('api-governance pre-commit: sem mudanças relevantes; pulando verify:api.');
  process.exit(0);
}

console.log('api-governance pre-commit: mudanças relevantes staged; rodando pnpm verify:api.');
const verify = run(pnpm, ['verify:api'], { stdio: 'inherit' });
if (verify.status !== 0) {
  console.error('\napi-governance pre-commit: verify:api falhou (breaking change ou erro real). Commit bloqueado.');
  process.exit(verify.status ?? 1);
}

// verify:api pode ter regenerado docs/api/generated/* — auto-stage pra que o
// commit que está se formando agora já inclua a versão correta, em vez de
// depender do autor lembrar de rodar `git add` de novo antes de commitar.
const dirtyGenerated = output('git', ['diff', '--name-only', '--', 'docs/api/generated'])
  .split(/\r?\n/)
  .filter(Boolean);

if (dirtyGenerated.length > 0) {
  console.log('api-governance pre-commit: docs/api/generated regenerado; auto-staging:');
  for (const file of dirtyGenerated) console.log(`- ${file}`);
  const add = run('git', ['add', ...dirtyGenerated]);
  if (add.status !== 0) {
    console.error('api-governance pre-commit: falha ao auto-stage os artefatos regenerados.');
    process.exit(1);
  }
}

console.log('api-governance pre-commit: ok.');
