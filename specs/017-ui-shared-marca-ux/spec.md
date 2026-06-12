# 017 — UI compartilhada: marca/UX de fonte única (favicon, rodapé, toggle de tema)

- **Módulo/Pacote:** packages/ui (fonte) + consumidores apps/site, apps/glossario, apps/mesas, apps/accounts
- **Gate relacionado:** nenhum (Fase 3, débitos UX/marca)

## Problema
Três débitos de UX/marca registrados em `sessoes/26-06-12_2_debitos_ux-marca.md` violam o princípio de fonte única do que é compartilhado:

1. **Favicon (D-INFRA1):** asset `faviconV2.png` existia só em mesas (fonte de fato); glossário tinha `<link>` mas asset ausente (favicon quebrado); accounts/site sem favicon. Cópias divergentes = anti-padrão. Mantenedor (2026-06-12): o que é compartilhado deve ter **fonte única importável** (sem duplicar/sincronizar arquivos), espelhando o padrão dos logos (`packages/ui/brand.ts` data-URI).
2. **Rodapé (D-UX3):** o texto "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!" vive duplicado no glossário (`LandingSection.tsx` + `App.tsx`). Deve viver no rodapé compartilhado (`packages/ui/src/Footer.tsx`) e aparecer em todos os projetos.
3. **Toggle de tema (D-UX2):** glossário e mesas não têm alternância de tema. O `packages/ui/src/Header.tsx` (shell compartilhado) deve oferecer um toggle lua/sol reusando o cookie cross-subdomínio `artificio_theme` (`Domain=.artificiorpg.com`), já usado por site/accounts. Projetos podem herdar o mecanismo quando tiverem CSS dark.

## Requisitos (numerados, testáveis)
- **R1** — `packages/ui` exporta o favicon `faviconV2` (data-URI, mesmo padrão de `brandLogoNeg`) e um helper `applyFavicon()` que cria/atualiza o `<link rel="icon">` do documento a partir desse data-URI.
- **R2** — site (Astro) renderiza o favicon em build importando de `@artificio/ui` (sem flash); accounts/glossário/mesas (Vite SPA) aplicam via `applyFavicon()` importado no `main.tsx`.
- **R3** — Nenhuma cópia versionada de `faviconV2.png` em `apps/*/public`; nenhum `<link rel="icon" href="/faviconV2.png">` estático remanescente. Fonte = só `packages/ui`.
- **R4** — O texto "presente" deixa de ser duplicado no glossário (removido de `LandingSection.tsx` e `App.tsx`) e passa a ser emitido pelo `Footer` compartilhado em todos os projetos.
- **R5** — `Header` compartilhado oferece toggle de tema lua/sol opcional (prop aditiva, retrocompatível), que lê/grava o cookie `artificio_theme` (`Domain=.artificiorpg.com`, `SameSite=Lax`, `Secure`) e alterna `document.documentElement.dataset.theme`. Comportamento espelha `apps/site` (`SiteHeader.astro` `#theme-toggle` + `Base.astro`).
- **R6** — glossário e mesas passam a exibir o toggle; site/accounts seguem funcionando (não regredir o mecanismo de tema existente).
- **R7** — `D-MARCA1` (rename público "módulo"→"projetos") foi movido para a spec 018 e decisão D063.

## Critérios de aceite
- `turbo build` verde em packages/ui + os 4 consumidores (site/glossario/mesas/accounts).
- Favicon servido nos 4 apps a partir da fonte única (verificado em build/preview); zero cópia em `public/`.
- Texto "presente" aparece uma vez (no rodapé) em cada módulo; sem duplicação no glossário.
- Toggle alterna tema e persiste via cookie cross-subdomínio; tema compartilhado entre subdomínios mantido.
- Smoke de todos os consumidores do `packages/ui` (auth/design sagrado): nenhum quebra de Header/Footer/SSO.

## Fora de escopo
- D-MARCA1 (rename projetos) — tratado na spec 018 (D063).
- Deploy/promote (cada um exige aprovação por ação e é etapa separada).
- Redesenho visual de Header/Footer além do necessário para o toggle.

## Riscos e impacto em outros módulos
- `packages/ui` Header/Footer = shell único (D058); muda em todos os módulos. Props de toggle e texto do rodapé devem ser **aditivas/retrocompatíveis** para não quebrar site/accounts/mesas.
- Auth é sagrado: o toggle não toca sessão/SSO, só cookie de tema. Não alterar contrato do Header que afete `userMenu`/`actions`/`sessionOverride`.
- Favicon via runtime em SPAs = pequeno custo de 1 efeito no boot; aceitável (apps não-SEO-críticos). Site usa build-time (sem flash).
