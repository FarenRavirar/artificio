import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface JsonRpcResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.jsonrpc !== '2.0') return false;
  if (typeof candidate.id !== 'number') return false;
  const hasResult = typeof candidate.result === 'object' && candidate.result !== null;
  const hasError = typeof candidate.error === 'object' && candidate.error !== null;
  // JSON-RPC 2.0: exatamente um dos dois.
  return hasResult !== hasError;
}

const SERVER_PATH = resolve(import.meta.dirname, 'api-mcp-server.ts');

async function callServer(messages: Record<string, unknown>[]): Promise<JsonRpcResponse[]> {
  const child = spawn(process.execPath, ['--import', 'tsx', SERVER_PATH], {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  for (const message of messages) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }
  child.stdin.end();

  // `close` e nao `exit`: `exit` dispara quando o processo morre, mas os pipes
  // de stdio podem continuar drenando depois disso — esperar so por `exit`
  // deixa a ultima resposta de fora de forma intermitente. `close` so dispara
  // quando todo o stdio ja foi fechado (achado Codex, PR #285).
  const exitCode = await new Promise<number | null>((resolveClose, reject) => {
    child.once('error', reject);
    child.once('close', resolveClose);
  });

  expect(exitCode, stderr).toBe(0);

  // Saida de subprocesso e dado externo: `JSON.parse(...) as JsonRpcResponse`
  // era promessa de tipo sem verificacao nenhuma (AGENTS.md: payload externo e
  // `unknown` ate passar por normalizador). Uma linha de log vazando no stdout
  // viraria um "response" malformado, silenciosamente.
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`stdout linha ${index + 1} nao e JSON valido: ${line.slice(0, 200)}`);
      }
      if (!isJsonRpcResponse(parsed)) {
        throw new Error(`stdout linha ${index + 1} nao e uma resposta JSON-RPC: ${line.slice(0, 200)}`);
      }
      return parsed;
    });
}

describe('artificio-api-governance MCP', () => {
  it('responde aos probes de resources do Codex sem erro de método desconhecido', async () => {
    const responses = await callServer([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'resources/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'resources/templates/list', params: {} },
      { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} },
    ]);

    // O handshake era enviado e nunca conferido. `tools` precisa ser objeto
    // vazio (o servidor nao anuncia capability opcional de tools) e `resources`
    // NAO pode aparecer — anunciar resources faria o cliente esperar um
    // provider que este servidor nao implementa.
    const initialize = responses.find(({ id }) => id === 1);
    expect(initialize?.result?.capabilities).toEqual({ tools: {} });
    expect(initialize?.result?.serverInfo).toMatchObject({ name: 'artificio-api-governance' });

    expect(responses.find(({ id }) => id === 2)).toMatchObject({
      id: 2,
      result: { resources: [] },
    });
    expect(responses.find(({ id }) => id === 3)).toMatchObject({
      id: 3,
      result: { resourceTemplates: [] },
    });
    expect(responses.find(({ id }) => id === 4)).toMatchObject({
      id: 4,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'search_api' }),
          expect.objectContaining({ name: 'get_api_bundle_summary' }),
        ]),
      },
    });
  });
});
