# 012 — Glossário → monorepo + subdomínio `glossario.`

- **Módulo/Pacote:** apps/glossario (novo) + infra (tunnel/DNS hostname novo) + CI/CD
- **Gate relacionado:** D (por módulo)
- **Nível SDD:** Completo (infra + deploy + banco + migração de subdomínio/SEO)

## Problema
Glossário (Grande Glossário de RPG, v2) roda em produção **fora do monorepo**, em `glossariorpg.artificiorpg.com`, com stack legada restaurada na Fase 1 (repo `C:\projetos\glossario_rpg_artificio`, GitHub próprio beta+prod, `/opt/artificio/glossario*` na VM, DB `glossario_v2`). Mantenedor decidiu: trazer **direto para o monorepo** (`apps/glossario`) e servir no subdomínio canônico **`glossario.artificiorpg.com`** (decisão desta sessão; supera o hostname `glossariorpg.` usado em D017 — registrar como decisão nova ao executar). Roadmap item 4 ("glossario → monorepo, valida playbook add-module").

## Requisitos (numerados, testáveis)
1. Código legado importado para `apps/glossario` (frontend React + backend Express + `database/`), **sem segredos reais** (modelo CDX-308A do mesas).
2. Builda no monorepo: `pnpm --filter @artificio/glossario... build` verde + testes existentes verdes.
3. Design system G1: header/nav/footer/marca via `@artificio/ui` (D040, contrato D043), **incluindo o nav cross-módulo** (`defaultNavItems`: Portal/Glossário/Mesas/Downloads/Esferas/SRD — e WhatsApp quando spec 014 entrar); sem divergência visual.
4. Servido primeiro em **`glossariobeta.artificiorpg.com`** via Cloudflare Tunnel (`glossario-beta-app:80`), depois em **`glossario.artificiorpg.com`** quando `main` contiver o módulo.
5. **`glossariorpg.artificiorpg.com` → 301 → `glossario.artificiorpg.com`** (mesmo path) só depois do smoke prod. SEO pétreo: nenhuma URL legada quebra.
6. Dados preservados: DB `glossario_v2` prod intacto (mesmas contagens de `terms`/`users` antes/depois).
7. Deploy canônico: workflow `deploy-glossario.yml` via `_deploy-module.yml` (esteira D041: `dev`→beta, `main`→prod; snapshot, health, smoke, rollback, lock D056).
8. Login legado (email/senha BCrypt + JWT custom) **continua funcionando como está** nesta spec (transitório, documentado; troca por SSO = spec 015).
9. Workflows do repo legado `glossario_rpg_artificio` desativados após cutover (sem deploy duplo).
10. Analytics GA4 via `packages/analytics` (D020) nas páginas públicas.

## Critérios de aceite
- [ ] `https://glossariobeta.artificiorpg.com` 200, `/api/terms` 200, busca de termo conhecido funciona (ex.: "Fireball").
- [ ] Depois de `main` conter o módulo: `https://glossario.artificiorpg.com` 200.
- [ ] Após smoke prod: `https://glossariorpg.artificiorpg.com/<rota>` → 301 → `glossario.…/<rota>`.
- [ ] Login legado: usuário existente loga e vê painel.
- [ ] `select count(*) from terms` igual pré/pós-migração.
- [ ] Deploy via Actions verde (beta e prod); rollback testado em beta.
- [ ] Repo legado sem workflow ativo.
- [ ] Gate D glossário: smoke + validação do mantenedor (fecha de vez só junto com spec 015/SSO, se mantenedor preferir).

## Fora de escopo
SSO accounts + compat de login antigo (spec 015). Features novas do glossário. Páginas links/regras (spec 013). Nav WhatsApp (spec 014).

## Riscos e impacto em outros módulos
- Write na VM/tunnel/DNS = aprovação pétrea por ação.
- Hostname novo no tunnel: não tocar ingress dos outros módulos.
- Downtime aceitável curto no cutover de hostname; DB não muda de container nesta spec (decidir em plan se containers são recriados pelo deploy canônico — snapshot antes).
- Repo legado é a rede de segurança de rollback (não apagar).
