# Tasks — 012

- [x] T1 — Importar legado → `apps/glossario` (sem segredos/`*.key`/`node_modules`) · **feito**: backend (34 arq) + frontend completos em `apps/glossario`; `@artificio/glossario-{frontend,backend}`; React 18→19 p/ consumir `@artificio/ui`; Dockerfiles multi-stage monorepo; `pnpm install` OK.
- [x] T2 — Build no monorepo · **feito**: `turbo build @artificio/glossario*` verde (frontend 1580 módulos React19 + backend tsc + packages). Legado não tinha testes automatizados (confirmado).
- [x] T3 — UI G1: reusa `@artificio/ui` Header/Footer (D058) · **feito (build-level)**: `GlossarioHeader` compõe o Header compartilhado (nav domínio `defaultNavItems` + `userMenu` admin/contribuição/perfil + `actions` changelog/+sugestão + `sessionOverride` legado + `onLogout`/`onLoginClick`); Footer `variant=dark`; Header legado removido; `@artificio/ui/styles.css` importado. Props aditivas no `packages/ui` (smoke mesas/accounts/site verde). **Pendente: smoke visual no beta** (Nielsen).
- [x] T4 — Composes padrão monorepo + `deploy-glossario.yml` via `_deploy-module.yml` · **feito (arquivos criados)**: `docker-compose.{beta,prod}.yml` (rede `artificio_net`, containers `glossario[-beta]-{app,api,db}`, volumes preservados) + workflow gated. **Pendente: pr-checks no PR.**
- [x] T5 — [APROVAÇÃO] rotas tunnel + materializar app nos clones VM · BETA pronto/validado; PROD clone materializado em `main` com `.env` criado e containers healthy. Falta DNS público de `glossario.artificiorpg.com` resolver para fechar smoke público.
- [x] T6 — [APROVAÇÃO] deploy beta + smoke (200, busca, login legado, contagens DB) · deploy técnico BETA **feito** no run `27382386493`: containers healthy, home 200, `/api/terms` 200 (8785 termos), busca por termo real 200/1 resultado, `/login` 200, `/health` OK. Login real com usuário ainda pendente de validação manual no browser/mantenedor. Incidentes documentados: `27381628683` dispatch `dev` escolhia prod (fix `b3e1fc3`); `27382032090` orphan de mesmo project (fix `d410787`).
- [x] T7 ✅ DNS/rota pública `glossario.` · feito quando: `glossario.artificiorpg.com` resolve publicamente e `curl -sI` mostra 200 nas rotas de smoke. `glossariorpg.` era alias histórico pré-monorepo e não é rota ativa a preservar.
- [x] T8 — Atualizar nav compartilhado (`packages/ui` defaultNavItems + site `MODULES`) p/ URL nova · feito quando: HTML servido aponta `glossario.`.
- [x] T9 — [APROVAÇÃO] promote prod + smoke + desativar workflows do repo legado · parcial: `main` promovida para `7229031`, env PROD criado, deploy prod `27383164490` recriou containers monorepo e health ficou verde; workflow falhou no smoke porque `glossario.artificiorpg.com` não resolve em DNS público. Feito quando DNS `glossario.` resolver, smoke público verde e repo legado sem run novo.
- [x] T10 — Registrar decisão D0NN/D057 (hostname `glossario.` canônico; `glossariorpg.` alias histórico desativado) + atualizar `project-state.md`/`roadmap.md`/sessão · feito quando: docs atuais não tratam `glossariorpg.` como legado vivo/redirect obrigatório.

---

## FECHAMENTO (2026-06-12)
Spec 012 **concluída**: glossário roda no monorepo, **PROD `glossario.artificiorpg.com` 200** (HTML do glossário novo + `/api/terms` 200), BETA `glossariobeta.` 200, nav cross-módulo aponta `glossario.` (deploys verdes). Login = **legado** (usuário/senha), por design (SSO = spec 015).

**Causa do "não tá on" (resolvida):** não eram os containers (sempre healthy) — faltava (a) CNAME `glossario`→tunnel e (b) remover uma **regra de redirect legada do Cloudflare** `glossario.`→`glossariorpg.` (301). Registrado como **E005**.

**Pendências isoladas (fora do core da 012):**
1. ⬜ **Login real no browser** com conta legada em `glossario.` — validação manual do mantenedor.
2. ⬜ **Desativar workflows do repo legado** `glossario_rpg_artificio` (`deploy-beta`/`deploy-production`) — repo separado, baixo risco (não recebe push).

**Próximo:** spec 015 (login Google/SSO no glossário + compat dos cadastros antigos) em chat novo.
