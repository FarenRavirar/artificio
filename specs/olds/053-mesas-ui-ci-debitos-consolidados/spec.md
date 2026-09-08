# 053 — Consolidação de débitos remanescentes (047–051): a11y/UI da gestão, tema accounts, gap de CI

- **Módulo/Pacote:** transversal — `apps/mesas/frontend` (a11y/UI da revisão de gestão), `apps/accounts/frontend` (tema), `packages/ui` (design system / primitivas), CI/infra (`.github/` — smoke de resolução CJS), `apps/mesas/backend` (parser — melhorias opcionais)
- **Gate relacionado:** D (mesas em prod) + B (SSO/accounts) — ambos fechados; esta spec é hardening pós-deploy, não destrava gate
- **Tipo:** **SDD Completo** (toca `packages/ui` compartilhado + serviço `accounts.` frontend + CI/CD)
- **Origem:** consolidação dos débitos abertos das specs 047, 048, 049, 050, 051 após deploy de 048 em prod (2026-06-27). Decisão do mantenedor: concentrar o que sobrou numa spec única **antes** de iniciar a 052 (automação inteligente).
- **Autor do plano:** Claude Code. **Implementação:** a definir (DeepSeek/Claude por autorização nominal).
- **Status:** ✅ **ENCERRADA (2026-06-30).** Todas as frentes (A/B/B2/C/D/E) implementadas e validadas localmente. PR mergeada → deploy beta + smoke + promote prod ✅. O que não foi feito foi descartado (mantenedor).

> **Nota de governança:** este `spec.md` descreve **o quê e por quê** (problema + requisitos testáveis). A solução técnica vive em `plan.md`/`tasks.md`. Sem código nesta fase.

---

## Problema

Cinco specs (047–051) entregaram suas funcionalidades-núcleo em produção, mas deixaram **débitos remanescentes não-bloqueantes** espalhados em `debitos.md`/`reviews.md` de cada uma. Isso viola a regra anti-dispersão (débito não pode ficar preso só em doc de spec encerrada). O mantenedor decidiu **transferir tudo o que falta** dessas specs para uma spec única (053), concentrar esforço aqui, e só depois abrir a 052.

A spec **052 (automação inteligente de importação)** fica **bloqueada até a 053 fechar** (decisão do mantenedor).

### O que **NÃO** entra na 053

- **Melhorias de parser marcadas "fora do PR-1"** na 048 (T-C4/C5/C7/C8/C9 + T-B5 — role/user mentions, mesa paga, sistema próprio/inspirado, parse automático pós-import): **transferidas para o final da spec 052** (Bloco C) por decisão do mantenedor (2026-06-27). Não são da 053.
- **Bloco B inteligente / IA** (eval, shadow, auto-aprovação, fine-tuning): spec 052.

---

## Frentes consolidadas

### Frente A — Acessibilidade + UI da revisão de gestão (mesas) — origem 049/D06 (P1-1..P1-8)

> ⚠️ **BLOQUEADA pela spec 054 (gate, mantenedor 2026-06-27).** A 054 reorganiza a MESMA tela (`/gestao` → sidebar + rotas + renomeações). Esta Frente A só roda **depois** da 054, aplicando a11y sobre a estrutura nova (evita retrabalho/conflito). As frentes B/C/D/E desta spec **não** dependem da 054 e seguem livres.

A auditoria da spec 049 (`auditorias-consolidadas.md`) levantou 8 issues P1 na aba `/gestao` de revisão de drafts que **não foram tratados** (D06). Vários são WCAG Critical/Serious:

- **P1-1** — Modal de preview sem `Escape`/focus-trap/`role` → bloqueia usuário de teclado (WCAG Critical, Nielsen H3).
- **P1-2** — checkbox/cell em `<td>` sem label associado → leitores de tela não identificam ação (WCAG Serious).
- **P1-3** — sem focus indicators visíveis → navegação por teclado impossível (WCAG Critical).
- **P1-4** — dirty state do editor de draft perdido ao fechar → perda de trabalho não salvo (Nielsen H5).
- **P1-5** — `window.confirm()` inconsistente com confirmação inline (Nielsen H4). **⚠️ verificar:** a spec 051 Onda A extraiu `ConfirmDialog` para `packages/ui` e migrou `window.confirm` no mesas — P1-5 pode já estar **resolvido**; confirmar contra o código antes de retrabalhar.
- **P1-6** — navegação automática entre abas após ação → desorientação (UX Critical, Nielsen H3).
- **P1-7** — zero uso do design system (`Button`/`Badge`/etc.) na tela → inconsistência visual severa (Nielsen H8). **⚠️ verificar:** 049/051 já trocaram parte; confirmar cobertura real.
- **P1-8** — erro não anunciado para leitores de tela (sem `role="alert"`/`aria-live`) (WCAG Critical, Nielsen H9).

**Requisito (testável):** a tela de revisão de drafts da `/gestao` passa em checagem de teclado (Tab/Escape/focus visível), tem `role`/`aria` corretos no modal e nos controles de tabela, anuncia erros via `aria-live`, preserva edição não-salva com guarda de saída, e usa primitivas do `packages/ui` onde aplicável. Cada heurística de Nielsen tocada registrada na sessão.

### Frente B — Tema preso em light no accounts — origem DEB-048-38

Ao entrar no `accounts.`, o tema fica **persistente light**; não respeita preferência/toggle.

**Requisito (testável):** `accounts.` respeita a preferência de tema (default coerente com o design system de `packages/ui` + persistência via `localStorage`/cookie quando houver toggle). Smoke visual em beta/local. Não toca lógica de auth/SSO.

**Ampliação 2026-06-29 (mantenedor):** reestruturar visualmente a tela de conta/login do `accounts` para ficar alinhada ao Artifício. O estado anterior tinha fundo partido, card genérico, botões agressivos e organização ruim. A correção deve manter o fluxo SSO, mas melhorar layout, densidade, hierarquia, tokens de marca e organização da área admin.

### Frente C — Gap de CI: resolução CJS de pacotes shared — origem DEB-048-37

O incidente DEB-048-36 (crash-loop do `mesas-beta-api`) foi causado por `@artificio/config` exportar só a condição `import` (ESM) enquanto o `mesas-backend` consome via `require()` (CJS). **tsc e vitest não exercitam `require()` do dist** → CI ficou verde e o bug só apareceu no runtime do container.

**Requisito (testável):** existe um check de CI que falha se um pacote `packages/*` consumido em CJS não resolver via `require()` respeitando seus `exports` (ex.: smoke `require('@artificio/config/secret-crypto')` num runner CJS, ou validação `exports`-vs-consumidores). O check pega regressão equivalente ao DEB-048-36 **antes** do deploy.

### Frente D — Higiene documental — origem REV-051-RABBIT-06

REV-051-RABBIT-06 (falso-positivo do CodeRabbit sobre Stylelint inexistente) foi **descartado e documentado** em `specs/051/reviews.md §13`, mas o registro segue **não-commitado**. Sem código; só promover via PR doc-only quando houver carona.

**Requisito:** registro entra em `dev` no próximo PR (doc-only ou carona). Nada de código.

### Frente E — Ingestão diária na VM (DiscordChatExporter agendado) — origem 048 Fase E (T-E1..E6) — FINAL DA SPEC

Transferida da Fase E da 048 por decisão do mantenedor (2026-06-27): fica **ao final da 053**. Automação operacional da ingestão (sem a camada inteligente/IA, que é da 052 Bloco B):

- T-E1 — diretórios fora do git p/ extração/import.
- T-E2 — comando DiscordChatExporter na VM (pinado/seguro).
- T-E3 — job diário.
- T-E4 — importador de pasta monitorada (idempotente).
- T-E5 — logs e retenção.
- T-E6 — métrica operacional (+048 T-F1: migration `discord_import_runs`, online-safe).

**Travas:** toda ação na VM (write/job/migration/segredo/cron) exige **aprovação nominal por ação**; guard online-safe (spec 050); sem credencial pessoal permanente; sem segredo em log. **Coordenação:** o Bloco A da 052 cobre automação operacional equivalente — esta Frente E e o Bloco A da 052 **não podem duplicar**; se a 053 fechar sem chegar aqui, a ingestão segue como Bloco A da 052.

**Requisito (testável):** ingestão diária roda na VM, idempotente, sem auto-publicação (trava da 048 em vigor), com logs/métricas; cada componente validado em beta antes de prod.

---

## Critérios de aceite da spec 053

1. Frentes A, B, C tratadas (corrigidas e validadas) **ou** explicitamente reclassificadas como débito acionável com aprovação do mantenedor.
2. Frente D promovida a `dev`.
3. Frente E (ingestão VM): **explicitamente passada ao Bloco A da 052** (sem duplicar), com decisão registrada nesta spec.
4. Validação técnica real registrada: `pnpm run lint` + `pnpm run build` verdes; smoke proporcional (a11y/teclado na gestão; visual de tema no accounts; CI check novo falhando-no-bug e passando-no-fix).
5. `debitos.md` de origem (047–051) atualizados apontando "transferido p/ 053"; `specs/backlog.md` e `project-state.md` sincronizados.
6. Nenhum item das specs 047–051 resta "pendente" fora da 053.

## Fora de escopo

- Camada inteligente/IA (Bloco B) e melhorias opcionais de parser → spec 052.
- Qualquer mudança em lógica de auth/SSO (Frente B é só tema/UI).
- Cutover de DNS / WordPress (Gate C, adiado).
