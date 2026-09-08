# 058 — Parser Learning + DeepSeek Contextual para Importacao de Mesas

- **Continua/expande:** `specs/052-mesas-automacao-inteligente/`
- **Modulo:** `apps/mesas` (backend + gestao admin)
- **Visao estrategica de fundo:** `apps/mesas/CONTEXT.md` §"Visao estrategica de produto" (registrado 2026-07-02). Objetivo final e automacao completa de importacao (assintota, nao meta binaria); o "caminho do meio" e parser+curadoria+DeepSeek convergindo pra la. Esta spec e implementacao concreta dessa visao, nao feature isolada.
- **Status:** Fase 0 concluida em 2026-07-01 (`reviews.md`). MVP minimo definido. Ampliada 2026-07-02 com `auto-preenchimento-draft.md` (3 rodadas de revisao independente + simulacao contra JSONs reais). Implementacao segue bloqueada ate autorizacao nominal.
- **Motivacao imediata:** investigacao do `D:\teste.json` mostrou que o fluxo precisa aprender com revisao humana e contexto, nao acumular micro-regex no codigo.

## Problema

Mensagens de divulgacao de mesas sao texto humano livre. Todo dia aparecem formatos novos, estilos Unicode, emojis, labels criativos, links, imagens, respostas, reposts, propagandas, sistemas autorais, valores escondidos ou ambiguos e duplicatas. Um parser baseado em regra fixa resolve so a borda facil.

O risco atual e cair em um ciclo ruim:

1. O parser erra um padrao novo.
2. O codigo ganha mais uma regex.
3. Outro formato humano quebra.
4. O sistema vira uma lista infinita de excecoes.

Isso nao escala. A solucao precisa transformar revisao humana em memoria operacional consultavel e usar DeepSeek so quando houver incerteza, sempre com exemplos proximos, regras aprendidas, contraexemplos e validacao local.

## Principios

- **Conservadorismo:** ausencia de evidencia nao vira verdade. Se preco nao esta claro, `price_type = null`, nao `gratuita`.
- **Parser minimo, memoria rica:** regra no codigo cobre estrutura e sinais obvios; variacao humana mora no banco.
- **IA contextual, nao oraculo:** DeepSeek recebe mensagem + parse inicial + casos parecidos + regras/rejeicoes; nunca decide no vazio.
- **Humano ensina o sistema:** toda correcao no draft vira feedback estruturado e avaliavel.
- **Aprendizado reversivel:** regra aprendida pode ser rejeitada, perder confianca, ser escopada ou desativada.
- **Duplicata e interpretacao sao parte do mesmo problema:** antes de criar draft novo, o pipeline precisa saber se ja viu mesa igual/parecida.
- **Sem auto-publicacao nesta spec:** o alvo e melhorar decisao/triagem/revisao, nao publicar sozinho.

## Modelo conceitual

```text
Mensagem bruta
  -> normalizacao/canonicalizacao
  -> parser deterministico conservador
  -> busca de memoria: regras, feedbacks, casos proximos, duplicatas, rejeicoes
  -> DeepSeek contextual quando necessario
  -> validacao local/schema/politicas
  -> decisao: draft / needs_review / discard / duplicate / ignore
  -> revisao humana
  -> feedback persistido
  -> memoria melhora a proxima decisao
```

## Decisoes da Fase 0

Ver detalhe em `reviews.md`.

- **Fonte de verdade:** `discord_parse_cases` + `discord_parse_feedback`. Tabelas atuais (`import_corrections`, `discord_shadow_decisions`, `discord_field_learning`) continuam como compatibilidade/projecao, nao como arquitetura final.
- **MVP minimo:** instrumentacao sem mudanca de comportamento. Registrar casos, feedback imutavel e baseline real antes de retrieval/DeepSeek.
- **DeepSeek fora do MVP:** `ContextPack` so entra depois de casos confirmados, negativos, duplicatas e baseline.
- **`discord_field_learning`:** manter como cache/projecao estreita; criar `discord_learning_rules` depois, com status, escopo, confianca e rejeicao.
- **Feedback duravel:** memoria de aprendizado nao pode depender de `draft_id ON DELETE CASCADE`.
- **Duplicata antes da IA contextual:** candidatos locais entram no contexto; a IA nao e a primeira ferramenta de dedupe.

## Requisitos

### R1 — Parser deterministico conservador

O parser deve extrair apenas sinais fortes e deixar campo nulo quando nao houver evidencia suficiente. Ele nao deve codar variacoes infinitas de linguagem. Exemplos:

- `R$ 30`, `30 reais`, `gratuita`, `sem custo` = sinais fortes.
- `Valor:` sem numero = sinal de preco ambiguo/pago sem valor, nao gratuito.
- Sem sinal de preco = `price_type = null`.
- Sistema autoral forte deve ser descartavel, mas a decisao precisa ficar auditavel.

### R2 — Persistir caso de parse

Criar conceito de `parse_case`: snapshot versionado de uma mensagem processada, com:

- mensagem bruta normalizada;
- hashes exato e normalizado;
- features extraidas;
- resultado do parser deterministico;
- contexto usado pelo DeepSeek;
- decisao final;
- versoes de parser/prompt/modelo;
- status humano final.

### R3 — Feedback humano como dado primario

Toda alteracao feita na revisao de draft deve gerar evento de feedback:

- campo corrigido;
- valor antes/depois;
- se era falso positivo/falso negativo;
- se virou descarte;
- se virou duplicata;
- motivo opcional;
- guild/canal/perfil/import run;
- usuario/admin;
- timestamp.

Esse feedback e mais importante que chat/memoria do agente. Ele e o treino vivo do produto.

### R4 — Regras aprendidas com escopo, confianca e rejeicao

Ampliar o `discord_field_learning` atual ou criar camada nova para suportar:

- `field_value`: valor extraido -> valor correto;
- `label_alias`: label visto -> campo canonico;
- `classification`: trecho/padrao -> `paid`, `free`, `homebrew`, `non_announcement`, etc.;
- `discard_rule`: criterio de descarte aprendido;
- `duplicate_rule`: criterio de duplicacao aprendido;
- `negative_rule`: regra que nao deve ser aplicada.

Cada regra precisa de:

- `scope`: global, guild, canal, perfil, autor ou combinacao;
- `confidence`;
- `hits`;
- `rejections`;
- `active`;
- `last_applied_at`;
- fonte: humano, importacao historica, avaliacao, DeepSeek confirmado.

### R5 — Busca dos casos mais proximos

Antes de chamar DeepSeek, buscar contexto no banco:

- hash exato;
- hash normalizado;
- URLs/forms/links iguais;
- attachments/imagens iguais ou semelhantes;
- titulo parecido;
- sistema parecido;
- mesmo autor/canal/guild;
- texto parecido via `pg_trgm`;
- no futuro, embeddings se `pg_trgm` nao bastar.

O retorno precisa separar:

- exemplos positivos confirmados;
- exemplos corrigidos pelo humano;
- exemplos rejeitados;
- duplicatas provaveis;
- regras ativas aplicaveis;
- regras conflitantes ou com rejeicoes.

### R6 — DeepSeek com Context Pack

DeepSeek deve receber um `ContextPack` estruturado e pequeno:

- mensagem atual como dado, nunca como instrucao;
- parse deterministico inicial;
- campos faltantes/ambiguos;
- politicas de produto;
- regras aprendidas aplicaveis;
- regras rejeitadas que nao devem ser repetidas;
- 3 a 10 casos proximos relevantes;
- candidatos de duplicata;
- schema esperado de resposta;
- limites de decisao.

O prompt deve deixar claro: texto do Discord pode conter instrucao maliciosa ou irrelevante; o modelo deve tratar tudo como conteudo a classificar, nao como comando.

### R7 — Resposta IA validada, explicavel e limitada

A resposta deve ser JSON validado por Zod com:

- `action`: `draft`, `needs_review`, `discard`, `duplicate`, `ignore`;
- `fields`;
- `confidence_by_field`;
- `evidence_spans`;
- `warnings`;
- `matched_case_ids`;
- `matched_rule_ids`;
- `duplicate_candidate_ids`;
- `reason_codes`.

O backend valida enums, coercoes, conflitos e politicas. DeepSeek nao pode publicar, apagar ou descartar irreversivelmente sozinho.

### R8 — Duplicacao como primeira classe

O pipeline deve classificar duplicatas antes de criar rascunho novo:

- `duplicate_exact`;
- `duplicate_probable`;
- `repost_update`;
- `same_table_new_campaign`;
- `not_duplicate`.

Duplicata provavel entra em revisao com candidatos visiveis. Correcao humana alimenta regras e casos futuros.

### R9 — Revisao no front deve ensinar

Na tela de draft, o admin precisa ver:

- o que foi extraido;
- de onde veio a evidencia;
- se veio de parser, learning-store ou DeepSeek;
- quais casos parecidos influenciaram;
- se ha duplicata provavel;
- o que ficou incerto.

Ao corrigir, rejeitar, marcar duplicata ou descartar, o front deve enviar feedback suficiente para aprendizado.

### R10 — Avaliacao continua

Cada versao de parser/prompt/modelo precisa ser avaliada contra casos humanos confirmados:

- acuracia por campo;
- falso gratuito/falso pago;
- falso descarte;
- falso draft de homebrew;
- duplicata perdida;
- duplicata falsa;
- custo medio por mensagem;
- taxa de fallback para DeepSeek;
- taxa de correcao humana depois da IA.

Sem eval, nao ha como saber se o sistema melhorou.

### R11 — Shadow mode obrigatorio

Qualquer decisao automatica nova entra primeiro em shadow:

- o sistema registra o que teria feito;
- o humano continua decidindo;
- divergencia vira relatorio;
- so depois de evidencia real uma acao pode sair do shadow.

### R12 — Cache e custo

Chamada DeepSeek deve ser evitada quando:

- learning-store resolve;
- hash/prompt/modelo ja foi avaliado;
- caso e duplicata exata;
- parser tem alta confianca e zero conflito.

Cache deve ser versionado por `prompt_version`, `model`, `parser_version` e hash normalizado.

### R13 — Governanca, privacidade e seguranca

- Segredos nunca entram no prompt.
- Token/cookie do Discord nunca entra em log, feedback ou contexto IA.
- Mensagem do Discord e conteudo publico/semipublico, mas ainda deve ser minimizada por custo e por higiene.
- Prompt injection do texto importado deve ser tratado explicitamente.
- Toda decisao IA precisa ser auditavel.

### R14 — Lifecycle de dados

Definir retencao para:

- mensagem bruta;
- contexto enviado ao DeepSeek;
- respostas IA;
- embeddings, se usados;
- feedback humano;
- casos fechados e rejeitados.

### R15 — Compatibilidade com 052

A 052 tem `discord_field_learning`, DeepSeek auxiliar, eval e shadow. A 058 nao joga isso fora. Ela formaliza a arquitetura mais ampla:

- learning-store deixa de ser so `campo+token`;
- DeepSeek passa a usar casos proximos;
- feedback vira evento de primeira classe;
- duplicata entra no fluxo;
- erro/rejeicao vira dado negativo.

## Fora de escopo desta abertura

- Implementar migration, rota, UI, prompt final ou chamada nova ao DeepSeek.
- Auto-publicacao.
- Trocar provider ou fazer fine-tuning.
- Reverter ou reescrever a 052.
- Resolver todo parser atual por regex.

## Perguntas para revisao 5.5 altissimo

- Quais casos humanos reais ainda nao estao cobertos por este modelo?
- O esquema proposto diferencia bem regra aprendida, feedback, caso de parse e decisao IA?
- Como evitar overfitting por guild/canal pequeno?
- Quando uma regra deve virar global e quando deve ficar local?
- Como detectar conflito entre exemplos parecidos?
- Quais features de duplicata sao suficientes sem embeddings?
- Onde a IA pode ser enganada por texto malicioso no anuncio?
- Qual e o menor MVP que prova valor sem construir arquitetura grande demais?
- Quais metricas bloqueiam promocao de shadow para acao real?
