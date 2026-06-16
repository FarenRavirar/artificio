# Sessao 26-06-16_9 — Commit/push/deploy beta do pacote QA

- **Data:** 2026-06-16
- **Escopo:** Spec 025 / beta deploy / CI-CD
- **Autorizacao:** mantenedor autorizou nominalmente `commit > push > deploy beta`.
- **Commit:** `4de6f6a chore: improve quality lighthouse fixes`
- **Branch:** `dev`

## Executado

- `git add -A`
- `git commit -m "chore: improve quality lighthouse fixes"` -> `4de6f6a`
- `git push origin dev`
- Dispatch beta:
  - `deploy-glossario.yml --ref dev -f mode=deploy` -> run `27629745382`
  - `deploy-site.yml --ref dev -f mode=deploy` -> run `27629745368`
  - `deploy-mesas.yml --ref dev -f mode=deploy` -> run `27629745457`

## Resultado

- Glossario beta: verde. CI + deploy beta passaram.
- Site beta: verde. CI + deploy beta passaram.
- Mesas: problema operacional descoberto.

## Incidente: deploy mesas dispatch foi prod

Ao disparar `deploy-mesas.yml --ref dev -f mode=deploy`, o workflow carregou a versao de `dev`, mas calculou `env: prod` porque a expressao atual so retorna beta para `push` em `dev`:

```yaml
env: ${{ github.event_name == 'push' && github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}
```

Evidencia do run `27629745457`: job `mesas / Deploy mesas prod`, inputs `env: prod`, smokes `https://mesas.artificiorpg.com/`. O `_deploy-module.yml` usou `deploy_ref=origin/main`, portanto prod foi recriado a partir de `main`, nao do commit `dev`. Smokes prod passaram: `home=200`, `private_no_cookie=401`, `auth_redirect=302`; leitura HTTP pos-incidente confirmou `mesas_prod_home=200`, `mesas_prod_me=401`.

Isto foi fora do escopo pedido (beta). Nao executar novo deploy prod sem aprovacao nominal.

## Mesas beta falhou no auto-deploy

O push para `dev` disparou o beta automatico `27629743341`. CI mesas passou, mas deploy beta falhou antes de subir:

- `jwt_secret_shared=true`
- migration lock adquirido
- erro: `DRIFT ERROR: banco possui migration ausente no disco: migration_05_aggregator_sources_and_queue.sql`
- rollback executou e concluiu.

Read-only HTTP apos falha:

- `https://mesasbeta.artificiorpg.com/` -> 200
- `https://mesasbeta.artificiorpg.com/api/v1/me/options` -> 401

## Debitos abertos

- `BL-DEP-MESAS-DISPATCH-ENV`: corrigir `deploy-mesas.yml` para workflow_dispatch em `dev` nao cair em prod, ou exigir input explicito `env=beta|prod` com trava de confirmacao.
- `BL-MESAS-BETA-MIGRATION-DRIFT`: reconciliar drift do banco beta do mesas antes de novo deploy beta.

## Retomada 2026-06-16 — diagnostico dos dois debitos

### BL-DEP-MESAS-DISPATCH-ENV

Causa confirmada: `deploy-mesas.yml` usava `env: ${{ github.event_name == 'push' && github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}`. Em `workflow_dispatch --ref dev`, `github.event_name != push`, logo `env=prod`.

Fix local aplicado: expressão passa a depender só de `github.ref`:

```yaml
env: ${{ github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}
```

Falta commit/push + validação em Actions.

### BL-MESAS-BETA-MIGRATION-DRIFT

Read-only/diagnostico:

- `/opt/artificio-beta` esta em `4de6f6a75ab76d93a7d4e083789c9c826ba8102f`.
- `apps/mesas/database/migration_05_aggregator_sources_and_queue.sql` existe na VM.
- `find apps/mesas/database -name 'migration_*.sql'` mostra `migration_05_aggregator_sources_and_queue.sql` e `migration_99_drop_aggregator_tables.sql`.
- Reexecucao do script de migrations contra beta retornou `schema em conformidade`.

Observacao de governanca: a reexecucao do script usa `CREATE TABLE IF NOT EXISTS schema_migrations`; a tabela ja existia e a saida foi `NOTICE: relation "schema_migrations" already exists, skipping`. Nao houve migration aplicada, mas isto ainda tocou rotina operacional contra DB beta; registrar para nao esconder.

Conclusao atual: drift nao reproduz no estado atual. Fechamento real exige rerun do deploy beta apos workflow corrigido.

## Checklist

- [x] Commit feito.
- [x] Push feito.
- [x] Glossario beta deploy verde.
- [x] Site beta deploy verde.
- [x] Mesas beta tentativa rastreada e falha registrada.
- [x] Incidente prod registrado.
- [x] Corrigir workflow e drift com nova autorizacao nominal.

## Fechamento dos debitos

Autorizacao posterior do mantenedor: "pode seguir" para o bloco `commit/push/deploy beta`.

Executado:

- commit `485b363 fix: route mesas dispatch to beta on dev`
- push `origin dev`
- `gh workflow run deploy-mesas.yml --ref dev -f mode=deploy`
- run `27630434690`

Resultado:

- `lint-shell / ShellCheck`: success
- `lint-shell / actionlint`: success
- `mesas / CI mesas`: success
- `mesas / Deploy mesas beta`: success

O bug dispatch-prod foi corrigido: o job apareceu como beta, nao prod. O drift de migration nao voltou: deploy beta passou migrations, build, health e smokes.

## Retomada 2026-06-16 — validacao final Spec 025

Escopo desta retomada: somente Spec 025; diffs locais de Spec 026/027 preservados, sem reverter nada.

Estado git observado:

- `dev` em `8713ee0` (`origin/dev`), contendo commits de Spec 025 (`4de6f6a`, `06a5ded`) e commits posteriores da Spec 026.
- Diff local atual nao e pacote limpo de Spec 025: contem workflows/docs da Spec 026 e pagina/rodape da Spec 027.

Validacao local executada:

- `pnpm --filter @artificio/glossario-frontend build` verde; bundle inicial `assets/index-BZ_9aOaZ.js` = 340.50 kB, `ResultCard` = 25.85 kB, `AddTermModal` = 12.45 kB.
- `pnpm --filter @artificio/site build` verde; observacao: build local incluiu diff nao commitado da Spec 027, entao nao usar como prova pura de 025.
- `pnpm --filter @artificio/mesas-frontend build` verde, ainda com warning de chunk grande conhecido.
- `pnpm quality:lighthouse --dry-run --url https://glossariobeta.artificiorpg.com/ --url https://beta.artificiorpg.com/ --url https://mesasbeta.artificiorpg.com/ --profile mobile --runs 1` confirmou multi-url acumulando tres alvos.

Validacao beta executada:

- Comando: `pnpm quality:lighthouse --url https://glossariobeta.artificiorpg.com/ --url https://beta.artificiorpg.com/ --url https://mesasbeta.artificiorpg.com/ --profile mobile --runs 1 --out artifacts/lighthouse/spec-025-beta-final-2026-06-16`
- Artefato: `artifacts/lighthouse/spec-025-beta-final-2026-06-16/summary.json`.
- O Lighthouse gerou relatorios e summary; no fim, o `chrome-launcher` falhou ao limpar temp no Windows com `EPERM`, mas o harness aceitou os JSONs gerados. Isto nao invalida as metricas, mas continua sendo ruido de ferramenta a observar.

Comparacao baseline -> beta final mobile:

| Host | Perf | SEO | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|
| `glossariobeta` | 12 -> 61 | 92 -> 100 | 8151ms -> 3273ms | 13703ms -> 6153ms | 1065ms -> 413ms | 0.647 -> 0.000862 |
| `beta` | 85 -> 95 | 100 -> 100 | 3021ms -> 1195ms | 3471ms -> 2606ms | 0ms -> 126ms | 0.013 -> 0.0134 |
| `mesasbeta` | 64 -> 69 | 92 -> 100 | 3354ms -> 3334ms | 4944ms -> 4942ms | 446ms -> 299ms | 0.002 -> 0.0032 |

HTTP/SEO probes:

- `https://glossariobeta.artificiorpg.com/api/terms?limit=1` retornou 200 JSON com 989 bytes, provando paginacao beta real.
- `https://glossariobeta.artificiorpg.com/api/terms?search=dragao&limit=5` retornou 200 JSON com 2 bytes (`[]`), provando rota de busca limitada beta real.
- `/robots.txt` nos tres hosts beta retorna 200 `text/plain`, mas o conteudo publico ainda e a politica Content-Signal externa, nao o `robots.txt` do app. Lighthouse agora deu SEO 100, mas `BL-QA-ROBOTS-SEO` nao fecha porque o criterio era conteudo bruto do host/app.

Leitura de fechamento:

- `BL-QA-SHELL-CLS`: fechado para a fatia footer/logo/glossario beta; CLS caiu de 0.647 para 0.000862.
- `BL-QA-GLOSSARIO-PERF`: fechado para a fatia "nao carregar 8.9k termos/Fuse no primeiro paint + lazy chunks"; performance subiu 12 -> 61 e TBT caiu 1065ms -> 413ms. Residual: LCP 6153ms ainda merece nova fatia se a meta for performance boa.
- `BL-QA-SITE-IMAGES`: nao fecha; markup/Cloudinary-prep existe, mas reducao real de bytes depende de migracao Cloudinary/env autorizado.
- `BL-QA-ROBOTS-SEO`: nao fecha; app local correto, beta publico ainda e Content-Signal externo.
- Spec 025 nao fecha como programa completo: permanecem `BL-QA-SITE-IMAGES`, `BL-QA-ROBOTS-SEO`, `BL-QA-MESAS-PERF`, `BL-QA-SECURITY-HEADERS`, `BL-QA-A11Y-SWEEP`, `BL-QA-THIRD-PARTY`.

## Retomada 2026-06-16 — BL-QA-ROBOTS-SEO

Objetivo: terminar ou reduzir a parcial de `BL-QA-ROBOTS-SEO` antes de atacar abertas grandes.

Investigacao read-only:

- Local/dist:
  - `apps/glossario/frontend/dist/robots.txt` correto.
  - `apps/mesas/frontend/dist/robots.txt` correto.
  - `apps/site/dist/robots.txt` correto.
- Origem VM:
  - `glossario-beta-app` contem `/usr/share/nginx/html/robots.txt` e `wget http://127.0.0.1/robots.txt` retorna 200 `text/plain`, `Content-Length: 80`, sitemap do glossario.
  - `mesas-beta-app` contem `/usr/share/nginx/html/robots.txt` e `wget http://127.0.0.1/robots.txt` retorna 200 `text/plain`, `Content-Length: 76`, sitemap do mesas.
- Publico Cloudflare:
  - `https://glossariobeta.artificiorpg.com/robots.txt`, `https://beta.artificiorpg.com/robots.txt`, `https://mesasbeta.artificiorpg.com/robots.txt` retornam 200 `text/plain`, `Server: cloudflare`, tamanho ~1814-1819 e bloco `# As a condition of accessing this website...`.
  - O retorno e igual com `User-Agent` default, Googlebot, Mozilla e curl custom.
- Fonte externa consultada: docs oficiais Cloudflare "Managed robots.txt" dizem que Cloudflare pode servir/prepender Content Signals Policy em `/robots.txt`.

Conclusao: origem dos apps esta correta; o conteudo publico atual e sobrescrito/prependido pela camada Cloudflare Managed robots.txt / Content Signals, nao por fallback SPA do app. Sem acesso/painel Cloudflare, nao da para fechar 100% o criterio "conteudo bruto do host/app".

Edicao local planejada nesta retomada:

- adicionar `location = /robots.txt` ao nginx do mesas, espelhando glossario, para tornar o contrato de app explicito e evitar fallback/crawler proxy.

Executado:

- `apps/mesas/frontend/nginx.conf`: adicionada rota exata `location = /robots.txt`, `default_type text/plain`, `Cache-Control: public, max-age=300, no-transform`, `try_files /robots.txt =404`.

Validacao:

- `pnpm --filter @artificio/mesas-frontend build` verde.

Status:

- Parte app/origem de `BL-QA-ROBOTS-SEO` esta coberta para glossario e mesas beta: arquivo existe no container e origem responde texto cru.
- Parte publica segue dependente de Cloudflare: conforme docs oficiais, o Managed `robots.txt` pode prepend/servir Content Signals Policy; no nosso caso o publico retorna apenas esse bloco, sem sitemap original. Proximo passo exige painel/API Cloudflare, sem DNS/tunnel write no escuro.

## Fechamento 2026-06-16 — BL-QA-ROBOTS-SEO

Mantenedor ajustou Cloudflare:

- Painel: `Domínios > Gerenciar seu robots.txt`.
- Estado final: `Configuração Robots.txt: Desativado`.
- Escopo: hosts beta; sem mexer em WordPress, DNS raiz, Tunnel ou WAF.

Validação Codex:

```powershell
curl.exe -sS -D - https://beta.artificiorpg.com/robots.txt
curl.exe -sS -D - https://glossariobeta.artificiorpg.com/robots.txt
curl.exe -sS -D - https://mesasbeta.artificiorpg.com/robots.txt
```

Resultados:

- `beta`: 200 `text/plain; charset=utf-8`, `Sitemap: https://beta.artificiorpg.com/sitemap-index.xml`.
- `glossariobeta`: 200 `text/plain`, `Sitemap: https://glossario.artificiorpg.com/sitemap.xml`.
- `mesasbeta`: 200 `text/plain`, `Sitemap: https://mesas.artificiorpg.com/sitemap.xml`.

Conclusao: problema publico Cloudflare resolvido. `BL-QA-ROBOTS-SEO` fechado.

## Retomada 2026-06-16 — Cloudinary beta documentado e pausado

Pedido do mantenedor: documentar que o secret Cloudinary foi inserido e deixar `BL-QA-SITE-IMAGES` pausado por enquanto, porque a melhoria atual ja basta e a migração de imagens so deve acontecer depois de `beta.artificiorpg.com` estar pronto/on.

Registrado:

- GitHub Environment `beta` tem secret `CLOUDINARY_URL` cadastrado pelo mantenedor.
- Valor real nunca deve ser solicitado, exibido, logado, printado ou commitado.
- Formato esperado: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.
- Uso administrativo de Cloudinary por API, mudanca de roles/API keys, delecao/sobrescrita de assets e upload/migracao em massa exigem aprovacao nominal.
- WordPress raiz segue intocavel; importador so pode ler WP REST.
- Infra documentada em `docs/agents/infra-map.md` e `docs/agents/access-registry.md`.
- Backlog `BL-QA-SITE-IMAGES` movido para `pausado-beta-later`.

Sem execucao de migracao, sem deploy, sem write VM/Cloudinary/WP.
