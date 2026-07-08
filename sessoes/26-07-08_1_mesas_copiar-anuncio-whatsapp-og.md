# Sessao 26-07-08_1 — mesas copiar anuncio WhatsApp + OG de mesa

- **Data:** 2026-07-08
- **App/escopo:** `apps/mesas`
- **Objetivo:** criar spec nova para botao de copiar anuncio de mesa em formato WhatsApp e corrigir Open Graph da URL publica da mesa para usar banner da mesa.
- **Modo:** SDD Completo, por decisao do mantenedor: risco de problemas por tocar fluxo publico, gestao, SEO/OG e possivel contrato API.
- **Gate:** D mesas; validacao alvo beta antes de prod.
- **Pedido:** mantenedor pediu investigar, fazer perguntas e montar spec nova.

## T0/T1 lidos

- T0 completo: `.specify/memory/project-state.md`, `docs/agents/context-capsule.md`, `.specify/memory/decisions.md`.
- `AGENTS.md` lido por pedido explicito.
- `C:\Users\paulo\.codex\RTK.md` lido; comandos via `rtk powershell -Command` quando PowerShell cmdlet.
- T1 specs/backlog/sessoes: `specs/README.md`, `specs/backlog.md`, `sessoes/index.md`.
- Caveman skill lida por regra de comunicacao.

## Investigacao

- `apps/mesas/backend/src/routes/og.ts` hoje so trata `/:type/:slug` com caso especial `type === 'mestre'`; `mesas/:slug` cai em fallback generico. Logo, compartilhamento de `https://mesas.artificiorpg.com/mesas/<slug>` nao usa banner da mesa.
- `GET /api/v1/tables/:slug` ja retorna dados ricos suficientes para montar anuncio: titulo, sistema, schedules, slots, classificacao/experiencia, modalidade, plataformas, mestre, sinopse, bio do mestre, detalhes, contatos e URL.
- `MesaPage.tsx` ja carrega `TableDetail`, calcula `vm` via `useTableViewModel`, e renderiza `TableActionPanel`; ponto natural para botao publico.
- `TableActionPanel` modo `owner` e usado quando dono/admin abre a pagina publica; ponto natural para botao tambem no painel da mesa publicada.
- `PainelMestrePage` lista mesas por `TableCardDashboard`; card atual nao tem dados completos para anuncio, entao botao ali deve buscar detalhe por slug antes de copiar.
- `/gestao` em `ConteudoSection.tsx` lista `AdminTableRow` minimalista (`id`, `title`, `status`, `created_at`, `is_covil`) a partir de `/api/v1/tables`; para copiar no painel de gestao, precisa buscar detalhe por slug ou ampliar row com `slug`.
- Existe uso de `navigator.clipboard.writeText` em `MestreContactMethods.tsx`, mas nao existe helper compartilhado de copiar texto de mesa.

## Decisoes propostas

- SDD Completo com `spec.md`, `plan.md`, `tasks.md`, `reviews.md`, `debitos.md`.
- Criar formatter frontend local de WhatsApp: `buildWhatsAppTableAnnouncement(table, origin)`.
- Criar helper de clipboard local com fallback para `textarea + document.execCommand('copy')`.
- Botao publico na sidebar da mesa: "Copiar anuncio".
- Botao owner/admin na mesma pagina publica: "Copiar anuncio" em Gerenciamento.
- Botao no painel do mestre (`TableCardDashboard`): busca `/api/v1/tables/:slug`, monta texto, copia.
- Botao em `/gestao` aba "Mesas publicadas": incluir `slug` no row e botao de linha "Copiar anuncio".
- OG: `apps/mesas/backend/src/routes/og.ts` deve reconhecer `type === 'mesas'`, consultar mesa por slug e usar `banner_url/cover_url` sanitizado como `og:image`.

## Perguntas abertas para o mantenedor

1. **Fechado:** "Sistema" deve usar somente `system_name`; `setting_name` e DDAL entram na descricao/sobre a mesa.
2. **Aberto aprofundado:** "Faixa Etaria" nao deve usar `audience` automaticamente; investigar `age_rating` em banco/pipeline/detalhe publico.
3. **Fechado:** "Inscricoes" deve mostrar somente link publico da mesa.
4. **Fechado:** "Mesa: Comissionada ou gratuita" usa `price_type=paga` como "Comissionada" somente na saida copiar/colar; codigo/API/DB continuam `paga`. Detalhes financeiros entram em "Sobre a Mesa".
5. **Fechado:** campos vazios permanecem vazios. Objetivo e texto final completo, sem humano editar.

## Atualizacao 2026-07-08

- Spec ajustada para SDD Completo.
- Decisoes do mantenedor registradas em `spec.md`, `plan.md`, `tasks.md`, `reviews.md`.
- Aprofundamento documentado: `age_rating` e `price_type/comissionada`.
- Busca em codigo confirmou `age_rating` em `tables` (`db/types.ts`), hydration, parser e sync; gap atual e exposicao em `routes/tables.ts`/`TableDetail`, nao ausencia do dado.
- Decisao final registrada: `paga` vira "Comissionada" so no texto copiado. Fase 0 encerrada.

## Alteracoes documentais feitas

- Criada spec `specs/059-mesas-copiar-anuncio-whatsapp-og/`.
- Atualizados `specs/README.md`, `specs/backlog.md`, `.specify/memory/project-state.md`.

## Checklist de fechamento desta fase

- [x] T0/T1 lidos.
- [x] Codigo real investigado.
- [x] Spec/plan/tasks/reviews/debitos criados.
- [x] Backlog atualizado.
- [x] Project-state atualizado.
- [x] Fase 0 encerrada.
- [ ] Implementacao nao iniciada; depende de autorizacao nominal de fase.

## Atualizacao Fase 1 — 2026-07-08

- Investigacao profunda do contrato concluiu:
  - `GET /api/v1/tables/:slug` tem dados ricos do anuncio, mas nao seleciona `t.age_rating`.
  - `TableDetail` nao tipa `age_rating`.
  - `/api/v1/tables` lista apenas `status=active` e `archived_at is null`.
  - `/gestao` usa a aba "Mesas publicadas" via `/api/v1/tables`; hoje falta preservar `slug` no `AdminTableRow`.
  - Nao existe `GET /api/v1/admin/tables/:id`, e nao sera criado para esta spec.
- Decisao do mantenedor: copiar anuncio na gestao sera sempre apenas para mesas publicadas/ativas.
- Consequencia:
  - Fase 1 precisa expor `age_rating` apenas no detalhe publico `/api/v1/tables/:slug` + `TableDetail`.
  - Lista publica, lista GM e rota admin nova nao precisam de `age_rating`.
  - Painel do mestre e gestao buscam detalhe publico por `slug` antes de copiar.
  - Fase 5 so inclui `slug` em `AdminTableRow`/normalizador e row action.

## Atualizacao Fase 3 — 2026-07-08

- Investigacao profunda da pagina publica concluiu:
  - `MesaPage.tsx` ja tem `TableDetail` cru (`table`) e `TableViewModel` (`vm`) ao mesmo tempo.
  - O formatter do anuncio nao deve depender de `TableViewModel`, porque precisa campos crus que o `vm` nao carrega (`age_rating`, `synopsis`, `billing_text`, `ddal_*`, setting/cenario).
  - Caminho recomendado: criar `CopyAnnouncementButton` recebendo `TableDetail` e fazer `TableActionPanel` aceitar `announcementTable?: TableDetail`.
  - `MesaPage` passa `announcementTable={table}`. Visitante (`variant="full"`) ve o botao abaixo do CTA; owner/admin (`variant="owner"`) ve o botao no bloco "Gerenciamento".
  - Consumidores que so tem `TableViewModel` continuam sem botao, porque a prop e opcional (`TableView.tsx`, `MasterTables.tsx`).
  - Nao mexer no sticky CTA mobile nesta fase; ele continua sendo acao primaria de inscricao/contato.
  - Fase 4 continua separada: `TableCardDashboard` busca detalhe publico por `slug` antes de copiar.

## Atualizacao Fase 4 — 2026-07-08

- Investigacao profunda do painel do mestre concluiu:
  - O card real e `apps/mesas/frontend/src/components/TableCardDashboard.tsx`; nao existe em `features/master/components`.
  - `PainelMestrePage.tsx` carrega `GET /api/v1/gm/tables`, normaliza em `MyTableEnhanced` e renderiza `TableCardDashboard`.
  - `MyTableEnhanced`/card ja tem `slug`, `status` e `archived`; nao precisa ampliar a rota GM para localizar a mesa publica.
  - `GET /api/v1/gm/tables` nao filtra por `status` nem `archived_at`; inclui mesas canceladas, encerradas e arquivadas. Logo, o titulo "Suas mesas publicadas" nao e garantia de catalogo publico.
  - O botao no painel deve aparecer/ficar habilitado somente para `status === 'active'` e `!archived`, respeitando a decisao do mantenedor de copiar apenas mesas publicadas/ativas.
  - O clique deve buscar `GET /api/v1/tables/:slug`, montar com o formatter da Fase 2 e copiar. Nao usar `GET /api/v1/gm/tables/:id`, porque e contrato de edicao.
  - Risco encontrado: `GET /api/v1/tables/:slug` hoje nao filtra explicitamente `status=active` nem `archived_at is null`, embora a lista publica filtre. Entao a Fase 4 deve validar tambem o detalhe retornado antes de copiar.
  - Se a implementacao decidir endurecer a rota publica de detalhe para 404 em inativas/arquivadas, isso muda comportamento publico de `/mesas/:slug` e deve ser tratado com decisao/escopo proprio, nao escondido dentro do botao.
  - Estado de loading pode seguir padrao existente por ID (`copyingAnnouncementTableId`) ou ficar no componente reutilizavel; copia nao deve disparar refresh do painel.

## Atualizacao Fase 5 — 2026-07-08

- Investigacao profunda da gestao concluiu:
  - A aba real e `ConteudoSection.tsx` em `features/admin/components`, tab `tables`, label `Mesas publicadas`.
  - A tabela usa `AdminTable`, componente generico de gestao com `rowActions`, `hidden`, mas sem `disabled`/loading por acao.
  - `fetchAllTables()` usa `authGet('/api/v1/tables')`; essa rota publica filtra `status=active` e `archived_at is null`, entao a fonte esta alinhada com a decisao de copiar apenas mesas publicadas/ativas.
  - `AdminTableRow` descarta `slug`, embora `/api/v1/tables` ja retorne `slug`. Gap da Fase 5: preservar `slug` em `normalizeTables`.
  - Rotas admin de mesa confirmadas em `adminTables.ts`: auto-archive, batch, PUT por id e DELETE por id. Nao ha detalhe admin, e nao sera criado.
  - Handler recomendado: `handleCopyAnnouncement(table)`, valida `slug`, busca `GET /api/v1/tables/:slug`, valida detalhe ativo/nao arquivado, monta texto pelo formatter da Fase 2 e copia.
  - Mesmo vindo da lista publica, manter validacao do detalhe por corrida entre listagem e clique.
  - Nao criar bulk action de copiar; clipboard em lote e ambigua. Usar row action `Copiar anuncio` com icone `Copy`/`Clipboard`.
  - Usar `copyingTableId` e `hidden` ou guarda no handler para evitar clique duplo, sem ampliar `AdminTable`.

## Atualizacao Fase 6 — 2026-07-08

- Investigacao profunda do Open Graph concluiu:
  - `frontend/nginx.conf` detecta crawlers por user-agent (`WhatsApp`, `Discordbot`, `facebookexternalhit`, etc.) e reescreve rotas SPA para `/og/<path>` no backend.
  - Assim, crawler em `/mesas/<slug>` chega ao backend como `/og/mesas/<slug>`.
  - `server.ts` monta `app.use('/og', ogRoutes)`.
  - `routes/og.ts` tem `router.get('/:type/:slug')`, mas so implementa `type === 'mestre'`. `type === 'mesas'` cai em fallback generico, logo nao usa banner da mesa.
  - `og.ts` le `INDEX_HTML_PATH` do volume `frontend-dist` e injeta meta tags server-side; remove tags OG/Twitter antigas antes de injetar novas.
  - `index.html` tem fallback estatico com `og-default.png`.
  - Existe `sanitizePublicImageUrl()` no backend; remove imagens efemeras do Discord e preserva URLs estaveis/paths locais.
  - Para OG de mesa, `og:image` precisa ser absoluto; se o sanitizador devolver path como `/assets/...`, a Fase 6 deve converter para `${SITE_URL}/assets/...`.
  - Imagem de mesa deve priorizar `t.banner_url`, depois `t.cover_url`, depois `DEFAULT_OG_IMAGE`.
  - Descricao deve usar `listing_excerpt` -> `synopsis_narrative` -> `synopsis` -> `description` -> fallback com titulo/sistema/mestre.
  - OG de mesa deve respeitar visibilidade publica: `status='active'`, `archived_at is null` e regra de expiracao para importadas. Inexistente/inativa/arquivada/expirada deve retornar HTML fallback 200 para crawler.
  - Nao usar HTTP interno para `/api/v1/tables/:slug`; query direta em `og.ts`, como ja acontece com mestre.
  - Validacao beta deve usar user-agent de crawler, ex. `curl -A "WhatsApp" https://mesasbeta.artificiorpg.com/mesas/<slug>`, porque browser normal recebe SPA.

## Revisao externa registrada — 2026-07-08

- Comentario CodeRabbit em `tasks.md` linhas da Fase 2 procedia: matriz de testes do formatter nao citava explicitamente `age_rating`, apesar de faixa etaria dedicada ser decisao central da Fase 1.
- Ajuste aplicado localmente em `specs/059-mesas-copiar-anuncio-whatsapp-og/tasks.md`:
  - casos minimos agora incluem `age_rating=livre` -> `Livre`, `age_rating=+16` preserva `+16` e `age_rating=null` mantem `Faixa Etaria:` vazia;
  - T2.3 agora exige cobertura de `age_rating`.
- Nao responder ao bot no PR; regra do projeto manda registrar/fixar em docs, nao comentar em revisor externo.
