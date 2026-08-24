# Spec 096 — Mesas: editor de anúncio da mesa (substitui o onboard de criação)

**App:** `mesas` · **Status:** aberto · **Criada:** 2026-08-23 · **Fase 2 concluída:** 2026-08-23
**Última rodada de decisões:** 2026-08-24 (R6.1, **R18-R24**, §Gap 9, §Gap 10, §Gap 11, autorização de escopo)
**Origem:** demanda direta do mantenedor (2026-08-23). Fluxo em 4 etapas definido pelo
mantenedor: (1) levantamento inicial pelo orquestrador, (2) conferência externa (Claude),
(3) levantamento de protótipos/fluxos com pesquisa de mercado + grill, (4) implementação.

**O que esta spec entrega, em uma linha:** o wizard de 6 etapas dá lugar a um **editor de
anúncio** — campos sempre abertos, editados no lugar, sem etapa, sem gaveta e sem rolagem;
criar e editar são a mesma tela.

- **Módulo/Pacote:** apps/mesas
- **Gate relacionado:** D (projeto `mesas` em ciclo contínuo)
- **Decisões de escopo:** as decisões do mantenedor estão em **duas** tabelas datadas —
  "Entra" (2026-08-23) e "Entra — decisões de 2026-08-24" —, todas com data. As da Fase 2 saíram de 4 rodadas de protótipo navegável, cada uma rejeitada
  com o motivo dito por ele — o registro guarda o que foi rejeitado, não só o que passou,
  porque a diferença entre "editor de anúncio" e "onboard com sidebar" só fica clara pelo
  contraste. Nada aqui é inferência do agente; achado sem resposta continua como pergunta
  aberta, nunca como decisão fechada.
- **Regra de débito desta spec:** débito/achado descoberto durante a implementação que
  toque o frontend/backend do escopo **é resolvido aqui**, não empurrado pra backlog. O
  agente não decide adiar; na dúvida, pergunta ao mantenedor.
- **Gate de fase:** cada fase de `tasks.md` termina com uma task 🔁 que obriga reler os
  requisitos e seções nomeados deste arquivo e do `plan.md` antes do PR. Divergência:
  corrigir, ou perguntar se a spec é que está errada — nunca seguir o `tasks.md` calado.

## Diretrizes do mantenedor (2026-08-23, terceira rodada)

Quatro diretrizes dadas depois da Fase 2, verificadas contra o código antes de virarem
requisito. Cada uma gerou correção neste arquivo:

1. **Uso máximo dos pacotes compartilhados, sobretudo sistemas e design.** → R16, A16, A18.
   Medido: o fluxo de criação importa **zero** de `@artificio/ui` (16 primitives ociosos);
   `SystemPicker` **já é** wrapper sobre `@artificio/catalog-ui`, com 6 consumidores — não
   precisa nascer, precisa ser configurado (`presentation="selection"`).
2. **Reduzir redundância nos inputs grandes de texto.** → §Gap 8, R17, A17. Medido: 9
   editores de texto rico (não 7), quatro deles com 0–1 uso em 107 mesas, e dois com rótulo
   idêntico na mesma tela.
3. **Melhores práticas de mercado resolvem dúvida.** → mantida a base da Fase 2
   (§Pesquisa de mercado no `plan.md`); as pendências de agrupamento **foram fechadas em 2026-08-24** (aprovação do mantenedor com o artefato de validação à vista — ver Entra 08-24) e
   **não** foram fechadas por inferência do agente.
4. **Conferir se tudo do onboard atual é usado, e se o alinhamento satisfaz o mercado.** →
   R11 (paridade) segue contratual; A2 ganha o A18, que obriga a correção de alinhamento a
   morar no pacote.

**Correção material desta rodada:** o Gap 7 (`<select>` no escuro) estava registrado como
não implementado e **já está corrigido no repo** desde 2026-08-17 — detalhe em §Gap 7. A
trava de aprovação nominal que a Fase 3 carregava por causa dele cai.

### Autorização de escopo: pacotes compartilhados (2026-08-24)

O mantenedor autorizou nominalmente: *"tudo que for para tocar em pacote compartilhado, está
autorizado."* Vale para `packages/*` **dentro do escopo desta spec** — `media` (feito:
`minWidth`/`minHeight`/`acceptedMimeTypes`/`imageKindHint`), `ui/primitives` (`Field`, se A2
exigir altura fixa de rótulo) e `catalog-ui` (`CatalogTree`).
**O editor de contatos unificado NÃO é pacote** (correção da 2ª auditoria): perfil e mesa
vivem no mesmo app, então o componente único mora em `apps/mesas`, sem verificação de
impacto cross-app.

**Três limites que esta autorização NÃO remove:**

1. **Commit, push, PR e deploy continuam exigindo aprovação por ação** (§Autorização do
   AGENTS.md: "aprovação vale por ação, nunca por sessão"). Autorização de *escopo* não é
   autorização de *ação*.
2. **`packages/auth` tem trava própria e mais dura** — exige SDD Completo e smoke de todos
   os apps que consomem SSO. Está fora do escopo desta spec e não é tocado com base nesta
   autorização.
3. **Verificação de impacto nos consumidores continua obrigatória** a cada mudança:
   `tsc --noEmit` no pacote e nos apps afetados, mais os testes do pacote. Foi o que se fez
   na mudança do `media` (72/72, três `tsc` limpos).

### Critério permanente: robusto, escalável e no padrão do mercado

Dito pelo mantenedor em 2026-08-23 (*"lembre: robusto, escalável e com as melhores práticas
do mercado"*) e registrado aqui em 2026-08-24, depois de um levantamento das decisões da
sessão apontar que a diretriz vinha sendo **aplicada caso a caso sem estar escrita** — o que
a tornava invisível para qualquer agente que retomasse a spec.

Não é slogan: é o critério de desempate quando duas soluções resolvem o mesmo sintoma.

- **Robusto** — a solução trata a causa, não o sintoma. Precedentes desta spec: as sinopses
  saíram por **remoção** em vez de rebind (T3.2e cancelada); a faixa etária virou recomendado
  porque obrigar não conserta um payload que descarta o campo (R6.1); a exclusão de domínio
  concorrente entrou na lista de função, não numa condicional por caso (`mesaquest`).
- **Escalável** — a solução vale para o próximo caso sem ser reescrita. Precedentes:
  `DDAL_ELIGIBLE_PATHS` como lista em vez de constante única; `parent_id` na rota existente
  em vez de endpoint por nível; **um** editor de contatos servindo perfil e mesa em vez de
  dois; busca server-side em vez de 492 KB filtrados no cliente.
- **Padrão do mercado** — quando houver dúvida de produto, a referência é medida e citada
  (§Pesquisa de mercado no `plan.md`), não inventada.

Corolário que já produziu decisão nesta spec: **exceção por app, condicional por caso e
componente duplicado são a resposta errada por definição** — mesmo quando funcionam. É a
mesma regra do AGENTS.md §Regras Gerais de Código, aplicada aqui como critério de aceite
informal de toda task.

---

## Problema

Sete frentes apontadas pelo mantenedor (2026-08-23), todas no fluxo de criação/edição de
mesa do `mesas`. O levantamento inicial (Fase 0) mede cada uma e registra evidência
arquivo:linha no `plan.md`.

### Gap 1 — Onboard disperso em etapas; edição cai no mesmo fluxo

A criação de mesa é um wizard em etapas separadas. O mantenedor aponta que o fluxo coloca
informação que poderia vir depois (ordem confusa para o usuário) e que **editar uma mesa
cai no onboard**, dificultando mudanças pontuais. Diretriz inicial: aposentar o onboard
atual e redesenhar seguindo melhores práticas do mercado.

**Diretriz final (2026-08-23, após 4 rodadas de protótipo navegável):** o alvo não é um
onboard melhor — é **outro tipo de tela**. Criar mesa é **publicar um anúncio**, e a
referência é cadastro de produto em marketplace (Mercado Livre, DMs Guild), não
formulário de cadastro. Consequência: nada de etapas, nada de gaveta, nada de rolagem.
Detalhe e o que foi rejeitado em cada rodada: §Decisões de escopo → Entra.

Evidência estrutural (levantamento Fase 0, 2026-08-23):

- O wizard de mesa é `CreateTableForm.tsx` (469) + `useStepNavigation.ts` +
  `components/form-steps/steps/` — 6 steps: `StepBasic` (48), `StepSystem` (117),
  `StepSessions` (72), `StepConfig` (451), `StepReview` (218), `StepFinal` (568) —
  total 1.474 linhas só nos steps. Único consumidor: `PainelMestrePage.tsx:693`.
- **Correção de premissa (levantamento):** `OnboardingPage.tsx` (495) **não é** o
  onboarding de mesa — é onboarding de **preferências do usuário** (rota `/onboarding`,
  `App.tsx:58`), sem relação com criação de mesa. Fica fora do Gap 1 salvo decisão
  explícita do mantenedor de aposentá-lo também (pergunta do grill).
- Edição reutiliza 100% o mesmo form: `/painel?edit=<id>` → `GET /api/v1/gm/tables/:id`
  → `mapTableApiToInitialData.ts` → `CreateTableForm initialData=…`
  (`PainelMestrePage.tsx:394-408,690-697`). `useStepNavigation` inicia `step=1`/
  `maxStepUnlocked=1` mesmo com dados carregados (`useStepNavigation.ts:19-20`), então
  editar um único campo exige passar por todas as etapas de novo; botão final é
  "✓ Publicar Mesa" também na edição (`StepActions.tsx:57`).
- **Dois bugs de perda de dados na edição, medidos no aprofundamento do Gap 6** e parte
  do escopo desta spec (detalhe e evidência no Gap 6): mesa Covil é desmarcada a cada
  edição (`is_covil_mesa` nunca existe na resposta) e múltiplos horários colapsam para um
  (mapper lê `sessions`, backend devolve `schedules`).

### Gap 2 — Exigências de Computador/microfone/câmera pouco explícitas

Requisitos de hardware/áudio/vídeo devem ficar claros **junto da escolha do VTT**, de
forma inteligente: alguns VTTs exigem PC; **Discord implica microfone automaticamente**;
marcar determinados VTTs deve **auto-marcar** os requisitos correspondentes. Hoje o fluxo
não explicita isso ao usuário — os 3 checkboxes vivem escondidos no colapsável de
avançados do `StepFinal`, longe do select de VTT (`StepConfig`). Evidência no levantamento
(Fase 0). No editor de anúncio, requisito e plataforma ficam na mesma parte ("Onde joga"),
e a auto-marcação **diz por que** marcou.

### Gap 3 — Bug de preço: avulso 55 + mensal 40 exibia 39,96 — ENCERRADO POR CONFERÊNCIA

Relato original do mantenedor: ao digitar valor avulso 55 e mensal 40, o frontend exibia
algo como **39,96**. **Encerrado em 2026-08-23:** o mantenedor conferiu 3 vezes e o campo
de edição mostra **40** (correto). O levantamento mediu o código atual: nenhuma fórmula
gera 39,96 de 55/40 (exibição é passagem crua; a única conta derivada é o percentual de
economia, 27%, correto — `TableActionPanel.tsx:72-74`). Candidato learning-store
**descartado por medição em produção**: `discord_field_learning` não tem nenhuma regra
ativa de `price_value` (query citada no `plan.md`). A única mudança recente na exibição
de preço foi a PR #283 (`b3993fc`/`f92acbe`/`7b4ee7a`). Causa do 39,96 original permanece
não confirmada; se reaparecer, reproduzir antes de corrigir (candidatos restantes
registrados no `plan.md` §Gap 3). **Permanece nesta spec:** teste de regressão fixando a
exibição exata do digitado (R4).

### Gap 4 — Parser "colar anúncio" não captura as informações do texto

O parser do fluxo de nova mesa ("colar anúncio") não está realmente captando as
informações. Diretriz do mantenedor: **se a informação está no texto, o parser deve lê-la,
saber o que é, diferenciar e ajudar o mestre com vários preenchimentos**. Evidência do
estado atual no levantamento: o que o parser capta hoje, o que descarta, e onde
(`ParsePreviewTextArea.tsx`, backend `parseTextForPreview`, mecanismos da spec 079/093).

### Gap 5 — Obrigatório vs opcional pouco claro; sem explicações

Falta distinção visual e textual entre campos obrigatórios e opcionais, com explicações
direto no campo. Diretriz: três níveis — **obrigatório, importante e super opcional** — e
identificação de **redundâncias** (campos duplicados, perguntas repetidas).

**Decisão do mantenedor (2026-08-23):** adotar o padrão de mercado de validação por
campo — indicador **vermelho ao redor do campo** quando o usuário interage com ele e não
completa, e também quando tenta fechar/salvar sem preencher; mensagens de erro por campo
(hoje só a primeira mensagem da etapa aparece — `StepActions.tsx:18-22`).

### Gap 6 — Backend existente não usado ou mal usado

Não se deve perder a utilização de tudo que já existe no backend e não está sendo usado ou
não está sendo usado direito. O levantamento (2 rodadas: inventário + aprofundamento, com
medição read-only no banco de produção) apurou:

- **Perda silenciosa com dado ERRADO chegando ao público:** `age_rating` e `table_level`
  são coletados no form mas não entram no payload; o banco tem default `'livre'`/`'todos'`
  (`information_schema` medido). Produção: as 41 mesas manuais estão 100% com os defaults
  — o mestre que escolheu "+18" tem a mesa exibida como "livre". O pipeline Discord grava
  valores reais (57/66 imported têm faixa real). **Decidido (2026-08-23):** consertar o
  payload/validator daqui pra frente, **sem backfill** nas 41 — detalhe e motivo em
  §Decisões de escopo → Entra.
- **Dois bugs de perda de dados na EDIÇÃO** (achados do aprofundamento, cabem em R2):
  (1) `mapTableApiToInitialData.ts:143` lê `is_covil_mesa`, que nunca existe na resposta —
  toda edição envia `is_covil: false` e **desmarca mesa Covil** (2 mesas Covil reais em
  produção); (2) mesmo arquivo `:86` lê `data.sessions` enquanto o backend devolve
  `schedules` (`gmPanel.ts:577`) — editar uma mesa com N horários colapsa para 1
  (produção hoje: 90 mesas com 1 schedule, **0 com 2+**). **Correção do registro (2026-08-24):** a versão anterior dizia que "o novo editor com múltiplos horários torna o bug crítico" — **invertido**, porque o R20 remove o repeater e o editor passa a ter **um horário só**. O bug continua real e é corrigido por T3.1; o que muda é a gravidade, que **diminui**. Medido: `extractSchedules` (`syncHelpers.ts:292-330`) retorna **0 ou 1** schedule — o parser nunca cria múltiplos, embora a tabela e o `sort_order` suportem.
- **Notificações órfãs:** backend escreve em 12 pontos (6 arquivos); 3 rotas de leitura sem
  consumidor;
  produção tem 66 notificações, **62 nunca lidas**.
- ~40 rotas sem consumidor, reclassificadas no aprofundamento em: capacidade valiosa sem
  UI (sugestão de VTT com endpoint e sem botão; `*-suggestions/mine`), duplicadas
  (telemetria `/gm/tables/*`; `profile/me/gm|player`; auth legado), diagnóstico admin
  (eval/shadow/projection-sync), mortas (`verify-covil`, `tableSchedules.ts` inteiro,
  join tables `table_tags`/`table_platforms`, `table_history` sem escritor).
- **Payload descartado em rotas consumidas:** `custom_scenario`, `style_tags`, `features`,
  `price_frequency` (1 mesa em produção), `starts_at` (0), `city`/`state` (0),
  `content_warnings`/`safety_tools` reais (0 mesas — campos 100% mortos em produção),
  `system_name/slug/path/logo` devolvidos e ignorados no mapper.
- **Capacidades prontas que o novo editor deve aproveitar:** sugestão de
  sistema/cenário já no form (preservar); aliases de VTT/comunicação em tabela (só o fluxo
  admin usa — ligar no parse-preview custa 2 queries); aprendizado do parser com loop
  fechado via `parse_case_id` (preservar); herança do perfil GM
  (`preferred_vtt_platforms`, `languages`, `contact_methods`) para pré-preencher o
  editor; catálogo de estilos já vivo.
- **Redundância de dados medida:** `communication_platforms` tem 6 linhas incluindo
  "Meet" ao lado de "Google Meet" (mesma data de seed) — candidato a limpeza no grill.

### Gap 7 — `<select>` ilegível no tema escuro — JÁ CORRIGIDO NO REPO (correção de 2026-08-23)

Apontado pelo mantenedor durante a prototipagem: *"menus de seleção estão bugados no modo
escuro. Isso já foi tentado corrigir várias vezes e parece que nunca corrige."*

**Causa:** a **lista aberta** do `<select>` é desenhada pelo sistema operacional, não pela
página. `background` e `color` aplicados ao `<select>` ou ao `<option>` **não a alcançam** —
no Windows ela volta a branco-sobre-branco no tema escuro. A única propriedade que chega ao
widget nativo é `color-scheme`.

**Correção do registro (2026-08-23, medida contra o código):** a Fase 2 registrou
`rtk rg "color-scheme"` → "zero ocorrências" e concluiu que a propriedade nunca fora usada.
**Isso estava errado.** O contrato já existe e é canônico:

- `packages/ui/src/styles.css:1008-1058` — bloco `<select> — CONTRATO ÚNICO DO REPO`, com
  `color-scheme: light` em `select`/`.artificio-control` (`:1027-1030`), `color-scheme: dark`
  sob `:root[data-theme="dark"]` (`:1032-1035`), cores de `<option>`/`<optgroup>`
  (`:1037-1043`) e realce de `hover`/`focus`/`checked` (`:1050-1058`).
- Entrou em `3ae4f6b` (2026-08-17), **seis dias antes desta spec** —
  `rtk git log -- packages/ui/src/styles.css`.
- O `mesas` já consome: `main.tsx:8` importa `@artificio/ui/styles.css`; o
  `index.css:111-113,241` do app **documenta a remoção** da versão local em favor do
  contrato único, citando que a regra local contradizia o `color-scheme: dark`.

O comentário do próprio pacote (`styles.css:1011-1015`) descreve a mesma história que a
Fase 2 redescobriu: *"os apps nasceram em momentos diferentes e cada um tinha a própria
correção de picker (downloads, glossario e mesas repetiam variações do mesmo hack)"*.

**Consequência para esta spec:** R9 e T3.4 **não têm implementação pendente**. O que resta é
a conferência visual do menu **aberto** no tema escuro (A10), que só o mantenedor pode fazer
— a lista nativa não aparece em captura de tela. A trava de aprovação nominal para tocar
`packages/ui` cai junto, porque não há edição a fazer no pacote por conta do Gap 7.

**Lição registrada:** a medição original buscou a string no lugar certo e concluiu ausência
— provavelmente por rodar contra um working tree desatualizado ou por erro de escopo do
comando. Claim documental sobre estado de código vale o que a releitura do código sustenta
(AGENTS.md §Erros que não podem se repetir: *"código é a verdade material"*).

### Gap 11 — Campos com cadeia pronta e sem entrada no editor (medido em 2026-08-24)

Os 7 campos sem consumidor listados no §Gap 11 foram medidos um a um, e **não são um grupo só**:

| Campo | Validator aceita | Página pública exibe | Uso |
|---|---|---|---|
| `custom_scenario` | **não** | não | 0/107 |
| `style_tags` | **não** | não | 0/107 |
| `features` | **não** | não | 0/107 |
| `city` | sim | **sim** — `TableActionPanel.tsx:212-215` | 0/107 |
| `state` | sim | **sim** — mesmo bloco | 0/107 |
| `content_warnings` | sim | **sim** — `TableSecurity.tsx` | 0/107 |
| `safety_tools` | sim | **sim** — `TableSecurity.tsx` | 0/107 |

**Grupo 1 — colunas órfãs** (`custom_scenario`, `style_tags`, `features`): nem validator, nem
leitor, nem dado. `style_tags` ainda concorre com `setting_styles`, que tem **54 mesas** e
vira filtro do catálogo. **Descartar** — não há o que preservar.

**Grupo 2 — capacidade paga e desligada** (`city`, `state`, `content_warnings`,
`safety_tools`): backend aceita, mapper envia, página pública renderiza **com teste**. Falta
só **o campo no editor**. É **capacidade paga e desligada** no sentido literal.

#### Segurança de mesa: o vocabulário já existe e é curado

`TableSecurity.tsx` (94 linhas) + `utils/safetyToolsGlossary.ts` traduzem cada termo para o
jogador. **6 ferramentas**: X-Card, Linhas e Véus, Lua e Sol, Check-in, Script Change, Open
Door. **8 avisos**: violência, violência gráfica, terror, morte, abuso, temas sexuais, gore,
discriminação. Cada um com descrição própria (X-Card: *"Qualquer jogador pode sinalizar a
qualquer momento para pular ou suavizar uma cena, sem precisar explicar o motivo"*).

O comentário do glossário registra que ele nasceu na spec 081 **sabendo que produção estava
vazia** — construíram exibição e vocabulário, e a entrada nunca chegou.

**Consequência de desenho, medida:** as colunas são `text[]` **sem enum**, e o glossário casa
por chave normalizada. Campo de texto livre faria "violencia" sem acento perder a descrição.
O editor oferece **os termos do glossário como opções**, com entrada livre para o que não
estiver na lista — não um campo aberto.

#### `city`/`state` só em modalidade presencial

**Medido: 107 de 107 mesas são `online`** — zero presencial, zero híbrida. Os campos são
condicionais a uma modalidade nunca usada, então **só aparecem quando a modalidade não for
online** (decisão do mantenedor, 2026-08-24). O precedente já existe no form: VTT e
comunicação só aparecem em online/híbrida (`StepConfig.tsx`, `isOnline`). A exibição pública
já é condicional (`{(vm.city || vm.state) && …}`), então nada vaza numa mesa online. · R23

### Gap 10 — Organização das partes: banner, horários, requisitos e valores (2026-08-24)

Seis decisões do mantenedor sobre a distribuição dos campos, dadas depois de ver o artefato
de validação. Cada uma medida contra o código antes de virar requisito.

**1. O banner fica logo abaixo do título da mesa.** É a identidade visual do anúncio; hoje
vive no início do `StepFinal` (`:156-175`), a quatro etapas de distância do título.

**2. Regressão do sistema de imagem — a mais grave desta rodada.** O `ImageUploader`
(280 linhas + `useImageUpload` 98 + `useImageUrlImport` + `CroppedImage` +
`@artificio/image-editor` + `@artificio/media/image-kinds`) tem **13 capacidades**, e o
registro vinha tratando "banner" como um campo simples. Todas migram:

| Capacidade | Onde está hoje |
|---|---|
| Upload de arquivo local | `ImageUploader.tsx:172` (alvo de toque **44px**) |
| URL manual | `:207` |
| Importar link externo para a hospedagem própria | `POST /api/v1/upload/url`, via `useImageUrlImport` |
| Checkbox **"Manter link direto"** com tooltip | `:216-220` (`keepDirectLink`, desligado por padrão) |
| Editor de recorte (`@artificio/image-editor`) | `:232` |
| Crop **não destrutivo** (dado, não arquivo) | `onCropChange:26`, aplicado por `object-position` |
| **"Ajustar enquadramento"** sem reenviar | `:179-187` |
| Upload **antes** do crop (servidor pode reduzir) | ordem deliberada em `:135-136` |
| Invalidar crop **e** dimensões ao trocar de imagem | `:95`, `:135` |
| Validação por `kind` (mesma definição do backend) | `imageKindSpec:67` |
| Prévia com placeholder e rótulo personalizado × padrão | `:69` (`banner_placeholder.webp`) |
| Remover imagem (limpa URL, crop e dimensões) | `:250-256` |
| `aria-live="polite"` na seção e `role="alert"` no erro | `:151` |

**Nenhuma delas é opcional na migração** — é o item que o `plan.md` já marcava como "o mais
subestimado do registro anterior", e a cobrança do mantenedor confirma que voltou a ser
subestimado.

**2b. O uploader precisa DIZER o que espera do usuário** (mantenedor, 2026-08-24). Contrato
medido em `packages/media/src/imageKinds.ts:46-53` — fonte única, a mesma que o backend usa:

| Propriedade de `table_banner` | Valor |
|---|---|
| Proporção | **1200 × 650** (≈1,85:1) — `aspectRatioCss: "1200 / 650"` |
| Maior dimensão preservada | **1600 px** (`maxDimension`) |
| Limite de arquivo | **5 MB** (`maxFileBytes`) |
| Formatos | **JPG, PNG e WEBP** |
| Tamanho **mínimo** | **não é regra** — `minWidth`/`minHeight` existem no `imageKindSpec` desde 2026-08-24, mas **nenhum validador os impõe**. Recomendado 1200 × 650, piso 600 × 325 (medido pelo uso em `og:image`) |

**PNG é aceito na cadeia inteira — não há contrato a mudar.** A primeira verificação parou
na validação; o mantenedor cobrou o Cloudinary, e a cadeia completa foi medida em
2026-08-24:

| Camada | Aceita PNG | Evidência |
|---|---|---|
| `accept` do input | sim | `ImageUploader.tsx:162` |
| Validação no cliente | sim | `useImageUpload.ts:31` |
| `multer.fileFilter` | sim | `upload.ts:24` |
| **Cloudinary** | **sim** | `services/cloudinary.ts` **não define `allowed_formats`**; upload assinado por API key, sem preset restritivo |
| **Produção** | **40 banners `.png`** | `SELECT` por extensão em `tables.banner_url` (jpg 45, **png 40**, webp 2, gif 1) |
| Entrega HTTP | `200`, `content-type: image/png` | `curl` num PNG real de produção |

**Ressalva que a legenda precisa respeitar:** `storageTransformation`
(`imageKinds.ts:111-117`) aplica `fetch_format: "auto"`, então o Cloudinary **entrega o
formato mais eficiente que o navegador aceita** — um PNG enviado pode chegar como WebP ao
visitante. É otimização desejada, mas significa que **a legenda não deve prometer
preservação de transparência**: o arquivo é aceito, a conversão de entrega não é controlada
pelo editor.

**Tamanho mínimo — a resposta vem do uso, não de preferência.** O banner **vira `og:image`**
(`og.ts:238`), e o og é declarado como **1200 × 630** (`og.ts:75-76`). Esse é o padrão de
mercado para preview em WhatsApp, Discord, Twitter e Facebook, cujo piso técnico é
**600 × 315** — abaixo disso as plataformas degradam para card pequeno ou descartam a
imagem. A proporção do sistema (1200 × 650) é praticamente a do og, o que confirma o mesmo
enquadramento largo.

**Produção mostra que o problema é real, não hipotético:**

| Medição (banners com dimensão registrada) | Valor |
|---|---|
| Total com `banner_width` | 9 |
| **Abaixo de 1200 px de largura** | **7 de 9** |
| Largura mediana | **720 px** |
| Menor largura | **473 px** |

A maioria dos banners é menor que o `og:image` que os anuncia: o mestre compartilha a mesa
no Discord e o preview sai rebaixado, sem que nada no sistema o tenha avisado.

**Recomendação medida — aplicada ao pacote em 2026-08-24** (autorização nominal do
mantenedor), **ainda não commitada em 2026-08-24**: `git grep minWidth origin/dev` → **zero**. A
mudança vive no diff local e **entra no PRÓXIMO commit, junto com o diff OG** (decisão do mantenedor,
2026-08-24 — **não** espera o 1º PR da spec) — até lá, quem partir de `origin/dev` não
encontra o helper e a task que o consome falha no
primeiro import (achado C2 da 2ª auditoria). `packages/media/src/imageKinds.ts` ganhou:

| Campo novo | `table_banner` | `profile_avatar` | `profile_banner` |
|---|---|---|---|
| `recommendedWidth × Height` | 1200 × 650 | 280 × 280 | 1200 × 650 |
| `minWidth × Height` | **600 × 325** | 140 × 140 | **600 × 325** |
| `acceptedMimeTypes` | JPG, PNG, WEBP | idem | idem |

Cada valor tem origem medida, não convenção: o banner recomenda o tamanho do `og:image` que
ele alimenta (1200×630, `og.ts:75-76`) e tem piso no mínimo social — **600×315 é o número
das plataformas; o spec grava 600×325 para manter a proporção 1200/650 do sistema**, que é
ligeiramente mais alta que a do og (1200/630). Os 10px extras de altura são isso, não
divergência; o avatar
recomenda o **dobro** dos 140 px em que é exibido no perfil público
(`MestrePage.css:70`), para tela 2×.

Acrescentado também `imageKindHint(kind)`, que monta a frase da legenda a partir do spec —
para que nenhum componente volte a escrever proporção ou limite à mão, que é a divergência
que este pacote existe para evitar. A função é testada contra o que **não** pode prometer.

**Validação:** `vitest` do pacote **72/72** (era 63; 9 casos novos), `tsc --noEmit` limpo em
`packages/media`, `apps/mesas/frontend` e `apps/mesas/backend` — a mudança é aditiva e
nenhum consumidor quebrou.

`minWidth`/`minHeight` são **orientação, não bloqueio**: quem valida decide se avisa ou
recusa, e upload abaixo do piso continua tecnicamente válido (§item 2b acima).

**O que a UI informa hoje:** uma linha só — *"JPG, PNG ou WEBP até 5 MB"*
(`ImageUploader.tsx:191`). **Não diz a proporção**, que é justamente o que determina o
resultado: o mestre envia uma imagem quadrada, ela é enquadrada em 1200/650, e ele descobre
o corte depois de enviar.

**Dois cuidados que a medição impõe à redação da legenda:**

- **Não prometer mínimo que o sistema não verifica.** Nenhum consumidor valida dimensão
  mínima hoje. A legenda **orienta sem impor** — "recomendado 1200 × 650; abaixo de
  600 px de largura o preview em Discord e WhatsApp sai rebaixado" — e nunca anuncia regra
  que o sistema não aplica. **`minWidth`/`minHeight` JÁ EXISTEM no `imageKindSpec` desde
  2026-08-24** (`imageKinds.ts`, os três tipos) — o que falta é **um validador consumi-los**
  para avisar; enquanto nenhum consome, o piso segue sendo orientação.
- **Não prometer transparência.** `fetch_format:"auto"` faz o Cloudinary entregar WebP/AVIF
  conforme o navegador; PNG transparente é aceito, mas a conversão de entrega não é
  controlada aqui.
- **`maxDimension` não é rejeição, é redimensionamento.** O comentário do pacote
  (`:29-33`) diz que `crop: 'limit'` *"só REDUZ imagem maior que o limite e nunca descarta
  pixel"*. Escrever "máximo 1600 px" faria o mestre acreditar que uma imagem maior seria
  recusada — quando ela é aceita e reduzida. A legenda deve dizer o que acontece, não impor
  um teto falso.

A legenda tira os valores do `imageKindSpec`, nunca de literal no componente — é o mesmo
motivo pelo qual o limite de 5 MB já vem de lá (`useImageUpload.ts:40`), depois de o repo ter
tido telas com limites divergentes para o mesmo endpoint (comentário em `useImageUpload.ts:9-12`
registra `AvatarUploader` com 2 MB como bug de contrato). · R19, A22

**3. Apenas UMA configuração de horário, com "horário personalizado".** Decisão do
mantenedor: o repeater de múltiplos horários sai. No lugar, uma configuração só, mais uma
opção **"horário personalizado"** com campo livre onde o mestre escreve e explica a agenda
(ex.: *"quinzenal, alternando sábado e domingo, combinado no grupo"*).
**Medição que sustenta:** em produção há **90 schedules para 90 mesas** e **zero mesas com
2+ horários** — o repeater nunca foi usado para o que existia. E o texto livre resolve o que
o formato rígido não cobria.
**Nos cards do catálogo, aparece "Horário Personalizado"** quando essa opção é usada.

**Como grava e como o card detecta — investigado em 2026-08-24, sem coluna nem flag nova:**

| Pergunta | Resposta medida |
|---|---|
| Que campo marca "personalizado"? | `schedule_day_status='to_define'` — enum `'defined'\|'to_define'` que **já existe** (`tableValidators.ts:162-164`), com `schedule_time_status` e os `*_hint` correspondentes |
| Onde vai o texto livre? | **`table_schedules.notes`** — `text` nullable, já existe, 9 usos em produção, e o mapper já a omite quando vazia (T4.0f) |
| Por que não "sem horário"? | `day_of_week` e `start_time` são **`NOT NULL`** (`information_schema`) — ausência não é representável; o sentinela `'to_define'` já é o usado pelo `SessionRepeater` (`:24`) |
| Como o card decide? | `TableCardSchedule` (`TableCard.tsx:227-240`) monta `dayLabel + time` direto; entra um ramo antes: status `to_define` → "Horário Personalizado" |

Escolha deliberada por **reuso do contrato existente**: qualquer consumidor que já leia
`schedule_day_status` — WhatsApp, og, página da mesa — herda o comportamento sem alteração
própria. Criar coluna ou flag nova para o mesmo conceito seria a duplicação que o AGENTS.md
trata como dívida.
**Consequência a tratar:** o Bug 2 da edição (mapper lê `sessions`, backend devolve
`schedules` — T3.1) continua valendo, porque a tabela `table_schedules` permanece; o que
muda é a UI parar de oferecer N horários.

**4. "Vagas por sessão" sai.** Redundante com vagas totais e vagas abertas, que já existem.
Medido: **3 de 90** schedules têm `slots_per_session` preenchido — o campo nunca pegou.

**5. Requisitos técnicos viram lista de checkboxes explícita.** Computador, microfone e
câmera marcados numa lista, junto da plataforma (R3). Medido: **já são checkbox** hoje
(`StepFinal.tsx:359-388`) — o defeito nunca foi o controle, foi o **lugar**: escondidos no
colapsável de avançados, a duas etapas do select de VTT que os determina. A lista fica na
parte "Onde joga", com a auto-marcação explicando por que marcou.

**6. Os campos de valores estão espalhados e se juntam.** Medido — hoje ocupam **dois
steps**: `price_type` (`StepConfig.tsx:343`) e `accepts_donations` (`:391`) numa etapa;
`billing_text` (`StepFinal.tsx:247`) e `session_zero_free` (`:267`) noutra. Preço avulso e
mensal ficam num terceiro ponto. Tudo passa a viver na parte "Valores", na ordem em que a
decisão acontece: cobrança → valores → doação → sessão zero → detalhes.

### Gap 9 — Escolher sistema, edição e variante é difícil (medido em 2026-08-24)

Relato do mantenedor: *"a parte do sistema é muito importante. Tem que ser redesenhado
também. Hoje está difícil entender e usar para selecionar sistema, edição e variante."*

**Duas coisas distintas:** (1) o comportamento de busca-primeiro e os níveis progressivos
**já existem** no `CatalogTree` — `SystemPicker.tsx` (61 linhas) é wrapper fino sobre ele, e
o defeito é entregar ao mestre o modo `full`, de **admin**; (2) o **layout de três colunas
com busca por nível e aliases nas opções** (decisão de 2026-08-24, R18) **exige construir**
no pacote, como variante de apresentação. A frase anterior desta seção — "não há nada a
construir" — valia antes dessa decisão e foi corrigida em 2026-08-24.

**Tamanho real do catálogo** (`psql` em produção, 2026-08-24):

| Nível | Nós |
|---|---|
| Sistemas (raiz) | **690** |
| Edições | 393 |
| Variantes | 186 |
| **Total** | **1.269** |
| Sistemas **com** alias cadastrado | 199 (são **409** linhas de alias no total — um sistema pode ter vários) |

**As três causas medidas:**

1. **O modo de apresentação de admin está ligado.** `StepSystem.tsx:57-65` monta o
   `SystemPicker` **sem passar `presentation`**, então cai no default `'full'`
   (`CatalogTree.tsx:325`). Nesse modo, cada nó renderiza `nome PT: —` abaixo do nome
   (`:199-204`) e um badge de aliases (`:206`), e o rodapé exibe o parágrafo *"Cada nível é
   um nó com nome, nome PT e aliases próprios; o caminho selecionado é só a leitura da
   árvore de cima a baixo, não um campo salvo"* (`:546-549`). É vocabulário de curadoria de
   catálogo, exibido a quem só quer dizer em que sistema joga. O modo `'selection'` existe
   exatamente para o usuário final e **nunca foi ligado no formulário** — o
   `CatalogSystemPopover` do catálogo (spec 094) já o usa.
2. **A árvore inteira é baixada e filtrada no cliente.** `CreateTableForm.tsx:126` chama
   `/api/v1/systems?view=tree` puro. Medido: **503.907 bytes (~492 KB)** por abertura do
   formulário. A rota **já aceita `search`/`limit`/`cursor`** e responde em **423 bytes**
   para `?search=vampiro&limit=5` — a busca server-side existe e está desligada.
3. **A busca por apelido funciona e ninguém a alcança.** `nodeMatchesQuery`
   (`CatalogTree.tsx:36-42`) casa nome, `name_pt`, slug, `path_slug` **e alias**, em
   qualquer nível (`subtreeMatchesQuery:48`). E os aliases **chegam populados** — medido na
   resposta real: `"aliases":["The Masquerade","Vampiro","VtM"]`. Isto encerra a pendência
   que o `plan.md` registrava como "conferir se a rota devolve aliases — se vier vazio, a
   busca por apelido morre em silêncio": **não morre, vem populada**. O problema é que, com
   690 raízes e sem busca em evidência, o mestre rola em vez de digitar.

**Fluxo decidido pelo mantenedor (2026-08-24) — progressivo, um nível por vez:**

1. **Sistema é só caixa de busca.** Não lista os 690 nós; o mestre digita e escolhe. É o
   único nível sem lista, porque é o único grande demais para listar.
2. **Ao escolher o sistema, abre a seção de edições — se houver.** Edições **aparecem
   listadas**, e a seção tem **também** caixa de busca para filtrar.
3. **Ao escolher a edição, abre a seção de variantes — se houver.** Mesma regra: lista
   visível mais caixa de busca.
4. **Aliases visíveis: nas OPÇÕES da lista e no nó selecionado** (reversão da D0.5 —
   ver o parágrafo abaixo). Ao selecionar qualquer nível, os aliases daquele nó são mostrados ao
   mestre.** É o que confirma que ele achou o que procurava ("Vampire" mostrando
   *Vampiro · VtM · The Masquerade*).

**"Se houver" é o caso comum, não a exceção** (medido em 2026-08-24): dos **690** sistemas
raiz, só **180 têm edição** — **510 não têm**, isto é, **74%**. Das edições, só **72** têm
variante. Então na maioria das mesas a escolha termina no primeiro nível, e a tela não pode
sugerir que falta preencher algo: seção que não existe **não aparece**, sem espaço vazio nem
rótulo desabilitado.

**Lacuna de backend medida — é o único trabalho de servidor deste gap.** O fluxo pede os
filhos de um nó sob demanda, e isso **não existe hoje**:

- `GET /api/v1/systems` aceita apenas `view`, `search`, `limit`, `cursor`
  (`systems.ts:28-35`) — **não aceita `parent_id`**.
- A busca informa que há filhos mas **não os entrega**: medido em
  `?search=vampire&limit=3` → `"Buffy the Vampire Slayer" has_children: true,
  children_count: 1, children: []`.
- **Não há rota de detalhe**: `GET /api/v1/systems/:id` responde **404** (as únicas rotas do
  arquivo são `/health`, `/`, e três `/admin/*`).

Sem isso, as únicas saídas seriam baixar a árvore inteira de novo (os 492 KB que o gap
existe para eliminar) ou deixar de abrir os níveis. **A correção é aceitar `parent_id` em
`GET /systems`** — parâmetro novo numa rota existente, aditivo e sem migration.

**Aliases já vêm prontos** para o item 4: a resposta traz `aliases` populado em todos os
níveis (medido: `["The Masquerade","Vampiro","VtM"]`), e são **409** cadastrados. Só não são
exibidos ao usuário no modo `selection` — hoje aparecem como badge apenas no modo `full`, de
admin (`CatalogTree.tsx:206`).
**Decisão do mantenedor (2026-08-24), que REVERTE a D0.5 da spec 094:** os aliases aparecem
**nas opções da lista** — não só no nó selecionado. Com 1.269 nós e 409 aliases, distinguir
nomes parecidos vale mais que a economia visual que a D0.5 buscava. Detalhe e consequência
para `presentation="selection"`: R18.

**O resto continua sendo configuração:** `presentation="selection"` e o botão de sugerir
quando a busca não encontra (`canSuggest`, `:398`) já existem no `CatalogTree`. · R14, R18

### Gap 8 — Redundância nos campos de texto grande (medido em 2026-08-23)

Diretriz do mantenedor: *"reduzir redundâncias nos inputs grandes de texto"*. A medição
mostra o tamanho do problema.

**São 9 editores de texto rico, não 7** — e a tabela abaixo tem **10 campos**: os 9 têm
editor no form; **`table_gm_bio` é o 10º campo de texto grande e não tem editor próprio
hoje** (o valor chega pelo fallback do perfil). Daí a diferença entre as duas contagens. O `plan.md` registrava 7
(`MarkdownEditor` "em **7 campos**"); a contagem real é `StepBasic.tsx:34` (descrição) mais
oito no `StepFinal.tsx` (`:179`, `:250`, `:280`, `:290`, `:299`, `:310`, `:343`, `:518`).

**Uso real em produção (107 mesas), por campo** — `ssh faren docker exec mesas-db psql`,
contando só conteúdo com mais de 3 caracteres não-brancos:

| Campo | Limite | Com conteúdo real | Leitura |
|---|---|---|---|
| `description` | 5.000 | **106/107** | o campo que o mestre de fato usa |
| `rules_notes` | 2.000 | 35/107 | dado real, **invisível na página** (medido: nenhum bloco da MesaPage lê o campo) |
| `billing_text` | — | 13/107 | usado quando a mesa é paga |
| `style_text` | 1.000 | 9/107 | concorre com `setting_styles` (aviso anti-confusão no próprio código) |
| `technical_requirements` | 1.000 | 8/107 | concorre com os 3 booleanos de requisito (Gap 2) |
| `synopsis` | 2.000 | **1/107** | o editor grava aqui |
| `listing_excerpt` | — | **1/107** | resumo do card |
| `synopsis_narrative` | 3.000 | **0/107** | a página lê **daqui** (par invertido: o editor gravava `synopsis`, a página lia `synopsis_narrative`) |
| `benefits_text` | 2.000 | **0/107** | editor completo, seção pública sempre vazia |
| `table_gm_bio` | 2.000 | **0/107** | some no R12 (identidade vem do perfil) |

**Quatro dos cinco campos com 0–1 preenchimento em 107 mesas** ocupam editor markdown completo (o quinto, `table_gm_bio`, não tem editor próprio), com
toolbar e contador. Dois deles (`synopsis`/`synopsis_narrative`) são o par invertido do par invertido `synopsis`×`synopsis_narrative`.

**Duplicação literal de rótulo:** `StepFinal.tsx:280` e `:290` renderizam **dois**
`MarkdownEditor` com o mesmo `label="Sinopse narrativa"` e o mesmo
`maxLength={FINAL_TEXT_LIMITS.synopsis[1]}`. Dois campos de mesmo nome na mesma tela — é o
sintoma visível do par de colunas duplicado.

### Decisão do mantenedor (2026-08-23) — o corte, campo a campo

**Esta tabela é a FONTE ÚNICA do corte** — a contagem se lê daqui.
**Nota honesta (4ª auditoria):** a versão anterior desta frase afirmava que os demais pontos
"não repetem a contagem", e isso **era falso** — 4 deles repetiam o "5" (R17, `plan.md`
A17, T4.0m e a pendência do `tasks.md`). Repetição não é proibida; **divergência** é. Os
números conferem hoje, e quem alterar o corte precisa varrer todos os pontos — não confiar
na promessa de fonte única.

De 10 campos de texto grande, ficam **5**. Decidido depois de ver o rótulo de cada um e o
uso medido:

| Campo (rótulo na tela) | Decisão | Consequência |
|---|---|---|
| **Descrição** (`description`) | **fica** | é o campo que funciona (106/107) |
| **Regras e observações da mesa** (`rules_notes`) | **fica, e sobe** — vai para o editor **logo abaixo da Descrição**, não mais no colapsável de avançados | 35/107 já têm conteúdo e ninguém vê; some do fundo do formulário e ganha exibição pública (T7.2b) |
| **Sinopse narrativa** (`synopsis`) | **REMOVIDO** | 1/107 |
| **Sinopse narrativa** (`synopsis_narrative`) | **REMOVIDO** | 0/107 |
| **Descrição do estilo de jogo** (`style_text`) | **REMOVIDO** | 9/107; concorre com `setting_styles`, que vira filtro |
| **Resumo alternativo para listagens** (`listing_excerpt`) | **REMOVIDO** | 1/107; o card já cai em `description.slice(0,120)` |
| **Bio do mestre nesta mesa** (`table_gm_bio`) | **fica, com mecânica nova** — ver R12 | deixa de ser campo vazio e passa a nascer pré-carregado do perfil |
| **Benefícios e diferenciais** (`benefits_text`) | **REMOVIDO** | 0/107; decidido em 2026-08-23 junto com os demais |
| **Texto descritivo sobre cobrança** (`billing_text`) | **fica** | 13/107, condicional a mesa paga |
| **Requisitos técnicos detalhados** (`technical_requirements`) | **fica** | 8/107; o R3 acrescenta a auto-marcação dos booleanos ao lado |

**As duas sinopses saem juntas, e isso resolve o par invertido `synopsis`×`synopsis_narrative`** (o par invertido) por remoção em
vez de rebind: não há mais editor gravando na coluna errada porque não há mais editor.
**T3.2e (rebind para `synopsis_narrative`) fica sem objeto e é cancelada.**

**Consequência pública medida, que precisa de decisão separada** — as duas colunas têm
leitores hoje:

- `tableViewMapper.ts:301` → `narrative: table.synopsis_narrative` → seção **"🎭 História"**
  em `TableContent.tsx:25-30`. Com o campo removido do editor, a seção fica sem fonte nova.
  Como `synopsis_narrative` é **0/107**, a seção já está vazia em 100% das mesas hoje — na
  prática nada regride, mas o bloco morto continua no código.
- `whatsappAnnouncement.ts:376` → `synopsis_narrative || synopsis || description` — o
  fallback já cobre: o WhatsApp passa a usar `description`, sem mudança de comportamento
  para as 106 mesas com descrição.
- `ogDescription.ts:62` (**arquivo novo, não rastreado, da frente OG — não existe em
  `origin/dev`**) → `listing_excerpt || synopsis_narrative || synopsis || description`
  — idem, cai em `description`.

Ou seja: **os três leitores já têm fallback para `description`**, e a remoção não deixa
nenhum buraco em produção.

**Destino das colunas — DECIDIDO (2026-08-23):** os campos **saem do editor**; as colunas
**permanecem no banco**, sem drop. Motivo dado pelo mantenedor: *"vou esperar os usuários
esquecerem para apagar isso"* — retirar o campo da tela primeiro, deixar o dado esfriar, e
só depois remover a coluna. Consequência operacional: **nenhuma migration nesta spec** por
causa do corte, e nada de `manual-risk`. A remoção das colunas vira **débito**, a ser
registrado no destino que o mantenedor nomear, e não é executada aqui.

Colunas que ficam órfãs de editor, para o registro do débito: `synopsis`,
`synopsis_narrative`, `style_text`, `listing_excerpt`, `benefits_text`.

---

## Decisões de escopo tomadas pelo mantenedor

### Entra

| Item | Decisão | Data |
|---|---|---|
| Validação por campo (Gap 5) | Padrão de mercado: borda vermelha ao redor do campo quando o usuário interage e não completa, e ao tentar fechar/salvar sem preencher; mensagens de erro por campo, não só a primeira da etapa | 2026-08-23 |
| Gap 3 | Encerrado por conferência do mantenedor (3 conferências: campo de edição mostra 40). Permanece teste de regressão de exibição (R4) | 2026-08-23 |
| **Modelo da tela (Gap 1)** | **Não é wizard nem onboard: é EDITOR DE ANÚNCIO.** Referência nomeada pelo mantenedor: cadastro de produto em marketplace (Mercado Livre, DMs Guild). Todos os campos são campos abertos, sempre editáveis; edita-se no lugar. Rejeitados explicitamente durante a Fase 2, com protótipo navegável em cada rodada: (a) wizard sequencial, (b) tela única rolável, (c) sidebar com seções paginadas ("onboard com sidebar"), (d) cartões que abrem gaveta/modal ("onboard travestido") | 2026-08-23 |
| **Zero rolagem (Gap 1)** | Nenhuma barra de rolagem em nenhuma parte do editor. "Tem que ser sequencial até caber." O conteúdo é dividido em partes dimensionadas para caber na viewport; a lateral salta entre elas | 2026-08-23 |
| **Criar e editar são a mesma tela** | Não existe "entrar no onboard" para alterar um campo. A diferença entre mesa nova e mesa no ar é só o estado (selo Rascunho/No ar e o rótulo do botão) | 2026-08-23 |
| **Rascunho no backend + autosave** | A mesa nasce `status='draft'` e salva sozinha durante o preenchimento; entra no catálogo só ao publicar. Efeito colateral aprovado junto: o painel do mestre passa a listar mesas não publicadas, distinguidas das no ar | 2026-08-23 |
| **`age_rating`/`table_level` — 41 mesas erradas** | Corrigir daqui pra frente, **sem tocar nas 41**. As existentes se corrigem quando o mestre editar. Sem backfill: não há de onde inferir a escolha original (o dado nunca chegou ao banco), e chutar faixa etária é chutar sobre conteúdo adulto | 2026-08-23 |
| **Parser sinaliza, nunca barra** | Campo preenchido por parser ou herança fica marcado visualmente, e as ambiguidades são exibidas — mas publicar **nunca** é bloqueado por isso | 2026-08-23 |
| **Larguras e agrupamento** | Largura de cada campo corresponde ao tamanho da resposta esperada (Baymard); campos do mesmo assunto agrupados por proximidade (NN/g). Proibido esticar campo curto pela largura da tela | 2026-08-23 |
| **Título da mesa ganha espaço maior** | O campo de título recebe largura ampla, acima do que a régua de conteúdo daria — é o nome que o jogador lê primeiro, e o mestre precisa ver o título inteiro enquanto escreve. **Não contradiz Baymard:** a régua diz que a largura acompanha a resposta esperada, e a resposta esperada aqui é longa. Medido em 2026-08-24: o maior título real tem **84** caracteres (média 24); o front corta em **100** (`validation.ts:43`) enquanto o backend aceita **200** (`tableValidators.ts:138`) e a coluna é `text`, sem limite — **resolvido por investigação em 2026-08-24: o front sobe para 200.** O backend já aceita 200 (`tableValidators.ts:138`) e a coluna é `text` sem limite; **baixar o backend quebraria as mesas importadas do Discord**, que não passam pelo front. O maior título real tem 84 caracteres, então subir não muda nada na prática — só remove a barreira que existia só de um lado. Nenhum consumidor quebra: o card já trunca por `line-clamp-3` (`TableCard.tsx:385`) e o og não impõe limite. Regra de origem: `plan.md` §Regras de validação | 2026-08-24 |
| **Identidade do mestre: herda do perfil, edita vira sobrescrita** (**substitui a decisão anterior**) | Bio, nickname e contatos chegam **pré-preenchidos** do perfil de mestre (`gm_profiles.bio_long`/`nickname`/`contact_methods`). Não mexeu → a mesa espelha o perfil. Mexeu → vira valor **daquela mesa**, e o **perfil não é alterado**. É auto-preenchimento para permitir personalização, não escrita cruzada. A versão anterior desta linha dizia "editar grava no perfil real" — foi substituída pelo mantenedor. Detalhe e cadeia medida: R12 | 2026-08-23 |
| **Corte dos campos de texto** | Removidos: as duas "Sinopse narrativa", "Descrição do estilo de jogo", "Resumo alternativo para listagens" e "Benefícios e diferenciais". "Regras e observações da mesa" **sobe para logo abaixo da Descrição**. **Contagem e tabela campo a campo: §Gap 8 (fonte única — não repetir o número aqui)** | 2026-08-23 |

### Entra — decisões de 2026-08-24 (segunda rodada)

A tabela acima cobre 2026-08-23. Estas vieram depois, e ficavam espalhadas pelos gaps até a
auditoria apontar que não havia índice único (auditoria da 2ª rodada).

| Item | Decisão | Onde detalha |
|---|---|---|
| Corte dos campos de texto | Saem as duas sinopses, `style_text`, `listing_excerpt` e `benefits_text`; regras sobem para baixo da descrição. **Contagem: §Gap 8, fonte única** | §Gap 8, R17 |
| Colunas dos campos cortados | **Ficam no banco** — só a UI sai; remoção vira débito | §Gap 8, T7.3b |
| Identidade do mestre | Herda do perfil; **editar vira valor da mesa, perfil intacto**; botão "Sincronizar com o Perfil Principal de Mestre" | R12 |
| Contatos | Puxa **todos** do perfil; ordenar por **setas ↑↓** (arrastar revogado); **um** componente serve perfil e mesa, com os 7 canais | R12, T4.0r |
| Faixa etária | **Recomendado**, não obrigatório | R6.1 |
| DDAL | D&D 5e **2014 ou 2024** | A14, T4.0b |
| Seleção de sistema | **Progressiva**: sistema só busca → edição se houver → variante se houver; aliases do nó visíveis | §Gap 9, R18 |
| Banner | **Abaixo do título**, com as 13 capacidades e legenda de proporção/formato/peso | §Gap 10, R19 |
| Horários | **Um só**, mais "horário personalizado"; "Vagas por sessão" sai; card exibe "Horário Personalizado" | §Gap 10, R20 |
| Requisitos e valores | Requisitos em lista junto da plataforma; valores todos numa parte | §Gap 10, R21 |
| Título da mesa | Campo com largura ampla; **limite do front sobe para 200** (alinha ao backend) | §Entra (2026-08-23), T4.0e |
| Rascunho no backend: alcance | **Segue o mestre entre máquinas, sem prazo** — começou no computador, termina no celular. A mesa `draft` fica no painel dele até publicar ou apagar; o rascunho local (7 dias) vira cache de digitação, e o do servidor é o que vale | R10, T4.7 |
| Faixa etária na página pública | **Exibir na página e no card** — as **57 mesas importadas** já têm faixa real (+14/+16/+18) e nenhuma aparece hoje; passam a exibir sem nenhum mestre editar nada | R24, A27 |
| Publicar com pendências | **Nada é salvo** — o clique marca os campos que faltam e leva o foco ao primeiro; a mesa continua como está | A4, T4.6 |
| Perfil de mestre inexistente | **Cria-se dentro do editor, na hora** — o mestre preenche nickname/bio/contatos na parte "Mestre e contato" e o perfil nasce junto com a mesa; acaba o pré-requisito separado do painel | R12, **T4.0p2** |
| Contatos: 7 canais nos dois lados | **O perfil passa a aceitar os 7** (hoje 4). Toca validação, serialização (que descarta em silêncio) e a exibição pública do perfil | R12, T4.0r |
| Notificações | **Unificar no accounts**, e **a migração entra nesta spec** (Fase 7): criar `POST` no accounts (hoje só `GET`/`PATCH`), apontar os **6 escritores** do mesas, migrar as **66** notificações e remover as 3 rotas de leitura órfãs. O `NotificationBell` já lê por `source_app` | T7.4b |
| Agrupamento em 7 partes | **APROVADO** com o artefato de validação à vista: Identidade · Quando joga · Onde joga · Valores · Para quem é · Mestre e contato · Regras e extras. A assimetria é aceita ("'Para quem é' tem 6 campos; 'Regras e extras' tem 12, está ok") — os 12 incluem o bloco DDAL, que só aparece em D&D 5e | R1, R2 |
| Prévia e "Ver como jogador" | **Informação útil** — prévia do card na lateral usando o `TableCardComponent` real, mais o modo "Ver como jogador" | R22, T4.2b |
| "Horário personalizado" | Grava por `schedule_day_status='to_define'` + texto em `table_schedules.notes` — contrato existente, sem coluna nova | §Gap 10, R20 |
| Pacotes compartilhados | **Autorizado tocar** `packages/*` no escopo da spec | §Autorização de escopo |
| Domínios de concorrente | `mesaquest.com.br` e `startplaying.games` recusados como `contact_url` | fora desta spec (parser Discord) |

### Fica fora (decidido, não esquecido)

| Item | Motivo |
|---|---|
| Wizard / etapas sequenciais em qualquer forma | Decisão do mantenedor (2026-08-23): é anúncio, não cadastro guiado. Nenhuma variante de "seção que destrava" volta ao escopo |
| Gaveta, modal ou painel lateral para editar campo | Decisão do mantenedor (2026-08-23): "clicar em algo para editar é um onboard travestido" — edição é no local |
| Rolagem como recurso de layout | Decisão do mantenedor (2026-08-23): mata a experiência. Conteúdo que não cabe vira outra parte |

---

## Requisitos (consolidados na Fase 2 em 2026-08-23; R6.1 e **R18-R24** vieram de 2026-08-24; **R16-R17**, da Fase 2 (2026-08-23))

- **R1:** Criar mesa acontece num **editor de anúncio**: todos os campos são campos
  abertos e sempre editáveis, editados no lugar. **Sem wizard, sem etapa que destrava,
  sem gaveta/modal e sem rolagem** — o conteúdo é dividido em partes que cabem na
  viewport, e a lateral salta entre elas sem travar nenhuma.
- **R2:** Editar mesa usa **a mesma tela** da criação, sem passar por fluxo nenhum:
  alterar um campo de mesa no ar são dois cliques (a parte na lateral, e o campo).
  A diferença entre criar e editar é só o estado (selo, rótulo do botão).
- **R3:** Plataforma e requisitos derivados (computador, microfone, câmera) ficam na
  **mesma parte** do editor. Escolher o VTT/comunicação auto-marca os requisitos
  correspondentes (exemplos: Discord e Teams → microfone; VTT desktop → PC; Meet/Zoom → microfone e câmera — semente completa em `plan.md` §Regras VTT)
  e **explica o porquê ao lado do requisito**; o mestre pode desmarcar.
- **R4:** Preços: valor avulso e valor mensal exibem exatamente o valor digitado, com
  teste de regressão fixando o caso 55/40 → "R$ 55" / "R$ 40 / sessão" e economia só como
  percentual. (Gap 3 encerrado por conferência do mantenedor — sintoma não reproduz; o
  teste fixa o comportamento correto já presente.)
- **R5:** Parser de anúncio: todo dado presente no texto colado é capturado e pré-preenche
  os campos correspondentes (sistema, dia/horário, vagas, plataforma, faixa etária,
  valores, etc.). Campo preenchido pelo parser é **visualmente distinto** e diz de onde
  veio; as ambiguidades já calculadas pelo backend são **exibidas** ao mestre.
  **Publicar nunca é bloqueado por isso** (decisão 2026-08-23).
- **R6.1 (decisão do mantenedor, 2026-08-24):** **Faixa etária é RECOMENDADO, não
  obrigatório.** Hoje o rótulo tem asterisco (`StepConfig.tsx:334`, "Faixa Etária *") sem
  validação por trás — o select tem default `'livre'` e nunca falha, então o asterisco já era
  decorativo. No editor novo o campo passa a **recomendado**, com a frase do ganho (**redação do
  implementador**, no padrão do R6 — T4.0s), e
  publicar **não** é bloqueado por ele. Isso mantém o A11 coerente (nenhuma marca sem
  validação correspondente) e ataca a causa real do dado errado: o que faz mesa +18 aparecer
  como "livre" é o payload descartar `age_rating` (T3.2/A5), não a falta de obrigatoriedade.
- **R6:** Três níveis de campo, todos marcados: **obrigatório** (marca + palavra),
  **recomendado** (marca + a frase que diz o ganho: "mesas com banner aparecem em
  destaque") e **opcional**. Validação **por campo**, disparada quando o campo perde o
  foco — nunca a cada tecla — e ao tentar publicar; mensagem própria por campo, não só a
  primeira do formulário.
- **R7:** Nenhuma capacidade já existente no backend é perdida: cada endpoint/campo
  existente é consumido pelo novo editor ou explicitamente descartado com registro no
  levantamento. Inclui ligar o que já existe e está desligado (catálogos e aliases no
  parse-preview, herança do perfil GM, sugestão de sistema/cenário).
- **R8:** Redundâncias identificadas são removidas (campos duplicados, perguntas
  repetidas), com registro do que foi removido e por quê.
- **R9 (Fase 2 — reclassificado em 2026-08-23):** `<select>` legível nos dois temas em todos
  os apps. **Já satisfeito pelo contrato de `packages/ui/src/styles.css:1008-1058`**
  (commit `3ae4f6b`, 2026-08-17) — ver §Gap 7. O requisito passa a ser **não regredir**: o
  editor novo **não** redefine `color-scheme` nem cor de `<option>` localmente, e usa
  `Select` de `ui/primitives` em vez de `<select>` cru. Resta apenas A10 (conferência visual
  do menu aberto, pelo mantenedor).
- **R10 (Fase 2, corrigido):** Rascunho e autosave **já existem** em `localStorage`
  (`useAutosave` + `draftStorage`, versionado, com expiração de 7 dias e modal de
  restauração). O requisito é **preservar tudo isso** e promover ao backend:
  mesa nasce `status='draft'`, entra no catálogo só ao publicar, e o painel do mestre
  distingue rascunho de mesa no ar. Nada do comportamento local pode regredir.
- **R13 (novo, Fase 2):** **O editor consome os pacotes compartilhados, não os
  reimplementa.** Seleção de sistema usa `CatalogTree`/`CatalogSystemPopover` com
  `presentation="selection"`; **a FORMA da navegação é a de R18** — três colunas lado a
  lado (Sistema · Edição · Variante), cada uma com busca própria, progressivas (a coluna
  seguinte só existe se houver filho). **O componente hoje empilha os níveis e tem uma busca
  só**, então esta é a parte que exige trabalho no pacote. O que permanece de pé neste
  requisito: **nunca lista plana** de 1.269 nós num `<select>`, e o componente é **estendido,
  não substituído** — os outros consumidores (`CatalogExplorer`, admin, popover) mantêm o
  layout atual.
  Controles usam `ui/primitives` (`Field`, `TextInput`, `Select`, `Modal`, `Drawer`,
  `Banner`, estados), confirmação usa `useConfirm`, upload por arrastar usa `FileDropzone`.
  Lista completa em `plan.md` §Auditoria dos 15 pacotes.
- **R14 (Fase 2 — absorvido por R18 em 2026-08-24):** os três pontos deste requisito
  (busca por alias em qualquer nível, busca **server-side** em vez da árvore inteira, e
  sugerir aparecendo quando a busca não encontra) estão **detalhados e medidos em R18**, que
  é a versão vigente. Mantido como entrada do índice para não parecer esquecido; **implementar
  por R18/§Gap 9/A21**, não por aqui.
- **R15 (novo, Fase 2):** **O editor é instrumentado.** Hoje o fluxo de criação não emite
  **nenhum** evento (medido: zero ocorrências de analytics em `features/create-table` e
  `components/form-steps`), enquanto catálogo e página da mesa emitem. O editor nasce com
  evento de início, publicação, abandono e uso do parser, via `@artificio/analytics`.
- **R12 (Fase 2 — mecânica REESCRITA pelo mantenedor em 2026-08-23):** **A identidade do
  mestre nasce pré-carregada do perfil e vira sobrescrita quando editada.** O modelo
  anterior deste requisito dizia "editar no editor grava no perfil, sem cópia por mesa" —
  **isso foi substituído**. A mecânica decidida é a inversa e mais simples:

  1. Ao abrir o editor, **bio, contatos e nickname chegam preenchidos** com o que o mestre
     tem no perfil de mestre. Não se redigita o que o sistema já sabe.
  2. Se o mestre **não mexer**, a mesa continua espelhando o perfil — e o que ele mudar no
     perfil depois reflete no anúncio.
  3. Se o mestre **editar ali**, o valor vira **específico daquela mesa**. O perfil não é
     alterado. É auto-preenchimento para permitir personalização, não escrita cruzada.

  **Fonte medida — o par correto é o do perfil de MESTRE (`gm_profiles`), não o do usuário.**
  A cadeia de exibição já existe e é essa:

  | Campo | Fonte da herança | Sobrescrita por mesa | Como a página já resolve |
  |---|---|---|---|
  | Bio | `gm_profiles.bio_long` (**29/39 mestres**) | `tables.table_gm_bio` (**0/107**) | `tableViewMapper.ts:278`: `table_gm_bio ?? gm_bio_long` |
  | Nome/nickname | `gm_profiles.nickname` (**34/39**) | `tables.master_display_name` (**6/107**) | `tableViewMapper.ts:273` + `tables.ts:158,637`: `COALESCE(gm.nickname, p.display_name)` |
  | Contatos | `gm_profiles.contact_methods` (**15/39**) | tabela `table_contacts` (121 linhas / 107 mesas) | **não há herança** — ver abaixo |

  **O fallback de bio e nome JÁ FUNCIONA na página pública** (`tableViewMapper.ts:277-278`
  tem inclusive o comentário: *"Prioridade: table_gm_bio (bio específica desta mesa) >
  gm_bio_long (bio global do perfil)"*). O que falta é o **editor** pré-carregar — hoje ele
  abre os três campos vazios e o mestre redigita.

  **Contatos é o elo quebrado, e o único que exige trabalho de verdade.** São duas cadeias
  paralelas que nunca se falam: o perfil grava `gm_profiles.contact_methods` (JSONB, editado
  em `PainelMestrePage.tsx:780-782` via `PUT /gm/profile`), a mesa grava a tabela
  `table_contacts` (editada pelo `ContactsFormBlock`), e a página pública exibe **só** os da
  mesa (`tableViewMapper.ts:338`). Medição: `grep contact_methods` no fluxo de criação →
  **zero ocorrências**.

  Os formatos são compatíveis — `{channel, value, label, discord_server_url}` nos dois lados
  —, com uma diferença de alcance: o perfil aceita **4 canais**
  (`whatsapp`/`email`/`discord`/`form`), a mesa aceita **7** (mais `phone`, `facebook`,
  `instagram`). **Hoje** o perfil é **subconjunto** da mesa, então herdar perfil → mesa é
  direto — mas **T4.0r amplia o perfil para os mesmos 7** (decisão de 2026-08-24, §"Os 7
  canais valem nos dois lados"), e a partir daí as listas são idênticas.

  **Detalhamento decidido pelo mantenedor (2026-08-24):**

  - **Contatos: puxa TODOS os do perfil**, e o mestre pode **remover** os que não quiser e
    **adicionar** novos ali. Não é seleção parcial nem botão opcional — chegam preenchidos.
    O que ele mexer vale só para aquela mesa.
  - **O bloco de contatos do editor reaproveita 100% a estrutura do perfil**
    (`components/mestre/ContactMethodsEditor.tsx`, 304 linhas), **não** a do formulário atual
    de mesa (`ContactsFormBlock.tsx`, 162). Decisão do mantenedor em 2026-08-24: *"a parte
    dos contatos tem que reaproveitar 100% a estrutura de produto do onboarding, pois hoje
    ela é muito boa."* Medida a diferença — o do perfil tem três coisas que o da mesa não
    tem:

    | Recurso | Perfil (`ContactMethodsEditor`) | Mesa (`ContactsFormBlock`) |
    |---|---|---|
    | Ícone por canal | sim — `MessageCircle`/`Mail`/`Hash`/`ExternalLink` (`:26-46`) | não |
    | **Reordenar ↑↓** | sim (`moveUp :72`, `moveDown :79`) | **não** |
    | Adicionar escolhendo o canal | sim, menu com ícone por canal (`:261-267`) | botão genérico "Adicionar canal" |
    | Remover | sim (`:62`) | sim (`:48`) |

    **A reordenação não é cosmética:** a página pública exibe os contatos ordenados por
    `sort_order` (`tableViewMapper.ts:39-40`; `tables.ts:316` já faz `orderBy`), ou seja, o
    ↑↓ decide **qual canal o jogador vê primeiro**. O formulário de mesa nunca deu esse
    controle ao mestre, embora o backend sempre o tenha respeitado.

    **"100%" quer dizer a mecânica inteira** (mantenedor, 2026-08-24): ordenação dos
    elementos, a forma de inserir, e **todos os canais possíveis**. Três consequências,
    todas medidas:

    1. **Ordenar é por SETAS ↑↓, sem arrastar** (mantenedor, 2026-08-24: *"pode revogar o
       arrastar e deixar só as setas que tem que clicar para subir e descer"*). É o que o
       editor do perfil já faz (`moveUp:72`/`moveDown:79`), então não há capacidade nova a
       construir — e o caminho de teclado sai de graça, sem depender de um gesto de mouse.
    2. **O backend aceita os 7 para MESA, mas restringe o PERFIL a 4** (medição corrigida em
       2026-08-24 — a versão anterior deste item dizia que "quem limita é só o front", e era
       falsa). `tableValidators.ts:21` define `CONTACT_CHANNELS` com os 7 e vale para a
       **mesa**; para o **perfil** vale `PROFILE_CONTACT_CHANNELS` (`contactUrls.ts:25`, só
       4), aplicado na validação (`tableValidators.ts:87`) **e** na serialização de saída
       (`contactSerializer.ts:60`, que descarta em silêncio). Somado ao componente de
       exibição com 4 canais hardcoded, são **três** pontos a ampliar — **é**, sim, mudança
       de contrato do perfil.
    3. **O tipo está triplicado.** `ContactChannel` aparece com 4 valores em
       `ContactMethodsEditor.tsx:10` **e** em `MestreContactMethods.tsx:11`, enquanto
       `types/tables.ts:8` tem `TableContactChannel` com os 7 corretos. Consolidar num tipo
       só, alinhado ao `CONTACT_CHANNELS` do backend, faz parte do trabalho.

    **O painel do mestre ganha as mesmas capacidades** (decisão do mantenedor: *"se o painel
    do mestre não tem, tem que adicionar também"*). Não é o editor de mesa que copia um
    componente melhor: é **um componente só**, com os 7 canais e a ordenação por setas ↑↓,
    servindo o
    perfil e a mesa (§Regras Gerais de Código → compartilhado por padrão). Consequência a
    conferir: a validação de `PUT /gm/profile` precisa aceitar de fato os 7 canais no perfil
    — o enum é compartilhado, mas não medi se há restrição adicional nessa rota.
  - **Nickname: mantém o campo na mesa**, com a mesma mecânica (pré-preenchido do perfil,
    editável como sobrescrita). Medido: dos 6 `master_display_name` em uso, **5 são
    idênticos** ao perfil (redigitação redundante que a herança elimina) e **1 difere de
    fato** — é esse caso que justifica o campo continuar existindo.
  - **Sinalização: não precisa de marca de origem.** O campo chegar preenchido já comunica
    que veio do perfil. O que **precisa existir** é um botão com o texto exato
    **"Sincronizar com o Perfil Principal de Mestre"** (definido pelo mantenedor em
    2026-08-24 — não parafrasear), que aparece quando o mestre editou um campo herdado.

  **O botão de sincronizar é o que fecha as três escolhas de produto**, e é por isso que ele
  não é um detalhe de UI:

  | O mestre quer | Como consegue |
  |---|---|
  | Manter o que vem do perfil | não faz nada — o campo já veio preenchido |
  | Personalizar só nesta mesa | edita o campo; vira valor da mesa, perfil intacto |
  | Promover o que escreveu para o perfil | clica em **"Sincronizar com o Perfil Principal de Mestre"** |

  A terceira linha é a **única escrita perfil←mesa de toda a mecânica**, e é sempre
  deliberada: nunca acontece por efeito colateral de editar. Isso preserva a regra do R12
  (editar no editor não altera o perfil) e ainda assim dá saída para o mestre que escreveu
  uma bio melhor no anúncio e quer adotá-la como a sua.

  **Os 7 canais valem nos dois lados — decisão do mantenedor, 2026-08-24.** Hoje o perfil
  aceita 4 (WhatsApp, e-mail, Discord, formulário) e a mesa 7 (mais telefone, Facebook,
  Instagram). A ampliação toca **três** pontos, e o terceiro é o que passa despercebido:

  | Ponto | Arquivo | O que faz hoje |
  |---|---|---|
  | Validação de entrada | `tableValidators.ts:87` | **rejeita** canal fora de `PROFILE_CONTACT_CHANNELS` |
  | Serialização de saída | `contactSerializer.ts:60` | **descarta em silêncio** — sem erro, o dado some na leitura |
  | Exibição pública | `MestreContactMethods.tsx:27-52` | 4 canais **hardcoded** com ícone e rótulo |

  O `PROFILE_CONTACT_CHANNELS` vive em `contactUrls.ts:25` e é consumido pelos dois
  primeiros. **Sem o terceiro, o canal novo entra, é salvo e não aparece na página do
  mestre** — falha silenciosa, do mesmo tipo que o §Gap 6 cataloga.

  **Cadeia completa, para referência da implementação:**
  entrada `ContactMethodsEditor` → `PUT /gm/profile` (`PainelMestrePage.tsx:782`) →
  `gm_profiles.contact_methods` (JSONB, 15/39) → saída `gm.ts:389` / `gmPanel.ts:518` →
  exibição `MestreContactMethods` na página do mestre.
  Do lado da mesa: `ContactsFormBlock` → `table_contacts` (121 linhas) →
  `TableContactsBlock` na página da mesa.

  **Anunciante:** quando o publicador não é o mestre, não há perfil de onde herdar — o
  repeater de contatos entra vazio, como hoje.
- **R24 (novo, 2026-08-24 — decisão do mantenedor):** **Faixa etária aparece para o
  jogador.** Medido: `age_rating` é coletado no form, descartado no payload (T3.2) **e nunca
  exibido** — enquanto **57 mesas importadas** do Discord têm faixa real gravada
  (+14: 2, +16: 13, +18: 42) e a página pública mostra **nenhuma**. Corrigir só o payload
  (A5) deixaria essas 57 invisíveis do mesmo jeito. Então: **exibir na página da mesa e no
  card do catálogo**, o que corrige as 57 sem nenhum mestre tocar em nada. As 41 manuais com
  `'livre'` errado só corrigem quando o mestre editar — mas aí ele vê o campo na tela e
  percebe. Toca `features/table` e `features/catalog`, fora do editor (exceção nomeada em
  §Fora de escopo). · A27
- **R23 (novo, 2026-08-24 — decisão do mantenedor):** **Segurança de mesa entra no editor;
  local só em **modalidade não-online** (presencial ou híbrida).** Detalhe e medição em §Gap 11.
  - **`content_warnings` e `safety_tools` ganham campo**, oferecendo os **14 termos do
    glossário curado** (`safetyToolsGlossary.ts`: 6 ferramentas, 8 avisos) como opções, com
    entrada livre para o que faltar. Não é campo de texto aberto: as colunas são `text[]` sem
    enum e o glossário casa por chave normalizada, então texto livre perderia a descrição que
    a página pública mostra ao jogador.
  - **`city`/`state` aparecem só quando a modalidade não for online** — medido: **107/107
    mesas são online**, e o form já tem o precedente (VTT e comunicação só em online/híbrida).
  - **`custom_scenario`, `style_tags` e `features` são descartados** — sem validator, sem
    leitor, sem dado; `style_tags` ainda duplica `setting_styles`, que tem 54 mesas e vira
    filtro.
  - **Nada disso exige backend novo:** validator, mapper e exibição já existem para os quatro
    do Grupo 2 — falta a entrada. · A26
- **R22 (novo, 2026-08-24 — decisão do mantenedor):** **O mestre vê o que está publicando,
  sem sair do editor.** Dois níveis, ambos considerados informação útil e não decoração:
  - **Prévia do card na lateral** — como a mesa aparece no catálogo, ao lado das partes.
    Ocupa o espaço vazio da lateral com o que responde à pergunta que o mestre tem enquanto
    preenche: *"como isso vai aparecer?"*.
  - **"Ver como jogador"** — a página da mesa como o público a vê.

  **Reuso obrigatório, não componente novo** (R16): a prévia usa o **`TableCardComponent`
  real** (`components/TableCard.tsx:271`), que já recebe um único objeto `TableCard`
  (`types/tables.ts:34`) — o editor monta esse objeto a partir do próprio estado, com os
  mesmos mappers do payload. Prévia desenhada à mão divergiria do card verdadeiro no
  primeiro ajuste de layout, que é o defeito que ela existe para evitar.
  **Consequência de contrato:** a prévia é o primeiro consumidor do estado do editor no
  formato de leitura, então expõe cedo qualquer descompasso entre o que o editor guarda e o
  que o catálogo lê — vale como verificação, não só como conforto. · A25
- **R19 (novo, 2026-08-24):** **O banner fica logo abaixo do título**, e o **sistema de
  imagem migra inteiro** — as 13 capacidades tabeladas em §Gap 10, item 2. Upload local e
  por URL, importação de link externo com "Manter link direto", editor de recorte, crop não
  destrutivo, "Ajustar enquadramento" sem reenviar, invalidação de crop ao trocar de imagem,
  validação por `kind`, prévia com placeholder, remover, alvo de toque de 44px e `aria-live`.
  Feature ausente = task reaberta (R11).
  **Mais uma capacidade nova:** o campo **diz ao mestre o que se espera da imagem** antes do
  envio — proporção **1200 × 650**, formatos **JPG/PNG/WEBP**, limite de **5 MB** —, com os
  valores lidos do `imageKindSpec`, nunca escritos à mão. Hoje a UI só informa formato e
  peso (`ImageUploader.tsx:191`) e **omite a proporção**, que é o que decide o
  enquadramento. Sem inventar regra: não há mínimo no contrato, e `maxDimension` reduz em
  vez de rejeitar (§Gap 10, item 2b). · A22
- **R20 (novo, 2026-08-24):** **Uma configuração de horário, mais "horário personalizado".**
  O repeater de N horários sai (medido: **0 mesas** com 2+ em produção). A opção
  "horário personalizado" abre campo livre para o mestre explicar a agenda, e **os cards do
  catálogo exibem "Horário Personalizado"** nesse caso. **"Vagas por sessão" é removido** —
  redundante com vagas totais e abertas, e preenchido em só **3 de 90** schedules. · A23
- **R21 (novo, 2026-08-24):** **Requisitos técnicos em lista de checkboxes, na parte da
  plataforma**; e **os campos de valores reunidos numa parte só**, na ordem da decisão
  (cobrança → valores → doação → sessão zero → detalhes). Hoje os requisitos são checkbox
  mas ficam a duas etapas do VTT que os determina, e os valores estão repartidos entre
  `StepConfig` e `StepFinal` (§Gap 10, itens 5 e 6). · A24
- **R18 (2026-08-24 — diretriz do mantenedor):** **A seleção de sistema é feita em três
  colunas com busca por nível.** Medições e causas em §Gap 9.
  - **Layout:** Sistema · Edição · Variante **lado a lado**, cada coluna com **caixa de busca
    própria**, e o caminho escolhido ("Vampire › 5ª Edição") sempre visível.
  - **Sistema é só busca** — 690 nós na raiz, grande demais para listar. **Edição** e
    **Variante** mostram as opções **e** filtram pela busca da própria coluna.
  - **Coluna sem filho não aparece** — medido: **510 dos 690** sistemas não têm edição (74%);
    só **72** edições têm variante. Parar no primeiro nível é o caso comum, e a tela não pode
    sugerir que falta preencher algo.
  - **Aliases aparecem NAS OPÇÕES da lista**, não só no nó escolhido. **Isto reverte a D0.5
    da spec 094** (`CatalogTree.tsx:25-32`), que os suprimia em `selection` por poluição
    visual: com 1.269 nós e 409 aliases, distinguir nomes parecidos vale mais.
    `presentation="selection"` passa a suprimir **só** "nome PT" e o parágrafo técnico.
    **Alcance decidido (2026-08-24): vale nos DOIS consumidores** — editor e
    `CatalogSystemPopover` do catálogo público. Uma regra só: onde houver seleção de
    sistema, os aliases aparecem. A D0.5 os suprimia no catálogo por poluição visual; a
    decisão a substitui, e o filtro do catálogo passa a mostrar "Vampiro · VtM" ao lado de
    "Vampire".
  - **Busca server-side** (`search`/`limit`/`cursor`/`parent_id`) no lugar dos ~492 KB da
    árvore inteira; sugerir aparece quando a busca não encontra, com o termo digitado,
    ligando no `SystemSuggestionModal` existente.
  - **O pacote É tocado, mas nada é substituído:** o layout de três colunas entra como
    **variante de apresentação** do `CatalogTree`; `CatalogExplorer`, admin, popover e
    `DraftEditorTab` **mantêm o empilhamento atual**. O comportamento de busca-primeiro e os
    níveis progressivos **já existem** no componente (`:355`, `:78-91`, `:398-478`) — o novo
    é o layout, os aliases nas opções e a ligação server-side.
  - **Mudança de backend (a única deste gap):** `GET /systems` aceita `parent_id`, para
    entregar os filhos de um nó sob demanda — hoje a busca diz `has_children: true` e devolve
    `children: []`, e `GET /systems/:id` não existe (404). Aditivo, sem migration.
  - **O catálogo é CENTRAL nos dois sentidos, e a spec não pode quebrar isso:** o `mesas`
    **lê** o central em produção (`systemCatalogProvider.ts:49`) e o admin **escreve** nele
    (`catalogFetch('/api/admin/v1/catalog/nodes', POST)`, servido pelo `site-admin`) — o que
    é inserido num app, os outros consomem. Logo: (a) o `parent_id` tem de funcionar na fonte
    **central e na projeção local**, senão quebra no ambiente não testado; (b) sugestão
    aprovada escreve no **central**. Detalhe: `plan.md` §Catálogo central. · A21
- **R16 (novo, 2026-08-23 — diretriz do mantenedor):** **O editor é construído sobre os
  pacotes compartilhados, e o padrão é o pacote.** Medido: o fluxo de criação inteiro
  (4.117 linhas) importa **zero** de `@artificio/ui` —
  `grep -rn "@artificio/ui" features/create-table components/form-steps` → nenhuma
  ocorrência —, enquanto o pacote exporta **16 primitives**
  (`packages/ui/src/primitives.tsx:44-510`). Comparação entre apps: `downloads` importa
  `@artificio/ui` em 13 arquivos e usa `Select` do pacote em 10; o `mesas` tem `<select>`
  cru em **23** arquivos. O editor novo usa `Field`, `TextInput`, `Textarea`, `Select`,
  `Button`, `Panel`, `Modal`, `Drawer`, `Badge`, `Banner` e os quatro estados
  (`Loading`/`Empty`/`Error`/`Success`) do pacote; controle cru só com comentário inline
  dizendo por que o primitive não serve. · A16
- **R17 (2026-08-23 — decidido campo a campo pelo mantenedor):** **De 10 campos de texto
  grande, ficam 5.** Saem: as **duas** "Sinopse narrativa" (`synopsis` 1/107 e
  `synopsis_narrative` 0/107), "Descrição do estilo de jogo" (`style_text` 9/107), "Resumo
  alternativo para listagens" (`listing_excerpt` 1/107) e "Benefícios e diferenciais"
  (`benefits_text` 0/107). **"Regras e observações da mesa" sobe para logo abaixo da
  Descrição**, saindo do colapsável de avançados. **As colunas ficam no banco** — remoção é
  débito posterior, não trabalho desta spec. Tabela completa e consequência nos leitores
  públicos: §Gap 8. · A17
- **R11 (novo, Fase 2):** **Nenhuma capacidade do fluxo atual é perdida.** A tabela de
  paridade do `plan.md` §Frontend — paridade de features é contratual: cada linha migra ou
  é descartada com autorização nominal. Inclui o que é fácil de perder de vista —
  Covil **restrito a admin**, DDAL condicionado a D&D 5e (2014 **ou** 2024) com seus 9 campos, contatos
  como repeater de 7 canais, banner com crop, árvore hierárquica de sistemas com sugestão,
  aviso ao fechar a aba, `aria-live` do parser.

---

## Critérios de aceite

Objetivos (verificáveis por teste ou medição):

| # | Critério | Como se mede |
|---|---|---|
| A1 | Nenhum elemento do editor produz barra de rolagem, em nenhuma parte, a 1366×768 e 1920×1080 | `scrollHeight <= clientHeight` em `body`, no container do documento e em cada parte · R1 |
| A2 | Controles de uma mesma linha começam na mesma altura | diferença de `getBoundingClientRect().top` entre controles da linha **= 0px** em todas as partes (medido no protótipo: era até 26px) · R1 |
| A3 | Alterar um campo de mesa publicada não passa por etapa nenhuma | caminho de 2 interações: parte na lateral + campo. Nenhuma chamada a "continuar"/"avançar" no código do editor · R2 |
| A4 | Publicar com campos faltando **revela** o que falta | o botão não fica inerte: marca todos os obrigatórios vazios, leva o foco ao primeiro e lista as partes pendentes · R6 |
| A5 | `age_rating` e `table_level` chegam ao banco | criar/editar mesa com "+18"/"avançado" e ler a linha em `tables` — valor igual ao escolhido, não o default · R7 |
| A6 | Mesa Covil não é desmarcada ao editar | editar uma mesa `is_covil=true` sem tocar no campo → continua `true` · R2 |
| A7 | Múltiplos horários sobrevivem à edição (o dado, não a UI) | mesa com 2+ `table_schedules`, editar outro campo → contagem preservada · R2 |
| A8 | Preço 55/40 exibe "R$ 55" e "R$ 40 / sessão", economia só como % | teste de regressão em `TableActionPanel.test.tsx` · R4 |
| A9 | Parser: as 8 falhas do **`plan.md` §Gap 4** cobertas por fixture (o §Gap 4 do `spec.md` não as enumera) | teste por falha, com o texto de entrada e o campo esperado · R5 |
| A10 | `<select>` legível nos dois temas, **sem redefinição local** | contrato já vive em `packages/ui/src/styles.css:1008-1058`; medir `getComputedStyle` nos dois temas **+** grep provando zero `color-scheme`/`select option` no CSS do editor; validação visual do menu **aberto** pelo mantenedor · R9 |
| A11 | Nenhum campo obrigatório sem marca, nenhuma marca sem validação | cruzar a lista de `data-ob` com as regras de `validation.ts` — os dois conjuntos idênticos · R6 |
| A12 | **Paridade de features**: cada linha da tabela do `plan.md` presente no editor | checklist item a item no gate da Fase 4; feature ausente = task reaberta · R11 |
| A13 | Covil continua **admin-only** | usuário sem `role='admin'` não vê nem consegue enviar `is_covil` · R11 |
| A14 | DDAL aparece em **D&D 5e 2014 e 2024** e desmarca ao trocar para sistema não elegível | selecionar 5e 2024 → bloco aparece; selecionar 5e 2014 → bloco **também** aparece (corrigido 2026-08-24; antes só 2024); trocar para outro sistema → `is_ddal=false`. Front e backend precisam concordar (`CreateTableForm.tsx` × `tableService.ts`) · R11 |
| A15 | Rascunho local não regride | modal de restauração, expiração de 7 dias, `beforeunload` e limpeza de `parseCaseId` seguem funcionando · R10 |
| A16 | **Zero controle cru no editor**: nenhum `<input>`, `<select>`, `<textarea>` ou `<button>` nativo onde `ui/primitives` já resolve | grep no diretório do editor → zero ocorrências, exceto as justificadas por comentário inline dizendo por que o primitive não serve. Baseline atual: fluxo de criação importa **zero** de `@artificio/ui` · R16 |
| A17 | **Campos de texto grande consolidados**: os **5** removidos não existem no editor, e "Regras e observações" fica **imediatamente abaixo** da Descrição | grep provando zero editor de `synopsis`, `synopsis_narrative`, `style_text`, `listing_excerpt` **e `benefits_text`**; ordem de render conferida na parte de identidade · R17 |
| A18 | **Alinhamento vem do pacote, não de ajuste local** | os controles alinhados por `Field` de `ui/primitives`; se A2 exigir altura fixa de rótulo, a correção entra em `packages/ui`, não no CSS do editor · R16 |
| A19 | **Identidade do mestre chega preenchida** | abrir o editor com um mestre que tem `bio_long`, `nickname` e `contact_methods` no perfil → os três vêm preenchidos sem digitação, **todos** os contatos do perfil listados e removíveis; **não** editar → mesa espelha o perfil; editar → vira sobrescrita da mesa e o **perfil permanece intacto** (conferir a linha em `gm_profiles` antes e depois) · R12 |
| A20 | **Sincronizar com o perfil é sempre deliberado** | o botão **"Sincronizar com o Perfil Principal de Mestre"** (texto exato, R12) só aparece quando o campo herdado foi editado; clicá-lo grava no perfil (`gm_profiles`) e **nenhum outro caminho do editor escreve lá** — provar por teste que salvar a mesa sem clicar deixa `gm_profiles` inalterado · R12 |
| A21 | **Seleção de sistema em três colunas, progressiva** | as três colunas (Sistema · Edição · Variante) ficam **lado a lado**, cada uma com **busca própria** (hoje há uma só, `:414`, e os níveis empilham, `:425`); **os aliases aparecem nas opções** (reverte D0.5) — conferir positivamente: buscar "Vampire" e ver "Vampiro · VtM · The Masquerade" na própria linha da opção, não só depois de escolher; buscar "Vampire" → escolher → **Edição** abre com lista **e** busca; escolher a edição → **Variante** abre se houver; escolher um sistema **sem** edição (510 dos 690) → **nenhuma seção extra aparece**; os **aliases do nó selecionado** ficam visíveis em cada nível; grep provando `presentation="selection"` e ausência de "nome PT"/parágrafo de árvore; a chamada usa `search`/`limit`/`parent_id`, nunca `view=tree` (baseline: **503.907 bytes** × **423**); busca sem resultado oferece sugerir com o termo digitado · R18 |
| A22 | **Sistema de imagem sem regressão**, banner abaixo do título, **e com legenda que orienta** | as **13 capacidades** de §Gap 10 conferidas uma a uma no gate da Fase 4; **mais** a legenda exibindo proporção **1200 × 650**, **JPG/PNG/WEBP**, **5 MB** e a recomendação de tamanho (**1200 × 650**, piso **600 × 325** — o banner vira `og:image`), com grep provando que proporção/formato/peso vêm de `imageKindSpec` e não de literal; e que a legenda **não** anuncia mínimo como regra (os campos existem no spec, mas **nenhum validador os impõe**), **não** diz "máximo 1600 px" (`maxDimension` reduz, não rejeita) e **não** promete transparência (`fetch_format:"auto"` converte na entrega) · R19 |
| A23 | **Um horário, com opção personalizada** | não existe botão de adicionar horário no editor; escolher "horário personalizado" abre campo livre; o card do catálogo exibe **"Horário Personalizado"**; grep provando que "Vagas por sessão" não existe mais no editor · R20 |
| A24 | **Requisitos junto da plataforma; valores numa parte só** | os 3 checkboxes de requisito e o select de VTT/comunicação na **mesma parte**, com a auto-marcação dizendo o porquê; e `price_type`, valores, doação, sessão zero e detalhes de cobrança **todos na parte Valores** — nenhum campo de preço fora dela · R21 |
| A25 | **O mestre vê o que publica, sem sair do editor** | a prévia do card na lateral usa o **`TableCardComponent` real** (grep provando o import de `components/TableCard`, não um card desenhado à mão) e reflete o estado atual do editor; **"Ver como jogador"** abre a página da mesa como o público a vê · R22 |
| A26 | **Segurança de mesa coletável; local condicionado à modalidade** | criar mesa marcando X-Card e "terror" → ler a linha em `tables` e ver os valores em `content_warnings`/`safety_tools`, e a página pública renderizando as descrições do glossário; escolher modalidade **online** → campos de cidade/estado **não aparecem**; escolher presencial/híbrida → aparecem; grep provando zero editor de `custom_scenario`, `style_tags` e `features` · R23 |
| A27 | **Faixa etária visível ao jogador** | abrir uma das 57 mesas importadas com faixa real → a página exibe +14/+16/+18; o card do catálogo idem; mesa `livre` legítima não ganha selo ruidoso · R24 |

Smoke visual (quem valida: **mantenedor**): criar mesa do zero, editar mesa no ar
mudando um campo só, colar anúncio e conferir o que o parser marcou, abrir os `<select>`
no tema escuro (conferência do contrato já existente — §Gap 7).

---

## Fora de escopo

- Catálogo público, card e página da mesa (não são o editor). **Quatro exceções nomeadas:**
  (a) o mesmo contrato de preço, se exigido — Gap 3; (b) o card passa a exibir
  **"Horário Personalizado"** quando a mesa usa essa opção (R20/A23, decidido 2026-08-24) —
  é mudança no `features/catalog`, não no editor, e entra junto porque sem ela a opção nova
  não aparece para o jogador.
  **(c)** faixa etária exibida na **página e no card** (R24/T3.2f) — as 57 mesas importadas
  têm o dado e nenhuma o mostra; **(d)** `rules_notes` ganhando seção na MesaPage (T7.2b) —
  35 mesas com conteúdo invisível. As quatro entram porque, sem elas, dado que o editor
  coleta continua sem chegar ao jogador.
- Parser de Discord/importação (specs 079/093) — esta spec toca apenas o parser de
  "colar anúncio" do fluxo de criação.
- Filtros do catálogo (spec 094, pendência aberta em branch própria).
- `OnboardingPage.tsx` (preferências do usuário) — **não é** o onboarding de mesa
  (premissa corrigida no levantamento). Continua fora salvo pedido explícito.
- Backfill de `age_rating`/`table_level` nas 41 mesas — decidido em 2026-08-23.
- Wizard, gaveta/modal e rolagem em qualquer variante — ver §Fica fora.

---

## Riscos e impacto em outros módulos

- `packages/ui`/design system: **o R9 deixou de ser risco** — o `color-scheme` já está no
  pacote desde `3ae4f6b` (2026-08-17) e não há edição pendente (§Gap 7). O risco que
  permanece é outro e é maior: o editor **consome** o pacote em vez de reimplementar (R16),
  e qualquer lacuna que ele exponha — altura fixa de rótulo para A2, marca de nível de campo
  para R6, componente de lateral — **se corrige no pacote**. A **edição** está autorizada
  desde 2026-08-24 (§Autorização de escopo); o que permanece obrigatório é a **verificação
  de impacto nos consumidores**, e commit/push/PR seguem exigindo aprovação por ação. Corrigir no CSS do
  `mesas` seria a "exceção por app" que o AGENTS.md trata como dívida.
- **Redundância dentro do próprio pacote (achado lateral, 2026-08-23):** `.artificio-field`
  está declarado **duas vezes** em `packages/ui/src/styles.css` — `:728` (só `font-family`) e
  `:945` (`color`/`display:grid`/`gap`). A segunda vence por cascata; a primeira é regra
  morta. Não bloqueia esta spec; entra se a Fase 4 tocar o `Field` por causa de A2/A18.
- **Reescrita de 1.474 linhas de steps.** O editor substitui `CreateTableForm` +
  `useStepNavigation` + os 6 arquivos de `form-steps/steps/`. O risco não é o volume, é
  perder capacidade sem perceber: o levantamento da Fase 2 mediu features que o protótipo
  inicial havia esquecido (contador de 5.000 caracteres com toolbar, campos condicionais
  por modalidade/cobrança, "✏️ Personalizado" em toda plataforma, bloco DDAL, limpeza de
  campo invisível que evitava 400 do backend). Mitigação: T3.0 é o inventário
  campo-a-campo, e nenhuma fase de implementação fecha sem cruzá-lo.
- **Working tree:** branch `fix/mesas-og-descricao-vazia` com diff não commitado que tem
  **dois donos** (frente OG **e** `packages/media` desta spec). **Inventário completo e
  atualizado:** `plan.md` §Estado do working tree e a tabela de pendências do `tasks.md` —
  não duplicar a lista aqui, que foi como ela ficou desatualizada. A sessão de cobrança (26-08-22_1) já
  está mergeada em `dev` (`182d063`, PR #283). Trabalho desta spec deve partir de
  `origin/dev`; coordenação do diff OG com o mantenedor antes da Fase 3.
- Specs 093/094 no mesmo app: risco de colisão em `features/create-table/`,
  `form-steps/` e mapper. Cada spec segue em branch própria de `origin/dev`.
- Parser (Gap 4): mudanças no backend de parse tocam a fronteira testada pelas specs
  079/093; manter cobertura de regressão.
