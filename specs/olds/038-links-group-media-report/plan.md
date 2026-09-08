# Plano — 038

## Arquitetura da solução
Pipeline de mídia no **backend** do links (Express `server/`), reusando `@artificio/media`:

```
invite_url (chat.whatsapp.com/<code>)
  → fetch página (GET, timeout, UA explícito)        [R1: extrator og:image]
  → parse <meta property="og:image" content="...">    (sanitizar/validar URL)
  → @artificio/media uploadFromUrl(ogImage, {folder:"links/groups"})  [R2]
  → grava logo_url + logo_public_id no grupo (idempotente por hash)
```

- **R1 extrator** (`server/lib/whatsapp-og.ts`): `fetch` da página de convite, regex/parse do `og:image`; rejeita se ausente, se for o avatar genérico do WhatsApp (heurística por URL/dimensão), ou se não-imagem. Read-only, nunca entra no grupo. Degrada gracioso → `{ imageUrl: null, reason }`.
- **R2 upload**: `uploadFromUrl` já valida content-type/tamanho/hash e devolve `public_id` por sha256 do conteúdo → idempotente. Persistência via Kysely.
- **R3 reidratação** (`server/lib/rehydrate-logos.ts`): varre `groups status='active'`; para cada um chama R1→R2; compara `public_id` novo vs atual: se igual, no-op; se diferente, atualiza e `deleteAsset(antigo)`. Retorna `{updated, unchanged, failed, skipped}`.
- **R4 admin**: rota `POST /api/admin/v1/groups/rehydrate-logos` (admin-only, mesmo guard das rotas admin existentes, rate-limited) → chama R3 → JSON com contadores. Botão no `AdminPanel.tsx`.
- **R5 cron**: `.github/workflows/links-logo-rehydrate.yml`, `schedule: cron` domingo, chama a rotina (via endpoint admin com secret, ou `docker exec` script na VM no padrão do `mesas-auto-archive.yml`), job `guard` de branch igual aos crons de prod (D073). Sem segredo exposto; falha visível.
- **R6 reportar**: migration `migration_002_group_reports.sql` (tabela `group_reports`: id, group_id FK, reason enum, note text sanitizado, reporter_email nullable, created_at, status). Rota pública `POST /api/groups/:slug/report` (rate-limited, sanitiza note, sem login obrigatório). UI: ação "Reportar" no `GroupCard.astro` → ilha React (modal motivo). Admin: fila em `AdminPanel.tsx` (`GET /api/admin/v1/reports`).
- **R7 nav**: confirmar `links` em `modules.ts` (já está); rebuild+redeploy de glossario/mesas/site/accounts para propagar o nav. Sem mudança de código no `modules.ts` (só propagação) — a menos que o label/ordem precise ajuste.

## Arquivos afetados (por módulo/pacote)
- `apps/links/server/` — extrator og:image, rotina reidratação, rotas admin + report.
- `apps/links/database/migration_002_group_reports.sql` — nova tabela.
- `apps/links/src/components/GroupCard.astro` + nova ilha `ReportButton.tsx` — botão Reportar.
- `apps/links/src/components/admin/AdminPanel.tsx` — botão Reidratar + fila de reports.
- `apps/links/db/seed.ts` — opcional: rodar reidratação pós-seed para popular logos.
- `.github/workflows/links-logo-rehydrate.yml` — cron domingo + guard.
- `packages/media` — só se faltar capacidade (ex.: opção de overwrite por public_id estável); evitar mudar se `uploadFromUrl` já basta.
- `packages/ui/src/modules.ts` — só se ajustar label/ordem do links (senão intocado).

## Contratos/interfaces tocados
- **Auth/accounts:** rotas admin reusam o guard SSO já existente no links (role=admin). Sem mudança em `packages/auth`/`accounts.`.
- **Schema:** nova tabela `group_reports` (migration online-safe, sem backup); `groups.logo_url`/`logo_public_id` já existem.
- **DNS/subdomínio:** nenhum (links já roteado).
- **Cloudinary:** nova pasta `links/groups`; signed, backend.

## Impacto em consumidores
- `packages/media`: se tocado, smoke dos consumidores (site/mesas/glossario). Preferência: **não tocar**.
- `packages/ui` nav: rebuild/redeploy de todos os apps com header compartilhado; smoke visual do header em cada um.
- WhatsApp: somente leitura; sem impacto em terceiros nosso.

## Rollback
- Mídia: `logo_url`/`logo_public_id` são colunas; reverter = limpar valores (volta ao placeholder). Assets Cloudinary removíveis por `public_id`.
- Reports: `DROP TABLE group_reports` (online-safe) + reverter rotas/UI via revert do PR.
- Cron: desabilitar/remover o workflow.
- Nav: redeploy é idempotente; rollback = re-deploy do build anterior.

## Validação (como provo que funciona)
- Local/beta: rodar reidratação contra os 13 grupos curados; conferir `logo_url` = `res.cloudinary.com/...` e imagem abre; home sem placeholders nos que têm og:image.
- `curl` admin rehydrate → contadores coerentes; cron `workflow_dispatch` manual verde antes de confiar no schedule.
- Report: POST público persiste linha; admin lista; sanitização provada com payload hostil.
- Nav: `curl` de cada app consumidor mostra `links.artificiorpg.com`.
- Tudo por PR com check `lint + build + test` verde; smoke pós-deploy registrado na sessão.
</content>
