# Sessão 26-07-10_1 — Mesas: parser/importação, 7 bugs reportados pelo mantenedor

- **Data:** 2026-07-10
- **App/projeto:** mesas (backend + frontend, parser Discord / spec 058)
- **Gate:** D (mesas, já fechado — isto é débito pós-prod)
- **Vínculo:** spec 058 (parser learning + DeepSeek contextual), débito T11.10 (auditoria campo-a-campo pendente); sessão `26-07-08_3` tratou parcialmente o filtro de contato explícito.

## Contexto

Mantenedor segue testando importação real de anúncios Discord (screenshots de import ao vivo, sistema "2D6 WORLD"/Mothership/Gradiente Descendente). 4 problemas reportados, com prints como evidência. Pedido explícito: **registrar + investigar, sem codar ainda**.

## Os 4 bugs reportados (texto literal do mantenedor)

1. Sistema nitidamente "2D6 WORLD", mas foi reconhecido como "Mothership". Teve sugestão do learning, correta. Mas ao aplicar, não deu nada.
2. Título precisa de ferramenta para tirar capitalizações desnecessárias (ex.: "GRADIENTE DESCENDENTE 4 - Variáveis Im...").
3. Mesa estava com filtro "importar só mesas com contato confirmado" ativo, mas mesa foi importada sem ter contato (nem na descrição).
4. Descrição com muitos caracteres estranhos/inválidos, informação bugada.

## Investigação (sem código alterado)

### Bug 1 — sugestão do learning não aplica em `system_name`

Causa raiz localizada: [DraftEditorTab.tsx:341](apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx:341) usa `<FieldInsightNote field="system_name" onApply={onApplySuggestion} .../>` — o mesmo `onApplySuggestion` genérico usado por todos os outros campos.

[useDraftForm.ts:280-290](apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts:280) (`applySuggestion`) faz só `dispatch({SET_FIELD, key: field, value: asText})`. Para sistema, isso escreve `system_name` (string) no form, mas **não atualiza `system_id`** — o picker de sistema (`SystemPicker`) é vinculado a `system_id`, não ao texto. Prop docs do próprio componente confirmam o padrão certo já existe: `onSystemChange: (systemId, knownName?) => void` (linha 49-51), usado em outro fluxo (`SystemSuggestionModal`), mas `system_name` no `FieldInsightNote` não usa esse handler — usa o genérico de texto.

Resultado: clicar "Aplicar" na sugestão do learning-store para sistema escreve o nome mas não muda o vínculo real (`system_id` continua apontando pro sistema errado ou nenhum) — por isso "não deu nada" visualmente no picker.

**Fix provável:** `system_name` precisa de um `onApply` próprio que resolva `system_id` a partir do nome sugerido (buscar no catálogo carregado ou abrir fluxo de match), não o `onApplySuggestion` genérico de texto.

### Bug 2 — título sem normalização de capitalização

[parseDiscordAnnouncement.ts:1216-1220](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:1216) (`normalizeTitle`) só remove aspas + `stripDecorativeMarkup` (markdown/zero-width/emoji). Não há nenhuma normalização de caixa (title case, ou pelo menos detectar CAPS LOCK e corrigir). Título "GRADIENTE DESCENDENTE 4 - Variáveis Im..." passa raw.

**Fix provável:** adicionar heurística de normalização de capitalização em `normalizeTitle` — ex.: se título é majoritariamente caixa-alta (ex. >70% chars alfabéticos maiúsculos), converter para title-case PT-BR (cuidado com siglas/números como "2D6", "D&D" que não devem virar minúsculas).

### Bug 3 — filtro "contato confirmado" não bloqueia mesa sem contato real

Sessão `26-07-08_3` (bug 7 daquela sessão) já moveu `requireExplicitContact` de filtro visual pra opção real de importação, aplicado em [utils.ts:853](apps/mesas/backend/src/routes/discord/utils.ts:853):
```
if (requireExplicitContact && !parsed.table.contact_url && !(parsed.table.contact_discord && parsed.table.contact_discord_explicit)) {
  return discardParsedMessage(message, existing, parsed);
}
```
**Diagnóstico revisado (2026-07-10, antes de codar):** hipótese original (enrich sobrescreve `contact_discord` automaticamente) estava ERRADA. Lido `attachAiSuggestions`/`buildAiSuggestionFields` ([aiSuggestions.ts:16-60](apps/mesas/backend/src/discord/aiSuggestions.ts:16)): o enrich só ANEXA sugestões em `_ai_suggestions.fields` — nunca escreve direto no campo real do draft. O badge "IA" no campo é só a sugestão pendente de "Aplicar" (mesmo fluxo do bug 1), não um valor já persistido. O gate `requireExplicitContact` roda corretamente antes do enrich e bloqueia mesa sem contato real ANTES de qualquer coisa. **Este bug específico (3) não tem causa raiz confirmada — não foi corrigido nesta rodada por falta de evidência sólida.** O caso concreto reportado depois (mesa "CORRENTES DE ASMODEUS", link real sem contact_discord) é o **bug 7**, com causa raiz totalmente distinta e confirmada (allowlist de URL). Mantido como aberto/investigação incompleta; se reaparecer, precisa de print mostrando o estado ANTES de qualquer "Aplicar" no editor pra confirmar se é o gate falhando ou sugestão de IA sendo confundida com valor aplicado.

### Bug 4 — descrição com caracteres estranhos/markdown residual

[cleanDescriptionText](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:1176) (usado só para `description`) remove: token Discord cru, `[form]`/`[link]`, markdown de ênfase pareado/borda, espaços redundantes. **Não remove**: headings markdown (`### O Sistema:`), blockquote (`> FIM DE TRANSMISSÃO`), nem outros símbolos decorativos que `stripDecorativeMarkup` (linha 1194-1214, usado só em título/system hint) já sabe limpar (zero-width, símbolos pictográficos, `#`/`▬`/`━` etc.).

Print do mantenedor mostra a description final com `###`, `>`, quebras de linha tipo "transmissão" preservadas cruas — bate exatamente com o gap: `cleanDescriptionText` e `stripDecorativeMarkup` são funções **separadas e não compostas**; description usa só a primeira, perdendo a limpeza mais agressiva da segunda.

**Fix provável:** aplicar (parte de) `stripDecorativeMarkup` — ou uma variante que preserve pontuação de frase (`.`, `,`, `!`, `?`) que a versão de título não precisa preservar — dentro de `cleanDescriptionText`, ou compor as duas.

### Bug 5 (novo, caso real "CORRENTES DE ASMODEUS") — "Sistema de Jogo:" nunca é reconhecido como label de sistema

Anúncio real usa **"Sistema de Jogo:"** (label composto de 3 palavras) e **"Nível atual:"**. Sistema esperado: D&D 5e'14 (D&D 5e 2014). Resultado real: sistema não identificado, campo "Nível" vazio.

Causa raiz confirmada em [parseDiscordAnnouncement.ts:974-1010](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:974) (`extractLabelValue`) + [:862-871](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:862) (`splitLabelLine`):

```
const explicitSystem = normalizeTitle(extractLabelValue(body, ['sistema', 'jogo', 'rpg'], {...}));
```

`splitLabelLine` extrai a chave inteira antes do `:` e normaliza: `"Sistema de Jogo"` → `normalizeLabelKey` → `"sistema de jogo"` (string única, com "de" no meio). `extractLabelValue` compara com `wanted.has(parsed.key)`, onde `wanted = new Set(['sistema','jogo','rpg'])` — **comparação por igualdade exata da chave inteira**, não por palavra-chave/substring. `"sistema de jogo" !== "sistema"` → nunca bate. Testei a regex de `stripVersionSuffix` isoladamente (funciona bem para `5e'14`) — o problema é **anterior**, o hint nunca chega a ser extraído porque o label não casa.

Todo anúncio que usa label composto tipo "Sistema de Jogo:", "Sistema utilizado:", "Jogo do dia:" etc. (variação natural de texto humano) falha silenciosamente — cai pro fallback de thread-name (`splitThreadName`), que também não ajuda se o thread não tiver o padrão `sistema: título`.

**Fix provável:** `extractLabelValue` (e por extensão qualquer chamada com `labels: string[]`) precisa reconhecer labels compostos — normalizar a chave removendo stopwords (`de`, `do`, `da`) antes de comparar, ou comparar por interseção de palavra-chave em vez de igualdade exata. Mesma correção provavelmente resolve outros labels compostos usados em anúncios reais (auditoria ampla recomendada, não só o label "sistema").

### Bug 6 (novo, mesmo caso real) — "Nível atual: Nível 13" é DESCARTADO pelo fallback de description, não sobra em lugar nenhum

**Decisão do mantenedor (2026-07-10):** não precisa de campo próprio pra "nível". Informação sem campo mapeado tem que sobreviver dentro da `description`, nunca ser perdida.

Causa raiz real (revista): `buildFallbackDescription` ([parseDiscordAnnouncement.ts:1148-1174](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:1148)) é usado quando o anúncio não tem label explícito "Descrição:"/"Sinopse:" (caso deste anúncio — o texto corrido começa direto após os labels estruturados). Essa função filtra **qualquer linha que `splitLabelLine` reconheça como par `label: valor` com valor não vazio** — isso é intencional pra tirar campos que JÁ viraram dado estruturado (Sistema, Dia, Horário, Vagas) da description, evitando duplicação. Mas "Nível atual: Nível 13" também é `label: valor` reconhecido pela mesma função `splitLabelLine`, e como não existe extração própria pra "nível" (ver função `extractTableLevel`, que é campo diferente — complexidade da mesa, não nível de personagem), a linha inteira é **descartada silenciosamente**, sem virar campo E sem sobrar na description.

**Fix decidido:** `buildFallbackDescription` não deveria remover TODA linha `label: valor` — só as que correspondem a campos que o parser efetivamente extraiu em algum lugar do draft (Sistema/Dia/Horário/Vagas/Tipo/etc.). Linha reconhecida como label mas cujo conteúdo não tem destino em nenhum campo do form (ex.: "Nível atual", "Tom da mesa", qualquer label não mapeado) deve permanecer na description, preservando a informação. Precisa de uma lista positiva dos labels que JÁ são cobertos por outro campo (pra saber o que é seguro remover) em vez do comportamento atual de remover-tudo-que-parece-label.

### Bug 7 (novo, mesmo caso real) — link de inscrição real bloqueia `ready` como `contact_url:suspicious`

Anúncio tem `Link de inscrição/contato: https://dm.yanbraga.com/join` (extraído certo, "3 embed(s) preservado(s)"), sem `contact_discord`. Ao tentar marcar como pronto: `422 Draft ainda tem 1 campo(s) faltando (contact_url:suspicious); não pode ser marcado como 'ready'.`

Causa raiz confirmada em [parseDiscordAnnouncement.ts:748-764](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:748) (`isKnownContactUrl`) + [:1479-1481](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:1479):

```
const KNOWN_CONTACT_URL_PATTERNS = [
  /discord(?:app)?\.com\/invite\//i, /discord\.gg\//i, /forms\.gle\//i,
  /docs\.google\.com\/forms\//i, /typeform\.com\//i, /wa\.me\//i,
  /chat\.whatsapp\.com\//i, /t\.me\//i, /mesaquest\.com\.br\//i, /linktr\.ee\//i,
];
...
if (contactUrl && isSuspiciousUrl(contactUrl)) {
  missingFields.push('contact_url:suspicious');
}
```

`isKnownContactUrl` é **allowlist fixa de 10 domínios**. Qualquer site próprio de GM (`dm.yanbraga.com`, sites pessoais, landing pages) nunca vai estar na lista — mesmo sendo o link real, extraído com confiança alta e sem nenhuma outra ambiguidade. `contact_url:suspicious` sempre entra em `missing_fields` pra qualquer domínio fora da allowlist, e vira bloqueio duro de `ready` no sync (422).

Combina com o mantenedor: **"nome do mestre" e "contato Discord" não deveriam ser obrigatórios quando já existe link de inscrição/contato válido.** Hoje o campo `contact_url` aceita qualquer URL, mas o marcador `suspicious` trata qualquer domínio desconhecido como não-confiável — não distingue "URL genuinamente estranha/malformada" de "site pessoal de GM real fora da allowlist curta".

**Fix provável:** repensar `isSuspiciousUrl` — ao invés de allowlist fixa bloqueando tudo que não reconhece, validar só a forma do URL (https válido, domínio bem formado) e não marcar como suspeito só por não estar na lista curta de plataformas conhecidas. A allowlist pode continuar existindo pra fins de confiança/prioridade, mas não deveria ser gate de bloqueio de `ready`.

## Achado de arquitetura (crítico, mantenedor 2026-07-10) — labels novos deveriam entrar por learning, não hardcode

**Feedback direto do mantenedor após o fix do bug 5:** codificar `'sistema de jogo'`/`'sistema utilizado'` na lista fixa de `extractLabelValue` é a correção errada em espírito — "anúncio ilimitado" (forma humana de escrever varia sem fim), "se for ter que toda vez codificar a exceção, fodeu", "o próprio sistema tem que aprender a partir da minha curadoria manual".

Investigação confirma: o projeto **já tem exatamente esse mecanismo planejado e registrado como débito, nunca implementado.** `fieldLearning.ts:36-37`:
```
/** Tipo de chave: 'value' (token = valor de entrada) hoje; 'label' = futuro (DEB-052-02). */
export type FieldLearningKeyType = 'value' | 'label';
```
`lookupFieldLearning` (D087, spec 052) hoje SÓ aprende **valor→correção** (ex.: sistema extraído errado, corrigido pra outro valor — aprende a mapear aquele token de valor). Ele NUNCA aprende **label→campo** (ex.: "quando o anúncio tem uma linha `Sistema de Jogo:`, isso é o campo system_name") — essa é a keyType `'label'`, documentada desde a spec 052 (2026-06-30) como "futuro", nunca implementada (DEB-052-02: "learning-store por raw text adiado" — registrado em `specs/backlog.md` §BL-MESAS-AUTOMACAO-INTELIGENTE-052).

**Isso explica por que bug 5 (e provavelmente outros bugs de "label não reconhecido" ainda não descobertos) sempre vão se repetir**: o parser tenta um label fixo, falha silenciosamente, e não existe caminho pra correção humana (editar o campo manualmente no draft) virar sinal de aprendizado de NOVO LABEL — só vira aprendizado se o VALOR extraído estava errado, não se o campo nunca foi tentado.

**Fix real (não feito ainda, fora do escopo desta rodada):** implementar `FieldLearningKeyType = 'label'` — quando o mantenedor corrige manualmente um campo que veio `null`/`unmatched` no draft, e o texto original tem uma linha reconhecível como `algumLabel: valor`, o sistema deveria propor (ou aprender direto) que aquele padrão de label mapeia pro campo corrigido. É trabalho de escopo próprio (schema novo ou extensão de `discord_field_learning`, lógica de detecção de "qual linha do content_raw gerou este valor", possivelmente revisão humana antes de auto-aplicar). Session atual só registra o achado — não implementa.

## Bug 8 (novo, achado de produção real, 2026-07-10) — 422 em `PATCH /admin/discord/drafts/:id` (Salvar campos)

Print de console real, produção (`mesas.artificiorpg.com`):
```
PATCH /api/v1/admin/discord/drafts/1fe29a5c-... 422 (Unprocessable Content)
  at handleSaveFields
```
Rota é `router.patch('/:id', ...)` em [drafts.ts:334](apps/mesas/backend/src/routes/discord/drafts.ts:334), handler compartilhado `handlePatchDraft` ([utils.ts:993](apps/mesas/backend/src/routes/discord/utils.ts:993)). 422 nesse caminho normalmente vem de `validateDraftStatusTransition`/`assertDraftReadyTransition` (bloqueio de `missing_fields` ao tentar `status: 'ready'`) — mesmo padrão dos bugs 6/7 já corrigidos nesta sessão. **Não investigado a fundo**: o print não trouxe o corpo da resposta 422 (só o stack de erro genérico do fetch), então não dá pra confirmar se é regressão nova, o mesmo padrão de bug 6/7 em outro campo ainda não coberto, ou causa totalmente distinta. Precisa do JSON de erro real (`{ error, details }`) pra diagnosticar — pedir ao mantenedor screenshot da resposta da rede (aba Network do DevTools) na próxima ocorrência, ou reproduzir localmente com o mesmo draft.

## Bug 9 (novo, achado de produção real, 2026-07-10) — `GET /api/v1/notifications` 401

```
GET https://mesas.artificiorpg.com/api/v1/notifications 401 (Unauthorized)
```
Não investigado — padrão típico de sessão expirada/token ausente, comportamento esperado de app quando não autenticado, não necessariamente bug do parser/importação. Sem mais contexto (se aconteceu durante sessão autenticada ativa, seria bug real de expiração precoce; se foi ao carregar a página sem login, é comportamento correto). Registrar aqui só pra não perder o achado — precisa de mais contexto do mantenedor pra saber se é bug.

## Achado CodeRabbit PR #144 (2026-07-10) — regressão no fix do bug 7, corrigida

Review automático no PR #144 apontou: o fix do bug 7 (`isSuspiciousUrl` reescrita pra validar forma em vez de allowlist bloqueante) removeu o único gate que existia sobre URL não-relacionada. `extractContactUrl` sempre teve fallback "sem domínio conhecido, pega a primeira URL crua do texto" — antes, esse fallback ficava marcado `contact_url:suspicious` (falso positivo pra site pessoal de GM real, mas também capturava por acidente link de playlist/review/site institucional). Com o fix do bug 7, esse gate sumiu — qualquer URL sintaticamente válida, mesmo sendo link incidental sem nenhuma relação com contato/inscrição, passa a `ready` sem revisão.

**Veredicto: procede.** Achado real, não falso positivo — confirmado lendo `extractContactUrl` ([parseDiscordAnnouncement.ts:826](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:826), antes do fix): `allMatches[0]` vence só por ordem de aparição quando não há domínio known, sem checar se a URL tem qualquer relação com contato.

**Fix aplicado (mesmo PR, resposta não escrita no PR — regra pétrea):** `extractContactUrl` agora retorna `{ url, confident }`. `confident: true` quando a URL bate domínio conhecido (`isKnownContactUrl`) OU está numa linha com sinal textual de contato (`CONTACT_CONTEXT_LINE_RE`: contato/inscrição/candidatura/interesse/ticket/link de contato). `confident: false` só no fallback puro (nenhum domínio conhecido, nenhum contexto de linha) — draft ganha `contact_url:unconfirmed` em `missing_fields`, bloqueando `ready` até revisão humana, sem reintroduzir a allowlist rígida que causava o falso positivo original do bug 7. `urlHasContactContext` nova, reusa mesmo padrão de `extractContactDiscord`. Testes novos: URL sem contexto entra em `unconfirmed`; URL com contexto ("Inscrições:") não entra, mesmo sem domínio known.

**Validação:** tsc limpo, build limpo, 436/436 testes backend (+2 novos).

## 2ª leva de achados CodeRabbit PR #144 (2026-07-10) — 10 achados, todos analisados e corrigidos

Segunda passada de review sobre o mesmo PR, após o fix da regressão do bug 7 acima. Todos os 10 achados foram lidos contra o código real (não confiados no texto do bot cru — line numbers do bot já estavam defasados pelo commit anterior) e corrigidos no mesmo PR, sem resposta escrita no PR (regra pétrea).

1. **`getAnnouncementSystemHint`/`classifyHomebrew` não usavam `labelAliases` (Major, procede).** `parseDiscordAnnouncement` já recebia `labelAliases` (DEB-052-02), mas a checagem de descarte autoral rodava ANTES, com allowlist fixa só — um anúncio como "Jogo do dia: Sistema próprio" (rótulo aprendido, não fixo) escapava do descarte porque o hint nunca era achado. Fix: `getAnnouncementSystemHint`/`classifyHomebrew` ganharam parâmetro opcional `labelAliasesSystem?: string[]`, `parseDiscordAnnouncement` passa `labelAliases?.system_name`. Retrocompatível (parâmetro opcional, call site externo em `utils.ts` sem quebra).
2. **`normalizeTitleCapitalization` rebaixava stopword logo após pontuação de cláusula (Major, procede — confirmado pelo próprio teste que eu tinha escrito).** "Vampiro: A Máscara" virava "Vampiro: a Máscara" — a checagem `index > 0 && isStopword` não distinguia "meio de frase" de "início de nova cláusula após `:`". Fix: nova `CLAUSE_END_RE` (`:`,`.`,`!`,`?`,`-`) — palavra é início de cláusula se `index === 0` OU a palavra anterior termina em pontuação de cláusula; só then não rebaixa. Teste antigo corrigido de volta pro valor certo (`'Vampiro: A Máscara'`), teste novo explícito adicionado ("Sistema: A Lenda dos Cinco Anéis").
3. **Mismatch de escopo entre gravação e leitura de `label_alias` (Major, procede — o mais grave).** `recordLabelAliasFromCorrection` grava com `source` completo (guild+channel+author, vira `scope_hash` composite), mas `loadActiveLabelAliases` em `parseDiscordMessage` só passava `guild_id` — `scopePredicates` só gera hash pros campos presentes no escopo passado, então o hash composite gravado NUNCA batia na busca. Aliases aprendidos nunca eram aplicados de volta, silenciosamente. Fix: `loadActiveLabelAliases` agora recebe `{guild_id, channel_id, author_id}` de `raw.discord_channel_id`/`raw.discord_author_id`, mesmo padrão de `learningScope` em `enrichDraftWithLlm` (já existia certo ali, só não foi seguido no código novo).
4. **Threshold hardcoded 0.72 divergia de `ACTIVE_CONFIDENCE` 0.8 (Major, procede).** `onConflict` do `recordLabelAliasFromCorrection` promovia `status: 'active'` com `confidence >= 0.72`, mas `loadActiveLabelAliases` só lê `confidence >= 0.8` — janela onde `status='active'` mas invisível pro parser. Fix: usa `ACTIVE_CONFIDENCE` (mesma constante) nos dois lugares.
5. **`applySystemNameSuggestion` (frontend) sem guard de objeto não-diff (Minor, procede).** `String(value)` em objeto que não bate shape `{before,after}` produz `"[object Object]"` gravado no `system_name` — mesma classe de bug já corrigida em `mapAuditCandidateToForm` (achado CodeRabbit PR #135). Fix: mesmo guard `typeof value === 'object' → ''`. Teste novo no `useDraftForm.test.ts`.
6. **`CatalogNode.status`/`CatalogNodeInput.status` tipados `string` solto (Minor, procede).** Fix: novo `CatalogNodeStatus` union no `site-admin/api.ts`, espelhando o canônico do backend.
7. **`.map` sem `Array.isArray` sobre payload externo em `CatalogSystemsPage.tsx` (Minor, procede — viola regra do projeto).** `node.aliases.map`/`node.children.map` (3 pontos: `selectNode`, `CatalogTreeNode`, `filterTree`, e `flatten`) operavam direto sobre snapshot vindo de fetch sem guard. Fix: `Array.isArray(...)` antes de cada `.map`.
8. **`<label>` sem `htmlFor`/`id` no formulário de catálogo (Minor, procede).** 9 campos sem associação programática label↔input. Fix: `id`/`htmlFor` pareados em todos.
9. **`??` em vez de checagem `undefined` em `updateNode` (Major, procede).** `input.name_pt ?? existing.name_pt` trata `null` explícito (intenção de limpar campo via PATCH) igual a "não enviado" — impossível limpar `parent_id`/`name_pt`/`description`/`official_website_url`/`logo_media_id` via API, mesmo o admin UI já mandando `null`. Fix: `!== undefined ? valor : existing` nos 5 campos anuláveis.
10. **`bumpVersion`: `MAX(version)+1` sem lock, risco de duplicate key sob concorrência (Minor, procede).** Fix: `LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE` dentro da mesma transação antes do `SELECT MAX`, sem exigir migration nova de sequence.

**Achados triviais também corrigidos (quick wins, sem controvérsia):**
- Dedup: `replaceAliases`/`buildPathSlug`/`bumpVersion` estavam copiadas em `import-mesas-catalog.ts`, divergindo do canônico em `catalog.ts` — exportadas do canônico, script agora importa em vez de duplicar.
- `createHash` via `await import` dinâmico: achado já não se aplicava (script já usava import estático de `node:crypto`) — falso positivo, nada a corrigir.
- `loadMesasRows`: `JSON.parse` + `as` cast sem validar shape dos itens do array — `Array.isArray` cobria só o container. Fix: `isValidMesasRow`/`parseMesasCatalogJson` validam campos essenciais (`id`/`name`/`node_type`/`slug`) antes de aceitar, descartando linha malformada com warning em vez de propagar erro obscuro depois.
- `recordFieldLearning`/`recordLearningRulesFromCorrections`/`recordLabelAliasFromCorrection`/`recordParseFeedbackForCorrections` rodavam sequencial em `registerDraftCorrection` — confirmadas independentes (tabelas/rule_type diferentes, erro tratado internamente) — paralelizadas via `Promise.all`.

**Validação final (todos os 10 + 3 triviais no mesmo commit):** `tsc --noEmit` limpo em mesas-backend + site + site-admin; build limpo nos 3; 437/437 testes backend (+1 novo: clause-start), 172/172 frontend (+1 novo: guard objeto); lint 15/15 repo-wide.

## DEB-052-02 implementado (2026-07-10, autorização explícita do mantenedor: "corrija os bugs, inclusive o DEB-052-02 é exatamente essa lacuna")

Mecanismo completo de aprendizado label→campo, substituindo o hardcode do bug 5. Achado-chave na investigação: a tabela `discord_learning_rules` (migration 138, spec 058) **já tinha `rule_type: 'label_alias'` no union de tipos desde sempre** — só nunca era gravado nem lido; só `'field_value'` (aprendizado de valor) estava implementado. A infra (scope/confidence/conflitos/status) já existia pronta.

**Gravação** — `recordLabelAliasFromCorrection` (nova, [learningRules.ts](apps/mesas/backend/src/discord/learningRules.ts)): quando uma correção humana muda um campo que estava **vazio** (`inputValue` null/vazio — parser não achou nada, não é troca de valor) e o `raw_text` original tem uma linha `rótulo: valor` cujo valor normalizado bate com o valor que o humano digitou, grava `rule_type: 'label_alias'` com `input_token = rótulo`, `output_value = nome do campo`, `status: 'candidate'`, reforçando confiança a cada repetição (mesmo padrão de `recordLearningRulesFromCorrections`). Chamada em `registerDraftCorrection` ([utils.ts:229](apps/mesas/backend/src/routes/discord/utils.ts:229)), best-effort, depois do commit da correção.

**Leitura** — `loadActiveLabelAliases` (nova, mesmo arquivo): carrega label_alias `active`+confiança suficiente por escopo (guild→global), agrupados por campo. Chamada em `parseDiscordMessage` ([utils.ts:494](apps/mesas/backend/src/routes/discord/utils.ts:494)) antes de cada parse, passando o resultado pro parser.

**Parser** — `parseDiscordAnnouncement` ganhou 5º parâmetro opcional `labelAliases?: Record<string, string[]>` ([parseDiscordAnnouncement.ts:1405](apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:1405)); `extractLabelValue` pra título e sistema agora recebe `[...allowlist fixa, ...labelAliases?.title, ...labelAliases?.system_name]` — allowlist fixa continua existindo (cobre os casos universais conhecidos), aliases aprendidos SOMAM em cima, por curadoria real do mantenedor, sem precisar de deploy pra cada rótulo novo. `normalizeLabelKey`/`splitLabelLine` exportadas do parser pra reuso em `learningRules.ts`.

**Efeito prático:** próxima vez que o mantenedor corrigir manualmente um campo vazio cujo anúncio usava um rótulo nunca visto (ex.: "Jogo do dia:", "Sistema:", qualquer variação futura), o sistema aprende sozinho — sem precisar de outra rodada de "reporta bug → agente codifica exceção". Resolve a causa raiz por trás do bug 5, não só o sintoma.

**Validação real:**
- `pnpm --filter @artificio/mesas-backend build` ✅ (tsc limpo).
- `pnpm --filter @artificio/mesas-backend test` — **434/434** ✅ (+7 testes novos: 4 em `learningRules.test.ts` cobrindo grava/não-grava/carrega/erro-DB, 2 em `parseDiscordAnnouncement.test.ts` provando que rótulo desconhecido não é reconhecido sem alias e passa a ser reconhecido com alias).
- Corrigido de passagem um erro de tipo preexistente descoberto ao rodar `tsc` (`learningRules.ts:349`, `hit.field` nullable usado como index — não relacionado ao meu diff, mas bloqueava build; corrigido com guard).
- Escopo desta rodada: só `system_name` e `title` recebem aliases dinâmicos (onde o bug real apareceu). Outros campos de label (`day_of_week`, `contact_url` etc.) não foram estendidos — extensão futura é trivial (mesmo padrão, só passar `labelAliases?.<campo>` no `extractLabelValue` correspondente), mas não foi pedida nem validada nesta rodada.

## Débito relacionado já existente

- Spec 058, `tasks.md`, T11.10 — auditoria completa campo-a-campo contra datasets reais, aberta.
- Bug 3 (filtro contato) tem raiz nova além do que sessão `26-07-08_3` corrigiu — registrar como extensão do mesmo tema, não duplicata.
- Bug 7 relacionado ao mesmo tema de contato do bug 3, mas causa raiz distinta (allowlist de URL vs. timing do enrich) — não são a mesma correção.
- **DEB-052-02** (`specs/backlog.md` §BL-MESAS-AUTOMACAO-INTELIGENTE-052) é o débito que, se implementado, teria evitado o bug 5 (e evita repetição futura da mesma classe de bug). Reforçado nesta sessão como prioridade — mantenedor explicitou que hardcode de exceção não escala.

## Status

**Fixes implementados e validados (2026-07-10, autorização do mantenedor):**

- **Bug 1** — `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts`: nova `applySystemNameSuggestion` busca `system_id` por nome/name_pt no catálogo achatado antes de aplicar; sem match, cai pro comportamento anterior (só texto).
- **Bug 2** — `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`: `normalizeTitleCapitalization` (nova) normaliza CADA PALAVRA isoladamente (não a proporção do título inteiro — caso real tinha só a 1ª metade em CAPS), preserva token com dígito/apóstrofo (2D6, D20, 5e'14) e sigla curta solta (RPG, GM); aplicada em `normalizeTitle` E em `splitThreadName` (fallback via 1ª linha do body quando não há thread_name real).
- **Bug 3 — NÃO corrigido.** Diagnóstico original (enrich sobrescreve contato automaticamente) revisado e refutado ao ler `attachAiSuggestions`/`buildAiSuggestionFields`: enrich só ANEXA sugestão pendente de "Aplicar", nunca escreve direto no campo. Sem evidência sólida de causa raiz real — fica aberto, ver seção Bug 3 acima pro que investigar se reaparecer.
- **Bug 4** — nova `LINE_PREFIX_MARKDOWN_RE` em `cleanDescriptionText` remove prefixo de linha `#{1,6}`/`>` (heading/blockquote), preservando pontuação de frase normal e `#`/`>` soltos no meio.
- **Bug 5** — `extractLabelValue` para sistema ganhou `'sistema de jogo'`/`'sistema utilizado'` nas 2 chamadas (linhas ~1325 e ~1385, com e sem `keepParenthetical`).
- **Bug 6** — nova `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS` (allowlist positiva de labels com campo confirmado) em `buildFallbackDescription`; só remove linha `label: valor` quando a chave está nessa lista — label reconhecido mas sem campo (ex. "Nível atual") permanece na description.
- **Bug 7** — `isSuspiciousUrl` reescrita: valida forma (esquema http/https + hostname bem formado via `URL()`), não allowlist fixa. Único consumidor confirmado (`parseDiscordAnnouncement.ts:1545`), sem outros callers no backend. Teste `parseDiscordAnnouncement.test.ts` atualizado (`URL desconhecida é suspeita` → `URL bem formada fora da allowlist não é suspeita` + `URL malformada é suspeita`).

**Validação real:**
- `pnpm --filter @artificio/mesas-backend build` ✅, `pnpm --filter @artificio/mesas-frontend build` ✅.
- `pnpm --filter @artificio/mesas-backend test` — 427/427 ✅ (1 teste ajustado pra nova semântica do bug 7).
- `pnpm --filter @artificio/mesas-frontend test` — 171/171 ✅.
- `pnpm run lint` — 15/15 ✅ (repo-wide).
- **Teste contra dados reais** (`D:\teste.json`, 100 mensagens reais do Discord, script standalone chamando `parseDiscordAnnouncement` direto, removido após validação): 87/100 parseadas; **0 títulos ainda em CAPS** (antes: qualquer título gritado sobrevivia); caso "GRADIENTE DESCENDENTE 4..." → "Gradiente Descendente 4 - Variáveis Implícitas"; caso "CORRENTES DE ASMODEUS" → título "Correntes de Asmodeus", sistema "D&D 5e'14" corretamente reconhecido (bug 5), description preserva "Nível atual: Nível 13" (bug 6) e remove blockquote/heading residual (bug 4), `contact_url` "https://dm.yanbraga.com/join" sem entrar em `missing_fields` (bug 7); **0 ocorrências de `contact_url:suspicious`** no dataset inteiro (antes: qualquer domínio fora da allowlist de 10 travava).

## Próximo passo

Bug 3 segue aberto — se reaparecer, capturar print do estado do campo ANTES de qualquer clique em "Aplicar" no editor, pra distinguir sugestão de IA pendente (comportamento correto) de valor já persistido sem contato real confirmado (bug real ainda não localizado).

Bug 8 (422 PATCH drafts) e bug 9 (401 notifications) seguem sem investigação aprofundada — precisam de mais contexto/evidência do mantenedor (corpo da resposta 422; se o 401 ocorreu com sessão ativa).

Sem commit/push/PR nesta sessão — aguardando autorização.
