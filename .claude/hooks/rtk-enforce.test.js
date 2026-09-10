#!/usr/bin/env node
// Suíte do rtk-enforce. Roda com: node rtk-enforce.test.js
//
// Existe pelo mesmo motivo de `git-commit-msg-gate.test.js`: regra de hook que
// bloqueia comando precisa de teste, porque um falso-positivo trava trabalho
// legítimo e ninguém descobre até doer. Os casos "passa" importam mais que os
// "bloqueia" — cada um deles é um modo de falha em que o gate atrapalharia.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const HOOK = path.join(__dirname, 'rtk-enforce.js');

const CASES = [
  // --- leitura-parcial-crua (regra nova, 2026-08-07) ---
  { cmd: `sed -n '1,50p' arquivo.ts`, deny: true, rule: 'leitura-parcial-crua' },
  { cmd: `sed -n '300,345p' .github/workflows/_deploy-module.yml`, deny: true, rule: 'leitura-parcial-crua' },
  { cmd: `sed -n "1,20p" src/app.ts`, deny: true, rule: 'leitura-parcial-crua' },
  { cmd: `awk 'NR<50' x.ts`, deny: true, rule: 'leitura-parcial-crua' },

  // Filtro de pipe NÃO é leitura de arquivo — bloquear aqui quebraria o jeito
  // canônico de filtrar segredo da saída da VM (AGENTS.md §Autorização).
  { cmd: `ssh faren 'sed "s/=.*/=<omitido>/" /opt/artificio/apps/accounts/.env'`, deny: false },
  { cmd: `cat x.md | sed 's/a/b/'`, deny: false },
  { cmd: `git log | awk '{print $1}'`, deny: false },
  { cmd: `rtk read x.ts`, deny: false },
  // Substituição in-place não é leitura.
  { cmd: `sed -i 's/foo/bar/' x.ts`, deny: false },

  // --- regras pré-existentes: não podem regredir ---
  { cmd: `pnpm verify:api`, deny: true, rule: 'pnpm-script-sem-run' },
  { cmd: `pnpm test`, deny: true, rule: 'pnpm-script-sem-run' },
  { cmd: `pnpm run lint`, deny: true, rule: 'script-pesado-sem-rtk' },
  { cmd: `pnpm --filter @artificio/accounts test`, deny: true, rule: 'pnpm-filter' },
  { cmd: `rtk pnpm run lint`, deny: false },
  { cmd: `rtk pnpm verify:api`, deny: false },
  { cmd: `pnpm install`, deny: false },
  { cmd: `cd apps/accounts && rtk tsc -p tsconfig.json`, deny: false },
  { cmd: `rtk tsc`, deny: true, rule: 'rtk-subcomando-quebrado-no-turbo' },

  // --- tsc-project-agregador (regra nova, 2026-09-02, incidente da PR #304) ---
  // Nos dois apps medidos, `tsconfig.json` tem `"files": []`: o `-p` checa ZERO
  // arquivos e devolve "No errors found" mesmo com erro real de tipo.
  {
    cmd: `cd apps/mesas/frontend && rtk tsc -p tsconfig.json --noEmit`,
    deny: true,
    rule: 'tsc-project-agregador',
  },
  {
    cmd: `cd apps/downloads/frontend && rtk tsc -p tsconfig.json --noEmit`,
    deny: true,
    rule: 'tsc-project-agregador',
  },
  { cmd: `cd apps/mesas/frontend && tsc -p ./tsconfig.json`, deny: true, rule: 'tsc-project-agregador' },

  // O comando CERTO passa — é o que o CI roda.
  { cmd: `cd apps/mesas/frontend && rtk tsc -b`, deny: false },
  // Apontar para um config FILHO é legítimo: checa aquele projeto de verdade.
  { cmd: `cd apps/mesas/frontend && rtk tsc -p tsconfig.app.json --noEmit`, deny: false },
  { cmd: `cd apps/mesas/frontend && rtk tsc -p tsconfig.test.json --noEmit`, deny: false },
  // Os demais pacotes NÃO são agregadores: `-p tsconfig.json` continua válido.
  { cmd: `cd apps/mesas/backend && rtk tsc -p tsconfig.json --noEmit`, deny: false },
  { cmd: `cd packages/catalog-ui && rtk tsc -p tsconfig.json --noEmit`, deny: false },
];

let failed = 0;

for (const testCase of CASES) {
  let out = '';
  try {
    out = execFileSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_input: { command: testCase.cmd } }),
      encoding: 'utf8',
    });
  } catch {
    console.log(`ERRO ao executar: ${testCase.cmd}`);
    failed += 1;
    continue;
  }

  const denied = out.includes('"permissionDecision":"deny"');

  if (denied !== testCase.deny) {
    console.log(`FALHOU  ${testCase.cmd}`);
    console.log(`        esperado ${testCase.deny ? 'DENY' : 'passar'}, obteve ${denied ? 'DENY' : 'passou'}`);
    failed += 1;
    continue;
  }

  if (denied && testCase.rule) {
    const reason = JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
    if (!reason.includes(testCase.rule)) {
      console.log(`FALHOU  ${testCase.cmd}`);
      console.log(`        regra esperada ${testCase.rule}, motivo: ${reason.split('\n')[0]}`);
      failed += 1;
      continue;
    }
  }

  console.log(`ok      ${denied ? '[DENY]' : '[pass]'} ${testCase.cmd}`);
}

console.log('');
if (failed > 0) {
  console.log(`${failed} de ${CASES.length} falharam`);
  process.exit(1);
}
console.log(`${CASES.length}/${CASES.length} passaram`);
