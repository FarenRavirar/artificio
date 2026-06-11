# Tasks — 012

- [x] T1 — Importar legado → `apps/glossario` (sem segredos/`*.key`/`node_modules`) · **feito**: backend (34 arq) + frontend completos em `apps/glossario`; `@artificio/glossario-{frontend,backend}`; React 18→19 p/ consumir `@artificio/ui`; Dockerfiles multi-stage monorepo; `pnpm install` OK.
- [x] T2 — Build no monorepo · **feito**: `turbo build @artificio/glossario*` verde (frontend 1580 módulos React19 + backend tsc + packages). Legado não tinha testes automatizados (confirmado).
- [x] T3 — UI G1: reusa `@artificio/ui` Header/Footer (D058) · **feito (build-level)**: `GlossarioHeader` compõe o Header compartilhado (nav domínio `defaultNavItems` + `userMenu` admin/contribuição/perfil + `actions` changelog/+sugestão + `sessionOverride` legado + `onLogout`/`onLoginClick`); Footer `variant=dark`; Header legado removido; `@artificio/ui/styles.css` importado. Props aditivas no `packages/ui` (smoke mesas/accounts/site verde). **Pendente: smoke visual no beta** (Nielsen).
- [x] T4 — Composes padrão monorepo + `deploy-glossario.yml` via `_deploy-module.yml` · **feito (arquivos criados)**: `docker-compose.{beta,prod}.yml` (rede `artificio_net`, containers `glossario[-beta]-{app,api,db}`, volumes preservados) + workflow gated. **Pendente: pr-checks no PR.**
- [ ] T5 — [APROVAÇÃO] rota tunnel `glossario.artificiorpg.com` + materializar app nos clones VM · feito quando: hostname resolve no container (beta primeiro).
- [ ] T6 — [APROVAÇÃO] deploy beta + smoke (200, busca, login legado, contagens DB) · feito quando: smoke verde em `glossariobeta.` (ou host beta decidido).
- [ ] T7 — 301 `glossariorpg.` → `glossario.` preservando path · feito quando: `curl -sI` mostra 301 + Location correto p/ 3 rotas amostra.
- [ ] T8 — Atualizar nav compartilhado (`packages/ui` defaultNavItems + site `MODULES`) p/ URL nova · feito quando: HTML servido aponta `glossario.`.
- [ ] T9 — [APROVAÇÃO] promote prod + smoke + desativar workflows do repo legado · feito quando: prod verde; repo legado sem run novo.
- [ ] T10 — Registrar decisão D0NN (hostname `glossario.` supera `glossariorpg.` do D017) + atualizar `project-state.md`/`roadmap.md`/sessão · feito quando: docs atualizados, grep limpo de `glossariorpg.` fora de contexto histórico/301.
