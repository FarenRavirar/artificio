# Tasks 098 — Forma e usabilidade do editor

`spec.md` = problema e critérios · `plan.md` = fases e método ·
`specs/096-mesas-onboard-criacao/` = **decisões de produto do editor**.

**A entrega de cada task é o bloco `### Achados` da fase no `plan.md`**,
preenchido pelo agente com a medição que sustenta cada afirmação.

**Duas travas valem para todas:**

1. **Teste que falha sem a correção** — verificado reintroduzindo o defeito, não
   presumido (A10).
2. **Onde a correção pertence, medido** (AGENTS.md §Compartilhado por padrão;
   spec §6.10): antes de corrigir, `rtk rg` nos outros apps. Task que entrega
   "ajustei os N valores do `mesas`" **não está concluída** — é o caso
   particular que a regra pétrea proíbe. A resposta só é "no app" quando o
   defeito de fato não existe fora dele.

---

## T-A — Campos de texto que cabem a resposta

**Depende de:** nada (D1 resolvida na pesquisa, spec §6.1) · **Bloqueia:** T-E

### Passos

1. Medir o conteúdo real: quantos caracteres têm as descrições e bios das 121
   mesas de produção (`SELECT length(description)`), para saber qual é o caso
   típico e qual é o extremo.
2. Aplicar `field-sizing: content` **no `ContentEditor`**
   (`packages/content-editor`), não nos consumidores (spec §6.10). Já medido: o
   componente tem `minHeight = 192` de default, o `mesas` chuta seis valores por
   cima, e o `downloads` aceita `maxLength={50000}` na caixa fixa — mesmo
   defeito, sem reclamação.
3. Expor `min-height`/`max-height` por prop; o `max-height` sai do passo 1.
4. **Remover** do `mesas` os seis `minHeight` que deixarem de ser necessários —
   se sobrar algum, justificar por que aquele campo é exceção real.
5. Conferir o fallback nos ~16% sem suporte: tem de cair no comportamento atual,
   não em algo pior. E o `resize: vertical` continua disponível — a correção tira
   a **obrigação** de arrastar, não a possibilidade.
6. Verificar `downloads` e os demais consumidores do pacote antes de pedir a
   aprovação da ação.

### Pronto quando

- O conteúdo típico cabe sem rolagem interna nem arrasto, **no `mesas` e no
  `downloads`** — medido nos dois.
- Os `minHeight` locais foram removidos, ou cada sobrevivente tem justificativa.
- A medição antes/depois está no bloco, com número.
- Alteração em `packages/` com aprovação nominal registrada.

**Fecha:** A1.

---

## T-B — Ação que mostra o próprio resultado

**Depende de:** nada · **Bloqueia:** T-G

### Passos

1. Listar **todo** botão que adiciona item no editor, nas 7 abas — não só
   `Adicionar contato`. Medido: `+ estilo` na Identidade tem o mesmo desenho.
2. Para cada um: medir `scrollTop` e a posição do elemento novo antes e depois
   do clique.
3. Rolar até o item criado e dar foco ao primeiro campo dele.
4. Verificar o menu de canais que `Adicionar contato` abre — ele também nasce
   fora da vista.
5. Conferir o caso da aba já rolada até o fim: rolar de novo não pode saltar.

### Pronto quando

- Todo botão de adicionar deixa o item novo visível, medido.
- A lista cobre as 7 abas, não só a reclamada.

**Fecha:** A2.

---

## T-C — Botões: texto grudado, aperto e alvo pequeno

**Depende de:** nada — todas as decisões estão fechadas · **Bloqueia:** T-E

### Passos

1. **Consertar o `Button`** (`packages/ui/primitives.tsx:57`): o `<span>` com
   `nowrap` impede o consumidor de empilhar filhos. Já medido: 16 arquivos usam
   `<Button>`, 3 passam elemento aninhado, e só o `mesas` empilha dois textos —
   os outros dois não são afetados. Verificar os 16 mesmo assim antes de pedir a
   aprovação da ação (pacote compartilhado, §Autorização).
2. **NÃO trocar por radio** — decisão do mantenedor (spec §7): o bloco continua
   com os dois botões lado a lado, mesma aparência. O item 1 sozinho já elimina
   o texto grudado.
3. Corrigir `line-height` menor ou igual ao `font-size` nos botões — vale para
   `Sincronizar` (13/13) e os dois de papel (14/14).
4. Levantar os alvos nas 7 abas em duas faixas — **abaixo de 24px** (reprovam
   WCAG AA) e **entre 24 e 44px** (piso ok, abaixo do de toque) — e, para cada
   um, **de onde vem o tamanho**: `packages/ui` ou markup local. Corrigir cinco
   alturas à mão não impede a sexta (spec §6.10); se o tamanho nasce no pacote,
   a correção é lá.
5. Aplicar **24px no desktop** (WCAG AA) e **44px no mobile** (media query em
   719px), onde o controle vira alvo de toque. Não é escolha — é o contexto que
   define. Conferir que não quebra o alinhamento das linhas de campo.

### Pronto quando

- Nenhum alvo abaixo de 24px nas 7 abas; os de toque no mobile com 44px.
- **A origem de cada tamanho está medida** — e onde nasce no pacote, foi
  corrigido lá.
- Rótulo e explicação dos botões de papel aparecem separados.
- O conserto do `Button` está aplicado e os 16 consumidores conferidos.
- O bloco de papel continua botão, com título e explicação separados.

**Fecha:** A3, A7 (e A3-bis do texto grudado).

---

## T-D — Escala: largura, espaçamento e respiro

**Depende de:** nada (D3 resolvida na pesquisa, spec §6.3) · **Bloqueia:** T-E

### Passos

1. **Levar o espaçamento para o componente de campo** (`.artificio-field`, no
   pacote), com os dois valores de §6.6 — dentro do grupo e entre grupos. Usa
   `--space-1..6`, que já existe (`packages/ui/src/styles.css:62-66`).
   **Trocar as 8 ocorrências de `gap-3.5` por token não é a correção** (spec
   §6.10): é substituição, e o próximo campo escrito volta a chutar. A
   proximidade tem de ficar correta **por construção**, não por disciplina de
   quem escreve.
2. Dar respiro ao documento: hoje `padding: 0`, com o conteúdo encostando na
   barra de ações e na borda inferior.
3. **Trocar pixel por tamanho declarado:** o campo diz o tamanho esperado da
   resposta (curto / médio / longo) e o pacote traduz para largura. Hoje cada
   parte escolhe pixel a dedo (`!w-[206px]`, `!max-w-[560px]`, ou nada) — e
   Baymard (§6.2) é sobre a **resposta esperada**, não sobre o pixel. Casos
   medidos: `Horário de início` e `Frequência` com 844px para ~5 caracteres;
   `Para quem é` já usa 206px.
4. **Entregar DOIS valores, não um** (spec §6.6): espaço dentro do grupo
   (rótulo → campo) e espaço entre grupos, com o segundo maior que o primeiro.
   Valor uniforme não conserta a proximidade invertida.
5. Corrigir os casos medidos de inversão: `Horário de início`, `Frequência` e
   `Horário de término` (entre grupos = **0px**, rótulo→campo = 6px) e
   `Estilos/Temáticas` (**−169px**, sobreposto).
6. Estreitar `Descrição da mesa` para ~560px (§6.8): hoje tem **97 caracteres
   por linha** contra o ideal de 45-75. A largura já existe no editor — é a do
   `Título da mesa`.
7. Eliminar o `gap-3.5` (14px, 14 ocorrências) e o vão de 609px da Identidade.

### Pronto quando

- **Nenhum campo com o espaço entre grupos menor ou igual ao de dentro do
  grupo** — medido nas 7 abas, não presumido.
- Nenhum campo de resposta curta com largura de coluna inteira.
- Nenhum campo de texto acima de 75 caracteres por linha.
- O mapa cobre as 7 abas.

**Fecha:** A4, A5, A6.

---

## T-E — Medir a altura resultante

**Depende de:** T-A, T-C, T-D

**Reorganizar aba está fora de escopo** (decisão do mantenedor, spec §7).
Esta task **mede**, não propõe estrutura nova.

### Passos

1. Medir a altura das 7 abas depois de A, C e D.
2. Comparar com o registrado em §2.8 (Identidade: 2419px / 2,7 telas).
3. Se alguma aba **cresceu**, nomear o que a fez crescer — provável suspeito: o
   campo que passa a crescer com o conteúdo (§6.1), se o `max-height` ficou alto
   demais.

### Pronto quando

- Altura final de cada aba medida e comparada com a inicial.
- Nenhuma proposta de dividir aba ou mover campo.

**Fecha:** A8 (reduzido: medir, não reorganizar).

---

## T-F — Juntar "Quando joga" e "Onde joga"

**Depende de:** T-D (dura) · **Bloqueia:** T-G

**Decisão do mantenedor** (spec §7, D2b), não proposta do agente. Medido:
796px + 420px = **1216px**, ou **1,3 rolagem** — as duas abas hoje ocupam a tela
inteira sozinhas com conteúdo bem menor.

**Por que depende de T-D e não pode inverter:** os campos de horário são os que
têm proximidade invertida (`0px` entre grupos, spec §6.6). Juntar antes de
corrigir o espaçamento entrega dez campos indistintos num bloco só.

### Passos

1. Definir o nome da aba resultante — hoje são dois títulos.
2. Decidir se os dois assuntos ganham cabeçalho de seção interno. Com 10 campos
   seguidos e sem separação, é o caso que §6.6 descreve.
3. Mover os campos, definindo a ordem na aba nova.
4. **Atualizar `EDITOR_PARTS` e `partOfField`** (`editorValidation.ts`): eles
   decidem em qual aba cada erro aparece no rodapé de pendências. Mover campo sem
   isso manda o mestre para aba errada ao clicar numa pendência.
5. Conferir a lateral: uma aba a menos muda a navegação e a barra de progresso.
6. Verificar a versão mobile (media query em 719px), onde a lateral vira faixa
   horizontal — uma aba a menos muda o que cabe ali.

### Pronto quando

- A aba nova está medida (altura, rolagens, proximidade entre campos).
- Nenhuma pendência aponta para aba inexistente — testado clicando nas
  pendências de um anúncio incompleto.
- A navegação lateral e a versão mobile conferidas.

**Fecha:** D2b.

---

## T-G — Verificação nas 7 abas, 2 temas, 2 viewports

**Depende de:** T-A, T-B, T-C, T-D, T-E, T-F

### Passos

1. Percorrer as abas (**6**, após a fusão de T-F) em tema **claro e escuro**, em **1366×768 e 1920×1080**.
2. Repetir com uma mesa **vazia** — metade dos defeitos de layout só aparece
   sem conteúdo para sustentar a caixa.
3. Reverificar cada item de §2 da spec: o número mudou para melhor?
4. Registrar o que piorou, se algo piorou.

### Pronto quando

- Todas as abas verificadas nas 4 combinações, com mesa cheia e vazia —
  incluindo a aba nova de T-F.
- Cada medição de §2 tem o valor final ao lado do inicial.

**Fecha:** A9.

---

## Decisões — todas fechadas

- ~~**D1**~~ — resolvida na pesquisa (spec §6.1): `field-sizing: content`.
- ~~**D3**~~ — resolvida na pesquisa (spec §6.3): tokens `--space-*` do pacote.
- ~~**D2**~~ — **fora de escopo** por decisão do mantenedor: a organização das
  abas fica como está.
- ~~**D4'**~~ — **decidido: continua botão** (2026-08-27). Só o texto deixa de
  sair grudado.
- ~~**D4** (consertar o `Button`)~~ — **não é decisão, é conserto.** Defeito do
  pacote sob qualquer resposta. O que precisa de você é a **aprovação da ação**
  (alterar `packages/ui`), com o conserto já medido e pronto.
- ~~**D5**~~ — **retirada, não era decisão.** Norma, não política: 24px no
  desktop (WCAG AA, obrigatório) e 44px onde o controle vira alvo de toque no
  mobile. A fase C implementa.
