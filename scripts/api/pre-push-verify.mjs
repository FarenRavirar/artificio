import { spawnSync } from 'node:child_process';

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

function commandOk(command, args) {
  return run(command, args, { stdio: 'ignore' }).status === 0;
}

function output(command, args) {
  const result = run(command, args);
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function hasRelevantChange(filePath) {
  return WATCHED_FILES.has(filePath) || WATCHED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function resolveBaseRef() {
  const configured = process.env.API_GOVERNANCE_BASE || 'origin/dev';
  if (commandOk('git', ['rev-parse', '--verify', configured])) return configured;
  if (commandOk('git', ['rev-parse', '--verify', '@{u}'])) return '@{u}';
  return 'HEAD~1';
}

if (process.env.SKIP_API_VERIFY === '1') {
  console.log('api-governance pre-push: SKIP_API_VERIFY=1; pulando verify:api.');
  process.exit(0);
}

const baseRef = resolveBaseRef();
const mergeBase = output('git', ['merge-base', 'HEAD', baseRef]) || baseRef;
const changed = output('git', ['diff', '--name-only', `${mergeBase}...HEAD`])
  .split(/\r?\n/)
  .filter(Boolean);

if (!changed.some(hasRelevantChange)) {
  console.log('api-governance pre-push: sem mudanças relevantes; pulando verify:api.');
  process.exit(0);
}

console.log('api-governance pre-push: mudanças relevantes detectadas; rodando pnpm verify:api.');
const verify = run(pnpm, ['verify:api'], { stdio: 'inherit' });
if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

const dirty = output('git', ['diff', '--name-only'])
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(hasRelevantChange);

if (dirty.length > 0) {
  console.error('\napi-governance pre-push: verify:api alterou arquivos versionados.');
  console.error('Revise, commite os artefatos regenerados e tente o push novamente:');
  for (const file of dirty) console.error(`- ${file}`);
  process.exit(1);
}

console.log('api-governance pre-push: ok.');
