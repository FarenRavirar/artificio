# 26-07-13_1 — mesas: draft importado, 7 achados (investigação)

**App/projeto:** mesas
**Gate:** D (ativo)
**Objetivo:** investigar 7 achados reportados pelo mantenedor no fluxo de draft de mesa importada (Discord). Sem corrigir ainda — só investigar e reportar causa provável de cada um.

## Vínculos

- Segue linha de `26-07-10_1_mesas_parser-importacao-4-bugs.md` (4 bugs de parser já investigados, aguardando decisão de codar).
- Relacionado a `26-07-08_3_mesas_prod-bugs-publicacao-anuncio.md` (bugs pós-deploy specs 059/060).
- PR #155 (cascata catálogo) e fix OG/WAF Cloudflare concluídos na sessão anterior (não documentados em arquivo próprio — fechados via chat).

## Achados reportados (prints + texto do mantenedor, 2026-07-13)

1. **Nome do sistema truncado na árvore/label** — no draft de `mascaras-de-nyarlathotep-mrjizmnn`, aparece só "7e" em vez do nome completo com edição+variante.
2. **Mesa já vinculada a um sistema não permite editar o vínculo clicando nela** — falta ação/botão de editar entre "Salvar campos" e "Sincronizar como mesa" no draft.
3. **Sincronizar mesa já publicada volta ela pro estado draft** — deveria detectar "já publicada anteriormente" e oferecer algo tipo "republicar", não recriar/resetar pra draft.
4. **Draft de mesa importada não tem campo de Dia/Hora** — campo existe no draft manual nativo, ausente no importado.
5. **PATCH 400 ao definir frequência "outra"** — `PATCH /api/v1/admin/discord/drafts/:id` retorna 400 Bad Request. Regressão funcional ativa (usuário não consegue salvar).
6. **Parser não dispara corretamente a pergunta de interpretação quando é "4/5"** (mecanismo já existe pro caso "8/10" — modal "Como interpretar X/Y deste post?").
7. **Parser corrompe CDN e título da mesa** — print mostra título extraído como `cdn discordapp com attachments 1094047...` (literalmente a URL do CDN do Discord, sanitizada/quebrada, virou o título da mesa) em vez do nome real do evento.

## Plano

Investigar cada achado: ler código relevante (parser, drafts route/service, DraftEditorTab, SystemPicker/CatalogTree label rendering, sync-to-mesa logic), achar causa raiz com file:line, sem alterar código. Reportar tudo nesta sessão antes de decidir o que vira fix agora vs spec formal.

## Checklist de fechamento (desta fase de investigação)

- [x] Achado 1 — causa raiz identificada
- [x] Achado 2 — causa raiz identificada
- [x] Achado 3 — causa raiz identificada
- [x] Achado 4 — investigado, não reproduz no código atual (pendente reconfirmação com mantenedor)
- [x] Achado 5 — causa raiz identificada (payload do PATCH 400)
- [x] Achado 6 — causa raiz identificada
- [x] Achado 7 — causa raiz identificada
- [ ] `specs/backlog.md` atualizado (ou motivo de não atualizar)
- [ ] Decisão do mantenedor: corrigir agora vs registrar débito, por achado

## Causa raiz por achado (investigação concluída 2026-07-13)

**Achado 1 — Nome "7e" em vez do sistema completo (CORRIGIDO — não é parser)**
Investigação inicial (parser) estava ERRADA — descartada. Causa real: card público mostra badge de sistema com só o nome do nó FOLHA da hierarquia (edição), não o path completo.
- `apps/mesas/backend/src/services/catalogClient.ts`, função `hydrateTableSystemFields` (linhas 282-304), linha 297: `system_name: node?.name ?? null` — usa só `node.name` do nó vinculado (`table.system_id` aponta pra folha "7ª Edição"/"7e" dentro de Call of Cthulhu), sem subir `parent_id` e compor com o sistema pai.
- `system_path` (linha 299, `node.path_slug`) já tem o path completo em slug (ex: `call-of-cthulhu/7-edicao`), mas é slug, não nome legível, e não é usado pra montar label.
- `toMesasNode` (linhas 317-339) não guarda cadeia de nomes ancestrais — só `name`/`name_pt`/`path_slug` (slug) do próprio nó.
- Frontend (`TableCard.tsx:162-167` + `SystemBadge.tsx:32`) só exibe o que vier em `table.system_name`, sem lógica própria — é puramente apresentacional, bug 100% no backend.
- "Feiticeiros & Maldições" aparece certo por coincidência: esse sistema não tem hierarquia edição/variante, o nó vinculado É o nome completo do sistema.
- **Fix direction:** `hydrateTableSystemFields`/`toMesasNode` precisam subir a cadeia `parent_id` e compor nome de exibição (ex: "Call of Cthulhu 7ª Edição" ou "Call of Cthulhu · 7ª Edição") em vez de só `node.name` da folha.

**Achado 2 — Sem editar vínculo já selecionado**
`apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx:341-357` — `<SystemPicker>` não recebe `onEdit`. Sem essa prop, `CatalogTree` (`packages/catalog-ui/src/CatalogTree.tsx:200-210`) nunca renderiza o botão de editar por nó. Agravante: `showEmptySearchResults={false}` (linha 355) + `shouldShowRootLevel` (`CatalogTree.tsx:326`) escondem o nível raiz de sistemas quando já há seleção e busca vazia — dá pra trocar edição/variante dentro do mesmo sistema, mas não trocar o sistema. Bloco "Selecionado" (`CatalogTree.tsx:480-517`) só tem botão "Limpar seleção" (zera tudo), sem `onClick` pra reabrir em modo edição.

**Achado 3 — Ressync de mesa publicada volta pra draft**
`apps/mesas/backend/src/discord/syncHelpers.ts:566-600` (`syncDraftToTable`, branch de UPDATE quando já existe `existingTable`). Linha 576: `status: 'draft'` setado incondicionalmente no UPDATE, sem checar status atual da mesa (`existingTable` só seleciona `id`, nem traz `status`). Toda ressincronização reseta pra draft, mesmo se estava `published`.

**Achado 4 — Draft importado sem opção "a definir" (dia/hora) — reconfirmado pelo mantenedor, investigação completa fim a fim**

Correção do achado inicial: campo Dia/Hora existe no draft (achado 4 original estava certo em dizer que existe), mas falta a opção **"a definir"** (sentinela de indefinido) que o formulário manual de mesa tem. Mantenedor confirmou via print: falta tanto pra Dia quanto pra Hora, e pediu investigação fim a fim — "não só exibir, mas funcionar também".

**Camada 1 — UI/tipo no draft (falta):**
- Formulário de referência com o padrão "a definir": `apps/mesas/frontend/src/components/SessionRepeater.tsx`
  - Select dia com opção sentinela `to_define`: linha 23 (`{ value: 'to_define', label: 'Dia da semana a definir' }`), tipo `SessionSchedule['day_of_week']` inclui `'to_define'` (linha 6), render linhas 141-154.
  - Checkbox "Horário a definir": linhas 186-195 (`checked={!session.start_time}`, ao marcar zera `start_time` pra `''`); input `type="time"` fica `disabled` quando vazio (linhas 196-202).
  - Usado no wizard de criação/edição manual via `StepSessions.tsx:1,25-29`. Exibição/validação relacionadas: `StepReview.tsx:40-41`, `validation.ts:41`, `TableSchedules.tsx:14-20` (público).
- `DraftEditorTab.tsx:402-414` (select dia): só os 7 dias fixos, sem `to_define`. Tipo `DraftDayOfWeek` (`draftFormUtils.ts:18`) é `'segunda'|...|'domingo'`, não inclui `'to_define'`.
- `DraftEditorTab.tsx:416-420` (horário): `<input>` de texto livre simples, sem checkbox associado, sem `disabled` condicional — não tem o padrão do `SessionRepeater`.

**Camada 2 — schema/persistência do campo "a definir" (existe, mas só pro lado manual):**
- Tabela `tables` já tem colunas dedicadas via `apps/mesas/database/migration_124_table_schedule_tbd.sql`: `schedule_day_status`/`schedule_time_status` (`CHECK IN ('defined','to_define')`, linhas 10-11,18-35), `schedule_day_hint`/`schedule_time_hint` (linhas 12-13,39-49). Consumido no frontend via `TableViewModel.scheduleDayStatus`/`scheduleTimeStatus`/etc (`TableSchedules.tsx:14-20`).
- No draft (nível de sessão), não existe boolean equivalente — é tudo codificado por valor sentinela direto em `day_of_week`/`start_time`, e o tipo do draft não aceita esse sentinela (camada 1).

**Camada 3 — sync draft→mesa (CONFIRMADO QUEBRADO, é o "não funciona" que o mantenedor pediu pra investigar):**
- `apps/mesas/backend/src/discord/syncHelpers.ts:26` — `VALID_DAYS` não inclui `'to_define'`. `isDayOfWeek()` (linha 33-35) rejeitaria esse valor.
- `syncHelpers.ts:62-68` — `isValidTime()` exige regex `^\d{2}:\d{2}(:\d{2})?$`; string vazia (`''`, usada como sentinela de "horário a definir") falha.
- `syncHelpers.ts:236-246` (função que monta sessões a partir do draft): linha 238 `if (!isDayOfWeek(day_of_week) || !start_time) return []` — **se o draft tivesse um valor "a definir", a sessão inteira seria descartada silenciosamente do sync**, sem erro visível. Zero ocorrência de `schedule_day_status`/`schedule_time_status`/`schedule_day_hint`/`schedule_time_hint` em `syncHelpers.ts` — o sync não sabe desses campos, não escreve neles em `tables` a partir do draft.
- Ou seja: mesmo implementando UI+tipo no draft (camadas 1-2), o sync ainda precisaria (a) aceitar os sentinelas em `isDayOfWeek`/`isValidTime` (ou lógica equivalente) sem descartar a sessão, e (b) mapear pra `schedule_day_status`/`schedule_time_status`/`schedule_day_hint`/`schedule_time_hint` em vez de tentar gravar em `day_of_week`/`start_time` da sessão como se fossem valores concretos.

**Escopo real do fix:** não é 1 campo de UI, é 3 camadas (tipo+UI do draft, payload/schema do PATCH de draft, mapeamento no sync pra `tables`). Maior que os outros achados — considerar spec própria (SDD Lite) em vez de fix pontual junto aos outros 6.

**Achado 5 — PATCH 400 com frequência "outra"**
Frontend: `DraftEditorTab.tsx:423-428` tem `<option value="outra">Outra</option>`; grava `'outra'` no form e envia cru em `draftFormUtils.ts:381` (`frequency: form.frequency`). O próprio frontend já trata `'outra'` como campo pendente (`draftFormUtils.ts:334,357` — entra em `missing`), mas envia mesmo assim.
Backend: `apps/mesas/backend/src/routes/inbox/utils.ts:21-26`, `patchDraftTableSchema.frequency` é `z.enum(['semanal','quinzenal','mensal','avulsa'])` — não inclui `'outra'`. `safeParse` falha em `discord/utils.ts:1018-1020` → 400. Enum duplicado e dessincronizado do canônico `SCHEDULE_FREQUENCIES` em `validators/tableValidators.ts:16`.

**Achado 6 — Parser não pergunta interpretação em "4/5"**
`apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`, cascata `extractSlots` (linha 546-564). Não é threshold numérico — é estrutural: `slotsAmbiguousSlash` (única função que popula `ambiguity` e dispara o modal) só é alcançada se nada antes na cascata `??` resolver primeiro, e só casa com padrão exato `vagas:/jogadores: N/M` (`RE_SLOT_AMBIG_SLASH`, linha 470). Variações de formatação (label depois do número, outro rótulo, etc.) caem em `slotsSlashVagas`/`slotsViaLabel`/outras, que resolvem sem marcar ambiguidade — comportamento idêntico pra "8/10" e "4/5", a variável real é o texto ao redor do número.

**Achado 7 — Parser corrompe título com fragmento de URL do CDN**
`parseDiscordAnnouncement.ts`, `splitThreadName` (linha 325-336) via fallback `body.split('\n')[0]` (linha 1491) quando não há thread_name. `indexOf(':')` (linha 326) acha o `:` de `https:` dentro da URL do CDN na mesma linha do heading (`# 🚔 [Fuga da Prisão] https://cdn.discordapp.com/...`), não um separador real. `beforeColon` (heading real, vira `systemHint` — descartado) e `afterColon` (URL, sobrevive ao `stripDecorativeMarkup` como `"cdn discordapp com attachments ..."`) — esse último vira o título. Causa: não existe detecção/remoção de URL antes de tentar achar separador `:`; a checagem de padrão "sistema: título" roda cega a URLs na mesma linha.

## Próximo passo

Aguardando decisão do mantenedor: corrigir agora (todos/alguns) ou registrar como débito em `specs/backlog.md`, por achado.

## Decisão do mantenedor (2026-07-13)

"Corrigir tudo agora, 1 PR só" — autorizado. Branch `fix/mesas-draft-7-achados` criada a partir de `origin/dev` sincronizado.

## Decisão do mantenedor (2026-07-13, segunda rodada): "tem que corrigir todos"

Mantenedor rejeitou deixar achados 4 e 6 como débito e pediu correção completa dos 7. Forneceu `D:\teste.json` (100 mensagens reais exportadas do Discord) como fonte de evidência pro achado 6, e deu 2 orientações de produto:

1. **Frequência "outra":** perguntei se devia funcionar igual ao fluxo manual (persistir de verdade). Confirmado que sim — só que o form manual (`SessionRepeater.tsx`) **nunca teve** opção "outra" pra frequência (só os 4 valores reais do enum). Decisão: remover "outra" do draft, draft passa a espelhar exatamente o mesmo conjunto do form manual.
2. **Vagas N/M:** regra de interpretação correta é **maior número = total, menor = disponível**, independente de qual vem primeiro no texto. Decisão: aplicar como palpite pré-selecionado no modal, mas manter a pergunta de confirmação (não eliminar o modal).

## Correções implementadas (todas as 7, validadas)

- **Achado 1** (badge sistema mostra só folha): `apps/mesas/backend/src/services/catalogClient.ts` — nova função `composeSystemDisplayName` sobe `parent_id` e compõe nome completo (sistema + edição + variante), usada em `hydrateTableSystemFields`.
- **Achado 2** (sem editar vínculo já selecionado): `apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx` — `showEmptySearchResults={Boolean(form.system_id)}` no `SystemPicker`, permite ver nível raiz (sistemas) quando já há seleção, pra poder trocar o sistema vinculado sem precisar digitar busca.
- **Achado 3** (ressync reseta pra draft): `apps/mesas/backend/src/discord/syncHelpers.ts` — branch de UPDATE agora seleciona `status` atual da mesa e só força `'draft'` se ela já estava `'draft'`; preserva `active`/`full`/`cancelled`/`ended`/`pending_review`.
- **Achado 4** (dia/hora "a definir" ausente no draft) — **implementado fim a fim, 3 camadas:**
  - Camada 1 (UI/tipo do draft): `DraftEditorTab.tsx` — select de dia ganhou `<option value="to_define">`; horário ganhou checkbox "Horário a definir" (mesmo padrão de `SessionRepeater.tsx`, zera/desabilita o input). `draftFormUtils.ts` — `DraftDayOfWeek` inclui `'to_define'`; `validateForm`/`buildMissingFields` tratam `to_define`/horário vazio como válido (não pendente).
  - Camada 2 (payload/schema do PATCH): `apps/mesas/backend/src/routes/inbox/utils.ts` — `patchDraftTableSchema.day_of_week` aceita `'to_define'` no enum.
  - Camada 3 (sync, era o "não funciona" real): `syncHelpers.ts` — `validateDraftForSync` não bloqueia mais sync com `to_define`/horário vazio; `extractSchedules` não cria linha em `table_schedules` quando é "a definir" (coluna é `NOT NULL`, mesmo design do form manual — sessão real só existe quando dia+horário são concretos); `buildTableDraftFields` agora seta `schedule_day_status`/`schedule_time_status`/`schedule_day_hint`/`schedule_time_hint` em `tables` (migration_124, já existia mas nunca era populada pelo draft).
  - Testes novos: 3 em `syncHelpers.test.ts` (`extractSchedules`), 3 (`validateDraftForSync`), 2 (`buildTableData` — status/hint), 2 em `draftFormUtils.test.ts` (frontend). Todos verdes.
- **Achado 5** (PATCH 400 frequência "outra") — **implementado de forma diferente da 1ª tentativa**, seguindo orientação do mantenedor: em vez de mapear "outra"→`null`, a opção foi **removida** do draft (`DraftEditorTab.tsx` select, `DraftFrequency` type, `VALID_FREQUENCIES` em `draftFormUtils.ts`) — draft agora só oferece os 4 valores reais do enum, igual ao form manual. Teste ajustado pra usar valor fora do enum via cast em vez de `'outra'` (que não existe mais no tipo).
- **Achado 6** (parser não pergunta em "4/5") — **corrigido com evidência real** (`D:/teste.json`, 100 mensagens Discord reais). Testei `extractSlots` isolada (export temporário, removido depois) contra todos os 18 casos reais de padrão `N/M` no dataset — só 4/18 disparavam ambiguidade antes do fix. Causas raiz encontradas (múltiplas, não só 1):
  1. `RE_SLOT_AMBIG_SLASH` exigia label `vagas`/`jogadores` **imediatamente** antes do separador — não reconhecia label composto (`"Vagas Disponíveis: N/M"`, `"Vagas Ocupadas: N/M"`). Fix: aceita qualificador opcional (`disponíveis/disponível/ocupadas/ocupada`) entre o label e o separador.
  2. `RE_SLOT_OPEN`/`RE_SLOT_TOTAL` (rodam ANTES de `slotsAmbiguousSlash` na cascata) casavam só o primeiro número de `"Vagas Disponíveis: N/M"` e ignoravam o `/M` — resolviam silenciosamente como valor único em vez de deixar a forma ambígua chegar em `slotsAmbiguousSlash`. Fix: lookahead negativo `(?!\s{0,3}/\s{0,3}\d)` em ambas.
  3. `BULLETS` (símbolos decorativos no início de linha) não reconhecia bullets emoji (`📌`) nem símbolos como `»` — regex nunca casava a linha inteira nesses casos. Fix: generalizado pra `\p{S}\p{P}\p{Emoji_Presentation}\p{Extended_Pictographic}` (com flag `u`) em vez de listar caractere por caractere.
  - Resultado: 8/9 casos de ambiguidade genuína do dataset real agora disparam corretamente (1 caso residual, `"N° de Vagas: N/M"`, tem letras antes do label — fora do escopo de `BULLETS`, aceitável não cobrir).
  - **Regra de interpretação também corrigida** (orientação do mantenedor): `useDraftForm.ts` (`handleConfirmSlots`) usava `slotsAmbiguity.first` cru pra "preenchidas"/"abertas", dando resultado errado quando o maior número vinha primeiro no texto (`open=0` incorreto). Fix: usa `Math.min`/`Math.max` explicitamente — maior=total, menor=a outra metade, independente da ordem no texto. UI do modal (`DraftEditorTab.tsx`) atualizada pra exibir `min`/`max` em vez de `first`/`max`.
  - 3 testes novos em `parseDiscordAnnouncement.test.ts` cobrindo os 3 padrões reais corrigidos (label composto, bullet símbolo). 134 testes totais, todos verdes.
- **Achado 7** (título corrompido com URL do CDN): `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` — `splitThreadName` agora detecta URL inline (`RE_INLINE_URL`) e busca o separador `:` só na porção antes da URL, além de remover a URL do texto usado pra `afterColon`/fallback. Testado localmente com o caso real ("Fuga da Prisão" + link .mov) — título agora extrai corretamente.

## Validação final (todos os 7 achados corrigidos)

- `pnpm lint` (mesas-backend, mesas-frontend, catalog-ui): verde.
- `pnpm build` (mesas-backend, mesas-frontend, catalog-ui): verde.
- `pnpm verify:api`: verde (0 breaking changes; warnings pré-existentes não relacionados).
- `pnpm test` (mesas-backend, mesas-frontend, catalog-ui): verde — **449 testes backend** (43 arquivos, +8 novos), **172 testes frontend** (17 arquivos, +2 novos), 11 testes catalog-ui. `parseDiscordAnnouncement.test.ts` (134 testes, +3) e `syncHelpers.test.ts` (30 testes, +8) — nenhuma regressão na suíte existente.

## Pendências antes do PR

1. `specs/backlog.md` precisa ser atualizado: entrada `BL-MESAS-DRAFT-7ACHADOS` está desatualizada (registra achados 4/6 como débito aberto — agora estão corrigidos). Atualizar antes do commit.
2. Aguardando autorização nominal do mantenedor pra commit/push/PR (regra pétrea — cada ação exige aprovação própria).

## Critério de conclusão

Investigação completa = cada achado com file:line de causa provável reportado ao mantenedor. Fix só após autorização explícita por achado/lote.
