#!/usr/bin/env node
// registro-anti-compactacao — Stop: cobra o registro do que foi MEDIDO quando o
// turno termina sem escrever na spec ativa.
//
// POR QUE EXISTE
// A compactação de contexto apaga a medição que MATOU uma hipótese — e o que
// sobra é a hipótese. O agente então refaz a mesma investigação no turno
// seguinte, chega ao mesmo achado, e gasta ciclos que o mantenedor paga.
//
// Incidente que originou o hook (2026-09-12, spec 102 T4.2): três defeitos de
// proxy foram medidos com backend de eco — `app.use('/api', ...)` tira o prefixo
// do `req.url`; `pathFilter` em array mistuando glob com caminho plano lança
// HPM_INVALID_PATH_FILTER_ARRAY_CONFIG e não casa nada; caminho plano casa por
// prefixo, não por igualdade. Os três foram relatados no chat e NÃO foram
// escritos na spec. Depois da compactação seguinte, a informação não existia
// mais em lugar nenhum recuperável.
//
// A regra do mantenedor é de uma linha: "se já descobre, escreve."
//
// POR QUE `Stop` E NÃO `PreToolUse(Edit|Write)`
// Cobrar na edição do `tasks.md` dispara quando o agente JÁ está escrevendo —
// tarde e ao contrário. O defeito é o turno que termina COM medição e SEM
// escrita. Isso só é observável no fim do turno.
//
// POR QUE NÃO DEPENDE DE O AGENTE LEMBRAR
// A mesma razão do `deploy-contract-gate`: a regra já estava escrita no
// `AGENTS.md` e na skill `new-spec`, e mesmo assim falhou — porque documentação
// é lida no T0, e a decisão de não registrar vem horas depois. Regra que depende
// de memória é regra que falha; regra que depende de memória ATRAVÉS de
// compactação falha sempre.
//
// COMO ESCAPAR LEGITIMAMENTE
// Escrever na spec ativa (qualquer `Edit`/`Write` em `specs/<ativa>/`) no mesmo
// turno. Turno sem medição real não é cobrado. A cobrança é uma vez por turno:
// se o agente parar de novo sem escrever, `stop_hook_active` corta, para não
// prender a sessão em laço.

const { lerPayload } = require(require('node:path').join(__dirname, 'ler-payload.js'));
const fs = require('node:fs');
const path = require('node:path');

// Quantas chamadas de medição num turno já caracterizam investigação.
//
// Era 4, com o raciocínio de que "1 `ls` é rotina e cobrar seria hostil". Medido
// na sessão de 2026-09-12 que esse raciocínio está errado: o limiar deixa passar
// justamente o turno pequeno que descobre uma coisa só — e uma coisa só é o
// tamanho típico do achado caro. Naquela sessão, `react-router` ausente da árvore
// do `mesas`, o CodeRabbit recusando por tamanho, e o hook que cobra registro
// existindo apenas no commit `4bb3108` foram cada um UMA medição, e cada um
// custou horas ao mantenedor quando se perdeu no contexto.
//
// Determinação do mantenedor, literal: "to falando a cada etapa". Registro não é
// tarefa de fim de turno — é de cada etapa. `1` é o valor que implementa isso.
// O custo de um falso-positivo é uma frase ("medição de rotina, nada a
// registrar", que o próprio motivo do bloqueio já autoriza); o custo do
// falso-negativo é trabalho perdido.
const MINIMO_DE_MEDICOES = 1;

// Ferramentas que produzem conhecimento novo sobre o sistema. `Read` fica de
// fora de propósito: ler arquivo é o modo normal de trabalhar e dispararia em
// todo turno. O que caracteriza medição é executar algo ou consultar o grafo.
const FERRAMENTAS_DE_MEDICAO = new Set([
  'Bash',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
]);

const PREFIXO_MCP_MEDICAO = /^mcp__(codebase-memory-mcp|code-review-graph|artificio-api-governance)__/;

function eMedicao(nome) {
  return FERRAMENTAS_DE_MEDICAO.has(nome) || PREFIXO_MCP_MEDICAO.test(nome || '');
}

// Escrita que conta como registro: doc de spec, e os docs de governança que
// guardam regra durável. Código não conta — comentário em código é o destino
// certo para explicar o código, mas não sobrevive como estado da spec.
// `(^|\/)` e não `\/`: o caminho pode chegar relativo, começando já em
// `specs/` — mesmo defeito que a suíte do `deploy-contract-gate` pegou na
// primeira versão dele (ver o comentário da família "workflow" lá).
function eRegistro(arquivo) {
  const p = String(arquivo || '').replace(/\\/g, '/');
  return (
    /(^|\/)specs\/[^/]+\/(tasks|spec|plan)\.md$/i.test(p) ||
    /(^|\/)\.specify\/memory\/(errors|project-state|decisions)\.md$/i.test(p) ||
    /(^|\/)AGENTS\.md$/i.test(p) ||
    /(^|\/)\.agents\/skills\/[^/]+\/SKILL\.md$/i.test(p)
  );
}

// Lê o transcript de trás para frente até o último prompt real do usuário.
// Linha de usuário com `content` string e sem `isMeta` é prompt humano; as
// demais linhas `user` são resultado de ferramenta ou injeção do harness.
function lerUltimoTurno(transcriptPath) {
  let bruto;
  try {
    bruto = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null; // sem transcript legível não há o que julgar
  }

  const linhas = bruto.split('\n').filter(Boolean);
  let inicio = 0;
  for (let i = linhas.length - 1; i >= 0; i--) {
    let j;
    try {
      j = JSON.parse(linhas[i]);
    } catch {
      continue;
    }
    if (j.type === 'user' && !j.isMeta && typeof j.message?.content === 'string') {
      inicio = i;
      break;
    }
  }

  let medicoes = 0;
  let registrou = false;
  const comandos = [];

  for (let i = inicio; i < linhas.length; i++) {
    let j;
    try {
      j = JSON.parse(linhas[i]);
    } catch {
      continue;
    }
    const conteudo = j.message?.content;
    if (!Array.isArray(conteudo)) continue;
    for (const bloco of conteudo) {
      if (bloco.type !== 'tool_use') continue;
      if (eMedicao(bloco.name)) {
        medicoes++;
        const cmd = bloco.input?.command || bloco.input?.pattern || '';
        if (cmd) comandos.push(String(cmd).replace(/\s+/g, ' ').slice(0, 70));
      }
      if ((bloco.name === 'Edit' || bloco.name === 'Write') && eRegistro(bloco.input?.file_path)) {
        registrou = true;
      }
    }
  }

  return { medicoes, registrou, comandos };
}

lerPayload((bruto) => {
  let entrada;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    process.exit(0); // não entendeu a entrada: não atrapalha
  }

  // Trava de laço. O CC marca `stop_hook_active` quando a parada já foi
  // bloqueada por hook — sem isso o gate prenderia a sessão para sempre.
  if (entrada?.stop_hook_active) process.exit(0);

  const transcript = entrada?.transcript_path;
  if (!transcript) process.exit(0);

  const turno = lerUltimoTurno(transcript);
  if (!turno) process.exit(0);

  if (turno.medicoes < MINIMO_DE_MEDICOES) process.exit(0);
  if (turno.registrou) process.exit(0);

  const amostra = turno.comandos.slice(0, 4).map((c) => `  - ${c}`).join('\n');

  const motivo = [
    `[registro-anti-compactacao] ${turno.medicoes} medições neste turno, nenhuma escrita em doc de spec/governança.`,
    '',
    'Amostra do que foi medido:',
    amostra || '  (sem comando capturado)',
    '',
    'A compactação apaga a medição e preserva a hipótese — é assim que o mesmo',
    'achado é reinvestigado turno após turno. Se já descobriu, escreve.',
    '',
    'Registrar SE (e só se) o turno produziu um destes:',
    '  1. forma óbvia que não funciona — com o sintoma medido;',
    '  2. medição que contradiz o que a spec afirmava;',
    '  3. valor que varia entre prod e beta;',
    '  4. bug latente que falha em silêncio;',
    '  5. decisão de NÃO fazer algo, com o motivo.',
    '',
    'Destino: comentário no código quando explica o código; `tasks.md` da spec',
    'ativa quando muda estado ou contrato. Reescrever o bloco existente, nunca',
    'anexar (AGENTS.md §Conclusão de Tarefas).',
    '',
    'Se nada disso se aplica — medição de rotina, leitura exploratória, confirmação',
    'do que já estava escrito — responda dizendo isso e encerre. O gate não cobra',
    'duas vezes no mesmo turno.',
  ].join('\n');

  // Canal de saída: `exit 2` + stderr. É a única forma em que a doc oficial do
  // CC e o código do plugin `security-guidance` concordam.
  //
  // O que NÃO usar aqui: `hookSpecificOutput{hookEventName:"Stop"}`. A doc
  // sugere essa forma, mas o plugin oficial documenta o contrário em
  // `security_reminder_hook.py:242-255` — `Stop` não é membro da união
  // `hookSpecificOutput` (coreSchemas.ts), então a linha reprova
  // `isSyncHookJSONOutput` e o motivo vaza como JSON cru para o modelo. Entre a
  // doc e o código que roda, vale o código.
  //
  // `decision`/`reason` no stdout cobre o caminho síncrono de fallback
  // (`claude -p` single-shot), onde o CC lê esses campos. Os dois canais juntos
  // não conflitam: o CC usa `stderr || stdout` para o corpo visível.
  process.stderr.write(motivo);
  process.stdout.write(JSON.stringify({ decision: 'block', reason: motivo }));
  process.exit(2);
});
