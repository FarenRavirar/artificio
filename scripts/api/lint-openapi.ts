#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { byLocale } from './sort-utils';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const OPENAPI_DIR = path.join(REPO_ROOT, 'docs/api/openapi');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

const REQUIRED_FIELDS = [
  'x-artificio-owner',
  'x-artificio-scope',
  'x-artificio-status',
  'x-artificio-auth',
] as const;

const ENUMS: Record<string, Set<string>> = {
  'x-artificio-owner': new Set(['accounts', 'mesas', 'glossario', 'links', 'site']),
  'x-artificio-scope': new Set(['internal', 'public', 'cross-app', 'admin', 'cron', 'webhook']),
  'x-artificio-status': new Set(['active', 'deprecated', 'legacy', 'orphan-suspect', 'provisional']),
  'x-artificio-auth': new Set(['none', 'user', 'admin', 'service', 'csrf-cookie']),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateArtificioMetadata(): string[] {
  const errors: string[] = [];
  const files = fs
    .readdirSync(OPENAPI_DIR)
    .filter((file) => file.endsWith('.openapi.yaml'))
    .sort(byLocale);

  for (const file of files) {
    const fullPath = path.join(OPENAPI_DIR, file);
    const document = yaml.load(fs.readFileSync(fullPath, 'utf-8'));

    if (!isRecord(document) || !isRecord(document.paths)) {
      errors.push(`${file}: missing or invalid paths object`);
      continue;
    }

    for (const [apiPath, pathItem] of Object.entries(document.paths)) {
      if (!isRecord(pathItem)) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method.toLowerCase()) || !isRecord(operation)) continue;

        const location = `${file} ${method.toUpperCase()} ${apiPath}`;
        for (const field of REQUIRED_FIELDS) {
          const value = operation[field];
          if (value === undefined || value === null || value === '') {
            errors.push(`${location}: missing ${field}`);
            continue;
          }
          if (typeof value !== 'string' || !ENUMS[field].has(value)) {
            errors.push(`${location}: invalid ${field}=${String(value)}`);
          }
        }

        if (operation['x-artificio-scope'] === 'cross-app') {
          const consumers = operation['x-artificio-consumers'];
          if (!Array.isArray(consumers) || consumers.length === 0) {
            errors.push(`${location}: cross-app operation must define non-empty x-artificio-consumers`);
          }
        }
      }
    }
  }

  return errors;
}

function main(): void {
  const pnpmExecPath = process.env.npm_execpath;
  const command = pnpmExecPath?.endsWith('.mjs') ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const commandArgs = [
    ...(pnpmExecPath?.endsWith('.mjs') ? [pnpmExecPath] : []),
    'exec',
    'cross-env',
    'REDOCLY_TELEMETRY=off',
    'REDOCLY_SUPPRESS_UPDATE_NOTICE=true',
    'redocly',
    'lint',
  ];
  const redocly = spawnSync(
    command,
    commandArgs,
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  if (redocly.error) {
    console.error(`Failed to run Redocly lint via ${command}: ${redocly.error.message}`);
  }

  const metadataErrors = validateArtificioMetadata();
  if (metadataErrors.length > 0) {
    console.error('\n❌ x-artificio metadata validation failed:');
    for (const error of metadataErrors) {
      console.error(`   - ${error}`);
    }
  }

  if (redocly.status !== 0 || metadataErrors.length > 0) {
    process.exit(1);
  }
}

main();
