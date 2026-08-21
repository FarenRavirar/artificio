# Tasks — Spec 095 · Blue-green nos ambientes de produção

## Convenções

- Cada fase é um PR independente.
- Nenhuma task autoriza commit, push, merge, deploy, escrita na VM ou mudança no Tunnel.
- Deploy/VM/Cloudflare exigem aprovação nominal por ação conforme `AGENTS.md`.
- Durante reviews, validar apenas os pacotes/arquivos afetados; validação repo-wide somente no fechamento e uma suíte por vez.
- `[ ]` pendente · `[x]` concluída · `[!]` bloqueada.

## Fase 0 — Gate da spec

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T0.1 | Revisar arquitetura de três planos, rollout e exclusões | R-BG-01..18 | [ ] |
| T0.2 | Confirmar que `glossario` será o piloto e `accounts` o último | R-BG-18 | [ ] |
| T0.3 | Aprovar nominalmente o início da implementação local | gate do mantenedor | [ ] |

## Fase 1 — Fundação do orquestrador, sem tráfego real

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T1.1 | Estender manifest/schema com estratégia por ambiente, serviços release/state, health, rotas e identity endpoint | R-BG-01, R-BG-03, R-BG-07 | [ ] |
| T1.2 | Criar biblioteca shell do state machine blue-green e state file reconciliável | R-BG-06, R-BG-17 | [ ] |
| T1.3 | Criar template de ingress NGINX por projeto com upstream blue/green, config test e reload | R-BG-04, R-BG-08 | [ ] |
| T1.4 | Criar build SHA-tagged e labels de release; remover dependência de `latest` no caminho prod | R-BG-06 | [ ] |
| T1.5 | Criar capacity guard, lock VM-wide e concurrency prod sem cancel-in-progress | R-BG-14 | [ ] |
| T1.6 | Criar cleanup allowlist que preserve atual/anterior e não faça prune cego | R-BG-09, V-BG-13 | [ ] |
| T1.7 | Implementar branch explícito: prod blue-green, beta in-place | R-BG-01 | [ ] |
| T1.8 | Testar falhas em build, health, migration, config NGINX, smoke, rollback, interrupção e divergência de state | V-BG-01, V-BG-05, V-BG-07, V-BG-11 | [ ] |
| T1.9 | Testar request lento atravessando reload e dois slots simultâneos com fixture local | V-BG-04, V-BG-06 | [ ] |
| T1.G | **Gate:** review adversarial do state machine e dos caminhos de falha | nenhuma escrita externa | [ ] |
| T1.PR | Verde pontual + PR da fundação; nenhuma ativação em produção | evidência anexada ao PR | [ ] |

## Fase 2 — Piloto `glossario`

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T2.1 | Separar Compose state/ingress/slot; preservar DB e volume existentes | R-BG-03..05 | [ ] |
| T2.2 | Tornar frontend/API slot-specific e preservar headers, Real IP e catálogo interno | R-BG-12, R-BG-13 | [ ] |
| T2.3 | Adicionar identity SHA, readiness e smokes direto/externo | R-BG-07, R-BG-15 | [ ] |
| T2.4 | Provar migrations compatíveis com old+new | R-BG-10 | [ ] |
| T2.5 | Preparar bootstrap e rollback do Tunnel sem executar | R-BG-16 | [ ] |
| T2.6 | Com aprovação própria, bootstrap do ingress e primeiro cutover prod | V-BG-02..08 | [ ] |
| T2.7 | Medir pico de recursos, Host, drain e bake; fixar parâmetros no manifest/runbook | R-BG-14, plan §12 | [ ] |
| T2.8 | Com aprovação própria, executar rollback real e segundo deploy consecutivo | critérios 2 e 5 | [ ] |
| T2.G | **Gate:** probe externo sem falha, DB sem restart, rollback sem rebuild | evidência da VM e Actions | [ ] |
| T2.PR | Verde pontual + PR/registro do piloto; liberar onda seguinte somente com gate nominal | — | [ ] |

## Fase 3 — `links` e `site`

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T3.1 | Migrar `links` para state/ingress/slots | R-BG-03..09 | [ ] |
| T3.2 | Remover dependência do crontab em `links-app`; adotar runner singleton estável e teste de uma execução | R-BG-11 | [ ] |
| T3.3 | Migrar `site` para state/ingress/slots e estabilizar endpoint interno de catálogo, incluindo defaults Compose e validação literal do hydrator de mesas | R-BG-03..09, R-BG-13 | [ ] |
| T3.4 | Externalizar migration/export necessários do entrypoint do site para runner singleton antes da readiness | R-BG-10 | [ ] |
| T3.5 | Provar old+new do site contra schema expandido e identidade de assets | V-BG-08, V-BG-10 | [ ] |
| T3.6 | Com aprovações separadas, bootstrap/cutover/rollback de links e depois site | R-BG-16, R-BG-18 | [ ] |
| T3.G | **Gate:** dois projetos verdes, cron único, catálogo interno e rollback exercitados | evidência Actions/VM/smoke | [ ] |
| T3.PR | Verde pontual + PR da onda 3 | — | [ ] |

## Fase 4 — `downloads` e `mesas`

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T4.1 | Migrar `downloads` para state/ingress/slots | R-BG-03..09 | [ ] |
| T4.2 | Isolar/eliminar `frontend_dist_downloads_prod` entre slots | R-BG-12 | [ ] |
| T4.3 | Corrigir link checker para lock transacional e testar dois backends concorrentes; provar scraper/metrics singleton | R-BG-11, V-BG-09 | [ ] |
| T4.4 | Migrar `mesas` para state/ingress/slots | R-BG-03..09 | [ ] |
| T4.5 | Isolar/eliminar `frontend_dist_prod` entre slots | R-BG-12 | [ ] |
| T4.6 | Mover `mesas-cron` ao state plane e provar handoff sem sobreposição | R-BG-11, V-BG-09 | [ ] |
| T4.7 | Com aprovações separadas, bootstrap/cutover/rollback de downloads e depois mesas | R-BG-16, R-BG-18 | [ ] |
| T4.G | **Gate:** assets separados, zero efeito duplicado, DBs sem restart e rollbacks exercitados | evidência Actions/VM/DB | [ ] |
| T4.PR | Verde pontual + PR da onda 4 | — | [ ] |

## Fase 5 — `accounts` por último

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T5.1 | Migrar accounts para state/ingress/slots com migration runner singleton | R-BG-03..10 | [ ] |
| T5.2 | Provar compatibilidade old+new do schema e preservação de sessões | R-BG-10, R-BG-13 | [ ] |
| T5.3 | Executar matriz SSO local/pontual em todos os consumidores afetados | V-BG-12 | [ ] |
| T5.4 | Com aprovação própria, bootstrap/cutover prod de accounts | R-BG-16, R-BG-18 | [ ] |
| T5.5 | Com aprovação própria, exercer rollback e repetir login/me/logout | V-BG-07, V-BG-12 | [ ] |
| T5.G | **Gate:** SSO, cookies, allowlist, consumers e rollback verdes | evidência completa | [ ] |
| T5.PR | Verde pontual + PR da onda 5 | — | [ ] |

## Fase 6 — Runbook e fechamento

| ID | Task | Requisitos / evidência | Estado |
|---|---|---|---|
| T6.1 | Atualizar deploy runbook com descoberta de slot/SHA, cutover, rollback, recovery e bootstrap | R-BG-15..17 | [ ] |
| T6.2 | Atualizar manifest/docs de cada módulo e retirar instruções baseadas em container descartável | R-BG-04, R-BG-13 | [ ] |
| T6.3 | Auditar que beta segue in-place e não ganhou state/ingress blue-green | V-BG-01 | [ ] |
| T6.4 | Auditar cleanup e retenção atual/anterior em todos os projetos | V-BG-13 | [ ] |
| T6.5 | Auditoria de cobertura: happy path, falhas pré/pós-cutover, interrupção, concorrência, jobs, migrations, assets e SSO | V-BG-01..14 | [ ] |
| T6.6 | Após confirmação de fim dos reviews, rodar test repo-wide | gate completo, isolado | [ ] |
| T6.7 | Depois de T6.6, rodar lint repo-wide | gate completo, isolado | [ ] |
| T6.8 | Depois de T6.7, rodar build repo-wide | gate completo, isolado | [ ] |
| T6.9 | Rodar `pnpm verify:api` se os caminhos cobertos pelo gate foram alterados | governança API | [ ] |
| T6.G | **Gate final:** critérios de aceite 1–10 e nenhuma pendência sem decisão do mantenedor | evidência consolidada | [ ] |
| T6.PR | PR documental/final e encerramento da spec após autorização | — | [ ] |
