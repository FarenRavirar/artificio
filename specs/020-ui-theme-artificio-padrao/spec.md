# 020 — Theme Artificio padrao

- **Modulo/Pacote:** `packages/ui` + consumidores em `apps/accounts`, `apps/glossario`, `apps/mesas`, `apps/site`, `apps/site-admin`
- **Gate relacionado:** nenhum

> **▶ PRÓXIMOS PASSOS / ordem de execução: ver [`execution-priority.md`](./execution-priority.md).** Prioridade definida em 2026-06-13 a partir da revisão de todos os docs da spec. Caminho crítico: **B6/B7** (E2E valida o lua/sol que já está em prod) ∥ **B11+B10b** (tokens, destravam primitives) → **B4+B3** (primitives) → T5/B5 (cleanup). **B2/B12** em paralelo. **Novos chats começam por aí.**
>
> Docs da spec: `token-contract` (T3), `theme-consolidation` (T5), `header-nav-actions` (T6), `primitives-form-state` (T7), `page-recipes` (T8), `astro-zero-js` (T9), `rollout-pilots` (T10), `brand-static-shell` (T11), `dark-readiness-checklist` (T4), `backlog-b2-b7-review`, `execution-priority`.

## Problema
As specs 017/018 fecharam parte da identidade compartilhada, e a Spec 019 encontrou duplicacoes em tema, cores, nav, header actions, estrutura de paginas, forms, estados e tokens. A ideia correta nao e "unificar tudo" nem transformar todos os apps na mesma tela. O problema e outro: falta uma **fonte unica importavel para a linguagem visual comum**.

Hoje cada projeto carrega sua propria interpretacao de tokens, CSS vars, dark/light, page frames, radius, shadows, filtros, cards, estados e acoes de header. Isso aumenta drift visual e dificulta novos modulos. Ao mesmo tempo, algumas diferencas sao legitimas: o site e Astro/zero-JS/editorial, accounts e tela de login SSO, mesas tem variante escura operacional, glossario e referencia clara de busca/admin.

Esta spec define o **Theme Artificio padrao**: um contrato compartilhado apenas para coisas comuns. Dominio, dados, copy contextual e layouts especificos continuam nos apps.

## Requisitos (numerados, testaveis)
- **R1** — Definir fonte unica em `packages/ui` para tokens comuns: cores por papel, fonte, radius, shadow, spacing, focus, estados semanticos e dark/light.
- **R2** — Usar o glossario como base visual clara e referencia de nav, conforme decisao do mantenedor nesta sessao.
- **R3** — Usar mesas como referencia da variante escura operacional e do estilo de notificacao/changelog no header.
- **R4** — Manter o controle lua/sol como contrato unico via `@artificio/ui/theme`, com cookie/localStorage/dataset coerentes e habilitacao por app somente quando houver CSS dark completo.
- **R5** — Criar primitives/recipes compartilhadas apenas para padroes comuns: `Button`, `Field`, `Select`, `Badge`, `Panel/Card`, `Toolbar`, `FilterPanel`, `EmptyState`, `LoadingState`, `ErrorState`, `ModalShell`, `DrawerShell`, `HeaderAction` e page frame recipes.
- **R6** — Separar explicitamente o que nao entra no theme: layout especifico de produto, regra de negocio, queries/API, payloads de notificacao, copy contextual, assets de dominio, editorial/prose especifico do site e fluxos auth.
- **R7** — Para o site Astro, prover caminho static/zero-JS: CSS vars/classes/exports puros, sem exigir React ou auth client no publico.
- **R8** — Definir estrategia de rollout por pilotos pequenos, com smoke visual e contraste AA por app antes de habilitar tema/toggle.
- **R9** — Registrar decisao formal se a base glossario (`#1a2744`/`#e85d26`) substituir ou reinterpretar D040 (`#020740`/`#FF9457`) como paleta canonica.
- **R10** — Absorver os debitos visuais ainda abertos: D-UX2 (habilitacao lua/sol em glossario/mesas) e D-MARCA2 (decisao de cor canonica), alem dos achados visuais da Spec 019.
- **R11** — Incluir paridade de assets/shell visual static-friendly quando fizer parte do theme comum: logos/header/footer/site Astro devem consumir fonte unica ou ter teste de paridade contra `packages/ui`.
- **R12** — Nao implementar nenhuma mudanca sem SDD Completo e validacao cross-modulo, pois a spec toca `packages/ui`.

## Criterios de aceite
- Existe mapa de tokens atual vs target para `packages/ui`, glossario, mesas, accounts, site e site-admin.
- Existe contrato de theme claro: exports TS, CSS vars e Tailwind preset derivados da mesma fonte.
- Existe lista de primitives/recipes com fronteira de responsabilidade e exemplos de uso por app.
- Existe plano de rollout com ordem, riscos, rollback e validacao.
- Site Astro mantem caminho zero-JS.
- Lua/sol so e habilitado em apps cujo dark mode passou em contraste e estados basicos.
- Backlog de debitos mostra D-UX2 e D-MARCA2 apontando para esta spec, sem spec visual paralela.

## Fora de escopo
- Unificar todos os layouts.
- Reescrever telas inteiras.
- Alterar auth/session/fetch.
- Alterar SEO estrutural, DNS, WordPress raiz, Gate C, VM, deploy ou producao.
- Centralizar copy contextual ou dados de dominio.
- Commit/push/merge/workflow dispatch.

## Riscos e impacto em outros modulos
- `packages/ui` e compartilhado; bug no theme pode afetar accounts, glossario, mesas e futuros apps.
- Troca de paleta sem decisao formal pode contradizer D040 e gerar retrabalho.
- Habilitar lua/sol sem CSS dark completo cria contraste quebrado.
- Primitives grandes demais podem engessar UX de cada produto. A solucao deve ser tokens + pecas pequenas + recipes, nao mega-layout unico.
- Site Astro pode perder performance/SEO se for forcado a consumir React; precisa de exports static-friendly.
