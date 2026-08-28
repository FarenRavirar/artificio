# Plan 098 — Fases

`spec.md` = problema, medições e critérios · `specs/096-mesas-onboard-criacao/` =
**decisões de produto do editor** (quais campos existem, em que aba, por quê) ·
`specs/097-mesas-paridade-editor-contatos/` = o que já foi consertado.

**Regra que vale para todas as fases.** Antes de mudar a forma de um elemento,
conferir na 096 se aquilo é decisão. Comportamento decidido de propósito não é
defeito de layout — divergir dele é achado para o mantenedor, não conserto.

**Cada fase preenche o próprio bloco `### Achados`**, com o comando ou a medição
que sustenta cada afirmação. Fase com bloco vazio não está concluída.

---

## Regra que governa todas as fases: onde a correção pertence

AGENTS.md §Regras Gerais de Código → *Compartilhado por padrão; exceção por app
é o defeito (pétrea)*:

> **"Solução dinâmica, não caso particular.** (…) ela pertence ao contrato
> compartilhado, onde vale para todos, inclusive para o próximo app que ainda
> não existe."

**Antes de corrigir qualquer item, a fase responde — medindo, não supondo:**

1. **O defeito existe fora do `mesas`?** `rtk rg` nos outros apps e pacotes.
2. **O valor está sendo declarado quantas vezes?** Se está espalhado, trocar
   ocorrência por ocorrência é substituição, não conserto — o próximo campo
   escrito volta a chutar.
3. **Onde a correção impede a recorrência?** Se a resposta é "no pacote", vai
   para o pacote — com aprovação nominal da ação (§Autorização) e verificação
   dos consumidores.

Já medido, e vale de partida (spec §6.10): o `ContentEditor` tem `minHeight=192`
como default e o `mesas` **chuta seis valores por cima** (180/120/112/100/96/120);
o `downloads` não passa nenhum e aceita `maxLength={50000}` na caixa fixa — **o
mesmo defeito, só que ninguém reclamou ainda**. O `gap-3.5` está em **8
arquivos** do editor.

**Corolário:** uma fase que entrega "ajustei os seis números" ou "troquei as oito
ocorrências" **não está concluída** — entregou o caso particular que a regra
proíbe.

---

## Fase A — Campos de texto que cabem a resposta

**Alvo:** §2.1 e §2.3-ter. `Descrição da mesa` (180px para 580px de conteúdo,
31% visível) e `Bio do mestre` (120px, ~2 linhas visíveis).

**D1 já está resolvida pela pesquisa (spec §6.1):** `field-sizing: content` com
`min-height` e `max-height` declarados. Padrão moderno, 84% de suporte
(caniuse), sem JavaScript — a fonte desaconselha o truque de
`height=auto`+`scrollHeight` por forçar recálculo de layout a cada tecla. O
`max-height` responde à objeção de piorar a densidade (§2.8). Os ~16% sem
suporte caem no comportamento atual, que não é pior que hoje.

A fase **não redecide isso** — implementa e mede.

**A correção pertence ao PACOTE, não ao app (spec §6.10).** Medido: o
`ContentEditor` já tem `minHeight = 192` como default
(`packages/content-editor/src/ContentEditor.tsx:132`), e o `mesas` chuta **seis
valores por cima** — `180`, `120`, `112`, `100`, `96`, `120`. O `downloads` não
passa nenhum e aceita `maxLength={50000}` na caixa fixa: **quebra igual, só não
foi reclamado**.

Ajustar os seis números do `mesas` é o caso particular que a regra pétrea
proíbe. O que escala: `field-sizing: content` **dentro do `ContentEditor`**, uma
vez, com `min-height`/`max-height` expostos por prop — resolve `mesas` e
`downloads` juntos, e o próximo app já nasce certo.

Isso torna a fase uma mudança em `packages/*`: exige **aprovação nominal da
ação** (§Autorização) e verificação dos consumidores. O agente chega com o
conserto medido e pronto, e pede a aprovação — não apresenta o achado como
bifurcação.

**Entregável:** o componente corrigido; as caixas do `mesas` e do `downloads`
cabendo o conteúdo real, medidas; e a lista dos seis `minHeight` que puderam ser
**removidos** do `mesas` por deixarem de ser necessários.

### Achados

_(vazio — fase não executada)_

---

## Fase B — Ação que mostra o próprio resultado

**Alvo:** §2.2. `Adicionar contato` cresce a parte em 108px e **não rola**
(`scrollTop` fica 0 com 149px disponíveis). O bloco novo e o menu de canais
nascem fora da vista.

**Método:** rolar até o item criado e dar foco ao primeiro campo dele. Verificar
o mesmo padrão em **todo** botão que adiciona linha no editor — não só contato
(medido: `+ estilo` na aba Identidade tem o mesmo desenho).

**Entregável:** lista de todos os botões que adicionam item, com o
comportamento antes e depois, medido por `scrollTop` e posição do elemento novo.

### Achados

_(vazio — fase não executada)_

---

## Fase C — Botões: texto grudado, aperto e alvo pequeno

**Alvo:** §2.3, §2.3-bis, §2.7.

1. **Texto grudado nos botões de papel** (§2.3-bis) — causa raiz medida está em
   `packages/ui/primitives.tsx:57`: o `Button` embrulha todos os children num
   `<span>` único com `display: block` e `white-space: nowrap`, então o
   `flex-col` do consumidor não separa nada.
2. **`line-height` igual ou menor que `font-size`** em botão de 32-42px — texto
   espremido. Vale para `Sincronizar` (13/13) e para os dois botões de papel
   (14/14).
3. **Alvos pequenos**, com o critério corrigido (spec §6.4): o piso obrigatório
   no desktop é **24px** (WCAG 2.2 SC 2.5.8 AA), não 44px — 44/48px são
   diretrizes de toque. Cinco controles com 16-20px reprovam o piso; os de
   32-42px passam nele e ficam abaixo do recomendado para toque, o que importa
   na versão mobile (media query em 719px).

**A pesquisa mudou a natureza do item 1 (spec §6.5).** O bloco é escolha
exclusiva entre duas opções, cada uma com explicação — isso tem componente
próprio no GOV.UK: **radio com hint**, com `aria-describedby`. Consertar o
`Button` resolve o sintoma; adotar radio resolve a causa (e o `aria-pressed`
fixo, que já é problema conhecido nesta base).

É a **D4**, e a fase entrega as duas medidas: quantos consumidores do `Button`
passam mais de um filho hoje (alcance do conserto no pacote) e como o bloco fica
com radio. Recomendação registrada na spec: radio aqui, conserto do `Button`
como trabalho separado — porque o `<span>` com `nowrap` é defeito do pacote de
qualquer jeito.

**Entregável:** tabela de todos os controles abaixo de 24px (reprovam AA) e dos
entre 24 e 44px (piso ok, abaixo do de toque), com o tamanho proposto e quais
sobrevivem na versão mobile; mais a medição de impacto do conserto do `Button` e
o protótipo do bloco com radio.

### Achados

_(vazio — fase não executada)_

---

## Fase D — Escala: largura, espaçamento e respiro

**Alvo:** §2.4, §2.5, §2.6.

- **Respiro:** documento com `padding: 0`; conteúdo encosta na barra (57px) e na
  borda inferior.
- **Largura sem escala:** 399, 560, 711, 715, 810, 844 convivendo sem regra.
  `Horário de início` e `Frequência` com 844px para 5 caracteres.
- **Espaçamento com proximidade INVERTIDA** (spec §6.6, mais grave que a falta
  de escala): em três campos de `Quando joga` o espaço entre grupos é **0px**
  enquanto o rótulo fica a 6px do próprio campo — o olho lê o rótulo como
  pertencente ao campo de cima. Um caso com **−169px** (sobreposto). A regra da
  NN/g é **relativa**: entre grupos > dentro do grupo. Trocar `gap-3.5` por um
  token **não conserta isso** se o valor for uniforme.
- **Largura da caixa de texto acima do legível** (§6.8): `Descrição da mesa` tem
  **97 caracteres por linha**, contra o ideal de 45-75 (alvo 66). A largura que
  daria 66 é **544px** — praticamente os 560px que o `Título da mesa` já usa.

**D3 já está resolvida pela pesquisa (spec §6.3):** a escala existe —
`--space-1..6` em `packages/ui/src/styles.css:62-66`, base 4px. **O editor não
usa nenhum deles**, e a classe mais frequente é `gap-3.5` = 14px.

**Mas trocar as ocorrências não é a correção (spec §6.10).** Medido: o `gap-3.5`
está em **8 arquivos** do editor. Substituir oito por um token é substituição —
o próximo campo escrito volta a chutar valor, porque nada impede.

**O que escala:** o espaçamento sair do **componente de campo**
(`.artificio-field`, que já existe no pacote), com os dois valores que §6.6
exige — dentro do grupo e entre grupos. Assim nenhuma parte do editor precisa
declarar espaçamento, e a proximidade fica correta por construção, não por
disciplina de quem escreve.

Mesma lógica para a **largura**: hoje cada parte declara pixel (`!w-[206px]`,
`!max-w-[560px]`, ou nada). Escala é o campo declarar o **tamanho esperado da
resposta** (curto / médio / longo) e o pacote traduzir para largura — Baymard
§6.2 é sobre a resposta esperada, não sobre pixel escolhido a dedo.

A fase entrega, portanto, uma **mudança de contrato do campo**, não uma varredura
de valores. Pacote compartilhado → aprovação nominal da ação.

**Entregável:** mapa campo → largura para as 7 abas, com a largura escolhida a
partir do conteúdo esperado (Baymard: faixa típica 18-33 caracteres); e a
substituição dos espaçamentos soltos pelos tokens `--space-*`, com o `gap-3.5`
(14px, 14 ocorrências) eliminado.

### Achados

_(vazio — fase não executada)_

---

## Fase E — Medir a altura resultante (não reorganizar)

**Alvo:** §2.8, com o escopo reduzido pelo mantenedor.

**Reorganizar a aba está FORA DE ESCOPO** (decisão de 2026-08-27: *"sobre
quantos campos ou passos, não precisa, pode manter do jeito que está"*). Esta
fase **não** divide aba, não move campo e não propõe passos.

O que ela faz: medir a altura das 7 abas **depois** de A, C e D, e registrar o
resultado. A altura cai como consequência — a caixa de texto fica mais estreita
(mais linhas, porém legíveis) e o espaçamento é normalizado.

Medido para referência: cortando 30% dos três maiores blocos, a aba iria de
2419px para 1951px — ainda 2,2 telas. **A rolagem longa permanece, e está
aceita.**

**Entregável:** tabela de altura por aba, antes e depois. Se alguma aba piorar,
nomear o que a fez crescer.

### Achados

_(vazio — fase não executada)_

---

## Fase F — Juntar "Quando joga" e "Onde joga"

**Decisão do mantenedor (2026-08-27):** *"quando e onde jogam podem ficar na
mesma."* Não é proposta do agente — é escopo dado.

**Medido:** conteúdo real de 796px + 420px = **1216px**, contra 905px de área
visível → **1,3 rolagem**. As duas abas hoje ocupam a tela inteira sozinhas com
conteúdo bem menor, ou seja, há espaço ocioso nas duas.

**Depende da fase D, e a dependência é dura.** Os campos de horário são
exatamente os que têm proximidade invertida (`0px` entre grupos, spec §6.6).
Juntar antes de corrigir o espaçamento entrega dez campos indistintos num bloco
só — piora o que a fusão deveria melhorar.

**O que a fase precisa resolver além de mover os campos:**
- o nome da aba resultante (hoje seriam dois títulos);
- se os dois assuntos ganham cabeçalho de seção interno — pela Lei da
  Proximidade, dez campos seguidos sem separação é o caso que §6.6 descreve;
- a ordem dos campos na aba nova;
- `EDITOR_PARTS` e o mapa `partOfField` (`editorValidation.ts`), que decidem em
  qual aba cada erro aparece no rodapé de pendências — mover campo sem atualizar
  isso manda o mestre para a aba errada ao clicar numa pendência.

**Entregável:** a aba nova medida (altura, rolagens, proximidade), e a
confirmação de que nenhuma pendência aponta para aba inexistente.

### Achados

_(vazio — fase não executada)_

---

## Fase G — Verificação nas 7 abas, 2 temas, 2 viewports

**Alvo:** A9. Toda medição desta spec foi feita em **uma** mesa, **um** tema
(escuro) e **um** viewport (1815×962). Isso não fecha.

**Método:** percorrer as 7 abas em tema claro e escuro, em 1366×768 e 1920×1080,
com uma mesa cheia e uma vazia. O caso vazio importa: metade dos defeitos de
layout aparece quando o campo não tem conteúdo para sustentar a caixa.

**Armadilha registrada (não repetir):** minha medição de contraste acusou 13
falhas com razão `1.47` repetida — o parser não lia `oklab()`, o formato do
design system. Refeita pelo browser: são 2. Antes de reportar número de tela,
conferir o formato de cor que o design system usa de fato.

### Achados

_(vazio — fase não executada)_

---

## Ordem

```
A ─┐
C ─┼─> E ──────> G
D ─┴─> F ──────┘
B ─────────────┘
```

A, B, C e D são independentes. **G (juntar as abas) depende de D** — sem o
espaçamento corrigido, a fusão entrega dez campos indistintos. E depende de A, C
e D. G fecha, depois de tudo, e precisa incluir a aba nova.

## Riscos

- **Corrigir por app o que é do pacote.** O texto grudado (§2.3-bis) nasce no
  `Button` de `packages/ui`. Remendo local resolve a tela e deixa o defeito para
  o próximo consumidor — a "exceção por app" que o AGENTS.md trata como dívida.
- **Medir só a aba onde o defeito foi relatado.** Cinco dos oito achados desta
  spec vieram de varrer as 7 abas, não da aba reclamada.
- **Trocar decisão de produto por decisão de layout.** Dividir a aba Identidade
  (D2) e mudar a organização dos campos é escopo da 096, não daqui.
