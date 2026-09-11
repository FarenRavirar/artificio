#!/usr/bin/env node
// Suíte do deploy-contract-gate. Roda com: node deploy-contract-gate.test.js
//
// O que importa aqui é o par: BLOQUEIA o que deve e DEIXA PASSAR o que não deve.
// Gate que nunca reprova é decoração; gate que reprova demais é hostil e acaba
// desligado — que dá no mesmo.

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert");

const GATE = path.join(__dirname, "deploy-contract-gate.js");

function roda(file_path, session_id = "test-" + Math.random()) {
  const saida = execFileSync("node", [GATE], {
    input: JSON.stringify({ session_id, tool_input: { file_path } }),
    encoding: "utf8",
  });
  return saida.trim() ? JSON.parse(saida) : null;
}

const bloqueou = (r) => r?.hookSpecificOutput?.permissionDecision === "deny";
const secao = (r) => r?.hookSpecificOutput?.permissionDecisionReason ?? "";

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

console.log("deploy-contract-gate:");

t("bloqueia migration e aponta §3", () => {
  const r = roda("apps/mesas/database/migration_155_foo.sql");
  assert(bloqueou(r), "deveria bloquear");
  assert(secao(r).includes("§3"), "deveria citar a §3");
});

t("bloqueia Dockerfile e aponta §1", () => {
  const r = roda("apps/mesas/backend/Dockerfile");
  assert(bloqueou(r));
  assert(secao(r).includes("§1"));
});

t("bloqueia Dockerfile com sufixo (Dockerfile.prod)", () => {
  assert(bloqueou(roda("apps/site/Dockerfile.prod")));
});

t("bloqueia pnpm-lock.yaml e aponta §2", () => {
  const r = roda("pnpm-lock.yaml");
  assert(bloqueou(r));
  assert(secao(r).includes("§2"));
  // A dica operacional precisa estar no motivo: é o que evita o erro de novo.
  assert(secao(r).includes("--lockfile-only"), "deveria ensinar o comando certo");
});

t("bloqueia package.json (muda resolução tanto quanto o lock)", () => {
  assert(bloqueou(roda("packages/ui/package.json")));
});

t("bloqueia workflow e manifesto, apontando §6", () => {
  assert(bloqueou(roda(".github/workflows/deploy.yml")));
  assert(bloqueou(roda(".github/deploy-manifest.json")));
});

t("NÃO bloqueia código comum", () => {
  assert(!bloqueou(roda("packages/ui/src/styles.css")));
  assert(!bloqueou(roda("apps/mesas/frontend/src/pages/MestrePage.tsx")));
});

t("NÃO bloqueia .sql que não é migration", () => {
  assert(!bloqueou(roda("apps/mesas/database/seed.sql")));
});

t("NÃO bloqueia yml fora de .github/workflows", () => {
  assert(!bloqueou(roda("apps/mesas/docker-compose.beta.yml")));
});

t("cobra uma vez por família, por sessão", () => {
  // Sessão única por execução: a marca vive no tmp e sobrevive entre rodadas,
  // então um id fixo faria o teste passar na 1ª vez e falhar na 2ª.
  const s = "sessao-" + process.pid + "-" + Date.now();
  assert(bloqueou(roda("apps/mesas/database/migration_1_a.sql", s)), "1ª cobra");
  assert(!bloqueou(roda("apps/mesas/database/migration_2_b.sql", s)), "2ª não repete");
  // Família diferente na mesma sessão continua cobrando: são riscos distintos.
  assert(bloqueou(roda("apps/mesas/backend/Dockerfile", s)), "outra família cobra");
});

t("entrada malformada não atrapalha o trabalho", () => {
  const saida = execFileSync("node", [GATE], { input: "isto não é json", encoding: "utf8" });
  assert.strictEqual(saida.trim(), "", "deveria sair em silêncio");
});

console.log(`\n${ok} passaram`);
