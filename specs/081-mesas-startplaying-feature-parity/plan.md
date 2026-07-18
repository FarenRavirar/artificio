# Plano — 081

> Reconstruído a partir do texto recuperado no chat (2026-07-18) — ver nota em `spec.md`.

## Arquitetura da solução

Nove frentes de trabalho (T1-T9 em `tasks.md`), cada uma rastreável a achados concretos da auditoria visual (`auditoria-visual.md`, não recuperado nesta reconstrução) e decisão registrada (`decisoes-auditoria.md`, idem). Ordem de execução seguida:

1. **T1 (fusão Home+Catálogo)** primeiro — muda a rota raiz, tudo que vem depois (breadcrumb T4, layout T2) depende dela.
2. **T2/T3 (catálogo + card)** — layout e componente de card, sem dependência de dado novo.
3. **T4/T5/T6 (página de mesa)** — hero, conteúdo, formulário, card do mestre unificado.
4. **T7 (bug tema claro)** — rodou em paralelo, isolado.
5. **T8/T9 (review + GM stats + selo pago)** — dado novo, migrations, endpoints; T3.7/T6 dependem do resultado destas.

Achado-chave que redesenhou o plano original: **maioria dos dados já existia** (`price_type`/`price_value`, `slots_total`/`slots_filled`/`slots_open`, `content_warnings`/`safety_tools` em `types/tables.ts` + já renderizados em `TableActionPanel.tsx`/`TableSecurity.tsx`). O trabalho real foi (a) destaque visual (badges) do que já existe, (b) 2 dados genuinamente novos (GM stats calculáveis, review), (c) reorganização de hierarquia visual.

## Arquivos afetados (por módulo/pacote)

- **`apps/mesas/frontend`**:
  - Rotas: `App.tsx`/router — remover `HomePage`, `/` passa a montar `CatalogoPage` (T1).
  - `pages/CatalogoPage.tsx` — layout full-bleed, filtros horizontais, scroll infinito (T2); migração de hero/sugestões da Home (T1.2).
  - `components/TableCard.tsx` — badges sobre imagem, X/Y, horário, favoritar, preço em destaque (T3).
  - `pages/MesaPage.tsx`, `features/table/components/TableHero.tsx` — ordem título/imagem, breadcrumb (T4).
  - `features/table/components/TableSchedules.tsx`, `TableContent.tsx`, `TableSecurity.tsx`, `TableTechnical.tsx` — redesign horários, descrições safety, destaque ícones (T5).
  - `features/table/components/TableMaster.tsx`, `MasterCard.tsx`, `TableActionPanel.tsx` — unificação card mestre, hierarquia sidebar, aviso cobrança, denunciar mesa (T6).
  - Formulário de cadastro de mesa — campo estruturado de estilo (T5.2).
  - `pages/MestrePage.tsx`, `components/mestre/*` — review/rating/GM stats no perfil (T8.5, T9.1).
- **`apps/mesas/backend`**:
  - Migration nova: tabela `table_favorites` (T3.6), tabela `table_reports` (T6.6), tabela `gm_reviews` (T8.2), normalização de estilos (T5.3).
  - Endpoint expandido `GET /api/v1/gm/:slug` (GM stats, T9.1).
  - Endpoint novo `GET/POST /api/v1/tables/:slug/favorite` (T3.6).
  - Endpoint novo `POST /api/v1/tables/:slug/report` (T6.6).
  - Endpoint novo `POST/GET /api/v1/gm/:slug/reviews` (T8.3).
- **`packages/ui`**:
  - Componente `GmReviewPanel.tsx` (`GmReviewSummary`, `GmReviewList`, `GmReviewForm`) (T8.4).

## Contratos/interfaces tocados

- API: `pnpm verify:api` obrigatório para T3.6, T6.6, T8.3 e T9.1 (mudanças em `apps/mesas/backend`).
- `packages/ui`: novos exports — checar não-regressão de consumidores atuais (mesas confirmado; glossario/site não forçados a consumir).
- `packages/auth`/`accounts.`: sem mudança feita — guard `auth=user` do review (T8.3) usa infraestrutura já existente.

## Impacto em consumidores

- `apps/mesas/frontend` é o único consumidor confirmado.
- Fusão Home+Catálogo (T1) pode afetar links externos apontando para `/` esperando o comportamento antigo — validado analytics/SEO (meta tags da rota raiz) antes de fechar.

## Rollback

- Migrations novas (favoritos T3.6, denúncia T6.6, review T8.2, normalização T5.3): `online-safe` sempre que possível; normalização de dado sujo documenta antes/depois para permitir reversão manual se merge de duplicata for indevido.
- Sem feature-flag (proibido por `AGENTS.md`) — rollback via revert de PR.

## Validação (como provo que funciona)

- `pnpm run lint` + `pnpm run build` de `apps/mesas` (backend+frontend) e `packages/ui` por task fechada.
- `pnpm verify:api` após T3.6/T6.6/T8.3/T9.1.
- Teste manual via preview: catálogo fundido funcional (T1-T3), página de mesa reorganizada (T4-T6) em mesa GM e mesa announcer, tema claro funcionando (T7), review exige login (T8), GM stats e selo pago visíveis (T9).
