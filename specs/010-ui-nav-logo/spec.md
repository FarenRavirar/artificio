# 010 — Nav cross-módulo unificado + logo no header/footer

- **Módulo/Pacote:** `packages/ui` + `apps/site` (verificar `apps/mesas`/`apps/accounts`)
- **Gate relacionado:** nenhum (cross-cutting de design system; relê auditoria visual pendente)
- **Origem:** observações do mantenedor (2026-06-06) ao conferir `beta.artificiorpg.com` e `mesasbeta`.

## Problema
1. **Nav cross-módulo ausente no site.** O `apps/site` mostra nav de **categorias do blog** (`/blog/categoria/{noticias,analises,guias,downloads}`), não o **nav unificado do portal** (Portal/Glossário/Mesas/Downloads/Esferas/SRD = `defaultNavItems` do `@artificio/ui`) que o `mesas` exibe. O nav de unidade cross-subdomínio deveria estar em **todos** os módulos (D017: une por nav + SSO + design system).
2. **Logo aparece quebrada** no header/footer (mesas e site) no browser do mantenedor — `⬚Artifício` (img falha → mostra `alt`).

## Diagnóstico já feito (não re-investigar)
- **Logo asset é VÁLIDO:** `packages/ui/src/brand.ts` decodifica `brandLogoNavy` e `brandLogoNeg` para **PNG 300×100** (sig PNG ok, sem whitespace no base64, 2145/3894 bytes).
- **Sem CSP** bloqueando `data:` em `beta` nem `mesasbeta` (headers checados).
- **Site:** a data-URI ESTÁ no HTML servido (`<img class="artificio-brand-logo logo-navy" src="data:image/png;base64,...">`) e **renderizou** no preview local desta build.
- **mesas é SPA** (Vite/React) → header renderiza client-side; `curl` não vê o HTML do header (vazio sem JS).
- **Nav gap confirmado:** `apps/site/src/components/SiteHeader.astro` usa `SECTIONS` (categorias) em vez de `defaultNavItems`.
- **Hipóteses do logo "quebrado":** (a) **extensão do browser** do mantenedor bloqueando `data:` img (vários adblock/privacy/VPN ativos); (b) **mesas deployado com `@artificio/ui` antigo** (logo pré-fix). **Disambiguação pendente:** abrir em janela anônima/sem extensões.

## Requisitos (numerados, testáveis)
- **R1** — `apps/site` exibe o **nav cross-módulo** (`defaultNavItems`: Portal/Glossário/Mesas/Downloads/Esferas/SRD), consistente com os demais módulos. Categorias do blog viram **nav secundário** (2ª linha/`moduleNav`) ou seção própria — não substituem o nav do portal.
- **R2** — Logo renderiza em browser limpo (anônimo/sem extensões) em site + mesas. Se o teste anônimo mostrar a logo → causa = extensão (documentar, sem mudança de código). Se continuar quebrada → corrigir render/deploy do `@artificio/ui` (garantir build atual nos módulos no ar).
- **R3** — Header/Footer consistentes cross-módulo (mesma marca, logo, nav) — base da auditoria visual pendente (`seo-usability-auditor`).
- **R4** — Decidir o **Header do site**: island React `@artificio/ui <Header/>` (nav cross-módulo + session nativos; +JS) **vs** `.astro` replicando `defaultNavItems` (zero-JS). Relê a decisão adiada de D048 (Header como island).

## Critérios de aceite
- **CA1** — Site mostra Portal/Glossário/Mesas/Downloads/Esferas/SRD no header (links cross-subdomínio corretos); categorias do blog acessíveis em nav secundário.
- **CA2** — Logo visível (não-`alt`) no header e footer do site e do mesas em janela anônima.
- **CA3** — Build do site verde; sem regressão de SEO/marca; `pr-checks` verde.

## Fora de escopo
- Auditoria visual cross-módulo completa (spec dedicada própria, já registrada como pendência).
- Mudança de SSO/auth.
- Cutover/raiz (Gate C).

## Riscos
- Se R4 = island React no site → traz JS + `@artificio/auth` (fetch session) ao header público; ponderar zero-JS vs unidade. Possível meio-termo: `.astro` com `defaultNavItems` (zero-JS) + island só p/ o menu de conta quando logado.
- Mexer em `packages/ui` afeta todos os módulos (mesas/accounts) → SDD, testar antes.
