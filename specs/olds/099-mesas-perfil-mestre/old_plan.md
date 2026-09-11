# Plano 099 — Perfil do mestre

**Status:** grill concluído (2026-08-27); decisões D1-D11 resolvidas; correções da
auditoria de 2026-08-30 aplicadas. **Nenhuma fase executada.**

---

## Decisões que este plano aplica (spec §4)

- **D1:** modelo de informação não mexe — sem migration, sem campo novo; usa o que já
  existe no banco (`tagline`/`selling_points`/`promo_badge_text` da `migration_107`;
  `specialties`/`languages`/`badges` de `migration_01_base_schema.sql:95-97`).
- **D2:** dobra respondida por pesquisa (§3.2/§3.3): `tagline` + etiquetas de atributos;
  headline gerada vira fallback; `featured` continua do admin.
- **D3:** seção de Avaliações permanece como está (feature recente); trade-off registrado
  em spec §4.
- **D4:** `Preço Médio` sai do front; migration e banco intactos.
- **D5:** mantém as 3 telas; que funcionem (C3, C9, prévia). Coleta progressiva não entra.
- **Escopo:** 099 independente — leva C4-C7 (T11-T13); nenhuma coordenação com a 098.

---

## Fase A — Inventário sobre os campos existentes (D1 decidida)

Sem migration (D1). Entrega:

1. Inventário fechado sobre o que já existe: para cada informação que um jogador usa para
   escolher mestre, qual campo existente a carrega — `tagline`, `specialties`,
   `languages`, `selling_points`, `badges`, `links`, `experience_years`.
2. Resolução de C1: qual fonte manda em "anos de experiência", e o que acontece com o
   texto que hoje contradiz (`Mestre há 11 anos` dentro da bio). Fato medido na auditoria
   de 2026-08-30: o front não arredonda (`MestreHero.tsx:161` renderiza o valor cru) —
   a divergência 14 × 11 × "10+" é de dado/fontes (editor, bio, API pública), não de
   formatação.
3. Normalização na fronteira (C2), antes de qualquer JSONB entrar em props.

**Trava:** nada aqui toca layout. Se a fase A produzir mudança visual, saiu do escopo.

## Fase B — Porta de entrada (o mestre insere)

Só começa com A fechada. Entrega o editor sobre os campos existentes: cada campo do
inventário tem onde ser preenchido, e o mestre vê o que preencheu.

Inclui: C3 (autosave que não some — e que escreve por `onChange`, sem o debounce que o
JSDoc promete), C9 (sistemas listados, não só contados), remoção do campo `Preço Médio`
do front (D4), prévia do perfil público, e as 3 telas mantidas e funcionando (D5).

### O contrato de escrita — bloqueio a resolver ANTES de desenhar tela

Um campo de formulário novo não basta: o valor tem de sobreviver a quatro camadas. Hoje
morre em duas. Caminho que o editor usa: `ProfileEditPage` → `useUpdateGm` →
`validateOrThrow(gmProfileSchema, …)` → `PATCH /api/v1/profile/gm` →
`updateGmProfileHandler` → coluna.

| campo | form | `gmProfileSchema` | handler PATCH | coluna | chega? |
|---|---|---|---|---|---|
| `nickname`, `bio_long`, `experience_years` | ✔ | ✔ | ✔ | ✔ | **sim** |
| `avatar_*`, `banner_*` | ✔ | ✔ | ✔ | ✔ | **sim** |
| `average_price` | ✔ | ✔ | ✔ | ✔ | sim (mas sai — D4) |
| `languages` | ✘ | ✔ | ✔ | ✔ | **falta só o form** |
| `specialties` | ✘ | ✔ | ✔ | ✔ | **falta só o form** |
| `tagline` | ✘ | **✘** | **✘** | ✔ | **não** |
| `selling_points` | ✘ | **✘** | **✘** | ✔ | **não** |
| `badges` | ✘ | **✘** | **✘** | ✔ | **não** |
| `promo_badge_text` | ✘ | **✘** | **✘** | ✔ | **não** |

Duas consequências para a ordem do trabalho:

1. **`languages` e `specialties` custam só o formulário** — o contrato inteiro já aceita.
   São a entrega mais barata da fase B (mas exigem exibição junto, spec §2.13).
2. **`tagline`, `selling_points` e `badges` exigem estender o Zod (`gmProfileSchema`) *e*
   a desestruturação de `updateGmProfileHandler`.** Adicionar o campo na tela sem isso
   produz **porta falsa**: o mestre digita, o indicador diz "salvo", o Zod descarta em
   silêncio. Estender o contrato primeiro.

**A outra porta:** `POST`/`PUT /api/v1/gm/profile` (`gmPanel`) **já aceitam os 6 campos**,
com `isSellingPoint` e sanitização de markdown — é código de escrita que nenhum cliente
exercita.

**Decisão: consolidar na porta que já valida** (`PUT /api/v1/gm/profile`), não estender a
que valida menos.

O caso tem nome e catálogo na prática de API: duas operações com responsabilidades
sobrepostas, surgidas de evolução da API, se resolvem por **Merge Endpoints** — trazer as
operações para um endpoint só, para que sejam *"implantadas, escaladas e evoluídas em
conjunto"*, com a validação consolidada num lugar
([Interface Refactoring Catalog, *Merge Endpoints*](https://interface-refactoring.github.io/refactorings/mergeendpoints)).
O princípio que sustenta é coesão: operações que pertencem juntas moram no mesmo endpoint,
o que é a forma de manter **fonte única de verdade** da regra de validação.

Estender o `PATCH` faria o oposto: duplicaria `isSellingPoint` e a sanitização de markdown
num segundo lugar, deixando duas portas para o mesmo recurso com regras que divergem a cada
manutenção — que é a dívida que o padrão existe para eliminar. E é a mesma regra pétrea do
AGENTS.md (*compartilhado por padrão; exceção é o defeito*), aplicada dentro do app.

**O que a consolidação exige, medido:** trocar o `mutationFn` de `useUpdateGm` de
`api.patch('/api/v1/profile/gm')` para o `PUT`, e alinhar `gmProfileSchema` ao contrato que
o `gmPanel` já aceita. O `PATCH` permanece enquanto houver consumidor — a remoção é passo
próprio, com busca de consumidores antes.

**Consumidores medidos:** `rtk rg "profile/gm|profile/me/gm" apps packages` (sem testes)
devolve **um único cliente** — `useProfileQuery.ts:171` (`useUpdateGm`). As outras duas
ocorrências são a própria rota e uma linha de log no backend. Nenhum outro app consome.
A consolidação move um `mutationFn`, e as duas rotas `PATCH` ficam sem cliente — podendo
ser removidas em passo próprio.

### O inventário fecha o escopo da fase: código pronto sem porta de entrada

Spec §2.5 mede o estoque completo. **Regra desta fase: nada do que já está construído
some do radar** — capacidade com render pronto e sem formulário é capital gasto que não
rende, e recuperá-la custa o campo que falta, não a feature.

| já pronto (não reconstruir) | falta | task |
|---|---|---|
| avatar + banner com **recorte editável**, `object-position` derivado | previsibilidade do véu (§2.5b) | T19 |
| `MestreSellingPoints` — render, 14 ícones, validação `isSellingPoint` no backend | campo (ícone + 3 textos) | T3 |
| `MestreHero` — slot de `tagline` | um campo | T3 |
| `MestreHero` — faixa `promo_badge_text` | um campo | T17 |
| `MestreClosedGroupSection` — **seção inteira** com preço e sistemas aceitos | 4 campos + liga/desliga | T18 |
| `MestreVttPlatforms` + `VttPlatformsEditor` | nada — funciona, editado no painel | — |
| `MestreContactMethods` + `ContactMethodsEditor` | nada — funciona; editado em **duas** telas: editor de mesa (`MasterPart`) e `PainelMestrePage` | — |
| `LinksManager` + `LinksDisplay` | nada | — |
| contrato de escrita de `languages`/`specialties` | campo **e** exibição | T3 + T4 |

Os dois últimos casos de "funciona, editado longe" **não são defeito a corrigir** — D5
decidiu manter as 3 telas. O que a fase entrega para eles é a prévia (T7), para o mestre
ver o efeito sem caçar a tela.

### A porta de entrada tem duas formas — e a segunda já existe no produto

A fase B foi escrita como "criar campo de formulário". A pesquisa (spec §3.1b–§3.1e) mostra
que essa é **uma** das formas, e que a indústria usa a outra quando o preenchimento manual
falha — que é exatamente o caso aqui, com 0/20.

| forma | o que é | onde já existe |
|---|---|---|
| **Formulário** | campo próprio para cada atributo | a proposta original da fase B |
| **Extração + confirmação** | lê o que o mestre já escreveu na bio, sugere o atributo, **ele confirma** | `POST /gm/parse-preview` + badge "Pelo anúncio" no editor de mesa |

As duas **não competem** — o Airbnb usa as duas (editor de anúncio *e* LAEP). Aqui a
segunda tem lastro forte: §2.4 mede que o mestre **já escreve os atributos à mão** dentro
da bio (`Mestre há 11 anos`, `Fanático por The Witcher`), e 10 dos 20 têm bio preenchida —
ou seja, **existe dado para extrair hoje**, enquanto os campos estruturados estão zerados.

**Trava não negociável, das duas fontes:** a máquina **sugere, nunca grava**. O LAEP
pontua confiança e manda para sistemas que recomendam ao anfitrião; o parser do `mesas`
marca o campo com "Pelo anúncio" e a regra escrita no código é *"publicar nunca é bloqueado
por isso — aviso, não validação"*. O F1 do Airbnb é 75%: um em cada quatro atributos
sairia errado se gravasse direto.

**O que isso muda na ordem do trabalho:** o formulário continua sendo a base (sem ele não
há onde confirmar nem corrigir). A extração entra como **aceleração do preenchimento**, não
como substituto — e só depois de o contrato de escrita aceitar os campos.

### O que reusar — não construir

O editor de mesa (spec 096) já resolveu este problema de interface. Regra pétrea
(compartilhado por padrão): reusar, não reinventar.

**Primitivos em `@artificio/ui`:** `Field` (label + hint + erro + `required`), `TextInput`,
`Textarea`, `Select`, `Badge`, `Button`, `Panel`. A escala de controle **já existe e é a
resposta de C6/C7**: `artificio-control-sm` (34px), `-md` (40px), `-lg` (48px), todos como
`min-height`. O editor de perfil não usa nenhum deles — tem markup local, o que produz as
alturas 16/38/42/48/50/300 sem escala. Espaço: `--space-1..4` e `--space-6`;
**`--space-5` não existe**.

**Quatro armadilhas do pacote, medidas (auditoria de `packages/ui`, 2026-08-30) — não
descobrir na implementação:**

1. **`Field` NÃO emite `aria-describedby`.** Ele computa `${id}-description` e aplica esse
   `id` ao `<p>` de erro/hint, mas **nenhum controle recebe o atributo** — `TextInput`,
   `Textarea` e `Select` não o setam. O único `aria-describedby` do pacote está no `Modal`.
   **Consequência:** a associação erro↔campo para leitor de tela **não vem de graça**; o
   formulário tem de setar `aria-describedby={`${id}-description`}` no controle. Tratar
   como acessibilidade automática é erro — e cai direto no critério A6.
2. **`Textarea` não obedece à escala de altura.** `.artificio-textarea` declara
   `min-height: 112px` **depois** dos blocos de tamanho, com a mesma especificidade — logo
   vence. `artificio-control-md` num `Textarea` altera só `font-size` e `padding`, nunca a
   altura. Planejar 40px ali é expectativa falsa.
3. **Nem checkbox nem tag input existem no pacote** (relevante para C4/T11 e para os campos
   de `specialties`/`languages`/`badges`). Existe um padrão de *toggle de vocabulário fixo*
   dentro do `GmReviewPanel`, feito com `<button>` — **não é primitivo exportado** e não
   serve como tag input genérico; serve como precedente **só** se o caso for seleção em
   conjunto fechado.
4. **`admin/*` não sai do índice raiz.** `AdminTable` e afins vêm do subpath
   `@artificio/ui/admin`, declarado em `package.json`. Importar da raiz não funciona.

**Componentes já no `mesas`:** `TagInput` (`value: string[]`) encaixa direto em
`specialties`/`languages`/`badges`; `SearchableSelect`, `StyleFacetPicker`,
`MarkdownEditor`; `UserSystemsSelector` (que hoje só **conta**, não lista — C9/T15).

**O padrão do editor de mesa que a fase B deve seguir:**

- **`EditorField`** — envelopa o `Field` do pacote e marca três níveis: obrigatório
  (asterisco + "Obrigatório." no hint), recomendado (frase do ganho), opcional
  ("(opcional)" no rótulo). Carrega `data-ob` com o nível, e os testes cruzam isso com o
  registro de validação — marca e regra têm fonte única.
- **`RECOMMENDED_GAIN`** — a frase que diz ao mestre **o que ele ganha, na linguagem do
  jogador**. Em produção: *"mesas com banner aparecem em destaque"*, *"ajuda o jogador a
  saber se a mesa é para ele"*. É o mecanismo que faz o mestre preencher — e o que falta
  ao editor de perfil, onde nenhum campo diz por que vale a pena.
- **`CardPreview`** — prévia ao vivo ao lado do formulário (atende a prévia pedida em D5).
- **Partes semânticas** (`IdentityPart`, `AudiencePart`, `ValuesPart`…) em vez de uma
  coluna de 3,75 telas.

**Medida de aceite da fase:** a busca de A1 (§6 da spec) volta sem lacuna.

**Decidido no grill:** coleta progressiva (§3.4) **não** entra nesta passada.

## Fase C — Exibição (o sistema expõe)

Só começa com B fechada — a dobra nova depende do mestre ter onde preencher `tagline`.

Entrega a página pública: dobra = `tagline` + etiquetas de atributos, com fallback para
a headline atual enquanto vazia (D2); Avaliações como está (D3); sem `average_price` no
perfil (D4); e a ordem das seções como consequência do inventário.

**O slot da dobra já existe e já está ligado.** `MestreHero` renderiza, abaixo da
headline gerada, um bloco com precedência `tagline` → **primeira frase** de `bio_long`
(`split(/[.!?]\s+/)[0]`, truncada em 140 **só se exceder**) → nada. T4 **não cria
componente**: promove o slot existente a portador primário. Tipografia atual, para
dimensionar a mudança: `.hero-title` 3rem/900, `.hero-bio` 1.125rem com
`max-width: 600px` centralizado, badges em pill.

**`tagline` alimenta mais dois consumidores, e eles têm cortes e fallbacks distintos**
(spec §2.11): `buildGmDescription` no **backend** (`utils/ogDescription.ts`, servida ao
crawler via `routes/og.ts`) e `applySeo` no **front** (inline em `MestrePage`, com
`bio_long.slice(0, 150)` e fallback próprio). São **três cadeias independentes** sobre o
mesmo dado.

**Trava para a fase B/C:** mexer numa não mexe nas outras. Se T4 alterar a precedência da
dobra, verificar as outras duas antes de declarar concluído — e não assumir que o corte é
o mesmo (140 por frase no hero, 150 por substring no SPA). Encher `tagline` melhora as
três de uma vez, porque é o primeiro item das três.

**`specialties`, `languages` e `badges` não têm exibição nenhuma** — nenhum componente
`mestre/*` os renderiza. São a saída que falta para a entrada criada na fase B; sem eles,
a fase B vira formulário que não aparece.

**Fato medido na auditoria de 2026-08-30:** a página já exibe preço e lista de sistemas
por outros caminhos — `MestreClosedGroupSection` (`closed_group.enabled`) e
`MestreFeaturedTable` (preço de mesa). O inventário da fase A deve distinguir
`average_price`/`systems.gm` (sem exibição) de `closed_group.min_price_cents`/
`closed_group.systems` (exibição condicionada a dado), para a fase C não mexer no dado
errado.

Inclui C8 (vãos de seção sem regra).

**Medida de aceite:** A2 e A3 da spec, medidas em 1366×768 e 1920×1080, nos dois temas.

## Fase D — Correções que pertencem ao pacote

**Independente de A/B/C — pode correr em paralelo, e provavelmente deve.**

C4, C5, C6, C7: alvo de clique abaixo de 24px, largura de campo por tamanho de resposta,
escala de altura. **Moradias medidas:**

- **C4** = `apps/mesas`, duas instâncias do checkbox `Manter link direto`:
  `components/AvatarField.tsx` (16px, via `ProfileEditPage.css`) e
  `components/ImageUploader.tsx` (`h-4 w-4`). **Não existe primitivo de checkbox no
  pacote** — criar lá e migrar as duas, nunca só ajustar os valores (A7).
- **C5** = rodapé, no pacote: `Ver termos de uso` (≈20px) e `.artificio-footer-nav-link`
  (≈17px). Atinge mesas, downloads e glossario.
- **C5b** = nav global de 22px **não reproduz** no pacote (`.artificio-nav-link` tem
  `min-height: 40px`) — re-medir em runtime antes de tratar como defeito.
- **C6/C7** = campos locais do `mesas`. O pacote **já tem a escala pronta**
  (`artificio-control-sm/md/lg` = 34/40/48px) e o editor não a usa; `--space-5` não
  existe (régua é 1..4 + 6). Aqui a correção é sobretudo **adotar o que existe**, não
  criar escala nova.

**Decisão de escopo (grill, 2026-08-27):** pertencem à 099, **independente da 098** —
sem coordenação nem dependência entre as duas specs. *Inferência a confirmar (auditoria
2026-08-30):* se a 098 toca `Manter link direto` no editor de anúncio, ambas especificam
os mesmos componentes — conferir antes de executar em paralelo.

**Esta fase é a que a regra pétrea governa.** Antes de corrigir, responder medindo:
o defeito existe fora do `mesas`? Onde a correção impede a recorrência? Entrega do tipo
"ajustei os N valores do `mesas`" reprova A7. Para C4/C6/C7 a resposta pétrea é
primitivo no pacote **e** migração do `mesas` — nunca só uma coisa nem só a outra.

**Trava de autorização:** mudança em `packages/ui` exige aprovação nominal da ação e
verificação de impacto nos consumidores (AGENTS.md §Autorização). Chegar com o conserto
medido e pronto, pedir a aprovação da ação — não apresentar o achado como bifurcação.

---

## O que este plano deliberadamente não faz

- **Não cria campo, migration nem vocabulário novo** (D1).
- **Não mexe no sistema de avaliações.** D3: seção mantida; trade-off registrado em spec
  §4.
- **Não assume que o perfil deve encolher.** 5,55 telas é sintoma, não diagnóstico: a
  098 §6.7 mediu que a resposta da literatura para densidade é agrupar, não cortar. Se a
  fase B acrescentar preenchimento, a página pode legitimamente crescer.
