# Plano 099 — Perfil do mestre

**Status:** decisões D1–D11 fechadas. **Nenhuma fase executada.**
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
   7/20.
2. **Investigar a causa do `{}`** — escrita antiga, migração de dado ou serialização.
   Medir antes de decidir o conserto.
3. **Fonte única de "anos de experiência"** (task A3) — hoje `14` no editor, `11` na bio,
   `10+` na página.

**Não é só escolher um número:** o `11` mora dentro do texto livre da bio
(*"Mestre há 11 anos"*), visível na página pública. Definir a fonte única **não apaga a
frase** — a task A3 só fecha com destino definido para o texto que contradiz (reescrever,
pedir ao mestre, ou aceitar e registrar por quê).

**Trava da task A3 (não confundir dois dados):** `experience_years` (autodeclarado, coluna) e
`years_on_platform` (calculado de `created_at`, subconsulta) **são distintos e o código
proíbe fundi-los** — comentário em `gm.ts` (spec 081, T9.1). A divergência da task A3 é entre
**editor × bio × API** do `experience_years`, nunca entre autodeclarado e calculado.

### ── GATE A ──
- [ ] `selling_points` normalizado, com teste que falha sem o normalizador (A9)
- [ ] causa do `{}` medida e registrada (ou bloqueio nomeado)
- [ ] fonte única de experiência definida, com a divergência explicada por medição
- [ ] `rtk pnpm vitest run` do pacote afetado, verde, com número citado

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

**O que a consolidação exige, medido — são dois passos, não um:** (1) trocar o
`mutationFn` de `useUpdateGm` de `api.patch('/api/v1/profile/gm')` para o `PUT`; e (2)
**alinhar `gmProfileSchema` ao contrato que o `gmPanel` já aceita**. Sem o passo 2 a porta
falsa sobrevive **do lado do cliente**: o Zod do app continua descartando os 6 campos antes
de a requisição sair, e o sintoma é idêntico ao de hoje.

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

`closed_group_*` **não passa por nenhuma das duas portas** — conferir o write path dele
antes da **task B2** (é ela que cria os campos de grupo fechado; não medido).

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
`discord/llmAssist.ts` chama a API DeepSeek com esquema, normaliza com Zod, remove cercas
de markdown e cacheia por `model`. O trabalho é um esquema novo, não uma capacidade nova.

O `parse-preview` do editor de mesa é o precedente de **arquitetura** (sugerir + confirmar),
não de técnica: aquele parser é **motor de regras**, sem modelo.

### ── GATE B ──
- [ ] busca do **critério A1** volta **sem lacuna**: todo campo lido por `mestre/*` tem formulário
- [ ] os 6 campos chegam ao banco de ponta a ponta (**nenhuma porta falsa**)
- [ ] todo campo recomendado tem frase de ganho (D10) — verificável contra a tabela
      **campo→nível de `spec.md` §8**: os 7 recomendados, com frase na linguagem do jogador
- [ ] `aria-describedby` no controle de todo campo com erro/hint (A6)
- [ ] autosave com debounce e indicador visível em página longa
- [ ] preço do grupo fechado grava **centavos** a partir de reais — testado
- [ ] `rtk pnpm vitest run` do pacote afetado, verde, número citado

---

## Fase C — Exibição (o sistema expõe)

**Só começa com o gate B fechado** — a dobra depende de o mestre ter onde preencher.

**Entrega:**

1. **Dobra** (D2): `tagline` promovida a portador primário + etiquetas dos
   **atributos-chave — `specialties`, `selling_points`, `languages`** —, com fallback para
   a headline atual enquanto vazia. A lista vem de D2 e é fechada.
   **O slot já existe e está ligado** — a task C1 não cria componente, promove.
   Tipografia atual: `.hero-title` 3rem/900, `.hero-bio` 1.125rem, `max-width: 600px`.
2. **Exibição de `specialties`, `languages`, `badges`** — hoje nenhum componente os
   renderiza. Sem isso, a fase B vira formulário que não aparece.
3. **Remover `average_price` do front** (D4) — banco intacto. **Alcance: só o campo do
   editor de perfil** (`ProfileEditPage.tsx:583-590`). O preço da mesa
   (`MestreFeaturedTable.tsx:148-155`) e o do grupo fechado
   (`MestreClosedGroupSection.tsx:68-73`) **ficam** — são a mitigação de confiança que
   sustenta D4.
4. **Vãos de seção com regra** (hoje 48/48/0/48/0/0).

**Trava:** ao mexer na precedência da dobra, conferir as **três** cadeias de `tagline`
(spec §2.3) — mexer numa não mexe nas outras, e os cortes são diferentes (140 por frase no
hero, 150 por substring no SPA).

### ── GATE C ──
- [ ] A2: tabela §2.1 da spec sem nenhuma linha 🔴
- [ ] A3: dobra com informação do mestre, medida em 1366×768 e 1920×1080
- [ ] as três cadeias de descrição conferidas, nenhuma regredida
- [ ] **mobile e tema claro medidos** (editor **e** página pública) — o alcance está
      resolvido por medição em spec §7: entra aqui, não antes de B, porque nenhuma media
      query do editor muda a estrutura de campo
- [ ] A10: antes/depois nos 20 perfis reais

---

## Fase D — Correções de forma (independente; pode correr em paralelo)

**Moradias medidas** (os códigos são os das tasks `F0..F4`; os antigos `C4/C5/C6/C7` da
investigação saíram porque colidiam com as tasks da fase C):

- **F1** = `apps/mesas`: checkbox `Manter link direto` em `components/AvatarField.tsx` e
  `components/ImageUploader.tsx` (`h-4 w-4`). **Não existe primitivo de checkbox no
  pacote** — criar lá **e** migrar as duas, nunca só ajustar valores (A7).
- **F2** = rodapé, no **pacote**: `Ver termos` (≈20px), `.artificio-footer-nav-link`
  (≈17px). Atinge mesas, downloads e glossario.
- **F1b** = `apps/mesas`: link do nome do mestre em `components/TableCard.tsx:185-192`
  (≈20px, `text-sm` sem `min-height`) — aparece nos 4 cartões da página pública, dentro do
  alcance de A6.
- **F3** = nav de 22px **não reproduz** no pacote (`min-height: 40px`) — **re-medir em
  runtime** antes de tratar como defeito.
- **F4** = campos locais do `mesas`. A escala do pacote **já existe** (34/40/48) e o
  editor não a usa: aqui a correção é **adotar o que existe**, não criar escala.
  `--space-5` **não existe** (régua é 1..4 + 6).

**⚠️ Colisão com a 098, medida:** a 098 cita `Manter link direto` na sua lista de alvos
abaixo do piso — as duas specs tocam os **mesmos três arquivos**: `AvatarField.tsx`,
`ImageUploader.tsx` e `ProfileEditPage.css` (é ele que dá os 16px do checkbox do
`AvatarField`, em `:809-814`). **Não executar em paralelo** sem combinar quem cria o
primitivo de checkbox. A ordem é call do mantenedor.

**Trava de autorização:** mudança em `packages/ui` exige aprovação nominal da ação e
verificação de impacto nos consumidores. Chegar com o conserto **medido e pronto**, pedir a
aprovação da ação — não apresentar o achado como bifurcação.

### ── GATE D ──
- [ ] A6: nenhum alvo < 24px na página pública nem no editor
- [ ] A7: correção no nível que impede recorrência (primitivo no pacote **+** migração)
- [ ] A8: outros consumidores do pacote verificados (downloads, glossario)
- [ ] aprovação nominal registrada antes de tocar `packages/ui`

---

## O que este plano deliberadamente não faz

- **Não cria campo, migration nem vocabulário novo** (D1).
- **Não mexe no sistema de avaliações** (D3).
- **Não torna o perfil buscável** (D6) — dado antes do filtro.
- **Não dá ao mestre controle da opacidade do banner** (D8) — entrega prévia.
- **Não assume que o perfil deve encolher.** 5,55 telas é sintoma, não diagnóstico: a
  resposta da literatura para densidade é agrupar, não cortar. Se a fase B acrescentar
  preenchimento, a página pode legitimamente crescer.
