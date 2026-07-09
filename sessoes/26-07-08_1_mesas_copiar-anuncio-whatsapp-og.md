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

## Retomada Codex — Fase 1 — 2026-07-08

- T0, `AGENTS.md`, RTK, spec 059, backlog e sessao lidos.
- Ferramentas usadas/checadas:
  - Serena MCP: `initial_instructions`, overview/diagnosticos.
  - `artificio-api-governance`: rota `GET /api/v1/tables/{slug}` confirmada no bundle.
  - `codebase-memory-mcp`: disponivel; projeto indexado = `C-projetos-artificio`.
  - `rtk`: funciona com executaveis (`git`, `rg`), mas nao resolve builtin PowerShell `Get-Content`; fallback documentado = PowerShell direto para leitura local.
- Escopo autorizado pelo mantenedor nesta retomada: implementar somente Fase 1.
- Plano de edicao: expor `t.age_rating` no detalhe publico `GET /api/v1/tables/:slug`, tipar `age_rating` em `TableDetail`, rodar validacoes pontuais e API governance.
- Implementacao Fase 1 concluida:
  - `apps/mesas/backend/src/routes/tables.ts`: detalhe publico `GET /api/v1/tables/:slug` agora seleciona `t.age_rating`.
  - `apps/mesas/frontend/src/types/tables.ts`: `TableAgeRating` criado e `TableDetail.age_rating` tipado.
  - `docs/api/generated/api-inventory.generated.json` e `api-map.generated.md`: offsets de linha atualizados por `pnpm verify:api` apos a linha nova em `tables.ts`.
- Validacao:
  - Serena LSP: sem diagnosticos em `routes/tables.ts` e `types/tables.ts`.
  - `pnpm --filter @artificio/mesas-backend run build` ✅.
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
  - `pnpm verify:api` ✅; `api:diff` sem breaking, `mesas` com 2 non-breaking/offsets gerados.
  - `pnpm --filter @artificio/mesas-frontend run lint` ✅.
  - `pnpm --filter @artificio/mesas-backend run lint` nao existe (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`); coberto por `pnpm run lint` repo-wide ✅.
  - `git diff --check` ✅.
  - `pnpm run lint` ✅.
  - `pnpm run build` ✅.
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto para Fases 2-7.

## Retomada Codex — Fase 2 — 2026-07-08

- Escopo autorizado pelo mantenedor: implementar Fase 2 somente.
- Skill caveman lida e aplicada.
- Descoberta local:
  - `@artificio/mesas-frontend` tem `vitest run`.
  - Nao ha helper clipboard compartilhado; uso atual e direto em `MestreContactMethods.tsx`.
  - `TableDetail` tem campos suficientes para formatter puro; teste pode usar fixture minima tipada.
- Plano de edicao:
  - criar `apps/mesas/frontend/src/features/table/share/whatsappAnnouncement.ts`;
  - criar `buildWhatsAppTableAnnouncement()` e `copyTextToClipboard()` com fallback;
  - cobrir formatter/clipboard com Vitest;
  - validar com teste pontual + lint/build frontend.
- Implementacao Fase 2 concluida:
  - `whatsappAnnouncement.ts` criado com formatter puro, normalizacao Markdown/HTML para texto simples, labels humanos, URL publica e seções do template.
  - `copyTextToClipboard()` criado com Clipboard API + fallback `textarea`/`document.execCommand('copy')`.
  - `whatsappAnnouncement.test.ts` cobre mesa completa, mesa parcial, horarios multiplos, `age_rating`, paga/gratuita, sanitizacao e clipboard.
- Validacao:
  - Serena LSP retornou diagnostico stale dizendo que `TableDetail.age_rating` nao existia, mas `rg`, `tsc` e build confirmaram o tipo real atualizado.
  - `pnpm --filter @artificio/mesas-frontend run test -- src/features/table/share/whatsappAnnouncement.test.ts` ✅; script rodou suite frontend inteira (15 arquivos / 157 testes).
  - `pnpm --filter @artificio/mesas-frontend run lint` ✅.
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
  - `git diff --check` ✅.
  - `pnpm run lint` ✅.
  - `pnpm run build` ✅.
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto para Fases 3-7.

## Retomada Codex — Fase 3 — 2026-07-08

- Escopo autorizado pelo mantenedor: implementar Fase 3 somente.
- Implementacao Fase 3 concluida:
  - `CopyAnnouncementButton.tsx` criado; recebe `TableDetail`, monta texto com `buildWhatsAppTableAnnouncement`, usa `getMesasPublicOrigin()` e copia com fallback.
  - `TableActionPanel` ganhou prop opcional `announcementTable?: TableDetail`.
  - Visitante (`variant="full"`) ve `Copiar anuncio` abaixo do CTA principal.
  - Owner/admin (`variant="owner"`) ve `Copiar anuncio` no bloco `Gerenciamento`, depois de `Editar mesa`.
  - `MesaPage.tsx` passa `announcementTable={table}`.
  - Consumidores sem `TableDetail` seguem sem botao por prop opcional.
- Acessibilidade/UX:
  - botao `type="button"`;
  - `aria-label` com titulo da mesa;
  - estado `disabled`/`Copiando...`;
  - feedback por toast: `Anuncio copiado.` / `Nao foi possivel copiar o anuncio.`
- Validacao parcial:
  - Serena LSP sem diagnosticos em `CopyAnnouncementButton.tsx`, `TableActionPanel.tsx`, `MesaPage.tsx`.
  - `pnpm --filter @artificio/mesas-frontend run lint` ✅.
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
- Validacao final:
  - `git diff --check` ✅.
  - `pnpm run lint` ✅.
  - `pnpm run build` ✅.
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto para Fases 4-7.

## Retomada Codex — Fase 4 — 2026-07-08

- Escopo autorizado pelo mantenedor: implementar Fase 4 somente.
- Plano de edicao:
  - reaproveitar `CopyAnnouncementButton` com carregamento sob demanda (`loadTable`);
  - inserir acao no `TableCardDashboard` apenas para `status === 'active'` e `!archived`;
  - buscar `GET /api/v1/tables/:slug` no clique, validar detalhe ativo/nao arquivado no botao e copiar sem refetch do painel.
- Implementacao Fase 4 concluida:
  - `CopyAnnouncementButton` agora aceita `loadTable`, `disabled`, `ariaLabel` e `label`, mantendo compatibilidade com uso direto por `table`.
  - `TableCardDashboard` renderiza `Copiar anuncio` como acao `col-span-2` somente para mesas ativas e nao arquivadas.
  - O clique no card usa `authGet('/api/v1/tables/:slug')`, extrai `data`, delega montagem/copia ao helper da Fase 2 e mostra toast via `CopyAnnouncementButton`.
  - A validacao final do detalhe (`status === 'active'` e sem `archived_at`) fica no botao reutilizavel, protegendo corrida entre lista e clique.
- Validacao parcial:
  - Serena LSP sem diagnosticos em `CopyAnnouncementButton.tsx` e `TableCardDashboard.tsx`.
- Validacao final:
  - `pnpm --filter @artificio/mesas-frontend run lint` ✅.
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
  - `git diff --check` ✅.
  - `pnpm run lint` ✅.
  - `pnpm run build` ✅.
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto para Fases 5-7.

## HANDOFF — 2026-07-08 (fim de sessão, publicação de mesa sincronizada)

**Contexto:** duas frentes rodaram em paralelo nesta sessão — spec 059
(este arquivo, Fases 1-5 concluídas por outro agente/Codex) e spec 060
(gestão de mesas importadas, aberta por mim depois de investigar 3
bugs reais reportados pelo mantenedor no fluxo de sync Discord → mesa
publicada). Ambas tocam os mesmos arquivos (`ConteudoSection.tsx`
principalmente), então o diff local no fim da sessão está misturado.

### Estado real no fim da sessão

**Branch:** `fix/mesas-draft-publish-flow`.
**PR #137** (spec 060, infra de gestão admin): já MERGED em `dev`
(commit `867f523`), promovida pra `main`, **deploy prod já rodou com
sucesso** (run `28954221364`) e beta também (run `28954185363`).

**O que falta pro mantenedor conseguir publicar a mesa sincronizada
(o pedido original que abriu a spec 060) ainda está em diff LOCAL, sem
commit:** botão "Publicar mesa" de verdade dentro do modal do draft
(`DiscordDraftPreview.tsx`), no mesmo padrão visual dos outros botões
(Reparsar/Rebaixar imagem/Salvar campos/Sincronizar como mesa). Chama
`PUT /api/v1/admin/tables/:id { status: 'active' }` direto no clique.

Validado com dry-run real contra Postgres de produção
(`BEGIN`/`UPDATE`/`ROLLBACK`, nada persistido) na mesa real do
mantenedor (`3c05fafb-2749-47a7-ba70-469099d3d863`, "A Caçada
Espectral") — UPDATE passa sem violar nenhum CHECK constraint.

**Diff local do fim da sessão mistura as duas specs.** Não fazer
`git add -A` cego — revisar antes de commitar: `DiscordDraftPreview.tsx`
é spec 060 (botão publicar); `CopyAnnouncementButton.tsx`,
`features/table/share/`, `routes/tables.ts`, `TableCardDashboard.tsx`,
`MesaPage.tsx`, `types/tables.ts` são spec 059 (Fases 1-5, já com `[x]`
nas tasks abaixo).

### Duas specs precisam terminar e ter deploy

- **Spec 059** (`specs/059-mesas-copiar-anuncio-whatsapp-og/`): Fases
  0-5 concluídas (`tasks.md` marcado `[x]`). Faltam **Fase 6 (Open
  Graph, `routes/og.ts`, `type==='mesas'`)** e **Fase 7 (validação
  final: build, testes, `verify:api`, smoke beta)**.
- **Spec 060** (`specs/060-mesas-gestao-mesas-importadas/`): backend +
  listagem admin já em prod. Falta commitar o botão "Publicar mesa"
  (acima) e fechar T7/T8/T9 da `tasks.md` (lint+build final, smoke
  manual completo, atualizar backlog/project-state).

### Próximos passos
1. T0 completo antes de agir (`project-state.md` + `context-capsule.md`
   + `decisions.md`) — regra pétrea, não pular.
2. Revisar diff local misturado, separar por spec se necessário.
3. Pedir autorização nominal pra commit+push do botão publicar (spec
   060) — autorização de sessões anteriores não vale mais.
4. Deploy beta → smoke manual real (clicar "Publicar" na mesa
   `3c05fafb-...`) → promote main → **deploy prod real e confirmado**
   (`gh run list --workflow=deploy.yml --branch=main`, trava pétrea já
   registrada em `AGENTS.md` nesta sessão: promote NÃO deploya
   sozinho).
5. Retomar Fase 6/7 da spec 059 (OG de mesa).
6. Atualizar `specs/backlog.md` + `project-state.md` conforme
   resultado das duas.

### Ferramentas/regras a seguir na retomada
- **T0 obrigatório** antes de qualquer ação de mérito; T1 (`AGENTS.md`
  completo, `infra-map.md`) sob demanda quando a tarefa tocar
  infra/deploy/banco/API/specs.
- **Caveman ultra** como modo padrão de comunicação.
- **Ordem de ferramentas MCP** (AGENTS.md): (1)
  `artificio-api-governance` pra qualquer pergunta/mudança de API —
  nunca assumir rota por memória; (2) LSP pra diagnóstico automático
  dos arquivos tocados (mas Serena LSP já deu diagnóstico "stale" nesta
  sessão — confirmar sempre com `tsc`/build real antes de confiar
  cegamente); (3) Serena MCP pra navegação/edição por símbolo; (4)
  `codebase-memory-mcp` pra grafo/impacto estrutural; (5)
  `ast-grep`/`rtk rg`/`rtk read`/`git`/leitura direta como fallback.
- **Nunca commit/push/merge/deploy sem autorização nominal por ação**
  — não acumula entre sessões nem dentro da mesma sessão.
- **Trava pétrea registrada em `AGENTS.md` nesta sessão:** promote
  dev→main nunca dispara deploy prod sozinho.

---

## Retomada Codex — Fase 5 — 2026-07-08

- Escopo autorizado pelo mantenedor: implementar Fase 5 somente.
- Cuidado de worktree:
  - `ConteudoSection.tsx` ja tinha alteracoes pre-existentes nao feitas nesta fase: aba por URL, label `Mesas` e troca da fonte para `GET /api/v1/admin/tables` (spec 060).
  - A implementacao preservou essas alteracoes e trabalhou sobre o codigo real.
- Plano de edicao:
  - preservar `slug` em `AdminTableRow`/`normalizeTables`;
  - adicionar row action `Copiar anuncio` na tabela de gestao;
  - buscar detalhe publico `GET /api/v1/tables/:slug` no clique, montar/copy com helper da Fase 2, sem `fetchAllTables()` apos copiar.
- Implementacao Fase 5 concluida:
  - `AdminTableRow` ganhou `slug: string`; `normalizeTables()` preserva `row.slug` ou usa string vazia.
  - `ConteudoSection` ganhou `copyingTableId` e `handleCopyAnnouncement(table)`.
  - Row action `Copiar anuncio` usa icone `Copy`, aparece apenas quando `table.status === 'active'` e ha `slug`.
  - Handler busca detalhe publico por slug, valida `detail.status === 'active'` e `!detail.archived_at`, monta com `buildWhatsAppTableAnnouncement()` e copia com `copyTextToClipboard()`.
  - Copiar nao refaz lista e nao usa rota admin de detalhe.
- Observacao:
  - A fonte atual da gestao e `GET /api/v1/admin/tables` por mudanca pre-existente/spec 060; essa lista nao retorna `archived_at`. A protecao contra arquivada fica na validacao do detalhe publico antes da copia.
- Validacao parcial:
  - Serena LSP sem diagnosticos em `ConteudoSection.tsx`.
- Validacao final:
  - `pnpm --filter @artificio/mesas-frontend run lint` ✅.
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
  - `git diff --check` ✅.
  - `pnpm run lint` ✅.
  - `pnpm run build` ✅.
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto para Fases 6-7.

## t0Handoff — 2026-07-08 (topo de retomada)

**Ler isto primeiro, antes de qualquer T0 formal.** Resumo do estado
real pra não perder tempo re-descobrindo.

### Estado real

- **Spec 059** (`specs/059-mesas-copiar-anuncio-whatsapp-og/`): Fases
  1-5 prontas, feitas por outro agente em paralelo (Codex). Faltam:
  - **Fase 6** — OG de mesa (`apps/mesas/backend/src/routes/og.ts`,
    tratar `type === 'mesas'`, banner/cover como `og:image`, ver
    investigação detalhada em `## Atualizacao Fase 6 — 2026-07-08`
    acima).
  - **Fase 7** — validação final (build, testes, `verify:api`, smoke
    beta).
- **Spec 060** (`specs/060-mesas-gestao-mesas-importadas/`): infra já
  em prod — PR #137 merged em `dev` (`867f523`), promovido pra `main`,
  deploy prod confirmado (`28954221364`) e beta (`28954185363`).
  **Mas o botão "Publicar mesa" que resolve o pedido original do
  mantenedor ainda está em diff LOCAL, sem commit** —
  `DiscordDraftPreview.tsx`, chama
  `PUT /api/v1/admin/tables/:id { status: 'active' }`. Dry-run real
  validado contra Postgres prod (`BEGIN`/`UPDATE`/`ROLLBACK`, nada
  persistido) na mesa `3c05fafb-2749-47a7-ba70-469099d3d863`.

### Aviso crítico — diff misturado

**Não fazer `git add -A` cego.** Diff local no fim da sessão mistura
as duas specs:
- Spec 060 (botão publicar): `DiscordDraftPreview.tsx`.
- Spec 059 (Fases 1-5, já `[x]` na tasks): `CopyAnnouncementButton.tsx`,
  `features/table/share/`, `routes/tables.ts`,
  `TableCardDashboard.tsx`, `MesaPage.tsx`, `types/tables.ts`.

Revisar e separar por spec antes de qualquer commit.

### Próximos passos ordenados

1. T0 completo (`project-state.md` + `context-capsule.md` +
   `decisions.md`) — regra pétrea, não pular.
2. Revisar diff local misturado, separar por spec.
3. Pedir autorização nominal pra commit+push do botão publicar (spec
   060) — autorização de sessões anteriores não vale mais.
4. Deploy beta → smoke manual real (clicar "Publicar" na mesa
   `3c05fafb-...`) → promote main → **deploy prod real confirmado**
   (`gh run list --workflow=deploy.yml --branch=main`).
5. Retomar Fase 6/7 da spec 059 (OG de mesa).
6. Atualizar `specs/backlog.md` + `project-state.md` conforme
   resultado das duas.

### Regras T0/T1/caveman/ordem MCP a seguir

- T0 obrigatório antes de ação de mérito; T1 (`AGENTS.md` completo,
  `infra-map.md`) sob demanda quando tocar infra/deploy/banco/API/specs.
- Caveman ultra é modo padrão de comunicação.
- Ordem MCP (`AGENTS.md`): (1) `artificio-api-governance` pra
  API — nunca assumir rota por memória; (2) LSP pra diagnóstico
  automático (mas já deu diagnóstico stale nesta sessão — confirmar
  sempre com `tsc`/build real); (3) Serena MCP pra símbolo; (4)
  `codebase-memory-mcp` pra grafo/impacto; (5) `ast-grep`/`rtk
  rg`/`rtk read`/`git`/leitura direta como fallback.
- Nunca commit/push/merge/deploy sem autorização nominal por ação —
  não acumula entre sessões nem dentro da mesma sessão.
- **Trava pétrea (registrada em `AGENTS.md` nesta sessão):** promote
  dev→main NUNCA dispara deploy prod sozinho. Depois de promote
  aprovado, sempre disparar e confirmar deploy prod manual antes de
  declarar "em produção".

## Retomada Claude — Fase 6 — 2026-07-08

- T0 completo lido (`project-state.md`, `context-capsule.md`,
  `decisions.md`).
- Escopo autorizado pelo mantenedor: implementar Fase 6 (OG de mesa)
  somente. Investigação já estava pronta em `tasks.md` (Fase 6, feita
  em sessão anterior) — reaproveitada sem re-investigar do zero.
- Implementacao em `apps/mesas/backend/src/routes/og.ts`:
  - Import `sanitizePublicImageUrl` de `utils/publicImageUrl.ts`.
  - Helpers novos: `toAbsoluteSiteUrl()`, `resolveOgImageUrl()`
    (sanitiza + upgrade Google + absolutiza, fallback
    `DEFAULT_OG_IMAGE`), `isImportedTableExpired()` (mesma regra de
    `routes/tables.ts`: 5 dias ou `starts_at`, o que vencer primeiro),
    `buildTableDescription()` (prioridade `listing_excerpt` →
    `synopsis_narrative` → `synopsis` → `description` → fallback
    titulo/sistema/mestre).
  - Branch `else if (type === 'mesas')` adicionado antes do fallback
    generico: query direta (sem HTTP interno, mesmo padrao do caso
    `mestre`) trazendo `slug/title/description/banner_url/status/
    archived_at/origin/created_at/starts_at/listing_excerpt/synopsis/
    synopsis_narrative/system_name/gm_display_name`.
  - Visibilidade: `status==='active' && !archived_at &&
    !isImportedTableExpired()`; se nao visivel, HTML fallback 200
    "Mesa não encontrada" (nunca JSON 404, pois crawler precisa HTML).
  - `og:image` = `resolveOgImageUrl(banner_url, cover_url)`; `og:type`
    = `website`; canonical = `${SITE_URL}/mesas/${slug}`.
- Validacao:
  - `pnpm --filter @artificio/mesas-backend run build` ✅ (`tsc`
    limpo).
  - `pnpm run lint` ✅ (15/15 pacotes).
  - `pnpm run build` ✅ (17/17 pacotes).
  - `pnpm verify:api` ✅ (mesas non-breaking=2, offsets de linha; sem
    breaking; 3 warnings pre-existentes em glossario, fora de escopo).
  - `git diff --check` ✅ (sem whitespace error).
  - **T6.3 nao fechada:** smoke real (`curl -A "WhatsApp"`) contra
    mesa existente/sem imagem/inexistente exige beta/prod com dado
    real; build/tsc validam tipo, nao comportamento runtime. Fica
    para Fase 7 (T7.5) ou deploy beta.
- `tasks.md` Fase 6 atualizado: T6.1/T6.2/T6.4 `[x]`; T6.3 aberta com
  nota de motivo.
- Sem commit/push — diff local, ainda misturado com spec 060
  (`DiscordDraftPreview.tsx` nao tocado nesta fase).
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto
  para Fase 7 (validacao final + smoke beta real, cobre T6.3).

## Retomada Claude — Fase 7 — 2026-07-08

- Escopo perguntado ao mantenedor: T7.5 (smoke beta real) exige
  deploy, que exige commit+push+PR (diff local ainda misturado com
  spec 060). Mantenedor escolheu **so validacao local agora**, sem
  commit/push/deploy nesta acao.
- Validacao final (T7.1-T7.4):
  - `pnpm --filter @artificio/mesas-frontend run build` ✅.
  - `pnpm --filter @artificio/mesas-backend run build` ✅ (`tsc`
    limpo).
  - `pnpm --filter @artificio/mesas-frontend run test` ✅ — 15
    arquivos / 157 testes.
  - `pnpm --filter @artificio/mesas-backend run test` ✅ — 42
    arquivos / 420 testes (stderr sao logs esperados de mock/erro
    simulado, nao falha real).
  - `pnpm verify:api` ja rodado na Fase 6: mesas non-breaking=2
    (offsets de linha), sem breaking.
  - `git diff --check` ✅ (so avisos LF/CRLF pre-existentes de config
    git, sem erro real de whitespace).
- `tasks.md`: T7.1/T7.2/T7.3/T7.4 `[x]`. **T7.5 aberta e bloqueada**:
  smoke beta real (`curl -A "WhatsApp"` etc.) exige deploy fora do
  escopo autorizado nesta acao.
- Sem commit/push — diff local segue intacto, ainda misturado com
  spec 060 (`DiscordDraftPreview.tsx`).
- Backlog: nada novo; `BL-059-MESAS-COPIAR-ANUNCIO-OG` segue aberto
  **so por T7.5** (smoke beta). Fases 0-7 com validacao local completa;
  falta so deploy+smoke real pra fechar a spec 059 de verdade.
- Proximo passo (fora desta acao): mantenedor decidir quando
  autorizar commit+push+PR (separando diff da spec 060) pra liberar
  deploy beta e fechar T7.5.

## Retomada Codex — Sonar fixes — 2026-07-08

- Pedido do mantenedor: corrigir achados Sonar sem commit.
- Escopo: `apps/mesas/frontend/src/features/table/components/TableActionPanel.tsx` e `apps/mesas/frontend/src/features/table/share/whatsappAnnouncement.ts`.
- Plano:
  - reduzir Cognitive Complexity de `TableActionPanel` extraindo JSX/decisoes repetidas para helpers/componentes locais;
  - trocar regexes com risco de backtracking em `whatsappAnnouncement.ts` por parsing linear ou regex simples;
  - substituir fallback com `document.execCommand('copy')` por alternativa sem API obsoleta;
  - validar com testes/lint/build pontuais e, se necessario, repo-wide.
- Implementacao:
  - `TableActionPanel.tsx`: `TableActionPanel` virou orquestrador curto; JSX/decisoes repetidas extraidas para helpers locais (`PricePanel`, `QuickInfoPanel`, `PlatformsPanel`, `ManagementPanel`, `VisitorPreview`, etc.).
  - `whatsappAnnouncement.ts`: `stripAngleBrackets`, markdown links e colapso de linhas em branco agora usam parsing linear; removido fallback `document.execCommand('copy')`.
  - `whatsappAnnouncement.test.ts`: teste de clipboard atualizado para API moderna e erro explicito quando indisponivel.
- Validacao:
  - `pnpm --filter @artificio/mesas-frontend run build` passou.
  - `apps/mesas/frontend/node_modules/.bin/vitest.cmd run src/features/table/share/whatsappAnnouncement.test.ts` passou: 1 arquivo / 5 testes.
  - `apps/mesas/frontend/node_modules/.bin/eslint.cmd src/features/table/components/TableActionPanel.tsx src/features/table/share/whatsappAnnouncement.ts src/features/table/share/whatsappAnnouncement.test.ts` passou.
  - `git diff --check` passou.
  - `rg` nao encontrou mais `execCommand` nem os padroes regex antigos em `whatsappAnnouncement.ts`/teste.
- Bloqueios fora do escopo:
  - `pnpm --filter @artificio/mesas-frontend run lint` ainda falha em `DiscordDraftPreview.tsx:160` (`react-hooks/set-state-in-effect`), diff local preexistente da spec 060.
  - `pnpm --filter @artificio/mesas-frontend run test` ainda falha em 4 testes de `DiscordDraftPreview.test.tsx` por mock sem `authGet`, tambem ligado ao diff local preexistente da spec 060.
  - Sem backlog novo: o problema ja esta coberto no handoff/spec 060 desta mesma sessao como diff local misturado pendente.
