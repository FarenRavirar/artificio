# Tasks 099 — Perfil do mestre

**Status: fase A executada (A1–A3, gate A fechado); fase B executada (B0–B11, gate B fechado com 1 pendência nomeada); fase E executada em 2026-09-01 por incidente em produção (E1–E3 concluídas).** Decisões D1–D11 fechadas (`spec.md` §3).

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
| **C1** | Dobra: promover `tagline` a portador primário + etiquetas dos **atributos-chave: `specialties`, `selling_points`, `languages`** (D2 — a lista é fechada, não escolha do implementador) | spec §2.3 · D2 · plan fase C (trava) | **critério A3** medido em 1366×768 e 1920×1080; **não cria componente** — o slot existe |
| **C2** | Exibir `specialties`, `languages`, `badges` (anda junto com B3) | spec §2.1 | os três aparecem na página |
| **C3** | Vãos de seção com regra (hoje 48/48/0/48/0/0) | spec §2.5 | escala aplicada; sem junção 0px entre grupos |
| **C4** | Medir **o editor em 719px** e **tema claro** | spec §5, §6 · §11 (página pública **já medida**, sem overflow) · §11.1 (editor em mobile **não medido** — a janela não redimensionou) | medição registrada; defeitos achados viram task |

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
| **E1** | Fechar a porta que criava `gm_profiles` sem `nickname` | §8 (nickname **obrigatório**) · `old_spec.md:174` (as 4 portas) · B0 | **concluída (2026-09-01):** `deriveGmNickname` no `profileService`, aplicado aos **dois** inserts (o de `updateGmProfile` e o do vínculo Discord). A ordem espelha a do front (`useProfileQuery.ts:349`) — patch → username → local do e-mail → slug —, porque duas regras para o mesmo contrato divergiriam. Medição: `src/services`+`src/routes` 360/360, `tsc -b` limpo, 6 testes novos; A9: fallback do slug removido → 2 falhas |
| **E2** | Clique em sistema não pode sumir em silêncio | logs de produção (2026-09-01) · spec 099 B8 (mesma falha, já corrigida no `updateGm`) | **concluída (2026-09-01):** removido `if (isPending) return` de `addSystem`/`removeSystem` no `ProfileContext`. Medido nos logs do `mesas-api`: **6** `DELETE /profile/systems/6552a50a` — o mesmo id, em pares de ~1s — o mestre clicava, a tela não reagia, clicava de novo. Seguro porque `addUserSystem` já faz `onConflict(...).doNothing()` (`profileService.ts:390`). Frontend 7/7, `tsc -b` limpo |
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
| **F0** | **Combinar a ordem com a 098** antes de tocar qualquer componente | plan fase D (colisão medida) | ordem definida pelo mantenedor | a 098 cita `Manter link direto` — mesmos componentes |
| **F1** | Primitivo de checkbox no pacote **+** migrar as 2 instâncias (`AvatarField`, `ImageUploader`) | plan fase D (F1) · A7 | alvo ≥ 24px nas duas; primitivo no pacote | aprovação nominal (`packages/ui`) |
| **F1b** | Alvos < 24px **medidos em runtime**: link do nome do mestre (**20px**, 8 ocorrências na página pública, §11) e 3 `.link-item-url` do editor (**18px**, §11.1) | plan fase D (F1b) · A6 · §11, §11.1 | alvo ≥ 24px medido em runtime | local ao `mesas`, sem aprovação de pacote |
| **F2** | Rodapé: `Ver termos` (**18px medido**, não ≈20) e `.artificio-footer-nav-link` (**22px medido**) ≥ 24px | plan fase D (F2) · A8 · §11, §11.1 (aparecem em **todas** as telas medidas) | medido no `mesas`, `downloads` e `glossario` | aprovação nominal |
| **F3** | **Re-medir a nav em runtime** antes de tratá-la como defeito | plan fase D (F3) | 22px reproduzido ou descartado | não tocar antes de medir |
| **F5** | Editor de perfil: adotar a régua `--space-1..6` (**0 usos**, 3 valores fora da grade) **e** trocar o que reimplementa o pacote (**5 classes + `@keyframes spin`**, spec §9.5) | **spec §9** (inteira) · 098 §6.3 | `node .agents/skills/ui-fidelity-audit/audit.mjs <tsx> <css>` verde nas medições 1–4 **e 7/7b** | local ao `mesas`; **não** reintroduzir `[data-theme=light]` (§9.2); primitivo que não cobrir o caso leva comentário dizendo qual limitação |
| **F4** | Adotar a escala do pacote (34/40/48) nos campos do editor | plan §B armadilha 2 (`Textarea` é exceção) · **§11.1: 12 alturas distintas, 9 fora da escala** | alturas na régua; largura por tamanho de resposta (`Anos de Experiência` mede **802px** para 2 dígitos) | aprovação se tocar o pacote |

**→ Fechar o GATE D** (`plan.md`, fase D).

---

## Encerramento da spec

Só depois de A, B, C e D fechados **e** o mantenedor dizer que não vem mais review:

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
| mobile e tema claro | **não medidos** → C4 |
| perfil de controle preenchido | **não existe** — nenhum dos 20 |
| nav global 22px | **não reproduz** no CSS do pacote → F3 |
| custo do esquema de extração para bio | **medido e concluído em B11** — 4 atributos estritos, 4 arquivos de produção + 3 arquivos de teste, sem migration/lib/pacote compartilhado; cache exigiu generalização tipada |
| write path de `closed_group_*` | **não medido** → B0.1 |
| `gmProfileSchema` sem `selling_points`/`tagline`/`promo_badge_text`/`badges` | **medido** — pré-requisito da fase B (plan B.0, passo 2), antes de qualquer campo novo |
| checkbox sem dimensão no `AdminTable` de `packages/ui` (`admin/AdminTable.tsx:288,304` — as classes de tamanho estão no `th`/`td`, não no `input`, então vale o default do agente de usuário) | **fora do A6** (que cobre página pública + editor), usado em telas admin do `mesas`. Registrado para não sumir; se entrar, exige **aprovação de pacote**. O "~13px" é default de runtime, **não medível na fonte** — precisa de navegador. `AdminTable` sai do subpath `@artificio/ui/admin`, não do índice raiz |
| soma da tabela de seções (4856 × 5341px) | **inconsistente**, registrada em `old_spec.md` §2.1 |
| `tailwind-preset` do pacote não é consumido por nenhum app | aberto, **não** é dívida da 099 (apps consomem via `styles.css`) → spec §9.4. O guard de paridade já foi ligado ao CI nesta sessão |
