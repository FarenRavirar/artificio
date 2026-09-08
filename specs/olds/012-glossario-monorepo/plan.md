# Plano — 012

## Arquitetura da solução
Replicar o playbook do mesas (CDX-308A/B/C + skill `add-module`), sem a parte SSO (fica p/ 015):
1. **Import:** copiar `C:\projetos\glossario_rpg_artificio` → `apps/glossario/{frontend,backend,database,scripts}`; limpar segredos, `node_modules`, `dist`, chaves SSH (`*.key` NUNCA entra); renomear packages p/ `@artificio/glossario-*`; adequar a pnpm workspace + turbo.
2. **UI:** trocar header/footer próprios por `@artificio/ui` (Header com `userMenu` D043, Footer hub, tokens D040). Cores legadas `#1B2A4A`/`#E8521A` → tokens (`#FF9457`/`#020740`).
3. **Deploy:** `docker-compose.beta.yml`/`.prod.yml` no padrão monorepo (rede `artificio_net`, containers `glossario-app|api|db` e `glossario-beta-*` já existentes — deploy canônico assume os atuais; snapshot DB antes), `deploy-glossario.yml` chamando `_deploy-module.yml` (env=beta|prod, lock D056).
4. **Hostname:** bootstrap em duas etapas. Primeiro BETA: `glossariobeta.artificiorpg.com` -> `glossario-beta-app:80` no Tunnel. Depois PROD, quando `main` contiver `apps/glossario`: `glossario.artificiorpg.com` -> `glossario-app:80`. `glossariorpg.` foi alias histórico pré-monorepo e não é rota ativa a preservar; sem requisito de 301 imediato.
5. **Legado:** desativar workflows do repo antigo (stub `if: false`, modelo docker-cleanup).

## Arquivos afetados (por módulo/pacote)
- `apps/glossario/**` (novo)
- `.github/workflows/deploy-glossario.yml` (novo)
- `turbo.json`/`pnpm-workspace.yaml` (se necessário)
- VM: rotas Tunnel remotas no Cloudflare Zero Trust, `/opt/artificio{,-beta}` materializa app no clone
- Repo legado `glossario_rpg_artificio`: stub de workflows
- `packages/*`: **não tocar** (consumo apenas)

## Contratos/interfaces tocados
- Subdomínio/DNS: BETA `glossariobeta.`; PROD canônico `glossario.` (supera parte do D017 — registrar D057/D0NN).
- Schema: nenhum nesta spec (migrations legadas seguem como estão; runner legado mantido até 015 avaliar).
- Auth: intocado (login legado segue).

## Impacto em consumidores
- Nav cross-módulo (`packages/ui defaultNavItems` + `apps/site content.ts MODULES`) aponta p/ "Glossário" — conferir URL alvo; atualizar p/ `glossario.` faz parte desta spec (mesmo commit do cutover) — toca shared, já coberto pelo SDD Completo daqui.
- SEO: `glossario.` é o hostname canônico; `glossariorpg.` não é rota ativa conhecida a preservar.

## Rollback
- Código: revert no monorepo; repo legado intacto.
- Deploy: `_deploy-module` snapshot/rollback; containers antigos preserváveis até smoke verde.
- Hostname: remover rota nova do tunnel; sem dependência de `glossariorpg.`.

## Validação
- Build+test monorepo verdes; smoke beta (200/busca/login legado); contagens DB pré/pós; 301 verificado com `curl -sI`; deploy Actions verde; visual conferido contra `@artificio/ui` (checklist Nielsen na sessão).
