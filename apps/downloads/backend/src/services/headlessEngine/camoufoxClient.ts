import { spawn } from 'node:child_process';
import path from 'node:path';
import type { HeadlessEngine, RenderedPage } from './types';

// T3.3 (spec 084) — Modo 2b: headless Firefox via Camoufox (daijro/camoufox,
// Python), chamado via subprocess quando o Modo 2a (patchright) ja falhou —
// mais lento (~42s/challenge, dado de mercado citado na spec), nao e a
// primeira tentativa. Contrato de I/O: argv[1] = URL, stdout = 1 linha JSON
// {html, status} em sucesso, stderr = {error} em falha (ver fetch_rendered.py).
const SCRIPT_DIR = path.resolve(__dirname, '../../../scripts/camoufox');
const PYTHON_BIN = process.platform === 'win32'
  ? path.join(SCRIPT_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(SCRIPT_DIR, '.venv', 'bin', 'python');
const SCRIPT_PATH = path.join(SCRIPT_DIR, 'fetch_rendered.py');
const PROCESS_TIMEOUT_MS = 90_000;

interface CamoufoxSuccess {
  html: string;
  status: number;
}

interface CamoufoxError {
  error: string;
}

export class CamoufoxEngine implements HeadlessEngine {
  async fetchRendered(url: string): Promise<RenderedPage> {
    return new Promise((resolve, reject) => {
      const child = spawn(PYTHON_BIN, [SCRIPT_PATH, url], { timeout: PROCESS_TIMEOUT_MS });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (error) => {
        reject(new Error(`Falha ao iniciar processo Camoufox: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const parsedError = tryParseError(stderr);
          reject(new Error(`Camoufox falhou (exit ${code}): ${parsedError ?? stderr.trim() ?? 'sem detalhe'}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim()) as CamoufoxSuccess;
          resolve({ html: parsed.html, status: parsed.status });
        } catch {
          reject(new Error(`Resposta do Camoufox não é JSON válido: ${stdout.slice(0, 200)}`));
        }
      });
    });
  }
}

function tryParseError(stderr: string): string | null {
  try {
    const parsed = JSON.parse(stderr.trim()) as CamoufoxError;
    return parsed.error ?? null;
  } catch {
    return null;
  }
}
