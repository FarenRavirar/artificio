# Handoff — Perfil do mestre (spec 099)

**Para:** o agente que vai pesquisar e depois implementar o perfil do mestre.
**De:** o agente das specs 097/098 (editor de anúncio de mesa).
**Data:** 2026-08-27.

Você é o mesmo modelo que escreveu isto. Não é apresentação: é o que eu queria
ter sabido antes de começar, e o que me custou caro por não saber.

---

## 1. O que o mantenedor quer

O perfil do mestre é onde ele **vende o peixe** — onde constrói autoridade e
convence um jogador desconhecido a entrar na mesa dele. Não é uma página de
configurações com foto e bio; é a peça que responde *"por que eu jogaria com
essa pessoa?"*.

Essa é a única frase de escopo que você recebeu, e é de propósito. **A
investigação é sua.** O mantenedor vai rodar um *grill* em cima do que você
apresentar — então traga ideias sustentadas, não uma lista de campos.

**Duas etapas, nessa ordem, e ele nomeou assim:**

1. **Pesquisa** — melhores práticas de mercado, exemplos reais, organização,
   heurísticas. Entregável: material de decisão, não código.
2. **Código** — depois que ele decidir.

**Não misture as duas.** Foi o erro que mais custou nas specs anteriores: eu
corrigi durante a investigação, ele mandou parar, e a spec teve que ser
reescrita com uma seção explicando que não implementa.

---

## 2. O contexto que você herda

As specs **096, 097 e 098** refizeram por completo como o mestre **cria e edita**
o anúncio de uma mesa. Foram três rodadas:

- **096** — construiu o editor unificado (substituiu um wizard em etapas).
- **097** — investigação e inventário: paridade de campos, contatos, portas de
  escrita, visibilidade. Depois virou correção, por decisão dele.
- **098** — forma e usabilidade: o editor funcionava, mas a forma dos elementos
  obrigava o mestre a lutar contra a tela. **Não implementada ainda** — está
  aberta, com pesquisa feita e decisões fechadas.

**Leia a 098 antes de começar.** Ela tem a pesquisa de padrões (§6) que você vai
reusar quase inteira: espaçamento, largura de campo, altura de caixa de texto,
alvo de clique, escala. Não repita esse trabalho — cite e siga.

O perfil do mestre é a **próxima superfície** dessa mesma reforma. A coerência
entre as duas telas importa: o mestre vai do editor de anúncio para o perfil no
mesmo dia.

---

## 3. Os números que já estão medidos e valem aqui também

Da spec 098 §6, com fonte citada lá. **Não são opinião minha** — são referência
publicada, e o mantenedor já os aceitou:

| item | valor | origem |
|---|---|---|
| espaço rótulo → campo | 8px | proximidade (Gestalt/NN-g) |
| **espaço entre grupos** | **24px** | proporção 3:1 — o que agrupa |
| escala de espaçamento | 4, 8, 16, 24, 32, 48, 64 | Material 3; `--space-1..6` já existe em `packages/ui` |
| padding de seção | 32-48px | tabela de padding por papel do contêiner |
| altura de campo | 32 / 40 / 48px | Carbon (small/medium/large) |
| alvo de clique | 24px desktop (WCAG AA), 44px toque | WCAG 2.2 SC 2.5.8 |
| linha de texto | 45-75 caracteres, alvo 66 | tipografia |
| largura de campo | pelo **tamanho esperado da resposta** | Baymard |
| caixa de texto | `field-sizing: content` + min/max | 84% de suporte (caniuse) |

**A regra de espaçamento é relativa, não absoluta.** O erro que achei no editor
não foi o valor errado — foi a **proximidade invertida**: espaço entre grupos
de `0px` com rótulo a 6px do próprio campo. O olho lia o rótulo como pertencente
ao campo de cima. Meça isso no perfil; é invisível até você medir.

---

## 4. O que eu faria diferente — leia antes de agir

Cinco erros meus, cada um custou uma volta ou uma bronca.

**4.1. Parei de investigar quando achei uma explicação que encaixava.**
Descobri que produção estava 7 PRs atrás e vendi isso como a causa do editor
cortado. Era verdade e era irrelevante — o defeito estava no beta também. O
mantenedor teve que me corrigir para a spec não fechar errada.

> O critério de parada não é "achei uma explicação". É "medi tudo que pode mudar
> a resposta dele".

**4.2. Afirmei sem medir, e o número estava errado.**
Reportei 13 falhas de contraste com a mesma razão repetida. Meu parser não lia
`oklab()`, que é o formato do design system. Eram 2.

> Antes de reportar número de tela, confira o formato que o design system usa de
> fato. Número errado é pior que número nenhum.

**4.3. Chutei identificadores em vez de ler o schema.**
Aconteceu quatro vezes em uma sessão: nome de coluna, nome de rota, caminho de
endpoint. Cada chute custou uma volta.

> `information_schema`, o arquivo de rotas, o `--help`. Nunca a memória.

**4.4. Escrevi testes que não mordiam.**
Três deles passavam com o bug de volta. Um usava fake timers que não deixavam o
estado pintar; outro esperava 400ms num debounce de 500ms; um terceiro fazia
`rerender` sem clicar, e o handler nem executava.

> Depois de escrever o teste, **reintroduza o defeito e veja falhar**. Se passar,
> o teste não protege nada. E se a correção não mordir de jeito nenhum, diga isso
> no próprio teste em vez de deixá-lo parecendo prova.

**4.5. Devolvi ao mantenedor decisões que eram minhas.**
Apresentei "24px ou 44px?" como escolha dele. Não era: é norma. Apresentei o
banner como três opções. Não era: era defeito medido.

> O critério do AGENTS.md: *"a correção é a mesma sob qualquer resposta do
> mantenedor? Se sim, é conserto — não pergunta."* Ele te cobra por perguntar
> demais, e com razão.

---

## 5. A regra que governa o que você vai escrever

AGENTS.md §Regras Gerais de Código → **"Compartilhado por padrão; exceção por app
é o defeito (pétrea)"**. Eu li isso tarde, e ela derrubou metade do meu plano.

> *"Solução dinâmica, não caso particular. (…) ela pertence ao contrato
> compartilhado, onde vale para todos, inclusive para o próximo app que ainda
> não existe."*

Na prática, antes de corrigir qualquer coisa, responda **medindo**:

1. O defeito existe fora do `mesas`? (`rtk rg` nos outros apps)
2. O valor está declarado quantas vezes? Se está espalhado, trocar ocorrência por
   ocorrência é substituição, não conserto.
3. Onde a correção **impede a recorrência**?

Exemplo real que achei: o `ContentEditor` tem `minHeight = 192` de default, o
`mesas` chuta seis valores por cima, e o `downloads` sofre o mesmo defeito sem
nunca ter sido reclamado. Ajustar os seis números do `mesas` seria exatamente o
caso particular que a regra proíbe.

**O perfil do mestre tem alta chance de repetir isso** — é outra tela de
formulário, consumindo os mesmos pacotes.

---

## 6. Como conduzir a etapa de pesquisa

O que funcionou comigo, depois de duas tentativas fracas:

**Busca genérica não serve.** "Melhores práticas de formulário 2026" devolve
listicles. O que rendeu foi ir às fontes com autoridade e pedir o **número**:
Baymard, NN/g, GOV.UK, Carbon, Material, caniuse. E quando a página truncou,
buscar o número direto em vez de insistir na página.

**Traga exemplos reais, não princípios soltos.** Para o perfil, o mantenedor vai
querer ver como quem resolve esse problema resolve: plataformas onde alguém
constrói autoridade e converte desconhecido em cliente. Não vou listar quais —
é sua pesquisa, e a escolha de referências faz parte do que ele vai grelhar.

**Meça a tela real.** Tudo o que descobri de concreto veio de abrir o beta e
medir com `getBoundingClientRect`/`getComputedStyle`, não de ler código. O
mantenedor **autorizou o uso do Chrome** para isso nas sessões anteriores —
confirme com ele de novo, é autorização por ação.

**Registre o que descartou.** Ele lê isso. Achado do bot recusado, alternativa
avaliada, hipótese derrubada — silêncio sobre item descartado lê como
esquecimento.

**Registre seus próprios erros.** As specs 097 e 098 têm seção para isso, e ele
nunca reclamou de vê-los. Reclamou de não ver.

---

## 7. Como ele trabalha — o que economiza volta

- **Ele não escreve código.** Pergunta sobre "como o sistema é" se responde
  medindo, não perguntando a ele. Devolver isso é transferir trabalho que é seu.
- **Autorização é por ação, nunca acumula.** "Commit + push" autoriza *aquele*
  commit. Eu commitei uma segunda vez achando que a autorização valia, e ele
  reagiu com razão. Desfiz com `reset --soft`.
- **Ele interrompe no meio do turno.** Mensagens chegam enquanto você trabalha,
  frequentemente corrigindo o rumo. Leia e ajuste na hora; não termine o que
  estava fazendo por inércia.
- **Ele responde curto e cobra direto.** "não sei cara, não sei" significa que
  você está pedindo demais dele. "voce tem internet" significa que a resposta
  existe publicada e você não foi buscar.
- **Comunicação em português.** Sem emoji decorativo, sem tabela enfeitada, sem
  elogiar a própria entrega.

---

## 8. Travas operacionais que valem sempre

Do AGENTS.md, e todas me pegaram em algum momento:

- **Nada de commit, push, deploy, escrita em banco ou em `packages/*` sem
  autorização nominal, a cada vez.** Chegue com o trabalho medido e pronto, e
  peça a aprovação da **ação** — não apresente o achado como bifurcação.
- **`rtk` no lugar de comando cru** (`rtk rg`, `rtk read`, `rtk git`, `rtk pnpm`).
  Há hooks que bloqueiam o contrário.
- **`pnpm verify:api` antes do `git add`**, quando tocar `apps/**` ou
  `packages/**` — senão os artefatos regenerados ficam de fora do commit.
- **Validação pontual durante o trabalho**, repo-wide só no fim. A máquina dele
  trava com `test`/`lint`/`build` simultâneos.
- **Nunca desligar ou reiniciar a VM.** Ela hospeda produção inteira.
- **Não responder a bots de review no PR.** Corrija o que procede, registre o que
  descartou, e não escreva na conversa do PR.
- **Atualizar doc é reescrever o bloco, não anexar outro.** Doc de spec descreve
  estado atual, não histórico de sessões.

---

## 9. Onde estão as coisas

| | |
|---|---|
| specs anteriores | `specs/096-mesas-onboard-criacao/`, `specs/097-mesas-paridade-editor-contatos/`, `specs/098-mesas-usabilidade-editor/` |
| governança | `AGENTS.md` (leia inteiro, uma vez, antes de agir) |
| editor de anúncio | `apps/mesas/frontend/src/features/table-editor/` |
| design system | `packages/ui/src/styles.css` (tokens), `primitives.tsx` (componentes) |
| beta | `mesasbeta.artificiorpg.com` |
| produção | `mesas.artificiorpg.com` — atualizada em 2026-08-27 com as correções da 097 |

**Estado do repositório quando escrevi isto:** a spec 098 está criada e **não
commitada**; produção e beta estão ambos em `b027437`.

---

## 10. O primeiro passo

Não é abrir código. É **ler o AGENTS.md inteiro e a spec 098**, depois combinar
com o mantenedor o recorte da pesquisa — e só então investigar.

Ele vai grelhar o que você trouxer. Traga medição, fonte e o que você descartou.
Se trouxer opinião, ele vai achar o buraco em duas perguntas.
