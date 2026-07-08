# 059 — Plano

> Copiar anuncio WhatsApp de mesa publicada + OG com banner da mesa. Escopo `apps/mesas`. SDD Completo.

## Fase 0 — Decisao curta do mantenedor

- Confirmar respostas das perguntas abertas em `spec.md`.
- Se nao houver resposta antes da implementacao, usar defaults:
  - faixa etaria nao usa `audience` sem prova; investigar `age_rating`;
  - sistema = `system_name` somente;
  - `setting_name`/DDAL entram em Sinopse/Sobre a Mesa;
  - inscricoes = somente URL publica da mesa;
  - campos vazios ficam vazios;
  - `price_type=paga` = "Comissionada" somente no texto copiado; codigo/API/DB continuam `paga`; detalhes em "Sobre a Mesa".

## Fase 1 — Contrato de dados

- Expor `age_rating` real em `GET /api/v1/tables/:slug` e `TableDetail`.
- Lista publica nao precisa de `age_rating`: painel do mestre e gestao buscam detalhe por `slug` no clique antes de copiar.
- `/gestao` copia somente mesas publicadas/ativas. A aba "Mesas publicadas" usa `/api/v1/tables`, que ja retorna apenas `active` e nao arquivadas; nao criar rota admin de detalhe para mesas nao ativas/canceladas.
- Se qualquer campo/rota nova entrar, atualizar OpenAPI e rodar `pnpm verify:api`.

## Fase 2 — Formatter e clipboard

- Criar `apps/mesas/frontend/src/features/table/share/whatsappAnnouncement.ts`.
- Criar `buildWhatsAppTableAnnouncement(table, options)`.
- Criar helper de clipboard com fallback.
- Testar mesa completa, parcial, horarios multiplos, paga/gratuita e sanitizacao.

## Fase 3 — UI da pagina publica

- Criar `CopyAnnouncementButton`.
- Inserir em `MesaPage.tsx`/`TableActionPanel`:
  - modo publico: perto do CTA/contatos;
  - modo owner: em "Gerenciamento".
- Feedback via toast; estado loading/disabled.

## Fase 4 — Painel do mestre

- Em `TableCardDashboard.tsx`, adicionar botao "Copiar anuncio".
- Como card nao tem `TableDetail`, buscar `/api/v1/tables/:slug` no clique.
- Guardar loading por card; impedir duplo clique.
- Reusar formatter/clipboard.

## Fase 5 — Painel de gestao

- Em `ConteudoSection.tsx`, incluir `slug` em `AdminTableRow` e normalizador.
- Adicionar row action "Copiar anuncio" com icone `Copy`.
- Buscar detalhe por slug antes de copiar.
- Nao criar rota admin nova: copiar anuncio em gestao e limitado a mesas publicadas/ativas retornadas por `/api/v1/tables`.

## Fase 6 — Open Graph de mesa

- Expandir `apps/mesas/backend/src/routes/og.ts`:
  - caso `type === 'mesas'`;
  - query por slug em `tables`, `systems`, `gm_profiles`, `profiles`;
  - meta title = `${title} | Artificio Mesas`;
  - description = sinopse/descricao truncada;
  - image = `banner_url`/`cover_url` sanitizada, fallback default.
- Preservar fallback 200 para mesa inexistente.
- Testar injection de meta tags sem duplicata.

## Fase 7 — Validacao

- Testes pontuais:
  - formatter frontend;
  - OG backend;
  - componente/acao de copiar quando viavel.
- Builds:
  - `pnpm --filter @artificio/mesas-frontend run build`
  - `pnpm --filter @artificio/mesas-backend run build`
- API:
  - `pnpm verify:api` se rota/campo/API mudar.
- Smoke beta:
  - copiar em `/mesas/:slug`;
  - copiar em `/painel`;
  - copiar em `/gestao` como admin;
  - verificar HTML/meta de `/mesas/:slug` com `curl`/view-source e preview WhatsApp quando possivel.

## Riscos

- Clipboard API exige contexto seguro e pode falhar por permissao; fallback mitiga.
- Gestao hoje lista dados minimos; copiar exige fetch adicional ou rota admin.
- OG de SPA depende de rota Express servir HTML com meta antes do fallback do frontend; manter padrao atual de `og.ts`.
- Campo de faixa etaria nao deve usar `audience`; `age_rating` existe no modelo, mas falta exposicao no contrato publico/frontend.
- "Comissionada" e traducao apresentacional apenas do texto WhatsApp; nao alterar enum/contrato interno `paga`.
- URLs Discord/WhatsApp nos contatos podem ser sensiveis? Hoje contatos publicos ja aparecem na mesa; formatter nao deve expor nada alem do que a pagina publica mostra.
