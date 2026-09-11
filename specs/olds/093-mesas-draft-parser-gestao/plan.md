# Plano 093 — Mesas: draft, parser e gestão

Execução em 8 fases. Ordem por risco decrescente e dependência real: o bug de parser que
corrompe dado a cada import primeiro; a reconciliação de migration antes de qualquer
migration nova (a Fase 2 cria tabela, e criar migration num diretório com passivo fora do
contrato seria construir sobre o defeito); depois o aditivo; e a movimentação de UI por
último, porque é a única que remove algo de uma tela existente.

```
Fase 1  parser: vagas         (R7, R8, R9)
Fase 2  migrations: contrato  (R14, R15)      ← precede a Fase 3, que cria tabela
Fase 3  aliases + Tema(s)     (R3, R4, R10, R16, R19)
Fase 4  copiar no draft       (R1, R2, R11)
Fase 5  aba Descartados       (R12, R13)
Fase 6  filtros do catálogo   (R17, R18, R20)
Fase 7  campos sumidos na mesa (R21, R22, R23, R24)   ← página pública
Fase 8  consolidar aba Mesas  (R5, R6) + fechamento
```

Cada fase fecha com gate de cruzamento e PR próprio contra `dev`.

**Acoplamento Fase 3 ↔ Fase 6 (auditoria, transversal 3) — resolvido movendo a
normalização.** A Fase 3 faz `Tema(s)` alimentar `setting_styles` via `splitFreeTextList`;
a Fase 6 normalizava esse mesmo `splitFreeTextList`. Em PRs separados, entre um merge e o
outro o sistema fica **pior**: fonte nova de dado sujo, sem normalização. Pior ainda, T3.1
fixava `['a','b','c']` minúsculo, asserção que a Fase 6 quebraria.

Correção: **R19 (normalização na escrita) migra da Fase 6 para a Fase 3**, junto da mudança
que abre a fonte nova. A Fase 6 fica com R17, R18 e R20 (migration do estoque, que independe
e pode vir depois). A spec já dizia, por escrito, que as duas estavam conectadas — e mesmo
assim as separava; a auditoria pegou a contradição.

---

## Fase 1 — Parser: vagas lidas de data (R7, R8, R9)

**Arquivo:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`

### O defeito, em três camadas

`slotsLabeledNumericPair` (linhas 1003-1018) tem três problemas independentes. Corrigir
só um deixa o bug vivo por outro caminho — por isso os três entram juntos.

**Camada A — sem guard de data.** O guard atual (linha 1013) é `first > 100 || second > 100`.
`25/08` passa. Precisa reconhecer que o par é uma data e recusá-lo.

Sinais disponíveis para distinguir data de vaga, do mais forte ao mais fraco:

1. **Contexto textual imediato**: `dia`, `data`, `sessão`, `início`, nome de mês. Em
   `"ter jogo já dia 25/08"` o token `dia` precede o par.
2. **Zero à esquerda**: `08` com zero à esquerda é forma de data, nunca de contagem de
   vaga. `"1/4"` e `"8/25"` não têm; `"25/08"` tem. Sinal barato e específico.
3. ~~**Faixa plausível de vaga**~~ — **DESCARTADO pela auditoria (Fase 1 achado 4).** A
   versão anterior propunha rejeitar por `second <= 20` e afirmava "nenhuma mesa tem 25
   vagas". Refutado por dois casos reais:
   - `discord-announcements-real.txt:179` → `"▬ Participantes: 30/24 restando 6 vagas."`
     (`second=24 > 20` **e** `first=30 > second`) — vaga legítima que o guard rejeitaria.
   - `parseDiscordAnnouncement.test.ts:684` → `"4/1 Vagas Abertas"` espera `total=4`, com
     `first > second`.

   Pior: o próprio plano listava `8/25` (`second=25 > 20`) como formato a preservar —
   contradição interna. **Este sinal não entra.**
4. **Forma completa de data**: `DD/MM/AAAA` e `DD/MM/AA` — o regex atual (`\d{1,3}`) não
   casa o ano, mas casaria o `25/08` de `25/08/2026`, então o guard precisa olhar o
   caractere seguinte.

Restam os sinais **1, 2 e 4**, e nenhum deles é suficiente sozinho:

- O sinal 2 ("zero à esquerda") foi enfraquecido pela auditoria (achado 6): `"3/08"` é
  grafia plausível de vaga. Trocar "**nunca** é vaga" por "indício, que só decide combinado
  ao sinal 1".
- O sinal 1 ("contexto de data") colide com `real.txt:671-672`, onde há data adjacente à
  linha de vaga. A janela de proximidade precisa ser medida contra o corpus, não escolhida
  de memória.

**Regra de aceitação da fase:** todo sinal proposto roda contra
`discord-announcements-real.txt` inteiro **antes** de entrar, contando falsos positivos.
Sinal que rejeite qualquer vaga legítima do corpus está fora — foi exatamente assim que o
sinal 3 caiu.

**Camada B — filtro de linha frouxo demais.** A linha 1008 aceita qualquer linha contendo
`vagas?|lugares?|jogadores?`. Prosa narrativa que mencione "jogador" vira candidata. A
palavra precisa estar em posição de rótulo ou próxima do par, não em qualquer ponto de um
parágrafo de 300 caracteres. Medir a distância entre o token e o par é o critério mais
simples que resolve sem quebrar os formatos reais já cobertos por teste.

**Camada C — `return` na primeira linha que casa (linha 1015).** Continua sendo um defeito
real de robustez: duas linhas com par `/` no mesmo anúncio, e a primeira vence
independentemente do sinal semântico. Corrigir coletando todos os candidatos e escolhendo
por precedência (semântico > genérico), com empate resolvido pelo primeiro.

> **Correção 2026-08-19 (auditoria adversarial, Fase 1 achado 1).** A versão anterior deste
> plano chamava a Camada C de "a mais importante", afirmando que o `return` impedia a linha
> `"1 disponível de 4"` de ser avaliada. **Mecanismo falso.** A regex do par (linha 1009) é
> `/(\d{1,3})[^\S\r\n]{0,3}\/[^\S\r\n]{0,3}(\d{1,3})/` — exige `/` **literal**. A frase
> `"1 disponível de 4"` não tem `/`, logo nunca seria candidata desta função, com `return`
> ou com `continue`. A Camada C não explica o desfecho deste anúncio; é melhoria de
> robustez para anúncios com dois pares `/`, não a causa do bug relatado.

**Camada D — a capacidade que falta (o que de fato entrega R9).** Descoberta pela auditoria
(Fase 1 achado 2), e é o item mais importante da fase.

Nenhuma das 9 estratégias da cascata captura `"1 disponível de 4"`. Medido:

```
RE_SLOT_X_DE_Y = new RegExp(`${D}${SP1}de${SP1}${D}`)   // linha 913
  "2 de 6"                     → [2, 6]     ✅
  "3 de 5 vagas"               → [3, 5]     ✅
  "1 disponível de 4 jogadores" → NULL      ❌
```

O regex exige o número **imediatamente** antes de `de`; o qualificador no meio quebra.
Consequência direta: com o guard de data recusando `25/08`, a cascata cai em
`{total: null, open: null}` — **o falso positivo some, mas o valor certo não aparece**.

Portanto R9 exige capacidade nova: reconhecer `N <qualificador> de M`, onde o qualificador
é o mesmo vocabulário que `classifySlotPairLine` (linhas 986-987) já conhece —
`disponíveis?`, `abertas?`, `livres?`, `restantes?`, `sobrando` para `open`; `ocupadas?`,
`preenchidas?`, `inscritos?` para `filled`. Reusar essas duas listas, não escrever
vocabulário paralelo (`AGENTS.md` §Compartilhado por padrão).

Onde encaixar: estender `slotsXdeY` (linhas 935-944), que já tem a semântica "X de Y" e o
guard de faixa, em vez de criar estratégia nova — assim a posição na cascata não muda.

### Trava de regressão

`extractSlots` (linhas 1067-1080) é uma cascata de 9 estratégias, com ordem justificada
por achados reais datados nos comentários (linhas 1069-1072 documentam por que
`slotsGroupSize` vem antes de `slotsTotalOpen`). **Não reordenar a cascata.** A correção
é interna a `slotsLabeledNumericPair`; a posição dela na linha 1074 fica como está.

### Testes

Estender `parseDiscordAnnouncement.test.ts`. Casos obrigatórios:

- Texto do Gap 4 → **`{total:4, open:1}`**, não `25` e não `{null,null}`. Só a Camada D
  entrega isso; guard sozinho devolve nulo e **não** atende R9.
- `"1 disponível de 4"`, `"2 abertas de 6"`, `"3 ocupadas de 5"` → Camada D, incluindo o
  sentido `filled`.
- `"dia 25/08"` em linha com "jogadores" → nenhum par de vaga.
- `"25/08/2026"` → nenhum par de vaga.
- Duas linhas com par `/` — genérica antes, semântica depois → vence a semântica (Camada C).
- **Não regredir** — `"Participantes: 30/24 restando 6 vagas"` (`real.txt:179`) e
  `"4/1 Vagas Abertas"` (teste `:684`) continuam produzindo o resultado atual. Foram estes
  dois que derrubaram o guard de faixa.

**Correção de cobertura (auditoria, Fase 1 achado 3).** A versão anterior afirmava que
quatro formatos já estavam cobertos por teste. Medido: `1/4` e `"Vagas Disponíveis: 1/4"`
têm teste; **`8/25` e `"1 vaga / grupo de 5 pessoas"` não têm** —
`rtk rg "8/25|grupo de 5|slotsGroupSize"` nos arquivos de teste devolve zero, e
`slotsGroupSize` (função viva, chamada na linha 1073) é código sem teste algum. A lista
antiga dava por coberto o que não era; escrever esses dois testes passa a ser tarefa da
fase, não pressuposto dela.

---

## Fase 2 — Migrations: trazer os dois órfãos para o contrato (R14, R15)

**Arquivos:** `apps/mesas/backend/migrations/` (remoção), `apps/mesas/database/` (destino),
`.github/workflows/_enforce-migration-dir.yml` (guard)

### O fato que decide a forma da correção

Os objetos de `006_` e `007_` **já existem em produção**. Medido pelo código que os usa em
runtime: `tables.ts:830` faz `insertInto('table_click_events')` a cada clique de mesa, e
`shared.ts:77` consulta `vtt_platforms` a cada parse. Se não existissem, essas rotas
falhariam a cada uso — não é inferência, é o que o app faz hoje sem erro.

Logo **não se reaplicam** os SQL. A correção é reconciliação: trazer o arquivo para o
diretório do contrato, em forma que seja segura de rodar contra um banco onde os objetos já
estão, e registrar como aplicada.

### Forma da migration

Numeração livre medida: última é `migration_157_profile_image_crop.sql` → usar **158**.
Nome sugerido: `migration_158_reconcile_orphan_backend_migrations.sql`.

**Idempotência é o requisito central aqui, não um detalhe** (`AGENTS.md` §Migrations item 2):
a migration roda contra banco que já tem tudo. `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` — e os `INSERT ... ON CONFLICT DO
NOTHING` do seed das 10 VTTs já vêm nessa forma no `006_` original (linha 42). Conferir
linha a linha: `ALTER TABLE table_metrics` no `007_` precisa de checagem antes de rodar.

Header obrigatório de 5 campos, copiado do vizinho verde mais recente (`migration_157`):
`@class: online-safe` (não há DDL destrutivo — só criação idempotente), `@requires-backup:
false`, `@author: spec-093`, `@created`, `@description`.

**Decisão a tomar por medição, não por gosto:** um arquivo único de reconciliação ou dois
(um por órfão). `AGENTS.md` §Migrations item 2.1 diz para **não fatiar** schema da mesma
spec quando as tabelas nascem juntas — aqui não nascem juntas (VTT e click tracking não têm
relação), mas também não são de PRs diferentes. Um arquivo único de reconciliação é mais
fiel ao que o item 2.1 protege (`MAX_AUTO_PENDING` conta arquivos) e ao propósito: é uma
operação só — sanar o diretório.

### Registro em `schema_migrations`

Depois de aplicada, o banco precisa saber que ela está aplicada, sem tentar recriar nada.
`scripts/deploy/reconcile_migrations.sh --mark-applied <version> <compose> <db_service>` é o
caminho oficial (`AGENTS.md` §Migrations item 5). **Isto é escrita em banco de VM — exige
aprovação nominal do mantenedor** (§Autorização). Chegar com o comando montado e medido,
não executar.

Se a migration for de fato 100% idempotente, rodá-la pela esteira normal também é seguro e
dispensa o `--mark-applied`. Medir qual dos dois caminhos se aplica **antes** de pedir
qualquer aprovação; a idempotência é verificável rodando o SQL duas vezes contra um banco
local.

### Remoção do diretório órfão

`rm` dos dois `.sql` e do diretório `apps/mesas/backend/migrations/` — zero referências no
repo (medido: `rtk rg` não achou nenhuma citação a eles fora deles mesmos). Preservar o
conteúdo integral dentro da migration 158, incluindo os comentários `COMMENT ON TABLE` do
`006_` (linhas 62-66), que são a única documentação desses objetos.

### Fechar o ponto cego do guard (R15)

`_enforce-migration-dir.yml:75` valida só `--diff-filter=AM` — arquivo pré-existente fora da
allowlist nunca é visto. Acrescentar uma varredura do repo inteiro: listar todo `.sql`
rastreado, aplicar `is_allowed_sql_path` (função já existente, linhas 41-51) e falhar se
sobrar algum.

**Trava de ordem, pétrea** (`AGENTS.md` §Bug achado): endurecer gate só **depois** do verde
comprovado localmente. Rodar a varredura nova localmente sobre o repo inteiro **antes** de
torná-la bloqueante — se ela acusar `.sql` de outros apps, isso precisa ser resolvido ou
explicitamente allowlistado no mesmo PR, nunca deixado para falhar no PR seguinte de outra
pessoa. Os self-tests das linhas 53-68 dão o padrão de como provar que o guard novo
funciona nos dois sentidos.

---

## Fase 3 — Parser: rótulo "Tema(s)", aliases e normalização (R3, R4, R10, R16, R19)

### 3a — Rótulo "Tema(s)" (R10)

Dois pontos, **ambos obrigatórios** — mexer só num deles troca um sintoma pelo outro:

| Ponto | Arquivo:linha | Efeito de omitir |
|---|---|---|
| `extractLabelValue(body, ['estilo', 'indicado'])` | `parseDiscordAnnouncement.ts:2578` | `setting_styles` continua `null` |
| `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS` | `parseDiscordAnnouncement.ts:1949-1960` | rótulo continua sobrando na descrição |

Formas a aceitar: `tema`, `temas`, `tema(s)`. `normalizeLabelKey` (linha 1630) só faz
`normalize` + colapso de espaço — **não** remove parênteses, então `tema(s)` precisa entrar
literalmente no conjunto, não basta `tema`. Confirmar isso com teste, não por leitura.

Cuidado registrado: não adicionar `tema` ao grupo de `settingName` (linha 2584,
`ambientacao/cenario/epoca`). Tema é estilo, não cenário — o anúncio do Gap 4 traz
`scenario_id: null` corretamente, e Kingmaker como cenário seria outro campo.

### 3b — Aliases de VTT e comunicação (R3, R4, R16) — **decisão D2: tabela**

**Arquivos:** migration nova em `apps/mesas/database/`, `shared.ts:60-96`,
`vttPlatforms.ts` (CRUD)

**Estrutura**, espelhando `system_aliases` (`migration_02:61-71`) e `scenario_aliases`
(`migration_107:18-30`) — não inventar forma nova:

```sql
CREATE TABLE IF NOT EXISTS vtt_platform_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vtt_platform_id UUID NOT NULL REFERENCES vtt_platforms(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  alias_slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- idem communication_platform_aliases
```

Confirmar a forma exata contra as duas migrations citadas antes de escrever — incluindo
índice em `alias_slug` e a decisão sobre `UNIQUE`. Seed: os aliases hoje no `VTT_ALIASES`
mais os da tabela abaixo, e os de comunicação.

**Loader.** `loadVttPlatformsForParser` (`shared.ts:76-87`) passa a fazer `LEFT JOIN` na
tabela de alias em vez de consultar o `Record`; `loadCommunicationPlatformsForParser`
(linhas 90-97) idem, trocando o `aliases: []` fixo. Ambos já carregam catálogo inteiro uma
vez por batch (comentário em `routes/discord/utils.ts:48-50` registra que é assim para
evitar N+1) — o JOIN não muda essa característica.

**Remover o `VTT_ALIASES`** ao fim, junto do comentário das linhas 57-59 que descreve o
risco de dessincronia — risco que a tabela elimina, e cujo comentário deixaria de descrever
o código real. Substituir por comentário curto explicando a origem (spec 093, D2).

**CRUD.** Expor os aliases na rota admin já existente (`vttPlatforms.ts:202/265/359`), para
que VTT criada pelo painel possa receber alias — que é o fundamento 2 de D2. Sem isso, a
tabela resolve metade do problema.

Lista canônica (`frontend/public/vtt-logos/README.md`, confirmada por
`migration_106_vtt_logo_filenames.sql`) — 10 VTTs. Cobertura alvo:

**Lista revisada após medição de anúncios reais** (ver `tasks.md` §A3). A versão anterior
deste plano incluía `R20`, `TS`, `FG` — removidos por evidência, não por preferência:
zero ocorrência em 1030 linhas de anúncios reais, e `findPlatformMatch` passa
`allowShortAliases = true` (`parseDiscordAnnouncement.ts:626`), desligando o guard de
comprimento cujo comentário (linhas 267-268) registra falsos positivos. **Regra desta spec:
só alias de 3+ caracteres que seja grafia plausível do nome.**

| VTT | slug | hoje | acrescentar |
|---|---|---|---|
| Roll20 | `roll20` | — | `Roll 20` (o `name` `Roll20` já casa as 6 ocorrências reais) |
| TaleSpire | `talespire` | — | `Tale Spire` |
| Quest Portal | `quest-portal` | — | `QuestPortal` |
| Tableplop | `tableplop` | — | `Table Plop` |
| Fantasy Grounds Unity | `fantasy-grounds-unity` | `Fantasy Grounds`, `FGU` | `FGC`, `Fantasy Grounds Classic` |
| Foundry VTT | `foundry-vtt` | `Foundry`, `FoundryVTT` | — |
| Tabletop Simulator (TTS) | `tabletop-simulator` | `TTS`, `Tabletop Simulator` | — |
| Owlbear Rodeo | `owlbear-rodeo` | `Owlbear` | — |
| D&D Beyond Maps | `dndbeyond-maps` | `D&D Beyond`, `DDB Maps`, `DnD Beyond` | — |
| Alchemy RPG | `alchemy-rpg` | `Alchemy` | — |

**Armadilha medida — alias curto, e por que a lista encolheu.** Já investigado, não resta
verificação pendente:

- `findPlatformMatch` chama `findEntryMatch` com `allowShortAliases = true`
  (`parseDiscordAnnouncement.ts:626`). Isso **desliga** o guard `normCandidate.length < 4`
  da linha 269 — cujo comentário (linhas 267-268) registra que aliases curtos "geram falsos
  positivos". Sobra apenas `length < 2` (linha 270).
- `candidateMatchesText` (linha 243) delimita por `(?:^|[\s,;:])…(?:[\s,;:]|$)` — mais
  restritivo que `\b`, então uma sigla não casa dentro de outra palavra. Mas casa qualquer
  ocorrência isolada dela no corpo do anúncio.
- `findPlatformMatchFuzzy` (linha 569) descarta tokens com menos de 4 caracteres, e o
  comentário das linhas 614-617 registra achado do Codex (PR #171): rodar fuzzy contra o
  corpo inteiro gera falso positivo. Por isso o fuzzy só roda sobre valor de label isolado.

Conclusão aplicada à tabela acima: siglas de 2 letras ficam de fora. O ganho seria zero
(nenhuma ocorrência real) e o risco é o que o próprio código documenta.

**Armadilha eliminada por D2** (era `shared.ts:57-59`): com a FK, slug ou name divergente
não produz mais `[]` silencioso — o alias pertence à linha da plataforma, não a uma chave
de texto que pode desalinhar.

**Aliases de comunicação (R16).** Seed para as 5 plataformas de
`migration_105_communication_platforms.sql:22-29`. Grafias plausíveis, mesma regra de 3+
caracteres: `Meet` e `Google Meet` (nome já cobre), `Teams` para Microsoft Teams, `Tele`
não — ambíguo demais. Medir antes de fixar a lista: rodar a mesma contagem de A3 sobre
`discord-announcements-real.txt` para as 5, e semear só o que aparece ou é grafia óbvia.
O backfill de texto livre (linhas 36-51 da mesma migration) pode ter criado entradas com
nome arbitrário; a migration de seed não deve assumir que só existem as 5 semeadas.

### Testes

- Cada uma das 10 VTTs reconhecida por pelo menos um alias novo ou existente.
- `"Fantasy Grounds Classic"` → `fantasy-grounds-unity` (não confundir com outra entrada).
- As 5 plataformas de comunicação reconhecidas (R16).
- Alias cadastrado pelo CRUD admin passa a ser reconhecido pelo parser — é o fundamento 2
  de D2 e o que o mapa hardcoded nunca permitiu testar.
- `"Tema(s): a, b, c"` → `setting_styles: ['a','b','c']` **e** descrição sem a linha.

---

## Fase 4 — Copiar no draft: anúncio e JSON (R1, R2, R11)

**Arquivo:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftPreview.tsx`

### 4a — Copiar JSON das abas Bruto e Normalizado (R11)

Achado que simplifica: as duas abas **compartilham o mesmo bloco de render** (linhas
362-366) e a mesma variável `selectedPayload` (linha 91). **Um botão serve as duas** —
não criar componente por aba.

Colocação. O `<pre>` está dentro de `div.flex-1.overflow-auto` (linha 317), que rola. Botão
posto no fluxo normal sai da tela em JSON longo — que é o caso comum aqui. Duas saídas
aceitáveis:

- **Preferida:** cabeçalho próprio do bloco, fora do container que rola, alinhado à direita
  acima do `<pre>`.
- Alternativa: `sticky top-0` dentro do container, com fundo opaco para não deixar o JSON
  passar por baixo.

Reuso obrigatório: `copyTextToClipboard` de `features/table/share/whatsappAnnouncement.ts`
(linha 379) — já usado por `ConteudoSection.tsx:14`. Não escrever outro helper de clipboard.

Feedback: `toast` (`react-hot-toast`, já em uso no `CopyAnnouncementButton`) e rótulo
transitório, seguindo o padrão de `isCopying` do mesmo componente. Acessibilidade: `aria-label`
dizendo **qual** aba está sendo copiada — "Copiar JSON bruto" / "Copiar JSON normalizado" —
já que o mesmo botão serve as duas.

### 4b — Copiar anúncio (R1, R2) — **decisão D1: só após publicar**

O preview já tem o estado necessário. `useEffect` das linhas 158-176 busca
`GET /api/v1/admin/tables/:table_id` e seta `publishedSlug` **apenas** quando
`record.status === 'active'` (linha 170). Ou seja, `publishedSlug` já é exatamente o
predicado de D1 — a mesa está publicada.

Renderizar `CopyAnnouncementButton` ao lado do link "Ver Mesa Publicada" (linhas 416-425),
sob a mesma condição `publishedSlug`.

**Contrato — invertido pela auditoria (Fase 4 achado 1).** A versão anterior propunha
`loadTable={() => fetchTableDetailBySlug(publishedSlug)}` (rota **pública**
`/api/v1/tables/:slug`), com a rota admin como fallback. **Está ao contrário.**

Medido: a rota pública aplica visibilidade — `active && !archived_at &&
!isImportedTableExpired` (`tables.ts:651`, `tableVisibility.ts`). E **toda mesa deste fluxo
nasce `origin: 'imported'`**, com expiração curta. Já `publishedSlug` vem de duas vias
**admin** que só checam `status === 'active'`, sem `archived_at` e sem expiração.

Consequência: o botão renderizaria e a cópia **falharia** justamente no fluxo central da
spec — mesa importada, publicada, porém expirada ou arquivada.

Portanto: **a rota admin é o caminho primário**, com `normalizeTableDetailPayload` sobre a
resposta. E o predicado de exibição não pode ser `publishedSlug` puro — precisa considerar
`archived_at` e expiração, senão R2 promete um botão que não funciona.

T4.5 estava formulada sobre a variável errada (autenticação, quando o problema é
visibilidade/expiração) — reescrita.

Não reimplementar o gerador. **Contagem corrigida (auditoria, transversal 10):** o
componente `CopyAnnouncementButton` é usado em **dois** lugares — `TableCardDashboard.tsx:225`
e `TableActionPanel.tsx:27`. `ConteudoSection.tsx` **não** usa o componente: importa as
funções e reimplementa inline (`:158-182`). Logo hoje há 2 usos + 1 reimplementação; o
preview seria o **terceiro** uso. As contagens antigas ("três pontos", "quarta divergência")
não batiam entre si nem com o código.

---

## Fase 5 — Aba Descartados (R12, R13)

**Arquivos:** `ModeracaoSection.tsx`, `DiscordDraftReviewTable.tsx`, `App.tsx`

### O que já existe (não reconstruir)

Backend completo — listar por status (`drafts.ts:69-72`), detalhe (`:84`), `PATCH` de status
(`:20`), purge (`:260-328`). Frontend: `statusFilter` (`DiscordDraftReviewTable.tsx:101`),
seletor (`:324`), `handlePurgeRejected` (`:263-281`), `hasRejected` (`:261`).

### O que muda

**Aba e rota.** `ModSubTab` (`ModeracaoSection.tsx:22`) ganha `'descartados'`; botão na
barra (linhas 153-163); entrada em `SUB_TAB_CONTENT` (linha 24); sincronização de URL
(linhas 88-91) — e atenção ao `else setSubTab('rascunhos')` da linha 91, que é o default
para sub desconhecido. A rota `mesas/:sub?` (`App.tsx:73`) já aceita o novo valor sem
alteração; confirmar por navegação real, não por leitura.

**Componente travado em `rejected`.** Passar prop nova (ex.: `lockedStatus`) que fixa
`statusFilter` e **esconde o seletor** — deixar um filtro de status visível dentro da aba
"Descartados" permitiria sair dela sem trocar de aba, o que contradiz a própria aba.

**Purge sempre visível na aba.** Hoje o botão depende de `hasRejected` (linha 261),
derivado da página carregada. Na aba dedicada, a ação é o propósito da tela. Manter o
`confirm` destrutivo (linhas 264-269) e **manter a decisão de não exibir contagem**, pelo
motivo já registrado no comentário das linhas 257-260: a página traz no máximo 100 linhas,
mas o purge é server-side e apaga todos — um número da página enganaria sobre o alcance.
Preservar esse comentário (regra de `AGENTS.md` sobre comentário explicativo).

**Restaurar (R13) — o que de fato não existe.** As linhas 426 e 505 escondem ações quando
`status === 'rejected'`. Adicionar ação "Restaurar" visível **somente** para `rejected`,
chamando o `PATCH` já existente. Destino: `needs_review` — o draft foi descartado, então
voltar direto para `ready` puliaria a revisão; `needs_review` devolve à fila certa.
Confirmar contra o `CHECK` da `migration_118_discord_drafts_invariant.sql`, que garante
`status='ready' => missing_fields=[]`, antes de fixar o destino.

**Ver/editar (R12).** O preview abre igual para `rejected` (nenhum guard o impede). Verificar
que os botões de mutação seguem escondidos nesse estado, para que "editar" não signifique
sincronizar um draft descartado sem antes restaurá-lo.

---

## Fase 6 — Filtros do catálogo: geometria, ruído e estoque sujo (R17, R18, R20)

**Arquivos:** `CatalogoPage.tsx:450-558`, `SealToggle.tsx`, `StyleFacetPicker.tsx`,
`index.css` (`.app-select`), `parseDiscordAnnouncement.ts` (`splitFreeTextList`), migration
de normalização.

Duas metades independentes: **aparência** (R17, R18) e **dado** (R19, R20). A segunda é a
que o relato do mantenedor não pedia mas que a medição encontrou, e é a que tem causa raiz.

### 6a — Geometria (R17)

Medido: `SealToggle.tsx:22` (variante `toolbar`) usa `px-3 py-1.5 text-xs`; o input de busca
(`CatalogoPage.tsx:462`) usa `py-2.5 text-sm`; `.app-select` (`index.css:156-157`) usa
`padding: 0.5rem 0.75rem; font-size: 0.875rem`. Três alturas distintas na mesma fileira
`flex items-center`.

Não corrigir com `py-` avulso por elemento — foi assim que divergiu. **Fixar a altura por
token**: uma altura de controle única (ex.: `h-10`) aplicada aos três, com o padding
horizontal livre. Isso torna a fileira imune ao próximo elemento que alguém acrescentar,
que é o defeito de fundo.

`.app-select` vive no CSS global e é usado fora do catálogo — medir os consumidores antes de
alterar (`rtk rg "app-select"`), porque mudar altura ali tem raio maior que esta section.

### 6b — Ruído de borda (R18)

Contados no fonte: input de busca (`:462`), `.app-select` (`index.css:153`), `SealToggle`
(`:22`), botão Limpar (`:542`), cada chip (`StyleFacetPicker.tsx:72`), popover (`:100`).

Substituir traço por superfície onde a borda só delimita — mas **preservar**: (a) o
`focus:border-[var(--artificio-brand)]` dos inputs, que é indicador de foco e cai sob as
Heurísticas de Nielsen e a regra de acessibilidade do `AGENTS.md` §Regras de Produto; (b) a
borda colorida do estado ativo dos chips e selos (`border-orange-500`,
`border-amber-300/50`, `border-purple-300/50`), que carrega o estado selecionado. Remover
essas duas transformaria redução de ruído em perda de informação.

Contraste do fundo escolhido precisa continuar distinguindo o controle do `--surface-subtle`
da section. Verificar contra `packages/ui` antes de inventar valor — `AGENTS.md` §Regras de
Produto proíbe divergir do design system por app.

### 6c — Rótulo "Estilos" (R17)

`StyleFacetPicker.tsx:63-64`: `items-center` com rótulo `text-[11px]` ao lado de chips
`text-xs`. A auditoria externa sugeriu `items-baseline`. Com a altura unificada de 6a, o
desalinhamento pode desaparecer sozinho — **medir depois de 6a antes de aplicar**;
`items-baseline` sobre alturas já iguais pode reintroduzir desalinhamento.

### 6d — Normalização de `setting_styles` (R19, R20) — a parte com causa raiz

**Rejeitar `class="capitalize"`** como correção. Fundamento medido: `tables.ts:372` faz
`GROUP BY style` sobre string exata, então `exploração` e `Exploração` já são **duas linhas
de faceta**. `capitalize` deixaria dois chips idênticos na tela com contagens diferentes —
pior que hoje. É maquiagem sobre defeito de dado.

**Escrita (R19).** `splitFreeTextList` (`parseDiscordAnnouncement.ts:1422-1428`) faz `split`
+ `trim` e nada mais. Acrescentar normalização para a forma canônica definida pela
`migration_152`: capitalização e remoção de pontuação terminal. Cuidado com nome composto
(`Dark Fantasy` — capitalizar cada palavra, não só a primeira) e com preposição interna
(`Fatia de vida` não vira `Fatia De Vida`). Extrair a regra para função testável e usá-la
tanto no parser quanto em qualquer outro ponto de escrita — a mesma regra em dois lugares
diverge (`AGENTS.md` §Compartilhado por padrão).

Medir os outros pontos de escrita de `setting_styles` antes de fechar: formulário de criação
de mesa, edição no painel do mestre e o editor de draft. Normalizar só o parser deixaria as
outras portas abertas.

**Estoque (R20).** Migration nova, no espírito da `migration_152` — mas **genérica, não
lista fixa de typos**: a 152 enumerou 8 casos conhecidos e por isso só resolveu aquele
estoque. Preferir normalizar por regra (`initcap`-equivalente + trim de pontuação) sobre
todos os valores, com dedup por `array_agg(DISTINCT …)` como a 152 já faz na linha 16.

**Não medi** o estado atual de `setting_styles` em produção — exigiria `SELECT DISTINCT
unnest(setting_styles)` no banco, que é leitura e não precisa de aprovação, mas não foi
executado nesta investigação. A migration precisa ser escrita depois dessa medição, não
antes, para não repetir o erro de lista fixa da 152.

### Ressalva de escopo desta fase

R17 e R18 mexem em aparência de página pública. Direção estética — quanto de borda vira
superfície, qual densidade — é decisão de produto do mantenedor, não do agente. O plano fixa
o que é **defeito objetivo** (alturas diferentes na mesma fileira; dois chips para o mesmo
estilo) e trata o resto como proposta a validar visualmente com ele antes do PR. Nenhuma
mudança de identidade visual, cor de marca ou densidade global sem palavra dele.

---

## Fase 7 — Campos que o mestre preenche e a página esconde (R21, R22, R23, R24)

**Arquivos:** `TableActionPanel.tsx`, `TableTechnical.tsx`, `TableContent.tsx`,
`tableViewMapper.ts`, `MesaPage.tsx`

### A regra, que vale além destes campos

Regra do mantenedor (2026-08-19): **tudo que o mestre preenche aparece; o que fica vazio,
some.** Não é regra desta fase — é da página. Campo novo que entrar no formulário depois
segue a mesma regra, sem precisar de spec.

O padrão já existe e é o que se deve copiar: `TableTechnical.tsx:34-45`,
`{vm.campaignLength && (<bloco>)}`. Nada de renderizar rótulo com valor vazio, "—" ou
"Não informado".

### Levantamento — o buraco é menor do que parecia

Dos 78 campos do ViewModel, a maioria **já é exibida** e já respeita a regra. Ausentes:

| Campo | Local escolhido | Por quê |
|---|---|---|
| `slotsTotal` + `slotsOpen`/`slotsFilled` | `TableActionPanel`, junto de Experiência/Modalidade | é decisão de entrar ou não; fica com o CTA |
| `city`, `state` | `TableActionPanel`, ao lado de Modalidade | quem lê "Presencial" pergunta "onde?" na mesma linha |
| `language` | `TableActionPanel`, junto de Experiência | é filtro de entrada, como nível |
| `scenario` | `TableContent`, junto de `settingName` | é conteúdo narrativo, não requisito |
| `actualGmName` | bloco do mestre | identidade de quem conduz |

### 7a — Vagas com total (R22)

Restaurar a linha removida em `TableActionPanel.tsx:128-129`, **sem** repetir o erro que
motivou a remoção. A remoção supunha que `vm.urgency` já cobria o dado; cobre em 3 dos 6
ramos (`tableViewMapper.ts:96-141`) — em "Mesa lotada", "desativada" e "encerrada" o número
some.

Formato: **"2 de 5 vagas"**, não "2 vagas". O total nunca apareceu na página, e sem ele o
leitor não sabe o tamanho do grupo.

Manter `vm.urgency` como está — ele dá o tom emocional ("🔥 Últimas 2"), a linha nova dá o
fato. Não são duplicata: um é alerta, o outro é ficha técnica. **Reescrever o comentário das
linhas 128-129** explicando por que a linha voltou, citando os 3 ramos que não mostram
número (`AGENTS.md` §Regras Gerais de Código — comentário explicativo não se apaga
silenciosamente).

Fonte do número: `slotsLeft` já existe no mapper (`:180`), e `slotsTotal`/`slotsOpen`/
`slotsFilled` já estão no ViewModel (`:232-234`) — nada a acrescentar ao mapper, só
renderizar.

Caso a decidir na implementação: mesa com `slots_total` preenchido e `slots_open` nulo. Pela
regra, mostrar o que existe ("Mesa de 5 jogadores") em vez de esconder tudo.

### 7b — Local (R23)

`city`/`state` no `TableActionPanel`, logo abaixo de Modalidade. Só quando preenchidos —
mesa online legítima não tem cidade, e mostrar rótulo vazio é ruído.

**É o caso mais grave desta fase**, acima das vagas: mesa presencial sem local publicado é
inútil para quem lê — não dá para saber se é na cidade da pessoa.

### 7c — Idioma, cenário e nome do mestre (R24)

- `language`: junto de Experiência. Verificar se há default `'pt-BR'` gravado em toda mesa —
  se houver, exibir só quando **diferente** do padrão, senão vira ruído em 100% das mesas.
- `scenario`: em `TableContent`, junto de `settingName`, que já é exibido ali.
- `actualGmName`: no bloco do mestre. Medir antes a relação com `masterName` — se forem
  iguais na maioria, exibir só quando divergirem.

### Trava desta fase

**Nenhum campo novo no formulário, nenhum campo novo no banco.** A fase só exibe o que já é
coletado e já viaja até o ViewModel. Se algum campo não chegar ao mapper, isso é achado
novo — medir e relatar, não inventar coluna.

---

## Fase 8 — Consolidar aba "Mesas" em `/gestao/mesas` (R5, R6)

**Arquivos:** `ConteudoSection.tsx` (origem), `ModeracaoSection.tsx` (destino), `App.tsx`

Última fase de propósito: é a única que **remove** algo de uma tela existente, e depende de
a Fase 5 já ter estabilizado a barra de sub-abas.

### Inventário — as 10 funções a migrar, sem perda (R5)

Da aba `tables` de `ConteudoSection.tsx:257-306`:

| # | Função | Origem |
|---|---|---|
| 1 | Busca por `title`/`status` | `:263-264` |
| 2 | Faceta Status (5 valores) | `:266-277` |
| 3 | Faceta Covil | `:278-284` |
| 4 | Lote: Arquivar | `:289` |
| 5 | Lote: Desarquivar | `:290` |
| 6 | Lote: Apagar (com confirm) | `:291` |
| 7 | Linha: Copiar anúncio (`hidden` se `status !== 'active'` ou sem slug) | `:294-300` |
| 8 | Linha: Publicar/ativar/cancelar | `:301` |
| 9 | Linha: Alternar Covil | `:302` |
| 10 | Linha: Apagar | `:303` |

Handlers a mover junto (bloco coeso, `ConteudoSection.tsx`): `handleDeleteTable` (:109),
`handleToggleTableStatus` (:124), `handleToggleCovil` (:148), `handleCopyAnnouncement` (:158),
`handleTablesBatch` (:184), `tableColumns` (:195), e o estado de fetch — `fetchAllTables`
(:83), `tables`, `tablesLoading`, `tablesError`, `copyingTableId` (:78-81).

**Extrair para componente próprio** (ex.: `AdminTablesPanel`) em vez de copiar o bloco para
`ModeracaoSection`. Motivo: `ConteudoSection` fica só com taxonomia, `ModeracaoSection` não
incha, e não há dois lugares para divergir depois — o defeito que esta fase existe para
corrigir. O gate da linha 7 (`hidden` por `status !== 'active'`) precisa sobreviver à
extração: é a mesma trava de D1/R2.

**Cuidado com o efeito de carregamento:** a linha 104 (`if (tab !== 'tables') return;`)
condiciona o fetch à aba ativa. A condição equivalente na nova casa é a sub-aba — não
deixar a nova aba buscar mesas enquanto o admin está em "Rascunhos".

### Remoção da duplicata (R6)

Tirar `'tables'` de `CatalogTab` (linha 25), de `TAB_LABEL` (linha 33) e de `TAB_VALUES`
(linha 69). `TAB_VALUES` é lido de `?tab=` na URL (linhas 74-75) — link antigo
`/gestao/catalogo?tab=tables` cairá no default. Redirecionar para a aba nova em vez de
deixar cair silenciosamente na primeira aba; a base já trata esse tipo de link morto com
`Navigate` (`App.tsx:79-82`) e com `LegacyModeracaoRedirect` (linhas 41-45).

Verificar links internos apontando para a aba removida antes de fechar — `rtk rg` por
`gestao/catalogo` no frontend. Já medido: `DashboardSection.tsx:35` aponta para
`/gestao/catalogo` (sem `?tab=`), e `TableDuplicatesPanel.tsx:96` traz comentário registrando
que `/gestao/catalogo?tableId=` **não** é rota tratada — ler esse comentário antes de mexer.

---

## Validação

Por fase: `cd apps/mesas/backend && rtk pnpm vitest run <arquivo>` e
`rtk tsc -p tsconfig.json --noEmit` (idem frontend). Nunca repo-wide durante as rodadas de
review — `AGENTS.md` §T0.

Repo-wide (`rtk pnpm run lint`, depois `build`, depois `test`, **um de cada vez**) só na
Fase 8, quando o mantenedor disser que não vem mais review.

`pnpm verify:api` (via `rtk pnpm verify:api`) antes de cada commit que toque `apps/**`.
Nenhuma fase altera contrato de rota — as rotas do Gap 7 já existem —, mas o comando roda
igual, pelo hook e pela regra.

**Três migrations nesta spec**, todas sob `AGENTS.md` §Migrations (header de 5 campos,
idempotência, diretório allowlistado):

| Fase | Migration | Requisito |
|---|---|---|
| 2 | reconciliação dos dois órfãos | R14 |
| 3 | `vtt_platform_aliases` + `communication_platform_aliases` | R3, R4, R16 |
| 6 | normalização de `setting_styles` | R20 |

Numeração: **não** assumir sequência limpa. O diretório tem 86 arquivos para 72 números
distintos, com colisões em `06`×3, `07`×2, `11`×3, `12`×2, `17`×2, `18`×2, `104`×2, `105`×2,
`106`×2, `107`×2, `108`×3 (medido pela auditoria, 2026-08-19). `158` é livre, mas confirmar
cada número antes de usar, e conferir o impacto em
`reconcile_migrations.sh --mark-applied <version>`, que recebe nome de arquivo.

*(Correção 2026-08-19: este parágrafo dizia "Sem migration nesta spec (decisão D2)" —
resíduo do rascunho anterior a D2 ser revisada. D2 **exige** migration; a frase afirmava o
oposto da decisão que citava. Achado pela auditoria adversarial, Fase 2 achado 3.)*
