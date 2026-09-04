# Modelo de Operação — quando usar cada nível de SDD

Escolha o **menor** processo que controle o risco. Em dúvida, suba um nível.

## Árvore de decisão

1. **Toca `packages/*` (auth, ui, analytics, config, content, crosslink), infra (Cloudflare Tunnel/DNS), `accounts.` (SSO), CI/CD, migration, banco, permissões, dados pessoais, upload/Cloudinary, importador WP, contrato público/API, SEO estrutural, ou é feature/refator grande?**
   → **SDD Completo.** Sempre. Tudo que é compartilhado ou de alto risco.

2. **É bug moderado, feature pequena ou ajuste localizado dentro de UM `apps/*`, sem tocar compartilhado?**
   → **SDD Lite.**

3. **É pergunta, ajuste de documentação, correção pontual sem risco?**
   → **Sem SDD.**

## Artefatos por nível

| Nível | Artefatos |
|---|---|
| Sem SDD | sessão + evidência |
| SDD Lite | mini-spec (problema, solução, escopo) + checklist + evidência + sessão |
| SDD Completo | `specs/NNN-<modulo>-<slug>/` com `spec.md` + `plan.md` + `tasks.md` + validação + sessão |

## Fluxo SDD Completo

`spec → plan → tasks → implement`, atualizando a sessão continuamente.

- **spec.md** — o quê e por quê. Problema, requisitos, critérios de aceite, fora de escopo. Sem solução técnica.
- **plan.md** — como. Arquitetura, arquivos afetados, contratos, riscos, rollback, impacto em outros módulos.
- **tasks.md** — passos executáveis e verificáveis, em ordem, com critério de "feito".
- **implement** — executar tasks, registrar evidência, fechar checklist.

Quando houver PR, criar `pr-description.md`: sumário executivo, evidências de teste, checklist pós-merge.

## Numeração de specs

`specs/NNN-<modulo>-<slug>/`. Ex: `001-infra-backup-runbook`, `002-monorepo-bootstrap`, `010-site-importador-wp`, `020-srd-tooltips`. `NNN` é sequencial global; `<modulo>` ancora o escopo.

## Regra de ouro do monorepo

Escopo isolado num módulo → pode ser Lite. Qualquer toque no compartilhado → Completo + smoke dos consumidores. Nunca ampliar escopo pra outro módulo/pacote sem aprovação.

## Deploy e VM

Deploy/codificação canônicos passam por GitHub: branch/PR, checks, workflow_dispatch e GitHub Actions com secrets. A VM não é caminho normal de entrega de código; acesso direto fica para bootstrap do clone, instalação operacional, conexão, diagnóstico, rollback aprovado ou ação que o GitHub ainda não cobre. Isso aumenta rastreabilidade, respeita branch safety e reduz drift manual. Fluxo operacional: `docs/agents/deploy-flow.md`.

## Integração Claude Code ↔ OpenCode (MCP)

O Claude Code pode acionar o OpenCode como agente auxiliar via MCP. Doc interna (gitignored); resumo + regra de autorização também no T0 (`context-capsule.md`, seção "Ferramentas / divisão").

### 1. Estado atual

- O Claude Code pode acionar o OpenCode via MCP.
- O MCP registrado no Claude se chama `opencode`.
- O OpenCode está configurado para usar **DeepSeek** como modelo padrão.
- O bridge usado é `opencode-mcp`.
- A integração foi configurada no **escopo local** do projeto `C:\projetos\artificio`.

### 2. Comandos de verificação

- No PowerShell: `claude mcp list`
- Dentro do Claude Code: `/mcp`
- Esperado: o MCP `opencode` aparece como **conectado**.
- No Claude Code, deve aparecer com a lista de ferramentas disponíveis do OpenCode.

### 3. Comandos de configuração já usados

- Registrar o MCP no projeto: `claude mcp add opencode -- npx -y opencode-mcp`
- Remover o MCP (somente se autorizado): `claude mcp remove opencode`

### 4. Arquivos relevantes

- Configuração MCP do Claude: `C:\Users\paulo\.claude.json`
- Configuração global do OpenCode: `C:\Users\paulo\.config\opencode\opencode.json`
- Autenticação persistente do OpenCode: `C:\Users\paulo\.local\share\opencode\auth.json`
- Histórico/modelos recentes do OpenCode: `C:\Users\paulo\.local\state\opencode\model.json`

### 5. Regras de autorização

- Nenhum agente ativa o outro, inicia subprocessos, roda comandos, altera arquivos/configurações ou faz chamadas de ferramenta em nome do outro **sem autorização explícita do mantenedor**.
- Antes de qualquer ação, o agente explica objetivamente o que pretende fazer e aguarda aprovação.
- A comunicação entre agentes prioriza tarefas **read-only** primeiro (análise, inspeção, revisão, listagem, diagnóstico).
- Mudanças em arquivos, configurações, deploys, credenciais, scripts, automações ou MCPs só ocorrem após aprovação clara.
- Comandos listados aqui são **referência operacional, não autorização permanente** para execução. Aprovação é por ação, não por sessão (mesma regra pétrea de `AGENTS.md`).

### 6. Como usar a integração

- O Claude Code pode pedir ao OpenCode uma análise auxiliar para revisão técnica, inspeção de código, validação de hipótese ou comparação de abordagem.
- O OpenCode é agente auxiliar com DeepSeek, sujeito às mesmas regras de autorização.
- Quando um agente consulta o outro, a solicitação é objetiva, limitada e preferencialmente read-only.
- O agente informa qual ferramenta/MCP pretende usar antes de acionar a integração.
