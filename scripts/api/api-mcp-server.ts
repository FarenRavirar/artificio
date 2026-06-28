#!/usr/bin/env tsx
/**
 * Servidor MCP stdio mínimo para descoberta de APIs.
 *
 * Sem dependências externas: implementa JSON-RPC 2.0 suficiente para clientes MCP
 * consultarem o bundle gerado por `pnpm api:bundle`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as readline from 'node:readline';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const BUNDLE_PATH = resolve(REPO_ROOT, 'docs/api/generated/artificio-api.bundle.json');

interface BundleOperation {
  app: string;
  method: string;
  path: string;
  summary: string;
  scope: string;
  auth: string;
  status: string;
  consumers: string[];
  operationId: string;
}

interface Bundle {
  total: number;
  operations: BundleOperation[];
}

function loadBundle(): Bundle {
  return JSON.parse(readFileSync(BUNDLE_PATH, 'utf-8')) as Bundle;
}

function respond(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function fail(id: unknown, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

function text(content: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] };
}

function searchApi(args: Record<string, unknown>): BundleOperation[] {
  const bundle = loadBundle();
  const q = typeof args.query === 'string' ? args.query.toLowerCase() : '';
  const app = typeof args.app === 'string' ? args.app : '';
  const method = typeof args.method === 'string' ? args.method.toUpperCase() : '';
  const limit = typeof args.limit === 'number' ? Math.max(1, Math.min(args.limit, 100)) : 25;

  return bundle.operations
    .filter((op) => !app || op.app === app)
    .filter((op) => !method || op.method === method)
    .filter((op) => {
      if (!q) return true;
      return [
        op.app,
        op.method,
        op.path,
        op.summary,
        op.scope,
        op.auth,
        op.status,
        op.operationId,
        ...op.consumers,
      ].join(' ').toLowerCase().includes(q);
    })
    .slice(0, limit);
}

const tools = [
  {
    name: 'search_api',
    description: 'Busca rotas no bundle de API do Artificio RPG por texto, app e metodo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        app: { type: 'string' },
        method: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_api_bundle_summary',
    description: 'Retorna resumo do bundle de API carregado.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function handle(message: Record<string, unknown>): Promise<void> {
  const id = message.id;
  const method = String(message.method ?? '');
  const params = (message.params && typeof message.params === 'object')
    ? message.params as Record<string, unknown>
    : {};

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'artificio-api-governance', version: '0.1.0' },
    });
    return;
  }

  if (method === 'notifications/initialized') return;

  if (method === 'tools/list') {
    respond(id, { tools });
    return;
  }

  if (method === 'tools/call') {
    const name = String(params.name ?? '');
    const args = (params.arguments && typeof params.arguments === 'object')
      ? params.arguments as Record<string, unknown>
      : {};

    if (name === 'search_api') {
      respond(id, text(searchApi(args)));
      return;
    }

    if (name === 'get_api_bundle_summary') {
      const bundle = loadBundle();
      const byApp = bundle.operations.reduce<Record<string, number>>((acc, op) => {
        acc[op.app] = (acc[op.app] ?? 0) + 1;
        return acc;
      }, {});
      respond(id, text({ total: bundle.total, byApp, bundlePath: BUNDLE_PATH }));
      return;
    }

    fail(id, -32601, `Ferramenta desconhecida: ${name}`);
    return;
  }

  fail(id, -32601, `Metodo MCP desconhecido: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    void handle(JSON.parse(line) as Record<string, unknown>);
  } catch (error) {
    fail(null, -32700, error instanceof Error ? error.message : 'JSON invalido');
  }
});
