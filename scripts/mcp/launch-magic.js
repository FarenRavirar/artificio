#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const env = { ...process.env };

// O Windows não propaga variáveis User para processos já abertos. Preserve a
// chave recebida pelo processo; consulte o escopo User somente quando ausente.
if (!env.API_KEY_21ST && process.platform === 'win32') {
  const windowsDir = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(
    windowsDir,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const lookup = spawnSync(
    powershell,
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
const nodeDir = path.dirname(process.execPath);
const npxCandidates = [
  path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  path.resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  path.resolve(nodeDir, '..', 'share', 'nodejs', 'npm', 'bin', 'npx-cli.js'),
];
const npxCli = npxCandidates.find((candidate) => fs.existsSync(candidate));
if (!npxCli) {
  process.stderr.write('[magic-mcp] npx-cli.js não encontrado junto ao runtime Node\n');
  process.exit(1);
}

// Não herde diretórios arbitrários do PATH do agente. O processo filho precisa
// só do runtime Node já confiado e dos binários do sistema operacional.
delete env.Path;
delete env.PATH;
env.PATH = windows
  ? [nodeDir, `${process.env.SystemRoot || 'C:\\Windows'}\\System32`].join(path.delimiter)
  : [nodeDir, '/usr/local/bin', '/usr/bin', '/bin'].join(path.delimiter);

const child = spawn(process.execPath, [npxCli, '-y', '@21st-dev/magic@0.2.3'], {
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
