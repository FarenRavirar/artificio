# Tasks — 081

> Reconstruído a partir do texto recuperado pelo mantenedor no chat (2026-07-18) — a pasta `specs/081-*/` nunca foi criada durante a implementação real (PR #178/#179 mergeados em `dev`). Todo o trabalho abaixo já está implementado e em produção/beta; este arquivo documenta retroativamente o que foi feito. Ver `BL-MESAS-CATALOGO-SELOS-DUP` em `specs/backlog.md` para o achado que revelou a lacuna e um débito de follow-up (duplicação de toggles de selo no `CatalogoPage.tsx`, não coberto por esta spec).

- [x] Todas as 34 decisões + 4 achados de investigação registrados — `decisoes-auditoria.md` (arquivo não recuperado nesta reconstrução).
- [x] Decisão estrutural: fundir Home+Catálogo, migrar hero/sugestões pro topo do catálogo fundido.

## T1 — Fusão Home + Catálogo ✅

- [x] T1.1 — `/` passa a renderizar `CatalogoPage` (ou equivalente fundido); remover `HomePage.tsx` e sua rota.
- [x] T1.2 — Migrar hero de boas-vindas + chips de sugestão de sistema (D&D 5e/Ordem Paranormal/Vampiro/Tormenta) + botão "Anunciar mesa" para o topo do catálogo, acima dos filtros/grid.
- [x] T1.3 — Atualizar navegação (`nav "Início"` apontava pra `/`, agora é o mesmo destino do Catálogo — removida duplicidade, `moduleNav` só tem "Catálogo" → `/` e "Painel").
- [x] T1.4 — Validar: `tsc --noEmit` limpo, rota `/` renderiza hero+catálogo fundido confirmado via preview browser, sem 404/regressão de link interno (`/catalogo` mantida ativa em paralelo, ambas montam `CatalogoPage`).

## T2 — Reformular layout do catálogo (full-bleed + filtros) ✅

- [x] T2.1 — Layout vira full-bleed (removido `container mx-auto` do bloco de conteúdo/grid) — cards ocupando a largura útil da tela.
- [x] T2.2 — Filtros migram de 3 blocos empilhados verticalmente para uma única barra horizontal no topo (busca+sistema+modalidade+preço+nível+selos numa linha só, com scroll-x).
- [x] T2.3 — Filtro de Estilos vira linha própria com scroll horizontal (antes: 48 botões quebrando linha).
- [x] T2.4 — Mantido: filtro de sistema (`SystemPicker`), selos DDAL/Covil, chips de filtros ativos removíveis (`ActiveFiltersChips`).
- [x] T2.5 — Removida contagem de resultados duplicada (antes aparecia 2x: header + `ResultsHeader`; agora só `ResultsHeader`).
- [x] T2.6 — Paginação numérica substituída por scroll infinito real: novo hook `useInfiniteCatalogTables` (acumula páginas client-side, dedup por id, reset ao mudar filtro) + `IntersectionObserver` como sentinela + botão "Carregar mais mesas" como fallback manual/acessível.
- [x] T2.7 — Validado: `tsc --noEmit` limpo, visual confirmado via preview browser (hero+barra de filtros+grid full-bleed, sem contagem duplicada). Dark/light (T7) e mobile validados em conjunto com T7.

## T3 — Card do catálogo (`TableCardComponent`)

- [x] T3.1 — Badge de vagas migrada do corpo do card para PILL sobre a imagem, junto das badges de certificação (canto superior esquerdo).
- [x] T3.2 — Card mostra "X/Y preenchidas" (`slots_filled`/`slots_total`) além do indicador compacto de vagas restantes.
- [x] T3.3 — Preço ganha destaque de fonte maior (`text-lg font-black`, antes `text-sm font-bold`, mesmo peso que vagas).
- [x] T3.4 — Implementado (2026-07-18): `GET /api/v1/tables` agora agrega `next_schedule` (batch query em `table_schedules`, mesmo padrão de `contacts`) — primeiro horário configurado por `sort_order`. **Nota:** `table_schedules` só guarda recorrência (`day_of_week`+`start_time`), sem data absoluta, então não existe "próxima sessão" calculável de fato — o campo expõe o padrão semanal configurado (ex.: "SEG 19:00"), que é o dado real disponível e equivalente ao que StartPlaying mostra. Card (`TableCard.tsx`) renderiza via novo `TableCardSchedule`. `pnpm verify:api` verde (5 non-breaking, campo novo opcional).
- [x] T3.5 — Investigado (2026-07-18, SQL read-only via SSH em prod, mesas `status IN ('active','full')`): 47 mesas ativas, 31 sem `gm_id` (66%) — mas **zero inconsistência**: as 31 batem exatamente com `publisher_role != 'gm'` (36 no total, algumas fora do filtro de status), nenhuma mesa `publisher_role='gm'` está sem `gm_id`. `gm_display_name` (`COALESCE(gm.nickname, p.display_name)`) só é nulo quando a mesa é de ANUNCIANTE — caso já coberto por `actual_gm_name` no frontend (T6.2). Não é bug nem dado sujo, é o comportamento esperado do produto (maioria das mesas hoje é anunciante, não GM registrado). Nada a corrigir.
- [x] T3.6 — Favoritar (bookmark) implementado full-stack: **não existia** endpoint de favorito por usuário (só `metrics.favorites` agregado) — corrigido escopo. Migration `apps/mesas/database/migration_151_table_favorites.sql` (tabela `table_favorites`, unique user+table), `GET/POST /api/v1/tables/:slug/favorite` (`authMiddleware`, toggle, sincroniza `table_metrics.favorites_count`), botão bookmark no card (canto superior direito, redireciona pro SSO se deslogado). `pnpm verify:api` verde (3 non-breaking, 0 breaking).
- [x] T3.7 — Rating do GM integrado no card do catálogo (ver T8.6).
- [x] T3.8 — Validado: `tsc --noEmit` limpo (frontend e backend), `eslint` limpo nos arquivos tocados, `pnpm verify:api` verde. Visual/mobile validado em conjunto com T7 (tema).

## T4 — Página de mesa: hero e breadcrumb

- [x] T4.3 — Removida duplicata de "vagas": linha "Vagas: N disponíveis" do `QuickInfoPanel` (`TableActionPanel.tsx`) removida — já coberta pelo aviso de urgência (`vm.urgency.label`, "🔥 Últimas N vagas") com mais contexto.
- [x] T4.4 — Validado: `tsc --noEmit` e `eslint` limpos. Visual não pôde ser confirmado em produção real (ambiente local sem backend/DB — `TableDetail` fica `null`, página cai na tela de erro antes de renderizar o breadcrumb); lógica confirmada por leitura de código e compilação. **Achado de investigação (não é bug meu):** durante teste no browser, um erro de "Maximum update depth exceeded" apareceu numa tab que já estava aberta antes de eu deletar `HomePage.tsx` — era HMR do Vite preso numa referência stale ao módulo deletado, não bug de produção. Confirmado limpo numa tab nova (zero erro de console). Não requereu correção.

## T5 — Página de mesa: conteúdo e formulário ✅

- [x] T5.1 — Redesenhado "Horários das Sessões": cards em grid 2 colunas, ícone de dia com abreviação (SEG/TER/...), ícone de relógio no horário, badge de frequência com ícone — antes era lista vertical simples com só emoji.
- [x] T5.2 — Corrigido: campo estruturado (`SettingStylesField`, chips) já existia e funcionava — achado real era **confusão de nomenclatura**: campo de texto livre vizinho se chamava "Estilo de Jogo" (quase idêntico a "Estilos/Temáticas" do campo certo). Renomeado pra "Descrição do Estilo de Jogo" + aviso inline explicando que só o campo de chips gera filtro/tag no catálogo. Label do campo certo também ganhou hint "(aparece como filtro/tag no catálogo)".
- [x] T5.3 — Migration `apps/mesas/database/migration_152_normalize_setting_styles.sql`: levantado dado real via `SELECT DISTINCT unnest(setting_styles)` em produção (read-only, via SSH) — confirmadas duplicatas reais (`Dark Fantasy`/`dark fantasy`, `Exploração`/`Exploração.`, `Fantasia`/`fantasia`, `Sobrevivência`/`sobrevivência`/`Saobrevivência`, `Suspense`/`suspense`, `Terror`/`terror`, `Macabro.`, typo `Miastério`→`Mistério`). Migration normaliza case/pontuação/typo com dedup via `array_agg(DISTINCT...)`.
- [x] T5.4 — Criado `apps/mesas/frontend/src/utils/safetyToolsGlossary.ts` com descrições de mercado para safety tools (X-Card, Linha e Véu, etc) e content warnings comuns — produção não tinha dado real (`SELECT DISTINCT` vazio) então cobre vocabulário conhecido da comunidade + fallback sem descrição pra termos fora do glossário. `TableSecurity.tsx` mostra descrição via `title` (tooltip) + lista abaixo das pills (acessível em mobile).
- [x] T5.5 — Ícones de requisitos técnicos trocados de emoji pra ícones Lucide (`Monitor`/`Video`/`Mic`) com mais destaque: badge maior, borda, ícone 5x5 (antes emoji 1x inline) — sem adicionar novo requisito.
- [x] T5.6 — Validado: `tsc --noEmit` e `eslint` limpos em todos os arquivos tocados, `pnpm verify:api` verde (mesmas 3 non-breaking de antes, migration não altera contrato TS). Teste manual de cadastro não executado (exige backend real rodando) — lógica confirmada por leitura de código.

## T6 — Card do Mestre (unificado, sem duplicação) ✅

- [x] T6.1 — Eliminada duplicação real (Diggo): `TableMaster` removido de `MesaPage.tsx` (arquivo mantido, ainda referenciado por `EngagementBlock.tsx`/`TableView.tsx` — achado de dead-code fora de escopo, não deletado). `MasterCard.tsx` unificado: bio + badge Covil do Lich + VTT platforms + link de perfil, único card na sidebar.
- [x] T6.2 — Card do mestre aparece também para mesa ANUNCIANTE: usa `actual_gm_name` como nome (sem avatar/bio/slug/link, já que não há perfil), label muda pra "Mestre responsável".
- [x] T6.3 — `PricePanel` já tinha destaque (fonte 2xl); linha "Vagas" duplicada removida do `QuickInfoPanel` (T4.3) reforça a hierarquia (só urgência + preço em destaque, resto secundário).
- [x] T6.4 — CTA/sidebar ganha aviso de cobrança em `PricePanel`: "💬 Cobrança combinada diretamente com o mestre, fora da plataforma" quando mesa é paga.
- [x] T6.5 — Investigado: `buildWhatsAppTableAnnouncement` (`whatsappAnnouncement.ts:353`) **já incluía** `▬ Data e Hora: ${formatSchedules(table)}` — achado estava desatualizado, nada a corrigir.
- [x] T6.6 — Feature nova full-stack: migration `apps/mesas/database/migration_153_table_reports.sql` (tabela `table_reports`, reason curado, denúncia anônima permitida), `POST /api/v1/tables/:slug/report` (`optionalAuth`), componente `ReportTableButton.tsx` na sidebar da `MesaPage` — separado do FAB de feedback de sistema já existente.
- [x] T6.7 — Validado: `tsc --noEmit` e `eslint` limpos (frontend+backend), `pnpm verify:api` verde (4 non-breaking, 0 breaking). Teste manual em mesa GM/announcer não executado (exige backend real) — lógica confirmada por leitura de código.

## T7 — Bug: toggle de tema não funciona na página de mesa ✅ (falso positivo — sem correção necessária)

- [x] T7.1 — Reinvestigado com clique real via `javascript_tool` (não screenshot, que travava na sessão original de auditoria). Em `localhost`, clique muda `data-theme` corretamente mas cookie não grava — **comportamento esperado**: `writeThemeCookie` usa `Domain=.artificiorpg.com; Secure`, que exige HTTPS + domínio real, ausente em dev local.
- [x] T7.2 — Sem causa raiz a corrigir — não havia bug de código.
- [x] T7.3 — Validado em **produção real** (`https://mesas.artificiorpg.com/mesas/samsara---o-caminho-para-redencao-mrpibat4`): clique no toggle mudou `data-theme` de "dark" para "light" **E** gravou o cookie (`artificio_theme=light`) corretamente. Revertido para "dark" ao final do teste (sem impacto em outros usuários — mudança só no cookie do navegador local do teste). **Conclusão: o achado original (investigação de 2026-07-17) foi falso positivo da ferramenta de screenshot que estava travando naquela sessão — não um bug real do produto.**

## T8 — Review estruturado do GM (só usuário logado) ✅

- [x] T8.1 — Tags curadas definidas com o mantenedor (8): Pontual, Bom narrador, Justo com as regras, Cria bom ambiente, Flexível com horários, Responde rápido, Organizado, Recomendaria a outros.
- [x] T8.2 — Migration `apps/mesas/database/migration_154_gm_reviews.sql`: tabela `gm_reviews` (rating 1-5, tags array, comment, unique `gm_user_id`+`author_user_id`, check anti-autoavaliação), header completo.
- [x] T8.3 — `POST /api/v1/gm/:slug/reviews` (`authMiddleware`, upsert, recalcula e grava `gm_profiles.avg_rating`/`reviews_count` — colunas que já existiam no schema mas nunca eram escritas) + `GET /api/v1/gm/:slug/reviews` (listagem completa + join com autor). `pnpm verify:api` verde (5 non-breaking).
- [x] T8.4 — Componentes novos em `packages/ui/src/GmReviewPanel.tsx`: `GmReviewSummary` (resumo compacto ★4.5 (12)), `GmReviewList` (lista completa nome+avatar+nota+tags+comentário), `GmReviewForm` (estrelas clicáveis + tags + textarea).
- [x] T8.5 — Integrado em `/mestre/{slug}` via `MestreReviewsSection.tsx` — form só para usuário logado (guard client-side, backend também exige `authMiddleware`), lista completa sempre visível. **Achado:** `MestreHero.tsx` já lia `profile.avg_rating`/`reviews_count` e só nunca tinha dado real — agora populado automaticamente pelo T8.3.
- [x] T8.6 — Rating resumido integrado: card do catálogo (`TableCard.tsx`, T3.7) via `gm_avg_rating`/`gm_reviews_count` expandidos no SELECT de `GET /api/v1/tables`; card da mesa (`MasterCard.tsx`, T6) via mesmo campo expandido em `GET /api/v1/tables/:slug`. Anunciante não mostra rating (não tem `gm_user_id` de review).
- [x] T8.7 — Validado: `tsc --noEmit` limpo em todos os pacotes tocados (frontend, backend, `packages/ui` com build), `eslint` limpo, `pnpm verify:api` verde. Teste manual (review sem login → 401) não executado (exige backend real) — guard confirmado por leitura de código (`authMiddleware` na rota POST).

## T9 — GM stats calculáveis + selo mesa paga ✅

- [x] T9.1 — `GET /api/v1/gm/:slug` expandido: `tables_hosted_count` (histórico total, `COUNT(*)` sem filtro de status — diferente de `tables_count` que já existia e é só ativas) e `years_on_platform` (calculado via `EXTRACT(YEAR FROM AGE(NOW(), gm.created_at))`). `MestreHero.tsx` exibe ambos com rótulo próprio ("Na plataforma desde AAAA", "N mesas hospedadas"), claramente distinto de "N+ anos de experiência" (`experience_years`, autodeclarado, achado já tratado).
- [x] T9.2 — Selo "💰 Paga" em destaque visual: badge amarelo sobre a imagem no card do catálogo (`TableCard.tsx`, junto das badges de certificação) e badge no `PricePanel` da página de mesa (`TableActionPanel.tsx`), usando `price_type` já existente.
- [x] T9.3 — Validado: `tsc --noEmit` limpo (frontend+backend), `eslint` limpo, `pnpm verify:api` verde (5 non-breaking, mesma contagem de antes — T9 só expande SELECT existente, sem endpoint novo). Teste manual no perfil do GM não executado (exige backend real) — lógica confirmada por leitura de código.

## Fechamento da spec

- Todos os itens pendentes (T3.4, T3.5) e o débito de follow-up (`BL-MESAS-CATALOGO-SELOS-DUP`) foram fechados em 2026-07-18 (ver histórico abaixo). Nenhuma pendência conhecida em aberto.

## Débitos de follow-up (registrados em `specs/backlog.md`)

| ID | Status | Origem | Escopo | Falta para fechar | Proximo passo |
|---|---|---|---|---|---|
| BL-MESAS-CATALOGO-SELOS-DUP | **fechado 2026-07-18** | PR #179 (feat StartPlaying feature parity, mergeada em `dev` 2026-07-18), achado do mantenedor em `apps/mesas/frontend/src/pages/CatalogoPage.tsx` | `apps/mesas/frontend/src/pages/CatalogoPage.tsx`, `apps/mesas/frontend/src/components/SealToggle.tsx` (novo) | FECHADO: extraído componente `SealToggle` (`variant`: `'pill'`\|`'toolbar'`\|`'drawer'`), substituídos os 3 blocos JSX duplicados (hero pills, desktop toolbar, mobile drawer) por chamadas do componente. `tsc --noEmit` e `eslint` limpos. Header "Catálogo de Mesas" redundante **não foi removido** — mantenedor não confirmou essa parte do achado, fica registrado como observação, não como pendência bloqueante. | — |
