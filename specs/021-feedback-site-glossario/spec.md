# 021 — Reportar bug / sugerir melhoria no site e no glossário (paridade com mesas)

- **Módulo/Pacote:** packages/ui (contrato data-only) · apps/site (público Astro + apps/site/server) · apps/site-admin · apps/glossario (frontend + backend + database)
- **Gate relacionado:** nenhum (SDD Completo por tocar `packages/*` e contrato compartilhado)
- **Débito de origem:** D-FEEDBACK1 (`sessoes/26-06-12_2_debitos_ux-marca.md`)
- **Decisões do mantenedor (2026-06-13, AskUserQuestion):**
  - Arquitetura **Híbrido B+**: port por app + contrato **data-only** compartilhado em `packages/ui`.
  - Site público: **island vanilla mínima** (não quebra zero-JS, D048).
  - Dados: **paridade total com mesas** (inclui console/network capture + screenshot + contexto).

## Problema
O `apps/mesas` já tem ferramenta de **reportar problema (bug)** e **sugerir melhoria**: botão flutuante → modal → POST público (anônimo + email opt-in) com contexto técnico (página, viewport, erros de console/rede, screenshot ao Cloudinary não-fatal) + triagem admin. `apps/site` e `apps/glossario` não têm. O mantenedor quer a **mesma experiência e linguagem** nos três projetos, sem reinventar copy nem divergir.

Realidade que impede fonte-única de runtime:
- **site público** = Astro SSG **zero-JS** (D048 pétreo) → não pode hospedar componente React; `apps/site/server` **não tem Postgres** (só store de arquivo/mídia).
- **glossario** = SPA React + Express **pg cru**, DB `glossario_v2`, **migration própria** (D059, não o runner do mesas).
- **mesas** = React + Express **kysely** + Postgres.

Três runtimes e três persistências → o que pode (e deve) ter fonte única é **a linguagem/UX e o contrato do payload**, não o componente.

## Requisitos (numerados, testáveis)
- **FR-001** — Contrato data-only compartilhado em `packages/ui` (sem React/auth, importável por Astro): enum `kind` (`bug|suggestion`), tipo do payload de envio, limites (espelho de `DEV_FEEDBACK_LIMITS`) e **copy PT canônica** (títulos, labels, placeholders, toasts, aria-labels) usados hoje no mesas.
- **FR-002** — `apps/glossario` ganha widget React (botão flutuante + modal) com a mesma UX/linguagem do mesas, consumindo a copy/tipos de FR-001.
- **FR-003** — `apps/site` (público Astro) ganha **island vanilla** (botão flutuante + modal + `fetch` POST), sem framework, consumindo a copy/tipos de FR-001; não adiciona JS ao shell além do script da island (padrão dos scripts vanilla já existentes: tema/TOC/Pagefind/GA4).
- **FR-004** — Endpoint público `POST` de feedback em cada backend alvo: anônimo permitido, email opt-in, rate-limit, validação/normalização tratando entrada como `unknown` (espelho de `parseDevFeedbackInput`).
- **FR-005** — **Paridade total de dados**: cada app captura e envia `kind/title/description`, `contact_email?`, `page_url/route_path/page_title/environment/user_agent/viewport`, `console_errors[]`, `network_errors[]`, `screenshot?` (mesmo shape e limites do mesas).
  - glossario: portar coletor de diagnóstico (console/rede ring-buffer, privacidade: só url/método/status) + screenshot client-side.
  - site (vanilla): coletor equivalente em JS puro instalado cedo no boot + screenshot opcional.
- **FR-006** — Screenshot ao Cloudinary **não-fatal** por app: falha grava o feedback sem imagem; upload órfão é limpo se a persistência falhar. Degradar sem credencial Cloudinary do app é aceitável.
- **FR-007** — Persistência por app:
  - glossario: tabela nova via **fluxo de migration do glossário** (D059), aditiva/online-safe, header `@class/@requires-backup/@author/@created/@description`.
  - site: `apps/site/server` **não tem Postgres** → definir store (ver plan.md); decisão registrada antes de codar a persistência.
- **FR-008** — Triagem admin com paridade: listar/filtrar (status, kind, arquivados), atualizar status + notas, arquivar/desarquivar, excluir (limpa screenshot). **Merge** é fatia opcional posterior.
  - glossario: aba/visão admin (já tem padrão admin + `adminActivity`).
  - site: triagem em `apps/site-admin` (React).
- **FR-009** — Notificação/auditoria admin no envio quando o app já tiver mecanismo (glossario tem `notificationService`/admin activity); não introduzir mecanismo novo só para isso.
- **FR-010** — `apps/mesas` segue funcional sem regressão; migrar mesas para consumir a copy/tipos de FR-001 é **opcional** (anti-drift), não obrigatório nesta spec.

## Critérios de aceite
- `packages/ui` exporta o contrato data-only; `pnpm turbo run build` 13/13 verde; paridade de tokens intacta; build do site Astro (`output: static`) continua sem JS de shell além das islands.
- glossario: build front+back verde; testes backend do validador/rota (espelhando padrão jest do mesas) verdes; envio anônimo e com email funcionam; admin lista/triage/arquiva/exclui.
- site: build estático verde; island só carrega seu próprio script; envio funciona (com e sem screenshot); triagem visível no site-admin.
- Copy/labels idênticos entre os três (mesma fonte FR-001).
- `git diff --check` limpo. Sem commit/push/deploy sem aprovação nominal.

## Fora de escopo
- `apps/accounts` (explicitamente fora — kickoff).
- Merge de feedbacks (fatia posterior).
- Migrar mesas para o contrato compartilhado (opcional, FR-010).
- Qualquer deploy/prod sem autorização nominal.
- Dashboard/analytics de feedback, exportação, SLA.

## Riscos e impacto em outros módulos
- **packages/ui** = compartilhado → SDD Completo + smoke de TODOS consumidores (site/glossario/mesas/accounts/site-admin). Contrato é data-only (baixo risco), mas qualquer regressão de barrel/import afeta todos.
- **D048 (zero-JS do site)**: island vanilla não pode vazar JS pro shell nem bloquear render; validar bundle `_astro` pós-build.
- **site sem Postgres**: introduzir persistência nova tem custo/decisão (store em arquivo vs reuso de backend existente) — resolver no plan.md antes de codar.
- **Cloudinary por app**: sem credencial → degrade sem screenshot (já é o padrão não-fatal do mesas).
- **glossario migration própria (D059)**: não usar runner do mesas; seguir fluxo do glossário.
- Auth sagrado: feedback é público (optionalAuth); SSO intocado.
