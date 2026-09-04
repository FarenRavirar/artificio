#!/usr/bin/env node
// opencode-mcp — MCP stdio server que expõe o opencode (DeepSeek) ao Claude Code.
//
// Cada chamada da ferramenta `deepseek` roda `opencode run "<prompt>"` em sessão
// nova, usando o binário nativo (sem shell) para evitar o problema de quoting do
// Windows, e devolve o texto final da resposta.
//
// Env vars (opcionais, definidas no config do MCP no Claude Code):
//   OPENCODE_MCP_BIN        caminho completo do binário opencode (ex.: ...opencode.exe)
//   OPENCODE_MCP_CWD        diretório de trabalho (default: raiz do repositório)
//   OPENCODE_MCP_TIMEOUT_MS timeout do `opencode run` em ms (default: 900000 = 15min)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// docs/agents/opencode-mcp -> raiz do repositório = 3 níveis acima.
const REPO_ROOT =
  process.env.OPENCODE_MCP_CWD || path.resolve(__dirname, "..", "..", "..");
const TIMEOUT_MS = Number(process.env.OPENCODE_MCP_TIMEOUT_MS) || 15 * 60 * 1000;

function resolveOpencodeBin() {
  if (process.env.OPENCODE_MCP_BIN) return process.env.OPENCODE_MCP_BIN;
  // Windows: o shim npm (opencode/.cmd/.ps1) não é spawnável sem shell.
  // Usar o binário nativo que o próprio shim executa.
  if (process.platform === "win32" && process.env.APPDATA) {
    const exe = path.join(
      process.env.APPDATA,
      "npm",
      "node_modules",
      "opencode-ai",
      "bin",
      "opencode.exe",
    );
    if (existsSync(exe)) return exe;
  }
  // macOS/Linux (brew etc.) resolvem pelo PATH.
  return "opencode";
}

const OPENCODE_BIN = resolveOpencodeBin();

const TOOLS = [
  {
    name: "deepseek",
    description:
      "Invoca o opencode (modelo DeepSeek) para executar uma tarefa no repositório: " +
      "pesquisa, revisão crítica/contraditório de código ou implementação. " +
      "Roda `opencode run` em sessão nova e devolve o texto final da resposta.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Tarefa/prompt completo para o agente DeepSeek (contexto e o que ele deve devolver).",
        },
        model: {
          type: "string",
          description:
            "Opcional. Modelo no formato provider/modelo (ex.: deepseek/deepseek-v4-pro). Default: o default do opencode.",
        },
        agent: {
          type: "string",
          description:
            "Opcional. Agente opencode a usar (ex.: artificio-orquestrador). Default: o default do opencode.",
        },
        cwd: {
          type: "string",
          description: "Opcional. Diretório de trabalho. Default: raiz do repositório.",
        },
      },
      required: ["prompt"],
    },
  },
];

function runOpencode({ prompt, model, agent, cwd }) {
  return new Promise((resolve, reject) => {
    // --auto é OBRIGATÓRIO em modo headless. O `opencode.json` da raiz do repo
    // declara `permission: { edit: "ask", bash: "ask" }`; numa sessão
    // interativa isso pergunta ao mantenedor, mas em `opencode run` não há
    // quem responda e o opencode AUTO-REJEITA toda chamada de ferramenta.
    // Sintoma medido (2026-08-19): prompt trivial responde normal, mas prompt
    // que exige ler arquivo aborta no primeiro `rtk rg` com "auto-rejecting",
    // e sai com exit 0 e stdout VAZIO — falha silenciosa que parecia bug do
    // MCP e era permissão. Com --auto o mesmo prompt devolve a resposta certa.
    const args = ["run", "--auto"];
    if (model) args.push("--model", model);
    if (agent) args.push("--agent", agent);
    args.push(prompt);

    const child = spawn(OPENCODE_BIN, args, {
      cwd: cwd || REPO_ROOT,
      windowsHide: true,
      shell: false,
      env: process.env,
      // Grupo de processo próprio no POSIX: o `opencode` spawna filhos (rtk, git,
      // tsc), e `child.kill()` alcançaria só o processo direto — no timeout os
      // netos ficavam rodando órfãos, segurando lock e CPU. Com `detached`, o
      // PID vira PGID e `kill(-pid)` derruba a árvore inteira. No Windows não
      // existe grupo POSIX; lá o encerramento é por `taskkill /T` (ver timeout).
      detached: process.platform !== "win32",
      // Fecha o stdin do filho. Sem isso, o Node deixa o stdin como pipe aberto
      // e o `opencode run` fica esperando EOF/input indefinidamente (travava).
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    // `true` a partir do timeout: o `close` que vier depois é consequência do
    // kill, não resultado do comando, e não deve resolver a promise com saída
    // parcial nem rejeitar com "saiu com código null" por cima do erro real.
    let expirou = false;

    const timer = setTimeout(() => {
      expirou = true;
      const erro = new Error(`opencode run excedeu o timeout de ${TIMEOUT_MS}ms`);

      // Espera o `close` antes de rejeitar: rejeitar de imediato devolvia o
      // controle ao chamador com a árvore ainda morrendo, e o próximo `run`
      // disputava o mesmo lock do opencode.
      child.once("close", () => reject(erro));

      if (process.platform === "win32") {
        // Windows não tem grupo de processo POSIX: `taskkill /T` percorre a
        // árvore pelo PID pai, e `/F` é necessário porque o opencode não
        // responde a sinal de terminação amigável.
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        }).on("error", () => child.kill("SIGKILL"));
      } else {
        // PID negativo = o grupo inteiro (ver `detached` no spawn).
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    }, TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      if (expirou) return; // erro provocado pelo kill; o timer já rejeita
      reject(
        new Error(
          `falha ao iniciar opencode (bin=${OPENCODE_BIN}): ${err.message}. ` +
            "Se o binário não for encontrado, defina OPENCODE_MCP_BIN no config do MCP.",
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      // Depois do timeout quem rejeita é o próprio `once("close")` do timer, com
      // o erro de timeout. Seguir daqui reportaria "saiu com código null" — o
      // sintoma do kill, não a causa — e mascararia o motivo real da falha.
      if (expirou) return;
      const output = (stdout || "").trim();
      if (code !== 0) {
        const detail = (stderr || "").trim();
        reject(
          new Error(
            `opencode run saiu com código ${code}.` +
              (detail ? ` stderr: ${detail}` : "") +
              (output ? ` stdout: ${output}` : ""),
          ),
        );
        return;
      }
      // Exit 0 com stdout vazio NÃO é sucesso: é como o opencode termina
      // quando aborta no meio (permissão negada, sessão sem resposta). Devolver
      // "(sem saída)" como se fosse resultado esconde a falha do orquestrador,
      // que segue como se a tarefa tivesse rodado. O stderr carrega o motivo
      // real ("auto-rejecting", erro de provider) — então ele vai junto.
      if (!output) {
        const detail = (stderr || "").trim();
        reject(
          new Error(
            "opencode run terminou com código 0 mas sem nenhuma saída — " +
              "normalmente é permissão auto-rejeitada ou aborto no meio da sessão." +
              (detail ? ` stderr: ${detail}` : " (stderr também vazio)"),
          ),
        );
        return;
      }
      resolve(output);
    });
  });
}

const server = new Server(
  { name: "opencode-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "deepseek") {
    throw new Error(`ferramenta desconhecida: ${name}`);
  }
  const prompt =
    args && typeof args.prompt === "string" ? args.prompt.trim() : "";
  if (!prompt) {
    throw new Error("parâmetro 'prompt' é obrigatório");
  }
  const text = await runOpencode({
    prompt,
    model: args && typeof args.model === "string" ? args.model : undefined,
    agent: args && typeof args.agent === "string" ? args.agent : undefined,
    cwd: args && typeof args.cwd === "string" ? args.cwd : undefined,
  });
  return { content: [{ type: "text", text }] };
});

console.error(
  `[opencode-mcp] bin=${OPENCODE_BIN} cwd=${REPO_ROOT} timeout=${TIMEOUT_MS}ms`,
);

const transport = new StdioServerTransport();
await server.connect(transport);
