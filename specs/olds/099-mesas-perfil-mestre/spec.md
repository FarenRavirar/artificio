# Spec 099 — Perfil do mestre: o que o mestre insere e o que o sistema expõe

**App:** `mesas` · **Status:** fases A, B e E executadas (gates A e B fechados; B7 com pendência nomeada); **fase C** merged em `dev` pela PR #302 — C1 com aceite runtime pendente e **C4 aberta**; **fase F** merged pela PR #303 (`b69f4c4`) e **deployada em beta em 2026-09-01** — F1b e F2 medidos no build novo em desktop, F4 com a ressalva de §13.7, **mobile do F2 não medido**; **fase G aberta em 2026-09-01, nenhuma task iniciada** (§13), aguardando aprovação do desenho
**Escrita para implementar.** Investigação, medições e fontes que sustentam cada decisão
estão em `old_spec.md` (temporário, será removido após conferência do mantenedor).

---

## 1. O problema, em uma frase

**O perfil do mestre não tem onde inserir aquilo que ele expõe.**

Sete campos que a página pública renderiza — ou que o banco guarda para ela — **não têm
nenhum campo de formulário em lugar nenhum do frontend**. Todos estão em 0/20 perfis de
produção. A correlação é perfeita: todo campo com porta de entrada tem ao menos um perfil
preenchido; nenhum campo sem porta tem qualquer um.

**Cuidado com a inferência:** o que está medido é a **ausência de porta**, não a motivação
de quem não preencheu. Não se afirma que os 20 queriam preencher — afirma-se que nenhum
teve como.

**O critério que governa cada decisão desta spec:** o jogador vai passar 3 ou 4 horas por
semana com um desconhecido conduzindo a história dele. Todo campo aqui existe para
responder uma pergunta que ele faz antes de sentar à mesa. Campo que não responde nenhuma
não entra, por mais que a coluna exista.

---

## 2. Estado de entrada, medido (2026-08-30)

### 2.1 Inventário: cada campo, onde entra e onde sai

Baseline que abriu as fases B e C. Toda linha "sem entrada" era código já escrito,
testado e deployado que nunca tinha chegado a ninguém; o estado reconciliado da execução
fica logo abaixo da tabela e nas tasks.

| campo | edita hoje | exibe hoje | estado |
|---|---|---|---|
| `avatar_url` + `avatar_crop_*` | `AvatarField` (recorte 1:1) | `MestreHero` | ✅ completo |
| `banner_url` + `banner_crop_*` | **`ImageUploader`** (`kind="profile_banner"`) | fundo do hero, sob scrim fixo | ✅ completo |
| `bio_long` | `MarkdownEditor` (300px) | `MestreBio` | ✅ completo |
| `experience_years` | editor | `MestreHero`, só se `>= 3` — **com selo de verificado** | ⚠️ autodeclarado exibido como verificado (task A3, §12) |
| `links` | `LinksManager` | `LinksDisplay` | ✅ completo |
| `contact_methods` | editor de mesa **e** `PainelMestrePage` | `MestreContactMethods` + `MestreContactForm` | ✅ funciona |
| `preferred_vtt_platforms` | `PainelMestrePage` (`VttPlatformsEditor`) | `MestreVttPlatforms` | ✅ funciona |
| `systems.gm` | `UserSystemsSelector` (**só conta**) | **ninguém** | 🔴 entrada sem saída |
| `average_price` | editor | **ninguém** | 🔴 sai por D4 |
| `tagline` | **nenhum** | `MestreHero` + **2 descrições** (§2.3) | 🔴 saída sem entrada |
| `selling_points` | **nenhum** | `MestreSellingPoints` | 🔴 saída sem entrada |
| `promo_badge_text` | **nenhum** | faixa no topo do `MestreHero` | 🔴 saída sem entrada |
| `closed_group_*` (4 col.) | **nenhum** | `MestreClosedGroupSection` (seção inteira) | 🔴 saída sem entrada |
| `specialties` | **nenhum** | **ninguém** | 🔴 órfão dos 2 lados |
| `languages` | **nenhum** ¹ | **ninguém** | 🔴 órfão dos 2 lados |
| `badges` | **nenhum** | **ninguém** | 🔴 órfão dos 2 lados |
| `covil_verified`, `discord_connected`, `reviews_count` | colunas, outros fluxos | `MestreHero` | ✅ correto |
| `tables_count`, `tables_hosted_count`, `years_on_platform` | **subconsultas** em `gm.ts` | `MestreHero` | ✅ correto |

¹ há picker no onboarding, mas grava em `/api/v1/me/preferences` — outra entidade.

**Saldo:** 7 grupos sem porta de entrada, 5 sem exibição, 3 sem nenhuma das duas.

**Estado local após B/C (2026-09-01):** B abriu as portas de entrada; C2, entregue junto
com B3, expõe `specialties`, `languages` e `badges` em `MestreHighlights`; C1 promove
`tagline` ao `h1` e leva para a dobra até dois valores de cada categoria fechada de D2;
C3 aplica um fluxo pós-hero único com vão de 48px. O beta acessível ainda é anterior a
essas entregas, portanto esta reconciliação **não** transforma implementação local em aceite
runtime: A3, A10 e o gate C permanecem abertos.

### 2.2 Forma exata dos dados (errar aqui é bug silencioso)

```ts
selling_points: Array<{ icon: string; title: string; description: string; highlight?: string }>
```

`icon` é chave de **dicionário fechado de 14 valores** (`SELLING_POINT_ICONS`):

```
clock · monitor · coins · sparkles · shield · heart · zap
users · trophy · headphones · mic · video · film · book
```

Chave fora da lista **não quebra** — cai em `Sparkles` sem aviso. Por isso o campo é
**seleção**, nunca texto livre. O backend (`isSellingPoint`) exige `icon`/`title`/
`description` como `string` e **descarta em silêncio** (via `.filter`) o item que não bate:
sem `throw`, sem log. O formulário valida antes de enviar.

| campo | tipo real | atenção |
|---|---|---|
| `specialties`, `languages`, `badges` | `Generated<string[]>` | texto livre, sem vocabulário fechado |
| `tagline` | `string \| null` | sem limite no banco |
| `experience_years` | `number \| null` | autodeclarado; **≠** `years_on_platform`, que é 0 em 7/7 (§12) |
| `promo_badge_text` | `string \| null` | — |
| `closed_group_enabled` | `Generated<boolean>` | — |
| `closed_group_systems` | `Generated<string[]>` | **UUID**, não nome |
| `closed_group_description` | `string \| null` | — |
| `closed_group_min_price_cents` | `number \| null` | **centavos** — o campo mostra reais |
| `selling_points` | `unknown` (JSONB) | normalizar na fronteira |

**Achado A1 — medido (2026-08-31):** a API devolve `{}` — objeto, não array — em **7 de 12**
perfis do beta (banco e API espelham 1:1; a hipótese de serialização na leitura está
descartada com medição). Em **produção** a proporção é pior: **39 de 48** perfis têm `{}`, e
nascem assim até 08-28. Não quebra porque `MestreSellingPoints` sai cedo com
`!Array.isArray(...)`.

**Causa no beta, medida:** a hidratação `POST /admin/sync/enrich` (`adminEnrichment.ts` +
allowlist `hydration/config.ts:10`) copiou `selling_points` de produção — os ids batem (5 dos
7 `{}` do beta têm o mesmo id e valor em prod). Os 12 pontos de escrita do código atual foram
todos lidos e **nenhum grava `{}`** (POST grava sempre array; PUT não toca a coluna; demais
omitem → default `[]`).

**Bloqueio nomeado:** a origem primária dos `{}` de **produção** não foi medida — nenhum
código atual nem deployado explica os nascimentos de jul/ago. O mantenedor descartou
hidratação/operação manual no período (2026-08-31, histórico operacional dele) — resta como
única via de medição o `log_statement=all` em prod por um período (escrita na VM →
aprovação). Com operação manual descartada, ganha peso a hipótese de ponto de escrita não
encontrado na primeira varredura — re-verificar antes de dar o bloqueio por fechado. Data
fix do dado sujo de prod só depois de medir a origem, senão re-suja (`SQL write` →
aprovação).

### 2.3 `tagline` alimenta três cadeias, com cortes diferentes

| consumidor | onde vive | corte de `bio_long` | fallback final |
|---|---|---|---|
| `MestreHero` (dobra) | `components/mestre/MestreHero.tsx` | `tagline` ocupa o `h1`; a 1ª frase da bio (`split(/[.!?]\s+/)[0]`), truncada em 140 **só se exceder**, permanece como apoio abaixo | headline `Viva aventuras com {nome}` no `h1` |
| `buildGmDescription` (**backend**, serve o crawler) | `backend/src/utils/ogDescription.ts`, servido por `backend/src/routes/og.ts` | conforme a função | *"Conheça o perfil do mestre {nome}…"* |
| `applySeo` (**front**, SPA) | inline em `pages/MestrePage.tsx:45` (`utils/seo`) | `slice(0, 150)` — substring crua | *"Landing pública de mestre…"* |

**Rede de segurança existente:** `backend/src/utils/ogDescription.test.ts` fixa a frase de
fallback. Mexer na cadeia do backend quebra esse teste — é sinal, não obstáculo.

**Mexer numa não mexe nas outras.** Com `tagline` em 0/20 e `bio_long` em 10/20, metade dos
perfis compartilhados no baseline mostrava uma frase genérica idêntica para todos. Encher
`tagline` melhora as três de uma vez, porque encabeça todas. Na implementação local de C1,
o nome continua visível acima do `h1` quando há `tagline`; a dobra resume D2 com até dois
valores de `specialties`, até dois títulos de `selling_points` e até dois `languages`.
`badges` permanece na seção completa de C2 e não entra nessa lista fechada.

### 2.4 O que o jogador consegue buscar

A busca textual do catálogo tem **quatro** predicados:

```sql
(  t.title ILIKE %q%
   OR t.description ILIKE %q%
   OR t.system_id IN (…ids resolvidos do nome do sistema…)
   OR COALESCE(gm.nickname, p.display_name) ILIKE %q%  )
```

Do mestre entra **só o nome**. Nenhum atributo descritivo (`specialties`, `languages`,
`tagline`) é buscável, e os filtros estruturados são todos sobre `tables`.

**Consequência de escopo:** esta spec melhora a **decisão** de quem chegou ao perfil, não a
**descoberta** de quem não chegou (D6).

### 2.5 Defeitos de forma (editor, página pública e pacote)

Os dois primeiros são do editor; os alvos e os vãos atravessam editor, página pública e
`packages/ui` — o que decide o alcance de A6/A7/A8.

- **Autosave sem debounce:** a mutation dispara a cada `onChange` — uma requisição por
  tecla. O JSDoc promete 500ms que **não existem no código**.
- **Indicador de "salvo" rola para fora:** `.autosave-indicator` não tem `position: fixed`
  nem `sticky`; a aba tem 3,75 telas e quem edita a bio nunca vê confirmação.
- **Alvos < 24px** (reprova WCAG 2.2 SC 2.5.8): `Manter link direto` em `AvatarField` e
  `ImageUploader` (16px); no rodapé de `packages/ui`, `Ver termos` (≈20px) e
  `.artificio-footer-nav-link` (≈17px); e o link do nome do mestre em
  `TableCard.tsx:185-192` (≈20px, `text-sm` sem `min-height`), presente nos 4 cartões da
  página pública.
- **Larguras sem relação com a resposta:** `Anos de Experiência` (2 dígitos) com 802px.
  Alturas medidas: 16 · 38 · 42 · 48 · 50 · 300 — sem escala.
- **Sistemas só contados:** `UserSystemsSelector` mostra `2 sistema(s) que você mestra`,
  sem listar quais.
- **Vãos de seção sem regra** na página pública, no baseline: 48 · 48 · 0 · 48 · 0 · 0.
  **C3 implementada localmente:** todos os blocos após o hero ficam sob um fluxo único com
  `gap: calc(var(--space-6) * 2)` = 48px; aceite runtime ainda pendente.

---

## 3. Decisões fechadas (D1–D11)

Vinculantes. O *porquê* de cada uma, com fontes e medições, está em `old_spec.md` §3–§4.

| # | Decisão | Consequência direta |
|---|---|---|
| **D1** | Modelo de informação **não muda** | sem migration, sem coluna nova |
| **D2** | Dobra carrega `tagline` + etiquetas dos **atributos-chave: `specialties`, `selling_points`, `languages`** | headline gerada vira fallback; `featured` continua **do admin** (`adminTables.ts`; o editor fixa `featured: false`) — mesa em destaque não entra na dobra |
| **D3** | Seção de Avaliações **fica como está** | nada a fazer |
| **D4** | `Preço Médio` **sai do front** | banco e migration intactos. **Só o campo `average_price` do editor de perfil** (`ProfileEditPage.tsx:583-590`): o preço da mesa (`MestreFeaturedTable.tsx:148-155`) e o do grupo fechado (`MestreClosedGroupSection.tsx:68-73`) **continuam** — são a mitigação registrada |
| **D5** | Mantém as **3 telas** de edição | entregar prévia, não unificar |
| **D6** | Busca por atributo do mestre **fora do escopo** | por **ordem** (dado antes do filtro), **não** por D1 |
| **D7** | **Nada** de descrição composta por template | resolver pela origem: encher `tagline` |
| **D8** | Scrim do banner **fica fixo** | entrega é **prévia**, não controle de opacidade |
| **D9** | Todas as capacidades órfãs entram na fase B | inclusive `closed_group`. **Não decide** preço, comissão, regra de contrato do grupo fixo nem política comercial — é só ligar o que já existe |
| **D10** | Todo campo recomendado leva **frase do ganho** | padrão `RECOMMENDED_GAIN` do editor de mesa |
| **D11** | Extração da bio **entra**, com confirmação | formulário primeiro; máquina sugere, nunca grava |

**Trava de D11, não negociável:** a máquina sugere, o mestre confirma, **nada trava a
publicação**. É a regra do Airbnb (F1 de 75% — gravar direto erraria 1 em 4) e já é a regra
escrita no código do parser deste app: *"aviso, não validação"*.

---

## 4. Critérios de aceite

Cada um exige **medição citada** para ser dado como cumprido.

| # | Critério | Como medir |
|---|---|---|
| **A1** | Nenhum campo que a página renderiza fica sem porta de entrada | busca por campo de formulário para cada campo lido por `mestre/*`. Cumprível **porque D9 não deixou nada de fora** — se alguma entrega da fase B for adiada, A1 vira **incumprível** e a decisão de adiar tem de ser registrada, não silenciada |
| **A2** | O que o mestre insere, o sistema expõe | tabela §2.1 sem linha 🔴 |
| **A3** | A dobra contém informação escrita pelo mestre | `getBoundingClientRect` em 1366×768 e 1920×1080 |
| **A4** | Nenhum dado apresentado como fato tem duas fontes divergentes | os três números de experiência viram um (task A3) |
| **A5** | Todo dado de JSONB/API passa por normalizador tipado antes de virar prop | inspeção do caminho de `selling_points` |
| **A6** | Nenhum alvo < 24px na página pública nem no editor **e** todo campo com erro/hint tem `aria-describedby` no controle | medição de alvo + busca do atributo |
| **A7** | Cada correção no nível que impede recorrência | "ajustei os N valores do `mesas`" **reprova** |
| **A8** | Defeito fora do `mesas` foi verificado nos outros apps | medido, não suposto |
| **A9** | Cada correção com teste que falha sem ela | **verificado reintroduzindo o defeito** |
| **A10** | Medição antes/depois nos 20 perfis reais | `/api/v1/tables?limit=100` → `gm_slug` distintos → `/api/v1/gm/perfis/{slug}`. Não só no `mestre-hermes` |

---

## 5. Fora de escopo

- Acessibilidade por teclado (coerência com a 098).
- Contraste como prioridade.
- Editor de anúncio de mesa — é a 098.
- Sistema de avaliações (moderação, antifraude, cálculo) — D3.
- Busca/filtro por atributo do mestre — D6, por ordem: primeiro o dado.
- **Mobile e tema claro não são escopo cortado.** A página pública de entrada foi medida em
  §11; o editor antigo, em §11.1. A repetição no build pós-B/C continua no gate C.

---

## 6. O que continua sem medição

Não afirmar nada sobre estes pontos sem medir antes.

| o quê | estado |
|---|---|
| causa de `selling_points` voltar `{}` — **beta medida** (hidratação `admin/sync/enrich` copiando de prod); **prod não medida** (39/48 `{}`, nascendo até 08-28; hidratação/escrita manual no período descartada pelo mantenedor) | bloqueio nomeado em §2.2 |
| mobile (719px) | página pública medida em §11; editor medido parcialmente em C4 (§11.1) sem overflow horizontal, **porém em build anterior a B/C/F — beta está em `b69f4c47` desde 2026-09-01 e não foi remedido**. O mobile do F2 (rodapé) também **não foi medido**: o `resize_window` não alterou o viewport (§13.14) |
| tema claro | **medido parcialmente em C4** no editor antigo: sem overflow horizontal; tokens efetivos `#f4f6fb`/`#0b1220`. **Build novo já está em beta desde 2026-09-01; falta remedir** |
| editor de perfil em runtime | desktop **medido em 2026-09-01 no build pós-B/C/F** (§13.2: `index-Bwn4PU-7.css`, 5,2 telas, bloco de 2267px); **719×900 ainda não remedido após o deploy** — a medição parcial de C4 (§11.1) foi contra build defasado |
| comportamento com perfil cheio | **impossível hoje** — nenhum dos 20 preenchido |
| nav global com alvo de 22px | **descartado por medição runtime (2026-09-01)**: links principais 42,6px (`min-height: 40px`), subnav 37,1px (`min-height: 36px`) e ações 40px; nenhum alvo de 22px |
| custo do esquema de extração para bio | **medido em B11 (2026-09-01), conferido em revisão independente:** 4 atributos estritos (`experience_years`, `specialties`, `languages`, `badges`), endpoint autenticado sem escrita, painel local de confirmação e cache generalizado por schema. Sem migration, lib nova ou pacote compartilhado. Superfície final medida em `git status`: **4 arquivos de produção + 3 de teste**; validação e vetores verificados em `tasks.md` B11 |
| os 3 perfis com banner real | **não inspecionados** visualmente |
| soma da tabela de seções (§2.1 de `old_spec.md`) | **inconsistente**: 4856px medidos × 5341px declarados — faltam 485px. A tabela é recorte do que apareceu naquela medição, não o inventário do componente, que monta **11 blocos** |

**Ressalva de método que vale para toda medição de tela desta spec:** foi medida como
**admin** (`viewer_context: { is_owner: false, is_admin: true }`), então a seção de
**Insights** apareceu — um visitante comum **não a vê**. As outras seções da tabela são
públicas. Remedir como visitante antes de concluir qualquer coisa sobre altura de página.

---

## 7. Quando medir mobile — resolvido por medição

**Decisão: a medição de mobile entra na fase C (task C4), não antes da fase B.** A
investigação pedia "antes de qualquer implementação"; o que decide entre os dois alcances
é o que as media queries de fato fazem — e isso não tinha sido lido.

**Medido em `ProfileEditPage.css`:** existem **duas** media queries, não uma em 719px como
a investigação registrou.

| query | o que altera |
|---|---|
| `max-width: 768px` (`:586`) | `padding` da página, `flex-direction` do header, `overflow-x` das abas, `white-space` do tab, `padding` do conteúdo, `playstyle-grid` para 1 coluna |
| `max-width: 640px` (`:858`) | `flex-direction` do container de avatar, dimensão do preview (100px), largura do wrapper |

**Nenhuma das duas muda a estrutura de um campo de formulário.** São ajustes de container,
avatar e navegação por abas. Como a fase B **acrescenta campos** dentro dessa mesma coluna,
o risco que justificaria medir antes — descobrir em C que o layout mobile exige outra
arquitetura de formulário e refazer B — **não se sustenta na medição**: não há arquitetura
mobile distinta a descobrir.

**O que muda de verdade a resposta**, e por isso continua obrigatório: os campos novos da
fase B **nascem** com as duas queries em mente (largura fluida, alvo ≥ 24px, sem grade fixa
de 2+ colunas), e C4 mede o resultado. Medir antes de B produziria a fotografia de um
formulário que a fase B vai substituir.

**Ressalva que fica:** isto resolve o **editor**. A **página pública** do mestre não teve as
media queries lidas — C4 cobre as duas, e a página pública é onde a dobra (D2) muda.
Se a medição de C4 achar defeito estrutural na página pública, ele volta como task própria,
não como retrabalho de B.

---

## 8. Classificação campo→nível (D10) — derivada, não arbitrada

D10 manda frase de ganho em "todo campo recomendado", mas a investigação nunca definiu
**quais** campos são obrigatórios, recomendados ou opcionais. Sem o mapa, o gate B fica
inverificável. A classificação abaixo é **derivada das fontes que a própria investigação
levantou**, com o critério declarado em §1: *responde uma pergunta que o jogador faz antes
de sentar à mesa?*

**As três regras que a produzem:**

1. **Obrigatório = o jogador não consegue decidir sem.** Piso mínimo de identidade. O
   StartPlaying só torna obrigatório o que protege a mesa (ferramenta de segurança);
   completude nunca é obrigação.
2. **Recomendado = par certo, não completude.** É o enquadramento do StartPlaying
   (*"reflita suas especialidades reais; não anuncie um estilo que você não é, porque
   jogadores procurando outro estilo provavelmente não são um bom par"*) e o que LinkedIn
   (+100% de completude com cartão que explica o ganho) e Upwork (4,5× mais contratações
   com perfil completo) medem. **Todo recomendado carrega a frase do ganho — é o que D10
   exige.**
3. **Opcional = enriquece, não decide.** Sem frase de ganho: frase em campo que não muda a
   decisão vira ruído e gasta a atenção que os recomendados precisam.

| campo | nível | por quê |
|---|---|---|
| `nickname` | **obrigatório** | sem nome não há perfil |
| `avatar_url` | **obrigatório** | NN/g Trustworthy Design: rosto é fator de confiança; 3-4h com um desconhecido |
| `tagline` | **recomendado** | encabeça as **três** cadeias (§2.3); é o maior alcance por campo da spec |
| `bio_long` | **recomendado** | única fonte de voz própria hoje; alimenta o fallback das 3 cadeias |
| `specialties` | **recomendado** | par certo — o argumento do StartPlaying, literal |
| `languages` | **recomendado** | **filtro de busca no concorrente**; aqui está em 0/20 (§2.4) |
| `selling_points` | **recomendado** | entra na dobra por D2; 14 ícones fechados (§2.2) |
| `experience_years` | **recomendado** | só renderiza se `>= 3` — o mestre precisa saber disso |
| `links` | **recomendado** | prova social externa, e o mestre já preenche |
| `closed_group_*` | **opcional condicional** | só existe se `closed_group_enabled`; nível dos filhos segue o pai |
| `preferred_vtt_platforms` | **opcional** | logística, não decisão de par |
| `contact_methods` | **opcional** | a plataforma já oferece caminho de contato |
| `badges` | **opcional** | sem vocabulário fechado (§2.2) — sem regra, não sustenta cobrança |
| `promo_badge_text` | **opcional** | promocional; alcance menor, reconhecido em B.1..B.5 |
| `banner_url` | **opcional** | estética; o scrim é fixo (D8) |

**Nenhum campo novo vira obrigatório.** Cobrar o que hoje está em 0/20 puniria o mestre por
uma porta que **o sistema** nunca ofereceu (§1) — e NN/g é explícito: *"asking for
information before providing any value is a breach of trust"*.

**Obrigatório precisa valer nas QUATRO portas de escrita, não só nas do editor
(incidente de 2026-09-01, fase E).** `old_spec.md:174` mapeou quatro portas: `POST` e
`PUT /api/v1/gm/profile` (`gmPanel.ts`) e `PATCH /api/v1/profile/gm` + `/me/gm`
(`profile.ts` → `profileService.updateGmProfile`). A B0 alinhou `nickname` (2-40) nas
duas primeiras; a terceira criava `gm_profiles` derivando **só o slug**, e o perfil
nascia com `nickname` NULL. Medido em produção no dia do relato: **7 de 49 perfis**
(14%) sem nickname, e o mestre atingido não conseguia salvar o próprio nome nem
publicar mesa — a publicação respondia "perfil não encontrado" enquanto a criação
respondia "chave duplicada". Corrigido em E1. **Regra que fica:** classificar um campo
como obrigatório nesta tabela obriga a conferir as quatro portas; alinhar só a porta do
editor deixa a outra criando registro que o próprio contrato recusa depois.

**Forma da entrega (B6):** registro único no padrão de `editorValidation.ts:72`
(`RECOMMENDED_GAIN` como `Record`), com `data-ob` por campo e teste cruzando os dois. A
frase de cada recomendado é escrita **na linguagem do jogador**, não na do sistema — o
padrão medido em produção é *"mesas com banner aparecem em destaque"*, não *"campo
recomendado"*.

**Confirmação pedida ao mantenedor:** a tabela é derivada das fontes, não decidida por ele.
Os dois pontos onde uma escolha diferente é defensável: **`avatar_url` como obrigatório**
(alternativa: recomendado com frase forte) e **`badges` como opcional** (se ganhar
vocabulário fechado, vira recomendado). O resto segue as três regras acima.

---

## 9. Fidelidade visual do editor de perfil — medido (2026-08-30)

A fase B acrescenta campos a uma tela que hoje **não consome o pacote de UI**. Sem esta
seção, cada campo novo herda o desvio em vez do design system. O critério **não é novo**: a
098 §6.3 já decidiu que *"não se declara escala nova; adota-se a que o pacote já tem —
declarar outra seria a divergência por app que o AGENTS.md trata como dívida"*. A 099 aplica
a mesma regra ao editor de **perfil**.

### 9.1 O que foi medido

| medida | comando | resultado |
|---|---|---|
| componentes do pacote no editor | `rtk rg "@artificio/ui" ProfileEditPage.tsx` | **0 imports** — 684 linhas de TSX sem um primitivo |
| CSS próprio | `wc -l ProfileEditPage.css` | **874 linhas** |
| tokens de espaçamento | `rtk rg "var\(--space-" ProfileEditPage.css` | **0** — a régua do pacote (`--space-1..6`, base 4px, `styles.css:62-66`) não é usada |
| tokens de cor | `rtk rg "var\(--artificio-"` | 20 (16 `brand`, 2 `brand-deep`, 2 `danger*`) |
| valores de espaçamento distintos | `gap`/`padding`/`margin` | **11** — contra 6 na régua do pacote |
| fora da grade de 4px | — | `0.375rem` (6px), `0.875rem` (**14px**), `0.4rem` (6,4px) |
| paridade de tokens do pacote | `node packages/ui/scripts/check-token-parity.mjs` | **verde**, 30 papéis de cor |

O `14px` é o mesmo valor que a 098 §6.3 mediu como o único fora da grade no editor de mesa
(`gap-3.5`, 14 ocorrências). **O defeito é do repositório, não de uma tela.**

### 9.2 O que NÃO é dívida — não "corrigir"

`rtk rg -o "#[0-9a-fA-F]{3,6}|rgba?\("` devolve **51** cores literais, mas o cabeçalho do
arquivo (spec 022 T8) declara as exceções, e a leitura do contexto confirma cada uma:

- **marca, Discord (`#5865f2`), Google (`#4285f4`)** — identidade de plataforma, não muda com tema;
- **gradientes decorativos** (avatar, badges de papel) e **scrims `rgba(0,0,0,*)`**;
- os **11 `color: #ffffff`** estão **todos sobre fundo opaco escuro** (gradiente ou
  `var(--artificio-brand)`) — branco sobre marca é correto nos dois temas. **Não quebram.**

O tema vira pelas vars do pacote; o bloco `[data-theme=light]` foi removido de propósito.
Quem "consertar" isso reintroduz o bug que a 022 fechou.

### 9.3 O que a fase B tem de obedecer

1. **Campo novo usa primitivo do pacote** (`Field`, `TextInput`, `Textarea`, `Select`,
   `Badge`, `Button`, `Panel`), não `<input>` cru com classe local. Exceções medidas em
   `plan.md` §B: o pacote **não** tem checkbox nem tag input, e `Field` não emite
   `aria-describedby`.
2. **Espaçamento sai de `--space-1..6`.** Valor novo fora da grade de 4px precisa de
   justificativa inline — é o que impede o 12º valor de nascer.
3. **Altura de controle sai da escala** `artificio-control-sm/md/lg` (34/40/48). Exceção
   medida: `Textarea` ignora a escala (`plan.md` §B, armadilha 2).
4. **Cor nova sai de token.** Literal só nas três exceções de §9.2, com comentário citando
   a origem, no padrão que o arquivo já usa.
5. **Nenhuma cor de texto fixa sobre fundo que vira com o tema** — é a única forma de
   `#ffffff` virar defeito, e hoje não ocorre.

### 9.4 Guard de tokens — **corrigido nesta sessão**

`check-token-parity.mjs` existia (impede drift entre `tokens.ts`, `styles.css` e
`tailwind-preset.js`; o comentário registra que o drift *"já causou bug real — preset com
ink #10103A / brand #FC9054"*) e **não era chamado por script nem por CI**. Guarda escrita e
não ligada é pior que ausente.

**Consertado:** `packages/ui/package.json` → `"test": "node scripts/check-token-parity.mjs
&& vitest run"`. O CI já roda `turbo run test` repo-wide (`ci.yml:126`), então passa a
cobrir. Verificado reintroduzindo o defeito (A9): com `ink` alterado no preset, sai
`PARITY FAIL … preset.js=#deadbe`, exit 1; restaurado, verde nos 30 papéis.

**Fica aberto:** nenhum app consome o `./tailwind-preset` exportado. Não é dívida da 099 —
os apps consomem os tokens por `styles.css`, que está verde e agora protegido.

### 9.5 Reimplementação do que o pacote já define — o defeito mais caro

Medido depois de §9.1, e é pior que a ausência de tokens: o editor **reescreveu localmente**
conceitos que `@artificio/ui` já exporta, com outro nome. O nome diferente esconde a
duplicação, e as duas versões divergem.

| local | o pacote já tem | divergência medida |
|---|---|---|
| `@keyframes spin` (1s, borda 4px) | `@keyframes artificio-spin` (**760ms**, borda 2px) | dois spinners em ritmos diferentes na mesma suíte |
| `.btn-view-public-profile`, `.btn-connect-discord`, `.btn-disconnect-discord`, `.btn-avatar-action` | `.artificio-button*` (+ `-primary/-secondary/-ghost/-danger`, `-sm/-md/-lg`) | padding, gap e altura próprios |
| `.spinner`, `.spinner-small` | `.artificio-button-spinner` | 48px/borda 4px × 14px/borda 2px |

**Total medido: 5 classes + 1 `@keyframes`.**

**Correção de uma afirmação anterior desta seção:** eu havia contado **20** classes e
listado `.field-description` e as 15 `.avatar-*` como duplicação. Estava errado, e a
medição refeita mostra por quê: `.artificio-field-description` **não existe** (o pacote tem
`field-hint` e `field-error`), e o pacote só oferece `avatar`, `avatar-fallback` e
`avatar-link` — `.avatar-premium-container` e afins são **composição local legítima**. O
número real é 5. Acusar por prefixo obrigaria a renomear classe para escapar do scanner.

**Consequência para a fase B:** cada campo novo escrito nesse arquivo herda o vocabulário
paralelo. É o que o AGENTS.md nomeia — *"compartilhado por padrão; exceção por app é o
defeito"*, e *"buscar o que já existe antes de escrever"*.

**Regra para B e F5:** antes de escrever regra de estilo, rodar a skill (§9.6). Se o
conceito existe no pacote, usa-se o do pacote. Se o primitivo não cobre o caso, o
comentário inline diz **qual** limitação — senão o próximo agente reescreve de novo.

### 9.6 Skill de auditoria — `ui-fidelity-audit`

As sete medições desta seção são mecânicas e se repetem a cada tela. Viraram skill:

```bash
node .agents/skills/ui-fidelity-audit/audit.mjs <tsx> <css>
```

Roda as 7, marca falha por linha, exit 1 se reprovar. **Discrimina** (verificado):
`MasterPart.tsx` do editor de mesa → tudo verde; `ProfileEditPage` → 3 falhas, idênticas às
medidas à mão em §9.1. Não acusa cor literal automaticamente — §9.2 exige ler o contexto, e
o script só informa a contagem.

### 9.7 Fase F — merged e deployada em beta (2026-09-01)

O baseline dirigido do editor reprovava 6 linhas: 0 imports do pacote, 0 usos da régua,
5 ocorrências fora dela, 3 fora da grade de 4px, 5 classes que reimplementavam conceitos
do pacote e `@keyframes spin`. Após F5, o mesmo comando ficou verde: 1 import,
43 usos de `--space-*`, 0 fora da régua, 0 fora da grade, 0 classe duplicada e 0 keyframe
duplicado. O bloco `[data-theme=light]` não voltou; a exceção de cor Google permanece
comentada sobre um `Button` compartilhado.

O baseline repo-wide foi regravado após a queda: `mesas.foraRegua` 232→219,
`mesas.dup` 9→3 e `mesas.kfDup` 9→8. `rtk pnpm run ui:fidelity:gate` voltou
`GATE OK — nenhuma divergencia nova` nos 485 arquivos varridos.

F1 criou `Checkbox` em `@artificio/ui`, com alvo nativo 24×24px, e migrou as duas
instâncias de `Manter link direto`. F1b dá `min-height: 24px` ao link do mestre no card e
a `.link-item-url`. F2 eleva as duas famílias do rodapé para 24px no pacote; busca
estrutural confirmou o mesmo `Footer` em `mesas`, `downloads` e `glossario`, e os três
frontends passaram no typecheck dirigido. F4 aplica
40px aos controles do formulário e limita `Anos de Experiência` a 8rem; `Textarea`
continua a exceção já documentada.

**A9:** tamanhos do checkbox/rodapé reduzidos novamente fizeram o teste do pacote falhar
2/2; retirar os alvos locais, devolver experiência a 100% e reintroduzir `@keyframes spin`
fez o contrato do frontend falhar 3/4. Restaurados, os conjuntos ficaram 11/11 e 81/81.
O aceite runtime do build novo continua pendente; implementação local não fecha o gate D.

---

## 10. O defeito de fundo — medido no repo inteiro

A 099 achou o sintoma no editor de perfil. A varredura (`pnpm ui:fidelity`, 468 arquivos de
fonte) mostra que **o defeito não é desta tela nem deste app**:

| app | fora-régua | tailwind | reimplementação |
|---|---|---|---|
| mesas | 77 | 207 | 9 |
| glossario | 26 | 98 | 0 |
| downloads | 75 | 50 | 0 |
| site | 115 | 0 | 0 |
| links | 56 | 1 | 2 |
| site-admin | 49 | 0 | 5 |
| accounts | 48 | 0 | 0 |
| catalog-ui (**pacote**) | 0 | 20 | 0 |

**A causa não é descuido — é que o pacote compartilhado não tinha autoridade.** Ele existe,
mas nada obrigava a usá-lo: cada spec que toca frontend reescreve o que já existe, com outro
nome, e o agente seguinte não descobre porque o nome é diferente. Duas provas medidas nesta
sessão, ambas de guardas **escritas e nunca ligadas**:

- `check-token-parity.mjs` — protegia contra um drift que **já causou bug real**
  (registrado no próprio script) e não era chamado por script nem CI;
- `tailwind-preset` — exportado pelo pacote, consumido por **zero** apps.

**O que passou a existir (fora do escopo da 099, mas ligado nesta sessão):**

1. **Medição [8]** — espaçamento em classe utilitária Tailwind, o furo por onde o mesmo
   `gap-3.5` (14px) escapou na 098 **e** na 099. 376 usos fora da régua, invisíveis até
   agora.
2. **Gate de não-regressão no CI** (`pnpm ui:fidelity:gate`) — falha só se a divergência
   **aumentar** contra `baseline.json`. Exigir zero com 555 achados seria gate morto, e
   gate morto é o defeito original. Verificado reintroduzindo o defeito: verde → reprova
   (+1 em `links.foraRegua`) → verde ao restaurar.

**Consequência para esta spec:** a fase B não consegue mais acrescentar divergência sem o CI
reprovar. F5 executou a limpeza local do editor de perfil; o baseline repo-wide continua
sendo reduzido somente pelas specs donas de cada tela.

---

## 11. Medição em viewport — página pública de entrada

Rodado em `mesasbeta.artificiorpg.com/mestre/farenravirar` via Playwright MCP (sem sessão,
página pública), 2026-08-31. Isto é o que a análise estática **não alcança**: leitor de
DOM+CSS não resolve — medido nesta base, `jsdom` devolve `getBoundingClientRect` **0×0** e
`scrollWidth` **0**, porque não tem motor de layout.

| medição | 1366×768 | 719×900 |
|---|---|---|
| altura da página | 7440px = **9,69 telas** | **12,15 telas** |
| alvos < 24px | **17** | **17** |
| texto estourando/cortado | 0 | 0 |
| overflow horizontal | não | **não** |
| contraste abaixo do piso WCAG | **8** | — |

**Isto fechou a pendência de mobile da página pública de entrada (§7), mas não fecha C4:**
em 719px **não há overflow horizontal nem texto estourando** nesse build. A fase C altera a
dobra e o fluxo de seções; por isso o mesmo ensaio precisa ser repetido no build pós-B/C.

**Achados novos, que nenhuma medição estática pegaria:**

1. **`Ver termos` tem 18px de altura real** (§2.5 registrava ≈20px por estimativa) e
   `.artificio-footer-nav-link` tem **22px** — os dois abaixo do piso de 24px, no
   **pacote**, atingindo todos os apps. Confirma F2 com número medido.
2. **8 elementos abaixo do contraste WCAG AA**, sendo o pior a etiqueta `💰 Paga`
   (`bg-yellow-500`) com **1,48:1** contra piso de 4,5. `Entrar em contato` (o CTA
   principal) está em **3,16:1**. Contraste era "fora de escopo por prioridade" (§5) —
   continua fora, mas agora está **medido**, não suposto.
3. **O link do nome do mestre aparece 8 vezes** com 20px (task F1b, medida antes só no
   código). Em mobile, os mesmos 17 alvos.
4. **A página tem 9,69 telas** em 1366×768, contra as 5,55 registradas na investigação —
   que foi medida em 1815×962 **como admin**. Coerente com a ressalva de método de §6.

**Fora de escopo desta spec, registrado:** 2 erros de console na carga da página pública.
Não investigados.

---

## 11.1 O editor de perfil, medido em runtime (sessão real, autorizada)

`mesasbeta.artificiorpg.com/perfil?tab=mestre`, Chrome com a sessão do mantenedor
(autorização nominal 2026-08-31), viewport **1815×962**. Só leitura de DOM — nenhum campo
alterado, nenhum formulário enviado.

**Esta é a tela que a fase B vai alterar.** Cada número abaixo confirma ou corrige o que
§2.5 registrava por leitura de CSS.

| medição | valor |
|---|---|
| altura da página | 3413px = **3,55 telas** |
| coluna do formulário | **852px** |
| campos de entrada | 9 |
| campos **sem `aria-describedby`** | **9 de 9** |
| alvos < 24px | **13** |
| texto estourando / overflow horizontal | **0 / não** |
| `.autosave-indicator` | **ausente do DOM** |

**Alturas de controle: 12 distintas, 9 fora da escala do pacote** (34/40/48):
`16 · 28 · 34 · 36 · 38 · 40 · 42 · 44 · 48 · 49 · 50 · 300`. Confirma que a task F4 é
adoção da escala existente, não criação.

**Correções ao que a spec afirmava:**

1. **`Anos de Experiência` com 802px de largura para 2 dígitos** — confirmado exatamente
   (§2.5 estava certa). `Preço Médio` idem, 802px, e sai por D4.
2. **`Manter link direto`: 16×16px reais**, duas instâncias — confirma F1 com medição.
3. **`.autosave-indicator` não existe no DOM.** §2.5 dizia que ele "rola para fora" por não
   ter `position: fixed`. **É mais grave:** o elemento não está montado nesta aba, então
   quem edita **não tem indicador nenhum**. B8 muda de "prender o indicador" para
   "garantir que ele exista e fique visível".
4. **3 links de rede (`.link-item-url`) com 18px de altura** e 660px de largura — alvos
   abaixo do piso que nenhuma passagem anterior tinha listado.
5. **`aria-describedby` ausente em 9/9 campos** — a armadilha 1 do pacote (`Field` não
   emite o atributo) medida no produto, não só no código. É o critério A6 e a task B7.

**`/painel-mestre` (a 2ª das 3 telas de D5):** 1 tela de altura, **sem** estouro de texto e
**sem** overflow; alturas de controle `40` e `44` — só o `44` fora da escala. É a tela mais
saudável das três.

**Medição parcial de C4 (2026-09-01, Chrome autorizado):** o editor autenticado foi medido
em **719×900**, nos temas escuro e claro, sem alterar campo nem enviar formulário.

| medição | valor |
|---|---|
| overflow horizontal | **não**, nos dois temas (`scrollWidth = clientWidth = 704px`) |
| tema claro | fundo `#f4f6fb`; texto `#0b1220` |
| altura da página | 3465px = **3,85 telas** |
| alvos abaixo de 44px | **13** |
| textos com overflow próprio | **2**, ambos em metadados de links |

Esta medição **não fecha C4**: o build acessível em beta ainda exibe `Preço Médio` e não
contém `tagline`, `specialties`, `languages`, `badges` nem sugestões da bio. A rota pública
no mesmo beta, medida em 1366×768, retornou 0 `.mestre-section-flow` e 0
`.hero-attributes`. Portanto a responsividade e o tema da implementação pós-B/C, A3 e A10
continuam pendentes até o build novo estar acessível.

---

## 12. Task A3 resolvida — o que fazer com "anos de experiência"

A trava de A3 dizia que `experience_years` (autodeclarado) e `years_on_platform`
(calculado) não podem ser fundidos, e que a divergência é editor × bio × API. **Medido nos
perfis reais do beta (2026-08-31), o problema é maior do que a spec descrevia.**

### 12.1 O que a medição mostrou

`/api/v1/tables?limit=100` → `gm_slug` distintos → `/api/v1/gm/perfis/{slug}`:

| mestre | `experience_years` | `years_on_platform` | nº de anos citado na bio |
|---|---|---|---|
| farenravirar | 14 | 0 | **11** |
| mestre-pollux | 10 | 0 | **12** |
| albuquerque | **null** | 0 | **15** |
| mestre-almarai | 8 | 0 | — |
| nocturne · tami · tamii | null | 0 | — |

**Três correções ao que a spec afirmava:**

1. **Não é um caso isolado do Faren.** Três dos sete mestres com mesa ativa citam um número
   de anos na bio; **dois** contradizem a coluna, e um (`albuquerque`) declara "15 anos" na
   bio com a coluna **vazia** — a informação existe só em texto livre.
2. **`years_on_platform` é `0` para todos os sete.** O cálculo (`AGE(NOW(), gm.created_at)`)
   está correto — a plataforma é nova. Ele não é alternativa ao autodeclarado hoje: não
   carrega informação nenhuma.
3. **O dado autodeclarado é exibido com o selo de verificado.** `MestreHero.tsx:158-162`
   renderiza `{experience_years}+ anos de experiência` dentro de `.trust-item`, com o ícone
   `CheckCircle2` — **o mesmo componente e o mesmo ícone** de "Verificado no Covil"
   (`:147-151`). O jogador não tem como distinguir o que a plataforma verificou do que o
   mestre digitou.

### 12.2 A decisão, e o princípio que a sustenta

**A pesquisa desaconselha o que a task pedia.** "Os três números viram um" é escolher uma
fonte como verdade e descartar as outras. A literatura de modelagem é explícita no
contrário: *"em vez de escolher às pressas uma fonte como verdade, modele a discordância,
preserve de onde os valores vieram, e só então decida o que é canônico"* — escolher rápido
**destrói informação útil**
([DB Designer](https://www.dbdesigner.net/designing-databases-when-data-sources-disagree)).
O princípio de fundo é o mesmo do SSOT: cada elemento é *mastered* em um lugar só, e cópia
de dado mestre exige mecanismo de reconciliação
([SSOT](https://en.wikipedia.org/wiki/Single_source_of_truth)).

Aplicado aqui, "um lugar só" **não** significa uma coluna só. Significa que cada número tem
**um dono**, e que a UI diz qual é:

| dado | dono | tratamento |
|---|---|---|
| `experience_years` | o **mestre** (autodeclarado) | continua sendo a fonte de "anos de experiência". **Perde o selo de verificado** |
| `years_on_platform` | a **plataforma** (derivado) | permanece separado, com rótulo próprio. Hoje vale 0 para todos — **medido (2026-08-31): o hero já não exibe quando 0** (condição `>= 1` em `MestreHero.tsx:166` e no `hasAnyTrust`); nada a implementar |
| o número dentro da bio | o **mestre**, em texto livre | não é fonte de dado. Ver 12.3 |

**A correção de A3 não é escolher entre 14 e 11 — é parar de apresentar o autodeclarado
como verificado.** O defeito que o jogador sofre não é a divergência (ele nunca vê as duas
fontes juntas); é o selo `CheckCircle2` afirmando que a plataforma confere um número que
ninguém conferiu. Isso é a mesma classe do que NN/g chama de quebra de confiança, e é o
critério que §1 desta spec já declara: o jogador vai passar horas com um desconhecido.

**Entrega de A3:**

1. Separar visualmente **verificado** (`covil_verified`) de **declarado pelo mestre**
   (`experience_years`) — ícone e/ou rótulo distintos. Não fundir, não remover o campo.
   Forma adotada na implementação: `covil_verified` mantém `CheckCircle2` + "Verificado no
   Covil"; `experience_years` usa ícone neutro (`Medal`) e rótulo **"Declara {n}+ anos de
   experiência"** — decisão de execução a conferir pelo mantenedor.
2. **Não exibir `years_on_platform` enquanto for 0** — **já satisfeito no código** (medido:
   condição `>= 1`; runtime confirma que 0 não renderiza). Nada a fazer.
3. A coluna `experience_years` continua sendo a fonte; **nenhuma migration** (D1).

### 12.3 O número dentro da bio — o que se faz com ele

`albuquerque` prova que a bio carrega informação que a coluna não tem. **Apagar ou
reescrever a bio de um mestre é intervir no texto dele — não se faz.**

O destino é o **D11**, que já está decidido nesta spec: a extração assistida lê a bio,
**sugere** o valor e o mestre confirma. `albuquerque` é o caso de uso exato — "15 anos" na
bio, coluna vazia, e o mestre nunca teve formulário para preencher (§1).

**A3 fecha sem tocar na bio.** O que A3 deve registrar é a medição da tabela 12.1, para que
B11 saiba que o caso existe em pelo menos 3 de 7 perfis.

**Trava:** enquanto B11 não existir, o número da bio **fica como está**. Divergência entre
prosa e coluna não é bug de dado — é o mestre falando, e a plataforma não corrige a fala
dele.

---

## 13. A casca do editor de mestre — o que falta para a spec fazer jus a si mesma

**Origem:** o mantenedor abriu `mesasbeta` depois do deploy da Fase F (2026-09-01) e
recusou o resultado: *"está totalmente diferente da ideia que era reformular a
experiência do mestre. Está feio, desorganizado. Bem diferente do conteúdo que
embasou a spec"* — e, ao ver a tela, nomeou a causa: *"ainda está centralizado, sem
etapas como nas laterais, que tem no atual editor de mesas"*.

Ele tem razão, e a spec já dizia isso. Esta seção existe porque o defeito **não** é
novo: é §2.12 desta spec não implementada, medida contra o que está no ar.

### 13.1 O que a spec mandava, e não foi feito

`old_spec.md:495-503`, que já estava escrito antes de qualquer fase começar:

> "**o editor de mesa já resolveu o problema de interface que esta spec descreve.** Ele
> tem `EditorField` sobre o `Field` do pacote, com três níveis marcados (obrigatório /
> recomendado / opcional), frase de ganho por campo recomendado na linguagem do
> jogador, prévia ao vivo (`CardPreview`) e **partes semânticas em vez de uma coluna
> longa**. O editor de perfil não usa nada disso — nem os primitivos do pacote."
>
> "A fase B, em boa medida, **não é invenção: é aplicar ao perfil o que o editor de mesa
> já faz a uma tela de distância.**"

E `old_spec.md:734-749` fixava o critério de forma:

> "Coleta progressiva, não formulário de 3,75 telas. […] 15 campos em 3 passos superam
> 10 campos numa página só em **11-14%** de conclusão (098 §6.7). **O editor de perfil
> hoje é o caso ruim: uma coluna de 3,75 telas.**"

### 13.2 O que está no ar, medido (beta, 2026-09-01, build `index-Bwn4PU-7.css`)

Medido em navegador autorizado, `/perfil?tab=mestre`, viewport 1815x962:

| | editor de mesa (o modelo que a spec mandou copiar) | editor de perfil (entregue) |
|---|---|---|
| layout | `grid-template-columns: 300px minmax(0,1fr)` (`TableEditor.css:70`) | coluna centralizada, sem aside |
| estrutura | **7 partes** (`editorParts.ts:27-33`: Identidade, Quando joga, Onde joga, Valores, Para quem é, Mestre e contato, Regras e extras) | **1 `<h2>`** "Perfil de Mestre" + 19 rótulos corridos |
| prévia | `CardPreview` no aside, espelho vivo (`TableEditor.tsx:277`) | "Prévia do perfil" empilhada no meio da coluna |
| pendências | `pendingCounts` por parte na nav (`TableEditor.tsx:273`) | nenhuma |
| níveis de campo | `EditorField` com `data-ob=required/recommended/optional` + `RECOMMENDED_GAIN` | **existe, replicado**: `GmProfileFields.tsx` marca `data-ob` e usa um `RECOMMENDED_GAIN` **próprio** (`profileEditorDomain.ts:31`), não o do pacote de validação |
| rolagem | parte troca sem rolar | **5,2 telas** (`scrollHeight` 4998 / viewport 962) |
| primitivo de controle | `artificio-control` em `IdentityPart.tsx` | **0 dos 5** `<input>` crus da aba Mestre (§13.13 C8) |

**A spec chamou 3,75 telas de "o caso ruim". A entrega tem 5,2.** O eixo que a spec
nomeou como defeito central de forma piorou, porque os 7 campos que a fase B abriu
(`tagline`, `specialties`, `languages`, `selling_points`, `badges`, `promo_badge_text`,
`closed_group`) foram **empilhados na mesma coluna** em vez de entrarem em partes.

O modelo de informação foi entregue — os sete campos sem porta ganharam porta, e isso é
o núcleo da spec. **A experiência que justificava esses campos, não.**

### 13.3 Por que a revisão fase a fase não pegou isto

Registro honesto, porque é falha de método e vai se repetir se não ficar escrito: cada
fase foi validada contra o próprio critério estreito (F1b: alvo de 24px; F2: rodapé;
F4: largura do campo), **e nenhuma rodada mediu a página inteira contra §2.12 e §3.4**.
Todas passaram; o conjunto reprova. A própria spec avisa disso em `old_spec.md:58-60`
— *"Isto não é um problema de layout. A 098 tratava de forma. Aqui o defeito é de
modelo de informação"* — e a revisão gastou as rodadas na camada que a spec descarta.

**Consequência operacional:** o aceite de fase que toca o editor passa a exigir, junto,
a medição de casca (13.6, A11-A13). Contrato de fonte e alvo de clique não substituem.

### 13.4 O que as fontes dizem — pesquisa de 2026-09-01

O recorte importa: **não é landing page genérica.** É a página de uma pessoa que vai
conduzir 3-4 horas semanais da vida de estranhos. O que se desenha é **confiança
verificável**, e a referência certa não é listicle de design — é caso de engenharia
publicado por quem resolveu o mesmo problema em escala.

**a. Airbnb, o caso mais próximo: a plataforma inteira existe para estranhos confiarem
um no outro.** É o mesmo problema desta spec, com o mesmo formato — um perfil de pessoa
que hospeda outra. Em [Designing for Trust](https://medium.com/airbnb-design/designing-for-trust-7ce268468d5b)
(Airbnb Design) e no [estudo de caso do TED de Joe Gebbia](https://bambrick.com.au/blog/airbnb-designing-trust-case-study/),
três achados aplicam direto:

- **Reputação vence semelhança.** Gebbia: *"High reputation beats high similarity. The
  right design can actually help us overcome one of our most deeply rooted biases."* O
  desenho que expõe reputação verificável derruba o viés de escolher quem se parece com
  a gente. Para o `mesas`: a seção de prova (avaliações, selos) não é enfeite — é o que
  permite um mestre desconhecido competir com o amigo do amigo.
- **A foto foi obrigatória, apesar do atrito.** O Airbnb impôs foto de perfil aceitando
  perder gente no funil, porque ver o rosto *"deixa o usuário à vontade"*. Casa com a
  recomendação do StartPlaying (fonte c) e com D8 desta spec.
- **Esforço no perfil é sinal lido pelo outro lado.** A seção "About Me" preenchida
  aumenta a chance de o anfitrião aceitar o hóspede: **preencher é o sinal**, não só o
  conteúdo. Isso reordena o desenho — a casca deve tornar visível *o que ainda falta*
  (A12), porque a completude em si comunica.

**Ressalva medida:** a versão desse caso que circula em resumos atribui ao Airbnb a
prática de *"sugerir o tamanho ideal da resposta pelo tamanho da caixa de entrada"* — o
que seria a contraparte exata do defeito de §2.6 (802px para 2 dígitos). **Fui à fonte e
ela não sustenta o detalhe**: o estudo de caso trata do porquê psicológico, sem dado
sobre dimensionamento de campo. Registro como **não verificado** e não uso como
fundamento; o argumento de dimensionamento continua vindo de Baymard, via 098 §6.2, que
é medição controlada.

**b. Airbnb DLS: componente como organismo, e o defeito de reimplementar o que existe.**
[Building a Visual Language](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e)
(Karri Saarinen, Airbnb Design) — a peça que fundou o DLS em 2016. A tese, na fonte
primária ([karrisaarinen.com/dls](https://karrisaarinen.com/dls/)): em vez de design
atômico, tratar componentes como organismos que *"têm função e personalidade, são
definidos por um conjunto de propriedades, coexistem com outros e podem evoluir (ou
morrer) independentemente"*, com o sistema *"unificado para gerar eficiência por meio de
componentes bem definidos, reutilizáveis e multiplataforma"*.

Os quatro princípios do DLS — **Unificado, Universal, Icônico, Conversacional** — são o
vocabulário que falta a esta spec para justificar 13.5 sem apelar a gosto. "Unificado"
(cada peça contribui para o todo) é literalmente a regra pétrea §Compartilhado por
padrão do AGENTS.md, escrita por outra casa e pelo mesmo motivo. E "Conversacional"
sustenta o vocabulário de partes que o `TableEditor` já usa ("Quando joga", "Para quem
é") contra rótulo genérico de CRUD.

**Consequência direta:** §9.5 desta spec mediu 5 classes + 1 `@keyframes` reimplementados
localmente sobre o que o pacote já exportava, e a F6 mediu 3 `.spinner` concorrentes no
mesmo bundle. É exatamente a fragmentação que o DLS existe para impedir. A casca do
editor cair na mesma armadilha — copiar o aside do `TableEditor` em vez de compartilhar —
seria repetir o defeito mais caro já medido nesta spec (A16).

**c. O concorrente direto organiza por seção nomeada, não por coluna.**
[StartPlaying](https://startplaying.games/blog/posts/how-to-set-up-gm-profile) — a maior
plataforma de mestres pagos — divide o perfil em **8 seções**: Imagens, Detalhes
Pessoais (nome, pronomes, localização, idiomas), Sobre Você, **Estilo de Mestrar**,
**Sua Mesa Ideal**, Preferências (sistemas, plataformas, temas), Social e Reserva.
"Estilo de Mestrar" e "Mesa Ideal" são seções próprias, não parágrafos dentro de uma
bio — a mesma tese de §2.4 (o mestre inventa estrutura dentro da caixa de texto porque
não recebeu estrutura).

A orientação editorial contraria "quanto mais, melhor": bio *"dois parágrafos no
máximo"*; sobre especialidades, *"não se sinta pressionado a listar um monte de coisas
que você mais ou menos conhece só para parecer impressionante"*; sobre foto, *"eles
preferem perfis com rostos — dá a sensação de quem eles vão jogar junto"*. Valida D10
(frase de ganho por campo) e reprova qualquer desenho que premie preenchimento total.

**d. Progresso como checklist com estado, não barra de percentual.**
O [onboarding do StartPlaying](https://intercom.help/startplaying/en/articles/8719131-gm-onboarding-progress-bar)
usa 6 passos com três estados por item — **Draft / Awaiting Approval / Active** — e a
documentação é explícita: *"em vez de mostrar um medidor de percentual, funciona como
checklist"*. Casa com o `pendingCounts` que o `TableEditor` já implementa: o mestre vê
**o que falta**, não um número abstrato.

**e. Multi-passo bate página única — mas o número NÃO vale para este caso.**
[Progressive disclosure](https://www.nngroup.com/videos/progressive-disclosure/) é padrão
NN/g desde 1995, e as compilações de 2026
([UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/),
[Buildform](https://buildform.ai/blog/form-design-best-practices/)) medem **+14% de
conclusão** em formulário multi-passo contra passo único.

**Correção de uma afirmação que esta seção fazia até 2026-09-01, e que era minha:** usei
esse número como fundamento do desenho. Ele **mede outro problema**. Todo o corpo de
evidência de +14% (e o +86% que outras compilações citam) trata de **formulário de
conversão, preenchido por quem chega novo e pode abandonar**. O editor de perfil é
**edição de dado existente, por quem já é usuário e já está dentro** — não há abandono de
funil a otimizar.

E a literatura do caso certo aponta parcialmente para o outro lado:
[uxmovement](https://uxmovement.com/forms/single-page-vs-multi-page-forms-when-to-use-which/)
recomenda **página única** justamente quando *"editar é importante"* — o usuário volta e
revisa — e quando *"o input de um campo depende do anterior"*, que é o mestre relendo a
própria bio ao escrever o slogan. Uma
[avaliação de tipos de rolagem](https://firstmonday.org/ojs/index.php/fm/article/download/10309/9400?inline=1)
conclui que **nenhum método se destacou como mais usável**.

**O que sustenta seções, medido:** o estudo mais próximo
([Springer, navegação em formulários longos](https://link.springer.com/chapter/10.1007/978-3-319-22698-9_21))
mediu memorabilidade, usabilidade, visão geral e preferência **piores com rolagem** que
com abas, menus e blocos colapsáveis — **em smartphone** —, e registra que **até 10 campos
a estrutura em abas não melhora significativamente**. A aba Mestre tem **15 campos** —
contagem **runtime** (`document.querySelectorAll('input,select,textarea')` no build de
beta), que a inspeção estática não reproduz porque subcampos de
`ProfileTagsSection`/`ClosedGroupSection` dependem do estado. Acima do limiar de 10, sem
folga.

**Conclusão honesta:** o que justifica a mudança é a **densidade medida nesta tela** (5,2
telas; um bloco de 2267px com 13 dos 15 campos) e a evidência de **mobile** — não ganho de
conversão de formulário novo. O número de +14% sai do argumento.

**Consequência de desenho, e ela é grande:** se a força da página única é *voltar e
editar*, a casca não pode destruí-la. Partes que **trocam a view** escondem o resto do
perfil; **âncoras que rolam** dentro de um documento contínuo dão a lateral, as pendências
e a visão geral **sem** tirar do mestre a revisão livre. É o desenho adotado em §13.5.

**f. Editor moderno é três painéis, e a largura tem faixa conhecida.**
O padrão de 2026 para editor ([Elementor FSE](https://elementor.com/blog/wordpress-full/),
[shadcn/ui settings](https://adminlte.io/blog/shadcn-ui-settings-templates/)) é
navegação à esquerda + canvas central + prévia/ajustes, com a lateral **entre 200 e
300px** ([alfdesigngroup](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps)).
Os 300px que o `TableEditor` já usa estão no topo dessa faixa — não é chute, e não
precisa mudar.

**g. Escuro em camadas, não preto chapado.**
Para tema escuro ([NateBal](https://natebal.com/best-practices-for-dark-mode/),
[tech-rz](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/)): tons
sobrepostos para hierarquia em vez de preto puro; botão com fundo elevado e borda sutil
em vez de sombra; item ativo da lateral **inequívoco** — fundo na cor de marca ou borda
lateral. O Artifício já tem o vocabulário (`--surface`, `--surface-subtle`,
`--surface-strong`, `--line`, `--line-strong`, `--artificio-brand: #ff5722`), e o
`TableEditor` já aplica (`bg-[var(--surface-subtle)]` + `border-r border-[var(--line)]`).
**Nada aqui pede paleta nova** — pede usar a que existe, que é o princípio "Unificado"
do item b.

**h. O contexto que reordena tudo — e que quase inverteu esta seção.**
[StartPlaying documenta](https://intercom.help/startplaying/en/articles/8719207-what-is-startplaying)
que **99% das reservas vêm da busca, não da página de perfil**. Fui atrás disso
esperando que enfraquecesse o caso do editor; ele o fortalece por outro caminho: se a
descoberta acontece na busca, o valor do que o mestre preenche está em **virar atributo
filtrável** (`specialties`, `languages`, sistemas), não em decorar uma página que poucos
abrem. É o que §3.1 já argumentava, e a razão de D6 (busca por atributo) estar
registrada como próxima spec. **Consequência de desenho:** a casca deve tornar óbvio
*quais campos alimentam a busca* — o ganho declarado a cada campo é funcional, não
motivacional.

### 13.5 O desenho proposto — reusar a casca, não inventar uma

A regra pétrea de AGENTS.md (§Compartilhado por padrão) e `old_spec.md:503` apontam para
a mesma saída: **o `TableEditor` já é a resposta.** O que falta é extrair a casca e
aplicá-la ao perfil.

**Estrutura, em partes com vocabulário conversacional** — no padrão que `editorParts.ts`
já estabeleceu ("Quando joga", "Para quem é"), nunca rótulo genérico de CRUD:

| parte | o que entra | pergunta do jogador (§2.13) |
|---|---|---|
| **Quem é você** | avatar **e banner juntos**, nome, `tagline`, `experience_years` | "quem vai conduzir minha mesa?" |
| **Como você mestra** | `bio_long`, `specialties`, `selling_points` | "o estilo dele combina comigo?" |
| **Sua mesa** | `languages`, sistemas, `closed_group` | "eu caberia nessa mesa?" |
| **Prova** | `badges`, avaliações, `promo_badge_text` | "por que eu confiaria?" |
| **Onde te achar** | links e conteúdo | "consigo ver ele mestrando?" |

Cinco partes, não sete: o perfil tem menos matéria que o anúncio. O agrupamento é por
**pergunta do jogador**, que é o critério que governa a spec inteira (§0).

**Lateral (aside 300px), reusando o que existe:**
- nav das partes com pendências por parte (`pendingCounts`, já implementado);
- item ativo com fundo de marca ou borda lateral, visível na renderização (fonte f);
- **porta para o link oficial, não espelho**: a lateral mostra o endereço público real e
  **abre a página em aba nova**, salvando o pendente antes. Desenho completo e motivo em
  **§13.11**, que prevalece sobre qualquer descrição anterior. Três tentativas ficam
  registradas como descartadas, na ordem em que erraram: "prévia do cartão da busca" (o
  cartão não existe — é D6), "reposicionar a `MestreProfilePreview`" (reimplementa a página
  pública, §9.5) e "espelho da página real dentro da lateral" (miniatura de 300px não é
  conferência, e o endereço fica de fora);
- em viewport estreito, vira **faixa horizontal no topo** (não drawer), no breakpoint que
  `TableEditor.css:86-97` já define.

**Campo, com os três níveis:** `EditorField` sobre o `Field` do pacote, com
`RECOMMENDED_GAIN` na linguagem do jogador (D10 já decidiu). A frase diz o ganho
**funcional** quando o campo alimenta a busca (fonte g).

**Forma, obedecendo §9.3:** `artificio-control-md` nos campos — o que resolve junto o
achado de 13.7 —, espaçamento de `--space-1..6`, cor de token.

**As duas imagens ficam juntas, com a dimensão declarada** (achado do mantenedor,
2026-09-01). Avatar e banner são a mesma decisão visual — o mestre escolhe os dois olhando
um para o outro, e o banner é o fundo sobre o qual o nome dele assenta. Separá-los em
partes distintas (o desenho anterior punha o banner em "Onde te achar") obriga a ir e
voltar para julgar o conjunto.

Cada campo de imagem carrega a legenda do `imageKindHint` de `packages/media`, como o
editor de mesa já faz — **não** texto inventado nesta tela. Os valores vêm de
`imageKinds.ts:103-132`:

| campo | recomendado | mínimo | proporção |
|---|---|---|---|
| `profile_avatar` | 280 × 280 px | 140 × 140 px | **1:1, pétreo** (decisão do mantenedor, 2026-08-18) |
| `profile_banner` | 1200 × 650 px | 600 × 325 px | 1200/650, igual ao `og:image` |

A miniatura do banner no editor respeita a proporção real: desenhar fora dela ensinaria o
enquadramento errado.

### 13.6 Critérios de aceite desta seção

Somam-se a A1-A10 (§4). Todos medidos em navegador contra build real, nunca por
contrato de fonte:

- **A11.** O editor tem partes semânticas navegáveis pela lateral, e **nenhuma parte exige
  mais de uma tela de rolagem** em 1366×768 — medido por `scrollHeight` da seção contra
  `innerHeight`. (Hoje a aba inteira tem 5,2 telas, com um bloco de 2267px.)

  **Duas partes são candidatas a estourar, e o plano nomeia a saída** (achado V6 da 3ª
  revisão): **"Como você mestra"** carrega o `MarkdownEditor` de altura 300
  (`GmProfileFields.tsx:579`) mais o campo de especialidades e os 14 ícones de
  `selling_points`; **"Quem é você"** carrega avatar e banner juntos (§13.5) mais três
  campos. Se qualquer uma estourar na medição, a ordem de saída é, nesta sequência:

  1. **Reduzir a altura do editor de bio** — 300px é escolha local, não contrato; a bio
     recomendada tem "dois parágrafos no máximo" (§13.4c).
  2. **Colapsar o secundário por padrão** — os 14 ícones de `selling_points` abrem sob
     demanda, no lugar de ocupar a tela sempre.
  3. **Só então dividir a parte em duas**, aceitando 6 em vez de 5.

  **Nunca:** relaxar A11 para "quase uma tela". O limite é o critério; se ele não couber, o
  agrupamento é que está errado.
- **A12.** A lateral mostra, por parte, quantos campos recomendados faltam — e o número
  cai ao preencher, na mesma sessão, sem recarregar.
- **A13.** A lateral mostra o **endereço público real** e abre a página em **aba nova**,
  garantindo o salvamento do que estiver pendente antes de abrir. Medida: com alteração
  não salva, clicar em abrir grava e a aba nova já traz o valor novo. **Prévia que tente
  espelhar a página dentro do editor reprova** (§13.11).
- **A14.** Todo campo recomendado exibe a frase de ganho (D10), e a frase de campo que
  alimenta a busca diz isso explicitamente.
- **A14b.** Todo campo de imagem exibe a legenda de `imageKindHint` (`packages/media`),
  com os valores do pacote — nunca dimensão escrita à mão na tela.
- **A15.** Nenhum campo do editor usa `<input>` cru com classe local: todos passam por
  `EditorField`/primitivo do pacote, com altura vinda de `artificio-control-*`
  (§9.3 item 3). Medido por `getComputedStyle`, não por leitura de fonte.
- **A16.** Ao **fim da fase** (G6), o que for extraído para `features/editor-shell/` é o
  que as duas cascas **comprovadamente compartilham**, medido com as duas existindo.
  Extrair o que só um usa reprova; **"não extrair" é resultado válido** se a comparação
  mostrar pouco em comum.

  **Reconciliação de uma contradição interna (2026-09-01).** Este critério dizia "casca
  compartilhada, não copiada; duplicar reprova" — o que **reprovaria a G1**, que manda
  duplicar de propósito. A contradição era real: o `plan.md` foi invertido e este critério
  não. Vale a estratégia **duplicar → medir → extrair**, pelo motivo do §13.8d: abstrair a
  partir de dois casos (um deles inexistente) é o fracasso público do DLS do Airbnb. A
  duplicação de G1 é **deliberada, registrada e datada**; duplicação **sem registro**, ou
  que sobreviva à fase sem G6 avaliá-la, reprova.

### 13.7 Achado que esta medição produziu — primitivo neutralizado por especificidade

Medido em beta, `getComputedStyle` no campo `Anos de Experiência`:

`.form-group input[type='text']` (`ProfileEditPage.css:290-304`) tem especificidade
**0,2,1** contra **0,1,0** de `.artificio-control-md`, e vence: aplica `padding: 0.75rem`
e `font-size: 1rem` sobre o primitivo, que renderiza **50px** em vez de 40px. O
`min-height: 40px` sobrevive nos dois caminhos — por isso a F4 passou no seu próprio
critério.

Os **50px são um dos valores que `old_spec.md:338,347` catalogou como defeito**
("alturas distintas: 16, 38, 42, 48, 50, 300 — sem escala"). Extensão medida: dos 3
`.artificio-control` visíveis na aba Mestre, **1 está neutralizado**; os outros dois
renderizam 41px corretamente. E os **5** `<input>` crus da aba Mestre não usam `artificio-control` (§13.13 C8).

Isto é C6/C7 (T12/T13) em aberto: `old_tasks.md:121` pedia **"adotar o existente"** com
escopo *"pacote + `mesas`"*, e `old_spec.md:1078-1082` (A7) é explícito — *"entrega do
tipo 'ajustei os N valores do `mesas`' reprova"*. A F4 corrigiu a largura (802px → 8rem,
verificado: `max-width: 128px`), que é correção real, mas não a adoção da escala.

**Resolve junto com 13.5:** ao passar os campos por `EditorField`, a regra legada
`.form-group input[...]` perde razão de existir e sai — e o conserto fica no nível que
impede a recorrência, como A7 exige.

### 13.8 Investigação no código — o que já existe, o que falta, o que está duplicado

Medido em 2026-09-01, antes de escrever as tasks. **Corrige uma impressão que 13.2
poderia dar:** o problema não é falta de campo nem de conteúdo — a fase B entregou
matéria. O que falta é **casca**, e o que sobra é **duplicação da casca alheia**.

**a. Já existe no perfil, funcionando:**

| peça | onde | situação |
|---|---|---|
| os 7 campos que não tinham porta | `GmProfileFields.tsx` (648 linhas) | entregues, com `data-ob` por nível |
| frase de ganho por campo recomendado | `profileEditorDomain.ts:31` | entregue (D10 cumprido) |
| prévia do perfil | `MestreProfilePreview.tsx` | existe e é **reusada em 3 telas** (`ProfileEditPage:688`, `PainelMestrePage:717`, `MasterPart:170`) |
| abas | `ProfileEditPage.tsx:218-244` | Geral / Jogador / Mestre, com `aria-selected` e roving tabindex |

A prévia ser consumida por três telas — inclusive pelo `MasterPart` do editor de mesa —
é reuso correto e **não deve ser desfeito**. O problema dela não é existir: é **onde**
está posicionada (empilhada no fim da coluna, `ProfileEditPage:688`, em vez de fixa na
lateral, onde o mestre a vê enquanto digita).

**b. O que está duplicado — §9.5 se repetindo:**

Existem **duas constantes `RECOMMENDED_GAIN` no mesmo app**, com o mesmo nome e chaves
diferentes:

| | `editorValidation.ts:72` (editor de mesa) | `profileEditorDomain.ts:31` (perfil) |
|---|---|---|
| escopo | campos do anúncio | `tagline`, `bioLong`, `specialties`, `languages`, `sellingPoints`, `experienceYears`, `links` |

O docstring de `GmProfileFields.tsx:52` é honesto sobre isso: *"**Replica** o padrão
`EditorField` + `RECOMMENDED_GAIN` do editor de mesa"*. Replicar foi a decisão certa
para entregar a fase B sem tocar no editor de mesa — mas é exatamente o defeito que
§9.5 mediu (5 classes reimplementadas) e que o princípio "Unificado" do DLS (13.4b)
existe para impedir. **Duas cópias divergem com o tempo**; a segunda já nasceu sem o
mecanismo de nível condicional (`isConditionalField`) que a primeira tem.

**c. O que de fato não existe no perfil:**

- **Partes navegáveis.** A aba Mestre renderiza tudo de uma vez
  (`ProfileEditPage.tsx:271`), sem `activePartId`. É a causa direta das 5,2 telas.
- **Lateral.** Nenhum `<aside>`; layout é coluna centralizada.
- **Contagem de pendências.** `isFieldFilled`/`pendingCounts` existem no editor de mesa
  (`editorValidation.ts:131`) e não têm equivalente no perfil.
- **`EditorField` como componente.** O perfil marca `data-ob` **à mão** em cada campo de
  `GmProfileFields.tsx`, em vez de passar por um componente único.

**d. Quão reusável é a casca do editor de mesa — medido, não suposto:**

`EditorSidebar` (`TableEditor.tsx:480-550`) **não é componente extraído**: vive dentro do
`TableEditor.tsx`. Mas o acoplamento é **raso** — depende de `EDITOR_PARTS` (importado de
`editorParts.ts`), do tipo `EditorPartId`, e de 4 props (`activePartId`, `pendingCounts`,
`progress`, `onSelect`). Nada de `TableEditorState`. **Generalizar é trocar a constante
importada por prop**, não reescrever.

`EditorField` (`parts/EditorField.tsx`) é mais acoplado: recebe `state: TableEditorState`
e chama `fieldLevel(fieldId, state)`. Porém `fieldLevel` já aceita
`ctx?: FieldLevelContext` (`editorValidation.ts:102`), não o estado inteiro — o
acoplamento está na **assinatura do componente**, não na lógica. Também generalizável.

`TableEditor.css:70` (`grid-template-columns: 300px minmax(0,1fr)`) e a media query de
720px (`:88-92`) são regras de casca sem nada específico de anúncio.

**Conclusão que isto impõe às tasks:** a casca deve ser **extraída para um lugar
compartilhado e consumida pelos dois editores** (A16). Copiar o aside para o perfil
entregaria a mesma tela e criaria a terceira duplicação — depois de `RECOMMENDED_GAIN`
(b) e das 5 classes de §9.5. E extrair a casca **não pode regredir o editor de mesa**:
ele está em produção, com cicatrizes registradas em comentário (`TableEditor.tsx:474`,
o bug T2.5 em que recriar a lista de botões matava o clique; `:286`, o `pt` de 18→24px).
Essas travas viajam junto com o código extraído, incluindo os comentários que as
explicam (AGENTS.md §Regras Gerais de Código).

### 13.10 Seletor de sistemas — medido, com correção de um diagnóstico meu

**O mantenedor perguntou se a adição de sistemas funciona como no editor de mesa. Respondi
antes de medir, e errei.** Registro porque a conclusão errada teria produzido uma task que
quebrava funcionalidade.

**O que eu afirmei:** que o perfil usa um `SystemPicker` *local*, duplicando o que o pacote
já oferece. **Falso.** `SystemPicker.tsx:25` diz o contrário, e é explícito: *"Wrapper fino
sobre `@artificio/catalog-ui#CatalogTree` — mantém a interface `SystemPickerProps` já
consumida pelos **6 usos existentes** em mesas-frontend (I8.6, spec 062)"*. O perfil **já
consome o pacote**; o wrapper só adapta `SystemTreeNode` → `CatalogUiNode` sem quebrar 6
chamadores. Cheguei à conclusão olhando o `import` sem abrir o arquivo.

**O que os dois de fato usam, medido:**

| | editor de mesa | editor de perfil |
|---|---|---|
| componente do pacote | `CatalogSystemSelector` | `CatalogTree` (via `SystemPicker`) |
| cardinalidade | **single** — uma mesa, um sistema | **multi** (`mode="multi"`) — N sistemas |
| carga | server-side, `?search=`, limite 5 | árvore inteira, `?view=tree` |

São **dois componentes distintos do mesmo pacote, para necessidades distintas** —
`CatalogSystemSelector:86-88` documenta single-select; `CatalogTree:6` declara
`mode: 'single' | 'multi'`. **Trocar o do perfil pelo do editor de mesa seria regressão:**
o perfil precisa de N sistemas e o `CatalogSystemSelector` não faz multi.

**A divergência real é de carga, e o custo está medido** (beta, 2026-09-01):

| chamada | bytes |
|---|---|
| perfil, `GET /systems?view=tree` | **487.965** (1.289 nós, 697 raízes) |
| editor de mesa, `GET /systems?search=tormenta&limit=5` | **816** |

**598× mais dados** no primeiro render do perfil, para escolher de 1 a 5 sistemas.

**A lacuna é do pacote, e é real:** `CatalogTreeProps` (`CatalogTree.tsx:9-38`) exige
`tree: CatalogUiNode[]` e **não tem nenhuma prop `fetch*`** — não existe caminho
server-side em `mode="multi"`. O `CatalogSystemSelector` tem os três
(`fetchSystemOptions`, `fetchChildOptions`, `fetchNodePath`) e é single. Então hoje o
monorepo oferece **busca sob demanda OU seleção múltipla, nunca as duas** — e quem precisa
das duas (o perfil) paga 488 KB.

Isto é `packages/catalog-ui`, não o `mesas`: corrigir só no app seria a exceção por app que
§Compartilhado por padrão proíbe, e A7 reprova (*"ajustei os N valores do `mesas`"*).

### 13.11 A prévia é a porta para o link oficial, não um espelho na lateral

**Decisão do mantenedor, 2026-09-01, em três passos.** Primeiro: *"o preview tem que ser
exatamente o link/slug dele"* — descartando o cartão que eu havia desenhado à parte.
Depois, fechando a questão que estava em aberto: **"a prévia tem que direcionar como uma
nova aba para onde vai ficar o link oficial"**.

Isto não é ajuste do espelho: **é outra coisa no lugar dele.** A lateral deixa de tentar
reproduzir a página e passa a **levar até ela**.

**Como funciona, do ponto de vista de quem usa.** Na lateral, abaixo das partes, o mestre
vê o **endereço público real** — `mesas.artificiorpg.com/mestre/<slug>` — com um retrato
reduzido do que está lá e um botão que abre **a página de verdade, em aba nova**. É a mesma
URL que ele vai colar no Discord, no grupo, na bio.

**O que isso resolve, e que o espelho não resolvia:**

- **A conferência acontece em tamanho real.** Julgar o próprio perfil por uma miniatura de
  300px espremida numa coluna é julgar outra coisa. Na aba nova ele vê a largura real, a
  rolagem real, a ordem real — do jeito que o jogador recebe.
- **O endereço vira parte do que se confere.** O link é o que o mestre divulga; vê-lo (e
  poder copiá-lo) é tão parte de "meu perfil está pronto?" quanto o conteúdo. Um espelho
  sem endereço nunca comunicaria isso.
- **Mata uma classe inteira de duplicação.** Sem espelho, não há segunda versão da página
  para divergir da primeira — o defeito de §9.5 não tem por onde entrar.

**A pergunta que estava pendente deixa de existir.** Ficava registrado aqui se a prévia
deveria **acompanhar a parte ativa** ou **ficar no topo**. Com a prévia virando porta, não
há mais nada rolando junto para sincronizar: **a decisão foi dissolvida, não adiada.**

**O caso ruim que isto cria, e como se trata.** Aba nova mostra o que está **salvo no
servidor**, não o que acabou de ser digitado. O autosave grava com 500ms de espera (B8),
então quase sempre estará atualizado — mas "quase sempre" é o suficiente para o mestre
escrever, abrir, não ver a mudança e concluir que quebrou.

**Decisão:** o botão **garante o salvamento antes de abrir** — descarrega o que estiver
pendente e só então abre a aba. O propósito do botão é conferir; conferir a versão errada
anula o propósito. O custo é um instante de espera, e ele é honesto (o mestre entende que
está salvando). As alternativas medidas e descartadas: *avisar que há mudança não salva*
(transfere ao mestre um problema que é nosso) e *não tratar* (aceita o caso ruim justamente
no momento em que ele está inseguro sobre o próprio trabalho).

**O que sai do escopo com esta decisão.** Não há mais mecanismo de injeção de estado
não-salvo na página pública: a aba nova busca do servidor como qualquer visitante. A prop
`masterOverride` que esta seção especificava **não é mais necessária** e sai da G4 — o
achado C2 da primeira revisão (prévia sem caminho de dados para o rascunho) fica **resolvido
por remoção do requisito**, não por implementação.

**Permissão não é problema aqui, e foi medido.** A página do mestre **já é pública**:
`gm_profiles` não tem `is_public`, `published` nem `draft_status` (confirmado em
`information_schema` na VM, §13.13), e o perfil não tem estado de rascunho — ao contrário
do editor de mesa, que tem `draftStatus` e só escreve "No ar" quando publicada
(`TableEditor.tsx:439`). Abrir em aba nova **não expõe nada que já não estivesse exposto**.

**`isOwner` continua importando, por outro motivo.** A task **G4a** permanece: hoje
`MasterProfilePage.tsx:28-29` tem `currentUserId = undefined` com `// TODO`, então
`isOwner` é sempre `false` e os blocos de dono (`:101`, `:117`) nunca disparam para
ninguém. Isso é **defeito de produção pré-existente** — quando o mestre abrir a própria
página pela aba nova, ele deve ser reconhecido como dono. G4a não era só pré-requisito da
prévia; é conserto que vale por si.

**A11 vale sobre o documento do editor.** A lateral não tem mais altura de espelho para
disputar espaço com as partes.

### 13.13 Segunda revisão adversarial — o que ela mudou no plano (2026-09-01)

Revisão nº 2 feita pelo mantenedor, com **leitura read-only da VM** além do código. As
medições que sustentam a fase **não foram refutadas — foram reproduzidas no sistema real**:
clone beta em `b69f4c47`, container servindo `index-Bwn4PU-7.css` (o hash citado em §13.2),
`?view=tree` devolvendo **487.965 bytes** e `?search=` **816** na API beta, `systems` com
**1.289 nós / 697 raízes**, e `information_schema` confirmando que `gm_profiles` não tem
`is_public`/`published`/`draft_status` (§13.11). Prod ainda serve `index-BGWXUDjF.css` — a
fase F está só em beta.

O que a revisão encontrou é de outra natureza: **o plano subestimava a cadeia de
componentes**. Três achados mudam tasks.

**C6 — `SystemPicker` está no meio do caminho de G7, e estava fora do plano.** O caminho
real do seletor do perfil é `UserSystemsSelector → SystemPicker → CatalogTree`, e
`SystemPicker.tsx:9-22` declara `tree: SystemTreeNode[]` **obrigatória, com zero props
`fetch*`**. Furar só o `CatalogTree` (G7) **não entrega G5b**: o fetch precisa atravessar o
wrapper. Consequência: G7 passa a incluir as props no `SystemPicker` (aditivas, opcionais),
e `SystemPicker.tsx` entra no "LER ANTES" de G5b.

**C7 — o custo de G6 tem número.** `EditorField` é consumido por **6 parts**
(`Identity`, `When`, `Where`, `Values`, `Audience`, `Master`). Tirar `TableEditorState` da
assinatura propaga para os 6 chamadores mais teste. O acoplamento é raso, como §13.8d diz;
o **número de pontos de mudança** é que não estava dimensionado.

**C8 — a dimensão de G5 estava errada.** Os `<input>` crus **na aba Mestre** são **5**
(`AvatarField` 2, `ImageUploader` 2, `LinksManager` 1). Os 7 de `ProfileEditPage.tsx:338-495`
estão nas abas **Geral/Jogador**, fora do escopo. `GmProfileFields` e `UserSystemsSelector`
não têm input cru. A contagem "10 campos" que eu usei **não é derivável do código** e sai
das tasks: G5 cobre **os 5 da aba Mestre** e a remoção da regra legada.

**Linha de base da trava de não-regressão, medida e não estimada:**
`rtk pnpm vitest run src/features/table-editor` → **10 arquivos, 259 testes, 259 passando**
(2026-09-01). O número que circulava antes ("71 em 3 arquivos") contava só três dos dez.

**D12 — A9 de defeito visual precisa de veículo, e não tinha.** O aceite de G5 pedia "A9
devolvendo a regra legada → 50px de volta", mas `getComputedStyle` não resolve cascata em
jsdom e o baseline `ui:fidelity` não cobre especificidade de regra local. **Decisão:** o A9
de G5 é feito por **asserção sobre o CSS de origem** — o contrato verifica que
`.form-group input[...]` não declara mais `padding`/`font-size`/`min-height`, no mesmo
padrão do `styles.contract.test.ts` do pacote — **mais** uma medição manual única em
navegador registrada no fechamento da task. Contrato de fonte não vira prova de pixel; o
que ele garante é que a regra não volta sem alguém notar.

### 13.15 A rota canônica é `/mestre/<slug>` — e eu tinha fixado a errada

**Achado da 3ª revisão adversarial, e o mais grave da série.** A §13.11 fixava
`/mestres/<slug>` como "o endereço que o mestre divulga". **Está errado.** Existem duas
rotas públicas de mestre (`App.tsx:71,73`) e a que eu citei é a morta:

| rota | página | links no app |
|---|---|---|
| **`/mestre/:slug`** | `MestrePage` | **5** — `TableCard:187`, `MasterCard:146`, `TableMaster:64`, `MestreReviewsSection:120` e o próprio **"Ver perfil público" do editor** (`ProfileEditPage:172`) |
| `/mestres/:masterId` | `MasterProfilePage` | **0** |

Medido com `grep` por `/mestre/` e `/mestres/` em todo o `src`, excluindo teste.

**O que isso corrige em cascata, e é bastante:**

1. **O endereço que a lateral de G4 mostra é `/mestre/<slug>`.** É por ele que o jogador
   chega hoje, de qualquer cartão de mesa, e é o que o botão do editor já abre.
2. **O achado C1 muda de natureza.** Eu havia registrado que `isOwner` era sempre `false`
   por causa de `MasterProfilePage.tsx:28-29` (`currentUserId = undefined`, com `// TODO`).
   A causa real é outra: **ninguém alcança aquela página**. O `TODO` nunca foi fechado
   porque a rota nunca foi usada. E a `MestrePage`, que é a viva, **não tem `isOwner`
   nenhum** — nem a variável, nem o conceito.
3. **G4a muda de alvo.** Deixa de ser "ligar `currentUserId` em `MasterProfilePage`" e
   passa a ser: **decidir o que a `MestrePage` mostra a mais para o dono**, se é que mostra
   algo. Como a rota morta nunca rodou, os blocos de dono de `MasterProfilePage:101,117`
   nunca foram exercitados por ninguém — não são comportamento existente a preservar, são
   código nunca executado.

**Decisão de escopo:** a fase G **não unifica as duas rotas**. `/mestres/:masterId` e
`MasterProfilePage` ficam onde estão; decidir se a rota morta é removida, redirecionada ou
mantida é assunto de produto com alcance próprio (SEO, links externos já divulgados), e não
bloqueia a casca do editor. O que a fase G faz é **apontar para a rota certa**.

**Correção de método, não só de fato.** Eu li `MasterProfilePage`, encontrei `isOwner` no
código e concluí que era a página do mestre — sem verificar **quem chega nela**. É o mesmo
erro do `SystemPicker` (§13.10) e do próprio `isOwner` (§13.11): ler a estrutura e não
medir o uso. Terceira vez na mesma spec.

### 13.16 O que continua sem medição

- **Mobile.** O aceite de F2 foi medido só em desktop (8/8 alvos a 24px). A tentativa de
  medir em 390px falhou: `resize_window` não alterou o viewport (permaneceu 1815x962) e
  forçar a largura do `<footer>` não mudou a largura dos links. **Registrado como não
  medido**, não como aprovado — o SC 2.5.8 quebra justamente quando o texto disputa a
  linha estreita.
- **O número de conclusão das fontes de progressive disclosure** vem de material de
  fornecedor (mesma ressalva de §3.4). O que sustenta a decisão é a convergência com a
  medição independente de Baymard na 098 §6.7, não o número isolado.
- **Nenhum perfil real foi preenchido com a casca nova**, porque ela não existe. A10
  (medição nos 20 perfis) continua pendente para esta seção.

### 13.17 G4a não precisa de código — a rota canônica já reconhece o dono

**Medido em 2026-09-01, ao implementar a fase G.** A §13.15 registrou que a `MestrePage`
"não tem `isOwner` nenhum — nem a variável, nem o conceito". **Está errado**, e o erro é o
mesmo de sempre: busquei pelos nomes que eu esperava (`isOwner`, `currentUserId`,
`useAuth`) em vez de medir o que a página de fato recebe.

O que existe, e está no ar:

| camada | medição |
|---|---|
| backend | `gm.ts:216-217` monta `viewer_context: { is_owner: req.user?.userId === gm.user_id, is_admin: req.user?.role === 'admin' }` e devolve em `:416` |
| hook | `useMestre.ts:224` deriva `canSeeInsights = is_owner || is_admin` |
| página | `MestrePage.tsx:136,140` só desenha métricas e recomendações quando `canSeeInsights` |

Ou seja: o dono **já é reconhecido**, a decisão de "o que ele vê a mais" **já foi tomada**
(as métricas do perfil), e a comparação é feita **no servidor**, contra o `user_id` real —
não no cliente. É mais forte do que a G4a propunha.

**Consequência para a fase:** G4a fecha **sem alteração de código**. O que ela pedia já está
entregue por caminho melhor. O `currentUserId = undefined` de `MasterProfilePage:28-29`
continua de pé, mas na rota **morta** (0 links, §13.15) — é código nunca executado, e mexer
nele seria trabalho sem consumidor.

**Quarta vez que o mesmo método falha nesta spec** (`SystemPicker`, `isOwner`, rota
canônica, e agora isto). As três primeiras foram ler estrutura sem medir uso; esta foi
buscar por nome esperado sem medir contrato. A correção operacional é a mesma: **medir o
que a coisa recebe e devolve, não procurar o nome que eu imaginava que ela teria.**

### 13.18 O que a implementação da G7/G5b encontrou

Medido em 2026-09-01, ao implementar. Três achados que a spec não previa, os três
corrigidos no mesmo trabalho.

**1. Busca sob demanda apagaria o nome do que já está escolhido.** O bloco de seleção do
`CatalogTree` monta o caminho a partir de `collectSelectedPaths(tree, ...)`: sem árvore
local, ele teria o id salvo e nada para exibir. O mestre veria a contagem certa e os nomes
sumidos — pior do que baixar o catálogo, que é justamente o que a fase evita. Daí a prop
`selectedNodes` e o `?id=a,b,c` (a rota já aceitava lista: `systems.ts:105`), que resolve a
seleção inteira numa requisição.

**2. Havia um SEGUNDO seletor de sistemas na mesma aba.** `ClosedGroupSection`
(`GmProfileFields.tsx:468`) também montava `useSystemsCatalog()`. Trocar só o "Sistemas que
mestra" deixaria a mesma tela baixando os 487.965 bytes assim mesmo — a economia medida
seria **zero** para quem abre a aba. A G5b só fecha com os dois.

**3. A busca `?search=` carrega duas correções caras que uma cópia perderia.** O filtro de
raízes (a rota achata a árvore e mistura níveis; sem ele, escolher "5e" na coluna Sistema
pula um nível) e a margem do limite (pede 25, exibe 5, porque o servidor corta antes de
sabermos quem é raiz). Copiar o bloco para o perfil seria a terceira cópia do conceito e
perderia essas linhas em silêncio — o sintoma não é erro, é navegação errada. Virou
`useSystemsSearch`, **fonte única com o editor de mesa** (`IdentityPart` passou a consumi-la).

**Erro meu, medido e corrigido:** ao ligar a resolução de nomes, pus a função de busca na
lista de dependências do efeito. Como o efeito faz `setState`, o ciclo
render→efeito→setState→render fechou e a suíte **travou sem terminar** — 600s sem saída,
a forma mais cara de falhar, porque não acusa erro. A função passou a entrar por ref, e há
teste de regressão com identidade instável: com a dependência de volta, o worker do vitest
morre.
