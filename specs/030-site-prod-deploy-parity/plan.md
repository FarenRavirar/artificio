# Plano — 030 Site deploy PROD próprio (paridade)

> **ATENÇÃO (2026-06-18):** Fases 2-4 desta spec foram delegadas à **spec 031** (`specs/031-site-prod-data-fluxo/`). A spec 031 corrige o fluxo de dados (prod canônico → beta staging) que é pré-requisito para completar seed, flip de rota e validação noindex. **Spec 031 é bloqueadora das Fases 2-4.**

## Estratégia

Trazer o site ao mesmo shape de deploy de mesas/glossario: 1 entrada no `deploy-manifest.json` com env derivado do ref, `docker-compose.prod.yml` próprio, container+DB prod isolados do beta. A raiz passa do redirect→beta para o `site-prod-app`. Beta volta a staging e recebe `noindex` (fecha T9 da 029).

Tudo o que é código/compose/manifest entra em `dev` via **branch+PR** (D072/D073, check `lint + build + test` verde). Deploy/VM-write/seed/rota = **aprovação nominal por ação**; rota Tunnel = **mantenedor**.

## Modo de trabalho

Claude planeja; OpenCode (DeepSeek) executa via MCP `opencode` (escopo local). Cada ação = aprovação nominal do mantenedor.

## Fases

### Fase 0 — código ✅ CONCLUIDA (PR #58 mergeado, `49ef112`→`dev`, `594c9a5`→`main`)
- F0a: `apps/site/docker-compose.beta.yml:30` → `PUBLIC_SITE_URL=https://beta.artificiorpg.com` (R11). ✅
- F1: `apps/site/docker-compose.prod.yml` (espelha beta, nomes prod, `PUBLIC_SITE_URL` raiz, volume `pgdata_site_prod`, memory limits ≈512m, `start_period` ≥180s, comentário `SITE_FORCE_REBUILD`). ✅
- F2: `deploy-manifest.json` entrada `site` → shape paridade (R2). ✅
- F3: `beta` emite `noindex` (R8) — `X-Robots-Tag` no server por env (`SITE_NOINDEX=true`). ✅
- Gate F0: PR verde ✅, `actionlint` ✅, manifest válido ✅, build site/site-admin OK ✅.

### Fase 1 — stand-up prod na VM ⚠️ PARCIAL (bloqueada por spec 031)
- F4: secrets do GitHub Environment prod do site (mantenedor). GitHub Environments `beta`/`production` existem; site-specific secrets não são usados pelo deploy (`--env-file` do disco supre). ⚠️ baixa prioridade.
- F4b: **(mantenedor) bootstrap do arquivo `apps/site/.env` no disco da VM** (R12). ✅ Concluído — `/opt/artificio/apps/site/.env` (7 keys, JWT casado, CLOUDINARY copiados).
- F5: deploy prod dispatch: `gh workflow run deploy.yml -f module=site -f mode=deploy --ref main`. ✅ Executado (run 27779276620). `site-prod-db` healthy, `site-prod-app` em boot loop.
- Gate F1: ❌ Bloqueado — `site-prod-app` não fica healthy porque DB prod vazio (0 posts) → build Astro quebra em `Card.astro:9`. **Depende de spec 031 (seed do DB).** Containers existem (`site-prod-db` healthy), `site-beta-app` segue servindo raiz (D075).

### Fase 2 — seed do conteúdo → **SPEC 031** (bloqueadora)
- F6/F7: snapshot + `pg_dump` beta→prod. Agora parte da spec 031 Fase 1 (T1a→T1d), com correção: após seed, prod vira canônico e beta suga do prod.
- Gate F2: contagens prod == beta; `/healthz` prod posts>0. → spec 031 T2a.

### Fase 3 — flip da rota (mantenedor) + aposentar redirect → **SPEC 031**
- F8: rota Tunnel raiz→`site-prod-app`; remove redirect D075. → spec 031 T3c.
- Gate F3: smoke público raiz, isolamento beta. → spec 031 T3d/T3e.

### Fase 4 — fechar T9 + staging real → **SPEC 031**
- F9: validar noindex beta, raiz sem noindex. → spec 031 T3e.
- F10: registro docs. → spec 031 T4a/T4b/T4c.

## Pontos de decisão (mantenedor)

- **Fonte de verdade pós-cutover:** prod vira canônico de conteúdo; beta = descartável/sincronizável a partir do prod. **Decidido em spec 031:** prod canônico, beta staging que suga do prod. Sync mechanism a definir (spec 031 T3a).
- **noindex beta — mecanismo:** `X-Robots-Tag` no server por env. ✅ Implementado na Fase 0 (SITE_NOINDEX=true no compose beta, middleware em server.ts).
- **auto_deploy_on_push:** habilitar `push:dev`→beta após estável (hoje dispatch-only).

## Dependência bloqueadora

**Spec 031** (`specs/031-site-prod-data-fluxo/`) é pré-requisito para Fases 2-4. Executar na ordem:
1. Spec 031 Fase 1 (seed prod, validar healthy)
2. Spec 031 Fase 2 (flip autoria, isolamento)
3. Retomar spec 030 Fases 3-4 (flip rota, noindex, registro) — cobertas pela spec 031 Fases 3-4

## Rollback

- Pré-flip: nada a reverter (raiz segue no redirect→beta).
- Pós-flip com falha: mantenedor reaponta rota de volta ao redirect→beta; prod fica parado para diagnóstico. Snapshots de F6 protegem dados.

## Dependências externas

- Mantenedor: secrets prod (F4), seed/VM-write (F6/F7), rota Tunnel (F8). DNS autoritativo intocado.
