# Artifício G1

Suite modular do Artifício RPG: cada serviço no seu **subdomínio** sob `*.artificiorpg.com`, unida por login Google único (SSO), leve (TypeScript), SEO forte. Monorepo com `pnpm` + `Turborepo`. Modelo Google-suite (`docs.`/`mail.`).

> **Comece pela governança.** Antes de qualquer código, leia nesta ordem: `.specify/memory/project-state.md` → `AGENTS.md` → `docs/agents/context-capsule.md`.

## Módulos (`apps/*`)
Topologia **subdomínio-por-módulo** (D017). Cada módulo no próprio host, root próprio, sem basename. Unidos por SSO (cookie `.artificiorpg.com`) + nav + design. WP fica na raiz `artificiorpg.com` (intocável).

| Módulo | Subdomínio | O que é | Status |
|---|---|---|---|
| `site` | `beta.artificiorpg.com` (BETA → raiz futuro) | Portal + blog (ex-WordPress), SSG | a construir |
| `glossario` | `glossariorpg.artificiorpg.com` | Glossário RPG PT/EN (fica, prod) | a integrar (código→monorepo) |
| `mesas` | `mesas.artificiorpg.com` | Anúncio de mesas (refeito) | a construir |
| `downloads` | `downloads.artificiorpg.com` | Materiais traduzidos | a construir |
| `esferas` | `esferas.artificiorpg.com` | Wiki Spheres of Power (multi-sistema: D&D 2014/2024, PF futuro) | a construir |
| `srd` | `srd.artificiorpg.com` | SRD DnD 5.2.1 + tooltips | a construir |
| `links` | `links.artificiorpg.com` | Links: WhatsApp + parceiros | a integrar |
| _(SSO)_ | `accounts.artificiorpg.com` | Login Google central | a construir |

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
`A` backups → recriar Oracle · `B` SSO (`accounts.`) + 1º módulo no ar → import/build · `D` (por módulo) smoke → próximo. `C` (blog beta→raiz + desligar WP) = adiado, fora de escopo.

## Stack
React19/Vite/TS/Tailwind · Express/TS/Kysely/PG16 · Docker/nginx/Cloudflare Tunnel/GHCR/Oracle.
