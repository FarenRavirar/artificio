import { chmodSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('.git') || !existsSync('.githooks')) {
  process.exit(0);
}

try {
  chmodSync('.githooks/pre-push', 0o755);
  chmodSync('.githooks/pre-commit', 0o755);
} catch {
  console.warn('Não foi possível marcar .githooks/* como executável automaticamente.');
}

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'ignore',
});

if (result.status !== 0) {
  console.warn('Não foi possível configurar core.hooksPath=.githooks automaticamente.');
}
