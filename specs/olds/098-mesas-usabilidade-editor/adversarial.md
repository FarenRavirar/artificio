# 098 — Investigação Adversarial

**Data:** 2026-08-27 · **Método:** três frentes read-only em paralelo (código, fontes externas/melhores práticas, documentação interna), cada claim verificada contra a fonte material com comando citado. Nenhum arquivo de código foi alterado.
**Fontes materiais:** código real (`apps/mesas/frontend/src/features/table-editor/**`, `packages/ui/src/**`, `packages/content-editor/src/**`, `apps/downloads/frontend/src/pages/painel/**`, `apps/mesas/database/**`), banco de produção (3× `SELECT` read-only via `ssh faren docker exec mesas-db psql`), 17 webfetches das URLs citadas na spec, e leitura íntegra de `spec.md`, `plan.md`, `tasks.md` + trechos nomeados das specs 096/097.
**Limitações registradas:** Material Design 3 e a página viva do Apple HIG são SPAs (JS-only) — M3 ficou "não medida" na fonte primária; HIG foi verificada via Wayback. LSP não disponível no ambiente dos subagentes; todo diagnóstico foi por grep/leitura direta.

## Veredito resumido

A spec 098 está **substancialmente correta** nas medições centrais (minHeight default 192, seis valores locais, tokens `--space-*`, zero `var(--space-` no editor, media query 719px, schema `tables.description`, `resize: vertical`) e nas decisões registradas (D1, D3, D4', D5 estão bem sustentadas). **Não está pronta para a implementação citá-la como lastro sem correção**, porque:

- **4 divergências factuais de código** mudam passos concretos de tasks (T-A passo 4, T-D passo 1, §6.10/A12);
- **§6.7 sustenta a decisão D2 em dois números (11-14% e 18%) que não existem nas fontes citadas**;
- **§6.4 condena 16px como "reprova obrigatória" sem medir a exceção de Spacing do SC 2.5.8**, que é a condição exata que decide conformidade;
- **5 defeitos documentais de severidade alta** (números 2419/2474, 7 vs 6 abas, plan Fase C contradizendo D4', A7 contradizendo §6.4, T-F citando arquivo errado para `EDITOR_PARTS`).

Nenhuma dessas correções muda as decisões já tomadas pelo mantenedor. Mudam a qualidade do lastro.

---

## Eixo 1 — Código: claims da spec verificadas contra o código real

| ID | Claim da spec | Status | Evidência |
|---|---|---|---|
| C1 | `ContentEditor.tsx:~132` default `minHeight = 192` | **confirmada** | `rtk rg -n "minHeight" packages/content-editor/src/ContentEditor.tsx` → `132: minHeight = 192,`; prop `minHeight?: number` na linha 46; valor aplicado em mirror (305), textarea (340), preview (346) |
| C2 | mesas passa seis minHeight: 180, 120, 112, 100, 96, 120 | **refutada a contagem — são 7** | `rtk rg -n "minHeight" apps/mesas/frontend/src/features/table-editor/` → 7 ocorrências: IdentityPart:278 {180}, IdentityPart:297 {120}, MasterPart:115 {120}, WhenPart:185 {112}, WhenPart:258 {96}, ValuesPart:212 {100}, **ExtrasPart:38 {100}** ("Requisitos técnicos detalhados" — omitida na spec). T-A passo 4 ("remover os seis") deve falar em sete |
| C3 | `primitives.tsx:~57` Button embrulha children num `<span>` único com display:block e white-space:nowrap | **confirmada com precisão sobre o CSS** | `rtk rg -n "artificio-button-label" apps packages` → única ocorrência em `primitives.tsx:57`. `styles.css:737-751`: `display: inline-flex; gap: 8px; line-height: 1; white-space: nowrap` (linha 750). **Não existe regra CSS para `.artificio-button-label`** — o `nowrap` é herdado do `.artificio-button:750`; o `display:block` é blockificação de flex item. Nenhuma prop do Button (variant/size/loading/leftIcon/rightIcon/children/className) muda isso. O mecanismo do defeito descrito na spec está correto; a descrição "classe com display:block e nowrap" sugere declaração inexistente |
| C4 | `MasterPart.tsx:44-50` dois `<span>` com flex-col | **confirmada (linhas reais 41-50/51-59)** | botão 1 abre na 41, `!items-start !gap-1 !px-3.5 !py-3 flex-col` na 46, spans 48-49; botão 2 em 51-59, spans 58-59 |
| C5 | `styles.css:62-66` declara `--space-1..6` | **parcial — `--space-5` não existe** | `rtk rg -n -- "--space-" packages/ui/src/` → `62: --space-1: 0.25rem; 63: --space-2: 0.5rem; 64: --space-3: 0.75rem; 65: --space-4: 1rem; 66: --space-6: 1.5rem;`. Existem 5 tokens (1,2,3,4,6 — sem `--space-5=1.25rem`). Reconfirmado pelo orquestrador: `rtk rg -n -- "--space-5" packages/ui/src/` → zero (exit 1). T-D passo 1 ("usar --space-1..6") precisa saber disso |
| C6 | zero uso de `var(--space-` no editor | **confirmada** | `rtk rg -n "var\(--space-" apps/mesas/frontend/src/features/table-editor/` → zero linhas |
| C7 | `gap-3.5` em 8 arquivos, 14 ocorrências | **parcial — 15 ocorrências, não 14** | reconfirmado pelo orquestrador: `rtk rg -c "gap-3\.5" .../table-editor/` → TableEditor 1, AudiencePart 3, ExtrasPart 2, IdentityPart 1, MasterPart 1, ValuesPart 3, WherePart 2, WhenPart 2 = **15** em exatamente 8 arquivos; zero fora desses 8 no mesas |
| C8 | `.table-editor-part` padding 24px; `.table-editor-document` padding 0 | **parcial — valores certos, localização é markup** | `TableEditor.tsx:292`: `className="table-editor-part px-7 pb-6 pt-6"` (pt/pb = 24px via Tailwind; px-7 = 28px laterais). `TableEditor.css:144-150`: `.table-editor-document` sem padding. A frase "o CSS declara padding: 24px" é imprecisa — é utility no markup |
| C9 | textarea do ContentEditor tem `resize: vertical` | **confirmada** | `content-editor.css:108-109`: `.artificio-content-editor__textarea { resize: vertical; }` |
| C10 | comentário sobre `aria-pressed` fixo em `IdentityPart.tsx:317-319` | **parcial — comentário em 328-330** | conteúdo idêntico ao citado ("Ação de uma via (abre modal), não controle de duas posições..."), linhas deslocadas ~11 |
| C11 | repo: 16 arquivos usam `<Button>`; 3 passam elemento aninhado; só MasterPart empilha dois textos | **refutada na contagem e nos nomes** | `rtk rg -ln "<Button" apps packages` → 17 arquivos (16 excluindo a definição `primitives.tsx`; a spec não declara o critério). Children composto real (medido por regex multiline): **4 arquivos** — TableEditor.tsx (ArrowLeft 435-436; span `flex-1` 526-535 — provavelmente já sofre do wrapper), MasterPart.tsx (2 spans ×2), MinhasSugestoesPage.tsx (ArrowLeft 21-27), ParserSignalsPanel.tsx (Sparkles 109-115). **ReportButton e AdminPanel (links) NÃO passam elemento aninhado** — só ternários de strings ("Enviando…"/"Enviar"), confirmado por `rtk rg "<Button" -C 6`. "Só o MasterPart empilha dois textos" é verdadeiro — alcance real do conserto = 1 consumidor, o argumento da spec sobrevive, mas a lista de verificação de T-C passo 1 está errada: os outros reais são TableEditor, MinhasSugestoesPage e ParserSignalsPanel |
| C12 | `EditarMaterialPage.tsx:331-336` ContentEditor com `maxLength={50000}` e sem minHeight | **confirmada no file:line; refutada a generalização** | `331-336: <ContentEditor value=... label="Descrição do material" maxLength={50000} />` sem minHeight. MAS `rtk rg -n "minHeight" apps/downloads/frontend/src/ -C 2` → **8 arquivos do downloads passam minHeight**: CommentSection 132, GestaoDenunciasPage 128, GestaoImportarPage 160 (com `maxLength={50_000}`!), GestaoModeracaoPage 128, RatingSection 128, ReportButton 112, GestaoSugestoesSistemaPage 128, PerfilPage 160. A frase do §6.10/A12 "o downloads não passa minHeight nenhum — usa o default" é **falsa**. O defeito específico (50k chars em caixa fixa) é real — e pior ainda no GestaoImportarPage (50k + minHeight 160). A conclusão (field-sizing no pacote resolve todos) fica intacta; T-A passo 6 deve mapear os 8 usos |
| C13 | `editorValidation.ts`: EDITOR_PARTS e `partOfField` | **confirmada com correção de localização** | `utils/editorParts.ts:26`: `export const EDITOR_PARTS`; `utils/editorValidation.ts:215`: `export function partOfField` (importa EDITOR_PARTS da editorParts); usado no rodapé em 416 e 435. **EDITOR_PARTS vive em `editorParts.ts`, não em `editorValidation.ts`** como plan/tasks sugerem |
| C14 | media query 719px: lateral vira faixa horizontal | **confirmada** | `TableEditor.css:86`: `@media (max-width: 719px)`; aside com `overflow-x: auto`, `.table-editor-parts-nav { flex-direction: row; overflow-x: auto }` (101-105), preview some. Teste estrutural cobre: `TableEditor.test.tsx:422` |
| C15 | "+ estilo" adiciona item sem rolar, igual a "Adicionar contato" | **confirmada** | `ContactMethodsEditor.tsx`: append puro em `apply([...current, {...}])` + `setShowAddMenu(false)` — sem scroll/focus. `SettingStylesField.tsx`: `handleAddStyle` faz `[...settingStyles, style]` (172); botão "Adicionar" 282-289 — append puro. ExtrasPart não tem adicionador dinâmico (DDAL é grade fixa) — os únicos adicionadores são contatos e estilos |
| C16 | Infra de teste frontend mesas + viabilidade do A10 | **confirmada a infra; A10 só por teste estrutural** | `package.json`: vitest 4.1.10, jsdom 29.0.2, @testing-library/react 16.3.2; `vitest.config.ts`: environment jsdom, `setupFiles: './src/test/setup.ts'`. Prova no próprio código de teste: "jsdom não faz layout: `scrollHeight` é sempre 0 aqui, então medir o critério numérico neste ambiente daria verde vazio (E022)" (TableEditor.test.tsx ~340); `scrollTop` é simulado à mão (~405); `ContentEditor.test.tsx:159` atribui `campo.scrollTop = 120`. Zero Playwright/e2e no mesas. **Altura calculada, getBoundingClientRect e rolagem automática não são testáveis em jsdom** — A10 é factível como teste estrutural (regex sobre CSS emitido/JSX, padrão E022 do repo), não como medição de layout |
| C17 | Consumidores de `@artificio/content-editor` | **medida** | 39 arquivos: downloads 13, mesas 24, packages/comments 1, mesas/backend 1 (subpath `/sanitize`). Do **componente** ContentEditor (afetados por mudança de altura): downloads 10, mesas 9, comments 1. `accounts` não importa (de propósito, comentário E016/E017) |
| C18 | field-sizing no repo | **confirmada (zero)** | `rtk rg -n "field-sizing" apps packages` → zero. T-A será a primeira implementação |
| C19 | Schema: tabela/coluna do anúncio | **confirmada** | `apps/mesas/database/migration_01_base_schema.sql:121` `CREATE TABLE tables (`, `127: description TEXT,`. Nota: `apps/mesas/database/migrations/` não existe — migrations ficam em `apps/mesas/database/`. `SELECT length(description) FROM tables` é válido; `systems` também tem `description` (linha 40) — qualificar em join |
| C20 | Produção: contagem e distribuição de `description` | **medida (read-only)** | `ssh faren "docker exec mesas-db psql -U admin -d mesas_rpg -tAc \"SELECT count(*) FROM tables;\""` → **123** (spec diz 121). Distribuição: min=0, **p50=894**, avg=1027, **p90=1811**, p95=2291.5, max=2932, count=123 com description não-nula. O "caso comum de 1372 caracteres" fica entre mediana e p90 |

### Achados novos de código (não previstos na spec)

1. **Sétimo minHeight local** em `ExtrasPart.tsx:38` — T-A passo 4 fala em "os seis"; são sete.
2. **`--space-5` não existe** — escala real do pacote: 1,2,3,4,6.
3. **`gap-3.5` = 15 ocorrências**, não 14 (AudiencePart tem 3, ValuesPart 3).
4. **O downloads passa minHeight em 8 lugares** — a justificativa de §6.10/A12 está errada, a conclusão não muda.
5. **`.artificio-button-label` não tem regra CSS nenhuma** — o `nowrap` é herdado do `.artificio-button:750`; `display:block` é blockificação de flex item.
6. **Consumidores do Button com children composto são 4, com nomes diferentes dos citados** — o conserto do pacote deve ser verificado em TableEditor, MasterPart, MinhasSugestoesPage, ParserSignalsPanel.
7. **Produção tem 123 mesas, não 121.**
8. **A10 sem browser real** — infra jsdom só cobre teste estrutural; medição de layout exige browser, que não existe no mesas (sem Playwright/e2e).
9. **T-F mexe em `editorParts.ts` (EDITOR_PARTS) além de `editorValidation.ts` (partOfField)** — a spec/plan citam só o segundo.
10. **Mudança no Button tem blast radius** nos 4 arquivos de children composto + todos os usuários de leftIcon (ContactMethodsEditor, CardPreview).

---

## Eixo 2 — Fontes externas e melhores práticas (§1 e §6 da spec)

| ID | Fonte | O que a spec afirma | O que a fonte realmente diz | Status |
|---|---|---|---|---|
| F1 | caniuse field-sizing | 83,95%; Chrome/Edge 123+, Safari 26.2+, Firefox 152+ | "Global usage 83.95%"; versões de browser batem exatamente | **confirma** |
| F2 | MDN field-sizing | "sempre parear com min/max-height"; fallback = ignora a propriedade; "a fonte desaconselha JS de reflow" | MDN diz que min/max são "quite effective" (não "sempre"); com max-height atingido "scrolling is required" — mecânica que a spec usa está certa; MDN **não menciona JavaScript/reflow** | **confirma parcialmente** — "sempre" e a crítica ao JS são atribuição além do texto |
| F3 | Baymard form-field-usability | faixa 18-33 caracteres; hesitação medida | "the 'normal' boundary… typically spanned from 18 to 33 characters" ✓; "wondered if they had misunderstood the label" ✓. "Digita e apaga" não está no artigo | **confirma** (paráfrase menor além da fonte) |
| F4 | Baymard avoid-multi-column-forms | 15 campos/3 passos supera 10 campos em 11-14%; 18% abandonam por layout confuso; 16% dos sites erram | O artigo contém **16%** (sites com multicolumn extenso) e erros de preenchimento. **Não contém 15 campos/3 passos, não contém 11-14%, não contém 18%** | **fonte não sustenta** — os dois números centrais do §6.7 não existem na URL citada |
| F5 | W3C Understanding SC 2.5.8 | mínimo 24×24 CSS px, AA, critério que vale no desktop | "at least 24 by 24 CSS pixels", "(Level AA)" ✓. Existem 5 exceções (Spacing, Equivalent, Inline, User Agent Control, Essential). O doc é explícito: targets pequenos **conformam** sem target adjacente próximo. O critério vale para pointer inputs — **não há divisão desktop/mobile no texto** | **confirma o critério; ressalva grave na aplicação** — condenar 16px sem medir a exceção de Spacing é mais forte do que o critério permite afirmar |
| F6 | NN/g white space | regra relativa; rótulo perto do próprio campo; entre grupos > dentro do grupo | "Place the label closer to the associated text field than to other text fields" ✓; "Group together related fields" ✓. "Não existe número mágico" **não está** no artigo; a proporção entre grupos é do Blake Crosley, não do NN/g | **confirma em substância; atribuição imprecisa** de duas frases |
| F7 | GOV.UK radios | radio com hint; aria-describedby; hint em frase curta sem ponto final | Hint por item ✓; HTML do exemplo com `aria-describedby` ✓; "Keep each hint to a single short sentence, without any full stops" ✓ literal | **confirma** |
| F8 | UXPin line length | 45-75 chars, alvo 66 | "66 CPL widely accepted as the optimal target" ✓; Bringhurst 45-75 ✓; limiar de "perder a linha" é **80+** CPL na fonte, não 75 | **confirma** (nuance: "30% acima do limite" usa 75; contra 80 seria 21%) |
| F9 | Blake Crosley five-spacing-decisions | 8px rótulo→campo, 24px entre campos; achatar a 16px uniforme elimina hierarquia | URL viva (post 04/08/2026). Texto: "the label sits 8px from its field, and fields sit 24px from each other… Flatten those distances to a uniform 16px and the same form becomes a haze". Confirma escala 4/8/16/24/32/48/64, padding por papel, "a 13px gap is drift" | **confirma** (citação entre aspas da spec é paráfrase) — mas ver ressalva de autoridade abaixo |
| F10 | Carbon text input | 32/40/48px | "Small (sm) 32/2, Medium (md) 40/2.5, Large (lg) 48/3" ✓ na URL citada; tokens de spacing estão em outra página (valores corretos para v11) | **confirma** |
| F11 | Material 3 spacing | grade 4dp; line-height divisível por 4 | **Não medida.** SPA JS-only; webfetch devolve só o shell; Wayback sem conteúdo | **não medida** |
| F12 | Apple HIG | alvo de toque mínimo 44pt | Via Wayback (HIG iOS): "Try to maintain a minimum tappable area of 44pt x 44pt for all controls" ✓ — recomendação ("try to"), como a spec a trata | **confirma** (via snapshot) |
| F13 | ISO 9241-11 | usabilidade = eficácia, eficiência, satisfação | Página oficial confirma existência/escopo (ed. 2018); definição tripartite confirmada por fonte secundária (Wikipedia); preview primário não renderizou | **confirma por fonte secundária** |
| F14 | NN/g 10 heurísticas | #1, #4, #6, #8 | Numeração e enunciados exatos ✓ | **confirma** |

### Contradições e atribuições problemáticas nas fontes

1. **[alta] §6.7 — os dois números que sustentam D2 não existem nas fontes citadas.** "11-14%" e "18% por layout confuso" não estão em nenhuma das URLs Baymard. O "18%" mais próximo na literatura Baymard é abandono de carrinho por "queria que eu criasse conta" (e-commerce — contexto sem relação com a aba Identidade). A conclusão de D2 (agrupar, não encolher) pode estar correta, mas **não é "resposta da literatura"**: é decisão da spec sem lastro nas fontes nomeadas. Afeta também §7 ("a resposta da literatura não é 'encolher'") e §6.9-bis ("não há o que inventar").
2. **[alta] §6.4 — SC 2.5.8 aplicado categoricamente sem a exceção de Spacing.** A conformidade dos 5 controles de 16-20px depende da distância entre targets adjacentes — condição que a spec não mediu. A correção para 24px é defensável como best practice ("using larger target sizes will help many people"), mas "reprovam no piso obrigatório" é afirmação mais forte do que a medição registrada sustenta.
3. **[média] §6.6 — a proporção "entre grupos > dentro do grupo" está atribuída ao NN/g; é do Blake Crosley.** A análise de proximidade invertida continua válida (o NN/g cita a Lei da Proximidade); o problema é de atribuição.
4. **[média] §6.1 — o MDN não "desaconselha JS de reflow" nem manda "sempre" parear.** A recomendação técnica é sensata; a atribuição é imprecisa. O comportamento do max-height está confirmado no MDN.
5. **[baixa] §6.8 — limiar de perda de linha é 80+ na fonte, não 75.**
6. **[baixa] §1 e §6.2 — paráfrases menores além da fonte** ("caber a resposta típica sem rolagem" não está no artigo Baymard; "digita e apaga" é adição).
7. **[média] Autoridade da fonte Blake Crosley.** Blog pessoal de designer (ago/2026), não padrão de mercado como Baymard/WCAG/ISO. O §6.9-bis o trata como normativo ("não há o que inventar"). Risco baixo na prática: os valores coincidem com design systems maduros (a própria spec cruza com Carbon).
8. **[baixa] M3 não verificado na fonte primária** (SPA). A equivalência "packages/ui já declara na mesma grade do M3" depende desse claim não medido.

---

## Eixo 3 — Documentação interna (spec ↔ plan ↔ tasks ↔ 096/097)

| ID | Severidade | Achado | Evidência (citações) | Correção sugerida |
|---|---|---|---|---|
| D1 | **alta** | Três números para a mesma aba: 2474 (§2.8) vs 2419 (§6.9/§7/plan/tasks), e a tabela de §6.9 soma 2311, não 2419 | spec.md:215 "2474px"; spec.md:573 e 630 "2419px"; plan.md:210-211; tasks.md:172 atribui a §2.8 o valor 2419 que §2.8 não contém | Remedir em T-E e unificar (ou explicitar "2474 = aba inteira; 2419 = soma de blocos — e fechar a soma de 2311") |
| D2 | **alta** | 7 vs 6 abas após a fusão T-F: A8, A9 e plan Fase G dizem 7; T-G diz 6 | spec.md:270, 273; plan.md:255, 260; tasks.md:228 "6, após a fusão" (o negrito indica que o redator sabia e não retropropagou) | A8/A9 e plan Fase G passam a "as 6 abas (7 antes de T-F), incluindo a fundida" |
| D3 | **alta** | plan Fase C contradiz a decisão D4' registrada: recomenda radio e pede "protótipo do bloco com radio" | plan.md:132 "Recomendação registrada na spec: radio aqui"; plan.md:139 entregável com protótipo radio; vs spec.md:676-677 "DECIDIDO: CONTINUA BOTÃO", spec.md:689-690 "Nenhuma task desta spec troca o componente"; tasks.md:91-92 "NÃO trocar por radio" | Reescrever Fase C: continua botão; entregável é conserto do Button + tabela de alvos, sem protótipo de radio |
| D4 | **alta** | A7 ("nenhum alvo abaixo de 44px") contradiz o critério corrigido pela própria spec (24px desktop / 44px toque) | spec.md:269 A7; vs spec.md:365-366, 697-698; tasks.md:107 entrega 24/44 e declara "Fecha: A7". Um agente literal infla os 47 controles da faixa 24-44px | Reescrever A7: 24px desktop / 44px nos controles que sobrevivem no mobile |
| D5 | **alta** | T-F/plan citam `EDITOR_PARTS` em `editorValidation.ts`; o símbolo está em `editorParts.ts` | plan.md:242-244; tasks.md:204-206; código: `utils/editorParts.ts:26`, `partOfField` em `utils/editorValidation.ts:215` | Citar os dois arquivos separadamente |
| D6 | média | "A3-bis" não existe na lista A1-A12 | tasks.md:114 "Fecha: A3, A7 (e A3-bis do texto grudado)" | Criar critério para §2.3-bis ou referenciar critério existente |
| D7 | média | Texto "Ordem" nomeia a fase errada: "G (juntar as abas) depende de D" — quem junta é F | plan.md:284; diagrama ASCII (277-282) está correto | Trocar G por F |
| D8 | média | tasks: "121 mesas de produção" sem comando/data citados — fere o padrão de evidência; produção hoje tem 123 (medido) | tasks.md:27-28; `rtk rg "121"` na pasta 098 → só tasks.md:27; banco: count=123 | Registrar o comando que produziu o número ou remover o número (o SELECT do passo 1 é quem produz). Extra: o SELECT cobre só `description`; a bio exige query própria para a frase "descrições e bios" |
| D9 | média | A11 confunde arquivos com ocorrências: "8 ocorrências de gap-3.5" | spec.md:281-282; vs §6.3 "14 vezes" e §6.10 "8 arquivos"; contagem real: 15 ocorrências em 8 arquivos | "8 arquivos" ou "14 ocorrências" (e recontar: 15) |
| D10 | média | §2.1 afirma "1372 caracteres é o caso comum" com medição de uma mesa só — afirma o resultado da medição que T-A ainda não fez | spec.md:61-62 vs tasks.md:27-29 | "na mesa de teste, 1372 caracteres"; deixar "típico" para T-A passo 1 |
| D11 | média | D2b emenda a decisão "agrupamento em 7 partes" da 096 sem anotar a emenda, e §4 ("não rever decisões da 096") não ressalva a exceção | 096 spec.md:725 aprova 7 partes; 098 spec.md:633-634 junta Quando+Onde; 098 spec.md:249-250 | Anotar em §7 D2b "emenda a decisão 096" e ressalvar em §4 |
| D12 | média | §6.5 cita comentário em `IdentityPart.tsx:317-319`; está em 328-330 | spec.md:384 | Atualizar referência de linha |
| D13 | baixa | Ordem numérica: 6.9-bis aparece depois de 6.10 | spec.md:460, 511, 571 | Renumerar (6.9-bis→6.9; atual 6.9→6.11) |
| D14 | baixa | T-F passo 6: "lateral vira faixa horizontal em mobile" — correta no código, sem lastro na spec/plan | tasks.md:208-209; código: TableEditor.css:99-103 | Citar TableEditor.css na task ou registrar na spec |
| D15 | baixa | T-E não declara "Bloqueia: T-G" (todas as outras declaram; diagrama tem E→G) | tasks.md:162-164 | Declarar |
| D16 | baixa | T-F "Fecha: D2b" fecha decisão, não critério; a aba nova não tem critério A próprio | tasks.md:218; A8/A9 não mencionam a aba fundida | Derivar critério A para a aba nova ou ligar ao existente |
| D17 | baixa | plan Riscos: "cinco dos oito achados" — §2 tem 11 seções (2.1-2.9 com bis/ter) | plan.md:293-294 | Ajustar contagem ou nomear os achados |
| D18 | baixa | A9: viewports 1366×768/1920×1080 sem fonte na spec (medida §2 foi 1815×962); mesa vazia está no plan (261) mas não em A9 | spec.md:273-274; 097 usa os mesmos viewports (não citada) | Citar a fonte ou registrar a decisão; adicionar mesa vazia a A9 |
| — | sem problema | Dependências concordam nas três fontes (T-F↔T-D dura; T-E↔A,C,D; T-G↔todos; diagrama consistente) | spec.md:658; plan.md:232, 285; tasks.md:164, 188, 224 | — |
| — | conforme | Referência à 097 corroborada (editor cortado, busca de cenário, campo de estilos) | spec.md:20-21 vs 097 plan itens 1, 4, 5 | — |
| — | conforme | Referência à 096 corroborada (decisões de produto, 7 partes, corte de campos) — com a ressalva D11 | spec.md vs 096 spec.md:594-640, 725 | — |
| — | conforme | Mecanismo "### Achados": exatamente 7 blocos no plan (fases A-G), regra declarada nos dois arquivos | plan.md linhas 82, 101, 141, 192, 217, 249, 269; tasks.md:6-7 | — |

---

## Correções recomendadas antes de liberar a implementação

1. **spec.md §6.7** — remover ou substituir os números 11-14% e 18% pelo que as fontes de fato dizem (16% de sites com multicolumn; erro de preenchimento qualitativo). A conclusão de D2 permanece, mas como decisão do mantenedor, não como "resposta da literatura".
2. **spec.md §6.4 e A7** — nomear a exceção de Spacing do SC 2.5.8 e reescrever A7 para 24px desktop / 44px toque (hoje A7 exige 44px em tudo e contradiz a própria §6.4). A fase C deve medir distância entre targets antes de afirmar "reprovam".
3. **spec.md §6.10 e A12** — corrigir a afirmação sobre o downloads (são 8 minHeight locais, não zero) e as contagens do mesas (7 minHeight locais, não 6).
4. **spec.md §6.3/§6.9-bis** — registrar que a escala do pacote tem 5 tokens (`--space-1..4,6`), sem `--space-5`.
5. **spec.md §6.3/§6.10/A11** — unificar a contagem de `gap-3.5`: 15 ocorrências em 8 arquivos.
6. **plan.md Fase C** — remover a recomendação de radio e o entregável de protótipo (contradizem D4').
7. **plan.md Fase D/T-D passo 1** — citar `--space-1..4,6` reais.
8. **plan.md Fase F/tasks T-F** — citar `utils/editorParts.ts` (EDITOR_PARTS) e `utils/editorValidation.ts` (partOfField) separadamente.
9. **plan.md "Ordem"** — corrigir "G (juntar as abas)" → "F (juntar as abas)".
10. **spec.md A8/A9, plan Fase G, tasks T-G** — unificar 7→6 abas pós-fusão (A8/A9/plan falam 7; T-G fala 6).
11. **tasks.md T-C** — corrigir a lista de consumidores a verificar (4 arquivos de children composto: TableEditor, MasterPart, MinhasSugestoesPage, ParserSignalsPanel).
12. **tasks.md T-A passo 1 e 4** — tirar o "121" sem lastro (medido hoje: 123) e falar em 7 minHeight.
13. **spec.md §2.8 vs §6.9** — unificar 2474/2419 e fechar a soma da tabela (2311) — remedir em T-E.
14. **tasks.md T-C** — referência de comentário: IdentityPart:328-330, não 317-319.
15. **A10** — registrar explicitamente que o teste será estrutural (jsdom não faz layout; padrão E022 do repo) ou planejar verificação de layout em browser real, que a infra atual não tem.

## O que a investigação NÃO contesta

- As medições centrais de tela (§2.1-2.9) — todas as claims correspondentes no código foram confirmadas.
- As decisões D1 (field-sizing), D3 (tokens do pacote), D4' (continua botão), D5 (24/44 por contexto) — corretas em substância; só o lastro documental de parte delas é que precisa de reparo.
- A estratégia "correção no pacote, não no app" (§6.10) — a regra do AGENTS.md foi aplicada corretamente; os números de apoio é que estavam errados.
- O mecanismo de blocos "### Achados" e a matriz de dependências das fases.

## Veredito

**Adversarial: NO-GO até correção documental.** A spec não deve entrar em implementação com §6.7 citando números inexistentes nas fontes, A7 contradizendo a própria §6.4, o plan Fase C contradizendo a decisão D4' do mantenedor, e os passos de T-A/T-D operando sobre contagens erradas (6 vs 7 minHeight; 14 vs 15 gap-3.5; downloads "zero" vs 8). São correções documentais pontuais, sem mudança de decisão — depois delas, as fases podem executar conforme planejado.
