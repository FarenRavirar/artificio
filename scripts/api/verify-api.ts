import { spawnSync } from 'node:child_process';

const full = process.argv.includes('--full');
const pnpm = 'pnpm';

const commands = [
  [pnpm, ['api:inventory']],
  [pnpm, ['api:consumers']],
  [pnpm, ['api:generate-openapi']],
  [pnpm, ['api:lint']],
  [pnpm, ['api:check']],
  [pnpm, ['api:diff']],
];

if (full) {
  commands.push([pnpm, ['api:traffic']]);
  commands.push([pnpm, ['api:docs']]);
}

for (const [cmd, args] of commands) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...args].join(' ')], { stdio: 'inherit' })
    : spawnSync(cmd, args, { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\n✅ verify:api${full ? ':full' : ''} concluído`);
