# 016 — mesas-backend → Express 5 (padronizar monorepo em express 5)

- **Módulo/Pacote:** apps/mesas (backend) + stack canônica (D060)
- **Gate relacionado:** nenhum (saúde de build; mesas já passou Gate D)
- **Nível SDD:** Completo (toca backend de módulo em prod + contrato de stack; CI/CD)

## Problema
`apps/mesas/backend` **não compila no `dev`** (pré-existente, E004): `src/routes/upload.ts:25` TS2769 — `@types/multer@2.1.0` (par do multer 2.x) traz tipos de **express 5**, incompatíveis com o `express ^4.19.2` do mesas (`@types/express-serve-static-core@5.1.1` vs `@4.19.8`). Reproduzido em worktree limpo de `origin/dev` com `--frozen-lockfile`. Deploys recentes podem estar mascarando via cache turbo/imagem stale. O glossário (spec 012) entrou em express 5; misturar majors no workspace gera o conflito. Decisão D060: monorepo padroniza em **express 5**.

## Requisitos (numerados, testáveis)
1. `apps/mesas/backend` migra para `express ^5` + `@types/express ^5` (alinha com `@types/multer@2`/multer 2.x).
2. Ajustar quebras conhecidas do express 4→5: `path-to-regexp` v8 (rotas com `*`/regex/optional params → nova sintaxe), `req.query`/`req.params` agora getters (não reatribuir), remoção de `app.del`/`res.json(status,obj)`/`res.sendfile`/`req.param()`, `res.redirect('back')`, middleware de erro async (express 5 captura rejeição de Promise — rever `express-async-errors`).
3. `pnpm -w turbo run build --filter=@artificio/mesas-backend` **verde** (sem cache).
4. Testes do mesas verdes (frontend + backend) com env dummy/CI postgres.
5. Smoke local das rotas críticas do backend (health, upload, auth redirect) inalteradas.
6. Sem mudança de comportamento público (mesmas rotas/status); SEO/contratos intactos.
7. Confirmar que nenhum outro módulo fica em express 4 (grep `"express": "^4`); glossário/accounts/site em 5.

## Critérios de aceite
- [ ] `turbo build @artificio/mesas*` verde sem cache; `upload.ts` compila.
- [ ] Suites mesas verdes (ou falhas pré-existentes ambientais documentadas).
- [ ] Deploy beta (mesasbeta) verde + smoke 200/401/302.
- [ ] Grep: nenhuma dep `express@^4` no monorepo.
- [ ] E004 marcado resolvido em `errors.md`.

## Fora de escopo
Reescrever lógica do mesas. Migrar outros módulos que já são express 5. Mudança de multer runtime.

## Riscos e impacto em outros módulos
- mesas roda em **prod** (Gate D fechado) → migração com cuidado; snapshot + smoke; rollback pelo `_deploy-module`.
- Auth do mesas valida `artificio_session` (`@artificio/auth`) — não mexer no contrato SSO.
- path-to-regexp v8 é a maior fonte de quebra silenciosa: auditar TODAS as rotas com wildcard/regex.
- **Ponte JÁ aplicada (2026-06-11):** `pnpm.overrides "@types/multer>@types/express": "^4.17.21"` no root destrava o build (E004). **T0 desta spec = REMOVER esse override** ao migrar p/ express 5 (senão o multer volta a usar tipos express-4 e diverge do express-5 do mesas).
