import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface JsonRpcResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
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

  const exitCode = await new Promise<number | null>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', resolveExit);
  });

  expect(exitCode, stderr).toBe(0);
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as JsonRpcResponse);
}

describe('artificio-api-governance MCP', () => {
  it('responde aos probes de resources do Codex sem erro de método desconhecido', async () => {
    const responses = await callServer([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'resources/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'resources/templates/list', params: {} },
      { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} },
    ]);

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
