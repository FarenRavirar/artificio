# Tasks 099 — Perfil do mestre

**Status: fase A executada (A1–A3, gate A fechado); fase B executada (B0–B11, gate B fechado com 1 pendência nomeada); fase C merged em `dev` pela PR #302 (C1 e C3 entregues, C2 já concluída com B3; C4 e gate runtime pendentes); fase E executada em 2026-09-01 por incidente em produção (E1–E3 concluídas); fase F implementada e revisada (F0–F5 + F6 do achado de revisão), com aceite runtime de F1b/F2/F4 e a decisão dos 6 espaçamentos pendentes; **fase G aberta em 2026-09-01** — o mantenedor recusou o editor em beta (casca centralizada, sem partes na lateral), nenhuma task iniciada, aguardando aprovação do desenho.** Decisões D1–D11 fechadas (`spec.md` §3).

Ordem de execução: **A → B → C**, com a fase de forma (**F**) em paralelo — ver a colisão com a 098 em F0.
Cada task só é dada como concluída com **medição citada** — comando rodado e o que voltou.

---

## Como usar este arquivo

0. **Antes da primeira task de cada fase, ler `spec.md` §3 (D1–D11) inteira.** As
   decisões são vinculantes e várias só aparecem como **não-fazer** — não têm task e por
   isso não aparecem em nenhuma coluna abaixo: **D1** (sem migration nem coluna nova),
   **D3** (avaliações intactas), **D6** (nada de busca por atributo), **D7** (nenhuma
   descrição por template), **D8** (sem controle de opacidade do banner). Quem só lê a
   tabela de tasks não é avisado dessas cinco.
1. **Antes de começar a task, ler a coluna "LER ANTES" inteira.** Não é sugestão: são as
   seções que carregam a forma do dado, a trava e o critério. Task executada sem elas
   reprova no gate.
2. **Ao fechar a task, preencher a medição** — o comando e o resultado, não "ok".
3. **Ao fim de cada fase, rodar o gate** (`plan.md`). Gate reprovado reabre a task.
4. **Validação pesada só no fim** — durante o trabalho, `rtk pnpm vitest run <arquivo>` e
   `rtk tsc -p tsconfig.json --noEmit` do pacote afetado. Repo-wide uma vez, no fim.

---

## Fase A — Fundação de dados

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **A1** | Investigar por que `selling_points` volta `{}` (objeto) — 7/12 no beta, 39/48 em prod — apesar do `DEFAULT '[]'::jsonb` | spec §2.2 (forma + achado medido) | **fechada**: causa do beta = hidratação `admin/sync/enrich` copiando de prod (ids batem; SELECTs no banco beta + 12 pontos de escrita lidos). Bloqueio nomeado: origem primária em prod não medida (spec §2.2) |
| **A2** | Normalizador tipado para `selling_points` na fronteira, antes de virar prop | spec §2.2 · critério A5 · A9 | **concluída**: `normalizeSellingPoints` em `useMestre.ts`, chamado em `normalizeMestreProfile`; 10 testes em `useMestre.test.ts`; A9: defeito reintroduzido → 4 falhas, restaurado → 10/10 |
| **A3** | **Separar "verificado" de "declarado pelo mestre"** no hero (`years_on_platform` já oculto quando 0 — medido) | **spec §12 (decisão + medição dos 7 perfis)** · spec §2.1 · plan fase A | **concluída**: `experience_years` com `Medal` + "Declara {n}+ anos de experiência" (sem `CheckCircle2`); `covil_verified` mantém `CheckCircle2`; 4 testes em `MestreHero.test.tsx`; A9: defeito reintroduzido → 2 falhas, restaurado → 4/4; `years_on_platform` já oculto quando 0; coluna e migration intactas |

**⚠️ Trava de A3 (revista por medição — ver spec §12):** `experience_years` (autodeclarado)
e `years_on_platform` (calculado de `created_at`) **são distintos e o código proíbe
fundi-los** (`gm.ts:181-184`, spec 081 T9.1).

**A task NÃO é "os três números viram um".** A pesquisa desaconselha escolher uma fonte às
pressas — isso destrói informação (spec §12.2). Medido: 3 de 7 mestres citam anos na bio, 2
contradizem a coluna, e `albuquerque` tem "15 anos" na bio com a **coluna vazia**.

O defeito real: o autodeclarado é exibido com o **mesmo ícone de verificado** do
`covil_verified`. A3 separa os dois. **O número dentro da bio não se toca** — é texto do
mestre, e o destino dele é B11 (D11, extração com confirmação).

**→ Fechar o GATE A antes de seguir** (`plan.md`).

---

## Fase B — Porta de entrada

### B-0 · Pré-requisito (bloqueia todas as outras)

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B0** | Consolidar a escrita no `PUT /api/v1/gm/profile`: **estender o PUT** com `experience_years`/`average_price` (medido: não aceitos hoje), migrar o `mutationFn` (upsert via POST quando `profile.gm` é null) e **alinhar `gmProfileSchema`** (+`tagline`/`selling_points`/`badges`/`promo_badge_text`; −`gm_style`/`tools`/`game_format`; nickname 2-40) | **plan §B.0 inteiro** (tabela das 4 camadas + Merge Endpoints) | **concluída**: PUT estendido (2 campos + returning), mutationFn migrado com upsert via POST, schema alinhado; backend 35/35 testes (8 novos em `gmPanel.profilePut.test.ts`; A9: 3 falham sem o campo), frontend 23/23 (A9: 1 falha com `gm_style` de volta); tsc limpo nos dois. **Resíduos pós-B0** (corrigidos no lote B1/B2): objeto `api` sem `put` (usado `apiClient` cru no hook) e slug derivado pode violar o regex `/^[a-z0-9-]+$/` do POST |
| **B0.1** | Conferir o write path de `closed_group_*` | plan §B.0, última linha | **concluída**: passa pelo `POST`/`PUT /api/v1/gm/profile` (gmPanel, destructuring + `.set`); não passa pelo PATCH; `systemProjectionHydrator` (admin) e hidratação beta nos demais |

**Por que primeiro:** hoje `tagline`, `selling_points`, `badges` e `promo_badge_text`
morrem no Zod e no handler **em silêncio** — o mestre digita, o indicador diz "salvo", o
dado some. Criar campo antes disto entrega porta falsa.

### B-1..B-5 · Campos, na ordem de custo × alcance

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B1** | Campo de `tagline` | spec §2.3 (**três cadeias**) · **§9 (fidelidade visual)** · D2, D7 · D10 | **concluída**: `TaglineField` (TextInput do pacote, max 200); grava via PUT; 3 cadeias conferidas por leitura (`MestreHero.tsx:112-113`, `ogDescription.ts:67-71`, `MestrePage.tsx:51`), nenhuma regredida |
| **B2** | Campos de `closed_group_*` (4 + liga/desliga) | spec §2.2 (**centavos** e **UUID**) · D9 · write path **medido** (plan B.0) | **concluída**: `ClosedGroupSection` (toggle `aria-pressed`, sistemas via SystemPicker multi gravando UUID, MarkdownEditor, preço reais→centavos); `reaisParaCentavos` com 12 testes e round-trip; A9 verificado |
| **B3** | Campos de `specialties`, `languages`, `badges` — **com a exibição junto** (C2) | spec §2.1 (órfãos dos 2 lados) · **§9** · plan "o que reusar" | **concluída**: `ProfileTagsSection` (TagInput ×3) + exibição `MestreHighlights` na página pública (chips saíram do `MestreBio` para a seção nova, sem duplicação); A9 verificado |
| **B4** | Campo de `selling_points` | spec §2.2 (**14 ícones fechados**, descarte silencioso) · **§9** | **concluída**: `SellingPointsEditor` — `Select` com as 14 chaves do dicionário compartilhado (`sellingPointIcons.ts`, cópia única exibição+editor); item inválido barrado no form; A9 verificado |
| **B5** | Campo de `promo_badge_text` | spec §2.1 · D9 | **concluída**: `PromoBadgeField` (max 120); faixa já renderizava no `MestreHero.tsx:67-72` (conferido por leitura, intocado); A9 verificado |

### B-6..B-9 · Qualidade da tela (D5, D10)

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B6** | Frase do ganho em todo campo recomendado, no padrão `EditorField` + `RECOMMENDED_GAIN` | **spec §8 (tabela campo→nível)** · D10 · plan "o que reusar" | **concluída**: registro único `RECOMMENDED_GAIN` (7 chaves) em `profileEditorDomain.ts`; 3 frases novas (`bioLong`, `experienceYears`, `links`); teste cruzado `profileRecommendedGain.test.tsx`; A9 verificado |
| **B7** | `aria-describedby` no controle de todo campo com erro/hint | **plan §B, armadilha 1** · critério A6 · **§11.1 (9/9 sem o atributo, medido)** | **concluída com pendência nomeada**: atributo explícito nos controles (campos novos + AvatarField/ImageUploader/LinksManager); A9 verificado. **Pendência**: `closed_group_systems` tem hint sem o atributo — o controle é o `CatalogTree` do `@artificio/catalog-ui`, sem prop de aria (medido); tocar o pacote exige aprovação |
| **B8** | Autosave: debounce real + **indicador que exista e fique visível** | spec §2.5 · **§11.1** | **concluída**: debounce 500ms com buffer no `ProfileContext.updateGm` (último valor vence, nada descartado — substitui o `if (isPending) return`); indicador sempre montado nas 3 tabs, `position: fixed`, estados erro/salvando/salvo; A9 verificado (2 pontos) |
| **B9** | Listar os sistemas escolhidos, não só contar; remover `Preço Médio` do front (D4) | spec §2.1 · §2.5 · D4 | **concluída**: `UserSystemsSelector` lista os nomes via catálogo; `average_price` removido da UI, do schema e do tipo `GmProfile`; banco e PUT intactos; A9 verificado |
| **B10** | Prévia do perfil público nas 3 telas (D5) e prévia do véu do banner (D8) | D5 · **D8** (scrim fixo — é decisão, não está na fase D do plan) | **concluída**: `MestreProfilePreview` reusa o `MestreHero` real (scrim D8 vem do próprio componente, sem réplica nem controle de opacidade) nas 3 telas: 1ª `/perfil?tab=mestre`, 2ª `/painel`, 3ª **editor de mesa** (`MasterPart` do TableEditor; identificação medida — spec §2.1 nomeia "editor de mesa" como superfície de edição e `OnboardingPage` medido sem campo gm). Mapeamento `buildMestrePreviewData` (gm→`MestrePublicData`, passa pelo `normalizeMestreProfile` real) em `profilePreviewMapping.ts`, separado do componente por exigência do lint `react-refresh/only-export-components` (padrão `cardPreviewMapping.ts`). CSS do hero movido de `MestrePage.css` para `MestreHero.css` (importado pelo componente — a prévia usa o hero real nas 3 telas sem importar a página pública; página pública inalterada, mesmas regras). A9: tagline fake → 2 falhas, restaurado 8/8. Validação: 6 arquivos 150/150 testes, `tsc` limpo, eslint 0 |

### B-11 · Extração assistida (D11) — por último na fase

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B11** | Extrair atributos da bio e **oferecer para confirmação** | D11 (**trava**) · plan §B "extração assistida" | **concluída (2026-09-01):** schema discriminado (`experience_years`/`specialties`/`languages`/`badges`) com `evidence` + `confidence` obrigatórios e `.strict()`; `POST /api/v1/gm/profile/bio-suggestions` autenticado, só `selectFrom`, sem nenhum caminho de escrita; a resposta fica em estado local do `BioAttributeSuggestions` e apenas `Confirmar e aplicar` chama `updateGm`; falha da IA devolve 503 não bloqueante e a bio segue editável. Cache de `llmAssist` generalizado por schema (era preso ao `extractedFieldsSchema` do anúncio). **Medição, conferida em revisão independente (2026-09-01):** backend 14/14, frontend 61/61, `rtk tsc -b` limpo nos 2 pacotes (`-b`, não `-p`: é o `-b` que inclui os tsconfig de teste e foi o que pegou o CI vermelho da PR #300), eslint 0 em 7 arquivos, `verify:api` verde com `mesas: breaking=0 non-breaking=1`. A9: autoaplicação reintroduzida → "analisar só mostra a sugestão" falhou com 1 chamada indevida a `updateGm`; restaurado → 61/61 |

**⚠️ Trava de B11:** nada é gravado sem confirmação. O F1 do Airbnb é 75% — gravar direto
erraria um em cada quatro atributos exibidos ao jogador. `llmAssist.ts` já fazia a chamada
com esquema + Zod; a medição de B11 encontrou o cache preso ao schema de anúncio e a task
generalizou essa leitura antes de ligar o schema da bio.

**Escalar substitui, lista acumula — é D11 implementado, não descuido.** `experience_years`
é sobrescrito ao confirmar; as três listas checam duplicata e acrescentam. A revisão
independente levantou a assimetria como possível defeito e a pesquisa na spec a
**descartou**: §12.3 define o caso de uso como *coluna vazia* com número na bio (3 de 7
perfis medidos) e a trava de D11 é "nada trava a publicação" — avisar antes de substituir
poria fricção onde a spec a proíbe, e confirmar é a fala do mestre, que a plataforma não
corrige. Registrado porque quem olhar só o código tende a "consertar" isso.

**Correções de review na PR #301, todas com A9:**

1. **Sugestão não sobrevive à edição da bio.** `evidence` é trecho literal do texto
   analisado; a lista ficava na tela depois de o mestre reescrever a bio, citando frase
   inexistente, e confirmar gravaria atributo tirado de bio antiga. Agora `isStale`
   (derivado, sem `useEffect`) esconde a lista, e a resposta em voo é descartada se a bio
   mudou. A9: `isStale = false` → 2 falhas apontando o botão de confirmar sobrevivente.
2. **Bio fora da auditoria** (P2 Codex, 2 rodadas). Eram **três** caminhos de persistência
   do rascunho em `discord_llm_decisions`, tabela sem retenção: `request_json` (bio
   inteira), `response_json` (corpo cru, com `evidence`) e `validated_result_json`
   (resultado validado, também com `evidence`). Fechei os dois primeiros na rodada
   anterior e **deixei o terceiro aberto** — o review acertou ao voltar. Agora a auditoria
   guarda só a *forma* da decisão: `bio_chars`, contagem de candidatos, quantos o filtro
   de evidência derrubou e quais campos. **Consequência aceita: a extração deixou de usar
   cache**, porque o cache lia exatamente `validated_result_json` e candidato sem
   `evidence` é inútil (o painel precisa do trecho). Custo baixo e medido pela forma da
   chave: `context_pack_hash` cobre a bio inteira, então só haveria acerto em reanálise de
   texto idêntico byte a byte. Quem segura custo por conta é o limiter (10/15min).
3. **`evidence` validada contra a bio** (P2 Codex). O schema aceitava qualquer string não
   vazia: alucinação estruturalmente válida chegava à tela como `Trecho: "…"` e o mestre
   confirmava acreditando que a frase era dele. `filterCandidatesByEvidence` descarta
   candidato cuja evidência não existe no texto. **Reusa o `normalize` de
   `parseDiscordAnnouncement`** (exportado para isto) em vez de cópia local — é a mesma
   pergunta que o parser já fazia sobre nome de sistema, e duas normalizações para o mesmo
   fim divergiriam no primeiro ajuste. A9: filtro neutralizado → 2 falhas, a alucinação
   passando. Paráfrase não passa: o contrato do módulo é extração literal.
   **Segunda rodada no mesmo filtro:** evidência que normaliza para vazio (`"🎲🎲"`,
   `"..."`) atravessava tudo, porque `z.string().trim().min(1)` a aceita e
   `includes('')` é sempre `true` — quem esvazia é o `normalize`, que descarta o que
   está fora de `[a-z0-9\s]`. Guarda explícita antes do `includes`; A9: 4 falhas, uma
   por caso.
4. **`TimeoutError` classificado** (P2 Codex). `AbortSignal.timeout` lança `TimeoutError`,
   não `AbortError`; todo estouro dos 15s caía como `error` e a coluna `status` perdia a
   distinção entre provedor lento e falha interna — que é o que se olha quando a rota
   degrada.
5. **Teto em `languages`/`specialties`/`badges`** (P1 Codex). O `PUT`/`POST /gm/profile`
   filtrava os arrays só por `typeof string` — sem limite de quantidade nem de tamanho,
   enquanto `tagline` já tinha `.slice(0, 200)` no mesmo handler — e o servidor aceita
   JSON de até 12 MB (`server.ts:92`). O dado entrava inteiro no banco e era relido pelo
   prompt **e** pela auditoria da extração, multiplicando o volume por análise.
   `sanitizeProfileList` (40 itens × 120 chars) na escrita **e** na leitura da rota,
   porque perfil gravado antes do teto continua no banco com o array inteiro; a extração
   repete o corte por dentro, para o próximo consumidor. **A correção foi na raiz, não só
   na B11** — o defeito era do handler de perfil, que a B11 apenas expôs. A9: `.slice`
   removido → 1 falha com 500 itens chegando à IA.
6. **Rate limit em duas camadas** (P1 Codex). Cada chamada gasta crédito pago, e uma
   sessão autenticada burla o cache variando um caractere. `bioSuggestionsIpRateLimiter`
   (30/15min) vem **antes** do `authMiddleware`, na ordem que a PR #268 fixou contra
   amplificação; `bioSuggestionsUserRateLimiter` (10/15min, chave `userId`) vem depois.
   Só IP não servia: NAT compartilhado puniria vizinhos, e troca de IP escaparia da cota.

**Débito herdado, não da B11:** `503` aparece **0 vezes** em `mesas.openapi.yaml` contra
~10 rotas que o retornam no código (`systems.ts`, `profile.ts`, `adminTables.ts`,
e agora `bio-suggestions`). O gerador não emite 503; o contrato mente sobre todas elas.

**Sobre B6 — a classificação campo→nível está em `spec.md` §8.** Ela não existia em
nenhum documento da spec (nem na investigação); foi **derivada** das fontes já levantadas —
StartPlaying (par certo, não completude), LinkedIn (+100% com cartão que explica o ganho),
Upwork (4,5×), NN/g (pedir antes de dar valor quebra confiança). **Nenhum campo novo é
obrigatório:** cobrar o que está em 0/20 puniria o mestre por porta que o sistema nunca
ofereceu. §8 marca os dois pontos onde o mantenedor pode decidir diferente.

**→ Fechar o GATE B antes de seguir.**

---

## Fase C — Exibição

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **C1** | Dobra: promover `tagline` a portador primário + etiquetas dos **atributos-chave: `specialties`, `selling_points`, `languages`** (D2 — a lista é fechada, não escolha do implementador) | spec §2.3 · D2 · plan fase C (trava) | **implementada localmente; aceite runtime pendente:** `tagline` é o `h1`, nome continua visível e a headline `Viva aventuras com…` só aparece como fallback; dobra leva até 2 valores de cada categoria fechada de D2 e não leva `badges`; selos locais migrados para `Badge` do pacote. Teste dirigido 7/7; consumidores do hero 23/23; cadeia OG 6/6; `tsc -b` limpo; eslint 0; A9: headline gerada + etiquetas ocultas → 2 falhas, restaurado → verde. Falta medir A3 em 1366×768 e 1920×1080 no build novo |
| **C2** | Exibir `specialties`, `languages`, `badges` (anda junto com B3) | spec §2.1 | **concluída com B3:** `MestreHighlights` exibe os três grupos; teste dirigido 4/4 nesta rodada |
| **C3** | Vãos de seção com regra (hoje 48/48/0/48/0/0) | spec §2.5 | **concluída em código:** fluxo único após o hero com `gap: calc(var(--space-6) * 2)` = 48px; três margens inline removidas; teste estrutural 3/3. A9: `gap: 0` → 1 falha, restaurado → verde. A auditoria dirigida caiu de 7 para 5 reprovações: eliminou a reimplementação local de `Badge` e o hero passou a consumir a régua; as 5 restantes já estavam no baseline |
| **C4** | Medir **o editor em 719px** e **tema claro** | spec §5, §6 · §11 (página pública de entrada medida, sem overflow) · §11.1 (editor antigo medido em mobile e tema claro; build pós-B/C pendente) | **medição parcial no Chrome em 2026-09-01, sem fechar C4:** editor autenticado em 719×900 não teve overflow horizontal nos temas escuro e claro; no claro, tokens efetivos `#f4f6fb`/`#0b1220`. O build acessível em beta está anterior às fases B/C: editor ainda exibe `Preço Médio` e não contém `tagline`, `specialties`, `languages`, `badges` nem sugestões da bio; rota pública em 1366×768 retornou 0 `.mestre-section-flow` e 0 `.hero-attributes`. Portanto A3/A10 e o aceite visual de C1/C3 ainda exigem o build novo. Baseline medido no editor antigo: 2 overflows de texto em metadados de links e 13 alvos abaixo de 44px |

**→ Fechar o GATE C.**

---

## Fase E — Integridade do perfil já existente (aberta em 2026-09-01 por incidente em produção)

Fase criada **depois** de A/B/C fecharem, por relato do mantenedor: o mestre
`dadoviciadopodcast` não conseguia salvar o próprio nome, gravar sistemas que mestra
nem publicar mesa. A B0 alinhou `nickname` (2-40) no schema e no upsert do editor, e a
§8 já classificava o campo como **obrigatório** ("sem nome não há perfil") — mas o
alinhamento cobriu **duas** das quatro portas de escrita que `old_spec.md:174` havia
mapeado. O perfil quebrado nasceu pela terceira.

**O que a spec previa e o que não previa.** O contrato do campo estava decidido (§8) e
a B0 o implementou onde olhou; o que faltou foi aplicá-lo em `updateGmProfile`
(`profileService.ts`), alcançado por `PATCH /api/v1/profile/gm` e `/me/gm`. Nada na 099
trata de **dado legado já inconsistente** — a spec governa o contrato daqui pra frente,
e os 7 perfis quebrados são consequência acumulada, não decisão pendente.

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **E1** | Fechar a porta que criava `gm_profiles` sem `nickname` | §8 (nickname **obrigatório**) · `old_spec.md:174` (as 4 portas) · B0 | **concluída (2026-09-01):** `deriveGmNickname` no `profileService`, aplicado aos **dois** inserts (o de `updateGmProfile` e o do vínculo Discord). A ordem espelha a do front (`useProfileQuery.ts:349`) — patch → username → local do e-mail → slug —, porque duas regras para o mesmo contrato divergiriam. Medição: `src/services`+`src/routes` **364/364**, `tsc -b` limpo, teste dirigido **11/11**. **Segunda rodada (achado de review):** a chave derivada vinha ANTES de `...sanitizedData` e o patch a sobrescrevia — como o `PATCH` manda `nickname` explicitamente (`profile.ts:183`), `null`, `'x'` e `'   '` voltavam a gravar registro fora do contrato, anulando a própria correção. Medido nos dois arranjos: ordem antiga → `null`/`'x'`/`'   '`; ordem nova → `dadoviciado` nos três. A9 cobre as duas camadas: fallback do slug removido → 2 falhas; ordem do insert invertida → **1 falha** |
| **E2** | Clique em sistema não pode sumir em silêncio | logs de produção (2026-09-01) · spec 099 B8 (mesma falha, já corrigida no `updateGm`) | **concluída (2026-09-01):** removido `if (isPending) return` de `addSystem`/`removeSystem` no `ProfileContext`. Medido nos logs do `mesas-api`: **6** `DELETE /profile/systems/6552a50a` — o mesmo id, em pares de ~1s — o mestre clicava, a tela não reagia, clicava de novo. Seguro porque `addUserSystem` já faz `onConflict(...).doNothing()` (`profileService.ts:390`). Teste dirigido **9/9**, `tsc -b` limpo; A9: os dois guards reintroduzidos → **2 falhas** |
| **E3** | Recuperar os 7 perfis já gravados sem `nickname` | §8 · E1 (impede novos casos, não conserta os velhos) | **concluída (2026-09-01):** `UPDATE gm_profiles` preenchendo `nickname` a partir de `username` → local do e-mail → `slug` (mesma ordem de E1), com `pg_dump` de `gm_profiles` antes (`/tmp/gm_profiles_pre_nickname.sql`, 45.843 bytes). Resultado: **`UPDATE 7`**; verificação `SELECT count(*) FILTER (WHERE nickname IS NULL OR length(btrim(nickname))=0), count(*) FROM gm_profiles` → **`0\|49`**. Executado pelo mantenedor: o classificador do harness recusa SQL de escrita em produção mesmo com `Bash(ssh faren *)` na allowlist — a autorização dele não destrava essa camada |

**Medição que abriu a fase (produção, 2026-09-01):**

| medida | valor |
|---|---|
| perfis sem `nickname` | **7 de 49** (14%) |
| sintoma no `mesas-api` | `POST /gm/tables` → 403 "Perfil não encontrado"; `POST /gm/profile` → 500 `duplicate key gm_profiles_user_id_key` |
| o que o F5 resolvia | zera `gmExistiaAntes` (estado de módulo) e o refetch traz `gm` → vira PUT; **não** preenche o nickname |

**Contradição que localizou a causa:** a publicação dizia "perfil não encontrado" enquanto
a criação dizia "chave duplicada". O perfil existia — nascido incompleto por uma porta que
não exigia o campo que a outra exige.

**Descartado com medição, para não ser reinvestigado:** a divergência de ids entre
`catalog_nodes` (central) e a tabela `systems` (projeção legada, 1269 linhas) é real —
`user_systems` tem **0 de 23** ids presentes na projeção —, mas **não afeta o usuário**:
`mesasHydrationSystemGuard` importa `prodDb` e só é consumido por `adminEnrichment`
(cópia prod→beta). Os três caminhos que o mestre exercita
(`POST /profile/systems`, `GET /systems?view=tree`, `hydrateTableSystemFields`) leem do
catálogo central. O 3D&T do relato estava gravado com id central válido e ativo.

---

## Fase F — Correções de forma (a "fase D" do plan.md; tasks nomeadas F para não colidir com as decisões D1–D11)

| # | Fazer | LER ANTES | Aceite medido | Trava |
|---|---|---|---|---|
| **F0** | **Concluída:** branch `feat/099-fase-f` criada a partir de `origin/dev`; ordem da 099 definida pelo mantenedor antes da edição | plan fase D (colisão medida) | `rtk git status --short --branch` → `feat/099-fase-f...origin/dev`, limpa no início | a 098 cita `Manter link direto` — mesmos componentes |
| **F1** | **Concluída:** `Checkbox` no pacote + 2 migrações (`AvatarField`, `ImageUploader`) | plan fase D (F1) · A7 | 24×24 **e `flex-shrink: 0`** no contrato; pacote 57/57; A9 sem `flex-shrink` → 1 falha | aprovação nominal dada ao mandar implementar a Fase F |
| **F1b** | **Implementada; runtime do build novo pendente:** link do mestre e `.link-item-url` com `min-height: 24px` | plan fase D (F1b) · A6 · §11, §11.1 | contrato do frontend nos 1020/1020; A9 sem os alvos → falha | local ao `mesas` |
| **F2** | **Implementada; runtime do build novo pendente:** duas famílias do rodapé com `min-height: 24px` | plan fase D (F2) · A8 · §11, §11.1 | teste do pacote; consumidores localizados e typecheck limpo em mesas, downloads e glossario; A9 a 18px → falha | pacote compartilhado |
| **F3** | **Concluída sem edição:** nav re-medida em runtime e defeito descartado | plan fase D (F3) | principal 42,6px; subnav 37,1px; ações 40px; 22px não reproduziu | nenhuma regra da nav tocada |
| **F5** | **Concluída:** editor usa régua e primitivos; duplicações removidas | **spec §9** (inteira) · 098 §6.3 | auditoria: 43 tokens, 0 fora da régua/grade, 0 classes/keyframes duplicados; baseline `mesas` 232→219 fora-régua, 9→3 duplicações, 9→8 keyframes; gate verde; A9 com `spin` → falha | `[data-theme=light]` não reintroduzido |
| **F4** | **Implementada; runtime do build novo pendente:** controles a 40px; experiência em `TextInput`, max 8rem | plan §B armadilha 2 · §11.1 | frontend 1020/1020; A9 com largura 100% → falha; `Textarea` preservada como exceção | local ao `mesas` |
| **F6** | **Concluída (achado da revisão da F):** colisão global de `.spinner` eliminada — `PlayerPage` usa `LoadingState`, `LinksManager` prefixa as suas (`.links-manager-spinner*`, reusando `artificio-spin`), `UserSystemsSelector` deixa de usar classe órfã | — | bundle tinha **3** `.spinner` concorrendo decididas por ordem de import; fonte agora tem **0** global; contrato varre todo CSS do app via `import.meta.glob` (guarda contra glob vazio); A9 reintroduzindo `.spinner` global → 1 falha | `App.tsx` não usa `lazy()`: todo CSS de rota cai no mesmo bundle |

**→ Fechar o GATE D** (`plan.md`, fase D). O que falta, nomeado:

- **Bloqueio: aceite runtime de F1b, F2 e F4.** Os três estão implementados e cobertos por
  contrato de fonte, mas o aceite é alvo medido **em navegador contra o build novo** —
  teste de fonte não substitui. Nenhum outro item da F depende disto.
- **Decisão pendente do mantenedor: 6 espaçamentos que a F5 mudou de valor**, não só de
  notação. A régua não tem `--space-5` (ausência deliberada — `styles.css:69-72` "sem alias,
  sem variedade redundante"; registrada em `old_spec.md` C7 e `old_plan.md`), então todo
  `1.25rem` foi arredondado. Medido: `.playstyle-item` gap 6→8px e `.autosave-indicator`
  padding-y 6→8px são **conserto** (6px violava a grade de 4px de §9.3.2);
  `.form-group` margin-bottom (14 usos), `.profile-header` e `.avatar-premium-container`
  vão 20→24px; `.user-systems-selector-loading` padding vai 32→24px, o único que aperta.
  Como está, obedece §9.3.2. Alternativa medida: criar `--space-5` no pacote reverteria a
  decisão de escala — exigiria aprovação nominal em `packages/ui`.

---

## Fase G — A casca do editor de mestre (G1/G3/G4/G5/G7/G5b implementadas 2026-09-01; G4a fechada sem código; G6 pendente)

**Origem:** o mantenedor recusou o editor em beta depois do deploy da Fase F — *"ainda
está centralizado, sem etapas como nas laterais, que tem no atual editor de mesas"*.
Não é requisito novo: `old_spec.md:495-503` já mandava aplicar ao perfil a casca do
editor de mesa. Diagnóstico, pesquisa e critérios em **spec §13**; sequência e travas em
**plan.md fase G**.

**O que a investigação de código mudou no enquadramento** (spec §13.8): a fase B entregou
os campos, a frase de ganho e a prévia — **o que falta é casca**, e o que sobra é
duplicação dela. `EditorSidebar` depende só de `EDITOR_PARTS` + 4 props (nada de
`TableEditorState`), então extrair é trocar constante por prop, não reescrever.

| # | Fazer | LER ANTES | Aceite medido | Trava |
|---|---|---|---|---|
| **G1** ✅ | Casca **local no perfil** (lateral + grid), copiando o padrão do `TableEditor` sem extrair nada. Editor de mesa **não é tocado** | plan fase G (por que inverteu) · `TableEditor.tsx:264-283,480-550` · `TableEditor.css:70,88-92` | perfil renderiza com lateral; suíte do `table-editor` **intocada**; duplicação registrada e datada, com G6 aberta | duplicação **deliberada e temporária** — extrair de 2 casos (um inexistente) é abstração prematura, o fracasso público do DLS |
| **G3** ✅ | 5 partes como **seções tituladas de um documento contínuo** (Quem é você · Como você mestra · Sua mesa · Prova · Onde te achar); a lateral rola até elas (`scrollIntoView`) e marca a ativa com **`aria-current="location"`** (não `"page"`: é âncora em documento contínuo, não troca de view). Campos redistribuídos — de `GmProfileFields` **e dos que moram em `ProfileEditPage.tsx`** (`AvatarField`, `ImageUploader`, `UserSystemsSelector`, `ClosedGroupSection`, `LinksManager`) | spec §13.5 · **§13.4e** (por que âncora, não troca de view) · `ProfileEditPage.tsx:271` | **A11**: cada seção ≤ 1 tela em 1366×768 (hoje: bloco de 2267px); voltar e editar continua possível sem trocar de view | **`scroll-margin-top` obrigatório**: o header do `AppShell` é sticky `z-index: 50` ocupando `top: 0→104` — sem ele o título da seção some sob o header. Precedente: `MestrePage.css:774` (`5rem`). Não mexer nas 3 abas (Geral/Jogador/Mestre) — decisão de produto não pedida |
| **G4a** ✅ sem código | Decidir e implementar o que a **`MestrePage`** (rota canônica `/mestre/:slug`) mostra a mais para o dono. Hoje ela **não tem `isOwner` nenhum** | spec **§13.15** · `App.tsx:71` · `MestrePage.tsx` | dono autenticado abrindo a própria página vê o que é dele; visitante não | **muda de alvo pela §13.15**: `MasterProfilePage` (com o `TODO` de `currentUserId`) está na rota **morta**, com 0 links — o `TODO` nunca fechou porque ninguém chega lá. Não unificar as rotas nesta fase |
| **G4** ✅ | Pendências por parte + a lateral mostra **`/mestre/<slug>`** (rota canônica, §13.15) e **abre a página em aba nova**, salvando o pendente antes de abrir. **Sem espelho dentro do editor** | spec **§13.11** (decisão do mantenedor: "direcionar como uma nova aba para onde vai ficar o link oficial") · `editorValidation.ts:131` | **Flush (V11)**: drenar o debounce de 500ms do autosave (B8) antes de abrir; **se a gravação falhar, não abrir** — avisar e manter o editor. **A12**: número cai ao preencher, sem recarregar. **A13**: com alteração não salva, clicar em abrir grava e a aba nova já traz o valor novo | some o requisito de injetar rascunho na página pública (achado C2 **resolvido por remoção**). `MestreProfilePreview` segue servindo `PainelMestrePage:717` e `MasterPart:170` |
| **G5** ✅ | Os **5** `<input>` crus da aba Mestre adotam `EditorField`/primitivo (`AvatarField` 2, `ImageUploader` 2, `LinksManager` 1); a regra legada perde `padding`/`font-size`/`min-height` **nos quatro seletores** (`input[text|number|url]`, `select`, `textarea` — `ProfileEditPage.css:290-304`), não só nos `input` | spec §13.7 · **§13.13 (C8, D12)** · §9.3 item 3 · `ProfileEditPage.css:290-304` · `old_tasks.md:121` | **A15** por asserção no CSS de origem (a regra não declara mais as três propriedades) **+ uma medição manual em navegador** registrada no fechamento — `getComputedStyle` não resolve cascata em jsdom | **`AvatarField` é usado nas abas Geral (`:312`) e Mestre (`:634`)** — alterá-lo toca as duas; a trava "não mexer nas 3 abas" é sobre **estrutura de abas**, não impede corrigir componente compartilhado por elas. Fecha C6/C7 no nível que **A7** exige. Os 7 inputs de `ProfileEditPage.tsx:338-495` são das abas Geral/Jogador: **fora do escopo** |
| **G5b** ✅ | "Sistemas que mestra" passa a carregar sob demanda, usando o `fetchSystemOptions` de G7, mantendo `mode="multi"` | spec §13.10 · `UserSystemsSelector.tsx` · **`SystemPicker.tsx` (camada do meio, §13.13 C6)** · `useSystemsCatalog.ts:87` | primeiro render **não** baixa o catálogo inteiro; busca dispara `?search=`. Medido em rede: hoje **487.965 bytes**, alvo na casa de centenas | **não trocar** pelo `CatalogSystemSelector`: ele é single-select e o perfil precisa de N sistemas — seria regressão |
| **G7** ✅ | Fonte server-side atravessa a cadeia inteira: `CatalogTree` ganha `fetchSystemOptions`/`fetchChildOptions` (contrato que o `CatalogSystemSelector` já tem) **e o `SystemPicker` repassa as props** — hoje ele declara `tree` obrigatória e zero `fetch*` (`SystemPicker.tsx:9-22`), então furar só o `CatalogTree` não entrega G5b | spec **§13.10, §13.13 (C6)** · `CatalogTree.tsx:9-38` · `CatalogSystemSelector.tsx:93-107` · **`SystemPicker.tsx:9-22`** | os **4** consumidores de `SystemPicker` verdes sem alteração (`GmProfileFields:512`, `UserSystemsSelector:95`, `DraftEditorTab:372`, `OnboardingPage:308`) + `CatalogSystemsPage.tsx` do site-admin; A9 removendo o fetch → volta a baixar a árvore | **Reusar, não redeclarar**: `SYSTEM_SEARCH_DEBOUNCE_MS = 250` e os tipos `CatalogSystemSearchFetch`/`CatalogSystemChildrenFetch` já existem em `CatalogSystemSelector.tsx:9,93-107`. **`packages/catalog-ui`: aprovação nominal + impacto**. Props **aditivas e opcionais** nas duas camadas: sem elas, comportamento atual |
| **G6** ⏳ | Comparar as duas cascas e extrair **só o que comprovadamente compartilham** para `features/editor-shell/`; `EditorField` deixa de exigir `TableEditorState` | plan fase G · spec §13.8d | suíte do `table-editor` verde com o **mesmo número de testes** antes e depois — linha de base medida em 2026-09-01: **10 arquivos, 259 testes**. Tirar `TableEditorState` do `EditorField` propaga para **6 parts** + teste (§13.13 C7); comentários de cicatriz (`:474` clique morto, `:286` pt 18→24px) viajam junto | **última** task da fase. "Não extrair" é resultado válido se compartilharem pouco |

**Estado medido em 2026-09-01, após implementar** (`rtk pnpm vitest run` no `mesas-frontend`):

- **1042/1042 testes** em 77 arquivos, `rtk tsc --noEmit` limpo, `rtk pnpm run lint` 12/12.
- **Não-regressão do editor de mesa: 259/259 em 10 arquivos, antes e depois** — o número
  exato da linha de base. O editor de mesa não foi tocado.
- **A9 cumprido em dois contratos**: reintroduzi a divergência de registro de partes
  (2 testes falharam) e o `min-height: 40px` na regra legada (1 teste falhou); restaurados,
  verde de novo.
- **Arquivos novos**: `profileEditorParts.ts` (+teste, 16 casos) e `ProfileEditorSidebar.tsx`.
- **G4a fechou sem código** — a premissa da task estava errada (spec §13.17).

**G7 + G5b, medidos em 2026-09-01** (aprovação nominal do mantenedor para o pacote):

- `packages/catalog-ui`: **39/39** (31 da linha de base + 8 novos), `tsc` limpo. Os
  consumidores existentes não mudaram: `site-admin` typecheck limpo, 31 testes antigos
  intactos.
- **Contrato de fetch deixou de ser duplicado**: os tipos e o `normalizeNodes` moravam no
  `CatalogSystemSelector`, que **importa** do `CatalogTree` — importar de volta fecharia um
  ciclo. Subiram para `catalogFetch.ts`, consumido pelos dois.
- **Três achados no caminho, todos corrigidos** (detalhe em §13.18): o `CatalogTree` perderia
  o NOME da seleção sem árvore local (daí `selectedNodes`); havia um **segundo** seletor de
  sistemas na mesma aba (`ClosedGroupSection`) ainda baixando o catálogo inteiro, o que
  zeraria a economia; e a busca `?search=` tinha um filtro de raízes caro que uma cópia
  perderia em silêncio — virou `useSystemsSearch`, fonte única com o editor de mesa.
- **Bug de loop de render introduzido e corrigido por mim**: com a função de busca na lista
  de dependências do efeito, o ciclo render→efeito→setState→render fechava e a suíte
  **travava sem terminar** (600s sem saída). A função entra por ref; há teste de regressão
  que mata o worker se a dependência voltar.

**O que falta medir em navegador** (jsdom não resolve cascata nem altura real):

- **A11** — se cada seção cabe em uma tela de 1366×768. As duas candidatas a estourar
  ("Como você mestra" e "Quem é você") continuam nomeadas, com a ordem de saída do plano.
- **A15** — os 40px por `getComputedStyle` no build real. A asserção no CSS de origem já
  está no teste; a medição visual é do fechamento.
- **F2 mobile** e a faixa horizontal abaixo de 719px, que seguem sem medição (§13.16).

**Ordem obrigatória:** G1 → G3 → **G4a → G4** → G5 → **G7 → G5b** → **G6 por último**. G7 (pacote) vem antes de G5b (app): o app consome o contrato que o pacote passa a oferecer. A extração fecha a fase, não
a abre: só depois das duas cascas existirem é que se sabe o que de fato é comum. A G2
anterior (generalizar `EditorField` antes de tudo) foi absorvida pela G6 pelo mesmo motivo.

**→ Fechar o GATE G** (`plan.md`, fase G). Além dos aceites por task:

- **A14**: todo campo recomendado exibe a frase de ganho, e a de campo que alimenta a
  busca diz isso explicitamente (spec §13.4h — 99% das reservas vêm da busca, não do
  perfil; o ganho é funcional, não motivacional).
- **A14b**: todo campo de imagem exibe a legenda de `imageKindHint` (`packages/media`) —
  dimensão escrita à mão na tela reprova (spec §13.5).
- **A16**: em G6, extrai-se **só o comum medido**. A duplicação de G1 é deliberada e
  datada; duplicação **sem registro** reprova, e "não extrair" é resultado válido se a
  comparação mostrar pouco em comum.
- **Aprovação nominal do mantenedor** para a fase — a autorização da Fase F não se
  estende (AGENTS.md §Autorização: por ação, nunca por sessão).

---

## Encerramento da spec

Só depois de A, B, C, D **e G** fechados **e** o mantenedor dizer que não vem mais review:

- [ ] `rtk pnpm run lint` (repo-wide, sozinho)
- [ ] `rtk pnpm run test` (repo-wide, sozinho — **nunca encadeado**)
- [ ] `rtk pnpm run build` (repo-wide, sozinho)
- [ ] `rtk pnpm verify:api` — obrigatório, o trabalho toca `apps/**`
- [ ] A9 verificado em todas as correções (defeito reintroduzido, teste falhou)
- [ ] A10: antes/depois nos 20 perfis reais — obter a lista com
      `/api/v1/tables?limit=100` → `gm_slug` distintos → `/api/v1/gm/perfis/{slug}`

**Nunca rodar os três de uma vez** — trava a máquina do mantenedor. Um de cada vez,
esperando o anterior.

---

## Pendências herdadas (não bloqueiam, mas não somem)

| o quê | estado |
|---|---|
| causa do `selling_points: {}` | **beta medida** (hidratação `admin/sync/enrich`) → A1 fechada; **prod não medida** (39/48 `{}`, nascendo até 08-28; **hidratação/escrita manual no período descartada pelo mantenedor** 2026-08-31) — única via de medição: `log_statement=all` em prod (aprovação); **data fix do dado sujo de prod não decidido** (SQL write → aprovação) |
| `aria-describedby` do `closed_group_systems` (B7) | campo tem hint sem associação — o controle é o `CatalogTree` do `@artificio/catalog-ui`, sem prop de aria (medido); corrigir exige aprovação de pacote |
| mobile e tema claro | **parcialmente medidos no Chrome** → C4 continua aberta porque **não foi remedida após o deploy de 2026-09-01** — o beta agora está em `b69f4c47`, com B/C/F no ar (VM confirmada); a medição anterior foi contra build defasado; editor antigo em 719×900, escuro e claro, sem overflow horizontal; 2 overflows de texto e 13 alvos abaixo de 44px |
| perfil de controle preenchido | **não existe** — nenhum dos 20 |
| nav global 22px | **não reproduz** no CSS do pacote → F3 |
| custo do esquema de extração para bio | **medido e concluído em B11** — 4 atributos estritos, 4 arquivos de produção + 3 arquivos de teste, sem migration/lib/pacote compartilhado; cache exigiu generalização tipada |
| write path de `closed_group_*` | **não medido** → B0.1 |
| `gmProfileSchema` sem `selling_points`/`tagline`/`promo_badge_text`/`badges` | **medido** — pré-requisito da fase B (plan B.0, passo 2), antes de qualquer campo novo |
| checkbox sem dimensão no `AdminTable` de `packages/ui` (`admin/AdminTable.tsx:288,304` — as classes de tamanho estão no `th`/`td`, não no `input`, então vale o default do agente de usuário) | **fora do A6** (que cobre página pública + editor), usado em telas admin do `mesas`. Registrado para não sumir; se entrar, exige **aprovação de pacote**. O "~13px" é default de runtime, **não medível na fonte** — precisa de navegador. `AdminTable` sai do subpath `@artificio/ui/admin`, não do índice raiz |
| soma da tabela de seções (4856 × 5341px) | **inconsistente**, registrada em `old_spec.md` §2.1 |
| `tailwind-preset` do pacote não é consumido por nenhum app | aberto, **não** é dívida da 099 (apps consomem via `styles.css`) → spec §9.4. O guard de paridade já foi ligado ao CI nesta sessão |
