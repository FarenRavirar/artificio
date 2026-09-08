# Tasks 097 — Investigação e inventário

`spec.md` = problema e critérios · `plan.md` = fases e método ·
`specs/096-mesas-onboard-criacao/` = **fonte para toda dúvida sobre o editor**
(mapa de seções em `spec.md` §0.1).

**Esta spec não implementa.** Nenhuma task abaixo escreve código de correção,
migration ou refactor. A implementação é outra spec, construída a partir do
resultado desta (T-F entrega o recorte). Achado vira linha de inventário.

**A entrega de cada task é o bloco `### Achados` da fase correspondente no
`plan.md`**, preenchido pelo próprio agente. Task com bloco vazio não está
concluída. Regras do bloco no cabeçalho do `plan.md`.

**Paralelismo:** T-A, T-B, T-C e T-D são independentes. T-E depende das quatro.
T-F depende de T-E.

---

## T-A — Inventário de paridade (fase A)

**Depende de:** nada · **Bloqueia:** T-E

### Passos

1. Extrair os campos de `DiscordTableDraftTable`
   (`apps/mesas/backend/src/discord/types.ts`). Separar campo de mesa de
   metadado interno (`_*`, sub-objetos de sugestão, telemetria de learning).
2. Extrair o que `mapApiToEditorState` lê (`editorMapping.ts:597`).
3. Extrair o que `editorStateToPayload` escreve (`editorMapping.ts:268`).
4. Extrair o que a validação exige — `tableValidators.ts` (backend) e
   `editorValidation.ts` (front), inclusive os condicionais
   (`isConditionallyRequired`).
5. Listar as colunas reais: `information_schema.columns` para `tables`,
   `table_contacts`, `table_schedules` em produção.
6. Montar a tabela de uma linha por campo com as colunas do `plan.md` fase A.
7. Para cada `divergência-real`, contar o impacto em produção com `SELECT`, e
   escrever o parágrafo do que quebra e para quem.
8. Conferir cada divergência no código antes de registrar (armadilha do regex —
   `plan.md` fase A).

### Entregável

Tabela completa + um parágrafo por `divergência-real`. Cobre **todos** os
campos, não só os suspeitos.

### Pronto quando

- Nenhum campo do modelo fora da tabela.
- Toda linha `divergência-real` tem contagem em produção.
- As 7 linhas do ponto de partida foram reverificadas (confirmadas ou
  derrubadas, com comando).

**Fecha:** A1 (parcial), A2.

---

## T-B — Inventário de visibilidade (fase B)

**Depende de:** nada · **Bloqueia:** T-E

**Contexto obrigatório:** ler `plan.md` fase B inteira antes de começar. A
hipótese `z-index` está **fechada** por decisão do mantenedor; o método de
varredura com `elementFromPoint` está registrado como **falho** (423 falsos
positivos). Não repetir nenhum dos dois.

### Passos

1. **Obter o relato nomeado.** Transformar "não dá para ver várias coisas" em
   lista de elementos. Se não for possível obter do mantenedor, registrar como
   bloqueio — não inventar hipótese para preencher.
2. Abrir o editor em **beta e produção**, nos dois temas, em 1366×768,
   1920×1080 e mobile (390px).
3. Para cada suspeita do `plan.md` fase B, medir: `overflow` de ancestrais,
   conteúdo sob barra de estado / rodapé em pior caso (7 pendências = 864px),
   `contentOverflow` do `ContentEditor`, contraste em tema claro, zoom ≠ 100%.
4. Desenvolver um critério de sobreposição que separe *coberto* de *fora da área
   visível do scroller*, e **conferir amostra à mão** antes de confiar no número.
5. Varrer `z-index` do repo contra a escala do pacote (header 50, modal/drawer
   100, toast 9999): `rtk rg "z-index" apps/ packages/`.
6. Percorrer as **7 partes** do editor (`identity`, `when`, `where`, `values`,
   `audience`, `master`, `extras`), não só a primeira.

### Entregável

Lista de uma linha por elemento inalcançável, com as colunas do `plan.md` fase
B. Se vazia, a linha única traz o comando que prova.

### Pronto quando

- As 7 partes foram percorridas nos dois temas e em 3 viewports.
- Cada item tem causa medida, não suposta.
- **Não fecha por "o `z-index` foi corrigido".**

**Fecha:** A5.

---

## T-C — Inventário de contatos (fase C)

**Depende de:** nada · **Bloqueia:** T-E

### Passos

1. Extrair os 208 contatos de produção (`table_contacts`) e os de beta,
   marcando o que é seed em beta (`dummy_contact` — 12 dos 19, medido).
2. Rodar a regra real **de cada canal** contra cada valor:
   `validateContactValue` (`safeExternalUrl.ts:276`) e `contactSchema`
   (`tableValidators.ts:50-105`). Os canais `email`, `phone`, `discord`,
   `facebook`, `instagram` **nunca foram testados** — a medição de 2026-08-26
   cobriu só `whatsapp` e `form`.
3. Classificar cada contato: `determinística` / `inferência` / `sem-conversão` /
   `desnecessária`, com o valor resultante da conversão quando houver.
4. Para os de `inferência`, medir o que sustenta a inferência — ex.: DDD
   brasileiro válido nos 6 WhatsApp sem DDI.
5. Para os `sem-conversão`, medir o efeito de cada opção de D2 sobre a página
   pública e sobre a edição, contato a contato.
6. Montar o sumário por canal: total, falhas, e a regra que reprovou.
7. Alimentar D1/D2/D3 (`spec.md` §4) com custo por opção — **medir, não
   escolher**.

### Entregável

Tabela dos 208 + sumário por canal + custo medido das opções de D1/D2/D3.

### Pronto quando

- Nenhum contato marcado "não sei".
- Todos os canais testados, não só dois.
- Beta separado de produção, seed marcado.

**Fecha:** A3, A6.

---

## T-D — Mapa das portas de escrita (fase D)

**Depende de:** nada · **Bloqueia:** T-E

### Passos

1. Buscar **toda** escrita em `tables` e `table_contacts` no repo inteiro (não
   só `apps/mesas`): `insertInto('table_contacts')`, `insertInto('tables')`,
   `INSERT INTO`, `.values(`, `onConflict`. Incluir `scripts/`, seed, backfill,
   migration, rota administrativa e job.
2. Para cada porta: registrar `arquivo:linha`, e medir se passa por
   `contactSchema` / `createTableSchema` / `updateTableSchema` ou grava direto.
3. Contar quantos registros de produção vieram de cada porta, quando der para
   distinguir (origem, `source`, padrão de `label`).
4. Datar os registros sujos por porta e cruzar com a data dos guards já
   aplicados — diz qual porta **ainda** está aberta. Medido: 1 sujo em
   `2026-08-05`, posterior ao guard de `2026-08-03`.
5. Tentar **derrubar** a hipótese de que só existem duas portas.

### Entregável

Tabela com as colunas do `plan.md` fase D, uma linha por porta.

### Pronto quando

- A busca cobriu o repo inteiro, com os comandos citados.
- Cada porta tem "valida / não valida" medido, não inferido.

**Fecha:** A4.

---

## T-E — Adversarial: derrubar os inventários (fase E)

**Depende de:** T-A, T-B, T-C, T-D · **Bloqueia:** T-F

O agente lê os blocos `### Achados` das quatro fases e é instruído a
**refutar**. Cinco alvos no `plan.md` fase E, o primeiro sendo o de pior
histórico ("o topo escondido está mapeado" já falhou duas vezes).

### Passos

1. Alvo 1 — medir por conta própria em beta e produção, sem confiar na T-B.
2. Alvo 2 — procurar a terceira porta onde a T-D não olhou.
3. Alvo 3 — comparar as duas validações **entrada por entrada**.
4. Alvo 4 — conferir se a T-C testou mesmo todos os canais.
5. Alvo 5 — teste direto: amostra de mesas reais → `mapApiToEditorState` +
   validação sobre payload real → contar quantas publicam.

### Entregável

Um veredito por alvo, com medição própria. Alvo que derruba conclusão de A–D
**corrige o bloco `### Achados` daquela fase**, e a correção fica registrada em
`### Achados` da fase E.

### Pronto quando

- Os 5 alvos respondidos com comando próprio.
- Nenhum veredito baseado em leitura dos achados alheios.

---

## T-F — Síntese e recomendação de recorte (fase F)

**Depende de:** T-E

### Passos

1. Consolidar A–E numa lista priorizada: o que corrigir, impacto medido, custo,
   e o que quebra se ficar para depois.
2. Mapear dependências entre itens, com a razão medida (ex.: fechar a porta
   antes de normalizar o dado).
3. Consolidar as opções de D1/D2/D3 com custo por opção e recomendação.
4. Listar o que **não** vale corrigir, com motivo.
5. Propor o recorte da spec de implementação: uma ou várias, e a fronteira de
   cada uma.

### Entregável

Seção que permite ao mantenedor abrir a spec de implementação lendo só ela.

### Pronto quando

- Toda `divergência-real` de A–D aparece na lista priorizada ou na lista do que
  não vale corrigir.
- D1/D2/D3 têm custo por opção.

**Fecha:** A7.

---

## Trava final

**A8 — nenhum arquivo de código de produção alterado por esta spec.**
Verificar antes de encerrar: `rtk git status` deve mostrar apenas
`specs/097-*/`. Script de medição vai para o scratchpad, não para o repo.

Exceção já ocorrida e registrada: a correção de `z-index` em `TableEditor.css`
mais o teste em `TableEditor.test.tsx`, aplicados na sessão de diagnóstico que
originou esta spec (`spec.md` §0). Fato consumado, não precedente.

---

## Bloqueios aguardando o mantenedor

Nenhum. D1/D2/D3 **não bloqueiam** esta spec — ela mede as opções; a escolha
entra na spec de implementação.
