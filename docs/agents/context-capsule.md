# Context Capsule — retomada mínima

> Deve sobreviver a compactações. Só o necessário para retomar com segurança. Atualizar quando o essencial mudar.

## Em uma frase
Construindo o **Artifício RPG**: suite modular em **subdomínios** sob `*.artificiorpg.com`, unida por login Google único (SSO), leve (TS/React/Express/Postgres), saindo do WordPress, em monorepo `artificio` com pnpm+Turborepo.

> **Nome × conceito:** produto = **Artifício RPG**. "G1" = só referência conceitual (hub interconectado que direciona aos módulos, estilo portal de notícias G1) — não é nome. Codinome técnico interno pode usar "G1"; UI/produto nunca.

## Topologia (subdomínio-por-módulo — D017)
Cada módulo no **próprio subdomínio**, root `/` próprio, **sem basename/gateway de path**:
`glossariorpg.` (glossário, fica) · `mesas.` · `downloads.` · `esferas.` (Spheres of Power, multi-sistema) · `srd.` · `links.` · `beta.artificiorpg.com` (blog/site novo, BETA — único que valida; → raiz `artificiorpg.com` no futuro, D016) · `accounts.` (SSO central, D018). WP fica na **raiz** `artificiorpg.com` agora (intocável). Une tudo: **cookie `.artificiorpg.com` + nav + design system**. Cloudflare Tunnel mapeia hostname→container. Blog na raiz = aposta de SEO (D019). Não hardcodar credencial/host fora de env.

## Onde estamos
Ver `.specify/memory/project-state.md`. Hoje: **Fase 2 — Gate B aprovado (D037)**. `accounts.artificiorpg.com` no ar. CDX-308A+B+C e CDX-309E concluídos: `mesas.artificiorpg.com` roda build monorepo via pipeline canônico, SSO técnico OK, snapshot/migrations/health/smoke OK. **Spec 005 beta:** `dev` + `/opt/artificio-beta` + `mesasbeta.artificiorpg.com` ativos; T11 estrito passou no run `27030832884` (`mesasbeta.` 200/401/302 com `return=mesasbeta`; prod 200/401/302 com `return=mesas`; containers healthy). Pendente: hydrate aprovado + T12 E2E beta.

## Reload (Tier 0 — só estes 3)
`project-state.md` + este capsule + `decisions.md`. Resto sob demanda. Caveman default. Disciplina: `docs/agents/token-economy.md`. **Mapa macro até conclusão: `docs/agents/roadmap.md` (T1).**

## Regras que não posso esquecer
1. **Gates A→B→C→D**, cada um com aprovação. Nada destrutivo na Oracle antes do Gate A. WP/DNS intocáveis até Gate C.
2. **Aprovação é por ação, não por sessão.** `git commit`/`push` e qualquer comando na VM sempre pedem aprovação, no formato de `AGENTS.md`.
   Exceção pétrea: pacote `apt` operacional ausente e necessário para tarefa já autorizada pode ser instalado sem nova aprovação.
3. **Compartilhado = SDD Completo.** `packages/*`, infra (tunnel/DNS), `accounts.` (SSO), banco, importador, SEO. Módulo isolado pode ser Lite.
4. **Isolamento de módulo:** não tocar outro `apps/*` ou `packages/*` fora do escopo sem aprovação.
5. **Auth é sagrado:** nunca quebrar a sessão SSO compartilhada.
6. **SEO inegociável:** preservar slugs e 301; sem regressão.
7. **Deploy/código via GitHub Actions.** VM manual só bootstrap/conexão/instalação operacional/diagnóstico/rollback aprovado; deploy normal usa branch/PR/workflow/secrets.
8. Comunicação em PT. Segredos nunca versionados. HTML do WP é hostil (sanitizar).

## Stack canônica
Front: React19/Vite/TS/Tailwind/React Router/TanStack Query.
Back: Express/TS/Kysely/PG16/JWT/Google OAuth/Cloudinary.
Infra: Docker/nginx(por app)/Cloudflare Tunnel(ingress hostname→container)/GHCR/Watchtower(beta)/Oracle 24GB-200GB.

## Módulos
`site` (portal+blog, SSG), `glossario`, `mesas`, `downloads`, `esferas` (multi-sistema), `srd`, `links`.
Pacotes: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

## Ferramentas / divisão
Claude Opus (principal): arquitetura, SSO, importador, engine SRD/tooltip, SEO, specs, gates.
Codex (secundário): UI, testes, migrações mecânicas, lint, boilerplate.
