# Plano — 010 Nav cross-módulo + logo

## Passo 0 (mantenedor, desbloqueia R2)
Abrir `https://beta.artificiorpg.com` e `https://mesasbeta.artificiorpg.com` em **janela anônima / sem extensões**. Reportar se a logo aparece. Resultado decide R2 (extensão vs deploy).

## Arquitetura / decisão (R4)
Opções p/ o header do site:
- **A. `.astro` com `defaultNavItems`** (zero-JS): editar `apps/site/src/components/SiteHeader.astro` p/ renderizar o nav cross-módulo (importar `defaultNavItems`/`modules` do `@artificio/ui` ou replicar a lista) + categorias do blog como 2ª linha. Mantém zero-JS. **Recomendado** p/ blog público.
- **B. Island `<Header/>` React** (`@artificio/ui`): reuso real do componente (nav + session + menu de conta). Traz JS + `@artificio/auth`. Usar `client:load`; tratar SSR (auth client é browser-only → talvez `client:only`).
- **Meio-termo:** A (nav zero-JS) + island só p/ o menu de conta logado.

## Arquivos afetados
| Caminho | Mudança |
|---|---|
| `apps/site/src/components/SiteHeader.astro` | nav cross-módulo (R1); categorias → 2ª linha |
| `apps/site/src/lib/content.ts` | `SECTIONS` vira nav secundário (renomear/realocar) |
| `packages/ui/src/modules.ts` | (se preciso) expor `defaultNavItems` p/ Astro; conferir `Glossario`→`Glossário` acento |
| `packages/ui/src/{Header,Footer}.tsx` ou `brand.ts` | só se R2 apontar bug real de render do logo |
| `apps/mesas` / `apps/accounts` | só verificar (se logo for deploy stale, redeploy) |

## Validação
- `pnpm --filter @artificio/site build` verde; preview mostra nav cross-módulo + logo.
- Janela anônima: logo ok (CA2).
- `pr-checks` verde (guard exec-bit etc).
- Se tocar `packages/ui`: build de mesas/accounts verde (não quebrar consumidores).

## Rollback
Tudo versionado; reverter PR. Deploy só quando autorizado.

## Notas de contexto (estado ao abrir esta spec)
- Site no ar em `beta.artificiorpg.com` (spec 008, 125 posts).
- Esteira blindada (spec 009, D050) live + validada. **R6 (restart-resilience) commitado local `2681612`, NÃO deployado** (aguarda autorização de push+redeploy do mantenedor).
- **Commits locais não-pushados:** `861128d` (docs validação 009), `2681612` (R6). Push/deploy **bloqueados** até o mantenedor autorizar explicitamente.
