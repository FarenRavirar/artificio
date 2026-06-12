# Context Capsule — retomada mínima

> Deve sobreviver a compactações. Só o necessário para retomar com segurança. Atualizar quando o essencial mudar.

## Em uma frase
Construindo o **Artifício RPG**: suite de projetos em **subdomínios** sob `*.artificiorpg.com`, unida por login Google único (SSO), leve (TS/React/Express/Postgres), saindo do WordPress, em monorepo modular `artificio` com pnpm+Turborepo.

> **Nome × conceito:** produto = **Artifício RPG**. "G1" = só referência conceitual (hub interconectado que direciona aos projetos, estilo portal de notícias G1) — não é nome. Codinome técnico interno pode usar "G1"; UI/produto nunca.

## Topologia (subdomínio-por-módulo técnico — D017)
Cada projeto/app no **próprio subdomínio**, root `/` próprio, **sem basename/gateway de path**:
`glossariobeta.`/`glossario.` (glossário no monorepo; `glossariorpg.` foi alias histórico pré-monorepo e não é rota ativa a preservar) · `mesas.` · `downloads.` · `esferas.` (Spheres of Power, multi-sistema) · `srd.` · `links.` · `beta.artificiorpg.com` (blog/site novo, BETA — único que valida; → raiz `artificiorpg.com` no futuro, D016) · `accounts.` (SSO central, D018). WP fica na **raiz** `artificiorpg.com` agora (intocável). Une tudo: **cookie `.artificiorpg.com` + nav + design system**. Cloudflare Tunnel mapeia hostname→container. Blog na raiz = aposta de SEO (D019). Não hardcodar credencial/host fora de env.

## Onde estamos
Ver `.specify/memory/project-state.md`. Hoje: **Fase 3 — projetos + conteúdo**. Gates A/B ✅; Gate D `mesas` ✅ (2026-06-08) e `glossario` ✅ (2026-06-12). `accounts.artificiorpg.com`, `mesas.artificiorpg.com` e `glossario.artificiorpg.com` estão no ar com SSO Google central. **Site:** `beta.artificiorpg.com` no ar; Spec 011 CMS Fase 1 + T17/refino UX + mídia T18/T19 deployados no beta; WP raiz intocado. **Spec 017/018:** UI compartilhada local pronta (favicon fonte única, rodapé, toggle de tema, terminologia pública "projetos" D063), builds locais verdes; falta aprovação para commit/push/PR, deploy beta, smoke, promote prod e smoke cross-projeto. **Spec 005 beta:** esteira entregue/em uso; pendência isolada: hydrate precisa `PROD_DB_URL` no beta + restart (segredo/write VM = mantenedor). **CDX-310** segue pendente.

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
8. **Doc-only não libera git automático.** `commit`, `push` e promoção ainda exigem pedido explícito por ação. Se o mantenedor pedir para subir/promover e o diff for só documentação, usar fast-forward `dev→main`. Código segue fluxo normal branch/PR/checks/revisão/merge autorizado. Se GitHub sugerir PR de `dev`, verificar `origin/main...origin/dev` antes de agir.
9. Comunicação em PT. Segredos nunca versionados. HTML do WP é hostil (sanitizar).

## Stack canônica
Front: React19/Vite/TS/Tailwind/React Router/TanStack Query.
Back: Express/TS/Kysely/PG16/JWT/Google OAuth/Cloudinary.
Infra: Docker/nginx(por app)/Cloudflare Tunnel(ingress hostname→container)/GHCR/Watchtower(beta)/Oracle 24GB-200GB.

## Projetos (`apps/*`, tecnicamente módulos)
`site` (portal+blog, SSG), `glossario`, `mesas`, `downloads`, `esferas` (multi-sistema), `srd`, `links`.
Pacotes: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

## Ferramentas / divisão
Claude Opus (principal): arquitetura, SSO, importador, engine SRD/tooltip, SEO, specs, gates.
Codex (secundário): UI, testes, migrações mecânicas, lint, boilerplate.
