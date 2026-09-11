#!/usr/bin/env node
// deploy-contract-gate — PreToolUse(Edit|Write): exige leitura do contrato de
// deploy antes de editar arquivo de uma das famílias de incidente recorrente.
//
// POR QUE EXISTE
// Os 22 incidentes de `.specify/memory/errors.md` são 5 famílias de causa raiz,
// e TRÊS já tiveram recorrência:
//   E016 -> E017 -> E021  (a terceira derrubou o SSO por ~5h)
//   E004 -> E008 -> lockfile podado na spec 100 (2026-09-03)
// Em todas, o procedimento existia escrito e não foi lido: ficava num arquivo e
// o incidente noutro, ou dependia de o agente lembrar de consultar.
//
// O AGENTS.md não resolve isso sozinho. Ele é lido no T0, no início da sessão —
// e a decisão de editar um `migration_*.sql` vem depois, muitas vezes horas
// depois, quando aquele parágrafo já saiu de vista. Regra que depende de memória
// é regra que falha; a prova é que as três recorrências aconteceram com o
// procedimento já documentado.
//
// Este gate dispara pelo ARQUIVO que está sendo editado, no momento da edição —
// que é quando a informação de fato importa. Não é vigilância: é o mesmo
// princípio do `rtk-read-gate` (arquivo grande) e do `git-commit-msg-gate`
// (heredoc/amend), que já provaram funcionar nesta base.
//
// COMO ESCAPAR LEGITIMAMENTE
// Ler a seção citada. O gate só cobra uma vez por sessão e por família: depois
// de ler, as edições seguintes daquela família passam direto.


const { lerPayload } = require(require('node:path').join(__dirname, 'ler-payload.js'));
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// família -> { teste do caminho, seção do contrato, por que }
const FAMILIAS = [
  {
    id: "dockerfile",
    casa: (p) => /(^|[\\/])Dockerfile(\.[\w.-]+)?$/i.test(p),
    secao: "§1 Imagem de produção",
    porque:
      "3 recorrências (E002 -> E016/E017 -> E021). Build e CI passam verdes: " +
      "eles compilam o código, não montam a imagem final. A última derrubou o SSO por ~5h.",
  },
  {
    id: "lockfile",
    casa: (p) => /(^|[\\/])(pnpm-lock\.yaml|package\.json|pnpm-workspace\.yaml)$/i.test(p),
    secao: "§2 Resolução de dependência",
    porque:
      "E004, E008 e a spec 100: alterar resolução de dependência quebra app que " +
      "ninguém tocou, e o CI acusa páginas depois. Use `pnpm install --lockfile-only` " +
      "e confira `git diff pnpm-lock.yaml` antes de commitar.",
  },
  {
    id: "migration",
    casa: (p) => /migration_[\w-]*\.sql$/i.test(p),
    secao: "§3 Migration",
    porque:
      "A maior família — 8 dos 22 incidentes. Header inválido passa verde no CI e " +
      "aborta o deploy na VM; migration não idempotente falha na segunda execução.",
  },
  {
    id: "workflow",
    // `(^|[\\/])` e não `[\\/]`: o caminho pode chegar relativo, começando já
    // em `.github/` — foi o que a suíte pegou na primeira versão.
    casa: (p) =>
      /(^|[\\/])\.github[\\/]workflows[\\/].+\.ya?ml$/i.test(p) ||
      /(^|[\\/])\.github[\\/]deploy-manifest\.json$/i.test(p),
    secao: "§6 Fluxo e workflows",
    porque:
      "`deploy.yml` só deploya se `deploy_paths` mudar, e `promote` NUNCA dispara " +
      "deploy de prod — Git atualizado não é prod atualizado.",
  },
];

const CONTRATO = "docs/agents/deploy-flow.md";

// Marca por sessão: uma cobrança por família, não por edição.
function marcaDaSessao(sessionId, familia) {
  const dir = path.join(os.tmpdir(), "deploy-contract-gate");
  return path.join(dir, `${sessionId || "sem-sessao"}.${familia}`);
}

function jaCobrado(sessionId, familia) {
  try {
    return fs.existsSync(marcaDaSessao(sessionId, familia));
  } catch {
    return false; // na dúvida, cobra — falso-negativo é pior que repetir o aviso
  }
}

function registrar(sessionId, familia) {
  try {
    const alvo = marcaDaSessao(sessionId, familia);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, new Date().toISOString());
  } catch {
    // Não conseguir gravar a marca só faz o gate cobrar de novo. Falha segura.
  }
}

lerPayload((bruto) => {
  let entrada;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    process.exit(0); // não entendeu a entrada: não atrapalha
  }

  const arquivo = entrada?.tool_input?.file_path || "";
  if (!arquivo) process.exit(0);

  const familia = FAMILIAS.find((f) => f.casa(arquivo));
  if (!familia) process.exit(0);

  const sessao = entrada?.session_id;
  if (jaCobrado(sessao, familia.id)) process.exit(0);

  registrar(sessao, familia.id);

  const motivo = [
    `[deploy-contract-gate] Você está editando ${path.basename(arquivo)} — família "${familia.id}".`,
    "",
    `LEIA ANTES: ${CONTRATO} ${familia.secao}`,
    "",
    familia.porque,
    "",
    "Essa seção é autossuficiente: traz o checklist, os comandos e o incidente que",
    "originou cada regra. Depois de ler, reemita esta edição — o gate só cobra uma",
    "vez por família em cada sessão.",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: motivo,
      },
    }),
  );
  process.exit(0);
});
