#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');

const env = { ...process.env };

// O Windows não propaga variáveis User para processos já abertos. Preserve a
// chave recebida pelo processo; consulte o escopo User somente quando ausente.
if (!env.API_KEY_21ST && process.platform === 'win32') {
  const lookup = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      '[Environment]::GetEnvironmentVariable("API_KEY_21ST","User")',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const userKey = lookup.status === 0 ? lookup.stdout.trim() : '';
  if (userKey) env.API_KEY_21ST = userKey;
}

const windows = process.platform === 'win32';
const command = windows ? env.ComSpec || 'cmd.exe' : 'npx';
const args = windows
  ? ['/d', '/s', '/c', 'npx', '-y', '@21st-dev/magic@0.2.3']
  : ['-y', '@21st-dev/magic@0.2.3'];
const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  process.stderr.write(`[magic-mcp] ${error.message}\n`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
