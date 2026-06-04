# Modelo Operacional dos Agentes

Ultima atualizacao: 2026-05-31

## Objetivo

Definir como agentes trabalham no projeto Mesas RPG Artificio com o menor processo que ainda controla o risco. Este documento explica a operacao diaria; regras petreas continuam em `AGENTS.md`. Em conflito sobre arquitetura ou contratos tecnicos, prevalece `.specify/arquiteture.md`.

## Regra central

Escolha o modo pelo risco da mudanca, nao pelo tamanho aparente do pedido.

| Modo | Quando usar | Artefatos minimos |
|---|---|---|
| Sem SDD | Pergunta tecnica, delta documental, correcao pontual, ajuste visual pequeno sem fluxo critico | Sessao + evidencia |
| SDD Lite | Bug moderado, feature pequena, ajuste de produto localizado, mudanca com impacto visivel mas baixo risco tecnico | Mini-spec ou decisao registrada + checklist + evidencia |
| SDD Completo | Migration, schema, banco, auth, permissoes, dados pessoais, upload/Cloudinary, contrato publico/API, deploy, CI/CD, infraestrutura, feature grande ou refatoracao ampla | `spec.md` + `plan.md` + `tasks.md` + validacao + sessao; `pr-description.md` quando houver PR |

## Sem SDD

Use quando a falha for barata de corrigir e nao houver contrato publico ou risco de dados.

Exemplos:

- Corrigir texto ou documentacao sem mudar requisito.
- Atualizar um ponteiro operacional.
- Responder pergunta sobre o estado do projeto.
- Ajustar pequena regra visual ja documentada.

Evidencia minima:

- Arquivos alterados listados na sessao.
- Busca ou leitura que comprove o delta.
- Validacao pertinente ao tipo de arquivo.

## SDD Lite

Use quando existe risco real, mas o SDD completo custaria mais do que a protecao extra.

Exemplos:

- Bug de UI com causa local.
- Pequena feature administrativa sem schema.
- Ajuste de fluxo que afeta usuario, mas nao toca auth, banco, deploy ou API publica.

Evidencia minima:

- Intencao e criterio de conclusao registrados na sessao.
- Checklist curto.
- Referencia ao arquivo de requisito, issue ou decisao do mantenedor.
- Teste/build/busca/manual check proporcional ao risco.

## SDD Completo

Use quando uma regressao pode quebrar dados, seguranca, deploy, contratos ou rastreabilidade.

Gatilhos obrigatorios:

- Migrations, schema, writes em banco ou dados de producao.
- Auth, permissoes, roles, privacidade ou dados pessoais.
- Upload/processamento de imagem e Cloudinary.
- Contrato publico/API, integracao externa ou normalizadores de fronteira.
- Deploy, CI/CD, infraestrutura, VM, Docker, Cloudflare Tunnel.
- Refatoracao ampla ou feature de produto com multiplas superficies.

Evidencia minima:

- `spec.md`, `plan.md`, `tasks.md` coerentes.
- `pr-description.md` quando a mudanca for virar PR.
- Preflight seletivo de governanca concluido:
  - consultar `.specify/memory/constitution.md`;
  - consultar `docs/sdd/SESSION_FAILURES_REGISTRY.md`;
  - consultar `docs/sdd/MAINTAINER_REVIEW_CHECKLIST.md`;
  - antes de analise/auditoria, consultar `docs/sdd/analyze-governance-gate.md`.
- Sessao atualizada antes e depois das etapas.
- Validacao tecnica adequada.
- Validacao funcional em `dev`/Beta quando UI/fluxos reais forem afetados.
- Browser plugin, Playwright local, screenshot local ou simulacao do agente podem apoiar diagnostico tecnico, mas nao contam como validacao funcional conclusiva de UI/fluxos reais.
- Entrada em `database/changelogs.json` quando houver mudanca visivel para mestres ou usuarios finais.

## Como usar `/speckit.*`

Comandos `/speckit.*` sao procedimentos documentais do agente. Eles nao sao comandos de shell, nao sao skills locais ativas e nao devem ser executados no terminal.

Uso recomendado:

- `/speckit.specify`: criar ou atualizar requisito quando SDD Completo for necessario.
- `/speckit.plan`: registrar arquitetura e plano tecnico apos spec aprovada.
- `/speckit.tasks`: quebrar execucao em checklist verificavel.
- `/speckit.status` ou `/speckit.retro.run`: atualizar memoria operacional ao fechar.
- Extensoes como `/speckit.bugfix.*`, `/speckit.verify-tasks` e `/speckit.doctor`: seguir como guia procedural quando o risco justificar.

## Erros e regressões

Ao encontrar erro, evite tentativa repetida. Consulte `.specify/memory/errors.md` por codigo `E###` ou sintoma. Se houver solucao documentada, aplique e valide. Se for erro novo, diagnostique causa raiz, registre o aprendizado quando validado e use `/speckit.fixit.run` como procedimento documental quando o risco justificar.

## Skills no fluxo diario

Use `mattpocock/skills` como fluxo padrao. Elas devem ajudar a pensar e executar, nao substituir regras petreas locais.

| Situacao | Skill preferida |
|---|---|
| Ideia ambigua | `grill-me` |
| Plano contra docs do projeto | `grill-with-docs` |
| Bug/regressao | `diagnose` |
| Implementacao com teste | `tdd` |
| Arquitetura degradada | `improve-codebase-architecture` |
| Handoff/retomada | `handoff` |
| Economia de contexto | `caveman` quando solicitado |

`obra/superpowers` fica apenas como referencia seletiva, especialmente para evidencia antes de conclusao, debugging sistematico e resposta a review. Nao instalar nem seguir seus fluxos de worktree/commit/PR sem adaptacao explicita.

## Edicao documental segura

Em arquivos documentais recem-migrados ou com acentuacao/encoding variavel:

1. Releia o trecho alvo imediatamente antes de usar `apply_patch`.
2. Prefira patches pequenos por bloco, com poucas linhas de contexto.
3. Separe criacao de arquivos novos de edicao em arquivos existentes quando o risco de conflito for alto.
4. Trate falha de contexto do patch como sinal de contexto stale, nao como erro tecnico do arquivo.
5. Valide depois com busca final do trecho esperado e `git diff --check` quando houver alteracao versionavel.

## O que nunca fazer

- Nao fazer commit, push, deploy, restart de servicos ou write em banco sem aprovacao quando `AGENTS.md` exigir.
- Nao recriar `.agent/skills`, `.agents/skills` ou `.gemini/skills` sem decisao explicita do mantenedor.
- Nao tratar skills antigas como fonte ativa.
- Nao usar workflows/regras antigas em `.agent/workflows`, `.agents/rules`, `.agents/workflows`, `.gemini/default-rules.md` ou `.gemini/workflows` como fonte ativa.
- Nao apagar regra petrea ao enxugar documento; mover, resumir ou marcar como historica/obsoleta.
- Nao substituir validacao funcional em `dev`/Beta pelo mantenedor por build local, Browser plugin, Playwright local, screenshot local ou simulacao do agente quando UI/fluxos reais forem afetados.
- Nao consultar `.specify/arquiteture.md` inteira por padrao; buscar a secao relevante.

## Evidencia antes de concluir

Antes de declarar uma tarefa concluida:

1. Verifique a checklist da sessao.
2. Rode buscas finais relevantes ao padrao da tarefa.
3. Confirme que nao ha arquivo parcialmente modificado.
4. Atualize `project-state.md` quando a tarefa mudar o estado operacional.
5. Execute `/speckit.retro.run` ou equivalente documental quando a sessao for encerrada.
6. Registre validacao e riscos residuais.
