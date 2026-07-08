# 059 — Tasks

> Copiar anuncio WhatsApp + OG de mesa. SDD Completo. Sem commit/push/PR/merge/deploy sem autorizacao nominal propria.

## Fase 0 — Decisao

- [x] T0.1 Registrar decisoes do mantenedor: sistema = `system_name` somente; setting/DDAL vao na descricao; inscricoes = so link da mesa; campos vazios ficam vazios; humano nao deve editar.
- [x] T0.2 Aprofundar faixa etaria: `age_rating` existe em DB/tipos/pipeline; falta expor em `GET /api/v1/tables/:slug`/`TableDetail`; nao usar `audience`.
- [x] T0.3 Decidir comissionada: `price_type=paga` = "Comissionada" somente na saida copiar/colar; codigo/API/DB continuam `paga`; detalhes financeiros em "Sobre a Mesa".
- [x] T0.4 Registrar decisao final neste arquivo e na sessao. **Fase 0 encerrada.**

## Fase 1 — Contrato de dados

### Descobertas da investigacao

- `age_rating` existe no modelo material:
  - `apps/mesas/backend/src/db/types.ts` tipa `tables.age_rating` como `'livre' | '+10' | '+12' | '+14' | '+16' | '+18' | null`.
  - `apps/mesas/backend/src/hydration/config.ts` inclui `age_rating` na hidratacao de `tables`.
  - `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` extrai `age_rating`.
  - `apps/mesas/backend/src/discord/syncHelpers.ts` normaliza e grava `age_rating` em `tables`.
- Gap real nao e ausencia de dado; e contrato publico/frontend:
  - `apps/mesas/backend/src/routes/tables.ts` seleciona `t.audience`, mas nao seleciona `t.age_rating` no detalhe `GET /api/v1/tables/:slug`.
  - `apps/mesas/frontend/src/types/tables.ts` nao tem `age_rating` em `TableDetail`.
  - Nao usar `audience` como classificacao indicativa. `audience` continua sendo outro conceito.
- Lista publica:
  - `GET /api/v1/tables` filtra `t.status = active` e `t.archived_at is null`.
  - A lista publica nao precisa receber `age_rating`, porque copiar anuncio em card/painel/gestao deve buscar detalhe por `slug` no clique.
- Painel do mestre:
  - `GET /api/v1/gm/tables` retorna `slug` e muitos campos, mas nao seleciona `t.age_rating`.
  - Rota de edicao `GET /api/v1/gm/tables/:id` usa `TableRepository.findByIdAndGm()` com `selectAll('t')`, entao ja inclui `age_rating`, mas o formato e de edicao, nao de anuncio publico.
  - Decisao: no card do painel, buscar detalhe publico `/api/v1/tables/:slug` antes de copiar, sem ampliar contrato GM.
- Gestao:
  - `ConteudoSection.tsx` usa `authGet('/api/v1/tables')`, portanto a aba "Mesas publicadas" ja opera somente em mesas publicas/ativas.
  - `AdminTableRow` hoje guarda `id`, `title`, `status`, `created_at`, `is_covil`; falta preservar `slug` que ja vem da lista publica.
  - Nao existe `GET /api/v1/admin/tables/:id`; admin tem apenas `PUT /api/v1/admin/tables/:id`, `DELETE /api/v1/admin/tables/:id` e `POST /api/v1/admin/tables/batch`.
  - Decisao do mantenedor: copiar anuncio na gestao sera sempre apenas para mesas publicadas/ativas. Logo, nao criar rota admin de detalhe.
- OpenAPI/API governance:
  - `docs/api/openapi/mesas.openapi.yaml` declara `/api/v1/tables/{slug}` com response generica `additionalProperties: true`, mas a mudanca de campo ainda altera contrato real.
  - Se `age_rating` entrar no detalhe publico, rodar `pnpm verify:api` e atualizar artefatos gerados quando houver diff.
- Consequencia fechada para implementacao:
  - Fase 1 implementavel minima = adicionar `t.age_rating` em `GET /api/v1/tables/:slug` + `age_rating` em `TableDetail`.
  - Nao adicionar rota admin nova.
  - Nao adicionar `age_rating` na lista publica nem em `GET /api/v1/gm/tables`, salvo se a implementacao provar necessidade nova.

- [ ] T1.1 Expor `age_rating` em `GET /api/v1/tables/:slug`.
- [ ] T1.1a Tipar `age_rating` em `TableDetail`.
- [ ] T1.1b Rodar API governance se OpenAPI/contrato mudar.
- [x] T1.2 Fechar decisao: `/gestao` copia somente mesas publicadas/ativas; sem rota admin de detalhe para mesas nao ativas/canceladas.
- [ ] T1.3 Atualizar OpenAPI/artefatos se API mudar.

## Fase 2 — Formatter/clipboard

### Descobertas da investigacao

- Escopo ideal do formatter:
  - Criar util puro em `apps/mesas/frontend/src/features/table/share/whatsappAnnouncement.ts`.
  - Entrada principal deve ser `TableDetail` cru, nao `TableViewModel`, porque o anuncio precisa de campos que o view model nao carrega ou nao tipa ainda (`age_rating`, `synopsis`, `ddal_*`, `billing_text`, `session_zero_free`, `scenario_name`, `setting_name`, etc.).
  - `TableViewModel` pode orientar fallback humano, mas nao deve virar contrato do formatter.
- Origem/link publico:
  - Ja existe `getMesasPublicOrigin()` em `apps/mesas/frontend/src/utils/auth.ts`, com prioridade `VITE_PUBLIC_SITE_URL` -> `VITE_API_URL` -> `window.location.origin` -> `MODULE_ORIGINS.mesas`.
  - Formatter deve receber `origin`/`publicOrigin` por parametro ou usar helper de origem no caller; linha "Inscricoes" deve gerar URL absoluta `/mesas/:slug`.
- Clipboard:
  - Uso atual encontrado: `apps/mesas/frontend/src/components/mestre/MestreContactMethods.tsx` chama `navigator.clipboard.writeText(contact.value)` direto, sem fallback e sem `await`.
  - Nao existe helper compartilhado de copiar texto no frontend.
  - Implementar helper local da feature: tenta `navigator.clipboard.writeText`; se falhar/indisponivel, usa `textarea` temporario + `document.execCommand('copy')`.
  - Helper deve ter guards para ambiente sem `navigator`/`document` para teste/build.
- Texto Markdown/HTML:
  - Campos longos (`description`, `synopsis`, `style_text`, `benefits_text`, `table_gm_bio`, `billing_text`, `technical_requirements`, `ddal_rules_notes`) podem vir de `MarkdownEditor`.
  - `MarkdownEditor` armazena markdown cru e preview renderiza HTML via `markdown-it`; paginas publicas exibem muito texto com `whitespace-pre-wrap`, sem conversao.
  - Para WhatsApp, nao despejar markdown tecnico pesado. Formatter deve normalizar texto para plain text legivel:
    - remover tags HTML;
    - converter links markdown `[texto](url)` para `texto: url` ou `url`;
    - remover marcadores de titulo/codigo/blockquote quando forem apenas sintaxe;
    - preservar quebras de paragrafo uteis;
    - colapsar excesso de linhas em branco.
- Labels/enums humanos:
  - `type`: `campanha` -> `Campanha`, `one-shot` -> `One-shot`, `oneshot-serie` -> `Serie de one-shots`, `aberta` -> `Mesa aberta`.
  - `price_type`: `gratuita` -> `Gratuita`; `paga` -> `Comissionada` somente no texto do anuncio.
  - `age_rating`: `livre` -> `Livre`; demais valores ficam `+10`, `+12`, `+14`, `+16`, `+18`.
  - `modality`: `online` -> `Online`; `presencial` -> `Presencial`; `hibrida` -> `Hibrida`.
  - `experience_level` nao substitui faixa etaria; pode entrar em "Sobre a Mesa" se util.
  - `price_frequency` enum real no backend: `sessao`, `mes`, `campanha`; se usado em detalhes financeiros, rotular como `por sessao`, `por mes`, `por campanha`.
- Horarios:
  - `TableSchedule` tem `day_of_week`, `start_time`, `end_time`, `frequency`, `notes`, `sort_order`.
  - UI atual (`TableSchedules`) exibe cada schedule como `dia` + `start_time - end_time` + frequencia.
  - Formatter deve ordenar por `sort_order` quando existir; formatar multiplos horarios unidos por `; `.
  - Se nao houver schedules, usar `schedule_day_status`/`schedule_time_status` com `schedule_day_hint`/`schedule_time_hint`.
  - Se indefinido e a linha precisa ficar vazia por decisao do mantenedor, nao inserir "A combinar" na saida final.
- Conteudo do anuncio:
  - `Sinopse`: prioridade `synopsis_narrative` -> `synopsis` -> `description`.
  - `Sobre o Mestre`: prioridade `table_gm_bio` -> `gm_bio_long`; se ambos vazios, manter secao vazia.
  - `Sobre a Mesa`: agregado rotulado, em ordem sugerida:
    - `description` quando nao foi usado como Sinopse;
    - `benefits_text`;
    - `style_text`;
    - `setting_name`/`scenario_name`/`setting_styles`;
    - `level_range`, `experience_level`;
    - detalhes DDAL (`ddal_code`, `ddal_name`, `ddal_tier`, `ddal_season`, `ddal_duration`, `ddal_format`, `ddal_org_code`, `ddal_setting`, `ddal_rules_notes`);
    - cobranca (`billing_text`, `price_value`, `price_frequency`, `session_zero_free`);
    - requisitos (`technical_requirements`, `requires_pc`, `requires_camera`, `requires_microphone`);
    - seguranca (`content_warnings`, `safety_tools`).
  - Linha `Sistema` e cabecalho usam somente `system_name`, conforme decisao do mantenedor.
- Campos vazios/sanitizacao:
  - Manter labels e secoes mesmo sem conteudo; valor vazio depois de `:`.
  - Texto final nao pode conter placeholders, `[Nome da mesa]`, `{...}`, `undefined`, `null`, `NaN`.
  - Cuidado: "sem colchetes" da spec significa remover placeholders do modelo; links markdown com colchetes tambem devem ser convertidos para plain text.
- Testes recomendados:
  - Util puro com Vitest, arquivo ao lado do formatter (`whatsappAnnouncement.test.ts`).
  - Casos minimos: mesa completa; mesa parcial com campos vazios; multiplos horarios; `price_type=paga` -> `Comissionada`; `price_type=gratuita` -> `Gratuita`; sanitizacao markdown/HTML; ausencia de `undefined/null/NaN`/placeholders; URL absoluta de inscricao.
  - Clipboard helper pode ter teste unitario com mocks de `navigator.clipboard`, fallback `document.execCommand` e falha final, se implementado separado.

- [ ] T2.1 Criar `whatsappAnnouncement.ts` com `buildWhatsAppTableAnnouncement`.
- [ ] T2.2 Criar helper de clipboard com fallback.
- [ ] T2.3 Cobrir formatter com testes: completo, parcial, horarios multiplos, paga/gratuita, sem `undefined/null/NaN`.

## Fase 3 — Pagina publica

### Descobertas da investigacao

- Composicao atual da pagina:
  - `apps/mesas/frontend/src/pages/MesaPage.tsx` carrega `TableDetail` cru em `table`, calcula `vm` via `useTableViewModel(table)` e renderiza a sidebar com `TableActionPanel`.
  - Visitante recebe `TableActionPanel` com `variant="full"`.
  - Dono/admin vendo a pagina publica recebe `TableActionPanel` com `variant="owner"` e `deleteEndpointScope` `gm`/`admin`.
  - `canManage` hoje e calculado por `table.gm_user_id === user.id` ou `user.role === 'admin'`.
- Ponto de insercao recomendado:
  - Criar `CopyAnnouncementButton` em `apps/mesas/frontend/src/features/table/components/CopyAnnouncementButton.tsx`.
  - O componente deve receber `table: TableDetail`, nao `TableViewModel`, porque o formatter da Fase 2 precisa campos crus como `age_rating`, `synopsis`, `billing_text`, `ddal_*`, `setting_name`, `scenario_name`.
  - `TableActionPanel` deve ganhar prop opcional `announcementTable?: TableDetail`.
  - `MesaPage` passa `announcementTable={table}` ao `TableActionPanel`.
  - Se `announcementTable` estiver ausente, `TableActionPanel` nao renderiza o botao; isso preserva consumidores que so tem `TableViewModel`.
- Onde renderizar no painel:
  - Modo publico (`variant="full"`): inserir botao "Copiar anuncio" logo abaixo do CTA primario e antes da urgencia/preco. E uma acao de divulgacao, nao contato direto.
  - Modo owner/admin (`variant="owner"`): inserir botao dentro do bloco "Gerenciamento", preferencialmente depois de "Editar mesa" e antes de acoes de status/desativacao.
  - Nao inserir no sticky CTA mobile nesta fase; o sticky atual e conversao do visitante (`handleCTA`) e ficaria confuso com uma acao secundaria de divulgacao.
- Consumidores e risco de quebra:
  - `TableActionPanel` tambem e usado por `features/table/TableView.tsx` sem `TableDetail`; com prop opcional, continua funcionando sem botao.
  - `features/master/components/MasterTables.tsx` usa `TableActionPanel vm={table} variant="compact"`, mas `TableActionPanel` hoje nao tem branch `compact`; cai no modo publico. Nao corrigir/refatorar isso na Fase 3, apenas garantir que a nova prop opcional nao quebre esse fluxo.
  - Fase 4 (`TableCardDashboard`) e outro componente e deve buscar detalhe por `slug` antes de copiar; nao pertence a Fase 3.
- UX/acessibilidade:
  - Usar icone `Copy` ou `Clipboard` de `lucide-react` junto do texto; projeto ja usa lucide e `MestreContactMethods.tsx` usa `Copy`.
  - Botao deve ter `type="button"`, `aria-label` claro (`Copiar anuncio da mesa ${table.title}`), estado `disabled` enquanto copia, e texto/icone de loading simples.
  - Feedback deve usar toast existente (`react-hot-toast` ou `utils/toast.ts`): sucesso "Anuncio copiado." e erro "Nao foi possivel copiar o anuncio.".
  - Como o texto copiado tem emoji/acentos e o repositorio mostra varios arquivos com mojibake antigo, manter codigo novo em ASCII quando possivel, mas strings visiveis podem seguir PT-BR sem emojis se o arquivo ja estiver sensivel a encoding.
- Comportamento esperado:
  - Clique chama `buildWhatsAppTableAnnouncement(table, { publicOrigin })` ou equivalente da Fase 2, depois `copyTextToClipboard`.
  - Origem publica deve vir de `getMesasPublicOrigin()` no caller/componente, nao de concat manual.
  - Botao nao deve navegar, abrir WhatsApp nem expor modal; apenas copiar para area de transferencia.

- [ ] T3.1 Criar `CopyAnnouncementButton`.
- [ ] T3.2 Inserir botao em `/mesas/:slug` para visitante.
- [ ] T3.3 Inserir botao no modo owner/admin de `TableActionPanel`.
- [ ] T3.4 Validar responsividade e a11y basica (`aria-label`, disabled/loading).

## Fase 4 — Painel do mestre

### Descobertas da investigacao

- Superficie atual:
  - `apps/mesas/frontend/src/pages/PainelMestrePage.tsx` renderiza o painel do mestre e passa cada item para `apps/mesas/frontend/src/components/TableCardDashboard.tsx`.
  - `TableCardDashboard` e componente legado em `src/components`, nao em `features/master/components`.
  - O card ja recebe `table.slug`, `table.status`, `table.archived`, `title`, `system_name`, `modality`, imagem e metricas; portanto nao precisa alterar rota GM apenas para ter slug.
- Contrato da lista GM:
  - `GET /api/v1/gm/tables` em `apps/mesas/backend/src/routes/gmPanel.ts` lista mesas do mestre sem filtro de `status` nem `archived_at`.
  - A rota retorna `active`, `cancelled`, `ended` e arquivadas; o card explicitamente trata `cancelled`/`ended` como inativas e mostra badge de arquivada.
  - Apesar do titulo visual "Suas mesas publicadas", essa lista nao equivale ao catalogo publico. Nao usar a presenca no painel como autorizacao para copiar anuncio.
- Decisao aplicada nesta fase:
  - O botao de copiar no painel do mestre deve aparecer/ficar habilitado somente para `table.status === 'active'` e `!table.archived`.
  - Mesas `cancelled`, `ended`, `draft`, `pending_review`, `full` ou arquivadas nao devem copiar anuncio a partir do painel. Se a UI optar por mostrar botao desabilitado, o motivo deve ser claro e nao deve chamar API.
  - Isso implementa a decisao do mantenedor: copiar sempre apenas mesas publicadas/ativas.
- Busca de detalhe:
  - Mesmo com varios campos ricos ja vindos de `GET /api/v1/gm/tables`, o formatter deve usar `TableDetail` publico por consistencia com pagina publica/gestao e para receber `age_rating` depois da Fase 1.
  - No clique, buscar `GET /api/v1/tables/:slug` usando `authGet` ou `api.get`, validar `response.ok`, extrair `data`, montar com `buildWhatsAppTableAnnouncement`, copiar e mostrar toast.
  - Nao usar `GET /api/v1/gm/tables/:id` para anuncio: essa rota e contrato de edicao, exige auth do dono e nao representa a URL publica que o usuario vai compartilhar.
- Risco descoberto no detalhe publico:
  - `GET /api/v1/tables/:slug` hoje busca por slug e so aplica regra especial de expiracao para importadas; nao filtra explicitamente `t.status = active` nem `t.archived_at is null`.
  - A lista publica `GET /api/v1/tables` filtra `t.status = active` e `t.archived_at is null`, mas o detalhe publico nao replica esse filtro.
  - Para Fase 4, a protecao minima e dupla: render/disable pelo resumo do card e, apos buscar detalhe, recusar copiar se `detail.status !== 'active'` ou `detail.archived_at` estiver preenchido.
  - Endurecer a rota publica de detalhe para retornar 404 em inativas/arquivadas pode ser desejavel, mas muda comportamento de `/mesas/:slug` e deve ser tratado como decisao/escopo proprio se for alem do botao de copiar.
- Estado por card:
  - `PainelMestrePage` ja mantem estados por ID para toggle/delete/archive (`togglingTableId`, `deletingTableId`, `archivingTableId`).
  - Seguir o padrao com `copyingAnnouncementTableId: string | null` no pai ou estado local no card. Preferencia: estado no pai se o handler de busca/copia ficar no pai; estado local se criar componente `CopyAnnouncementButton` reutilizavel.
  - Evitar refetch automatico de todas as mesas apos copiar; copia nao muta dados.
- Ponto de insercao visual:
  - `TableCardDashboard` tem grid de acoes `grid grid-cols-2 gap-2` com Editar, Ativar/Desativar, Arquivar e Deletar.
  - Inserir "Copiar anuncio" como acao secundaria de largura total (`col-span-2`) acima de Arquivar/Deletar ou logo depois de Editar/Desativar.
  - Usar icone `Copy`/`Clipboard` de `lucide-react` se o padrao visual permitir; manter `type="button"`, `disabled` enquanto copia ou quando a mesa nao e copiavel.
- Erros/feedback:
  - Sucesso: `Anuncio copiado.`
  - Falha de rede/404/inativa/arquivada: `Nao foi possivel copiar o anuncio.`
  - Se mesa estiver inativa/arquivada no card, preferir nao renderizar o botao ou renderizar desabilitado com `title`; nao exibir toast de erro antes do usuario clicar.
- Tipos:
  - `MyTableEnhanced` existe duplicado/local em `PainelMestrePage.tsx` e `TableCardDashboard.tsx`.
  - Implementacao pode manter o tipo local para escopo pequeno, mas se o handler de copiar for criado no pai e passado como prop, o tipo deve aceitar `onCopyAnnouncement?: (table: MyTableEnhanced) => Promise<void> | void` e `isCopyingAnnouncement?: boolean`.
  - Nao criar abstracao compartilhada grande so para esta fase, salvo se a implementacao da Fase 5 provar repeticao real.
- Testes/validacao recomendados:
  - Unit/component test se ja houver harness acessivel para `TableCardDashboard`: botao aparece para active nao arquivada, nao aparece/desabilita para `cancelled`/`ended`/arquivada, chama handler com a mesa correta.
  - Teste do handler pode mockar `authGet`, formatter e clipboard; caso mais importante e garantir que nao copia quando o detalhe retornado nao esta ativo.
  - Smoke manual depois da implementacao: painel com mesa ativa copia; mesa desativada/arquivada nao oferece copia.

- [ ] T4.1 Adicionar botao em `TableCardDashboard`.
- [ ] T4.2 Buscar detalhe por slug antes de copiar.
- [ ] T4.3 Tratar loading/erro/toast por card.

## Fase 5 — Gestao

### Descobertas da investigacao

- Superficie atual:
  - A aba fica em `apps/mesas/frontend/src/features/admin/components/ConteudoSection.tsx`, `CatalogTab = 'tables'`, label `Mesas publicadas`.
  - A tabela e renderizada pelo componente generico `AdminTable` em `apps/mesas/frontend/src/features/admin/components/ui/AdminTable.tsx`.
  - `AdminTable` e apresentacional/controlado para dados, mas controla busca/filtros/seleção/`busy` de bulk internamente.
- Fonte de dados:
  - `ConteudoSection.fetchAllTables()` chama `authGet('/api/v1/tables')`.
  - Esta rota e a lista publica; em `apps/mesas/backend/src/routes/tables.ts`, ela filtra `t.status = active` e `t.archived_at is null`.
  - Logo, por decisao do mantenedor, a gestao ja parte da fonte correta para copiar: apenas mesas publicadas/ativas do catalogo publico.
- Gap real:
  - `AdminTableRow` hoje tem apenas `id`, `title`, `status`, `created_at`, `is_covil`.
  - `/api/v1/tables` ja retorna `slug`, mas `normalizeTables()` descarta esse campo.
  - A Fase 5 precisa preservar `slug` em `AdminTableRow` e descartar/ignorar linhas sem `slug` valido para a acao de copiar.
- Rotas admin:
  - `apps/mesas/backend/src/routes/adminTables.ts` tem:
    - `POST /api/v1/admin/tables/auto-archive`;
    - `POST /api/v1/admin/tables/batch`;
    - `PUT /api/v1/admin/tables/:id`;
    - `DELETE /api/v1/admin/tables/:id`.
  - Nao existe `GET /api/v1/admin/tables/:id`, e a spec ja decidiu nao criar rota admin de detalhe.
  - Admin deve buscar detalhe publico `GET /api/v1/tables/:slug` antes de copiar, igual painel do mestre.
- Busca de detalhe/copia:
  - Handler recomendado em `ConteudoSection`: `handleCopyAnnouncement(table: AdminTableRow)`.
  - Fluxo: validar `table.slug`; buscar `GET /api/v1/tables/${table.slug}`; se response ok, extrair `data`; validar `detail.status === 'active'` e `!detail.archived_at`; montar com `buildWhatsAppTableAnnouncement`; copiar com helper da Fase 2; toast.
  - Mesmo vindo da lista publica, manter validacao do detalhe por defesa contra corrida: admin pode cancelar/arquivar uma mesa em outra aba entre listagem e clique.
  - Nao chamar `fetchAllTables()` apos copiar; copia nao muta dados.
- Estado/UX no `AdminTable`:
  - `AdminTableRowAction` suporta `hidden?: (row) => boolean`, mas nao suporta `disabled` nem loading por linha.
  - Opcoes viaveis:
    - adicionar `copyingTableId` em `ConteudoSection` e esconder a acao enquanto `copyingTableId === table.id`, seguindo padrao de `AdminUsersPanel`;
    - ou deixar a acao sempre visivel e bloquear reentrada dentro do handler.
  - Preferencia: `copyingTableId` + guarda no handler. Nao ampliar `AdminTable` para suportar disabled/loading agora, porque isso muda componente compartilhado da gestao sem necessidade.
- Ponto de insercao:
  - Adicionar row action antes das acoes destrutivas/status:
    - `key: 'copy-announcement'`;
    - `label: 'Copiar anuncio'`;
    - `icon: <Copy size={15} />` ou `Clipboard`;
    - `hidden: (table) => !table.slug || copyingTableId === table.id`.
  - Manter `Ativar/cancelar`, `Alternar Covil`, `Apagar` como estao.
  - Como a aba ja e "Mesas publicadas", nao criar bulk action de copiar. Bulk clipboard seria ambigua e pouco util.
- Erros/feedback:
  - Sucesso: `Anuncio copiado.`
  - Sem slug: `Nao foi possivel copiar o anuncio.`
  - 404/erro fetch/mesa nao ativa apos detalhe: `Nao foi possivel copiar o anuncio.`
  - Evitar mensagem tecnica para admin, mas registrar erro em `console.error` se o padrao local permitir.
- Tipagem:
  - `AdminTableRow.slug` deve ser `string`.
  - `normalizeTables()` so deve incluir `slug` quando `typeof row.slug === 'string'`; se a linha tiver `id` mas nao tiver slug, pode manter `slug: ''` para preservar tabela e esconder acao.
  - `searchKeys` pode continuar `['title', 'status']`; adicionar slug a busca e opcional, nao requerido para a feature.
- Testes/validacao recomendados:
  - Teste unitario de `normalizeTables` se existir harness facil; principal caso: preserva `slug`.
  - Teste de handler com mocks: busca `/api/v1/tables/:slug`, chama formatter/clipboard, nao refaz lista, mostra toast de sucesso.
  - Teste/checagem para linha sem slug: acao escondida ou handler falha com toast sem chamada de detalhe.
  - Smoke manual: `/gestao/catalogo` -> aba `Mesas publicadas` -> row action copia texto; apos cancelar/arquivar em outra aba, clique deve falhar de modo limpo.

- [ ] T5.1 Adicionar `slug` em `AdminTableRow` e normalizador.
- [ ] T5.2 Adicionar row action "Copiar anuncio" em `ConteudoSection`.
- [ ] T5.3 Buscar detalhe por slug antes de copiar.
- [x] T5.4 Rota admin nova descartada: gestao copia apenas mesas publicadas/ativas.

## Fase 6 — Open Graph

- [ ] T6.1 Implementar caso `type === 'mesas'` em `apps/mesas/backend/src/routes/og.ts`.
- [ ] T6.2 Usar banner/imagem da mesa como `og:image`, fallback default.
- [ ] T6.3 Testar mesa existente, mesa sem imagem e mesa inexistente/fallback.
- [ ] T6.4 Verificar que tags OG/Twitter duplicadas continuam removidas.

## Fase 7 — Validacao

- [ ] T7.1 `pnpm --filter @artificio/mesas-frontend run build`.
- [ ] T7.2 `pnpm --filter @artificio/mesas-backend run build`.
- [ ] T7.3 Testes pontuais frontend/backend afetados.
- [ ] T7.4 `pnpm verify:api` se contrato/API mudar.
- [ ] T7.5 Smoke beta: copiar em pagina publica, painel do mestre e gestao; verificar OG por `curl`/view-source.

## Manutencao documental

- [x] T8.1 Criar spec/plan/tasks/reviews/debitos.
- [x] T8.2 Atualizar `specs/backlog.md`.
- [x] T8.3 Atualizar `specs/README.md`.
- [x] T8.4 Atualizar `.specify/memory/project-state.md`.
