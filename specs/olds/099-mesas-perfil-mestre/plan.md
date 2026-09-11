# Plano 099 — Perfil do mestre

**Status:** decisões D1–D11 fechadas. **Fase A executada (gate A fechado). Fase B executada (B0–B11, gate B fechado com 1 pendência nomeada). Fase C em execução (C1 e C3 implementadas localmente, C2 concluída com B3, C4 e gate runtime pendentes). Fase E executada em 2026-09-01 por incidente em produção (E1–E3 concluídas).** Fase D não iniciada.
Sequência, gates e pré-requisitos técnicos. As tasks estão em `tasks.md`; o estado medido
e a forma dos dados, em `spec.md`.

---

## Regra que governa o plano inteiro

**Nada do que já está construído some do radar.** Capacidade com render pronto e sem
formulário é capital gasto que não rende — recuperá-la custa o campo que falta, não a
feature. A tabela de §2.1 da spec é o inventário; a fase B não fecha com nenhuma linha 🔴.

**Ordem geral:** A → B → C, com D em paralelo. A fase B é o coração: sem porta de entrada,
C não tem o que exibir e D só embeleza um formulário que ninguém preenche.

---

## Fase A — Fundação de dados

**Objetivo:** garantir que o dado que chega ao front é confiável, antes de criar tela.

Sem migration (D1). Nada aqui toca layout — se produzir mudança visual, saiu do escopo.

**Entrega:**

1. **Normalização na fronteira** — todo JSONB/payload externo passa por normalizador
   tipado antes de virar prop (A5). Alvo imediato: `selling_points`, que volta `{}` em
   7/12 no beta (39/48 em prod — medido 2026-08-31, spec §2.2).
2. **Investigar a causa do `{}`** — **medido**: no beta, é a hidratação `admin/sync/enrich`
   copiando de prod; serialização descartada com medição; nenhum dos 12 pontos de escrita do
   código atual grava `{}`. **Bloqueio nomeado:** origem primária em prod (39/48) não medida
   — detalhe em spec §2.2.
3. **Separar "verificado" de "declarado pelo mestre"** (task A3) — decisão e medição dos 7
   perfis em `spec.md` §12. Não é escolher entre os números.

**O destino do texto da bio está decidido (spec §12.3):** o número em prosa **não se
toca** — é fala do mestre, e a plataforma não a corrige. Vai para B11 (extração assistida,
D11), que sugere e deixa o mestre confirmar. A3 fecha sem tocar na bio; só registra a
medição para B11 saber que o caso existe em 3 de 7 perfis.

**Trava da task A3 (não confundir dois dados):** `experience_years` (autodeclarado, coluna) e
`years_on_platform` (calculado de `created_at`, subconsulta) **são distintos e o código
proíbe fundi-los** — comentário em `gm.ts:181-184` (spec 081, T9.1).

**O defeito não é a divergência entre os números** — o jogador nunca vê as duas fontes
juntas. É que o autodeclarado sai com o **mesmo ícone `CheckCircle2` do `covil_verified`**
(`MestreHero.tsx:147-162`, ambos dentro de `.trust-item`): a plataforma parece atestar um
número que ninguém conferiu. Medição e fontes em `spec.md` §12.

### ── GATE A ──
- [x] `selling_points` normalizado, com teste que falha sem o normalizador (A9) — 10 testes em `useMestre.test.ts`; defeito reintroduzido → 4 falhas
- [x] causa do `{}` medida e registrada: beta = hidratação `admin/sync/enrich`; bloqueio nomeado = origem primária em prod (spec §2.2)
- [x] `experience_years` sem o selo de verificado — medido no hero renderizado (4 testes em `MestreHero.test.tsx`; defeito reintroduzido → 2 falhas); `years_on_platform` já oculto quando 0, medido — nada a fazer
- [x] `rtk pnpm vitest run` do pacote afetado, verde: 62 arquivos, 842/842 testes

---

## Fase B — Porta de entrada (o mestre insere)

**Só começa com o gate A fechado.**

### B.0 — Pré-requisito: o contrato de escrita (bloqueio, resolver ANTES de tela)

Um campo novo na tela não basta: o valor precisa sobreviver a quatro camadas. Hoje quatro
campos morrem em duas, **em silêncio** — o mestre digita, o indicador diz "salvo", o Zod
descarta.

Caminho atual: `ProfileEditPage` → `useUpdateGm` → `validateOrThrow(gmProfileSchema)` →
`PATCH /api/v1/profile/gm` → `updateGmProfileHandler` → coluna.

**São duas rotas PATCH, não uma:** `profile.ts:208` registra `/me/gm` e `profile.ts:210`
registra `/gm` (alias de compatibilidade com o frontend), **no mesmo
`updateGmProfileHandler`** — extraído em resposta a achado do Sonar na PR #145. Quem
remover a porta morta remove **as duas**, senão sobra alias apontando para handler órfão.

| campo | form | Zod | handler | coluna | chega? |
|---|---|---|---|---|---|
| `nickname`, `bio_long`, `experience_years` | ✔ | ✔ | ✔ | ✔ | **sim** |
| `avatar_*`, `banner_*` | ✔ | ✔ | ✔ | ✔ | **sim** |
| `average_price` | ✔ | ✔ | ✔ | ✔ | sim (sai por D4) |
| `languages`, `specialties` | ✘ | ✔ | ✔ | ✔ | **falta só o form** |
| `tagline`, `selling_points`, `badges`, `promo_badge_text` | ✘ | **✘** | **✘** | ✔ | **NÃO** |

**Decisão de arquitetura: consolidar na porta que já valida.** `POST`/`PUT
/api/v1/gm/profile` (`gmPanel`) **já aceita os 6 campos**, com `isSellingPoint` e
sanitização de markdown — é código de escrita que nenhum cliente exercita.

Migrar o editor para o `PUT` em vez de estender o `PATCH` segue o padrão catalogado
**Merge Endpoints**: operações sobrepostas se consolidam num endpoint, com a validação num
lugar só. Estender o `PATCH` duplicaria `isSellingPoint` e a sanitização, deixando duas
portas que divergem a cada manutenção.

**O que a consolidação exige, medido — são três passos, não dois:** (1) **estender o `PUT`**
com os campos que o editor grava hoje e que ele ainda não aceita: `experience_years` e
`average_price` (medido: ausentes do destructuring e do `.set` — migrar sem isto regride os
dois). `gm_style`, `tools` e `game_format` ficam **fora**: o `PUT` não os aceita e nenhuma UI
os envia (mantê-los no schema = porta falsa); (2) trocar o `mutationFn` de `useUpdateGm` de
`api.patch('/api/v1/profile/gm')` para o `PUT`, **preservando o upsert**: o `PATCH` cria
perfil (e eleva role) quando ausente; o `PUT` responde 404 — medido que a TabMestre renderiza
com `(profile?.gm || {})` para qualquer role, então o cliente passa a usar o `POST` com slug
derivado (mesma regra do PATCH service) quando `profile.gm` é null; (3) **alinhar
`gmProfileSchema` ao contrato que o `gmPanel` aceita** (adicionar `tagline`,
`selling_points`, `badges`, `promo_badge_text`; remover `gm_style`/`tools`/`game_format`;
`nickname` 2-40). Sem o passo 3 a porta falsa sobrevive **do lado do cliente**: o Zod do app
continua descartando os campos antes de a requisição sair, e o sintoma é idêntico ao de
hoje.

**Consumidores medidos do `PATCH`:** **um** (`useUpdateGm`, `useProfileQuery.ts:171`). A
migração move um `mutationFn`; as **duas** rotas `PATCH` ficam sem cliente e podem ser
removidas em passo próprio, com nova busca de consumidores antes.

**Quem já escreve no `POST`/`PUT /api/v1/gm/profile` — quatro chamadas, todas do editor de
mesa e do painel:** `PainelMestrePage.tsx:657` (contatos) e `:680`
(`preferred_vtt_platforms`); `useTableEditor.ts:1048` (**POST**, cria o perfil no publish
de quem ainda não tem) e `:1209` (**PUT**, `syncProfileToMaster` — nickname/bio/contatos).
O editor de perfil entra como **quinto** cliente da mesma porta: ao mudar payload,
validação ou resposta do `PUT`, conferir os quatro — `useTableEditor.test.tsx` cobre o
comportamento atual e é a rede de segurança.

`closed_group_*` **medido**: passa pelo `POST`/`PUT /api/v1/gm/profile` (destructuring +
`.set` no gmPanel) — **não** passa pelo `PATCH` (o handler não o destrutura). Outros pontos:
`systemProjectionHydrator` (admin, só `closed_group_systems`) e a hidratação beta (bloqueada
em prod). A task B2 usa o `PUT`.

### B.1..B.5 — Ordem dos campos, por custo × alcance

| ordem | campo | por quê |
|---|---|---|
| 1 | `tagline` | um campo; alcança a dobra **e** as duas descrições (spec §2.3) |
| 2 | `closed_group_*` | seção inteira pronta; 70–80% da demanda do mercado é campanha |
| 3 | `specialties`, `languages`, `badges` | contrato já aceita 2 dos 3 — **exigem exibição junto** |
| 4 | `selling_points` | render pronto; campo mais complexo (ícone + 3 textos) |
| 5 | `promo_badge_text` | um campo, alcance menor |

### O que reusar — não construir

O editor de anúncio de mesa (spec 096) já resolveu este problema de interface.

**Do `mesas`:** `TagInput` (`string[]` — encaixe direto em specialties/languages/badges),
`SearchableSelect`, `StyleFacetPicker`, `MarkdownEditor`, `UserSystemsSelector`.

**Do editor de mesa, o padrão a replicar:**
- `EditorField` — três níveis marcados (obrigatório / recomendado / opcional), com
  `data-ob` cruzado pelos testes contra o registro de validação (fonte única).
- `RECOMMENDED_GAIN` — a frase que diz **o que o mestre ganha**, na linguagem do jogador
  (D10). Em produção: *"mesas com banner aparecem em destaque"*.
- `CardPreview` — prévia ao vivo ao lado do formulário (atende a prévia de D5).
- Partes semânticas (`IdentityPart`, `ValuesPart`…) em vez de coluna de 3,75 telas.

**De `@artificio/ui`:** `Field`, `TextInput`, `Textarea`, `Select`, `Badge`, `Button`,
`Panel`. Escala: `artificio-control-sm/md/lg` = 34/40/48px de `min-height`.

### ⚠️ Quatro armadilhas do pacote (medidas — não descobrir na implementação)

1. **`Field` NÃO emite `aria-describedby`.** Computa `${id}-description` e aplica como
   `id` do `<p>`, mas **nenhum controle recebe o atributo**. A associação erro↔campo é
   trabalho do formulário — cai direto em A6.
2. **`Textarea` ignora a escala de altura.** `.artificio-textarea` declara
   `min-height: 112px` **depois** dos blocos de tamanho, com a mesma especificidade: vence.
   A escala ali muda só fonte e padding.
3. **Não existem checkbox nem tag input no pacote.** O toggle de vocabulário fixo dentro
   de `GmReviewPanel` é `<button>`, não primitivo exportado.
4. **`admin/*` não sai do índice raiz** — vem do subpath `@artificio/ui/admin`.

### Extração assistida (D11) — depois do formulário

Sem formulário não há onde confirmar nem corrigir. A infraestrutura **já roda**:
`discord/llmAssist.ts` chama a API DeepSeek com esquema, normaliza com Zod e remove cercas
de markdown. **Medição B11 (2026-09-01):** o cache existente não era genérico —
`readCachedDecision` validava sempre com `extractedFieldsSchema`, próprio do anúncio. B11
generalizou a leitura para receber o schema Zod do resultado e passou a cachear a extração
da bio por `model` + `prompt_version` + hash do request. Foi capacidade existente com uma
adaptação de infraestrutura, não só a declaração de um schema.

O `parse-preview` do editor de mesa é o precedente de **arquitetura** (sugerir + confirmar),
não de técnica: aquele parser é **motor de regras**, sem modelo.

### ── GATE B ──
- [x] busca do **critério A1** volta **sem lacuna**: todo campo lido por `mestre/*` tem formulário (busca 2026-08-31: campos lidos em `mestre/*` cruzados com a tabela §2.1 — todos os renderizados têm form após B1–B5; derivados/outros fluxos corretos)
- [x] os 6 campos chegam ao banco de ponta a ponta (**nenhuma porta falsa**): form (B1/B3/B4/B5) → `gmProfileSchema` (B0) → `PUT /gm/profile` (B0) → coluna, com testes em cada camada
- [x] todo campo recomendado tem frase de ganho (D10) — os 7 recomendados no registro único `RECOMMENDED_GAIN`, cruzado por teste (B6)
- [ ] `aria-describedby` no controle de todo campo com erro/hint (A6) — **pendência nomeada**: `closed_group_systems` (controle `CatalogTree` do `@artificio/catalog-ui` não tem prop de aria, medido — tocar o pacote exige aprovação); demais campos cobertos (B7)
- [x] autosave com debounce e indicador visível em página longa (B8)
- [x] preço do grupo fechado grava **centavos** a partir de reais — testado (B2: 12 testes com round-trip)
- [x] `rtk pnpm vitest run` do pacote afetado, verde: frontend 73 arquivos / 952 testes; backend 74 arquivos / 1056 testes (2026-08-31)

---

## Fase C — Exibição (o sistema expõe)

**Só começa com o gate B fechado** — a dobra depende de o mestre ter onde preencher.

**Entrega:**

1. **Dobra** (D2) — **implementada localmente; runtime pendente**: `tagline` promovida a portador primário + etiquetas dos
   **atributos-chave — `specialties`, `selling_points`, `languages`** —, com fallback para
   a headline atual enquanto vazia. A lista vem de D2 e é fechada.
   **O slot já existe e está ligado** — a task C1 não cria componente, promove.
   Forma implementada: `tagline` no `h1`, nome visível acima dele, headline gerada como
   fallback e até dois valores por categoria de D2 (`selling_points` usa o título). `badges`
   não entra na dobra. Os chips usam `Badge` de `@artificio/ui`.
2. **Exibição de `specialties`, `languages`, `badges`** — **concluída com B3/C2** em
   `MestreHighlights`; a seção completa continua responsável por mostrar os valores além do
   resumo da dobra.
3. **Remover `average_price` do front** (D4) — **concluída em B9**; banco intacto. **Alcance: só o campo do
   editor de perfil** (`ProfileEditPage.tsx:583-590`). O preço da mesa
   (`MestreFeaturedTable.tsx:148-155`) e o do grupo fechado
   (`MestreClosedGroupSection.tsx:68-73`) **ficam** — são a mitigação de confiança que
   sustenta D4.
4. **Vãos de seção com regra** — **implementada localmente; runtime pendente**: um único
   container pós-hero aplica `gap: calc(var(--space-6) * 2)` = 48px; as três margens inline
   que produziam junções diferentes foram removidas.

**Trava:** ao mexer na precedência da dobra, conferir as **três** cadeias de `tagline`
(spec §2.3) — mexer numa não mexe nas outras, e os cortes são diferentes (140 por frase no
hero, 150 por substring no SPA).

### ── GATE C ──
- [ ] A2: implementação local cobre as saídas antes órfãs; confirmar no build novo e reconciliar a tabela §2.1 sem nenhuma linha 🔴
- [ ] A3: dobra com informação do mestre, medida em 1366×768 e 1920×1080 no build novo
- [ ] as três cadeias de descrição conferidas, nenhuma regredida — hero e backend estão verdes localmente; falta o aceite runtime
- [ ] **mobile e tema claro medidos** (editor **e** página pública) — **parcial em C4**:
      editor antigo medido em 719×900 nos dois temas, sem overflow horizontal; o alcance está
      resolvido por medição em spec §7: entra aqui, não antes de B, porque nenhuma media
      query do editor muda a estrutura de campo. Repetir no build pós-B/C
- [ ] A10: antes/depois nos 20 perfis reais

**Validação local já registrada em C1/C3:** hero 7/7, consumidores 23/23, cadeia OG 6/6,
teste estrutural do fluxo 3/3, `tsc -b` limpo e eslint 0. A9 reintroduziu headline gerada +
atributos ocultos (2 falhas) e `gap: 0` (1 falha), restaurando ambos ao verde. A medição no
Chrome não fecha o gate porque o beta acessível retornou 0 `.hero-attributes` e 0
`.mestre-section-flow`.

---

## Fase E — Integridade do perfil já existente (aberta em 2026-09-01, fora da sequência original)

Não estava planejada: entrou por incidente em produção, depois de A/B/C fecharem. A §8 da
spec já classificava `nickname` como **obrigatório** e a B0 alinhou o contrato (2-40) —
mas só nas duas portas do editor (`POST`/`PUT /api/v1/gm/profile`). A terceira porta
(`PATCH /api/v1/profile/gm` → `profileService.updateGmProfile`) criava `gm_profiles`
derivando apenas o `slug`, e o perfil nascia com `nickname` NULL.

**Por que isso trava o mestre inteiro, e não só o campo do nome:** o `POST /gm/profile`
recusa nickname ausente com 400, então o upsert do cliente falhava; o `onError` restaurava
o cache com `gm: null`, o snapshot `gmExistiaAntes` voltava a `false`, e a tentativa
seguinte era POST de novo — batendo em `duplicate key`. Toda gravação do perfil ficava
presa nesse laço, incluindo sistemas e a publicação de mesa.

- [x] E1: `deriveGmNickname` no `profileService`, nos dois inserts — `src/services`+`src/routes` 364/364; teste dirigido 11/11; A9 com 2 falhas no fallback e 1 na ordem do insert
- [x] E2: guard silencioso fora de `addSystem`/`removeSystem` — teste dirigido 9/9; A9 com 2 falhas; origem medida em 6 DELETEs repetidos nos logs
- [x] E3: `UPDATE` nos 7 perfis legados — `UPDATE 7`, verificação `0|49`; rodado pelo mantenedor (o classificador do harness recusa SQL de escrita em produção)

**Ordem:** E1 antes de E3. Corrigir o dado sem fechar a porta faria os perfis voltarem a
nascer quebrados; fechar a porta sem corrigir o dado deixa os 7 mestres travados.

---

## Fase D — Correções de forma (implementada localmente; gate runtime pendente)

**Moradias medidas** (os códigos são os das tasks `F0..F4`; os antigos `C4/C5/C6/C7` da
investigação saíram porque colidiam com as tasks da fase C):

- **F1 — concluída em código:** `Checkbox` criado no pacote com alvo 24×24px e as duas
  instâncias de `Manter link direto` migradas. Testes do pacote 11/11; A9 reduziu os
  tamanhos e produziu 2 falhas.
- **F2 — concluída em código:** `Ver termos` e `.artificio-footer-nav-link` têm
  `min-height: 24px` no pacote. O mesmo `Footer` foi localizado em mesas, downloads e
  glossario; o typecheck dirigido ficou limpo nos três frontends. Medição runtime do build novo
  permanece no gate.
- **F1b — concluída em código:** link do nome do mestre e `.link-item-url` recebem
  `min-height: 24px`; contrato dirigido falha se os alvos forem retirados.
- **F3 — descartada por medição runtime:** links principais 42,6px, subnav 37,1px e ações
  40px; o alvo de 22px não reproduziu e nenhum código da nav foi alterado.
- **F4 — implementada localmente:** controles do formulário adotam 40px; experiência usa
  `TextInput` e largura máxima de 8rem. `Textarea` preserva a exceção medida. Aceite das
  alturas reais fica para o build novo.

- **F5 — concluída:** auditoria dirigida passou de 6 reprovações para tudo verde (43 usos
  da régua, 0 fora da régua/grade, 0 classe e 0 keyframe duplicados). Baseline repo-wide
  atualizado (`mesas`: fora-régua 232→219, duplicações 9→3, keyframes 9→8) e gate verde.

**⚠️ Colisão com a 098, medida:** a 098 cita `Manter link direto` na sua lista de alvos
abaixo do piso — as duas specs tocam os **mesmos três arquivos**: `AvatarField.tsx`,
`ImageUploader.tsx` e `ProfileEditPage.css` (é ele que dá os 16px do checkbox do
`AvatarField`, em `:809-814`). **Não executar em paralelo** sem combinar quem cria o
primitivo de checkbox. A ordem é call do mantenedor.

**Trava de autorização:** mudança em `packages/ui` exige aprovação nominal da ação e
verificação de impacto nos consumidores. Chegar com o conserto **medido e pronto**, pedir a
aprovação da ação — não apresentar o achado como bifurcação.

### ── GATE D ──
- [ ] A6: contratos locais cobrem 24px; falta medir o build novo na página pública e no editor
- [x] A7: primitivo no pacote + duas migrações; A9 falhou 2/2 sem os tamanhos
- [x] A8: consumidores do `Footer` localizados e com typecheck limpo em mesas, downloads e glossario; falta apenas o runtime de A6
- [x] aprovação nominal: o mantenedor mandou implementar a Fase F na branch `feat/099-fase-f`

---

## Fase G — A casca do editor de mestre (aberta em 2026-09-01, após recusa do mantenedor em beta)

**Por que existe:** o mantenedor abriu `mesasbeta` depois do deploy da Fase F e recusou o
resultado — *"está feio, desorganizado, bem diferente do conteúdo que embasou a spec"*,
*"ainda está centralizado, sem etapas como nas laterais, que tem no atual editor de
mesas"*. Diagnóstico completo em **spec §13**. Não é requisito novo: `old_spec.md:495-503`
já mandava aplicar ao perfil a casca do editor de mesa, e a fase B entregou os campos sem
a casca.

**O que está medido antes de começar** (spec §13.2 e §13.8, medido em beta e no código):

- editor de perfil: **5,2 telas** de rolagem, 1 `<h2>`, 19 rótulos corridos, sem lateral;
- editor de mesa: 7 partes, aside de 300px, `pendingCounts`, prévia viva;
- **já existe no perfil:** os 7 campos, frase de ganho (`profileEditorDomain.ts:31`),
  `MestreProfilePreview` (reusada em 3 telas), abas Geral/Jogador/Mestre;
- **duplicado:** duas constantes `RECOMMENDED_GAIN` no mesmo app, nomes iguais, chaves
  diferentes — §9.5 se repetindo;
- **acoplamento da casca é raso:** `EditorSidebar` (`TableEditor.tsx:480-550`) depende só
  de `EDITOR_PARTS`, `EditorPartId` e 4 props — nada de `TableEditorState`. `fieldLevel`
  já aceita `ctx?: FieldLevelContext`, não o estado inteiro.

**Regra que governa a fase:** extrair e compartilhar, nunca copiar (A16). A terceira
duplicação de casca reprova por §Compartilhado por padrão — depois de `RECOMMENDED_GAIN`
e das 5 classes de §9.5, seria padrão, não acidente.

**Trava de não-regressão:** o editor de mesa está **em produção**. A extração carrega
junto as cicatrizes registradas em comentário — `TableEditor.tsx:474` (recriar a lista de
botões mata o clique, bug T2.5 da spec 096) e `:286` (`pt` 18→24px, achado do mantenedor
em 2026-08-26). Comentário que explica decisão **não se perde na extração**
(AGENTS.md §Regras Gerais de Código). Suíte do `table-editor` verde antes e depois, com o
mesmo número de testes, é condição de aceite — não cortesia. **Linha de base medida em
2026-09-01** (`rtk pnpm vitest run src/features/table-editor`): **10 arquivos, 259 testes,
259 passando**. E o custo de tirar `TableEditorState` do `EditorField` tem tamanho: **6
parts** consomem o componente (§13.13 C7).

**Moradias, por task:**

- **G1 — Casca local no perfil, deliberadamente duplicada.** A lateral e o grid nascem
  **dentro do perfil**, copiando o padrão do `TableEditor` sem extrair nada. O editor de
  mesa **não é tocado**.

  **O que copiar, delimitado:** o grid `300px minmax(0,1fr)` (`TableEditor.css:70`), o
  `aside` e a nav de partes, e a media query de 719px que vira **faixa horizontal no topo**
  (`:86-97`). **O que NÃO copiar:** a casca imersiva (`position: fixed; inset: 0;
  z-index: 60`, `:36-56`) é do editor de anúncio, que toma a tela inteira — o perfil é
  página em fluxo, dentro do `AppShell`, e herdar isso quebraria a navegação do site.

  **Isto inverte o que este plano dizia até 2026-09-01, e a inversão é a decisão mais
  importante da fase.** A versão anterior mandava extrair `EditorShell` primeiro e fazer
  os dois editores consumirem. O caso público mais conhecido do DLS do Airbnb é
  exatamente esse fracasso: o sistema inicial era rígido demais porque foi abstraído cedo,
  e quando o produto cresceu *"o único caminho era ficar acrescentando estilo e lógica no
  componente a cada nova variante"*
  ([evolução do DLS](https://singhshubham.hashnode.dev/evolution-of-airbnbs-design-language-system)).
  Extrair a partir de **dois** casos — sendo que o segundo ainda não existe — é abstração
  prematura pelo livro.

  A duplicação aqui é **temporária e nomeada**, não descuido: G6 a resolve depois que as
  duas formas estiverem visíveis lado a lado e as diferenças reais aparecerem. Trocar
  risco de regressão em produção (extrair código que está no ar, às cegas) por dívida
  registrada e datada é a troca certa.

- **G7 — Fonte server-side atravessando `CatalogTree` E `SystemPicker` (pacote + app).** Medido em
  spec §13.10: o pacote hoje oferece **busca sob demanda OU seleção múltipla, nunca as
  duas**. `CatalogSystemSelector` tem `fetchSystemOptions`/`fetchChildOptions`/`fetchNodePath`
  e é single-select; `CatalogTree` faz multi e só aceita `tree` local. Quem precisa das duas
  — o editor de perfil — paga **487.965 bytes** (1.289 nós) no primeiro render para escolher
  de 1 a 5 sistemas, contra **816 bytes** da busca do editor de mesa. **598×.**

  **A cadeia tem três camadas, não duas** (§13.13 C6, revisão de 2026-09-01):
  `UserSystemsSelector → SystemPicker → CatalogTree`. `SystemPicker.tsx:9-22` declara
  `tree` **obrigatória e zero `fetch*`** — furar só o `CatalogTree` **não entrega G5b**,
  porque o wrapper não repassa nada. G7 mexe nas duas camadas.

  As props novas são **opcionais** nas duas, no mesmo contrato que o `CatalogSystemSelector`
  já define: sem elas, o comportamento atual continua e os consumidores existentes não mudam.

  **Trava:** `packages/catalog-ui` exige **aprovação nominal + verificação de impacto nos
  consumidores** (AGENTS.md §Autorização). Chegar com o conserto medido e pronto.

- **G5b — o perfil consome G7.** `UserSystemsSelector` passa a carregar sob demanda,
  **mantendo `mode="multi"`**. Não trocar pelo `CatalogSystemSelector`: ele é single-select
  e o perfil precisa de N sistemas — a troca seria regressão, não unificação.

- **G6 — Extração, depois que o padrão se provar.** Com o perfil funcionando, comparar as
  duas cascas e extrair **só o que elas comprovadamente compartilham** para
  `features/editor-shell/`. O que divergir fica em cada editor. Se a comparação mostrar
  que compartilham pouco, **não extrair** é resultado válido — e aí a duplicação vira
  decisão registrada, não dívida.

- **G3 — Partes do perfil, por âncora e não por troca de view.** As cinco partes de spec
  §13.5 (Quem é você · Como você mestra · Sua mesa · Prova · Onde te achar) viram
  **seções tituladas de um documento contínuo**; a lateral rola até elas
  (`scrollIntoView`) e marca a ativa por observação de rolagem. Os campos de
  `GmProfileFields.tsx` são **redistribuídos**, não reescritos.

  **Por que âncora e não troca de view** (spec §13.4e): a evidência a favor de página
  única é que o usuário **volta e edita** — e o perfil é edição de dado existente, não
  funil de conversão. Trocar a view esconde o resto e destrói exatamente essa força.
  Âncora entrega o que falta (visão geral, pendências por parte, seção nomeada) **sem**
  tirar a revisão livre. Cada seção continua tendo de caber numa tela (A11); a diferença é
  que passar de uma para outra é rolagem, não navegação.

- **G4a — FECHADA SEM CÓDIGO: a rota canônica já reconhece o dono (spec §13.17).**
  Medido ao implementar: `gm.ts:216-217` monta `viewer_context.is_owner` comparando
  `req.user?.userId` com `gm.user_id` **no servidor**, `useMestre.ts:224` deriva
  `canSeeInsights` dele (mais `is_admin`), e `MestrePage.tsx:136,140` já gateia as métricas
  do dono por essa flag. A task pedia menos do que já existe, e com comparação no cliente.

  O que a §13.15 dizia — "a `MestrePage` não tem `isOwner` nenhum" — estava errado: a busca
  foi por nome esperado (`isOwner`/`currentUserId`/`useAuth`) em vez de medir o contrato que
  a página recebe. O `// TODO` de `MasterProfilePage:28-29` continua de pé, mas na rota
  **morta** (0 links): código sem consumidor, fora do escopo desta fase.

- **G4 — Pendências e prévia na lateral.** `isFieldFilled`/`pendingCounts` ganham
  equivalente para o perfil (registro próprio, mesma mecânica de
  `editorValidation.ts:131`).

  **A prévia é porta, não espelho** (spec §13.11, decisão do mantenedor 2026-09-01: *"a
  prévia tem que direcionar como uma nova aba para onde vai ficar o link oficial"*). A
  lateral mostra o **endereço público real** e abre a página em **aba nova**, garantindo o
  salvamento do que estiver pendente antes. Não há espelho dentro do editor: conferir numa
  miniatura de 300px é conferir outra coisa, e o endereço — que é o que o mestre divulga —
  ficaria de fora.

  **Some um requisito:** sem espelho, não é preciso injetar estado não-salvo na página
  pública. O achado C2 da 1ª revisão fica **resolvido por remoção**, e a prop
  `masterOverride` sai do escopo.

  **E some uma decisão pendente:** "a prévia acompanha a parte ativa ou fica no topo?"
  deixa de existir — não há mais nada rolando junto para sincronizar.

- **G5 — Campos adotam a escala (fecha C6/C7).** Os **5** `<input>` crus da aba Mestre
  passam por `EditorField`/primitivo, e a regra legada `.form-group input[...]`
  (`ProfileEditPage.css:290-304`) perde `padding`/`font-size`/`min-height` — é ela que
  hoje vence `.artificio-control-md` por especificidade 0,2,1 × 0,1,0 e produz 50px
  (spec §13.7). Fecha T12/T13 no nível que A7 exige: pacote + app, não "N valores do
  `mesas`".

**Ordem:** G1 → G3 → **G4a → G4** → G5 → **G7 → G5b** → **G6 por último**. G7 antes de G5b: o app consome o contrato que o pacote passa a oferecer. A extração é o **fim** da fase, não
o começo: só depois das duas cascas existirem é que se sabe o que de fato é comum.

**Fora desta fase, deliberadamente:**

- **Moderação de perfil por terceiros** (moderador/admin ver ou editar o perfil de um
  mestre). Medido em 2026-09-01, e o mantenedor decidiu manter fora: `PUT /gm/profile`
  (`gmPanel.ts:392`) grava **sempre no perfil do usuário logado**, sem parâmetro de alvo —
  não existe caminho para editar o de outro, nem por engano. Abrir esse caminho exigiria
  rota com alvo, trilha de auditoria e, antes disso, resolver um desencontro de vocabulário:
  `packages/auth` tem `user | moderator | admin`, o `mesas` tem
  `visitor | player | gm | admin`, e `resolveEffectiveMesasRole` (`auth.ts:41-47`) rebaixa
  quem chega como `moderator` — por decisão da spec 090, não por defeito. Nada disso
  bloqueia a fase G, que trata da casca do editor do próprio dono.

- **Não mexer nas 3 abas** (Geral / Jogador / Mestre). A casca de partes é *dentro* da
  aba Mestre. Reorganizar as abas é decisão de produto que o mantenedor não pediu.
- **Não fundir os dois `RECOMMENDED_GAIN`** em um registro só: os campos são diferentes.
  O que se compartilha é o componente, não o vocabulário.
- **Não tocar nos 6 espaçamentos** de decisão pendente do mantenedor.
- **Não tornar o perfil buscável** (D6) — continua sendo a próxima spec, mesmo que 13.4h
  mostre que é lá que o dado do mestre rende.

### ── GATE G ──
- [ ] A11: nenhuma parte passa de uma tela de rolagem em 1366×768, medido por
      `scrollHeight` da parte ativa contra `innerHeight` (hoje: 5,2 telas)
- [ ] A12: lateral mostra pendências por parte, e o número cai ao preencher sem recarregar
- [x] G4a: **fechada sem código** — `viewer_context.is_owner` já vem do servidor
      (`gm.ts:216`), `canSeeInsights` já gateia o que o dono vê a mais
      (`MestrePage.tsx:136,140`). A premissa da task estava errada (spec §13.17)
- [ ] A13: a lateral mostra **`/mestre/<slug>`** (a rota canônica, §13.15) e abre em aba
      nova; com alteração não salva, clicar em abrir grava antes e a aba já traz o valor
      novo. Espelho da página dentro do editor reprova
- [ ] A14: todo campo recomendado exibe a frase de ganho; campo que alimenta a busca diz isso
- [ ] A15: nenhum `<input>` cru com classe local; altura vinda de `artificio-control-*`,
      medida por `getComputedStyle` no build real
- [ ] A14b: todo campo de imagem exibe a legenda de `imageKindHint` (`packages/media`),
      com os valores do pacote — dimensão escrita à mão na tela reprova
- [ ] A16: em G6, o que for extraído é o que as duas cascas **comprovadamente**
      compartilham — extrair o que só um usa reprova, e "não extrair" é resultado válido
      se a comparação mostrar pouco em comum
- [ ] a duplicação de G1 está registrada e datada, com G6 aberta — duplicação sem registro reprova
- [ ] não-regressão: suíte do `table-editor` verde, mesmo número de testes, antes e depois
- [ ] G7: **os 4 consumidores** de `SystemPicker` verdes sem alteração — `GmProfileFields:512`,
      `UserSystemsSelector:95`, `DraftEditorTab:372`, `OnboardingPage:308` (props novas
      opcionais). O "6" do comentário de `SystemPicker.tsx:25` está desatualizado: a
      contagem real de `<SystemPicker` em 2026-09-01 é 4
- [ ] G5b: primeiro render do perfil não baixa o catálogo inteiro — medido em rede
- [ ] aprovação nominal do mantenedor para a fase **e, em separado, para `packages/catalog-ui`
      em G7** (a autorização da Fase F não se estende)

---

## O que este plano deliberadamente não faz

- **Não cria campo, migration nem vocabulário novo** (D1).
- **Não mexe no sistema de avaliações** (D3).
- **Não torna o perfil buscável** (D6) — dado antes do filtro.
- **Não dá ao mestre controle da opacidade do banner** (D8) — entrega prévia.
- **Não assume que o perfil deve encolher.** 5,55 telas é sintoma, não diagnóstico: a
  resposta da literatura para densidade é agrupar, não cortar. Se a fase B acrescentar
  preenchimento, a página pode legitimamente crescer.
