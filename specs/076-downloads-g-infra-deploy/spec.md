# Spec 076 — Downloads-G: Infra beta/prod, deploy real, Gate D

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3), última do pipeline. Implementa T6.1 (remapeamento do padrão vigente), T6.2/T6.2a (paridade/isolamento), T6.3 (backup/rollback/observabilidade), T6.4 (rotina de moderação/SLA — já modelada, aqui só operacionaliza).

## Pré-requisito

Depende de todas as specs 070–075 estarem localmente verdes (lint+build+test). Não exige que estejam "perfeitas", mas funcionalmente completas o suficiente para smoke real.

## Regra pétrea de abertura

Esta spec **deve reler o estado vigente** de `docs/agents/infra-map.md`, `deploy-manifest.json`, `_deploy-module.yml` e `AGENTS.md` §Git/Branch/Deploy no momento da implementação — nunca copiar o T6.1 registrado em `061/spec.md` como se fosse fonte de verdade atual (o padrão operacional já mudou várias vezes entre jul/2026 e a implementação real desta spec).

## Objetivo

Colocar Downloads no ar em `downloadsbeta.artificiorpg.com` (dev) e `downloads.artificiorpg.com` (main/prod), com exatamente a mesma esteira canônica dos demais módulos — zero fluxo/pipeline específico.

## Escopo

- Módulo `downloads` no `deploy-manifest.json` (`deploy_paths` cobrindo `apps/downloads`).
- Compose, secrets, containers e DB isolados por ambiente (beta nunca lê/escreve dado de prod).
- Cloudflare Tunnel mapeando os novos hostnames — sem tunnel/container `cloudflared` paralelo.
- Migrations com header completo de 5 campos, validadas pelo guard.
- Backup/rollback seguindo o mesmo runbook dos demais módulos.
- Observabilidade mínima: logs via `docker logs`/`ssh faren` read-only, health check HTTP, trilha própria de auditoria de moderação.
- Smoke beta real antes de promover.
- Promoção `dev→main` por fast-forward (não dispara deploy prod sozinha).
- Deploy prod só via `workflow_dispatch` manual explícito, gated por aprovação nominal — mesma trava pétrea de todos os outros módulos.
- Isolamento de app/projeto herdado (AGENTS.md §Isolamento de App/Projeto) — sem exceção não registrada.

## Fora de escopo

- Qualquer mudança de produto/política (já fechada nas specs anteriores).
- Cutover de DNS raiz (Gate C, não aplicável a Downloads).

## Critérios de aceite

1. Downloads usa o mesmo `ci.yml`/`deploy.yml`/manifesto vigente no momento da implementação, sem pipeline paralelo.
2. Beta e prod isolados em compose/secrets/DB.
3. Migrations com header de 5 campos validado pelo guard.
4. Smoke beta real (HTTP 200/401/404 conforme rota) antes de qualquer promoção.
5. Deploy prod só ocorre via `workflow_dispatch` manual explícito, nunca automático via promote.
6. Rollback automático testado (guard de migration aborta e reverte, igual aos demais módulos).
7. Isolamento de app/projeto (AGENTS.md) respeitado sem exceção.

## Dependências

- Specs 070–075 (todas), localmente verdes.
- Última spec filha da 061 — conclusão libera Downloads em produção real (Gate D do módulo).
