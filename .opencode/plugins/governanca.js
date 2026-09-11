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
  bash: ["rtk-enforce.js", "git-commit-msg-gate.js", "autorizacao-gate.js"],
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
      } catch (erro) {
        // Falha closed (achado de review, 2026-09-10). Antes daqui saía um
        // `continue`: hook que não roda deixava a chamada seguir sem gate nenhum
        // — e em silêncio, que é o pior dos dois, porque o turno continuava
        // parecendo protegido.
        //
        // O comentário anterior argumentava que gate que derruba o turno acaba
        // desligado na primeira vez que atrapalha. O argumento continua de pé, e
        // é por isso que o bloqueio aqui é NOMEADO e traz a saída de escape no
        // motivo: o mantenedor lê o que quebrou e decide, em vez de descobrir
        // depois que o gate estava aberto o tempo todo.
        //
        // Alcança só falha de INFRAESTRUTURA (spawn, timeout, hook ausente).
        // Hook que roda e cala segue liberando — medido em 2026-09-10: os 5
        // hooks sinalizam "não é comigo" com exit 0 e saída vazia, então tratar
        // silêncio como falha bloquearia toda chamada benigna.
        const motivo = erro?.killed
          ? "esgotou o timeout de 5s"
          : `não pôde ser executado (${erro?.code || erro?.message || "erro desconhecido"})`;
        throw new Error(
          `[governanca/hook-indisponivel] O gate ${arquivo} ${motivo}, então esta chamada de ` +
            `${tool} não foi verificada. Falha closed: sem gate, não passa.

` +
            `Reproduza com o payload no stdin: node .claude/hooks/${arquivo}
` +
            "Conserte o hook, ou peça ao mantenedor autorização nominal para seguir sem ele.",
        );
      }

      // Saída vazia = "não é comigo". É como os 5 hooks sinalizam ausência de
      // veredito; não é falha, e por isso não fecha.
      if (!saida.trim()) continue;

      let decisao;
      try {
        decisao = JSON.parse(saida).hookSpecificOutput;
      } catch {
        // Hook falou, mas o que saiu não é JSON válido: pode ser um deny cujo
        // texto se corrompeu. Das duas leituras possíveis, interpretar como
        // liberação é a perigosa. Fecha.
        throw new Error(
          `[governanca/resposta-invalida] O gate ${arquivo} devolveu saída que não é JSON ` +
            "válido, então não dá para saber se era deny. Falha closed.\n\n" +
            `Saída recebida (240 primeiros chars): ${saida.trim().slice(0, 240)}`,
        );
      }

      const veredito = decisao?.permissionDecision;

      // `allow` é o único veredito que libera. Tudo mais para o turno.
      if (veredito === "allow") continue;

      // No OpenCode, bloquear é lançar. A mensagem do hook já traz o comando
      // corrigido no motivo — é o que torna o gate barato de obedecer.
      if (veredito === "deny") {
        throw new Error(decisao.permissionDecisionReason || "bloqueado pela governança do projeto");
      }

      // `ask` (achado de review, 2026-09-10) NÃO é tratado aqui — vai para o
      // hook `permission.ask` no fim deste arquivo, que devolve `output.status`
      // e faz o OpenCode abrir o prompt real de permissão.
      //
      // Bloquear aqui seria inverter o veredito: `ask` quer dizer "pergunte ao
      // mantenedor", e o OpenCode sabe perguntar. Traduzir para `throw` negaria
      // uma ação que ele talvez autorizasse, e ainda por cima em nome de uma
      // limitação que o harness não tem.
      if (veredito === "ask") continue;

      // Veredito ausente, vazio ou desconhecido: o hook falou (a saída não era
      // vazia) mas não deu um veredito interpretável. Mesma lógica do JSON
      // inválido acima — das duas leituras, tratar como liberação é a perigosa.
      throw new Error(
        `[governanca/veredito-desconhecido] O gate ${arquivo} devolveu ` +
          `permissionDecision=${JSON.stringify(veredito)}, que esta ponte não sabe interpretar. ` +
          "Falha closed: sem veredito claro, não passa.\n\n" +
          `Saída recebida (240 primeiros chars): ${saida.trim().slice(0, 240)}`,
      );
    }
  },

  // O OpenCode TEM prompt de permissão, e é aqui que ele se alcança:
  //   "permission.ask"?: (input: Permission, output: { status: "ask"|"deny"|"allow" })
  // (assinatura em packages/plugin/src/index.ts, sst/opencode).
  //
  // Por que existe: as 5 regras `ask` do autorizacao-gate — commit, worktree,
  // escrita na VM, SQL write e pacote novo — são as ações que o AGENTS.md
  // §Autorização mais protege, e `ask` é o veredito CERTO para elas: a regra é
  // "pergunte a cada vez", não "nunca". O `opencode.json` já declara as mesmas
  // famílias em `permission.bash`; este hook cobre o que padrão glob não
  // alcança (comando aninhado em `bash -lc`, caminho absoluto, `git -C`), que é
  // a razão de o autorizacao-gate existir nos outros dois harnesses.
  "permission.ask": async (input, output) => {
    // `metadata.command` é onde o OpenCode põe o comando ao pedir permissão de
    // bash — medido no binário 1.18.30: `o.ask({permission: …, metadata: {command: r.command}})`.
    // Permissão de outro tipo (read, edit, external_directory) não traz comando
    // e não é assunto do autorizacao-gate.
    const comando = input?.metadata?.command;
    if (typeof comando !== "string" || !comando.trim()) return;

    let saida = "";
    try {
      saida = execFileSync("node", [path.join(directory, ".claude", "hooks", "autorizacao-gate.js")], {
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: comando },
        }),
        encoding: "utf8",
        timeout: 5000,
        killSignal: "SIGKILL",
      });
    } catch {
      // Falha closed, como no `tool.execute.before`: gate que não roda vira
      // pergunta, nunca liberação silenciosa. Aqui dá para ser menos brusco
      // que um throw — `ask` já para a ação e põe a decisão no colo do
      // mantenedor, que é exatamente o que se quer quando o gate está cego.
      output.status = "ask";
      return;
    }

    if (!saida.trim()) return;

    let veredito;
    try {
      veredito = JSON.parse(saida).hookSpecificOutput?.permissionDecision;
    } catch {
      output.status = "ask";
      return;
    }

    // Só endurece, nunca afrouxa: se o opencode.json já decidiu `deny`, este
    // hook não rebaixa para `ask`/`allow`. Governança declarativa e hook se
    // somam, e o mais restritivo vence.
    if (output.status === "deny") return;
    if (veredito === "deny") output.status = "deny";
    else if (veredito === "ask") output.status = "ask";
  },
});
