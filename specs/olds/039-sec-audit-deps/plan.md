# 039 — Plano

## Abordagem

Duas alavancas de remediação, isoladas e reversíveis:

1. **Bump de dep direta** — apenas `dompurify` em `apps/mesas/frontend` (`^3.3.3` → `^3.4.11`). É a única vulnerável que é dep direta e tem patch no npm.
2. **`overrides` em `pnpm-workspace.yaml`** — força versão segura em deps transitivas. **NOTA (descoberto na execução):** pnpm@11.8 **não lê** o campo `pnpm.overrides` de `package.json` (`[WARN] no longer read`); o home novo é `pnpm-workspace.yaml`. Bloco final aplicado:

```yaml
overrides:
  "form-data@<4.0.6": ">=4.0.6"
  "undici@<7.28.0": ">=7.28.0 <8"   # travado em 7.x: undici 8.x removeu lib/handler/wrap-handler.js e quebra jsdom 29
  "@opentelemetry/core@<2.8.0": ">=2.8.0"
  "nanoid@>=4.0.0 <5.0.9": ">=5.0.9"   # condicional R5 — passou build+test
  "uuid@<11.1.1": ">=11.1.1"           # condicional R5 — passou build+test (exceljs OK)
  "esbuild@<0.28.1": ">=0.28.1"        # condicional R6 — passou build 15/15
```

Usar a forma `pkg@<faixa`: a substituição só atinge as instalações vulneráveis e evita forçar versão onde já está OK.

## Ordem de execução (do seguro ao arriscado)

1. **Baixo risco (R1/R2/R3/R4):** `dompurify` bump + overrides `form-data`/`undici`/`@opentelemetry/core`. `pnpm install`, build, audit. Esses não pinam consumidor crítico.
2. **Condicional `uuid` (R5):** adicionar override → install → build glossario/backend → smoke import exceljs. Se erro, remover linha.
3. **Condicional `nanoid` (R5):** adicionar override → install → build mesas/frontend → smoke editor markdown. `react-markdown-editor-lite` é CJS; alta chance de quebra com nanoid 5 ESM. Se erro, remover e registrar bloqueio.
4. **Condicional `esbuild` (R6):** adicionar override → `turbo build --force` total. vite/astro pinam esbuild; se qualquer build quebrar, remover. LOW dev-only Windows → aceitável adiar.

## Validação (resultado real)

- Por etapa: `pnpm install` (lockfile), `pnpm audit` (delta), build do(s) app(s) afetado(s).
- Final: `turbo run build --force` **15/15 verde** + `turbo run test --force` **21/21 verde** + `pnpm audit` **16→2** (só xlsx, →spec 034).
- `pnpm why` confirmou resolução de form-data/undici.
- Smoke DOMPurify 3.4.11: `<img src=x onerror=alert(1)>`/`<script>`/`javascript:` → sanitizado. PASS.

## Arquivos (estado real)

- `pnpm-workspace.yaml` — bloco `overrides` (NÃO `package.json`; pnpm@11.8 ignora lá).
- `apps/mesas/frontend/package.json` — `dompurify` `^3.4.11`.
- `pnpm-lock.yaml` — regenerado.
- `apps/mesas/frontend/vitest.config.ts` — fix débito D1 (`test.env`).
- `apps/site/importer/media.test.ts` — fix débito D2 (helper `enableCloudinary`).
- `specs/backlog.md`, `.specify/memory/project-state.md` — status.
- `sessoes/26-06-21_2_sec_audit-deps.md` — evidência (audit antes/depois, builds, smokes, débitos).

## Branch / PR

- Branch própria `fix/039-sec-audit-deps` a partir de `dev`.
- PR para `dev` (check `lint + build + test` verde) — exige autorização nominal por ação.
- Sem promoção a `main` nesta spec sem aprovação separada.

## Decisões — resolvidas na execução

- `nanoid`/`uuid`/`esbuild`: a previsão de bloqueio upstream **não se confirmou** — os 3 overrides passaram build (15/15) e testes (21/21). Eliminados, sem débito residual. Não foi preciso trocar `react-markdown-editor-lite` nem `exceljs`.
- Único residual = `xlsx` 2×HIGH → spec 034 (abandonado no npm, fora desta fatia).
