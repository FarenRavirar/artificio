# Débitos — Spec 058 (Parser Learning)

## DEB-058-04 — Detecção de sistema falha em formato "label sozinho na linha" (WordPress-style)

**Origem:** mantenedor reportou draft real (`5c1c8755-9328-4adf-a941-39a2a3bc244e`, "Ruins of Gauntlight") com campo Sistema pendente, apesar do texto bruto trazer "Pathfinder 2e" de forma clara.

**Evidência (texto real da mensagem/descrição importada):**

```text
Sistema
Pathfinder 2e
Dias e horários da mesa
Aos sábados, horarios a combinar
```

**Causa raiz confirmada no código:**

`splitLabelLine()` (`apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:546`) exige `:`/`：` na MESMA linha do label:

```ts
const match = /^([^:：]{1,48})\s{0,3}[:：]\s{0,3}(.*)$/.exec(cleaned);
if (!match) return null;
```

O formato acima ("Sistema" — quebra de linha — "Pathfinder 2e", sem `:`) nunca casa. `extractLabelValue(body, ['sistema','jogo','rpg'])` (linha 603) percorre linha a linha chamando `splitLabelLine`; como a linha "Sistema" sozinha retorna `null`, o label nunca é encontrado, `explicitSystem` fica `null`, cai no fallback de `systemHint` do thread name (que também não tem ":Pathfinder 2e" — thread name é só o título "Ruins of Gauntlight").

Resultado: nem `explicitSystem` nem `matchSystem(fullText, systems)` (fallback, linha 853) rodam sobre "Pathfinder 2e" isolado da forma que precisam — o fallback só dispara quando `!systemHint`, e mesmo rodando sobre `fullText` inteiro teria que achar "Pathfinder 2e" solto sem contexto de label, o que hoje não é tentado como sinal forte (só via `findSystemMatch` em texto genérico, que aceita match mas não prioriza).

**Padrão de origem:** contas Discord com anúncios copiados/colados de página web (WordPress/site de divulgação) usam label e valor em linhas separadas, sem `:`. Isso é estruturalmente diferente do padrão Discord nativo (`Sistema: Pathfinder 2e`), mas é um padrão RECORRENTE e reconhecível (não é ambiguidade textual livre — é outro layout estrutural fixo).

**Por que isso é "estrutura óbvia" (R1 da spec, não IA/regex-por-caso):**
Layout label-newline-valor é um segundo formato estrutural fixo, do mesmo jeito que `Label: valor` é o primeiro. Cobrir os DOIS formatos estruturais no parser determinístico é consistente com o princípio "parser mínimo cobre estrutura, banco cobre variação humana" — não é uma micro-regex de caso único.

**Proposta (não implementada — aguarda decisão):**

`splitLabelLine` continua exigindo `:` (não mudar — evita falso-positivo em frase comum tipo "Nota importante" virar label). Em vez disso, `extractLabelValue`/`getAnnouncementSystemHint` ganham fallback: quando uma linha (trim) é EXATAMENTE igual a um dos labels normalizados (`sistema`, `jogo`, `rpg` — case/acento-insensitive, sem `:`), tratar a(s) linha(s) seguinte(s) como valor via `collectLabelContinuation`, igual ao caso com `:`. Escopo: só ativa quando a linha inteira normaliza pra um dos labels conhecidos — não quebra texto livre.

**Segundo problema relacionado, mesmo achado do mantenedor — UX de seleção de sistema:**

`DraftEditorTab.tsx:137-142` usa `<select>` HTML nativo populando TODOS os sistemas do banco (`systems.map`) numa lista plana sem busca. Com o catálogo de sistemas crescendo (sistemas + edições + variantes), select nativo vira ruim de navegar. Já existe componente de combobox com busca no projeto: `SystemTreeSelector.tsx` (usado no fluxo de criação de mesa — ver `apps/mesas/frontend/src/components/SystemTreeSelector.tsx`) — precisa avaliar se dá para reusar/adaptar no `DraftEditorTab` em vez de `<select>` puro.

**Terceira ideia do mantenedor — sistema "tag-like" com aprendizado de alias:**

Mantenedor sugeriu que o campo sistema funcione como tag (digita, dá enter, salva) e que o cruzamento com `systems`/`system_aliases`/edições sugira o sistema mais provável a partir do texto livre digitado ou extraído — reduzindo o atrito de digitar e forçando escolha exata. Isso já existe parcialmente: pipeline de `system_suggestion` (ver `SystemSuggestionModal.tsx`, `SystemSuggestionResolutionDrawer.tsx`) quando o parser NÃO acha match, guarda o `rawSystemHint` pra sugestão. O gap é o item 1 acima: se o parser não isola corretamente o hint textual (por causa do formato sem `:`), a sugestão nem chega a ser gerada corretamente — o campo fica "pendente" sem hint nenhum pro revisor decidir.

**Status:** investigado, causa raiz confirmada, proposta rascunhada. Sem código alterado. Aguardando decisão do mantenedor sobre escopo (ver perguntas na sessão `26-07-01_1_mesas_parser-learning-spec.md`).
