# Artifício RPG

Suite de projetos do Artifício RPG: cada projeto no seu **subdomínio** sob `*.artificiorpg.com`, unido por login Google único (SSO), leve (TypeScript), SEO forte. Monorepo modular com `pnpm` + `Turborepo`. Modelo Google-suite (`docs.`/`mail.`).

> **Nome × conceito.** O produto chama-se **Artifício RPG** (domínio `artificiorpg.com`). "G1" **não** faz parte do nome — é apenas a *referência conceitual*: queremos um hub interconectado que direciona para os projetos, no estilo do portal de notícias G1. Codinome técnico interno (ex.: `g1-governance-reviewer`) pode usar "G1", mas nunca como nome do produto.

> **Comece pela governança.** Antes de qualquer código, leia nesta ordem: `.specify/memory/project-state.md` → `AGENTS.md` → `docs/agents/context-capsule.md`.

## Projetos (`apps/*`, tecnicamente módulos)
Topologia técnica **subdomínio-por-módulo** (D017). Na linguagem pública, cada app é um projeto no próprio host, root próprio, sem basename. Unidos por SSO (cookie `.artificiorpg.com`) + nav + design. WP fica na raiz `artificiorpg.com` (intocável).

| Projeto | Subdomínio | O que é | Status |
|---|---|---|---|
| `site` | `beta.artificiorpg.com` (BETA → raiz futuro) | Portal + blog (ex-WordPress), SSG | beta no ar; Gate C futuro |
| `glossario` | `glossariobeta.artificiorpg.com` (BETA) / `glossario.artificiorpg.com` (prod canônico) | Glossário RPG PT/EN | prod no ar; SSO+compat fechado |
| `mesas` | `mesas.artificiorpg.com` | Anúncio de mesas (refeito) | prod no ar; SSO fechado |
| `downloads` | `downloads.artificiorpg.com` | Materiais traduzidos | a construir |
| `esferas` | `esferas.artificiorpg.com` | Wiki Spheres of Power (multi-sistema: D&D 2014/2024, PF futuro) | a construir |
| `srd` | `srd.artificiorpg.com` | SRD DnD 5.2.1 + tooltips | a construir |
| `links` | `links.artificiorpg.com` | Links: WhatsApp + parceiros | a integrar |
| _(SSO)_ | `accounts.artificiorpg.com` | Login Google central | no ar |

## Pacotes compartilhados (`packages/*`)
`auth` (SSO Google + JWT cookie raiz) · `ui` (design system sóbrio) · `analytics` (GA4) · `config` (tsconfig/eslint/env) · `content` (SEO: meta, sitemap, JSON-LD) · `crosslink` (tooltips/interreferência SRD↔Wiki).

## Mapa de governança
| Arquivo | Para quê |
|---|---|
| `AGENTS.md` | Regras pétreas, aprovações, gates, isolamento de módulo |
| `.specify/memory/constitution.md` | Princípios inegociáveis |
| `.specify/memory/project-state.md` | Onde estamos (fase/gate) |
| `.specify/memory/errors.md` | Erros conhecidos |
| `.specify/arquiteture.md` | Arquitetura e contratos (a escrever) |
| `docs/agents/operating-model.md` | Quando usar Sem SDD / Lite / Completo |
| `docs/agents/context-capsule.md` | Retomada mínima |
| `.claude/agents/` | Subagentes: governance-reviewer, wp-importer, seo-usability-auditor |
| `.claude/skills/` | Skills: add-module, new-spec |
| `sessoes/` | Diário de sessões |
| `specs/` | Specs SDD |

## Gates
`A` backups → recriar Oracle · `B` SSO (`accounts.`) + 1º módulo no ar → import/build · `D` (por módulo técnico/projeto público) smoke → próximo. `C` (blog beta→raiz + desligar WP) = adiado, fora de escopo.

## Stack
React19/Vite/TS/Tailwind · Express/TS/Kysely/PG16 · Docker/nginx/Cloudflare Tunnel/GHCR/Oracle.
