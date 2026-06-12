# Plano — 018

## Arquitetura da solucao
Manter a estrutura tecnica do G1 como monorepo modular, mas ajustar a camada de comunicacao: "projetos" e o nome publico da colecao de experiencias; "modulos" e termo tecnico interno quando descreve isolamento, gates, deploy, `apps/*` e contratos.

## Arquivos afetados (por modulo/pacote)
- `packages/ui/src/Footer.tsx`
- `packages/ui/src/Header.tsx`
- `packages/content/src/site.ts`
- `apps/site/src/components/SiteHeader.astro`
- `apps/site/src/components/SiteFooter.astro`
- `apps/site/src/lib/content.ts`
- `apps/accounts/frontend/src/main.tsx`
- `README.md`
- `.specify/memory/decisions.md`
- `.specify/memory/project-state.md`
- `docs/agents/context-capsule.md`
- `sessoes/26-06-12_2_debitos_ux-marca.md`
- `sessoes/26-06-12_3_ui-marca_debitos-exec.md`

## Contratos/interfaces tocados
Nenhum contrato auth, schema, DNS, API ou deploy. Apenas texto, comentarios e documentacao.

## Impacto em consumidores
`packages/ui` Footer/Header sao consumidos por glossario/mesas e futuros apps. `packages/content` fornece metadados SEO para o site. As alteracoes sao textuais e nao mudam props, tipos ou comportamento.

## Rollback
Reverter o commit/patch da spec 018. Como nao ha migration nem deploy isolado de infra, rollback e apenas codigo/documentacao.

## Validacao
- `pnpm --filter @artificio/ui build`
- `pnpm --filter @artificio/content build`
- `pnpm --filter @artificio/site build`
- `pnpm --filter @artificio/accounts-frontend build`
- `pnpm --filter @artificio/glossario-frontend build`
- `pnpm --filter @artificio/mesas-frontend build`
- `rg` final para confirmar que a linguagem publica foi atualizada sem mexer em termos tecnicos.
