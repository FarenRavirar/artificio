# Handoff — auditoria adversarial da spec 093

> ## ⚠️ Estado deste documento (2026-08-19)
>
> **A auditoria foi executada e os 48 achados já foram incorporados** à `spec.md`,
> `plan.md` e `tasks.md`. Este arquivo é **registro histórico**, não pauta de trabalho.
>
> **Quem vai implementar não deve reexecutar a auditoria.** As instruções de ataque por
> fase (§Fase 1 a §Fase 7, abaixo) já foram cumpridas — o DeepSeek as rodou e produziu os
> resultados registrados em §Resultados da auditoria. Rodá-las de novo audita uma spec que
> já não existe: onde os documentos foram corrigidos, o texto atacado mudou.
>
> **Para implementar, a fonte é `tasks.md`.** Ele já embute cada correção com a referência
> ao achado que a motivou. `spec.md` dá o porquê; `plan.md` dá o como.
>
> **Duas mudanças de estrutura que este documento não reflete** (aconteceram depois da
> auditoria):
> - a spec passou de 7 para **8 fases** — entrou a Fase 7 (campos que a página pública
>   esconde, R21–R24), e "consolidar aba Mesas" virou Fase 8;
> - **R19 migrou da Fase 6 para a Fase 3**, por causa do achado transversal 3.
>
> Onde este handoff cita número de fase, vale a numeração antiga.

**Para:** um agente auditor por fase (7 no total), independentes entre si
**Objetivo:** **refutar** as investigações do agente que escreveu esta spec, não confirmá-las
**Estado:** spec fechada, nenhuma linha de código implementada — auditar o **diagnóstico**,
não a implementação

---

## Como usar este documento

Cada bloco §Fase N abaixo é um prompt autossuficiente. Copie o bloco da fase e envie ao
agente daquela fase. Não envie o documento inteiro para um agente só — a divisão existe
para que sete leituras independentes discordem entre si, e um auditor que vê as sete
conclusões tende a harmonizá-las.

Os auditores **não devem se comunicar entre si**. Contradição entre dois auditores é sinal
útil, não problema a resolver.

---

## Prompt-base (vale para todas as fases — inclua junto do bloco da fase)

> Você é auditor técnico adversarial. Sua tarefa **não** é validar a spec, é **derrubá-la**.
> Um auditor que devolve "está tudo certo" falhou na tarefa, salvo se tiver rodado os
> comandos e mostrado a saída.
>
> **Repositório:** `C:\projetos\artificio`, monorepo TypeScript. Leia `AGENTS.md` (T0
> obrigatório) antes de agir. Ferramentas: `rtk rg <padrão> <path>`, `rtk read <arquivo>`,
> LSP. Nunca `grep`/`cat` cru. Nunca commitar, pushar ou alterar arquivo — **auditoria é
> read-only**.
>
> **Documentos a auditar:** `specs/093-mesas-draft-parser-gestao/{spec.md,plan.md,tasks.md}`.
> Leia apenas as seções da SUA fase, mais a seção §Problema do `spec.md` referente aos
> gaps dela.
>
> **Regra de ouro:** toda afirmação da spec traz `arquivo:linha`. Sua obrigação é **abrir
> o arquivo e conferir** — não aceitar a citação, não confiar no número da linha, não
> presumir que o trecho citado diz o que a spec afirma que ele diz. Linha citada errada,
> trecho fora de contexto ou conclusão que não decorre do código são achados de primeira
> ordem.
>
> **O que você procura, em ordem de valor:**
> 1. **Afirmação factual falsa** — a spec diz que o código faz X, e ele faz Y.
> 2. **Conclusão que não decorre da evidência** — a medição está certa, a inferência não.
> 3. **Medição ausente disfarçada de fato** — afirmação sem comando que a sustente.
> 4. **Caso não considerado** que quebraria a correção proposta.
> 5. **Contradição interna** entre `spec.md`, `plan.md` e `tasks.md`.
> 6. **Violação de `AGENTS.md`** — em especial §Evidência, §Migrations, §Compartilhado por
>    padrão, §Regras de Produto.
>
> **Formato da resposta:**
> - Comece pelo veredito: quantos achados, e o mais grave em uma linha.
> - Um item por achado: `arquivo:linha` citado pela spec → o que a spec afirma → o que o
>   código realmente diz → comando que você rodou → por que muda (ou não) a conclusão.
> - Liste também o que você **conferiu e estava correto**, com o comando — para que se saiba
>   o que foi coberto de fato.
> - Se não achou nada numa frente, diga "não achei nada em X, rodei estes comandos" —
>   nunca "está tudo certo".
> - Português. Sem elogio à spec. Sem sugestão de implementação — só o diagnóstico.

---

## §Fase 1 — Parser: vagas lidas de data (R7, R8, R9)

**Arquivo sob auditoria:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`
**Seções:** `spec.md` §Gap 4 · `plan.md` §Fase 1 · `tasks.md` T1.1–T1.9

A spec afirma que o parser leu a data `25/08` de um anúncio real como par de vagas
`25`, e monta uma cadeia causal de 6 passos, culminando em três "camadas" de defeito
(A: sem guard de data; B: filtro de linha frouxo; C: `return` em vez de `continue`).

**Derrube estas afirmações, uma a uma:**

1. `slotsLabeledNumericPair` está mesmo nas linhas 1003-1018? O filtro da linha 1008 é
   mesmo `vagas?|lugares?|jogadores?`? O guard da linha 1013 é mesmo só `> 100`?
2. A cadeia de 6 passos se sustenta? Em especial: `classifySlotPairLine` devolve mesmo
   `generic` para a linha de prosa citada, e `slotsFromNumericPair` cai mesmo em
   `ambiguous()` com `total = max(25,8)`?
3. **A Camada C é mesmo o defeito que a spec diz ser o mais grave?** A spec afirma que o
   `return` da linha 1015 impede que a linha com "1 disponível de 4" seja avaliada.
   **Verifique a ordem real das linhas no anúncio** — se a linha da vaga vier ANTES da
   linha da data, a Camada C não explica nada e a spec inverteu a causa.
4. `extractSlots` tem mesmo 9 estratégias na cascata (linhas 1067-1080)? A spec proíbe
   reordená-la — a correção proposta para a Camada C realmente não altera a ordem?
5. Os 4 sinais de guard de data propostos (contexto, zero à esquerda, faixa, `DD/MM/AAAA`)
   têm **falso positivo**? Procure caso real onde um deles recusaria uma vaga legítima —
   ex.: mesa com 20 vagas, ou par `05/10` que seja vaga de verdade.
6. Os formatos que a spec promete não regredir (`1/4`, `8/25`, `"Vagas Disponíveis: 1/4"`,
   `"1 vaga / grupo de 5 pessoas"`) existem mesmo como teste hoje? Rode a suíte e conte.
7. **A correção proposta é suficiente?** Existe outro caminho na cascata que produziria o
   mesmo erro sem passar por `slotsLabeledNumericPair`?

---

## §Fase 2 — Migrations: os dois órfãos (R14, R15)

**Arquivos:** `apps/mesas/backend/migrations/00{6,7}_*.sql`,
`.github/migration-dir-allowlist`, `.github/workflows/_enforce-migration-dir.yml`,
`scripts/deploy/{apply_required_migrations.sh,lib_migrations.sh}`
**Seções:** `spec.md` §Gap 8 · `plan.md` §Fase 2 · `tasks.md` T2.1–T2.11

A spec afirma que dois `.sql` vivem fora da allowlist, que o runner não os enxerga, e que
**os objetos que eles criam já existem em produção** — logo a correção é reconciliação
idempotente, não reaplicação.

**Esta é a fase de maior risco da spec. Derrube com força:**

1. Os quatro itens da tabela do Gap 8 conferem? Allowlist, `MIGRATIONS_DIR:13`, glob
   `migration_*.sql` em `lib_migrations.sh:157`, ausência de header nos dois arquivos.
2. **A inferência central é válida?** A spec conclui "os objetos existem em produção" a
   partir de `tables.ts:830` (`insertInto('table_click_events')`) e `shared.ts:77`.
   Isso **prova** que existem em produção, ou só que o código os referencia? Um `insert`
   dentro de `try/catch` silencioso, uma rota nunca exercitada, ou um caminho morto
   derrubariam a inferência. **Verifique se essas linhas rodam de fato, e se um erro ali
   seria visível.**
3. A spec diz "zero referências no repo" aos dois arquivos. Confirme — inclua busca por
   caminho parcial, script de bootstrap, Dockerfile, README e docs.
4. `006_` cria objetos que **outras migrations em `apps/mesas/database/` já criam**? Se a
   106 faz `UPDATE vtt_platforms` e a 111 referencia, alguma outra migration cria a tabela
   por outro caminho? Procure `CREATE TABLE` de `vtt_platforms` e de
   `vtt_platform_suggestions` em todo o repo, não só no diretório citado.
5. **A migration 158 proposta é mesmo idempotente contra banco que já tem tudo?** Leia os
   dois SQL originais linha a linha e aponte cada instrução que **não** é idempotente —
   a spec já suspeita do `ALTER TABLE table_metrics`, mas pode haver mais.
6. `migration_158` é mesmo a próxima livre? Confira a numeração real, incluindo colisões
   (existem duas `migration_17_*` e duas `migration_18_*` no diretório — isso muda algo?).
7. A spec afirma que `_enforce-migration-dir.yml:75` usa `--diff-filter=AM` e por isso tem
   ponto cego. Confirme, e verifique se **outro** workflow já cobre o passivo — se cobrir,
   R15 é desnecessário.
8. A varredura nova proposta em T2.8 acusaria `.sql` de **outros apps**? Rode
   `is_allowed_sql_path` mentalmente contra todo `.sql` rastreado do repo e liste o que
   sobraria — a spec assume que isso é resolvível no mesmo PR.
9. `AGENTS.md` §Migrations item 2.1 (não fatiar) foi lido corretamente ao justificar
   arquivo único? Ou o item diz o contrário do que a spec extraiu?

---

## §Fase 3 — "Tema(s)" e aliases (R3, R4, R10, R16)

**Arquivos:** `parseDiscordAnnouncement.ts`, `shared.ts`, `vttPlatforms.ts`, migrations de
alias
**Seções:** `spec.md` §Gap 2, §Gap 5, §Gap 9, §D2 · `plan.md` §Fase 3 · `tasks.md` T3.1–T3.13
**Evidência a auditar:** `tasks.md` §A3

A spec afirma: (a) `Tema(s)` tem causa única com dois sintomas; (b) aliases devem virar
tabela, não mapa hardcoded; (c) siglas de 2 letras devem ficar de fora por evidência.

**Derrube:**

1. `extractLabelValue(body, ['estilo','indicado'])` está mesmo na linha 2578?
   `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS` mesmo nas 1949-1960, e mesmo **sem** `tema`?
2. **A tese da "causa única" se sustenta?** A spec afirma que adicionar `tema` aos dois
   conjuntos resolve os dois sintomas. Teste a lógica: `splitLabelLine` (linha 1634) tem
   limite de 48 caracteres no prefixo e trata `:`/`：` — `Tema(s):` passa mesmo? E
   `normalizeLabelKey` (linha 1630) preserva mesmo os parênteses, como a spec afirma?
3. A spec usa `Classificação Indicativa` como prova de que o desenho é coerente (extraído
   **e** removido da descrição). Confirme que `classificacao` está mesmo na lista da linha
   1959 **e** que foi de fato removido no anúncio real citado.
4. **§A3 é a evidência mais atacável da spec.** Refaça a contagem sobre
   `apps/mesas/backend/src/inbox/__tests__/fixtures/discord-announcements-real.txt`.
   Os números batem? A amostra é representativa — 1030 linhas são quantos anúncios? Há
   outros corpora no repo que contradigam (procure outras fixtures de anúncio)?
5. A spec conclui que "Roll20 já é reconhecido" porque o `name` no banco é `Roll20`.
   **Isso decorre?** `candidateMatchesText` (linha 243) casaria `Roll20` em todas as 6
   ocorrências reais, considerando pontuação e colagem (`Discord+Roll20`)?
6. A spec afirma que `allowShortAliases = true` (linha 626) desliga o guard da linha 269.
   Leia `collectEntryMatches` inteiro e confirme — ou mostre que o guard sobrevive por
   outro caminho.
7. **D2 (tabela em vez de mapa) é mesmo a decisão certa?** A spec justifica por três
   fundamentos. Ataque cada um: o padrão de `system_aliases`/`scenario_aliases` é mesmo
   comparável? O CRUD admin (`vttPlatforms.ts:202`) de fato permite criar VTT nova? O risco
   de dessincronia das linhas 57-59 é real ou teórico?
8. Trocar o `Record` por `LEFT JOIN` (T3.8) introduz N+1 ou custo de query no caminho de
   parse em lote? O comentário de `routes/discord/utils.ts:48-50` cobre esse caso?

---

## §Fase 4 — Copiar no draft (R1, R2, R11)

**Arquivos:** `DiscordDraftPreview.tsx`, `CopyAnnouncementButton.tsx`,
`whatsappAnnouncement.ts`
**Seções:** `spec.md` §Gap 1, §Gap 6, §D1 · `plan.md` §Fase 4 · `tasks.md` T4.1–T4.9

A spec afirma: (a) as abas Bruto e Normalizado compartilham o mesmo render, logo um botão
serve as duas; (b) `publishedSlug` já é o predicado exato de "mesa publicada"; (c) o botão
não deve existir antes de publicar.

**Derrube:**

1. As linhas 362-366 renderizam mesmo o **mesmo bloco** para as duas abas? E a linha 91
   define `selectedPayload` como a spec descreve?
2. **`publishedSlug` é mesmo equivalente a "mesa publicada"?** Leia o `useEffect` das linhas
   158-176 inteiro. Ele trata falha de rede, resposta 404, `cancelled`, e o caso de a mesa
   ser publicada **depois** que o preview abriu (o efeito depende de `draft.table_id`, que
   não muda). Se o admin clicar "Publicar mesa" com o preview aberto, `publishedSlug`
   atualiza? Se não, o botão de anúncio nunca aparece nessa sessão — D1 estaria mal
   implementável como escrito.
3. `isTableAnnounceable` (linha 19) exige mesmo `status === 'active' && !archived_at`?
4. A spec propõe `loadTable={() => fetchTableDetailBySlug(publishedSlug)}` usando a rota
   **pública** `/api/v1/tables/:slug`. **Essa rota responde para admin?** E devolve mesa
   `active` de qualquer dono, ou filtra por visibilidade? Leia `tables.ts` e
   `tableVisibility.ts`. Se filtrar, o botão quebra em mesa sem `gm_id` (spec 060).
5. O `<pre>` está mesmo dentro de container com scroll (linha 317)? A solução de botão
   "fora do container" é viável na estrutura real, ou o layout impede?
6. `copyTextToClipboard` (linha 379) funciona em contexto não-seguro/sem permissão? Tem
   fallback? A spec assume reuso sem verificar o comportamento de erro.

---

## §Fase 5 — Aba Descartados (R12, R13)

**Arquivos:** `ModeracaoSection.tsx`, `DiscordDraftReviewTable.tsx`, `App.tsx`,
`routes/discord/drafts.ts`
**Seções:** `spec.md` §Gap 7, §D3 · `plan.md` §Fase 5 · `tasks.md` T5.1–T5.9

A spec afirma que **todo o backend já existe** (4 rotas), que o componente já tem filtro,
seletor e purge, e que o único item ausente é restaurar.

**Derrube:**

1. As 4 rotas da tabela do Gap 7 existem mesmo, nas linhas citadas? `GET ?status=rejected`
   (69-72), `GET /:id` (84), `PATCH` status (20), `DELETE /rejected` (260-328).
2. **O `PATCH` aceita mesmo restaurar?** A linha 20 lista `['draft','needs_review','rejected']`
   — mas há guard adicional que impeça sair de `rejected`? Leia o handler inteiro, incluindo
   o bloco das linhas 226-245 que registra outcome.
3. **`needs_review` é o destino certo?** A spec manda conferir o `CHECK` da
   `migration_118`. Confira você: o invariante é `status='ready' => missing_fields=[]` —
   isso impede `needs_review` com `missing_fields` vazio? E existe trigger ou guard que
   recuse a transição `rejected → needs_review`? Procure em `pg_trigger` equivalente no
   schema versionado.
4. O `DELETE /rejected` filtra por origem (`origin`)? A spec afirma que apaga "todos da
   origem". Na aba nova, com `lockedStatus`, o `originFilter` continua fazendo sentido?
5. A rota `mesas/:sub?` (`App.tsx:73`) aceita mesmo qualquer `sub`? E o `else` da linha 91
   (`setSubTab('rascunhos')`) não engoliria `descartados` antes de a aba existir?
6. Esconder o seletor de status (T5.3) quebra algum teste existente de
   `DiscordDraftReviewTable`? Rode a suíte e conte.
7. O comentário das linhas 257-260 (não exibir contagem) — a spec manda preservá-lo. Ele
   ainda faz sentido numa aba dedicada onde o purge é a ação principal, ou virou obsoleto?

---

## §Fase 6 — Filtros do catálogo (R17, R18, R19, R20)

**Arquivos:** `CatalogoPage.tsx`, `SealToggle.tsx`, `StyleFacetPicker.tsx`, `index.css`,
`parseDiscordAnnouncement.ts`, `tables.ts`, `migration_152_normalize_setting_styles.sql`
**Seções:** `spec.md` §Gap 10 · `plan.md` §Fase 6 · `tasks.md` T6.1–T6.16, §A4

A spec cruzou uma auditoria externa (Gemini) com o fonte e concluiu: 2 itens procedem,
1 não existe, 1 procede parcialmente, e **1 está diagnosticado errado** (`capitalize`).

**Derrube — esta fase tem duas teses independentes:**

**Tese A — a auditoria externa errou nos itens 1 e 5.**
1. O `<p>` "Cada nível é um nó…" existe mesmo em algum lugar do frontend? A spec afirma
   zero ocorrências. Procure com variações de acento, quebra de linha e concatenação de
   string — pode estar montado dinamicamente.
2. Confirme que ele vem de `CatalogSystemFilter` — ou mostre que a spec errou a origem.
3. **A tese do `capitalize` se sustenta?** A spec afirma que `tables.ts:372` faz
   `GROUP BY style` sobre string exata, logo dois chips. Confirme a query. Depois verifique
   se **o frontend deduplica** em algum ponto (`useStyleFacets`, `StyleFacetPicker`) —
   se deduplicar, a conclusão da spec cai.

**Tese B — a causa raiz é `splitFreeTextList`.**
4. `splitFreeTextList` (1422-1428) faz mesmo só `split` + `trim`?
5. **É mesmo o produtor da sujeira?** A `migration_152` limpou 8 variantes em 2026-07-17.
   Verifique se as variantes que ela limpou poderiam ter vindo do parser — ou se vieram de
   importação legada/formulário, o que mudaria a causa. Cheque a data de criação das mesas
   afetadas se conseguir, ou o `@author: spec-081` da migration.
6. Existem **outros** pontos de escrita de `setting_styles` além do parser? A spec manda
   medir em T6.10 mas **não mediu**. Meça você e liste — se o formulário for a fonte
   principal, a Fase 6 está atacando o alvo errado.
7. A normalização proposta (capitalizar cada palavra, preservar preposição) quebra algum
   estilo real existente? Liste os estilos do seed/migrations e simule.
8. `.app-select` é usado fora do catálogo? Mudar a altura tem raio maior do que a spec
   admite? Liste os consumidores.
9. As 3 alturas citadas (`SealToggle.tsx:22`, `CatalogoPage.tsx:462`, `index.css:156`)
   produzem mesmo alturas diferentes **renderizadas**? `text-xs` vs `text-sm` muda
   `line-height` — calcule a altura final de cada um, não só o padding.

---

## §Fase 7 — Consolidar aba "Mesas" (R5, R6)

**Arquivos:** `ConteudoSection.tsx`, `ModeracaoSection.tsx`, `App.tsx`
**Seções:** `spec.md` §Gap 3 · `plan.md` §Fase 7 · `tasks.md` T7.1–T7.16

A spec afirma que a aba `tables` de `/gestao/catalogo` tem **10 funções** a migrar para
`/gestao/mesas`, e que removê-la de lá não deixa link morto.

**Derrube:**

1. **Conte as funções você mesmo, do zero.** A spec diz 10. Ela dizia **9** até
   2026-08-19, quando o próprio agente recontou ao redigir este handoff e achou o erro
   (registrado em `tasks.md` §Erros do agente). Recontagem independente: `:263-264` busca,
   `:265-284` facetas, `:288-292` lote, `:293-304` ações de linha. Dá 10? A tabela do
   `plan.md` §Fase 7 lista a última ação de linha **sem número** — confira se ela ainda
   induz ao erro, e se o número 10 foi propagado a `spec.md` R5, `tasks.md` T7.2 e T7.8.
   **Um erro de contagem já encontrado neste ponto é indício de que há outros por perto.**
2. Os handlers listados (`:109`, `:124`, `:148`, `:158`, `:184`, `:195`, `:78-81`) existem
   nessas linhas? Algum deles é compartilhado com **outra** aba de `ConteudoSection`? Se
   for, extraí-los quebra a aba que fica.
3. `fetchAllTables` (`:83`) usa `GET /api/v1/admin/tables`. Essa rota tem paginação? A spec
   não menciona — se a aba nova herdar uma listagem não paginada de todas as mesas, isso é
   defeito que a migração propaga.
4. A linha 104 (`if (tab !== 'tables') return;`) — a spec manda adaptar para a sub-aba.
   Existe outro efeito com a mesma condição que passaria despercebido?
5. `TAB_VALUES` (`:69`) é lido de `?tab=` (`:74-75`). Remover `'tables'` quebra algum link
   **externo** (blog, e-mail, doc)? Procure `?tab=tables` em todo o repo, inclusive `.md`.
6. `TableDuplicatesPanel.tsx:96` traz comentário dizendo que `/gestao/catalogo?tableId=`
   não é rota tratada. Leia o comentário inteiro — ele contradiz algo que a spec propõe?
7. A spec põe esta fase por último "porque é a única que remove algo". Isso é verdade?
   A Fase 3 remove `VTT_ALIASES` e a Fase 2 remove um diretório inteiro — a justificativa
   de ordenação se sustenta?

---

## Perguntas transversais (envie a QUALQUER um dos sete, ou a um oitavo auditor)

1. A spec tem 20 requisitos e 10 gaps. **Todo requisito é rastreável a um gap, e todo gap
   gera requisito?** Monte a matriz e aponte órfãos dos dois lados.
2. `AGENTS.md` §Evidência exige medição citada em toda afirmação. **Encontre afirmações da
   spec sem comando que as sustente** — em especial adjetivos ("já existe", "não existe",
   "sempre", "nunca") sem `arquivo:linha`.
3. A spec registra em `tasks.md` §Evidência que o agente **errou** ao afirmar que
   `vtt_platforms` não era criada por migration alguma. Procure **outros** erros da mesma
   classe: conclusão tirada de busca em escopo incompleto.
4. As decisões D1–D4: D1 e D4 são do mantenedor, D2 e D3 do agente. **A classificação está
   certa?** Alguma decisão "técnica" do agente é na verdade decisão de produto disfarçada —
   ou o contrário?
5. Sete fases, sete PRs. **Alguma fase depende de outra de forma não declarada?** A spec
   declara só que Fase 2 precede Fase 3. Procure acoplamento oculto — em especial Fase 3
   (`setting_styles` via `Tema(s)`) com Fase 6 (normalização de `setting_styles`): a spec
   afirma que estão conectadas, mas as põe em fases distintas com PRs separados. Isso
   significa que entre o merge da Fase 3 e o da Fase 6 o sistema fica **pior** (fonte nova
   de dado sujo, sem normalização)? Se sim, a ordem está errada.

---

# Resultados da auditoria (2026-08-19)

Oito auditores independentes rodaram em paralelo (7 fases + 1 transversal), todos
read-only. **48 achados** no total. Cada achado abaixo traz: `arquivo:linha` citado pela
spec → o que a spec afirma → o que o código realmente diz → comando rodado → por que muda.
Registram-se também os achados **laterais** (não perguntados no bloco da fase) e o que cada
auditor **conferiu e estava correto**, para que se saiba o que foi coberto de fato.

---

## Fase 1 — Parser: vagas lidas de data (6 achados)

**Veredito:** a cadeia causal mecânica `25/08 → 25` (etapas 1–5) está correta; o problema
está na etapa 6 e na suficiência do fix. A Camada C tem mecanismo falso.

1. **[GRAVE] Camada C tem mecanismo falso — a "vaga real" não é candidata da função.**
   `spec.md:88-91`, `plan.md:56-65` → a spec afirma que o `return` da linha 1015 impede que
   "1 disponível de 4" seja avaliada. → O código diz: a regex do par (`:1009`) é
   `/(\d{1,3})[^\S\r\n]{0,3}\/[^\S\r\n]{0,3}(\d{1,3})/` — exige `/` literal; "1 disponível
   de 4" não tem `/`. → `node -e` com a regex do par e de `RE_SLOT_X_DE_Y`. → Com `return`
   ou `continue`, essa função nunca avaliaria a linha de vaga; a classificação "passo 6 é o
   mais grave" não decorre do código para este anúncio (há exatamente um par `/` no texto,
   o `25/08`, e o sinal semântico está num par `de` fora do domínio da função).

2. **[GRAVE] R9 não é alcançável pela correção proposta.** `spec.md:244`, `tasks.md:23-25`
   → a spec afirma que as 3 camadas fazem o anúncio produzir as vagas declaradas. → Nenhuma
   das 9 estratégias casa "1 disponível de 4"; `RE_SLOT_X_DE_Y = \d\s{1,3}de\s{1,3}\d`
   exige o número imediatamente antes de "de"; "disponível" no meio quebra. → `node -e` com
   `RE_SLOT_X_DE_Y` (`"2 de 6"` casa, `"1 disponível de 4"` não). → Após o guard recusar
   `25/08`, a cascata cai em `{total:null,open:null}`; nada produz `{total:4,open:1}`. A
   correção remove o falso positivo mas **não entrega o positivo** — exige capacidade nova
   ("N disponível de M") que não está no plano.

3. **[GRAVE] Metade da lista de regressão é invenção de cobertura.** `plan.md:88`,
   `tasks.md:36-37` → a spec afirma que `8/25` e `"1 vaga / grupo de 5 pessoas"` já estão
   cobertos por teste. → `rtk rg "8/25|grupo de 5|slotsGroupSize|1 vaga / grupo"` nos dois
   arquivos de teste → zero; `slotsGroupSize` (função viva, linha 1073) é código sem teste.
   → `1/4` e `"Vagas Disponíveis: 1/4"` têm teste; os outros dois não.

4. **[GRAVE] Guard "faixa plausível" tem falso positivo sobre caso real e contradiz a spec.**
   `plan.md:41-43` → a spec propõe rejeitar por faixa e afirma "nenhuma mesa tem 25 vagas".
   → Corpus real `discord-announcements-real.txt:179` tem `"30/24 restando 6 vagas"`
   (`second=24>20` e `first=30>second`); teste `parseDiscordAnnouncement.test.ts:684` tem
   `"4/1 Vagas Abertas"` esperando `total=4`. → `rtk rg "/[2-9][0-9]"` no fixture. → Ambos
   os sentidos do sinal 3 rejeitam vaga legítima; e o mesmo `plan.md` lista `8/25`
   (`second=25>20`) como formato a preservar — contradição interna.

5. **[MODERADA] A ordem das linhas (passo 6) não tem medição.** `spec.md:74-89` → a spec
   afirma que a linha da data vem antes da linha da vaga. → `rtk rg
   "1539593774265671751|25/08|essa chamada|disponível de 4"` no repo → zero fora da spec. →
   A ordem não é verificável no repo e a spec não cita comando que a mediu (§Evidência).
   Secundário ao achado 1 (a ordem é irrelevante para o desfecho).

6. **[MENOR] Sinais "zero à esquerda" e "contexto" têm falso positivo.** `plan.md:39-40` →
   "`08` com zero à esquerda é forma de data, **nunca** de contagem de vaga". → `"3/08"`
   (3 de 8) é grafia plausível de vaga; e "contexto" colide com `real.txt:671-672` (data
   adjacente à linha de vaga). → "nunca" é forte demais, sem medição de falso positivo.

**Conferido e correto:** `slotsLabeledNumericPair` 1003–1018; filtro 1008 é
`/(?:vagas?|lugares?|jogadores?)/i`; regex do par na 1009 é `N/N`; guard 1013 é
`first>100||second>100`; `return` na 1015; `classifySlotPairLine:994` devolve `generic`;
`slotsFromNumericPair:969` → `ambiguous()` com `Math.max`; `slotsXdeY` guard
`second>=1&&second<=20`; `extractSlots` 9 estratégias (1067–1080). Suíte:
`rtk pnpm vitest run` → 218/218 verde.

---

## Fase 2 — Migrations: os dois órfãos (7 achados)

**Veredito:** a conclusão "os objetos existem em produção" sobrevive, mas por evidência
diferente da citada; a evidência citada é condicional. Inventário impreciso.

1. **[CRÍTICO] A inferência de existência repousa em caminho condicional, e "a cada clique"
   é factualmente falso.** `spec.md:164-165`, `plan.md:100-103` → a spec afirma que
   `tables.ts:830` insere "a cada clique". → `tables.ts:828` é
   `if (variant && (variant === 'with_metrics' || variant === 'without_metrics'))` e só
   então `:830` insere; fica em `try/catch` que devolve 500 logado. → `rtk rg "variant ===
   'with_metrics'|insertInto\('table_click_events'\)"`. → A prova citada não sustenta a
   afirmação forte. **Porém a conclusão sobrevive por outra via não citada:**
   `gmPanel.ts:1636` faz `selectFrom('table_click_events')` **incondicional** — todo GM que
   abre insights derrubaria a rota se a tabela faltasse. T2.2 ("medido para dois") está
   incompleto: há uma terceira referência, mais forte.

2. **[ALTO] `clicks_count` NÃO é órfão — já criado por `migration_16`.** `spec.md:161,166-167`
   → a spec trata tudo de `007_` como fora do framework. → `migration_16_table_metrics.sql:14`
   cria `table_metrics` **já com** `clicks_count INTEGER DEFAULT 0 NOT NULL`. → O
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS clicks_count` do `007_:5-6` é redundante com o
   caminho canônico. → O inventário de T2.1/T2.7 fica impreciso: a coluna não é passivo a sanar.

3. **[ALTO] Contradição interna: `plan.md:535` "Sem migration nesta spec (decisão D2)" vs.
   Fases 2/3/6 que criam migrations.** → Fase 2 cria `migration_158`; T3.5 migration de
   aliases; T6.12 migration de normalização; `spec.md:292` (D2) diz o oposto. → Sobra de
   rascunho pré-D2; a atribuição a D2 está invertida (D2 **exige** migration).

4. **[MÉDIO] `AGENTS.md` §Migrations item 2.1 lido ao contrário.** `plan.md:124-129` → a
   spec usa 2.1 para justificar arquivo único. → O item diz que migrations **independentes**
   justificam **separar**; a própria spec admite que VTT e click tracking "não têm relação".
   → A escolha pode ser defensável por "uma operação só", mas não pelo item 2.1.

5. **[MÉDIO] A suspeita de não-idempotência aponta o statement errado.** `plan.md:118`,
   `tasks.md T2.4` → a spec suspeita do `ALTER TABLE table_metrics`. → Esse é
   `ADD COLUMN IF NOT EXISTS` (idempotente). O risco real é `006_:51-54`:
   `UPDATE tables SET game_platform_legacy = game_platform WHERE game_platform IS NOT NULL
   AND game_platform_legacy IS NULL` — backfill sobre coluna **depreciada** `game_platform`
   (`types.ts:258`). → Se essa coluna for dropada, a transcrição da 158 quebra.

6. **[MÉDIO] A varredura nova (T2.8) acusaria SOMENTE os 2 órfãos.** `plan.md:158-162`,
   `tasks.md T2.9` → a spec assume risco de ".sql de outros apps". → `rtk git ls-files --
   '*.sql'` lista ~180 arquivos; os únicos fora de `apps/*/database/`, `apps/*/db/migrations/`
   e `specs/*/phase-*-measurement.sql` são exatamente `006_` e `007_`. → R15 é mais simples
   do que a spec enquadra; não há passivo alheio a allowlistar.

7. **[BAIXO] Há uma segunda classe de SQL invisível ao runner.** `spec.md:156` → a spec
   enquadra a invisibilidade como exclusiva dos órfãos. → Dentro de `apps/mesas/database/`
   há 4 arquivos que também não casam `migration_*.sql`: `init.sql`, `backfill_slots_open.sql`,
   `changelog_ux_catalogo.sql`, `apply_migrations_06_07.sql` (com `RAISE EXCEPTION`). → Fora
   do escopo de R14/R15, mas o diagnóstico "dois órfãos" está incompleto.

**Achado lateral:** `shared.ts:77` — a citação tem defasagem de 1 linha; o
`selectFrom('vtt_platforms')` está na 78.

**Conferido e correto:** allowlist tem exatamente 3 padrões; `MIGRATIONS_DIR:13` =
`./apps/mesas/database`; glob `migration_*.sql` em `lib_migrations.sh:157`; ambos sem header;
`--diff-filter=AM` em `_enforce-migration-dir.yml:75`; `is_allowed_sql_path` 41-51 + self-tests
53-68; nenhum outro workflow cobre o passivo (R15 não é redundante); `vtt_platforms` criada
só pelo `006_`; 158 = próxima livre (máx. é 157).

---

## Fase 3 — "Tema(s)" e aliases (6 achados)

**Veredito:** a tese da "causa única" tem dois fundamentos factualmente falsos; o diagnóstico
do Gap 5 (tema ausente dos dois conjuntos) continua correto, mas a evidência de suporte não.

1. **[1ª ordem] `normalizeLabelKey` remove parênteses; a spec afirma o contrário.**
   `plan.md` §Fase 3a, `tasks.md T3.2` → a spec afirma que `normalizeLabelKey` "não remove
   parênteses". → `normalizeLabelKey:1630` = `normalize(value).replace(/\s+/g,' ').trim()`, e
   `normalize:197` contém `.replace(/[^a-z0-9\s]/g, ' ')` — troca `(` e `)` por espaço.
   `normalizeLabelKey("Tema(s)")` → `"tema s"`. → A conclusão operacional acerta por acaso
   (ambos normalizam para `"tema s"`), mas T3.2 instrui o executor a "confirmar por teste"
   uma afirmação que o teste **vai refutar**.

2. **[1ª ordem] "Classificação Indicativa foi removido da descrição" é falso.** `spec.md`
   §Gap 5 → a spec usa isso como prova de coerência. → A linha 1959 tem só `'classificacao'`
   (uma palavra); o label real é "Classificação Indicativa" (duas palavras), que `splitLabelLine`
   produz como `"classificacao indicativa"`, **ausente** do `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS`
   → não é removido. E `age_rating` vem de `extractAgeRating` (regex `\+\s?18\b` sobre o corpo),
   independente do Set. → O que a spec cita como prova de coerência é um caso **não** removido —
   reforça o bug, não a coerência.

3. **[conclusão] "Roll20 já é reconhecido nas 6 ocorrências" não decorre.** `tasks.md` §A3
   → a spec conclui que o impacto "não se observa na amostra". → O matching de VTT só recebe
   `platformsLabelValue` (`extractLabelValue(['plataforma','plataformas']) ?? ['local do
   jogo']`) ou `vttContextLines` (verbo de uso). Das 6 ocorrências reais, **4** estão em label
   `"Local:"` (495, 545, 690, 845) que não casa `'local do jogo'` nem tem verbo → **não chegam
   ao matcher**. → Há falha **observada**, e R3/R4 **não consertam** essas 4 (o defeito é o
   label "Local:" não consumido — gap **não listado** na spec).

4. **[menor] `migration_106` lista 9 VTTs, não 10.** `spec.md` §Gap 2 → "confirmada por
   `migration_106` tem 10 plataformas". → A 106 lista 9 slugs no `CASE` e no `WHERE IN`,
   omitindo `tableplop`. → Citação de evidência não sustenta o que afirma (a 106 confirma 9).

5. **[contradição] `plan.md:535` "Sem migration (decisão D2)" vs. Fases 2/3.** (idem Fase 2,
   achado 3).

6. **[inconsistência] A regra "só alias de 3+ caracteres" não decorre do guard citado.**
   `plan.md` §Fase 3b, `tasks.md T3.4` → a spec exclui siglas de 2 letras citando que
   `allowShortAliases=true` desliga o guard da linha 269. → O guard desligado protege
   `normCandidate.length < 4` (1, 2 **e 3** caracteres). Com ele desligado, `FGC` (3 chars) tem
   o mesmo risco de falso positivo que `TS`/`FG`. → A fronteira "3+" é arbitrária frente ao
   argumento; pelo argumento a regra deveria ser "4+".

**Achado lateral (numeração de migrations):** o diretório `apps/mesas/database/` tem
numeração duplicada — dois `migration_105_`, dois `106_`, dois `107_`, dois `17_`, dois `18_`.
Relevante para `reconcile_migrations.sh --mark-applied <version>` e para fixar "158"/"159".

**Conferido e correto:** `extractLabelValue` na 2578; `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS`
1949-1960 sem `tema`; `settingName` na 2584; `splitLabelLine:1634` (`Tema(s):` passa);
`candidateMatchesText:243`; guard `length<4` na 269 + resíduo `length<2` na 270;
`allowShortAliases=true` na 626 desliga o guard; `VTT_ALIASES` 60-73 + comentário de risco
55-59; CRUD `vttPlatforms.ts:202/265/359` cria VTT **sem** campo de alias; `system_aliases`/
`scenario_aliases` comparáveis; N+1 não introduzido (`routes/discord/utils.ts:48-50` documenta
carga única por batch); §A3 reproduz (Foundry 16, Owlbear 8, Roll20 6, FoundryVTT 3; variantes 0);
1030 linhas = 33 anúncios (27 efetivos), único corpus de anúncio no repo.

---

## Fase 4 — Copiar no draft (4 achados + 1 hipótese refutada)

**Veredito:** o predicado de D1 (`publishedSlug`) está errado para o fluxo central; a hipótese
do prompt (staleness do preview) foi refutada.

1. **[GRAVE] `publishedSlug` não é predicado confiável de "mesa copiável".** `plan.md` §4b,
   `spec.md` R2, `tasks.md T4.6` → a spec declara `publishedSlug` como "exatamente o predicado
   de D1". → `publishedSlug` vem de duas vias **admin** que só checam `status === 'active'`
   (efeito 158-176 e `handlePublishTable:79`), sem `archived_at` nem expiração. O `loadTable`
   proposto usa `GET /api/v1/tables/:slug` — rota **pública** que aplica `isPublicTable` =
   `active && !archived_at && !isImportedTableExpired` (`tables.ts:638-647`,
   `tableVisibility.ts`), e **toda mesa deste fluxo é `origin: 'imported'`**
   (`syncHelpers.ts:338`), com expiração em ≤5 dias. → O botão renderiza e a cópia falha para
   o fluxo central da spec. T4.5 está formulada sobre a variável errada (auth em vez de
   visibilidade/expiração); o fallback "rota admin" deveria ser o caminho **primário**.

2. **[hipótese refutada] "Publicar com preview aberto não atualiza `publishedSlug`" — falso.**
   → `handlePublishTable` chama `setPublishedSlug(slug)` direto da resposta do PUT (linha 79),
   fora do efeito. → O botão aparece imediatamente ao publicar via preview.

3. **[MENOR] Publicação fora do preview não re-dispara o efeito.** O efeito depende de
   `[draft.table_id]` (não muda). Publicar em outra aba/tela com o preview aberto não atualiza
   o estado; o botão "Publicar mesa" continuaria visível (`!publishedSlug`), permitindo PUT
   redundante (idempotente).

4. **[MENOR] A solução "botão fora do container" exige reestruturação.** `div.flex-1.overflow-auto`
   (linha 317) é container único das três abas; o bloco 362-366 está aninhado dentro. "Fora do
   container" = novo nível de aninhamento ou condicional por `activeTab`. A alternativa
   `sticky top-0` (que a spec já lista) é a que funciona sem reestruturar.

5. **[MENOR] `copyTextToClipboard` sem fallback.** `whatsappAnnouncement.ts:379-384` lança
   `TypeError('Clipboard unavailable')` se `navigator.clipboard` não existir; sem
   `document.execCommand`. Em produção existe; em iframe sem `allow=clipboard-write` falha.
   A spec assume reuso sem registrar essa dependência de ambiente.

**Conferido e correto:** 362-366 renderizam o mesmo `<pre>` para as duas abas;
`selectedPayload` na 91 como descrito; `isTableAnnounceable:19` =
`status==='active' && !archived_at`; `<pre>` dentro de container com scroll (317); efeito
158-176 como descrito; botão "Publicar mesa" 406-415 e link 416-425 conferem;
`copyTextToClipboard:379` reusado em `ConteudoSection.tsx:14`; `ConteudoSection.tsx:298`
`hidden: status!=='active'||!slug`; Gap 1 correto (sync cria `draft`, só "Publicar" torna active).

---

## Fase 5 — Aba Descartados (4 achados + 1 observação)

**Veredito:** a premissa central da fase — "restaurar não existe / descarte é mão única na
UI" — é **falsa**.

1. **[GRAVE] "Restaurar não existe" é falso: o preview já restaura.** `spec.md:138-140,299`,
   `plan.md:369`, `tasks.md:228` → a spec afirma que 426/505 escondem as ações para `rejected`,
   logo não há como reverter. → O caminho já existe: linha do descartado → preview →
   "Editar status" (`DiscordDraftPreview.tsx:299-303`, gate só em `synced`) → `needs_review` →
   Salvar (`useDraftForm.ts:631-649` → `updateDraft` = `PATCH /drafts/:id`). As linhas 426/505
   escondem só checkbox e botões de linha, não o editor de status do modal. → R13 adiciona
   atalho de linha a algo que já funciona; o enunciado repetido em 4 lugares está errado.

2. **[MÉDIO] "Botões de mutação escondidos para rejected" é verdade só na linha, não no preview.**
   `plan.md:376-378`, `tasks.md:219-220` → No preview, "Reparsar" (383), "Salvar campos" (395)
   e "Editar status" (299) **não** têm gate de status. "Salvar campos" → `submitCorrection` →
   `registerDraftCorrection` lança **422** "Draft rejeitado não pode ser corrigido"
   (`utils.ts:184`); "Reparsar" → `POST /:id/reparse` (`drafts.ts:372-386`) só bloqueia `synced`,
   re-deriva o status e sobrescreve `rejected` — **segundo** vetor de "des-descartar" ignorado.

3. **[MÉDIO] R12 "ver, editar" contradiz o backend.** `spec.md:247,329` → a aba promete
   "editar". → A única via de editar campos é `POST /:id/correction` → `registerDraftCorrection`,
   que para `rejected` retorna 422. → "Editar" descartado é impossível com o backend atual; a
   fase teria que reescrever R12 ou afrouxar um guard que existe de propósito (decisão de
   produto não registrada).

4. **[BAIXO] T5.3 não avisa que esconder o seletor precisa ser condicional; 2 testes dependem.**
   `tasks.md:209-211`, `plan.md:358-360` → `DiscordDraftReviewTable.test.tsx:193-201` e
   `:271-289` renderizam sem `lockedStatus` e dependem do seletor. → `rtk vitest run` → 16/16
   PASS hoje; esconder incondicionalmente quebra os 2.

**Observação menor:** `plan.md:353-356`/`tasks.md:204-206` citam o `else setSubTab('rascunhos')`
(linha 91) mas **não** o initializer do `useState` (`ModeracaoSection.tsx:78-83`), que tem a
mesma cadeia `sub === 'rascunhos'/'mensagens'/'duplicatas'` e precisa do mesmo `'descartados'`.

**Conferido e correto:** as 4 rotas existem nas linhas citadas; PATCH aceita restaurar sem
guard bloqueando a saída de `rejected`; `needs_review` é destino válido (CHECK migration_118
`status<>'ready' OR missing_fields=[]`); **não existe trigger** em `discord_import_table_drafts`;
`DELETE /rejected` filtra por origem; `mesas/:sub?` aceita qualquer `sub`; comentário 257-260
continua válido; todas as citações de linha do frontend conferem.

---

## Fase 6 — Filtros do catálogo (5 achados)

**Veredito:** origem do texto "Cada nível é um nó" é fabricada; a "causa raiz = parser" foi
rotulada sem medir os outros pontos de escrita.

1. **[GRAVE] Origem fabricada do `<p>` "Cada nível é um nó".** `spec.md:198`, `tasks.md:243`
   → a spec afirma que o texto "vem de dentro de `CatalogSystemFilter`". → `CatalogSystemFilter`
   (definido dentro do próprio `CatalogoPage.tsx:72`) só renderiza `<p>` em loading ("Carregando
   sistemas...") e erro ("Sistemas indisponíveis."); nada com "Cada nível é um nó". →
   `rtk rg "Cada nível" apps/mesas/frontend/src` → zero. → A spec afirma "não existe no fonte"
   **e** "vem de `CatalogSystemFilter`" na mesma célula — contradição lógica; a origem foi
   inventada. (A primeira metade — o texto não existe — está correta.)

2. **[MÉDIO] "Três alturas" conta o `.app-select` errado.** `spec.md:199`,
   `plan.md:393-396` → a spec aponta `SealToggle:22` (30px), input `:462` (42px) e `.app-select`
   (`index.css:156`, padding 0.5rem). → No catálogo os `<select>` usam `app-select ... py-2.5`
   (`:483,:496,:508`), e `py-2.5` vence o padding base (utility > components) → o `.app-select`
   renderiza **42px**, igual ao input. A terceira altura distinta real é o botão "Limpar"
   (`:542`, 38px), que a spec cita só para borda. → A fileira está em dente de serra, mas a
   contagem "três" e a atribuição estão erradas.

3. **[MÉDIO] Causa raiz apontada sem medir os outros pontos de escrita.** `spec.md:214,222-224`
   → a spec atribui a sujeira ao parser como causa singular. → `rtk rg -n "setting_styles"`:
   **3 outros pontos** escrevem — editor de draft (`draftFormUtils.ts:451-452`, texto livre
   sem normalização), formulário (`mapper.ts:150`) e painel do mestre (`gmPanel.ts:968`). →
   O `exploração` atual pode ter vindo do editor, não do parser; não há como saber sem `SELECT`
   de origem (que a spec **não fez**, e admite). T6.10 manda medir mas não mediu.

4. **[LEVE] "8 variantes" quando a migration limpou 9.** `spec.md:220-221`, `plan.md:449`,
   `tasks.md:424` → a migration 152 faz 2 UPDATEs: 8 no primeiro (26-34) + `'Miastério' → 
   'Mistério'` no segundo (47-56). → A contagem e a categorização estão erradas (dos 8 listados,
   só 1 é typo; o único outro typo real, `Miastério`, sumiu do relato).

5. **[MÉDIO] A regra genérica proposta não cobre a classe "typo".** `plan.md:448-451`,
   `T6.12`, `T6.11` → a spec propõe substituir a lista fixa por regra genérica (initcap + trim).
   → A 152 fazia duas coisas: normalização de capitalização/pontuação **e** correção de typos
   (`Saobrevivência`→`Sobrevivência`, `Miastério`→`Mistério`). A regra genérica só cobre a
   primeira; `initcap("Saobrevivência")` = `"Saobrevivência"` (não corrige o typo). → R20 fica
   incompleto para a classe typo, e o aceite 12 só cobre capitalização.

**Conferido e correto:** `tables.ts:372` faz `GROUP BY style` sobre `unnest(setting_styles)`
(string exata); o frontend **não deduplica** (`useStyleFacets` só valida shape, `StyleFacetPicker`
renderiza `{style}` cru) — a tese do `capitalize` se sustenta; `splitFreeTextList:1422-1428` =
split + trim; `@author: spec-081`, `@created: 2026-07-17`; `.app-select` usado em ~40 lugares
de ~17 arquivos (advertência procede); seed de 28 estilos não é quebrado pela normalização proposta.

**Limitação:** não acessei o banco de produção — não pude medir `created_at`/`origin`/`source_url`
das mesas afetadas, nem `SELECT DISTINCT unnest(setting_styles)`.

---

## Fase 7 — Consolidar aba "Mesas" (5 achados)

**Veredito:** a migração das 10 funções tem inventário e citações corretos; os achados são de
contagem/descrição, um deles da mesma classe do erro 9→10 já documentado.

1. **[1ª ordem] `spec.md:62` conta "5 abas de taxonomia"; o código tem 4.** → `ConteudoSection.tsx:25`
   `CatalogTab = 'systems'|'platforms'|'scenarios'|'setting-styles'|'tables'` — 4 de taxonomia
   + 1 `tables`. `TAB_LABEL` (28-34) tem 5 entradas no total. → A frase lista 4 nomes e diz "5",
   e "mais uma aba tables" implicaria 6. Mesma classe do erro 9→10.

2. **[1ª ordem] `spec.md:64` diz que a aba "lista mesas publicadas"; a rota lista qualquer status.**
   → `adminTables.ts:301-304` (comentário do próprio handler): "Lista mesas de **qualquer status**
   (spec 060)". Faceta Status (`ConteudoSection.tsx:270-274`) tem 5 valores: draft/active/full/
   cancelled/ended. → Contradiz a própria R5/`plan.md:482` (migrar faceta de 5 status). A aba é
   de *todas* as mesas incl. rascunhos órfãos, não de "publicadas".

3. **[contradição] `plan.md:490` ainda lista a 10ª ação sem número.** → A tabela §Fase 7 numera
   1 a 9, e a última linha é `| — | Linha: Apagar | :303 |`. → O claim `tasks.md:442` "corrigido
   nos quatro pontos" é falso para o plan.md; a tabela-fonte do erro segue induzindo.

4. **[MÉDIO] Paginação ausente em `GET /api/v1/admin/tables`; spec silente.** → `adminTables.ts:305-329`
   faz `query.execute()` sem `LIMIT`/`OFFSET`; `fetchAllTables` (`ConteudoSection.tsx:89`) sem
   parâmetros de página. → A sub-aba nova herda listagem não paginada de todas as mesas; lacuna
   de medição que a migração propaga.

5. **[MENOR] `plan.md:492-495` "bloco coeso" omite helpers.** → Os handlers dependem de
   `normalizeTables` (50), `extractErrorMessage` (36) e `AdminTableRow` (16), nenhum listado. →
   Extrair só os símbolos listados não compila isolado.

**Conferido e correto:** 10 funções recontadas do zero (1 busca + 2 facetas + 3 lote + 4 linha
= 10, ranges batem); handlers nas linhas citadas, nenhum compartilhado com outra aba; exatamente
um `useEffect` com `if (tab !== 'tables') return;` (103-107); `TAB_VALUES`/`?tab=` corretos;
`rtk rg "tab=tables" .` → zero fora dos docs (remover `'tables'` não quebra link algum);
`DashboardSection.tsx:35` aponta `/gestao/catalogo` sem `?tab=`; `TableDuplicatesPanel.tsx:96`
não contradiz a proposta (`?tableId=` ≠ `?tab=tables`); ordenação da Fase 7 se sustenta.

---

## Transversal (11 achados)

1. **[CRÍTICO] O anúncio Kingmaker (message_id `1539593774265671751`) não existe no repo.**
   `spec.md:74-76,97-113` → as Fases 1 e 3 se apoiam em corpo de anúncio sem proveniência.
   → `rtk rg "1539593774265671751"` → zero fora da spec; `rtk rg "hexploração|gestão de reino|
   combate entre exércitos|Tema\(s\)"` → zero; o único corpus (`discord-announcements-real.txt`)
   tem um anúncio Kingmaker **diferente** (linha 1010). → Os dois "defeitos" prioritários se
   apoiam em evidência não reproduzível. Mesma classe do erro registrado em `tasks.md:447-451`.

2. **[GRAVE] `8/25` e `"1 vaga / grupo de 5 pessoas"` não são "formatos já cobertos".**
   (idem Fase 1, achado 3). E `8/25` (second=25) contradiz o guard "faixa plausível" da Camada A.

3. **[GRAVE] Fase 3 ↔ Fase 6: acoplamento oculto cria janela de regressão + quebra de teste.**
   `spec.md:226-228`, `tasks.md:111-112`, `spec.md:254` → a spec declara só "Fase 2 precede
   Fase 3", mas a Fase 3 (Tema(s) alimenta setting_styles via splitFreeTextList) e a Fase 6
   (normaliza o mesmo splitFreeTextList) estão em PRs separados. → Entre os merges o sistema
   fica **pior** (fonte nova de dado sujo sem normalização) — a spec escreve isso literalmente
   sem corrigir a ordem. E **T3.1** fixa `['a','b','c']` minúsculo enquanto R19/Fase 6 capitaliza
   → a Fase 6 **quebra a asserção de T3.1**. A ordem está errada ou a janela precisa ser declarada.

4. **[GRAVE] "Os objetos existem em produção" é inferência de código, não medição de produção.**
   `spec.md:163-167` → "medido pelo código que os usa". → `tables.ts:830` e `shared.ts:77` são
   referências, não medição de estado. Não há `SELECT`/`psql \d` contra a VM citado. →
   `table_click_events` em particular é fraca: o insert é condicionado a `variant` (500 engolido
   no catch). Violação de §Evidência.

5. **[GRAVE] `exploração` de novo hoje não prova que o produtor seguiu produzindo.** `spec.md:218-224`
   → a 152 nunca capitalizou `exploração` (só removeu o ponto de `Exploração.`). → O `exploração`
   minúsculo pode ser dado pré-existente que a 152 não tocou, não "dado novo". A prova reivindicada
   não existe.

6. **[MÉDIO] `migration_106` confirma 9 VTTs, não 10.** (idem Fase 3, achado 4). Achado lateral:
   o arquivo `tableplop.webp` **não existe** no diretório de logos (só 9 `.webp`).

7. **[MÉDIO] Contradição `plan.md:535` "Sem migration (D2)".** (idem Fase 2, achado 3).

8. **[MÉDIO] D3 (destino de restauração `needs_review`) é decisão de produto, não técnica.**
   `spec.md:295-299`, `tasks.md:216-218` → o CHECK da migration_118 só restringe `ready`; escolher
   para onde o descartado volta é comportamento observável de fluxo de moderação. → R13 (`spec.md:248`)
   diz "draft/needs_review" (dois destinos), T5.5 fixa só `needs_review` — deriva não registrada.

9. **[MÉDIO] Residual do erro 9→10: tabela do `plan.md` §Fase 7 ainda tem a 4ª ação sem número.**
   (idem Fase 7, achado 3).

10. **[MÉDIO] `plan.md:335-336` conta "três pontos de uso do mesmo botão" — são dois, e um não
    é "o mesmo botão".** → `rtk rg "CopyAnnouncementButton"` → usado em 2 lugares
    (`TableCardDashboard.tsx:225`, `TableActionPanel.tsx:27`); `ConteudoSection.tsx` **não usa**
    o componente — importa as funções e reimplementa inline (158-182). → R1 fala "terceira
    reimplementação", o plano "quarta divergência" — duas contagens que não batem entre si nem
    com o código.

11. **[MÉDIO] D2 propõe tabela que já diverge do padrão citado + colisões de numeração.**
    `plan.md:194-203` → omite `is_official` (presente em `system_aliases`/`scenario_aliases`) e
    usa `VARCHAR(100)` onde as referências usam `TEXT`. → E o diretório tem **86 arquivos /
    72 números distintos**, com colisões em `06`×3, `07`×2, `11`×3, `12`×2, `17`×2, `18`×2,
    `104`×2, `105`×2, `106`×2, `107`×2, `108`×3. "158 = próxima livre" é verdade, mas a
    numeração não é sequência limpa.

**Respostas às 5 perguntas transversais:**
1. **Matriz requisitos × gaps:** completa, sem órfãos. Ressalva: R19/R20 atribuídos ao Gap 10,
   mas motivação é híbrida Gap 5 + Gap 10 — vínculo notado mas não refletido na matriz nem na ordem.
2. **Afirmações sem comando:** achados 1, 4 e 5. Padrão: adjetivo de estado ("existe", "entrou",
   "real") sem a consulta que o sustente.
3. **Erros da classe "busca em escopo incompleto":** além do registrado, achados 1 (anúncio ausente),
   2 (formatos sem teste — busca que confirmou em vez de matar a hipótese), 6 (busca pelo
   corroborante, não pelo contraditor).
4. **Classificação D1–D4:** D1/D4 certas; D2 majoritariamente técnica (fio de produto: alias no
   CRUD = feature nova); **D3 é a errada** — destino de restauração é decisão de produto.
5. **Dependência oculta:** sim, Fase 3↔6 (achado 3). A spec declara Fase 2→3 e Fase 7→5, mas
   omite justamente o acoplamento mais perigoso.

**Achado lateral (working tree):** `git status` mostra modificações não relacionadas à spec 093
em `apps/accounts/*`, `packages/comments/*` e `specs/090/*`. Não toquei — registro apenas.

**Limitação:** nenhum auditor teve LSP/Serena; todos usaram `rtk rg`/`rtk read`/leitura direta
(fallback documentado no AGENTS.md para conferência de linha exata e literal).
