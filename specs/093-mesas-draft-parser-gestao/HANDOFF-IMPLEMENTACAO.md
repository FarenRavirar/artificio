# Handoff de implementação — spec 093

**Para:** o agente que vai implementar (DeepSeek — o mesmo que produziu a auditoria
adversarial de 2026-08-19)
**Estado:** spec fechada, auditada e corrigida. **Nenhuma linha de código escrita.**
**Ordem:** uma fase por vez, um PR por fase, na ordem numerada.

---

## Contexto que você já tem

Você auditou esta spec e devolveu 48 achados. **Todos foram incorporados** — inclusive os
que derrubaram diagnósticos inteiros. O que você vai implementar não é a spec que auditou;
é a versão corrigida por ela.

Os seis achados que mais mudaram o trabalho, para você não reimplementar a versão antiga:

| Achado seu | O que mudou |
|---|---|
| Camada C com mecanismo falso (regex exige `/`) | Camada C rebaixada a robustez; **Camada D criada** (T1.4b) — é ela que entrega R9 |
| R9 inalcançável (`"N disponível de M"` não casa em nada) | virou o item central da Fase 1 |
| Guard de faixa rejeitaria `"30/24"` e `"4/1"` | **sinal descartado**; restam os sinais 1, 2 e 4 |
| "Restaurar não existe" era falso | R13 virou atalho; **D5 aberta** ao mantenedor |
| Predicado de D1 errado (rota pública filtra expiração) | **rota admin é a primária** na Fase 4 |
| Acoplamento Fase 3↔6 | **R19 migrou para a Fase 3** |

Registro completo: `HANDOFF-AUDITORIA.md` §Resultados. Erros do agente anterior, em tabela:
`tasks.md` §Erros do agente.

---

## Ordem de leitura, por fase

1. `tasks.md`, a fase inteira — é a lista executável, e já embute cada correção da auditoria
2. `plan.md`, a seção `§Fase N` — o **como**, com as armadilhas medidas
3. `spec.md`, os gaps e requisitos citados no gate daquela fase — o **porquê**

Não leia as 8 fases de uma vez. Cada fase é um PR independente.

---

## As 8 fases

| # | Fase | Requisitos | Risco |
|---|---|---|---|
| 1 | Parser: vagas lidas de data | R7, R8, R9 | alto — Camada D é capacidade nova |
| 2 | Migrations: dois órfãos para o contrato | R14, R15 | **o mais alto** — toca esteira de deploy |
| 3 | `Tema(s)`, aliases e normalização | R3, R4, R10, R16, R19 | migration + remoção de `VTT_ALIASES` |
| 4 | Copiar no draft (anúncio e JSON) | R1, R2, R11 | baixo |
| 5 | Aba Descartados | R12, R13 | **bloqueada** — depende de D5 |
| 6 | Filtros do catálogo | R17, R18, R20 | validação visual obrigatória |
| 7 | Campos que a página pública esconde | R21–R24 | baixo, mas mexe em página pública |
| 8 | Consolidar aba "Mesas" + fechamento | R5, R6 | única que **remove** algo de uma tela |

**Dependências declaradas:** Fase 2 antes da Fase 3 (migration nova em diretório com passivo
seria construir sobre o defeito). R19 dentro da Fase 3, não da 6 — separá-las deixaria o
sistema pior entre os merges.

---

## Bloqueios ativos — não comece por estas

**Fase 5 — bloqueada por decisão de produto (D5).** Três pontos aguardam o mantenedor
(`tasks.md` §Pendências, item 2): destino da restauração, se "editar descartado" fica de
fora de R12, e o que fazer com o `reparse` que sobrescreve `rejected`. Já há decisão parcial
registrada em `spec.md` §D5 — leia antes de assumir qualquer coisa.

**Fase 2 — T2.7 exige aprovação nominal.** Registro em `schema_migrations` é escrita em
banco de VM. Chegue com o comando montado e o resultado de T2.5 (idempotência provada
rodando o SQL duas vezes); **não execute sem a palavra do mantenedor**.

**Fase 6 — T6.14 exige validação visual** com o mantenedor antes do PR. Altura desigual e
chip duplicado são defeito objetivo, e você corrige; densidade e direção estética são
decisão dele.

---

## Travas que valem em todas as fases

Do `AGENTS.md`, e a auditoria mostrou que o agente anterior falhou em várias:

- **Medição citada antes de afirmação.** Toda conclusão vem com o comando e o retorno. Sem
  medir, escrever "não medi".
- **Comentário explicativo não se apaga.** Ao editar trecho comentado, preservar ou
  reescrever explicando a decisão atual. Vários comentários desta base registram incidentes
  reais — apagá-los perde o histórico que evita repetir.
- **Não reordenar a cascata de `extractSlots`** (`:1067-1080`). A ordem tem justificativas
  datadas nos comentários.
- **Nada de commit, push, PR ou merge sem autorização nominal, por ação.**
- **Validação pontual durante o trabalho** (`rtk pnpm vitest run <arquivo>`,
  `rtk tsc -p tsconfig.json --noEmit`). Repo-wide só na Fase 8, um comando de cada vez.
- **Gate 🔁 é a penúltima task de cada fase.** Ele nomeia o que reler e o que conferir.
  Divergência ali: corrigir antes do PR, ou perguntar — nunca seguir o `tasks.md` contra a
  `spec.md` em silêncio.

---

## Uma coisa sobre a fixture da Fase 1

O anúncio Kingmaker original **não será recuperado** (decisão do mantenedor). A fixture de
T1.0 é **sintética**: reconstrução mínima que reproduz as duas condições medidas do defeito
— a linha de prosa que entrega o par `[25, 08]`, e a linha de vaga real que não casa em
estratégia alguma. O texto exato e o quadro de validação estão em `spec.md` §Gap 4.

Copie o texto de lá, sem variar. E marque no arquivo que é sintética — senão o próximo
agente a lê como captura de produção, que é justamente o erro que a sua auditoria pegou.

---

## O que fazer se discordar da spec

Você já derrubou 48 pontos dela; pode haver mais. Se durante a implementação achar que a
spec está errada:

1. **Meça** — comando e retorno.
2. **Corrija a spec junto com o código**, no mesmo PR, com nota dizendo o que estava errado
   e o que a medição mostrou. É o padrão já usado ali (`*(Correção da auditoria, …)*`).
3. Se a divergência tocar **regra de produto** — comportamento que o usuário vê, contrato
   público, custo operacional —, **pare e pergunte**. Não decida sozinho.

Seguir o `tasks.md` contra a evidência é o único erro que não tem desculpa.
