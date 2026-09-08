# Plano — 014

## Arquitetura da solução
Mudança aditiva de dado, não de componente: acrescentar `{ label: "WhatsApp", href: "https://links.artificiorpg.com" }` em `defaultNavItems` (`packages/ui/src/modules.ts` ou equivalente) e no espelho `MODULES` (`apps/site/src/…/content.ts`). Posição: fim da lista de módulos (decidir com mantenedor se antes/depois de SRD).

## Arquivos afetados
- `packages/ui/src/…` (defaultNavItems)
- `apps/site/src/…/content.ts` (MODULES)

## Contratos/interfaces tocados
Nenhum contrato de tipo novo (item segue shape existente). Sem auth/DNS/schema.

## Impacto em consumidores
site (header Astro/`MODULES`), mesas, accounts e glossário (Header React/`defaultNavItems`, glossário consome a partir da spec 012). Todos re-renderizam o item — smoke nos betas após push-dev. Se 014 rodar antes do glossário estar no monorepo, ele herda o item automaticamente no T3 da 012 (vem de `defaultNavItems`).

## Rollback
Revert do commit (1–2 arquivos).

## Validação
Build turbo verde; HTML servido dos 3 módulos contém o link; clique manual no beta.
