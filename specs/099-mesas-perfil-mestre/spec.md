# Spec 099 — Perfil do mestre: o que o mestre insere e o que o sistema expõe

**App:** `mesas` · **Status:** fase A executada (A1–A3, gate A fechado); fase B executada (B0–B10, gate B fechado com 1 pendência nomeada); **B11 pendente**; fases C e D não iniciadas
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

## 2. Estado atual, medido (2026-08-30)

### 2.1 Inventário: cada campo, onde entra e onde sai

Fonte de verdade para as fases B e C. Toda linha "sem entrada" é código já escrito,
testado e deployado que nunca chegou a ninguém.

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
| `MestreHero` (dobra) | `components/mestre/MestreHero.tsx` | 1ª frase (`split(/[.!?]\s+/)[0]`), truncada em 140 **só se exceder** | nada renderizado |
| `buildGmDescription` (**backend**, serve o crawler) | `backend/src/utils/ogDescription.ts`, servido por `backend/src/routes/og.ts` | conforme a função | *"Conheça o perfil do mestre {nome}…"* |
| `applySeo` (**front**, SPA) | inline em `pages/MestrePage.tsx:45` (`utils/seo`) | `slice(0, 150)` — substring crua | *"Landing pública de mestre…"* |

**Rede de segurança existente:** `backend/src/utils/ogDescription.test.ts` fixa a frase de
fallback. Mexer na cadeia do backend quebra esse teste — é sinal, não obstáculo.

**Mexer numa não mexe nas outras.** Com `tagline` em 0/20 e `bio_long` em 10/20, metade dos
perfis compartilhados hoje mostra uma frase genérica idêntica para todos. Encher `tagline`
melhora as três de uma vez, porque encabeça todas.

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
- **Vãos de seção sem regra** na página pública: 48 · 48 · 0 · 48 · 0 · 0.

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
- **Mobile e tema claro: não medidos.** Não são escopo cortado — só não foram medidos
  nesta passada. **Resolvido por medição (2026-08-30):** ver §7.

---

## 6. O que continua sem medição

Não afirmar nada sobre estes pontos sem medir antes.

| o quê | estado |
|---|---|
| causa de `selling_points` voltar `{}` — **beta medida** (hidratação `admin/sync/enrich` copiando de prod); **prod não medida** (39/48 `{}`, nascendo até 08-28; hidratação/escrita manual no período descartada pelo mantenedor) | bloqueio nomeado em §2.2 |
| mobile (719px) | **medido** (§11): sem overflow nem texto estourando. **Só a página pública** — o editor exige sessão |
| tema claro | **não medido** |
| editor de perfil em runtime | **não medido** — exige sessão (§11.1) |
| comportamento com perfil cheio | **impossível hoje** — nenhum dos 20 preenchido |
| nav global com alvo de 22px | **não reproduz** no CSS do pacote (`min-height: 40px`) — re-medir em runtime |
| custo do esquema de extração para bio | **não medido** (o parser atual é calibrado para anúncio) |
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
reprovar. F5 continua sendo a limpeza do que já existe no editor de perfil.

---

## 11. Medição em viewport — mobile deixou de ser pendência

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

**Isto fecha C4 e a pendência de mobile (§7):** em 719px **não há overflow horizontal nem
texto estourando**. O layout responsivo da página pública está correto; o que sobra é o
mesmo defeito das duas larguras.

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

**O que NÃO foi medido, e fica dito:** o editor em **719px**. A janela do Chrome não
redimensionou (`innerWidth` permaneceu 1815 em duas tentativas) e a medição por `iframe`
voltou vazia. **Não vou afirmar nada sobre o editor em mobile** — continua pendente para
C4, agora só para o editor, já que a página pública foi medida em §11.

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