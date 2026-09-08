# Plano — 021

## Arquitetura da solução
**Híbrido B+**: uma fonte de verdade só para o que pode ser único (linguagem/UX + contrato do payload), runtime e persistência portados por app.

```
packages/ui  ──>  ./feedback (data-only, sem React/auth, Astro-safe)
  ├─ kind enum, SubmitFeedbackPayload type, limites (espelho DEV_FEEDBACK_LIMITS)
  └─ copy PT canônica (títulos, labels, placeholders, toasts, aria)
        │ importado por
        ├─ apps/glossario/frontend  (widget React + coletor diagnóstico)
        ├─ apps/site (island vanilla)  +  apps/site-admin (triagem React)
        └─ apps/mesas (opcional, anti-drift — FR-010)

Backends (port, não compartilhado):
  glossario/backend  → Express pg cru  → tabela dev_feedback (migration própria D059)
  site/server        → store de arquivo/JSON (sem Postgres) — ver decisão abaixo
```

Precedente do contrato data-only: B13 já criou subpaths `@artificio/ui/brand` e `@artificio/ui/modules` (data-only, sem React, consumidos pelo Astro). `./feedback` segue o mesmo molde.

## Arquivos afetados (por módulo/pacote)
**packages/ui** (SDD Completo):
- `src/feedback.ts` (novo) — enum, tipos, limites, copy PT.
- `package.json` exports — novo subpath `./feedback` (data-only, espelho de `./brand`/`./modules`).
- `src/index.ts` — re-export opcional (não obrigatório para Astro).

**apps/glossario/frontend**:
- `src/features/dev-feedback/{FeedbackButton,FeedbackModal}.tsx`, `devFeedbackApi.ts`, `lib/diagnostics.ts` (port adaptado: `apiClient`/`AuthContext`/toast do glossário; copy de `@artificio/ui/feedback`).
- montar `<FeedbackButton/>` no shell do app + instalar diagnostics no boot (`main.tsx`).

**apps/glossario/backend**:
- `src/routes/feedbackRoutes.ts` + `src/controllers/feedbackController.ts` (POST público + admin GET/PATCH/DELETE).
- `src/validators/feedbackValidator.ts` (port de `parseDevFeedbackInput`, entrada `unknown`).
- `src/services/cloudinary.ts` (port mínimo: upload/delete screenshot) — só se credencial disponível.
- `src/index.ts` — registrar rotas; rate-limit público.
- testes (jest, espelhando mesas): validador + rota.

**apps/glossario/database**:
- `migration_16_dev_feedback.sql` (novo, fluxo D059): tabela `dev_feedback` aditiva/online-safe, header completo. (numeração: próxima após `migration_15`).

**apps/site (público Astro)**:
- `src/components/FeedbackWidget.astro` (novo) — markup + `<script>` vanilla (botão flutuante + modal + fetch + coletor diagnóstico em JS puro + screenshot opcional).
- incluir no layout base (`Base.astro`) condicional (não em rotas que devam esconder, ex. admin/preview).

**apps/site/server**:
- `feedback-store.ts` (novo) + rotas POST público / admin no `admin-api.ts`/`server.ts`. Persistência: ver decisão.

**apps/site-admin**:
- view de triagem (lista/filtro/status/notas/arquivar/excluir) consumindo a API do `site/server`.

## Decisão pendente (resolver no T de persistência do site, default proposto)
`apps/site/server` **não tem Postgres** (só file/media store). Opções:
- **(default) store JSON/arquivo** no `site/server`, no molde do `media-store.ts`/content store já existente — zero nova dependência, coerente com a natureza do app. Triagem lê/escreve o arquivo. Aceitável p/ volume baixo de feedback.
- (alt) adicionar SQLite — mais robusto p/ concorrência, mas nova dependência/infra.
- (alt) postar feedback do site a um backend já existente — acopla apps, rejeitado (isolamento).
→ Confirmar com mantenedor ao chegar no T do site; seguir default salvo objeção.

## Contratos/interfaces tocados
- **packages/ui exports**: novo subpath `./feedback` (aditivo, não quebra consumidores). Auth/accounts: **intocado**. DNS/subdomínio: **intocado**.
- **Schema**: glossario ganha tabela nova (aditiva). site ganha store novo (arquivo). mesas: intocado.

## Impacto em consumidores (quem usa o que vou mexer)
- `packages/ui`: site, site-admin, glossario, mesas, accounts. Mudança é **aditiva** (novo subpath) → smoke de build de todos; nenhum import existente alterado.
- Astro zero-JS: validar `_astro` pós-build (island não vaza JS pro shell).

## Rollback
- `packages/ui`: remover subpath/arquivo `feedback` (aditivo → reverter sem efeito em terceiros).
- glossario: migration aditiva (tabela isolada; drop seguro se preciso); rotas/UI removíveis.
- site: remover widget/island + store (arquivo isolado).
- Por app independente; nada cross-app obrigatório.

## Validação (como provo que funciona)
- `pnpm turbo run build` 13/13 + `check-token-parity` OK.
- `pnpm --filter @artificio/site build` → `output: static`, `_astro` sem JS de shell (só island + Pagefind/GA4).
- glossario: build front+back + jest (validador/rota) verdes; smoke envio anônimo + email + admin triage.
- site: smoke island (botão→modal→POST 201; sem screenshot quando degradado).
- Copy idêntica nos três (grep das strings vindas de `@artificio/ui/feedback`).
- `git diff --check` limpo.
- Sem commit/push/deploy sem aprovação nominal; publicar = branch→PR→dev; prod só autorizado.
