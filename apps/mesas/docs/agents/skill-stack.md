# Stack de Skills dos Agentes

Última atualização: 2026-05-31

## Objetivo

Reduzir ruído de instruções antigas e manter um conjunto pequeno, previsível e útil de skills para este projeto.

Este arquivo descreve o stack. Para escolher processo e risco, use:

- `docs/agents/operating-model.md`
- `docs/agents/skill-decision-matrix.md`
- `docs/agents/context-capsule.md`

## Stack ativo

| Fonte | Uso | Status |
|---|---|---|
| `mattpocock/skills` | Alinhamento, TDD, diagnóstico, arquitetura, handoff, PRD/issues | Ativo |
| `JuliusBrussee/caveman` | Comunicação comprimida e utilitários Caveman | Ativo |
| Skills `.system` do Codex | Recursos internos do runtime | Ativo |
| `obra/superpowers` | Referência metodológica seletiva | Não instalado como pacote ativo |

Checkouts de referência:

- `C:\Users\paulo\.codex\vendor_imports\mattpocock-skills`
- `C:\Users\paulo\.codex\vendor_imports\caveman`
- `C:\Users\paulo\.codex\vendor_imports\superpowers` quando sincronizado localmente

## Skills antigas

As coleções locais abaixo foram desativadas:

- `.agent/skills`
- `.agents/skills`
- `.gemini/skills`

Não recriar essas pastas sem decisão explícita do mantenedor. Elas reintroduzem sobreposição de comandos e aumentam o risco de o agente seguir procedimento antigo.

## Workflows e AGY legados

Os caminhos legados abaixo foram aposentados ou removidos em 2026-06-01:

- `.agent/workflows`
- `.agents/rules`
- `.agents/workflows`
- `.gemini/default-rules.md`
- `.gemini/workflows`

Motivo: eles apontavam para skills removidas ou para fluxos antigos de Spec-Kit. A fonte ativa agora e `AGENTS.md` com operacao detalhada em `docs/agents/`.

Observacao: `.gemini/default-rules.md` permanece como tombstone rastreado; `.gemini/workflows` ficou sem workflows ativos/rastreados porque novos arquivos sob `.gemini/` sao ignorados pelo repositorio.

`.specify/integrations/agy.manifest.json` tambem foi aposentado intencionalmente (`status: retired`). AGY nao e runtime ativo nesta migracao; `/speckit.*` permanece como procedimento documental do agente.

## Quando usar

| Situação | Skill preferida | Observação |
|---|---|---|
| Requisito ambíguo | `grill-me` ou `grill-with-docs` | Não substitui `/speckit.specify` quando o gate SDD exigir spec |
| Bug ou regressão | `diagnose` | Seguir também `.specify/memory/errors.md` |
| Implementação com teste | `tdd` | RED→GREEN obrigatório quando aplicável |
| Arquitetura confusa | `improve-codebase-architecture` | Proibido refactor fora do escopo |
| Quebra de contexto | `handoff` | Útil antes de encerrar sessão longa |
| Economia de tokens | `caveman` | Ativar quando o mantenedor pedir ou durante sessões longas |
| Antes de declarar concluído | Diretriz `verification-before-completion` de Superpowers | Usar como checklist conceitual, não como skill ativa |

## Relacao com SDD

Skills ajudam a executar melhor, mas nao substituem o modo de risco:

- **Sem SDD:** usar skill somente se reduzir incerteza.
- **SDD Lite:** usar skill para alinhar, diagnosticar ou testar sem criar cerimonia excessiva.
- **SDD Completo:** usar skill como apoio; `spec.md`, `plan.md`, `tasks.md`, sessao e validacao continuam obrigatorios.

Comandos `/speckit.*` sao procedimentos documentais do agente, nao comandos de terminal e nao skills locais ativas.

## Superpowers

`obra/superpowers` foi avaliado no commit `6fd4507`. Ele traz uma metodologia completa com 14 skills: brainstorming, worktrees, planos, execução, subagentes, TDD, debugging, review e fechamento.

Decisão atual: não instalar como pacote ativo obrigatório.

Motivos:

- Duplica capacidades já cobertas por `mattpocock/skills`.
- Usa gates próprios que podem competir com o SDD canônico do projeto.
- Incentiva worktrees, commits e fluxos de finalização que exigem adaptação às regras pétreas locais.
- Aumentaria novamente o número de skills ativas após a limpeza.

Valor aproveitado:

- `verification-before-completion`: evidência antes de afirmações de conclusão.
- `systematic-debugging`: diagnóstico por causa raiz antes de correção.
- `receiving-code-review`: tratar feedback de review como fila objetiva de correções.

## Atualização futura

Para atualizar fontes:

```powershell
git -C C:\Users\paulo\.codex\vendor_imports\mattpocock-skills pull --ff-only
git -C C:\Users\paulo\.codex\vendor_imports\caveman pull --ff-only
```

Depois de atualizar arquivos em `C:\Users\paulo\.codex\skills`, reiniciar o Codex para recarregar a lista.
