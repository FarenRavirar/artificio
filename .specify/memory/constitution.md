# Constituição — Artifício G1

Princípios inegociáveis. Mudança aqui exige decisão explícita e registrada do mantenedor. Em conflito, a Constituição vence sobre conveniência de implementação.

## I. Leveza
A plataforma é leve. Saímos do WordPress justamente por peso e dependência de atualizações. Cada módulo serve HTML rápido, com mínimo runtime. Pré-render estático (SSG) para conteúdo; SSR só onde indispensável. Sem dependência pesada nova sem justificativa de risco.

## II. Login único (SSO)
Google OAuth é o único login. Uma sessão, um cookie `Domain=.artificiorpg.com`, válida em todos os módulos. Logado no site = logado em tudo. Auth é compartilhado e sagrado: nunca quebrar a sessão de um módulo ao mexer noutro.

## III. Modularidade (G1)
Cada serviço é um módulo plugável no **próprio subdomínio** `*.artificiorpg.com` (D017), unido aos demais por SSO + nav + design system (modelo Google-suite). Módulos são interconectados mas independentes: dá pra desenvolver e deployar um sem derrubar os outros. Novo módulo entra pelo contrato de módulo, sem reescrever o resto.

## IV. SEO e descoberta
O conteúdo existe para ser encontrado. Slugs e redirects 301 do legado preservados. Sitemap, canonical, OG, JSON-LD e RSS em todo conteúdo público. Compatível com Google Analytics 4 e Search Console. Sem regressão de SEO em merge.

## V. Usabilidade (Nielsen + ISO 9241-11)
Interface obedece as 10 Heurísticas de Nielsen e ao ISO 9241-11 (eficácia, eficiência, satisfação). Estética sóbria e minimalista estilo Google (Docs/Gmail), mantendo cores e logo do Artifício. Consistência entre módulos via design system único.

## VI. Gratuidade e privacidade
Gratuito, sem anúncios, sem coleta desnecessária de dados. Analytics mede uso, não vigia pessoa.

## VII. Segurança de dados e operação por gates
Backup antes de destruir. WordPress e DNS de produção intocáveis até validação. Avanço por gates (A→B→C→D), cada um com aprovação. Segredos nunca versionados. HTML externo é hostil até sanitizado.

## VIII. Governança antes de código
A camada de governança (este arquivo, AGENTS.md, specs, agentes, skills, fluxos) precede a construção. Risco se controla por processo, não por boa vontade.

## IX. Stack canônica única
React/TS/Vite/Tailwind no front; Express/TS/Kysely/Postgres no back; Docker + Cloudflare Tunnel + GHCR na infra; pnpm + Turborepo no monorepo. Um módulo não inventa stack própria.
