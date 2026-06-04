# Sessão 26-06-04_3 — Fase 2: monorepo + SSO

- **Data:** 2026-06-04 · **Módulo:** monorepo/`apps/accounts`/`packages/*` · **Gate:** B
- **Objetivo:** erguer o monorepo + SSO (`accounts.artificiorpg.com`) + `packages/{config,auth,ui}`. Fechar Gate B.
- **Spec:** `specs/003-fase2-monorepo-sso/{spec,plan,tasks}.md` · **Decisões:** D001, D003, D007, D017, D018

## Tarefas para Codex
> Fonte: `specs/003-fase2-monorepo-sso/tasks.md` (CDX-301..306 + 2 passos do mantenedor). Cada CDX com `✓ Validar`. Modo: **Opus orquestra, Codex executa.**

| CDX | O quê | Estado |
|---|---|---|
| 301 | scaffold monorepo + `packages/config` | ⬜ |
| 302 | `packages/auth` (sessão) | ⬜ |
| 303 | `packages/ui` (tokens + Header/Nav/Footer) | ⬜ |
| — | [mantenedor] OAuth client Google | ⬜ |
| 304 | `apps/accounts` backend (OAuth/JWT/users) | ⬜ |
| 305 | `apps/accounts` frontend + Docker | ⬜ |
| — | [mantenedor] rota Cloudflare `accounts.` | ⬜ |
| 306 | deploy VM + smoke + cross-subdomínio → Gate B | ⬜ |

## Ordem
301→302→303 podem ir em sequência. 304 espera o OAuth client (mantenedor). 306 espera a rota Cloudflare.

## Estado atual
Spec 003 criada (Opus, contexto pleno da Fase 0+1). Aguardando início da execução pelo chat novo (orquestra Codex). glossário/mesas **não** se tocam aqui.
