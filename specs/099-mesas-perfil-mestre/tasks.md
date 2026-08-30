# Tasks 099 — Perfil do mestre

**Status: nenhuma task executada.** Decisões D1–D11 fechadas (`spec.md` §3).

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
| **A1** | Investigar por que `selling_points` volta `{}` (objeto) em 7/20 perfis, apesar do `DEFAULT '[]'::jsonb` | spec §2.2 (forma + achado aberto) | causa nomeada com a consulta que a provou — ou bloqueio explícito |
| **A2** | Normalizador tipado para `selling_points` na fronteira, antes de virar prop | spec §2.2 · critério A5 · A9 | teste que **falha sem** o normalizador, verificado reintroduzindo o defeito |
| **A3** | Fonte única para "anos de experiência" (`14` editor × `11` bio × `10+` página) | spec §2.1 (linha ⚠️) · **plan fase A, trava** | os três números viram um; medição do que a API devolve × o que o editor mostra |

**⚠️ Trava de A3:** `experience_years` (autodeclarado) e `years_on_platform` (calculado de
`created_at`) **são dados distintos e o código proíbe fundi-los** (`gm.ts`, spec 081 T9.1).
A divergência é entre editor × bio × API do `experience_years`.

**→ Fechar o GATE A antes de seguir** (`plan.md`).

---

## Fase B — Porta de entrada

### B-0 · Pré-requisito (bloqueia todas as outras)

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B0** | Consolidar a escrita no `PUT /api/v1/gm/profile` (que já valida os 6 campos), migrando o `mutationFn` de `useUpdateGm` | **plan §B.0 inteiro** (tabela das 4 camadas + Merge Endpoints) | os 6 campos chegam à coluna de ponta a ponta; **nenhuma porta falsa** |
| **B0.1** | Conferir o write path de `closed_group_*` — **não passa por nenhuma das duas portas** e não foi medido | plan §B.0, última linha | caminho de escrita nomeado, com o comando que o encontrou |

**Por que primeiro:** hoje `tagline`, `selling_points`, `badges` e `promo_badge_text`
morrem no Zod e no handler **em silêncio** — o mestre digita, o indicador diz "salvo", o
dado some. Criar campo antes disto entrega porta falsa.

### B-1..B-5 · Campos, na ordem de custo × alcance

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B1** | Campo de `tagline` | spec §2.3 (**três cadeias**) · **§9 (fidelidade visual)** · D2, D7 · D10 | campo grava; as 3 cadeias conferidas, nenhuma regredida |
| **B2** | Campos de `closed_group_*` (4 + liga/desliga) | spec §2.2 (**centavos** e **UUID**) · D9 · write path **não medido** (plan B.0) | preço em reais grava centavos — testado; sistemas gravam UUID. A leitura já tem `formatPriceBRL` (`MestreClosedGroupSection.tsx:15`): a escrita é o inverso dela, não uma conversão nova |
| **B3** | Campos de `specialties`, `languages`, `badges` — **com a exibição junto** (C2) | spec §2.1 (órfãos dos 2 lados) · **§9** · plan "o que reusar" | campo grava **e** a página exibe; sem isso, defeito invertido |
| **B4** | Campo de `selling_points` | spec §2.2 (**14 ícones fechados**, descarte silencioso) · **§9** | seleção entre os 14, nunca texto livre; item inválido barrado **no formulário** |
| **B5** | Campo de `promo_badge_text` | spec §2.1 · D9 | campo grava; faixa aparece no topo do hero |

### B-6..B-9 · Qualidade da tela (D5, D10)

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B6** | Frase do ganho em todo campo recomendado, no padrão `EditorField` + `RECOMMENDED_GAIN` | **spec §8 (tabela campo→nível)** · D10 · plan "o que reusar" | os 7 recomendados de §8 têm frase, na linguagem do jogador; nível em `data-ob`; registro único no padrão `editorValidation.ts:72`, cruzado por teste |
| **B7** | `aria-describedby` no controle de todo campo com erro/hint | **plan §B, armadilha 1** · critério A6 | busca pelo atributo em cada campo — o `Field` **não** o emite |
| **B8** | Autosave: debounce real + indicador que não rola para fora | spec §2.5 | requisição por pausa, não por tecla; indicador visível ao editar a bio |
| **B9** | Listar os sistemas escolhidos, não só contar; remover `Preço Médio` do front (D4) | spec §2.1 · §2.5 · D4 | os nomes aparecem; `average_price` sai do editor, banco intacto |
| **B10** | Prévia do perfil público nas 3 telas (D5) e prévia do véu do banner (D8) | D5 · **D8** (scrim fixo — é decisão, não está na fase D do plan) | prévia mostra o texto real sobre a foto real |

### B-11 · Extração assistida (D11) — por último na fase

| # | Fazer | LER ANTES | Aceite medido |
|---|---|---|---|
| **B11** | Extrair atributos da bio e **oferecer para confirmação** | D11 (**trava**) · plan §B "extração assistida" | máquina **sugere**, mestre confirma, publicação nunca travada |

**⚠️ Trava de B11:** nada é gravado sem confirmação. O F1 do Airbnb é 75% — gravar direto
erraria um em cada quatro atributos exibidos ao jogador. `llmAssist.ts` já faz a chamada
com esquema + Zod + cache; o trabalho é o esquema novo, não a infraestrutura.

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
| **C4** | Medir **mobile (719px) e tema claro** — pendência desde a investigação | spec §5, §6 | medição registrada; defeitos achados viram task |

**→ Fechar o GATE C.**

---

## Fase F — Correções de forma (a "fase D" do plan.md; tasks nomeadas F para não colidir com as decisões D1–D11)

| # | Fazer | LER ANTES | Aceite medido | Trava |
|---|---|---|---|---|
| **F0** | **Combinar a ordem com a 098** antes de tocar qualquer componente | plan fase D (colisão medida) | ordem definida pelo mantenedor | a 098 cita `Manter link direto` — mesmos componentes |
| **F1** | Primitivo de checkbox no pacote **+** migrar as 2 instâncias (`AvatarField`, `ImageUploader`) | plan fase D (F1) · A7 | alvo ≥ 24px nas duas; primitivo no pacote | aprovação nominal (`packages/ui`) |
| **F1b** | Link do nome do mestre em `TableCard.tsx:185-192` (≈20px) — **página pública**, 4 cartões | plan fase D (F1b) · A6 | alvo ≥ 24px medido em runtime | local ao `mesas`, sem aprovação de pacote |
| **F2** | Rodapé: `Ver termos` e `.artificio-footer-nav-link` ≥ 24px | plan fase D (F2) · A8 | medido no `mesas`, `downloads` e `glossario` | aprovação nominal |
| **F3** | **Re-medir a nav em runtime** antes de tratá-la como defeito | plan fase D (F3) | 22px reproduzido ou descartado | não tocar antes de medir |
| **F5** | Editor de perfil: adotar a régua `--space-1..6` (**0 usos**, 3 valores fora da grade) **e** trocar o que reimplementa o pacote (**20 classes + `@keyframes spin`**, spec §9.5) | **spec §9** (inteira) · 098 §6.3 | `node .agents/skills/ui-fidelity-audit/audit.mjs <tsx> <css>` verde nas medições 1–4 **e 7/7b** | local ao `mesas`; **não** reintroduzir `[data-theme=light]` (§9.2); primitivo que não cobrir o caso leva comentário dizendo qual limitação |
| **F4** | Adotar a escala do pacote (34/40/48) nos campos do editor | plan §B armadilha 2 (`Textarea` é exceção) | alturas na régua; largura por tamanho de resposta | aprovação se tocar o pacote |

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
| causa do `selling_points: {}` | **não medida** → A1 |
| mobile e tema claro | **não medidos** → C4 |
| perfil de controle preenchido | **não existe** — nenhum dos 20 |
| nav global 22px | **não reproduz** no CSS do pacote → F3 |
| custo do esquema de extração para bio | **não medido** → B11 |
| write path de `closed_group_*` | **não medido** → B0.1 |
| `gmProfileSchema` sem `selling_points`/`tagline`/`promo_badge_text`/`badges` | **medido** — pré-requisito da fase B (plan B.0, passo 2), antes de qualquer campo novo |
| checkbox sem dimensão no `AdminTable` de `packages/ui` (`admin/AdminTable.tsx:288,304` — as classes de tamanho estão no `th`/`td`, não no `input`, então vale o default do agente de usuário) | **fora do A6** (que cobre página pública + editor), usado em telas admin do `mesas`. Registrado para não sumir; se entrar, exige **aprovação de pacote**. O "~13px" é default de runtime, **não medível na fonte** — precisa de navegador. `AdminTable` sai do subpath `@artificio/ui/admin`, não do índice raiz |
| soma da tabela de seções (4856 × 5341px) | **inconsistente**, registrada em `old_spec.md` §2.1 |
| `tailwind-preset` do pacote não é consumido por nenhum app | aberto, **não** é dívida da 099 (apps consomem via `styles.css`) → spec §9.4. O guard de paridade já foi ligado ao CI nesta sessão |
