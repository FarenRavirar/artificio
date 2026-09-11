# Tasks 099 — Perfil do mestre

**Status: grill concluído (2026-08-27); decisões D1-D11 resolvidas; correções da
auditoria de 2026-08-30 aplicadas. NENHUMA TASK EXECUTADA.**

---

## Tasks destravadas pelo grill

| # | task | fase | decide |
|---|---|---|---|
| T1 | Fechar o inventário de campos do perfil **sobre os campos existentes** | A | D1 decidida: sem campo novo |
| T3 | Editor: campos de **`tagline`, `specialties`, `languages`, `badges`, `selling_points`** (3 telas mantidas) — os demais campos do inventário têm task própria: T17 (`promo_badge_text`), T18 (`closed_group_*`) | B | D1, D5 decididas |
| T4 | Dobra da página pública: `tagline` + etiquetas de atributos, fallback para a headline atual | C | D2 decidida por pesquisa |
| T6 | Remover o campo `Preço Médio` do front (editor); banco/migration intactos | B | D4 decidida |
| T7 | Fazer as 3 telas funcionarem juntas: prévia do perfil público em cada uma | B | D5 decidida |

**Travas medidas, por task:**

- **T3 — ordem obrigatória.** Estender `gmProfileSchema` (Zod) **e** a desestruturação de
  `updateGmProfileHandler` **antes** de criar campo de `tagline`/`selling_points`/
  `badges`; sem isso o campo é porta falsa (grava nada, indica "salvo"). `languages` e
  `specialties` já passam pelo contrato — custam só o formulário. Tabela completa das
  quatro camadas no `plan.md`, fase B.
- **T3 — `selling_points` é seleção, não texto.** `icon` vem de dicionário fechado de 14
  chaves; valor fora cai em `Sparkles` sem erro (spec §2.13).
- **T3 — reusar `TagInput`** (já existe no `mesas`, aceita `string[]`) para
  `specialties`/`languages`/`badges`, e `EditorField` + `RECOMMENDED_GAIN` (padrão do
  editor de mesa) para marcar nível e dizer ao mestre o que ele ganha. **Não existe tag
  input no pacote** — o `TagInput` do `mesas` é o reuso correto aqui.
- **T3 — `aria-describedby` é responsabilidade do formulário, não do `Field`.** O `Field`
  do pacote gera o `id` da descrição, mas **nenhum controle recebe o atributo**
  (`TextInput`/`Textarea`/`Select` não o setam). Sem wire manual, erro e hint não são
  anunciados pelo leitor de tela — cai no critério A6. Medido na auditoria de
  `packages/ui` (2026-08-30).
- **T4 — não cria componente.** O slot da dobra já existe em `MestreHero` (`tagline` →
  primeira frase de `bio_long`, truncada em 140 **só se exceder** → nada); a task promove
  o existente a primário.
- **T4 — são TRÊS cadeias sobre o mesmo dado, com cortes diferentes** (spec §2.11):
  `MestreHero` (1ª frase, 140), `buildGmDescription` no backend (crawler) e `applySeo` no
  front (`slice(0, 150)`, fallback próprio). Mexer numa **não** mexe nas outras — conferir
  as três antes de fechar a task, e nunca supor que o corte é o mesmo.
- **T3 + T4 andam juntas para `specialties`/`languages`/`badges`:** nenhum componente
  `mestre/*` os exibe hoje. Formulário sem exibição repete o defeito invertido.
- **T3 — cada campo diz o que o mestre ganha.** Padrão `RECOMMENDED_GAIN` do editor de
  mesa, validado por fonte externa: o LinkedIn dobrou a completude de perfil trocando barra
  de progresso vaga por tarefa com benefício explícito; o Upwork publica 4,5× mais chance
  de contratação com perfil completo (spec §3.1d). Hoje **nenhum campo do editor de perfil
  diz por que existe** — com 0/20, é hipótese tão provável quanto a ausência de campo.
- **T16 (nova) — extração da bio com confirmação.** Ver abaixo.

## Tasks encerradas pelo grill (sem trabalho)

| # | task | motivo |
|---|---|---|
| T2 | Migration, se D1 exigir campo novo | **cancelada** — D1: modelo não mexe, sem migration |
| T5 | Seção de Avaliações sem avaliações | **cancelada** — D3: manter como está; trade-off registrado em spec §4 |

## Tasks novas, abertas pelo inventário e pela pesquisa (todas decididas)

| # | task | fase | estado |
|---|---|---|---|
| T16 | Extrair atributos da bio já escrita e **oferecer ao mestre para confirmar** — nunca gravar direto | B, depois do formulário | **decidida: entra** |
| T17 | Campo para `promo_badge_text` — a faixa do topo do hero já renderiza e não tem editor | B (ordem 5) | **decidida: entra** (D9) |
| T18 | Campos para `closed_group_*` — as 4 colunas medidas em `db/types.ts` são `closed_group_enabled` (bool), `closed_group_systems` (`UUID[]`), `closed_group_description` (texto), `closed_group_min_price_cents` (**centavos**). `MestreClosedGroupSection` já exibe preço e sistemas, e nunca apareceu para ninguém. **Trava:** o campo é em reais para o mestre e a coluna é em centavos (`formatPriceBRL(min_price_cents)` na leitura) — converter na escrita, ou o preço sai 100× errado. `closed_group_systems` é array de UUID, não nome | B (ordem 2) | **decidida: entra** (D9) |
| T19 | Banner: prévia do véu no editor, **scrim segue fixo** | B | **decidida** (D8) |

**T17/T18 vêm do inventário de §2.5:** capacidades com render pronto e **nenhuma porta de
entrada**. `closed_group` é o caso extremo — seção pública inteira escrita, 0/20 perfis com
o recurso ligado, porque não existe onde ligar. O trabalho que falta é o formulário, não a
feature. Entra em **segundo lugar** na fase B: no concorrente direto, **70–80% das reservas
são campanha**, que é o que `closed_group` representa (spec §D9).

**T19 vem de §2.5b:** o recorte já é editável e o scrim (72–88%) fica **fixo** — a prática
desaconselha expor a opacidade ao autor, porque é o parâmetro que garante o contraste. A
entrega é a **prévia** do topo com a foto real, que é o que falta (spec §D8).

**T16 deixou de ser hipótese de custo.** A extração estruturada já roda neste backend:
`discord/llmAssist.ts` chama a API DeepSeek com esquema de extração, **normaliza o retorno
com Zod** (payload externo = `unknown` até validar), remove cercas de markdown e **cacheia
por `model`**. Não é preciso construir pipeline de NER: o trabalho é um esquema novo sobre
infraestrutura que já existe, exercitada em produção pelo parser de anúncio.

Fundo que sustenta T16: §2.4 mostra o mestre escrevendo atributos à mão dentro da bio
(`Mestre há 11 anos`, `Fanático por The Witcher`); 10/20 têm bio preenchida enquanto os
campos estruturados estão em 0/20 — **existe dado para extrair hoje**. O padrão vem do
Airbnb (LAEP: extrai → mapeia contra taxonomia → pontua confiança → **recomenda ao
anfitrião**, spec §3.1b) e **já roda neste app**: `POST /api/v1/gm/parse-preview` +
badge "Pelo anúncio" + `ParserSignalsPanel`, no editor de mesa (§3.1c).

**Trava não negociável:** a máquina sugere, o mestre confirma, nada trava publicação — a regra
que os dois sistemas seguem. O F1 do Airbnb é 75%: gravar direto erraria um em cada quatro
atributos mostrados ao jogador.

**Não medido:** o custo exato do esquema novo de extração para bio (o parser atual é
calibrado para anúncio de mesa). O que está medido é que a infraestrutura existe e roda.

**Precisão de vocabulário (auditoria de backend, 2026-08-30): o parser de anúncio NÃO é
modelo de ML — é motor de regras.** `segmentAnnouncements` → `normalizeLooseText` →
`parseDiscordAnnouncement` (centenas de `label`/`alias`/regex/`startsWith`/`includes`) →
`buildTableDraftFields`, com catálogos e `label_aliases` corrigidos por humanos. Busca por
`word2vec|bert|tfidf|tensorflow|onnx|neural|embedding` no parser não devolve **nenhum**
sinal de modelo (os aparentes acertos são a substring `bert` dentro de "aberta"). Dizer
"treinado" induziria o implementador a procurar pesos que não existem: o correto é
**calibrado por regras + correção humana**.

Isto **não** conflita com a extração via LLM de T16: `llmAssist.ts` (DeepSeek + esquema +
Zod) é caminho separado do parser de regras. Os dois convivem hoje.

## Conserto — não depende de decisão, mas depende de autorização

Entram seja qual for a resposta do grill (spec §5). Cada um exige aprovação nominal da
**ação** quando tocar `packages/*`.

| # | task | onde | trava |
|---|---|---|---|
| T8 | Uma fonte só para "anos de experiência" (C1) — front não arredonda; investigar por que a API pública devolve valor divergente do editor (dado, não formatação). **Trava:** `experience_years` (autodeclarado, coluna) e `years_on_platform` (calculado de `created_at` por subconsulta) são **dados distintos e o código proíbe fundi-los** — comentário em `gm.ts` (spec 081, T9.1, achado D2): *"não fundir os dois campos na UI"*. A fonte única de C1 é entre **editor × bio × API** do `experience_years`, nunca entre autodeclarado e calculado | `mesas` | — |
| T9 | Normalizar `selling_points` na fronteira (C2) | investigar a causa antes | — |
| T10 | Autosave (C3): **não há debounce nenhum** — a mutation dispara a cada `onChange` (uma escrita por tecla); o JSDoc promete 500ms que não existem. E o indicador não tem `position: fixed`/`sticky` (a propriedade não aparece no CSS), então rola para fora numa página de 3,75 telas — quem edita a bio nunca vê confirmação | `mesas` (CSS + hook) | — |
| T11 | Alvos < 24px: `Manter link direto` (C4) em `components/AvatarField.tsx` e `components/ImageUploader.tsx` (`h-4 w-4`) — **não existe primitivo de checkbox no pacote**, criar lá + migrar as duas; rodapé no pacote ("Ver termos" ≈20px, `.artificio-footer-nav-link` ≈17px); nav pendente de re-medição | C4 `mesas`+pacote; C5 **`packages/ui`** | aprovação + impacto (pacote) |
| T12 | Largura de campo por tamanho de resposta (C6) — o pacote **já tem** `artificio-control-sm/md/lg` (34/40/48px) e o editor de perfil não usa: a correção é adotar o existente, não criar escala | pacote + `mesas` | aprovação + impacto |
| T13 | Escala de altura de campo (C7) — mesma origem de T12; `--space-5` **não existe** (régua é 1..4 + 6). **`Textarea` é exceção medida:** `.artificio-textarea` tem `min-height: 112px` declarado depois dos blocos de tamanho e os vence — a escala ali muda só fonte e padding, nunca altura | pacote + `mesas` | aprovação + impacto |
| T14 | Vãos de seção com regra (C8) | `mesas` | — |
| T15 | Listar os sistemas escolhidos, não só contar (C9) | `mesas` | — |

**Decisão de escopo (grill, 2026-08-27):** T11-T13 pertencem à 099, **independente da
098** — sem coordenação nem dependência entre as duas specs.

## Medição obrigatória antes de fechar qualquer task

- Teste que falha sem a correção, **verificado reintroduzindo o defeito** (A9).
- Para T11-T13: a resposta medida de *onde este defeito pertence* (A7), e o cruzamento
  com os outros apps (A8).
- Medição antes/depois nos 20 perfis reais, não só no `mestre-hermes` (A10).
- Mobile (719px) e tema claro — **não medidos nesta investigação**, precisam entrar.
- Re-medição runtime da nav global no `mesas` — a medição de 22px não reproduz no CSS
  do pacote (`min-height: 40px`), antes de T11 tocar a nav.
- **Conferido (2026-08-30):** a 098 toca os mesmos componentes — cita `Manter link direto`
  na sua lista de alvos abaixo do piso. T11 e a 098 **não rodam em paralelo** sem combinar
  quem cria o primitivo de checkbox no pacote; a ordem é call do mantenedor.

## Pendências desta investigação

| o quê | estado |
|---|---|
| causa de `selling_points` voltar `{}` em 7/20 perfis | **não medida** |
| comportamento da página com perfil cheio | **impossível hoje** — nenhum dos 20 está preenchido; a exibição via `closed_group` (preço/sistemas) também não tem perfil de controle |
| mobile e tema claro | **não medidos** |
| nav global 22px em `packages/ui` | **não reproduz no CSS do pacote** — re-medição runtime pendente (auditoria 2026-08-30) |
| se a 098 toca `AvatarField`/`ImageUploader`/`ProfileEditPage.css` | **medido: sim** — a 098 cita `Manter link direto`. T11 exige combinar a ordem com a 098 (quem cria o primitivo de checkbox), não roda em paralelo às cegas |
| `gmProfileSchema` sem `selling_points`/`tagline`/`promo_badge_text`/`badges` | **medido** — pré-requisito da fase B (plan.md), antes de qualquer campo novo |
| estender `PATCH /profile/gm` vs. migrar editor para `PUT /gm/profile` (que já valida os 6 campos) | **custo não medido** — decisão de implementação na fase B |
| busca do catálogo não lê **atributo descritivo** do mestre (o nome entra, via `COALESCE(gm.nickname, p.display_name)`) | **medido** — fora do escopo por **ordem** (D6: filtro antes do dado devolve vazio), **não** por D1, que só congela o modelo. Teto do que a 099 entrega (spec §2.10) |
| `specialties`/`languages`/`badges` sem componente que os exiba | **medido** — fase B e C andam juntas para estes três |
