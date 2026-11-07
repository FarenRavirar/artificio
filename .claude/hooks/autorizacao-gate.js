#!/usr/bin/env node
// Camada 3 da trava de autorizacao do AGENTS.md §Autorizacao. Spec 101, Fase 4 (F4.3).
//
// Por que existe, em uma frase: as regras declarativas dos tres harnesses
// (permissions.deny/ask no Claude Code, .codex/rules/governanca.rules no Codex,
// permission.bash no OpenCode) casam o comando pelo texto que o agente escreve,
// e a propria documentacao do Claude Code declara o limite — uma regra de Bash
// "isn't a security boundary around the program". Este hook e o que enxerga o
// que elas nao enxergam.
//
// O que escapa das regras declarativas, medido em 2026-09-10:
//   - caminho absoluto:      /usr/bin/git commit         (nenhuma das tres casa)
//   - flag antes do subcomando: git -C . commit          (matchedRules vazio no Codex)
//   - aninhado em shell:     bash -lc "cd /x && git commit"
//   - substituicao:          echo "$(git commit -m x)"
// O hook alcanca os quatro porque le `tool_input.command` — o texto integral da
// chamada, inclusive o que esta dentro das aspas de um `bash -lc`.
//
// Escopo deliberadamente estreito: este hook NAO reimplementa a lista inteira do
// AGENTS.md. As regras declarativas ja cobrem o caso comum e mostram o prompt ao
// mantenedor, que e o comportamento desejado. Aqui ficam so as acoes cujo
// escape e (a) plausivel na pratica e (b) caro de reverter. Regra que a camada
// declarativa ja cobre bem nao se duplica aqui: duplicar espalha a manutencao e
// faz as duas divergirem com o tempo.
//
// Decisao do mantenedor (2026-09-10): push e abrir PR ficam liberados; so o
// COMMIT pergunta. Por isso `git push` e `gh pr create` nao aparecem abaixo.
//
// Falha aberta, deliberadamente: payload ilegivel ou erro interno sai com 0. Um
// gate que derruba o turno e desligado na primeira vez que atrapalha, e ai nao
// protege mais nada.

'use strict';

const { lerPayload } = require(require('node:path').join(__dirname, 'ler-payload.js'));

const codex = process.argv.includes('--codex');

// Normaliza o texto antes de testar, para que o padrao nao precise antecipar
// cada forma de escrever o mesmo comando. Sem isto, cada regra viraria uma
// regex barroca e as evasoes passariam pelo que ela esquecesse.
function normalizar(cmd) {
  return cmd
    // Argumento de `echo`/`printf` e dado, nao execucao: `echo "git commit e o
    // assunto"` nao commita nada, e bloquear isso e o tipo de falso positivo que
    // faz o mantenedor desligar o gate. So a forma literal cai fora — uma
    // substituicao como `echo "$(git commit)"` executa de verdade e por isso e
    // preservada pelo negative lookahead do $(.
    .replace(/\b(?:echo|printf)\s+(['"])(?:(?!\1)[^$\\]|\\.)*\1/g, ' ')
    // Mesma logica para o padrao de busca: `rtk rg "git commit" docs` procura o
    // texto, nao commita. Achado pela propria suite em 2026-09-10.
    .replace(/\b(?:rg|grep|ag|ack|rtk\s+rg|rtk\s+grep)\s+(?:-\S+\s+)*(['"])(?:(?!\1)[^$\\]|\\.)*\1/g, ' ')
    // Caminho absoluto vira o executavel nu: /usr/bin/git -> git.
    .replace(/(^|[\s;&|(`$])(?:\/[\w.\-/]*\/)?(?=(?:git|gh|docker|apt-get|apt|scp|rsync|ssh|shutdown|reboot|poweroff|halt)\b)/g, '$1')
    // Aspas em torno do subcomando: git 'commit' -> git commit.
    .replace(/(^|\s)(['"])([\w-]+)\2/g, '$1$3')
    // Flags de configuracao entre o executavel e o subcomando:
    // git -C . commit / git -c k=v commit -> git commit.
    .replace(/\bgit(?:\s+-(?:C|c|-git-dir|-work-tree|-namespace|-exec-path)(?:=\S+|\s+\S+))+/g, 'git')
    .replace(/\s+/g, ' ');
}

const REGRAS = [
  // --- `deny`: bloqueio sem prompt. Nenhum pedido autoriza por interpretacao ---
  {
    nome: 'vm-desligamento',
    decisao: 'deny',
    // Ancorado em `ssh` ou em comando de sistema solto: derrubar a VM Oracle tira
    // producao inteira do ar (todos os subdominios, o SSO e os bancos) e quem
    // religa e o mantenedor, manualmente, no painel da Oracle.
    test: /(^|[\s;&|(`])(?:sudo\s+)?(?:shutdown|reboot|poweroff|halt|init\s+[06])\b|systemctl\s+(?:poweroff|reboot|halt)\b/,
    porque: 'AGENTS.md (petrea): NUNCA desligar, reiniciar ou suspender a VM Oracle. A VM hospeda producao inteira e nao ha caminho de volta pelo agente. Se o alvo e a maquina Windows local, rode no prompt local, nunca por aqui.',
  },
  {
    nome: 'amend-proibido',
    decisao: 'deny',
    // Duplicado de proposito com o git-commit-msg-gate: la o padrao e o texto
    // literal `--amend`; aqui ele passa pela normalizacao, entao tambem pega
    // `/usr/bin/git commit --amend` e a forma dentro de `bash -lc`.
    test: /\bgit\s+commit\b[^;&|]*--amend/,
    porque: 'AGENTS.md (petrea, sem excecao): `git commit --amend` e PROIBIDO. Reescreve commit ja em review e forca push --force. Faca commit novo.',
  },
  {
    nome: 'push-force',
    decisao: 'deny',
    test: /\bgit\s+push\b[^;&|]*(?:--force(?!-with-lease)|--force-with-lease|\s-f\b)/,
    porque: 'AGENTS.md: push que reescreve historico de branch em review exige aprovacao nominal do mantenedor, nunca por inercia.',
  },

  // --- `ask`: exige autorizacao nominal por acao (§Autorizacao) ---
  //
  // Estas PERGUNTAM ao mantenedor; nao bloqueiam. Emitiam `deny` ate 2026-09-10,
  // o que tornava a acao impossivel por este harness mesmo com a autorizacao ja
  // dada: o gate nao distinguia "nao autorizado" de "autorizado", porque nunca
  // chegava a perguntar. O AGENTS.md ja dizia o correto — "commit, worktree,
  // escrita na VM, SQL write e pacote novo sao `ask`" — e era o hook que
  // divergia do texto que implementa. Achado ao tentar commitar a propria
  // spec 101 (F5), com autorizacao nominal dada e recusada pelo gate.
  {
    nome: 'commit-sem-autorizacao',
    decisao: 'ask',
    test: /\bgit\s+commit\b/,
    porque: 'AGENTS.md §Autorizacao: cada commit exige autorizacao nominal do mantenedor — nao acumula entre commits, mesmo em branch ja pushada, mesmo no mesmo PR, mesmo na mesma conversa. "pode seguir"/"corrija"/"documente" NAO autorizam commit.',
  },
  {
    nome: 'worktree-sem-aprovacao',
    decisao: 'ask',
    test: /\bgit\s+worktree\s+(?:add|move|remove)\b/,
    porque: 'AGENTS.md §Autorizacao: criar/mover/remover worktree exige aprovacao nominal PREVIA. Explique antes por que o cwd nao pode ser usado, o caminho exato, e como o trabalho volta. `git worktree list` e livre.',
  },
  {
    nome: 'git-historico-sem-aprovacao',
    decisao: 'ask',
    test: /\bgit\s+(?:merge|rebase|reset|cherry-pick)\b/,
    porque: 'AGENTS.md §Autorizacao: merge e reescrita de historico exigem aprovacao nominal.',
  },
  {
    nome: 'workflow-sem-aprovacao',
    decisao: 'ask',
    test: /\bgh\s+(?:pr\s+merge|workflow\s+run|run\s+rerun)\b/,
    porque: 'AGENTS.md §Autorizacao: merge e disparo de workflow exigem aprovacao nominal.',
  },
  {
    nome: 'vm-escrita',
    decisao: 'ask',
    // `ssh faren` com subcomando de mutacao. Read-only na VM e livre por regra
    // petrea e nao pode cair aqui — dai a lista fechada de verbos de escrita.
    test: /\bssh\s+faren\b[^;&|]*\b(?:docker\s+(?:restart|stop|start|rm|kill|cp|compose\s+(?:up|down))|systemctl\s+(?:start|stop|restart)|rm\s+-|mv\s|cp\s|tee\s|>\s*\/)/,
    porque: 'AGENTS.md §Autorizacao: escrita na VM Oracle exige aprovacao nominal a cada vez. Inspecao read-only (docker ps|logs|inspect, psql SELECT, cat, ls) e SEMPRE permitida e nao passa por aqui.',
  },
  {
    nome: 'docker-local-escrita',
    decisao: 'ask',
    test: /(?:^|[\s;&|(`])docker\s+(?:restart|stop|rm|cp|compose\s+(?:up|down))\b/,
    porque: 'AGENTS.md §Autorizacao: mutacao Docker exige aprovacao nominal.',
  },
  {
    nome: 'copia-remota-sem-aprovacao',
    decisao: 'ask',
    test: /(?:^|[\s;&|(`])(?:scp|rsync)\s/,
    porque: 'AGENTS.md §Autorizacao: copiar ou sincronizar arquivos com a VM exige aprovacao nominal.',
  },
  {
    nome: 'sql-write-producao',
    decisao: 'ask',
    test: /\bpsql\b[^;&|]*\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i,
    porque: 'AGENTS.md §Banco: SQL write em producao exige aprovacao explicita + dry-run + plano de rollback registrados. `SELECT` e `pg_dump` sao read-only e livres.',
  },
  {
    nome: 'pacote-novo',
    decisao: 'ask',
    test: /(?:^|[\s;&|(`])(?:sudo\s+)?apt(?:-get)?\s+install\b/,
    porque: 'AGENTS.md §Autorizacao: pacote apt novo exige PERGUNTAR antes — qual pacote, por que e necessario, alternativa ja existente no repo, e impacto. So instala depois da resposta.',
  },
];

function eLeituraRemotaSeguraCodex(command) {
  const match = command.trim().match(/^rtk\s+ssh\s+faren\s+(.+)$/);
  if (!match) return false;

  const remoto = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  // PermissionRequest so libera uma chamada remota simples. Qualquer operador
  // de shell pode anexar escrita a um comando que comeca read-only.
  if (/[\r\n;&|`<>]|\$\(|\$\{/.test(remoto)) return false;

  if (/^psql\b/i.test(remoto)) {
    if (!/\bSELECT\b/i.test(remoto)
      || /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|COPY|CALL|DO|INTO|FOR\s+UPDATE)\b/i.test(remoto)) {
      return false;
    }
    const funcoes = [...remoto.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((item) => item[1].toLowerCase());
    return funcoes.every((nome) => /^(?:count|min|max|sum|avg|coalesce)$/.test(nome));
  }

  const argumentosDeEscrita = [
    /^find\b.*\s-(?:delete|exec|execdir|ok|okdir|fls|fprint0?|fprintf)\b/i,
    /^curl\b.*\s(?:-[oOTdFX]|--(?:output|remote-name|upload-file|data(?:-ascii|-binary|-raw|-urlencode)?|form(?:-string)?|request|create-dirs|remove-on-error|etag-save|dump-header))(?:\s|=|$)/i,
    /^pg_dump\b.*\s(?:-f\b|--file(?:\s|=))/i,
    /^journalctl\b.*\s--(?:vacuum-(?:time|size|files)|rotate|flush|sync|relinquish-var|smart-relinquish-var|setup-keys)\b/i,
    /^rg\b.*\s--pre(?:\s|=)/i,
    /^git\s+(?:status|log|diff)\b.*\s--output(?:\s|=)/i,
  ];
  if (argumentosDeEscrita.some((padrao) => padrao.test(remoto))) return false;

  return /^(?:docker\s+(?:ps|logs|inspect|stats|images|system\s+df)\b|(?:ls|cat|head|tail|df|free|uptime|nproc|whoami|grep|rg|find|stat|wc|pg_dump|journalctl)\b|curl\s+-s\b|git\s+(?:status|log|diff)\b|systemctl\s+status\b)/.test(remoto);
}

lerPayload((raw) => {
  let command = '';
  let evento = '';
  try {
    const payload = JSON.parse(raw);
    command = payload?.tool_input?.command ?? '';
    evento = payload?.hook_event_name ?? '';
  } catch {
    process.exit(0); // payload ilegivel nunca bloqueia trabalho
  }
  if (!command) process.exit(0);

  const alvo = normalizar(command);
  const regra = REGRAS.find((item) => item.test.test(alvo));

  if (evento === 'PermissionRequest') {
    if (regra?.decisao === 'deny') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: {
            behavior: 'deny',
            message: `[autorizacao-gate/${regra.nome}] ${regra.porque}`,
          },
        },
      }));
    } else if (!regra && eLeituraRemotaSeguraCodex(alvo)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'allow' },
        },
      }));
    }
    // `ask` no PermissionRequest significa nao decidir: o prompt normal continua.
    process.exit(0);
  }

  if (!regra || (codex && regra.decisao === 'ask')) process.exit(0);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: regra.decisao,
      permissionDecisionReason:
        `[autorizacao-gate/${regra.nome}] ${regra.porque}`
        // No `ask`, o proprio prompt E o pedido de autorizacao: mandar o agente
        // "pedir antes de reemitir" faria ele pedir duas vezes a mesma coisa.
        // No `deny` nao ha prompt, entao a saida de escape precisa vir no texto.
        + (regra.decisao === 'ask'
          ? ''
          : `\n\nPeca a autorizacao ao mantenedor no formato "APROVACAO NECESSARIA" `
            + `(Acao / Motivo / Risco / Rollback / Escopo / Comandos) antes de reemitir.`),
    },
  }));

  process.exit(0);
});
