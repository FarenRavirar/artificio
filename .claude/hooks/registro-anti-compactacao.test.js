#!/usr/bin/env node
// Suíte do registro-anti-compactacao. Roda com: node registro-anti-compactacao.test.js
//
// O par que importa: COBRA o turno que mediu e não escreveu, e DEIXA PASSAR o
// turno de rotina. Gate que nunca reprova é decoração; gate que reprova demais é
// hostil e acaba desligado — que dá no mesmo.
//
// O transcript é fabricado aqui no formato real medido em 2026-09-12 no jsonl da
// sessão: uma linha JSON por evento, prompt humano é `{type:"user"}` com
// `message.content` string e sem `isMeta`, e chamada de ferramenta é bloco
// `{type:"tool_use", name, input}` dentro de `message.content` de um `assistant`.

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const assert = require("node:assert");

const GATE = path.join(__dirname, "registro-anti-compactacao.js");

const promptHumano = (texto) =>
  JSON.stringify({ type: "user", message: { content: texto } });

const usoDeFerramenta = (name, input) =>
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input }] },
  });

// Resultado de ferramenta: linha `user` com content em ARRAY. Não pode ser
// confundida com prompt humano, senão o gate cortaria o turno no meio.
const resultadoDeFerramenta = () =>
  JSON.stringify({
    type: "user",
    message: { content: [{ type: "tool_result", content: "saída" }] },
  });

// O gate bloqueia com `exit 2` (+ stderr), então `execFileSync` lança. O código
// de saída faz parte do contrato e é asserido junto com o corpo.
function roda(linhas, extra = {}) {
  const arquivo = path.join(
    os.tmpdir(),
    `rac-test-${process.pid}-${Math.random().toString(36).slice(2)}.jsonl`,
  );
  fs.writeFileSync(arquivo, linhas.join("\n"));
  const entrada = JSON.stringify({
    session_id: "teste",
    hook_event_name: "Stop",
    transcript_path: arquivo,
    ...extra,
  });
  try {
    const saida = execFileSync("node", [GATE], {
      input: entrada,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, out: saida, err: "" };
  } catch (e) {
    return { code: e.status, out: e.stdout ?? "", err: e.stderr ?? "" };
  } finally {
    fs.rmSync(arquivo, { force: true });
  }
}

const json = (r) => (r.out.trim() ? JSON.parse(r.out) : null);
const bloqueou = (r) => r.code === 2 && json(r)?.decision === "block";
const motivo = (r) => json(r)?.reason ?? "";

const bash = (cmd) => usoDeFerramenta("Bash", { command: cmd });

// Turno com medição de sobra, sem nenhuma escrita.
const turnoQueMediu = [
  promptHumano("investiga o proxy"),
  bash("docker compose config"),
  resultadoDeFerramenta(),
  bash("node probe.mjs"),
  resultadoDeFerramenta(),
  bash("rtk tsc -b"),
  bash("rtk git diff --stat"),
];

let ok = 0;
const t = (nome, fn) => {
  try {
    fn();
    ok++;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    console.error(`  FALHOU  ${nome}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

console.log("registro-anti-compactacao:");

t("cobra turno que mediu e não registrou", () => {
  const r = roda(turnoQueMediu);
  assert(bloqueou(r), "deveria cobrar");
  assert(motivo(r).includes("4 medições"), "deveria contar as medições");
});

t("o motivo ensina os 5 gatilhos e o destino", () => {
  const m = motivo(roda(turnoQueMediu));
  assert(m.includes("falha em silêncio"), "deveria listar o gatilho do bug latente");
  assert(m.includes("prod e beta"), "deveria listar o gatilho do valor por ambiente");
  assert(m.includes("tasks.md"), "deveria dizer o destino");
  assert(m.includes("nunca"), "deveria lembrar de reescrever, não anexar");
});

t("NÃO cobra quando escreveu no tasks.md da spec", () => {
  const r = roda([
    ...turnoQueMediu,
    usoDeFerramenta("Edit", {
      file_path: "C:/projetos/artificio/specs/102-seo-indexacao-recuperacao/tasks.md",
    }),
  ]);
  assert(!bloqueou(r), "escrita na spec é exatamente o que o gate quer");
});

t("NÃO cobra quando escreveu em spec.md ou plan.md", () => {
  for (const alvo of ["spec.md", "plan.md"]) {
    const r = roda([
      ...turnoQueMediu,
      usoDeFerramenta("Write", { file_path: `specs/102-foo/${alvo}` }),
    ]);
    assert(!bloqueou(r), `${alvo} deveria contar como registro`);
  }
});

t("NÃO cobra quando escreveu em doc de governança", () => {
  for (const alvo of [
    "C:/projetos/artificio/AGENTS.md",
    "C:/projetos/artificio/.specify/memory/errors.md",
    "C:/projetos/artificio/.agents/skills/new-spec/SKILL.md",
  ]) {
    const r = roda([...turnoQueMediu, usoDeFerramenta("Edit", { file_path: alvo })]);
    assert(!bloqueou(r), `${alvo} deveria contar como registro`);
  }
});

t("escrita SÓ em código não conta como registro", () => {
  const r = roda([
    ...turnoQueMediu,
    usoDeFerramenta("Write", { file_path: "apps/mesas/frontend/server.js" }),
  ]);
  assert(bloqueou(r), "código não preserva estado da spec através da compactação");
});

t("NÃO cobra turno de rotina (poucas medições)", () => {
  const r = roda([promptHumano("qual a branch?"), bash("git branch --show-current")]);
  assert(!bloqueou(r), "um comando solto não é investigação");
});

t("NÃO cobra turno sem medição nenhuma", () => {
  const r = roda([promptHumano("explica o que é SSR")]);
  assert(!bloqueou(r));
});

t("Read não conta como medição (é o modo normal de trabalhar)", () => {
  const r = roda([
    promptHumano("lê esses arquivos"),
    usoDeFerramenta("Read", { file_path: "a.ts" }),
    usoDeFerramenta("Read", { file_path: "b.ts" }),
    usoDeFerramenta("Read", { file_path: "c.ts" }),
    usoDeFerramenta("Read", { file_path: "d.ts" }),
    usoDeFerramenta("Read", { file_path: "e.ts" }),
  ]);
  assert(!bloqueou(r), "cobrar leitura dispararia em todo turno");
});

t("Grep e MCP de grafo contam como medição", () => {
  const r = roda([
    promptHumano("investiga"),
    usoDeFerramenta("Grep", { pattern: "proxy_pass" }),
    usoDeFerramenta("Glob", { pattern: "**/*.conf" }),
    usoDeFerramenta("mcp__codebase-memory-mcp__search_graph", { q: "og" }),
    usoDeFerramenta("mcp__code-review-graph__query_graph_tool", { q: "x" }),
  ]);
  assert(bloqueou(r), "busca estrutural é medição tanto quanto Bash");
});

t("só conta o ÚLTIMO turno", () => {
  const r = roda([
    ...turnoQueMediu, // turno anterior: mediu e não registrou
    promptHumano("agora só me diz oi"),
    bash("echo oi"),
  ]);
  assert(!bloqueou(r), "turno anterior não contamina o atual");
});

t("registro do turno anterior não isenta o atual", () => {
  const r = roda([
    promptHumano("registra isso"),
    usoDeFerramenta("Edit", { file_path: "specs/102-foo/tasks.md" }),
    ...turnoQueMediu,
  ]);
  assert(bloqueou(r), "o que vale é a escrita DENTRO do turno que mediu");
});

t("stop_hook_active corta o laço", () => {
  const r = roda(turnoQueMediu, { stop_hook_active: true });
  assert(!bloqueou(r), "sem isso o gate prenderia a sessão para sempre");
});

t("resultado de ferramenta não é confundido com prompt humano", () => {
  // Se `tool_result` fosse lido como início de turno, o gate veria zero
  // medições e nunca cobraria nada. É o bug mais fácil de introduzir aqui.
  const r = roda(turnoQueMediu);
  assert(bloqueou(r), "as medições antes do último tool_result precisam contar");
});

t("transcript ausente não atrapalha o trabalho", () => {
  const saida = execFileSync("node", [GATE], {
    input: JSON.stringify({ transcript_path: "C:/nao/existe.jsonl" }),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.strictEqual(saida.trim(), "", "deveria sair em silêncio");
});

t("entrada malformada não atrapalha o trabalho", () => {
  const saida = execFileSync("node", [GATE], {
    input: "isto não é json",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.strictEqual(saida.trim(), "", "deveria sair em silêncio");
});

t("bloqueia com exit 2 e repete o motivo no stderr", () => {
  const r = roda(turnoQueMediu);
  assert.strictEqual(r.code, 2, "exit 2 é o canal que doc e plugin concordam");
  assert(r.err.includes("medições"), "stderr é o corpo visível ao modelo");
});

t("não emite hookSpecificOutput (Stop não é membro da união do CC)", () => {
  const j = json(roda(turnoQueMediu));
  assert(!("hookSpecificOutput" in j), "reprovaria a validação e vazaria JSON cru");
  assert(typeof j.reason === "string" && j.reason.length > 0);
});

// Antes este caso usava `bash("echo oi")` e afirmava que UMA medição libera —
// premissa do limiar 4, derrubada pela determinação do mantenedor em 2026-09-12
// ("to falando a cada etapa"). Com `MINIMO_DE_MEDICOES = 1`, uma medição sem
// registro É o defeito que o hook existe para pegar, e o teste passou a afirmar
// isso. O caminho de liberação que sobra é o turno sem medição nenhuma.
t("turno sem medição sai com exit 0 e sem ruído", () => {
  const r = roda([promptHumano("oi")]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out.trim(), "", "não deve poluir o stdout quando libera");
});

t("UMA medição sem registro já cobra (limiar 1, 'a cada etapa')", () => {
  const r = roda([promptHumano("oi"), bash("echo oi")]);
  assert.strictEqual(r.code, 2, "uma medição sozinha é o achado caro que se perde");
});

t("UMA medição COM registro na spec libera", () => {
  const r = roda([
    promptHumano("oi"),
    bash("echo oi"),
    usoDeFerramenta("Write", { file_path: "specs/102-seo-indexacao-recuperacao/tasks.md" }),
  ]);
  assert.strictEqual(r.code, 0);
});

console.log(`\n${ok} passaram`);
