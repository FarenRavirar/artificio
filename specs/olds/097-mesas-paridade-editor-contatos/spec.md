# Spec 097 — Inventário de paridade do editor de anúncio (INVESTIGAÇÃO)

**App:** `mesas` · **Criada:** 2026-08-26 · **Status:** aberta
**Tipo:** **investigação e inventário. Esta spec NÃO implementa.**
**Origem:** achado do mantenedor (2026-08-26): *"o editor tem que funcionar 100%
no lugar do que o onboard funcionava"*, após a pergunta "as mesas em produção vão
conseguir editar no novo editor?"

---

## 0. O que esta spec é, e o que ela não é

**É:** um inventário completo e medido de tudo que impede o editor de anúncio de
substituir 100% o fluxo antigo. Cada item com comando citado, impacto real em
produção contado, e causa raiz identificada.

**Não é:** implementação. Nenhuma task desta spec escreve código de correção,
migration ou refactor. A correção vive numa **spec seguinte, construída a partir
do inventário desta** — o mantenedor decide quando abri-la e com qual recorte.

Por que separar: as rodadas de 2026-08-25 e 2026-08-26 corrigiram sintoma antes
de ter o mapa, e o mantenedor voltou duas vezes dizendo que "não adiantou nada".
Investigar e implementar no mesmo passo foi o que produziu isso.

**MUDANÇA DE ESCOPO (2026-08-27, decisão do mantenedor): _"corrija tudo antes
de subir no commit"_.** A spec deixou de ser só inventário para a frente do
EDITOR: os defeitos de tela achados na fase B foram corrigidos nesta sessão, com
teste de regressão e validação medida. O critério **A8** ("nenhum código de
produção alterado") fica **suspenso para os arquivos do editor**, e o que vale
no lugar é: toda correção tem teste que a trava, e o mantenedor confirma no beta
antes de qualquer promoção.

O que **não** mudou: a frente de CONTATOS (portas de escrita, normalização dos
19) segue inventário — nenhuma linha de dado foi tocada, nenhuma escrita em
banco. E produção continua fora: o mantenedor vetou o deploy enquanto o beta não
estiver aprovado por ele.

**Exceção única já ocorrida:** durante o diagnóstico que originou esta spec, uma
correção de `z-index` foi aplicada em `TableEditor.css` (detalhe no `plan.md`
fase B). Está registrada como fato consumado, não como precedente — nenhuma task
daqui em diante corrige nada.

### 0.1 Fonte para dúvidas: a spec 096

Toda dúvida sobre **por que o editor é como é** — decisão de produto, campo que
entrou ou saiu, requisito numerado (`R1`…`R24`), critério de aceite (`A1`…`A18`),
gap original — se responde em `specs/096-mesas-onboard-criacao/`, que é a spec
que construiu o editor. Mapa útil do `spec.md` de lá:

| Dúvida | Seção da 096 |
|---|---|
| Por que o editor substituiu o onboard em etapas | §Gap 1 |
| Parser "colar anúncio" — o que se esperava dele | §Gap 4 |
| Obrigatório vs opcional, e as marcas na UI | §Gap 5 |
| Campos com cadeia pronta e sem entrada | §Gap 11 |
| Organização das partes (banner, horários, valores) | §Gap 10 |
| Redundância nos campos de texto grande | §Gap 8 |
| O corte campo a campo decidido pelo mantenedor | §Decisão do mantenedor (2026-08-23) |
| O que entrou e o que ficou fora de propósito | §Decisões de escopo · §Fica fora |
| Requisitos numerados `R*` | §Requisitos |
| Critérios `A*` (inclusive o A1 de rolagem) | §Critérios de aceite |

Regra: **antes de registrar algo como defeito, conferir na 096 se é decisão.**
Comportamento que a 096 decidiu de propósito não é bug — é escopo. Se o agente
discordar da decisão, isso é achado para o mantenedor, não correção a fazer.

---

## 1. O que já foi medido (ponto de partida, a reverificar)

Medições de 2026-08-26 sobre `mesas-db` / `mesas_rpg` (produção): **121 mesas,
todas `active`, 208 contatos**. Registradas com o comando que as produziu para
que o agente confirme ou derrube — não para que confie.

### 1.1 Obrigatórios do editor × mesas reais

```sql
SELECT count(*) AS total,
  count(*) FILTER (WHERE description IS NULL OR length(trim(description))<10) AS desc_ruim,
  count(*) FILTER (WHERE system_id IS NULL) AS sem_sistema,
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM table_schedules s WHERE s.table_id=t.id)) AS sem_horario
FROM tables t;
-- → total=121, desc_ruim=2, sem_sistema=2, sem_horario=20
```

| Campo obrigatório | Mesas que falham | Bloqueia publicar? |
|---|---|---|
| `title`, `slots_total`, `slots_open`, limites de texto | 0 | — |
| `contacts` (existir ao menos 1) | 0 | — |
| `schedules` (existir) | 20 | **não** — `defaultSession()` cobre |
| `description` (mín. 10) | 2 | sim |
| `system_id` | 2 | sim |
| `contacts` (valor válido no canal) | até 19 mesas | sim |

As 20 sem `table_schedules` não bloqueiam: `mapApiToEditorState` cai em
`defaultSession()` (`editorMapping.ts:554`) e `schedulesError`
(`editorValidation.ts:261`) exige só `length>0` e `day_of_week`.

### 1.2 Contatos inválidos (19 de 208)

```sql
SELECT channel, value FROM table_contacts
WHERE (channel='whatsapp' AND trim(value) !~ '^\+[0-9]{7,17}$')
   OR (channel='form' AND value !~* '^https://');
```

| Grupo | N | Exemplo |
|---|---|---|
| WhatsApp com separador, com DDI | 3 | `+55 11976658921` |
| WhatsApp sem DDI | 6 | `31 98487-5355` |
| WhatsApp que é URL `wa.me` com número | 2 | `https://wa.me/5563992681119` |
| WhatsApp URL sem número extraível | 4 | `https://chat.whatsapp.com/HBbv…` |
| `form` que é nick, não URL | 3 | `.zero9899`, `uwill` |
| `api.whatsapp.com/send?phone=` | 1 | `…?phone=5593992155816` |

### 1.3 Hipótese de causa raiz (a refutar, não a assumir)

Duas portas de escrita de contato com regras diferentes:

```
API pública ──> contactSchema (tableValidators.ts:50-105) ──> table_contacts
                  regex ^\+\d{1,3}\d{6,14}$ para whatsapp (:61)

Importador ───> extractContacts (syncHelpers.ts) ───────────> table_contacts
                  isReachableContactValue devolve `true` INCONDICIONAL
                  para 'whatsapp' e 'discord'
```

O front espelha a regra da API à mão (`safeExternalUrl.ts:276`). O editor da 096
foi o primeiro consumidor a **reler** contato salvo e aplicar a regra — por isso
parece a causa e não é.

Indício de que não é só dado histórico: 1 contato sujo criado em `2026-08-05`,
depois do guard de `2026-08-03` que fechou o caso `form`/`uwill`
(`https://chat.whatsapp.com/HBbv2rWRov26uywRtD5ZlO`).

### 1.4 O que NÃO é o problema

O pedido inicial falava em *"descartar campos que a mesa nova não tem"*. Medido:
`mapApiToEditorState` (`editorMapping.ts:597-705`) lê 40+ campos e **todos
existem** em `tables`. Não há campo órfão a descartar. O problema é valor fora de
contrato em campo que continua existindo.

---

## 2. Objetivo desta spec

Produzir um inventário que permita ao mantenedor **decidir o recorte da spec de
implementação** sem precisar redescobrir nada. Concretamente, ao fim desta spec
deve existir:

1. **Inventário de paridade** — todo caminho pelo qual dado válido no modelo
   antigo nasce ineditável no editor novo, com impacto contado em produção.
2. **Inventário de visibilidade** — todo elemento do editor que o usuário não
   consegue ver ou alcançar, com causa medida (a lista que falta desde
   2026-08-25).
3. **Inventário de contatos** — os 208 contatos classificados por conversão:
   determinística, inferência, ou sem conversão.
4. **Mapa das portas de escrita** — toda porta que grava em `tables` /
   `table_contacts`, e se valida ou não.
5. **Recomendação de recorte** — o que a spec de implementação deve atacar
   primeiro, com o porquê. Recomendação, não decisão.

---

## 3. Escopo

**Dentro:** medir, contar, classificar, mapear e registrar. Ler código, banco de
produção e beta, e a aplicação no navegador.

**Fora:**
- **Qualquer implementação** — correção, migration, refactor, remoção de código.
  Achado vira linha de inventário, não commit.
- Rever decisão de produto da 096. Divergir do que ela decidiu é achado para o
  mantenedor (§0.1).
- Decidir D1/D2/D3 (§4). A spec **mede as opções**; quem escolhe é o mantenedor.

---

## 4. Decisões que a implementação vai precisar — a spec MEDE, não decide

Marcadas como **inferência a confirmar**. O entregável desta spec é o **custo e
a viabilidade medidos de cada opção**, para o mantenedor escolher com dado na
mão (§Regras Pétreas → Evidência item 3: opção oferecida é opção verificada).

**D1 — WhatsApp sem DDI (6 contatos).** `45 988003126` → `+5545988003126`
assume Brasil.
*A spec entrega:* quantos têm DDD brasileiro válido, quantos são ambíguos, e o
que acontece com cada um se não for convertido.

**D2 — Contato sem número/URL extraível (7 contatos).** Opções levantadas:
(a) mover para `form`; (b) mover nicks para `discord` — que é o que o guard de
2026-08-03 já faz na origem; (c) não tocar.
*A spec entrega:* o efeito medido de cada opção sobre a página pública e sobre
a edição, contato a contato.

**D3 — Fechar o importador muda o que ele produz.**
*A spec entrega:* quantos anúncios do corpus de teste mudariam de resultado, e
como.

---

## 5. Critérios de aceite

Todos são de **inventário**, não de correção.

- **A1.** Os cinco inventários de §2 existem, cada linha com comando citado.
- **A2.** Toda medição de §1 foi reverificada; divergência registrada.
- **A3.** Os 208 contatos estão classificados por conversão (determinística /
  inferência / sem conversão), não só os 19 já vistos.
- **A4.** Toda porta de escrita em `tables`/`table_contacts` está mapeada, com
  "valida / não valida" medido — inclusive as que ninguém suspeita.
- **A5.** A lista de elementos que o mantenedor não consegue ver existe, com
  causa medida por item.
- **A6.** D1, D2 e D3 têm custo e viabilidade medidos por opção.
- **A7.** A recomendação de recorte da spec de implementação existe, priorizada,
  com o porquê de cada prioridade.
- **A8.** ~~Nenhum arquivo de código de produção foi alterado por esta spec.~~
  **Suspenso em 2026-08-27 para os arquivos do EDITOR** (ver §0). Vale para a
  frente de contatos/dado, que segue sem alteração. Para o editor, o critério
  substituto é: cada correção tem teste de regressão que falha sem ela
  (verificado reintroduzindo o defeito), `tsc` e lint limpos, e confirmação do
  mantenedor no beta antes de promover.

---

## 6. Registro de erro próprio (sessão de diagnóstico, 2026-08-26)

Fica registrado porque muda como o agente desta spec deve trabalhar:

1. Afirmei que "o backend não valida contato" **antes** de ler
   `tableValidators.ts`. Falso — valida em `:61`, com a mesma regex do front.
2. Uma varredura de sobreposição com `elementFromPoint` devolveu 423 falsos
   positivos e quase virou achado. Método que produz 423 resultados numa tela
   com ~40 controles está errado, não a tela.
3. Corrigi o `z-index` no meio da investigação, contrariando o pedido de não
   implementar. É a razão de §0 existir com esse peso.
