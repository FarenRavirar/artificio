# Sessão 26-06-11_2 — execução spec 012 (glossário → monorepo)

- **Data:** 2026-06-11 · **Módulo:** apps/glossario (novo) · **Gate:** D · **Spec:** `specs/012-glossario-monorepo/`
- **Objetivo:** T1–T4 locais (import, build, UI G1, deploy artifacts); T5+ (VM/deploy) com aprovação por ação.

## Plano
1. T1: robocopy legado → `apps/glossario` (excl. node_modules/dist/.venv/.git/*.key/.env) + renomear packages `@artificio/glossario-{frontend,backend}` + integrar pnpm/turbo.
2. T2: build + testes no monorepo.
3. T3: UI G1 (`@artificio/ui` Header/Footer/tokens + nav cross-módulo).
4. T4: composes padrão monorepo (rede `artificio_net`, containers glossario-* / glossario-beta-*) + `deploy-glossario.yml` via `_deploy-module.yml`.
5. T5–T10: tunnel, deploys, 301, nav compartilhado, decisão D0NN — cada write VM/push com aprovação.

## Estado (atualizado)
- [x] T1 import — backend (34 arq portados à mão) + frontend completo (robocopy) em `apps/glossario`. `@artificio/glossario-{frontend,backend}`, React 18→19, Dockerfiles multi-stage monorepo, composes `artificio_net`, `deploy-glossario.yml`.
- [x] T2 build — `turbo build @artificio/glossario*` **verde** (frontend 1580 módulos React19 + backend tsc). Legado sem testes automatizados.
- [x] T3 UI G1 (reuso, D058) — **`GlossarioHeader` compõe o `@artificio/ui` Header compartilhado** (não duplica chrome): nav domínio `defaultNavItems` + `userMenu` (admin/contribuição/perfil) + `actions` (changelog/+sugestão) + `sessionOverride` (auth legado) + `onLogout`/`onLoginClick`. Footer `@artificio/ui` dark. Header legado deletado. **Mudança aditiva no `packages/ui`** (`onLogout`/`onLoginClick`/`loginLabel`, default SSO) → **smoke mesas/accounts/site verde** (pétrea de shared satisfeita no build).
- [x] T4 deploy artifacts — composes + workflow criados.
- [ ] T5+ — VM/tunnel/301/deploy/prod = **aprovação por ação** (não iniciado).

## Falta (mecânico/aprovação)
- `apps/glossario/package.json` raiz (`@artificio/glossario`) p/ o filtro `@artificio/glossario*` do deploy casar (hoje só `-frontend`/`-backend`; build local usa wildcard, ok; conferir no workflow).
- lucide-react 0.363 peer warning (react<=18) — funciona no 19; bump opcional.
- Smoke visual do chrome no beta (Nielsen).
- T5+: rota tunnel `glossario.`, 301 `glossariorpg.`→`glossario.`, deploy beta→prod, nav compartilhado, desativar workflows do repo legado.
- **Nada commitado/pushado** (doc+código viajam juntos no 1º commit; push/deploy = aprovação).

## Achados de recon (p/ adaptação)
- Composes legados referenciam rede `gerenciador_telegram_default` (repo local stale; VM já roda `artificio_net` desde Fase 1) → composes novos.
- Frontend Dockerfile legado copia `dist` pré-buildado pelo Actions runner (rsync) → trocar p/ multi-stage build in-image (padrão monorepo git-pull D039).
- Backend: Express 5 + pg + bcrypt + jsonwebtoken (JWT custom legado — fica até spec 015), TS ^6.0.2, sem testes automatizados visíveis (confirmar).
- Frontend: React 18 + Vite 5 + Tailwind 3 + Fuse.js. Sem bump de major nesta spec (D054: bump = decisão à parte).
- nginx do app proxy `/api/` → `glossario-api:3000`.

## Critério de conclusão
Tasks T1–T10 da spec 012 fechadas com evidência; `project-state.md` atualizado.
