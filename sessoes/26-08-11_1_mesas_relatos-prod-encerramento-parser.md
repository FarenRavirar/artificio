# 26-08-11_1 · mesas · relatos de produção: encerramento de mesa + URL do parser

- **Data:** 2026-08-11
- **Escopo:** `apps/mesas` (backend + frontend + database)
- **Origem:** 3 relatos do widget "Reportar problema" em produção (10/07, 22/07, 28/07) + 1 relato do mantenedor sobre draft do painel de importação (11/08)
- **Status:** correções implementadas e validadas localmente · **sem commit, sem deploy, migration não aplicada**

---

## Por que esta sessão existe

Quatro relatos chegaram como "3 bugs". A investigação mostrou que **dois não eram bug** — um já estava corrigido em produção, outro é regra deliberada — e que **dois eram defeitos reais**, um deles nunca reportado antes. O registro existe porque a diferença entre as quatro coisas não é óbvia pelo texto dos relatos, e o próximo agente que abrir esses tickets vai refazer a mesma investigação sem ele.

---

## R1 — "Problemas na edição de mesa" (Douglas dos Santos, 10/07) · **JÁ CORRIGIDO, nada a fazer**

**Relato:** editar mesa (banner, horário, vagas) criava uma mesa nova em vez de atualizar a existente.

**Medido:** `mapTableApiToInitialData.ts:98-102` já carrega o comentário do próprio incidente — *"Bug real (spec 081, reporte GM Douglas dos Santos 2026-07-10): id nunca era incluído aqui, entao useCreateTableForm.submit (initialData?.id)"*. Corrigido em `dfed661` e `90b8080` (18/07).

```
git merge-base --is-ancestor <sha do fix> origin/main  →  SIM (em produção)
```

A causa era `initialData.id` ausente: sem ele, `useCreateTableForm.ts:232-240` cai no ramo `POST /api/v1/gm/tables` em vez de `PUT /:id`.

**Ação:** nenhuma no código. Texto de resposta ao reporter entregue ao mantenedor no chat (oferece ajustar duplicatas criadas entre 10/07 e 18/07 — **quantas existem não foi medido**).

---

## R2 — "Sumiram as informações" (anônimo, 22/07) · **não era bug; virou correção de UX**

**Relato:** `/mesas/odisseia-dos-lordes-dragoes-mrnnvpg5` sem nenhuma informação. Falha de rede: `404 GET /api/v1/tables/odisseia-dos-lordes-dragoes-mrnnvpg5`.

**Medido:** a mesa existe e está `active`. O 404 vem de `isPublicTable` (`utils/tableVisibility.ts`), que esconde **mesa importada expirada** — regra deliberada da spec 089 T6B.1, extraída em 059/060 por achado do CodeRabbit para não divergir entre detalhe e Open Graph.

```
odisseia-dos-lordes-dragoes-mrnnvpg5 | origin=imported | criada 2026-07-16 | expirou 2026-07-21
```

Relato de 22/07 = um dia após expirar. **A regra funcionou.**

**O defeito real era outro:** o visitante recebia 404 e o frontend renderizava "Ops! Mesa não encontrada" — indistinguível de link errado. Escala medida no dia:

```
importadas expiradas ainda active   40
arquivadas                          24
importadas ainda visíveis hoje       0
```

**Decisão do mantenedor (2026-08-11):** tela "Mesa Encerrada" com data, autor (mestre / administração / auto-encerramento) e link "clique aqui para ver novas mesas" → catálogo. Regra de expiração **mantida intacta**.

### O que foi implementado

**`migration_156_table_closure_authorship.sql`** — `archived_by` (FK `users`, `ON DELETE SET NULL`) + `closed_reason` (`gm|admin|auto_expired`, CHECK idempotente via `DO $$`) + índice parcial. `online-safe`, header de 5 campos, sem DDL destrutivo.

**Autoria gravada em 2 pontos:** `gmPanel.ts:1314` (distingue `admin` de `gm` por `userRole`, porque a rota atende os dois) e `adminTables.ts:102` (sempre `admin`). Desarquivar limpa os dois campos.

**`GET /api/v1/tables/:slug`** — o filtro de visibilidade saiu da query e virou decisão de resposta:
- slug inexistente → **404**
- `draft`/`pending_review` → **404** (nunca foi pública; 410 revelaria que há rascunho naquele slug)
- existiu e saiu do ar → **410 Gone** + payload mínimo

O payload traz `slug`, `title`, `closed_at`, `closed_reason`, `closed_by_name` e **nada mais** — contato, formulário e dados do GM ficam de fora de propósito: mesa fora do ar não segue captando inscrição (teste trava a lista exata de chaves).

**`importedTableExpiryDate`** extraída de `isImportedTableExpired` — importada não tem `archived_at` (ninguém a encerrou, ela venceu), então sem essa data a tela não teria o que mostrar. As duas seguem com fonte única, que é o motivo de `tableVisibility.ts` existir.

**`MesaPage.tsx`** — estado `closed` próprio, normalizador tipado (payload de API é `unknown` até normalizar), data em `pt-BR`, SEO próprio. As rotas de interação (`/view`, `/click`, `/favorite`) mantêm 404 com filtro na query: mesa encerrada não recebe interação nova.

### Lacuna aceita, registrada

**As 64 mesas já encerradas não têm autoria e nunca terão.** `tables` só tinha `archived_at`; `table_history` existe com o schema certo (`changed_by`/`field`/`old_value`/`new_value`) e está **vazia — 0 linhas**, sem nenhum escritor no backend (schema morto). O dado nunca foi gravado; backfill inventado seria pior que ausência. Nessas mesas a tela mostra motivo derivado + data, sem nome.

---

## R3 — "Erro de redirecionamento para formulário" (anônimo, 28/07) · **defeito real, corrigido**

**Relato:** botão de inscrição em `/mesas/uma-nova-fabula-se-inicia-ms21l0mk` dá erro de "dynamic link" e não chega ao Google Forms.

**Medido — o dado gravado tem lixo de markdown na URL:**

```
form | https://forms.gle/mVvUiUTq7Z5yJTWT9)__     ← uma-nova-fabula (26/07)
form | https://forms.gle/b3uwFZeGNLQViQ1U7**      ← techno-jogos-do-anfitriao (19/07)
```

**Causa:** `trimTrailingUrlWrappers` removia `)`/`]` desbalanceados e pontuação `.,;:`, mas **não removia ênfase markdown** (`*`, `_`, `~`, crase). Em `[Form](url)__` o `)` caía e o `__` sobrevivia; em `**url**` nada era tocado.

**Correção:** `URL_TRAILING_EMPHASIS_RE` aplicada **dentro** do laço de convergência — os resíduos se intercalam, e uma passada única em qualquer ordem deixa resto.

**Nota sobre a pergunta do mantenedor ("parser não é só para admin? por que usuário relatou?"):** o parser é ferramenta de admin, mas o **resultado** dele vira página pública. `uma-nova-fabula` estava visível em 28/07 17:11, hora exata do relato (expirava só em 31/07). Ambas as mesas sujas são `origin=imported`, `gm_id` nulo — nenhuma criada por GM.

**Dano ativo hoje: zero.** As 2 URLs estão em mesas já expiradas, fora do ar. O fix impede a repetição na próxima importação.

**Dado sujo em produção:** as 2 linhas continuam no banco. `UPDATE` exige aprovação nominal do mantenedor (§Autorização) — **não executado**.

---

## R4 — imagem de embed virando `contact_url` (mantenedor, 11/08) · **defeito real, corrigido**

**Relato:** draft "Blue Lock - Awakening" no painel de importação gravou

```json
"contact_url": "https://i.pinimg.com/736x/48/08/4b/48084b3c88077a68eda0c950aced01c6.jpg"
```

— a imagem do embed do anúncio — e passou como "link válido". O mantenedor registrou que **o mesmo já ocorreu com YouTube e Spotify**.

**Causa:** `isSuspiciousUrl` validava **forma**, nunca **função**. `i.pinimg.com/....jpg` é URL sintaticamente perfeita, então passava. A validação por forma foi introduzida em 2026-07-10 corrigindo o defeito oposto — allowlist curta bloqueava site pessoal de GM real (`dm.yanbraga.com/join`) —, e o pêndulo foi longe demais: sem allowlist, passou a aceitar qualquer coisa bem formada.

**Correção em duas frentes:**

1. `isSuspiciousUrl` ganhou camada de **função**: `MEDIA_HOST_RE` (pinimg, pinterest, youtube, youtu.be, spotify, soundcloud, imgur, redd.it, tenor, giphy, cdn.discordapp, twimg) e `NON_CONTACT_FILE_EXTENSION_RE` (imagem, vídeo, áudio, pdf, zip) sobre o **pathname** — `?utm=x.png` na query não faz de um formulário uma imagem.

2. `extractContactUrl` passou a **filtrar mídia antes de eleger** o contato. Marcar `contact_url:suspicious` depois só bloquearia o `ready`; filtrando antes, o fallback `allMatches[0]` escolhe a **próxima** URL — que pode ser o formulário real. Teste cobre exatamente esse caso.

**Não virou allowlist de domínio:** o achado de 2026-07-10 continua respeitado — `dm.yanbraga.com/join` segue passando, com teste dedicado. O filtro recusa por **evidência positiva de mídia**, não por ausência de credencial.

---

## R5 — snowflake do Discord virando título (mantenedor, 11/08) · **defeito real, corrigido**

**Relato:** draft "Pokémon Mystery Dungeon: O Silêncio Vindo do Céu" gravou

```json
"title": "369323334355255297"
```

— o mesmo valor de `host_discord_id` e de `_raw_evidence.user_mentions: ["<@369323334355255297>"]`. Confiança 0.78, `confidence_tier: "alta"`, e `missing_fields` só com `start_time`: o draft passou como bom.

**Duas causas somadas — corrigir uma só não resolveria:**

1. **Label composto não reconhecido.** O anúncio usa `Título da Campanha:`; `extractLabelValue` compara a chave **inteira** por igualdade, e a lista tinha só `titulo`/`título`/`mesa`/`nome da mesa`/`aventura`. Sem casar, o título caiu no fallback de thread-name. **É exatamente o bug 5 da sessão `26-07-10_1`** (`Sistema de Jogo:` nunca batendo com `sistema`), reaparecendo em outro campo.

2. **Nada recusava snowflake como título.** `stripDecorativeMarkup` remove `<`, `@` e `>` pela `WHITELIST`, e o número sobrevive nu. `RAW_DISCORD_TOKEN_RE` já existia e trata menção crua — mas **só em `description`**, depois que host/menções foram extraídos (está escrito na definição dela). Título nunca passou por essa limpeza.

**Três caminhos de título, todos precisavam da guarda** — os dois primeiros fixes não bastaram, e a suíte provou:

| Caminho | Correção |
|---|---|
| `extractLabelValue` → `normalizeTitle` | remove `RAW_DISCORD_TOKEN_RE` antes da decoração + recusa snowflake |
| `splitThreadName` (`beforeColon`/`afterColon`/fallback) | idem — chama `stripDecorativeMarkup` direto, sem passar por `normalizeTitle` |
| `title \|\| threadName` (linha 2546) | **último fallback usava `threadName` CRU**, sem limpeza nenhuma — foi por aqui que o ID chegou mesmo com as duas guardas a montante |

`DISCORD_SNOWFLAKE_ONLY_RE = /^\d{17,20}$/` e `dropSnowflakeTitle` ficam no topo do módulo, usados pelos três. **Piso de 17 dígitos é deliberado:** título legitimamente numérico ("1974", "2001", "40000" de Warhammer 40k) não chega perto dessa largura — teste dedicado trava isso.

**Resultado quando não há nome real: `title: null`**, não o ID. O draft cai em revisão pedindo o nome, em vez de nascer com um número que ninguém reconhece como mesa.

---

## R6 — cadência e VTT no draft "Digimon RPG - Neon Hounds" (mantenedor, 11/08) · **dois defeitos reais, corrigidos**

Ambos diagnosticados a partir do JSON bruto do draft, sem precisar reimportar.

### R6a — "Sessões quinzenais / de 15 em 15 dias" não virava `frequency`

O draft trouxe `"frequency": null` (não `semanal`, como o relato supôs — `deriveFrequency` só infere `semanal` quando `type === 'campanha'`, e aqui `type` é `null`).

Regex anterior rodada contra o texto real do anúncio:

```
FALHA  sessões quinzenais / de 15 em 15 dias
OK     quinzenal
FALHA  de 15 em 15 dias
```

Dois furos: **plural** (`quinzenal(?:mente)?` não casa "quinzena**is**") e **"de 15 em 15 dias"** (só `a cada 15 dias` existia). O plural atingia as três cadências — `semanais` e `mensais` falhavam igual; texto de anúncio concorda com "sessões", então o plural é a forma comum.

Correção: `(?:l(?:mente)?|is)` nas três, com `-mente` em ramo próprio (juntar os sufixos aceitaria "quinzenalmenteis"), mais `(?:a cada|de)\s+15\s+em\s+15\s+dias`. Validado: 8/8 quinzenal, 3/3 mensal, 4/4 semanal, inválidas recusadas.

### R6b — VTT citada fora da linha "Plataforma:" nunca chegava ao catálogo

O draft trouxe `vtt_platform_id: null` com `_vtt_source_hint: "Discord"` — o hint da comunicação ocupando o campo da VTT.

**Owlbear Rodeo não era o problema:** está cadastrado (`vtt_platforms`, slug `owlbear-rodeo`), tem alias `['Owlbear']` (`shared.ts:64,70`) e fuzzy para typo desde 2026-07-16. Medição nos drafts reais: **9 de 10 menções casaram certo**, incluindo `"Discord, CRIS e OwlBear"`, `"Discord/owlbear"` e `"Discord + Owlbear."`.

**O que distingue os que funcionam:** todos citam VTT e comunicação na **mesma linha** de "Plataformas:". `platformsLabelValue` captura só o primeiro label — quando o anúncio diz "Plataforma: Discord" numa linha e menciona a VTT em prosa noutra, a VTT nunca é comparada com o catálogo. Por isso nenhum teste existente pegava.

**Correção — recorte por contexto de uso, não por label.** Quando o label não resolve a VTT, o parser varre as **linhas que falam de ferramenta** (`PLATFORM_CONTEXT_LINE_RE`: verbo de uso, "mapas", "combates", "fichas", "sessões", "vtt", "plataforma"), com match exato apenas (`fuzzyText: null` — fuzzy contra o corpo inteiro é o falso positivo barrado pelo Codex na PR #171).

O primeiro ramo também mudou: sem label dedicado ele caía em `fullText`, e era por aí que "a party enfrenta um **owlbear** na floresta" virava VTT. Agora as duas fontes exigem contexto — label dedicado, ou linha com sinal de uso.

**Princípio aplicado (mantenedor, 2026-08-11):** *se a informação está no texto, tem que ser extraída corretamente; não extrair é defeito do parser, não limitação do anúncio.* A primeira versão desta correção documentava "criatura vira VTT" como limite aceito, a ser corrigido pelo revisor no painel. Isso foi refeito: o que distingue "**usamos** Owlbear Rodeo" de "enfrenta um **owlbear**" está no próprio texto, então cabe ao parser ler.

Cobertura: 4 formas de prosa reconhecidas (`Usamos X`, `Os combates rodam no X`, `As sessões acontecem no X`, `Mapas: X`), criatura na sinopse recusada, e anúncio sem label dedicado passou a funcionar.

---

## Validação

| Comando | Resultado |
|---|---|
| `npx vitest run` (mesas-backend) | **735/735** ✅ (eram 712; +23 novos) |
| `npx vitest run` (mesas-frontend) | **216/216** ✅ |
| `npx tsc --noEmit` (backend) | limpo ✅ |
| `npx tsc --noEmit` (frontend) | limpo ✅ |
| `rtk pnpm run lint` (repo-wide) | **25/25** ✅ |

**Testes ajustados, não silenciados:** `tables.visibility.test.ts` afirmava `404 para mesa arquivada` — comportamento que mudou de propósito. Reescrito para cobrir 410 com autoria, 410 com motivo derivado (importada), ausência de contato no payload, e 404 preservado para rascunho/revisão/inexistente.

---

## Pendências — exigem autorização nominal do mantenedor

1. **Commit + PR** — nada commitado.
2. **`migration_156` não aplicada.** Última em prod é a `155` (84 aplicadas, 0 pendentes na medição de hoje). Entra pela esteira no deploy.
3. **Limpeza das 2 URLs sujas em produção** — `UPDATE table_contacts`, escrita em prod.
4. **Resposta ao Douglas (R1)** — texto pronto; o número de duplicatas criadas entre 10/07 e 18/07 **não foi medido**.

## Achado lateral — `table_history` vazia **não é lacuna de auditoria**

Registro inicial desta sessão dizia que `table_history` estava morta e que o próximo agente a presumiria funcional, sugerindo auditoria faltando. **Medição posterior desmentiu a parte que importa: a auditoria existe e funciona — só não é essa tabela.**

```
activity_log       167   ← auditoria real, 10 escritores no backend
update_log           5
table_history        0   ← prod E beta
imgur_cleanup_log    0
```

`activity_log` cobre exatamente o terreno de `table_history`, e com mais dado (`actor_role`, `summary`, `metadata` JSONB):

```
table.archived  44   table.created  35   table.updated  17   table.deleted  13
```

`table_history` nasceu na `migration_01_base_schema.sql:188` (seção "HISTÓRICO E AUDITORIA", com índice `idx_table_history_table`) e **nunca teve escritor**:

- código: 3 arquivos citam o nome, todos listas de tabelas para cópia (`hydrate_beta.py:43`, `adminEnrichment.ts`) — nenhum `INSERT`;
- banco: `pg_trigger` em `tables` → 0; `pg_proc` com `table_history` no corpo → 0.

É design de 2026-04 abandonado em favor de `activity_log`, não funcionalidade quebrada. **Ligar a tabela duplicaria a auditoria existente.** O que resta é débito de schema — objeto vazio que induz leitor a inferir lacuna inexistente (induziu o agente nesta sessão). Remoção exigiria migration `manual-risk` (`DROP TABLE`) e não tem urgência: a tabela não custa nada além de confusão.

**Decisão do mantenedor pendente:** remover em migration própria, ou deixar como está.
