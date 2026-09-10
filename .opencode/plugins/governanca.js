// Ponte de governança do Artifício RPG para o OpenCode. Spec 101, Fase 0.7 (D14).
//
// Por que existe: os 4 hooks de governança viviam só em ~/.claude/hooks/, e só o
// Claude Code os executava. Enquanto isso valesse, mover uma regra do AGENTS.md
// para hook não moveria a regra — a APAGARIA para o Codex e para o OpenCode.
// A Fase 0.7 é pré-requisito das Fases 3 e 4 por isso.
//
// O Codex reaproveita os hooks direto (payload idêntico ao do Claude Code, via
// .codex/hooks.json). O OpenCode não: aqui o mecanismo é plugin TypeScript/JS com
// `tool.execute.before`, e o bloqueio é `throw`, não JSON de deny. Esta ponte
// converte um no outro, para que exista UMA implementação de cada regra — a de
// .claude/hooks/ — e não três cópias divergindo com o tempo.

import { execFileSync } from "node:child_process";
import path from "node:path";

// Mapa tool do OpenCode -> hooks que o Claude Code/Codex rodam no evento equivalente.
const HOOKS = {
  bash: ["rtk-enforce.js", "git-commit-msg-gate.js"],
  read: ["rtk-read-gate.js"],
  edit: ["deploy-contract-gate.js"],
  write: ["deploy-contract-gate.js"],
};

// O payload que os hooks esperam é o do Claude Code (tool_name + tool_input);
// o Codex usa o mesmo, medido em 2026-09-10. Aqui montamos esse formato a partir
// do que o OpenCode entrega, para não precisar de uma variante do hook por harness.
function montarPayload(tool, args) {
  const input = { ...args };
  // OpenCode nomeia o caminho como `filePath` em edit/write; os hooks leem `file_path`.
  if (input.filePath && !input.file_path) input.file_path = input.filePath;
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: tool,
    tool_input: input,
  });
}

export const GovernancaArtificio = async ({ directory }) => ({
  "tool.execute.before": async ({ tool }, output) => {
    const hooks = HOOKS[String(tool || "").toLowerCase()];
    if (!hooks) return;

    for (const arquivo of hooks) {
      const hookPath = path.join(directory, ".claude", "hooks", arquivo);
      let saida = "";
      try {
        saida = execFileSync("node", [hookPath], {
          input: montarPayload(tool, output?.args ?? {}),
          encoding: "utf8",
          // Sem timeout, um hook que trave (I/O em rede, arquivo enorme, laço)
          // segura a chamada de ferramenta para sempre e o agente fica parado
          // sem sinal. Os quatro hooks são locais e respondem em milissegundos;
          // 5s é folga de uma ordem de grandeza.
          timeout: 5000,
          // SIGKILL, não o SIGTERM padrão: processo que ignora o sinal
          // continuaria vivo e o timeout não teria efeito nenhum.
          killSignal: "SIGKILL",
        });
      } catch {
        // Hook indisponível ou quebrado não pode travar o trabalho: um gate que
        // derruba o turno é desligado na primeira vez que atrapalha, e aí não
        // protege mais nada. Falha aberta, deliberadamente.
        continue;
      }

      if (!saida.trim()) continue;

      let decisao;
      try {
        decisao = JSON.parse(saida).hookSpecificOutput;
      } catch {
        continue;
      }

      if (decisao?.permissionDecision === "deny") {
        // No OpenCode, bloquear é lançar. A mensagem do hook já traz o comando
        // corrigido no motivo — é o que torna o gate barato de obedecer.
        throw new Error(decisao.permissionDecisionReason || "bloqueado pela governança do projeto");
      }
    }
  },
});
