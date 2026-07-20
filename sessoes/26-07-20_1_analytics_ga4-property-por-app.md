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
- [ ] Deploy real (beta→prod) dos 4 apps — **não executado nesta sessão**, containers rodando ainda servem IDs antigos até rebuild
- [ ] Commit/push/PR — **não autorizado ainda**
- [ ] `specs/backlog.md` — nada a atualizar (sem item ativo de analytics; D117 já documenta a decisão)

## Critério de conclusão
Só fecha após: PR mergeada, deploy beta+prod dos 4 apps confirmado, e Realtime GA4 mostrando hits reais nas 4 properties novas (evidência visual/print do mantenedor).

## Estado
Em andamento — código pronto, aguardando autorização de commit/push/PR e depois deploy.
