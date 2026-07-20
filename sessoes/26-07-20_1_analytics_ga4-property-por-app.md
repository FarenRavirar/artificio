# 26-07-20_1_analytics_ga4-property-por-app

## Cabeçalho
- Data: 2026-07-20
- Objetivo: investigar "GA4 nenhum dado recebido" e corrigir
- App/projeto: analytics (site, mesas, glossario, downloads)
- Gate: D (todos apps já em prod)

## Vínculos
- Supera D020, registra D117 (`.specify/memory/decisions.md`)
- Toca `packages/analytics` (config compartilhada), specs 032/035 históricas (não reabertas)

## Investigação
- Mantenedor reportou GA4 sem dados, colou snippet com `G-2H50PCM950`.
- `rg` no repo: `G-2H50PCM950` não existe em código nenhum. Código usa `G-8XN5BGPJP3` (D020, property canônica única cross-subdomínio, herdada do WordPress legado).
- `curl` em `artificiorpg.com` prod real: bundle `Analytics.astro...js` injeta `gtag('config', 'G-8XN5BGPJP3', ...)` corretamente — site prod funcionando, mandando dado pra property antiga.
- Mantenedor confirmou no painel GA4: property que ele olha (`Artifício RPG`, stream `https://artificiorpg.com`) tem measurement ID real `G-8FKEJX5L9G` — diferente tanto do código quanto do `G-2H50PCM950` colado.
- Mantenedor então revelou que criou **3 streams GA4 novos, um por app**: site `G-2H50PCM950`, mesas `G-43T3C6K6V6`, glossario `G-YVHMJEVTE4`. Downloads não tinha stream próprio.

## Decisão do mantenedor
- Trocar código pros 3 IDs novos (revoga D020 property única; adota 1 property por app).
- Downloads: usar o ID do site (`G-2H50PCM950`) provisoriamente até criar stream próprio.
- Site: fixar `PUBLIC_GA_ID` como default no compose (não é segredo, é público) em vez de depender de secret GitHub. Secret `production/PUBLIC_GA_ID` removido pelo mantenedor.

## Mudanças aplicadas
- `apps/site/docker-compose.{beta,prod}.yml`: `PUBLIC_GA_ID=${PUBLIC_GA_ID:-G-2H50PCM950}`
- `apps/mesas/docker-compose.{beta,prod}.yml` + `frontend/.env` + `frontend/.env.example`: `VITE_GA_ID=G-43T3C6K6V6`
- `apps/glossario/docker-compose.{beta,prod}.yml` + `frontend/.env` + `frontend/.env.example`: `VITE_GA_ID=G-YVHMJEVTE4`
- `apps/downloads/docker-compose.{beta,prod}.yml` + `frontend/.env.example`: `VITE_GA_ID=G-2H50PCM950` (provisório)
- `.specify/memory/decisions.md`: D020 marcada `superada (D117)`; D117 registrada
- `.specify/memory/project-state.md`: linha de decisões fechadas atualizada

## Checklist de fechamento
- [x] Código local dos 4 apps atualizado
- [x] `decisions.md`/`project-state.md` atualizados
- [x] Sessão registrada
- [x] Commit + push + PR #185 (`fix/analytics-ga4-property-por-app` → `dev`)
- [x] PR #185 merged em `dev`
- [x] Deploy beta: site/mesas/glossario **sucesso**; downloads **falhou** (ver incidente abaixo)
- [ ] `specs/backlog.md` — **atualizado** com `BL-DOWNLOADS-BETA-VOLUME-MISMATCH` (ver incidente)

## Incidente: downloads beta fora do ar (achado durante deploy GA4, não causado por ele)

Deploy beta de `downloads` (run [29759345736](https://github.com/FarenRavirar/artificio/actions/runs/29759345736)) falhou e revelou 2 problemas em cadeia, nenhum relacionado à mudança GA4 desta sessão:

1. **Guard de migration bloqueou corretamente**: `apply_required_migrations.sh` achou 19 migrations pendentes no schema `downloads` beta, limite é 5 (`MAX_AUTO_PENDING=5`). `schema_migrations` foi criado do zero nesse momento (`CREATE TABLE` no log) — indica que o tracking nunca rodou nesse ambiente, ou foi resetado.
2. **Rollback automático disparou**, mas **não recuperou o serviço**: `docker inspect downloads-beta-db` mostra container criado às 16:27 (durante o próprio rollback), usando volume `downloads-beta_pgdata_downloads_beta`. Existe um segundo volume `downloads_pgdata_downloads_beta` (nome sem hífen, projeto compose diferente), ambos com ~48-49MB de dado — mismatch de nome de projeto compose entre execuções antigas/novas do módulo downloads, containers atuais parecem estar no volume vazio/errado.
3. **Resultado real:** `downloads-beta-api` ficou `unhealthy`, log mostra erro Postgres `42P01` (tabela não existe) — a API tá rodando contra um banco sem as migrations aplicadas. **Downloads beta está fora do ar agora**, não só durante o rollback.
4. Erro secundário no log (`Cannot find module '/repo/scripts/git-hooks/install-hooks.mjs'` no step `prepare`) é silenciado por `|| true` no script — não contribuiu pra falha, é ruído.

**Não corrigido nesta sessão** (decisão do mantenedor: registrar, resolver depois). Requer sessão dedicada: comparar conteúdo dos 2 volumes (qual tem os dados reais das 19 migrations), decidir qual manter, resolver mismatch de nome de projeto compose na raiz (provavelmente `COMPOSE_PROJECT`/nome de diretório do deploy divergente entre runs), reaplicar migrations no volume correto, confirmar API healthy.

**Downstream nesta sessão:** por causa disso, `promote dev→main` + `deploy prod` seguem só para site/mesas/glossario. Downloads fica de fora até o incidente ser resolvido — prod de downloads continua com o código anterior (`G-8XN5BGPJP3` como GA ID, e sem risco adicional já que nunca chegou a fazer deploy beta com sucesso pra essa mudança).

## Incidente 2: mesas prod deploy falhou (achado durante promote/deploy, não causado por GA4)

Após promote `dev→main` (sucesso) e deploy prod disparado pra site/mesas/glossario, `mesas` prod (run [29761143263](https://github.com/FarenRavirar/artificio/actions/runs/29761143263)) falhou com exit code 3. Site e glossario prod tiveram sucesso.

**Causa:** script `apply_required_migrations.sh` tentou reaplicar `migration_118_discord_drafts_invariant.sql`, que já constava em `schema_migrations` (prod). O `INSERT INTO schema_migrations (...)` (linha 134, sem `ON CONFLICT`) bateu em `duplicate key value violates unique constraint "schema_migrations_pkey"`. O SQL da migration em si é idempotente (`IF NOT EXISTS` via `pg_constraint`), o bug é no fluxo de detecção de PENDING/registro do script de deploy — a lista de "pendentes" incluiu uma migration que já tinha sido aplicada e registrada antes.

**Rollback automático recuperou o serviço:** containers `mesas-db`/`mesas-api`/`mesas-app`/`mesas-cron` recreated + healthy, mesas prod voltou ao ar rodando o código anterior (sem a mudança GA4). GA ID de mesas prod continua `G-8XN5BGPJP3` até resolver.

**Corrigido nesta sessão (autorização nominal do mantenedor):**

- Diagnóstico read-only em prod: `SELECT * FROM schema_migrations WHERE migration_name LIKE '%118%'` confirmou registro real desde **2026-06-01 17:28:33**, `applied_by=ci:ubuntu@faren` — aplicada há mais de um mês via CI normal, não foi write manual recente. `query_schema_migrations()` roda contra o mesmo banco sem erro e retorna a linha normalmente fora do fluxo de deploy — não é falha total/silenciosa da query (`2>/dev/null || true` na função não mascarou um retorno vazio geral, só 1 migration entrou em PENDING, não todas). Causa exata da corrida não isolada (janela de ~0.9s entre `CREATE TABLE IF NOT EXISTS` e o cálculo de PENDING durante o próprio deploy, possível concorrência entre processos de deploy).
- Fix aplicado independente da causa exata da corrida: `scripts/deploy/apply_required_migrations.sh:134` — `INSERT INTO schema_migrations (...) VALUES (...) ON CONFLICT (migration_name) DO NOTHING;`. SQL de cada migration já é idempotente (padrão `IF NOT EXISTS` via `pg_constraint`/`pg_class`); com o `ON CONFLICT`, a transação inteira fica idempotente ponta a ponta — se a migration já foi aplicada e registrada, o insert vira no-op em vez de abortar a transação com `duplicate key`.
- **Validado contra prod real** (não destrutivo): rodei manualmente o mesmo `INSERT ... ON CONFLICT DO NOTHING` para `migration_118` contra `mesas-db` prod — retornou `INSERT 0 0` (sem erro, sem alterar a linha existente). Confirmado `applied_at` original intacto (`2026-06-01 17:28:33`) após o teste.
- Corrige o script compartilhado por todos os módulos (mesas/glossario/site/downloads/accounts/links) — não é fix isolado de mesas.

## Achado pós-PR (Codex, PR #185, 2026-07-20)
Codex apontou (P2): `.env` prod da VM (`/opt/artificio/apps/site/.env`, não versionado) tinha `PUBLIC_GA_ID=G-8XN5BGPJP3` gravado — como `docker compose --env-file` no deploy usa esse arquivo, o valor stale sobrescreveria o default novo do compose (`${PUBLIC_GA_ID:-G-2H50PCM950}`), mantendo o site preso na property antiga mesmo pós-merge/deploy.

**Verificado read-only na VM:** confirmado, linha existia. Beta (`/opt/artificio-beta/apps/site/.env.beta`) não tinha `PUBLIC_GA_ID` — limpo.

**Corrigido (aprovação nominal do mantenedor):** backup criado (`/opt/artificio/apps/site/.env.bak-ga4-20260720`), linha `PUBLIC_GA_ID` removida do `.env` prod real via `sed`. Default do compose agora é a única fonte, sem duplicação. `.env.bak-catalogtoken` (arquivo de backup antigo, sem uso runtime) mantém o valor antigo por ser só histórico — não afeta deploy.

## Critério de conclusão
Só fecha após: PR mergeada, deploy beta+prod dos 4 apps confirmado, e Realtime GA4 mostrando hits reais nas 4 properties novas (evidência visual/print do mantenedor).

## Estado
Em andamento — código pronto, aguardando autorização de commit/push/PR e depois deploy.
