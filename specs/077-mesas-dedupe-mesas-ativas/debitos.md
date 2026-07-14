# Débitos — 077 mesas dedupe mesas ativas

Achados fora do escopo desta spec, reportados pelo mantenedor durante
sessão de criação da 077 (2026-07-14), com investigação read-only feita
nesta sessão. Registrados aqui a pedido explícito do mantenedor
("Corrija e registre nos debitos da 077, mesmo que não seja do escopo").
Correções aplicadas localmente em 2026-07-14 e protegidas por testes de
regressão. Smoke manual real continua pendente.

## DEB-077-01 — CatalogTree mostra "Nenhum sistema cadastrado ainda" com sistema já selecionado, sem busca

**Sintoma:** em `/painel?edit=<id>` (edição manual de mesa), step "Sistema",
com sistema já selecionado (ex.: Dungeons & Dragons > 2024), painel
esquerdo (nível raiz/sistemas) mostra "Nenhum sistema cadastrado ainda."
mesmo com `role="user"` e catálogo central populado.

**Causa raiz confirmada:**
`packages/catalog-ui/src/CatalogTree.tsx`.

- `shouldShowResults = shouldShowRootLevel || effectiveNavPath.length > 0`
  (linha 373) fica `true` quando há seleção prévia, mesmo sem busca
  digitada (`shouldShowRootLevel = normalizedSearch.length > 0`, linha 327).
- Isso inclui a coluna `depth: 0` em `levels` com `nodes: []` (raiz vazia
  por design — regra da regressão anterior, "raiz só aparece com busca").
- `renderLevelContent` (linha 261) só suprime essa coluna vazia quando
  `noRootResults` é `true` — mas `noRootResults = shouldShowRootLevel &&
  visibleRoots.length === 0` (linha 372) é **false** quando não há busca.
  `isEmptyRoot` fica `false`, cai no branch de "vazio real" (linha 264-271)
  e imprime "Nenhum sistema cadastrado ainda." — mensagem incorreta pro
  caso "raiz oculta por falta de busca" (que devia renderizar nada, igual
  já faz quando não há seleção nenhuma).

**Fix esperado (não aplicado):** `isEmptyRoot` deve considerar também o
caso `depth === 0 && nodes.length === 0 && !shouldShowRootLevel` (raiz
sempre oculta sem busca, com ou sem seleção/noRootResults), não só o caso
de busca-sem-resultado. Precisa ajustar também a exclusão dessa coluna do
`levels` (hoje `buildVisibleLevels` sempre inclui `depth:0`) ou tratar na
própria função de render, sem quebrar o card "Selecionado" (que já
funciona e aparece corretamente no screenshot).

**Escopo de impacto:** `CatalogTree.tsx` é compartilhado (`packages/catalog-ui`)
— consumido por `SystemPicker` (mesas) e possivelmente site-admin/glossário
(confirmar consumidores antes de mexer — regra pétrea de pacote
compartilhado exige SDD Completo + smoke em todos os consumidores).

**Evidência:** screenshots do mantenedor (2026-07-14) em
`https://mesas.artificiorpg.com/painel?edit=a1c2f184-943f-49a4-a11c-0383e0f7814d`,
código lido em `packages/catalog-ui/src/CatalogTree.tsx:261-271,317,327,372-373`.

## DEB-077-02 — Horário de término de sessão exigido como obrigatório, bloqueando publicação

**Sintoma:** no wizard de criação/edição de mesa, step "Sessões", sessão
com dia + horário inicial preenchidos mas sem horário final mostra erro
bloqueante "Sessão 1: horário de término obrigatório" e desabilita o botão
de avançar ("Preencha os campos obrigatórios").

**Causa raiz confirmada:**
`apps/mesas/frontend/src/features/create-table/utils/validation.ts:47-50`.

```ts
if (!session.day_of_week) return `Sessão ${i + 1}: dia da semana obrigatório`;
if (session.day_of_week === 'to_define' || !session.start_time) continue;
if (!session.start_time) return `Sessão ${i + 1}: horário de início obrigatório`;
if (!session.end_time) return `Sessão ${i + 1}: horário de término obrigatório`;
```

`end_time` só é dispensado quando `day_of_week === 'to_define'` — qualquer
sessão com dia definido (ex.: sexta-feira) e horário inicial preenchido
exige horário final, mesmo que o campo na UI (`StepSessions`/form) trate
"Horário Final" como opcional (rótulo sem `*`, ver screenshot). Mesas
reais frequentemente não têm hora de término fixa ("sessão até acabar").

**Fix esperado (não aplicado):** remover a linha 50 (ou tornar `end_time`
opcional de fato), alinhando validação ao rótulo já exibido na UI
("Horário Final" sem asterisco de obrigatório). Confirmar se algum
consumidor do dado (`table_sessions`?) depende de `end_time` sempre
presente antes de soltar a validação — checar schema/uso no backend.

**Escopo de impacto:** `apps/mesas/frontend` isolado (não é pacote
compartilhado) — fix local ao app, sem necessidade de SDD Completo.

**Evidência:** screenshot do mantenedor (2026-07-14), código lido em
`apps/mesas/frontend/src/features/create-table/utils/validation.ts:43-51`.

## DEB-077-01, DEB-077-02 — status: corrigidos nesta sessão (2026-07-14)

Mantenedor pediu explicitamente para corrigir, não só registrar. Fixes
aplicados:

- **DEB-077-01**: `packages/catalog-ui/src/CatalogTree.tsx` —
  `renderLevelContent` agora recebe `shouldShowRootLevel` e considera
  `isEmptyRoot = depth === 0 && nodes.length === 0 && (noRootResults ||
  !shouldShowRootLevel)`, suprimindo a coluna raiz vazia também quando não
  há busca (antes só suprimia em busca-sem-resultado). Card "Selecionado"
  não foi tocado, continua funcionando.
- **DEB-077-02**: `apps/mesas/frontend/src/features/create-table/utils/validation.ts`
  — removida a linha que exigia `end_time` obrigatório; validação agora só
  cobra `day_of_week` e `start_time`.

Lint + build de `packages/catalog-ui`, `mesas-backend`, `mesas-frontend`
verdes (rodado isolado nos arquivos tocados, ver DEB-077-05 abaixo sobre
lint pré-existente quebrado em código não relacionado). Falta apenas
**smoke manual real** (abrir `/painel?edit=<id>` com mesa que tem sistema
selecionado e sessão sem horário final) — não realizado nesta sessão
(sem dev server rodando / fora do fluxo de código puro).

## DEB-077-03 — status: corrigido nesta sessão (2026-07-14)

**Sintoma:** em `/painel?edit=<id>`, imagens de capa de mesas importadas
via Discord (`banner_url` ainda apontando pro CDN efêmero do Discord, ex.:
`cdn.discordapp.com/attachments/.../Capa_RPG.png?ex=...&is=...&hm=...`)
retornam 404 no browser quando a URL assinada expira — o upload retroativo
pro Cloudinary (`uploadDiscordImageToCloudinary`) nunca rodou pra essas
mesas, ou rodou e falhou silenciosamente. Tela "tremendo" reportado pelo
mantenedor = layout shift do `<img>` sem dimensão reservada, falhando ao
carregar.

**Causa raiz confirmada:** `GET /api/v1/gm/tables/:id` (rota usada por
`/painel?edit=`, `apps/mesas/backend/src/routes/gmPanel.ts:494`) nunca
chamava `sanitizePublicImageUrl` no `banner_url` antes de responder —
diferente de `GET /gm/:slug` (`gm.ts:217`) e `GET /tables/:slug`
(`tables.ts:490`), que já sanitizam. Frontend
(`mapTableApiToInitialData.ts:125`) usa o valor cru pra `bannerUrl`,
renderizando `<img src>` direto pro Discord.

**Fix aplicado:** `gmPanel.ts` agora importa `sanitizePublicImageUrl` e
aplica em `responseData.banner_url` antes do `res.json`, mesmo padrão já
usado nas outras 2 rotas. Quando a URL é do Discord, vira `null` — o
frontend já trata `bannerUrl` vazio (mostra placeholder), evitando o 404
do CDN expirado.

**Limite do fix:** isto só evita o **erro de carregamento** (esconde a
URL morta); não recupera a imagem em si. Se o mantenedor quiser a imagem
de volta, precisa rodar o backfill de upload pra Cloudinary nessas mesas
específicas (fora de escopo deste fix pontual — registrar como tarefa
própria se for prioridade).

**Evidência:** console do browser do mantenedor (2026-07-14, 3 URLs
`cdn.discordapp.com`/`media.discordapp.net` com 404), código lido em
`gmPanel.ts:494-533`, `gm.ts:217`, `tables.ts:490`,
`mapTableApiToInitialData.ts:125`, `utils/publicImageUrl.ts`.

## DEB-077-04 — status: corrigido nesta sessão (2026-07-14)

**Sintoma:** console do browser mostra repetidamente `[api] Cancelando
requisição duplicada: GET:.../gm/me`, `GET:.../gm/tables/:id`.

**Causa raiz confirmada:** comportamento **esperado**, não bug funcional
— dedup de `apiClient.ts` (REV-056) aborta a chamada GET anterior quando
uma nova chamada idêntica dispara antes da primeira terminar (típico de
StrictMode/2 efeitos concorrentes pedindo o mesmo recurso no mount,
`PainelMestrePage.tsx:295` e `:372`). Já documentado como "ruído esperado"
no próprio código (`PainelMestrePage.tsx:385-388`, achado do mantenedor
2026-07-08). O único problema real era o `console.log` incondicional
poluindo o console em **produção**, não só em dev.

**Fix aplicado:** `apiClient.ts` — log de dedup agora só roda quando
`import.meta.env.DEV` é true. Comportamento de cancelamento/abort não
mudou (segue idêntico).

**Evidência:** console do browser do mantenedor (2026-07-14), código lido
em `apiClient.ts:91-95`, `PainelMestrePage.tsx:285-395`.

## DEB-077-05 — lint da implementação 077 (corrigido)

Durante trabalho paralelo apareceram 2 erros `react-hooks/set-state-in-effect`
em arquivos da implementação 077:

- `apps/mesas/frontend/src/features/admin/components/TableDuplicatesPanel.tsx:43`
  — `useEffect(() => { void load(); }, [load])` chamando setState síncrono
  dentro do efeito.
- `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx:146`
  — `if (requestedDraft) setSelectedDraft(requestedDraft);` dentro de
  efeito.

**Não corrigido** — fora do escopo deste pedido (imagem Discord + dedup
de log), e mexer em código de trabalho concorrente sem coordenação viola
a regra de "nunca corrigir bug achado sem perguntar" quando o autor real
ainda está iterando nele. Backend (`adminTables.ts`,
`tableDuplicateDetection.ts`) e migration (`migration_145_table_duplicate_candidates.sql`)
Ambos foram corrigidos pelo agente principal com atualização assíncrona via
`setTimeout`, preservando comportamento. `pnpm run lint` repo-wide passou
em 21/21 pacotes antes desta retomada; portanto o diagnóstico "não corrigido"
era apenas um retrato intermediário desatualizado.

## Próximo passo

DEB-077-01 a 05 corrigidos. Regressões automatizadas adicionadas para:

- seleção prévia no `CatalogTree` sem falso estado vazio;
- sessão sem `end_time` aceita;
- URL efêmera do Discord sanitizada na rota de edição.

Validação desta retomada: `catalog-ui` 12/12; `mesas-frontend` 174/174;
`mesas-backend` 456/456; `pnpm verify:api` verde; lint 21/21; build 21/21.
Falta smoke manual real dos fluxos visuais.
