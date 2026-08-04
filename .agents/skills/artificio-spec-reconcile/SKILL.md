---
name: artificio-spec-reconcile
description: Reconcilia artefatos SDD existentes do Artifício RPG (`spec.md`, `plan.md` e `tasks.md`) com decisões aprovadas e registradas, preservando histórico e produzindo rastreabilidade completa. Use após grilling, clarificação ou mudança de escopo aprovada, e antes de implementar uma fase quando o mantenedor pedir alinhamento ou reconciliação documental.
---

# Reconciliar spec do Artifício

Alinhar os três artefatos sem inventar decisões, regenerar documentos inteiros ou ampliar leitura e escopo por associação.

## Confirmar entradas

Antes de agir:

1. Ler o `AGENTS.md` raiz inteiro. Ele prevalece sobre esta skill.
2. Identificar a spec atual e os caminhos exatos de `spec.md`, `plan.md` e `tasks.md` nomeados pelo mantenedor.
3. Identificar o arquivo e a seção que formam o registro autoritativo de decisões aprovadas.
4. Perguntar se qualquer caminho estiver ausente, houver mais de um registro candidato ou o estado de aprovação não estiver explícito.

Ler somente os artefatos e trechos nomeados. Não abrir automaticamente backlog, sessões, `project-state.md`, `decisions.md`, specs relacionadas ou outros documentos T1.

## Respeitar o contrato

- Tratar decisões aprovadas como entrada autoritativa, mas parar se alguma contrariar governança ou outra decisão vigente sem indicar qual prevalece.
- Não criar decisão de produto, arquitetura, moderação, segurança ou rollout para preencher lacuna.
- Não alterar código. Inspecionar código pontualmente apenas para validar afirmação sobre estado implementado; código é a verdade material nesse caso.
- Editar somente os artefatos autorizados.
- Preservar comentários, razões e histórico. Se a razão mudar, atualizar o comentário e citar a decisão que a substituiu.
- Preservar IDs existentes. Não renumerar requisitos, fases ou tarefas em massa.
- Não marcar tarefa concluída porque a documentação foi reconciliada.
- Não commitar, pushar ou abrir PR sem autorização nominal própria.
- Usar `rtk git status`, `rtk git diff`, `rtk read`, `rtk rg` e `rtk git diff --check` conforme `AGENTS.md`. Fazer edições com `apply_patch`.

## Separar responsabilidade dos artefatos

Propagar a consequência de cada decisão ao artefato que a possui, sem copiar a resposta integral em todos:

- `spec.md`: o que e por quê; comportamento observável; requisitos testáveis; regras de produto; critérios de aceite; riscos e limites aprovados.
- `plan.md`: como; arquitetura; modelo de dados; contratos; integrações; segurança; rollout, rollback e estratégia de validação.
- `tasks.md`: trabalho executável em ordem; dependências; caminhos quando conhecidos; testes; gates; condição objetiva de conclusão; vínculo com requisitos.

Manter o registro original de decisões intacto como trilha de origem. Incorporar nos artefatos as consequências normativas, não apenas acrescentar “ver decisão N”.

## Executar a reconciliação

### 1. Fotografar o estado

Rodar `rtk git status` e `rtk git diff`. Registrar arquivos já modificados e não tocar em alterações alheias.

### 2. Inventariar decisões

Extrair todas as decisões aprovadas com ID estável, enunciado, consequência e eventual regra substituída. Contar o total `N`.

Construir antes da edição:

| Decisão | `spec.md` | `plan.md` | `tasks.md` | Estado |
|---|---|---|---|---|
| Dn | seção/requisito ou N/A | seção ou N/A | tarefa ou N/A | alinhada, ausente ou conflitante |

`N/A` exige motivo explícito. Nenhuma decisão pode ficar sem destino silenciosamente.

### 3. Detectar conflitos

Procurar:

- regra antiga ainda ativa e contradita por decisão nova;
- um artefato atualizado e outro ainda descrevendo o comportamento anterior;
- tarefa que implementa comportamento revogado;
- plano que não sustenta requisito da spec;
- requisito sem tarefa ou tarefa sem requisito/decisão justificável;
- decisão que introduz escolha ainda não respondida.

Se surgir escolha nova, ambiguidade material ou duas decisões incompatíveis, parar e perguntar ao mantenedor antes de editar.

### 4. Aplicar flow-back

Editar nesta ordem:

1. `spec.md` — corrigir requisitos e critérios na seção dona do comportamento.
2. `plan.md` — alinhar mecanismos às regras já reconciliadas.
3. `tasks.md` — alinhar execução, dependências, testes e gates aos dois artefatos anteriores.

Preferir patches pequenos e coerentes. Não regenerar arquivo inteiro. Atualizar cláusula ativa na origem; não esconder contradição com apêndice genérico. Quando histórico precisar permanecer, marcá-lo claramente como histórico ou supersedido, citando a decisão substituta.

Para tarefas antigas:

- atualizar a tarefa ainda válida;
- marcar como supersedida quando preservar seu ID for necessário à trilha;
- remover somente duplicação sem valor histórico;
- nunca manter como trabalho ativo algo revogado;
- exigir vínculo com o requisito exato e prova verificável de conclusão.

### 5. Auditar depois da edição

Reconstruir a matriz e exigir:

- decisões mapeadas ou justificadas: `N/N`;
- zero contradição ativa conhecida;
- requisitos com cobertura de plano e tarefa, ou exceção explícita;
- tarefas com origem rastreável;
- termos supersedidos buscados com `rtk rg`, com cada ocorrência inspecionada;
- somente os arquivos autorizados no diff;
- `rtk git diff --check` com saída limpa.

Se `$speckit-analyze` oficial já estiver disponível, executá-lo como gate read-only após a auditoria local. Não instalar, inicializar ou alterar configuração para obtê-lo sem aprovação. Se não estiver disponível, a matriz acima é o gate equivalente e sua ausência não bloqueia.

## Relatar

Responder em português e caveman ultra, começando pelo resultado. Incluir:

- decisões reconciliadas: `N/N`;
- arquivos alterados;
- contradições removidas;
- decisões `N/A` e motivos;
- pendências ou escolhas que exigem mantenedor;
- validações executadas e resultados numéricos;
- confirmação de que não houve código, commit, push ou PR.
