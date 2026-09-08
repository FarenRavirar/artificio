# Débitos — Spec 058 (Parser Learning)

> **Para quem for implementar (handoff, ex.: Codex):** os débitos abaixo não estão em ordem de prioridade de implementação, só ordem cronológica de quando foram levantados. **Prioridade real de execução, ver `tasks.md` Fase 10** — resumo: DEB-058-07 (bug crítico, aprendizado não é consumido) primeiro, DEB-058-06 (visibilidade/gate/config de DeepSeek) depois, DEB-058-05/04 (extractors do parser) já fechados nesta rodada. Cada débito abaixo tem seção "Correção"/"Plano" apontando pra task exata em `tasks.md`.

## DEB-058-07 (CRÍTICO — prioridade de implementação nº 1) — Aprendizado por correção humana grava mas nunca é consumido de volta

**Origem:** mantenedor perguntou "já existe no código e banco de dados o aprendizado pelas minhas escolhas no draft, ou deveria ter, pro parser ficar aprendendo. isso nunca pode ser esquecido e sempre deve ser retomado e implementado, pois ele é o futuro pra isso ficar escalonável."

**Confirmado por leitura de código real:**

1. **Gravação funciona.** Corrigir campo no editor → `submitCorrection` (`apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:584`) → `POST /:id/correction` → `registerDraftCorrection` (`apps/mesas/backend/src/routes/discord/utils.ts:86-191`) → grava em `import_corrections` + `recordFieldLearning` (cache token+guild) + `recordLearningRulesFromCorrections` (`apps/mesas/backend/src/discord/learningRules.ts:106`, gera/atualiza `discord_learning_rules` com escopo/confiança/hits/rejections — infra da Fase 3 da própria spec 058, já implementada). Fluxo real, chamado pelo editor (`useDraftForm.ts:228-229`), não só teste.

2. **BUG REAL — consumo nunca acontece.** `lookupLearningRules`/`lookupFieldLearning` (as funções que aplicam a regra aprendida num draft novo) só são chamadas de UM lugar: dentro de `enrichDraftWithLlm` (`apps/mesas/backend/src/routes/discord/utils.ts:460-562`), linhas 486-487 — mas essa função retorna cedo na linha 466 (`if (!isAiAssistEnabled(aiConfig)) return normalized;`), o MESMO gate de modo IA confirmado desligado em produção (ver DEB-058-06 abaixo). O comentário do próprio código, linha 475-476, contradiz isso: `// D087 — camada learning-store (token-zero) ANTES da IA. Correções humanas passadas resolvem valores errados/repetidos sem chamar o provider.` — a intenção original era essa camada rodar **independente** de DeepSeek (sem custo de API), mas o gate bloqueia tudo antes de chegar lá. É bug de gate errado, não decisão de produto.

3. **Consequência:** toda correção manual desde que a Fase 3 foi implementada virou regra gravada no banco, mas nenhuma delas nunca voltou a resolver um draft futuro — o sistema escreve pra uma memória que ninguém lê. Bate com a mesma ausência de log de 30 dias já confirmada no DEB-058-06 (mesmo caminho de código, mesma evidência de runtime).

**Correção — ver `tasks.md` Fase 10, T10.11/T10.12 (primeiras tasks a implementar, sem dependência de decisão/aprovação de infra):** separar o lookup do learning-store (token-zero, deve rodar sempre) do gate de chamada real ao DeepSeek (só esse respeita o modo). É mover um bloco de código pra antes do `if`, não feature nova — prioridade acima de qualquer coisa relacionada a ligar DeepSeek, porque é a base do "aprendizado escalonável" que o mantenedor está cobrando.

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

## DEB-058-06 — DeepSeek já tem infra pronta mas mantenedor não sabe quando (nem se) ele atuou

**Origem:** mantenedor perguntou "temos o deepseek pra ajudar no parsing e escolhas, mas nunca sei quando ele está sendo usado" e pediu legenda visível sob o campo quando DeepSeek foi usado, já que a função dele é atuar quando o parser não resolve. Pediu investigação registrada antes de codar.

**Investigação (código real, sem chute):**

1. **A legenda já existe e já funciona — mas o achado do mantenedor é real mesmo assim.** `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts:123-177` (`classifySuggestionProvider`/`addSuggestionInsights`) já classifica `_ai_suggestions` em `source: 'deepseek'` (vs `'learning-store'`/`'parser'`/`'humano'`), e `DraftEditorTab.tsx:53-83` (`sourceLabel`/`sourceClass`/`FieldInsightNote`) já renderiza um chip "DeepSeek" azul sob o campo com a sugestão pendente e a evidência. Fase 6 da própria spec 058 (log de 2026-07-02 em `project-state.md`) entregou exatamente isso. Não é feature ausente — é feature que nunca dispara na prática (ver item 2) ou que some rápido demais (ver item 3), então o mantenedor nunca viu o chip aparecer.

2. **Causa raiz nº 1 confirmada — DeepSeek está sempre desligado em beta/prod por falta de env var, silenciosamente.** `apps/mesas/backend/src/discord/aiAutomationConfig.ts:45-48` (`readMode`) faz fallback pra `'off'` quando `MESAS_AI_AUTOMATION_MODE` não está setada — e uma busca no repo inteiro (`rg MESAS_AI_AUTOMATION_MODE`) só encontra a variável em arquivos de teste (`aiAutomation.test.ts`, `utils.test.ts`), nunca em `.env.example`, docs de deploy ou runbook. `enrichDraftWithLlm` (`apps/mesas/backend/src/routes/discord/utils.ts:465-466`) checa `isAiAssistEnabled(aiConfig)` logo no início e retorna o `normalized` sem tocar em DeepSeek quando o modo é `off` — que é o modo padrão do sistema hoje, com ou sem `deepseek_api_key` configurada no accounts. Ou seja: mesmo com a chave DeepSeek ativa (o log de 2026-06-27 confirma que o mantenedor já inseriu `deepseek_api_key` em prod), **nenhuma chamada real ao DeepSeek acontece** até alguém setar `MESAS_AI_AUTOMATION_MODE=suggest` (ou `shadow`/`auto`) no ambiente — isso nunca foi feito nem documentado como pendência. O mantenedor pergunta "quando ele está sendo usado" porque a resposta honesta hoje é **nunca**, e isso está invisível — não há log/métrica/aviso na UI dizendo "modo IA = off".

3. **Causa raiz nº 2 — mesmo com o modo ligado, a sugestão é feita de leitura passiva e desaparece sem deixar rastro após decisão.** `_ai_suggestions` (`apps/mesas/backend/src/discord/aiSuggestions.ts:38-60`, `attachAiSuggestions`) é escrito uma vez no draft com `{provider, model, fields}` e uma nota em `_notes`. Não existe rota/handler que "aplica" a sugestão a um campo — o admin tem que ler o texto da sugestão no chip (`DraftEditorTab.tsx:80`, `sugestão: {suggestion}`) e digitar o valor manualmente no input ao lado. Isso violaria a exigência de "curadoria rápida e de baixo atrito" que `apps/mesas/context.md` (seção "Visão estratégica de produto") trata como requisito de produto, não só UX. Além disso, uma vez que o campo é editado manualmente (mesmo copiando o valor sugerido), `addParserAndHumanInsights` (`draftFormUtils.ts:142-155`) reclassifica o campo como `source: 'humano'` na próxima renderização — o rótulo "DeepSeek" desaparece silenciosamente assim que o humano confirma a sugestão, então não há registro visual pós-hoc de "este campo veio de IA e foi confirmado pelo humano" — só existe o instante fugaz de "sugestão pendente".

4. **Causa raiz nº 3 (menor) — o gate de disparo (`shouldAskLlm`) é conservador por desenho, o que é correto pelo R1 da spec, mas reforça a percepção de "nunca uso".** `enrichDraftWithLlm` só chama DeepSeek quando confiança < `lowConfidenceThreshold` (default 0.5) OU há `missing_fields`, E quando o learning-store não resolveu tudo sozinho (`storeResolvedAllMissing`), E quando `rawText.length > 50`. Isso é a arquitetura certa (R12 da spec: evitar custo quando não precisa) — não é bug, mas significa que mesmo com o modo ligado, boa parte dos drafts de alta confiança nunca vão acionar DeepSeek, então "nunca vi o chip" pode ser esperado em parte dos casos mesmo com tudo configurado certo. Isso reforça a necessidade de visibilidade agregada (ex.: métrica/indicador de quantas vezes DeepSeek rodou no período), não só chip por campo.

**Não é bug de lógica — é gap de operação + gap de UX de confirmação.** A arquitetura (Fases 4/6 da spec 058) está certa e no princípio certo (R9: revisão deve ensinar; R12: cache/custo). O que falta:

- (a) alguém decidir e documentar o modo operacional real (`suggest` vs `shadow`) e setar a env var em beta/prod — decisão de produto/operação do mantenedor, não coisa que o parser decide sozinho;
- (b) UI mostrar quando IA está desligada (hoje o chip só aparece quando há sugestão — ausência de chip é indistinguível de "IA desligada" vs "parser já resolveu com confiança alta" vs "confiança baixa mas texto curto demais pra acionar IA");
- (c) preservar o rótulo de proveniência "confirmado de sugestão DeepSeek" mesmo depois que o humano aceita/edita o campo, em vez de reclassificar silenciosamente pra `humano` perdendo o rastro de que a IA ajudou;
- (d) idealmente um botão "aplicar sugestão" no chip, em vez de copiar/colar manual — reduz atrito, que é requisito de produto (`context.md`).

**Validação real feita 2026-07-06 (read-only, sem escrita/exposição de segredo) — a estrutura de acesso à chave FUNCIONA, o problema é só o gate de modo:**

1. **Cadeia de acesso à `deepseek_api_key` está saudável de ponta a ponta.** Confirmado via VM (comandos read-only, `docker ps`/`docker logs`/`docker exec ... env`/query `SELECT` read-only no Postgres — nenhuma escrita, nenhum segredo impresso):
   - `SERVICE_SECRET` do `.env.beta` do mesas e do `.env` do accounts prod têm o **mesmo hash SHA-256** da linha completa (`04bc5892...`) — os dois lados usam o mesmo token de serviço-a-serviço. Autenticação funcionaria.
   - `ACCOUNTS_SECRETS_KEY` está setada no `accounts-api` (presente, não vazia).
   - A linha `deepseek_api_key` existe em `admin_secrets` no Postgres do accounts (`ciphertext` de 142 bytes, `updated_at = 2026-06-27 15:48:17 UTC` — bate com o log do mantenedor de que ele inseriu a chave). O dado está lá, cifrado, pronto para ser decifrado por quem tiver `ACCOUNTS_SECRETS_KEY` (que o accounts tem).
   - Conclusão: se `getSecret('deepseek_api_key')` fosse chamado hoje a partir do mesas (beta ou prod), a cadeia HTTP + auth + decrypt tem tudo que precisa para funcionar. **Não é problema de token/acesso quebrado.**

2. **Mas `getSecret` nunca chega a ser chamado — confirmado por ausência total de log em produção.** `docker logs mesas-beta-api --since 720h` e `docker logs mesas-api --since 720h` (30 dias de histórico, ambos os ambientes) não têm **nenhuma** linha contendo `adminSecrets`, `llmAssist` ou `deepseek` — nem sucesso, nem warning, nem erro de rede. Isso é consistente com o código: `enrichDraftWithLlm` (`apps/mesas/backend/src/routes/discord/utils.ts:465-466`) faz `if (!isAiAssistEnabled(aiConfig)) return normalized;` **antes** de qualquer chamada a `assistDiscordParseWithContextPack`/`getSecret` — e `isAiAssistEnabled` retorna `false` porque `MESAS_AI_AUTOMATION_MODE` nunca foi setada em nenhum dos dois `.env` (confirmado via `grep` read-only no `.env.beta` da VM — zero ocorrência da variável). O código nem tenta buscar a chave; para no gate de modo, silenciosamente, sem logar que parou aí.

**Resposta direta à pergunta do mantenedor:** a chave DeepSeek está corretamente configurada e acessível — a estrutura TEM acesso a ela. O motivo de "nunca sei quando ele está sendo usado" é que ele nunca É usado, porque falta uma decisão operacional simples (setar o modo de IA em beta/prod, ver T10.1/T10.2/T10.8) que ninguém tomou ainda — não é bug de integração nem de segredo quebrado.

**Outros 2 achados de feedback do mantenedor sobre este mesmo débito** (gate de disparo deveria ser por campo, não por draft; config de modo deveria ser central no accounts, não env var isolada) — ver `tasks.md` Fase 10, T10.7 e T10.8 respectivamente.

**Plano de correção completo — ver Fase 10 em `tasks.md` (T10.1–T10.12), na ordem de execução descrita lá** (T10.11/T10.12 do DEB-058-07 primeiro; T10.1/T10.2 deste débito são as últimas tasks, bloqueadas por aprovação nominal e por T10.8).

`DraftEditorTab.tsx:137-142` usa `<select>` HTML nativo populando TODOS os sistemas do banco (`systems.map`) numa lista plana sem busca. Com o catálogo de sistemas crescendo (sistemas + edições + variantes), select nativo vira ruim de navegar. Já existe componente de combobox com busca no projeto: `SystemTreeSelector.tsx` (usado no fluxo de criação de mesa — ver `apps/mesas/frontend/src/components/SystemTreeSelector.tsx`) — precisa avaliar se dá para reusar/adaptar no `DraftEditorTab` em vez de `<select>` puro.

**Terceira ideia do mantenedor — sistema "tag-like" com aprendizado de alias:**

Mantenedor sugeriu que o campo sistema funcione como tag (digita, dá enter, salva) e que o cruzamento com `systems`/`system_aliases`/edições sugira o sistema mais provável a partir do texto livre digitado ou extraído — reduzindo o atrito de digitar e forçando escolha exata. Isso já existe parcialmente: pipeline de `system_suggestion` (ver `SystemSuggestionModal.tsx`, `SystemSuggestionResolutionDrawer.tsx`) quando o parser NÃO acha match, guarda o `rawSystemHint` pra sugestão. O gap é o item 1 acima: se o parser não isola corretamente o hint textual (por causa do formato sem `:`), a sugestão nem chega a ser gerada corretamente — o campo fica "pendente" sem hint nenhum pro revisor decidir.

**Status:** investigado, causa raiz confirmada, proposta rascunhada. Sem código alterado. Aguardando decisão do mantenedor sobre escopo (ver perguntas na sessão `26-07-01_1_mesas_parser-learning-spec.md`).

## DEB-058-05 — Extractors do parser decidem por caça-palavra-chave em vez de cascata por força de sinal (violação de R1)

**Origem:** revisão de código real na PR #127 (branch `fix/058-draft-scenario-vtt-comm-select`) usando `D:\teste.json` (50 mensagens reais exportadas do Discord em 2026-07-06) como corpus de teste. Mantenedor apontou 3 bugs reais no draft "Temporada de Fantasmas" (msg real em `D:\teste.json` linha ~1627): `price_type: gratuita` quando o texto tinha `**Valor**: 30,00 Por Sessão (sessão 0 gratuita)` (mesa PAGA com sessão zero de cortesia), descrição truncada no primeiro parágrafo da Sinopse (perdia 3 parágrafos), e confiança `100%` mesmo com o preço errado. Mantenedor rejeitou o primeiro fix (regex ampliada pontual) como "tapa-buraco" e exigiu solução estrutural: cascata de evidência por força de sinal em vez de caça-palavra-chave, aplicada a **todos os extractors do parser**, não só preço.

**Fix aplicado nesta rodada (`extractPrice`, `collectLabelContinuation`/`extractLabelValue`, `calcConfidence`):**

- `extractPrice`: cascata label explícito (`Valor: 30,00`, mesmo com `**` markdown) > texto livre > conflito real vira `null` + `_price_ambiguity: true` (nunca decide sozinho, entra em `missing_fields`). "Sessão 0/zero gratuita" e "1ª semana grátis" tratados como período promocional pontual, não como sinal de mesa gratuita.
- `collectLabelContinuation`/`extractLabelValue`: novo modo `multiParagraph` — Sinopse/Descrição atravessam linha vazia (parágrafo) e só param em próximo rótulo real, em vez de cortar no 1º parágrafo.
- `calcConfidence`: desconta `AMBIGUITY_PENALTY` (0.15) por sinal de ambiguidade real (`_slots_ambiguity`, `_price_ambiguity`, `_homebrew_suspect`) — nunca mais bate 100% com ambiguidade marcada.

Validado contra 226 testes existentes (zero regressão) + casos extraídos do `D:\teste.json` real (ver mensagens "Temporada de Fantasmas", "Fabula Ultima", "Dungeons & Dragons: Heróis das Fronteiras" — todas com padrão `Mesa Paga: R$X (Sessão ZERO Gratuita)`).

**Outros extractors com o MESMO problema estrutural, levantados na revisão do corpus real (`D:\teste.json`, 50 msgs), ainda NÃO corrigidos:**

1. **`extractModality`** (`parseDiscordAnnouncement.ts:332`) — **descartado como bug em 2026-07-06, decisão explícita do mantenedor.** `extractModality(body) ?? 'online'` é comportamento correto pro domínio: origem do dado é comunidade Discord, contato social é feito no Discord por natureza — presencial é raro e SEMPRE citado explicitamente quando existe (o ramo `presencial`/`hibrida` já dispara antes do fallback quando há sinal). Ausência de palavra-chave de modalidade não é ambiguidade real nesse domínio, é o próprio sinal implícito de "online". Não é violação de R1 — não precisa de nota/penalidade de confiança. Mantido como está.

2. **`extractType`** (`:341`) — só reconhece `one-shot`/`campanha`/`aberta` explícitos no texto. Corpus real tem MUITOS anúncios que citam duração ("Campanha Longa", "8 a 12 sessões", "Curta campanha") sem nunca dizer a palavra exata esperada por outro regex, ou citam "Recrutamento de jogador" que é claramente campanha em andamento. Hoje qualquer coisa fora do vocabulário exato fica `null`, sem tentar sinal secundário (menção de "sessões", "temporada", duração). Não é ambiguidade marcada — é underfit silencioso (não decide, mas também não sinaliza *por que* não decidiu além do `missing_fields` genérico).

3. **`extractAgeRating`** (`:576`) — já cascata razoável (regex direta por número), mas SEM cascata de conflito: se o texto citar dois números de idade diferentes em contextos diferentes (ex.: "+18 anos" pro público E "18 a 20 anos" pra faixa de personagem, caso real em "Escola do Outro Lado" no corpus, linha ~637: `NEX 5%... faixa de 18 há 20 anos` refere-se à idade dos PERSONAGENS na ficção, não à classificação indicativa real da mesa) pode confundir número de contexto errado com age_rating. Hoje não há checagem de âncora contextual (palavra "anos"/"classificação"/"faixa etária" precisa estar PRÓXIMA do número, não em qualquer lugar do `fullText`). Sem caso de falha confirmado ainda no corpus atual (os `+18`/`16+` testados bateram certo), mas é o mesmo padrão estrutural de risco — regex solta em `fullText` inteiro sem escopo de proximidade ao label.

4. **`extractSlots`** (`:457`, `RE_SLOT_*`) — já tem cascata de várias regex em ordem + `_slots_ambiguity` pra caso `X/Y` ambíguo (correto, é o modelo a copiar). Mas a cascata é ordem fixa de tentativa, não "força de sinal" real: um label explícito tipo `Vagas Disponíveis: 2` deveria SEMPRE vencer um número solto tipo `4 vagas` capturado de outro lugar do texto (caso real: "Mina Perdida de Phandelver" linha ~262 tem só "4 vagas" no meio de "Horário & Vagas: Segundas, 19h - 4 vagas", funciona; mas mensagens com múltiplos números de vaga em contextos diferentes — ex. "Vagas Totais: 6" + "Vagas Disponíveis: 2" no mesmo anúncio — dependem da ORDEM das funções no `??`, não de qual tem o label mais específico). Não achado bug confirmado ainda, mas mesmo risco estrutural.

5. **`extractDayOfWeek`/`extractStartTime`** (`:508`/`:526`) — sem sinal de conflito quando o texto cita MÚLTIPLOS dias/horários (caso real confirmado no corpus: "Vampiro A Máscara Dark Ages" linha ~420 cita só "1° Mesa: Terça 19PM as 22PM (3/6)" mas há mesas reais no corpus tipo "Ravenloft: Curse of Strahd" linha ~658 com DOIS horários — "Terça 20:00 Quinzenal" E "Sábado 18:00 Quinzenal" — o parser pega só o primeiro `<t:...>` que aparece, sem marcar que há 2 horários possíveis nem consolidar como par quinzenal alternado). Campo `day_of_week`/`start_time` do form é singular (1 mesa = 1 horário fixo recorrente); mesas com múltiplos slots por semana/quinzena precisam de `missing_fields`/nota explícita "múltiplos horários detectados, revisar", não silenciosamente pegar o primeiro.

6. **`extractContactUrl`** (`:598`) — pega a PRIMEIRA URL `https?://` do texto sem diferenciar URL de referência (ex.: link de imagem de fundo, link de playlist, site institucional tipo "Sanctum Veritatis") de URL de contato/inscrição real (Google Forms, MesaQuest, linktree de inscrição). Corpus real tem casos como "SETENTRIONAL" (linha ~60) onde a única URL é o site do projeto, não contato — e "Rigor Mortis" (linha ~749) onde a URL real de inscrição (MesaQuest) é a única e correta. `isSuspiciousUrl` (`:846`) já sinaliza "não é domínio conhecido de contato" via `missing_fields`, o que é o padrão certo (marca em vez de decidir errado) — mas a extração em si ainda pega a primeira URL bruta sem preferir Forms/MesaQuest/linktr.ee sobre site institucional genérico quando há MÚLTIPLAS URLs no mesmo texto (caso "Ravenloft: Curse of Strahd" linha ~670 tem link de "Diferenciais" no meio da sinopse E não tem form de fato — funciona por sorte, mas "Máscaras de Nyarlathotep" premium linha ~1211 não tem URL nenhuma e usa call-to-action textual "chame no privado", que também não vira contato_discord por não ter menção `<@id>`).

**Plano de correção proposto:** ver task nova T9.9–T9.19 em `tasks.md` (Fase 9b, mesmo lote da detecção hierárquica de sistema — mesmo princípio de "estrutura óbvia no parser, sem tapa-buraco").

**Status (atualizado 2026-07-06 — lote fechado):** todas as tasks T9.9–T9.19 concluídas.

- **`extractPrice`/`collectLabelContinuation`/`calcConfidence`** (T9.9–T9.11): já corrigidas na rodada anterior — cascata label > texto livre > conflito real vira ambíguo; multi-parágrafo na descrição; penalidade de confiança por ambiguidade.
- **`extractModality`** (item 1, T9.12): **descartado como bug** — decisão explícita do mantenedor. Origem Discord = contato social online por natureza; presencial é raro e sempre citado explicitamente quando existe. Ausência de palavra-chave não é ambiguidade real nesse domínio. Mantido como está.
- **`extractType`** (T9.13): corrigido — cascata adicional por evidência indireta ("em andamento"/"já iniciada", número de sessões citado) antes de `null`. Caso real "Daggerheart: As Witherlands" (não cita "campanha" em lugar nenhum) agora resolve corretamente. Ideia complementar do mantenedor registrada na própria task: escolha de tipo (campanha/one-shot) no nível do LOTE de importação, não por anúncio — fora de escopo do parser puro, abrir quando UI de import for tocada.
- **`extractAgeRating`** (item 3, T9.14): **fechado sem código** — investigado o caso "Escola do Outro Lado", sem bug real (regex já exige `+` colado, não confunde "18 há 20 anos" com classificação). Sem evidência real de falha, não codar blindagem especulativa.
- **`extractSlots`** (item 4, T9.15): **fechado sem código** — comportamento já correto (label específico sempre vence via `slotsTotalOpen`, não por coincidência de ordem), só faltava teste formal, adicionado.
- **`extractDayOfWeek`/`extractStartTime`/`extractDiscordTimestamp`** (item 5, T9.16): corrigido — `extractDiscordTimestamp` agora coleta todos os timestamps `<t:...>` e marca `_schedule_ambiguity: true` quando há 2+ com dia/horário diferentes (caso real "Ravenloft: Curse of Strahd"). Novo campo em `types.ts` (backend + frontend espelhado), entra em `missing_fields` e `_notes`, desconta confiança.
- **`extractContactUrl`** (item 6, T9.17): corrigido — coleta todas as URLs e prioriza domínio de contato/inscrição conhecido (`KNOWN_CONTACT_URL_RE`, allowlist ampliada com `mesaquest.com.br`/`linktr.ee` — domínios reais confirmados no corpus) sobre link institucional/referência.
- **Fixture de regressão** (T9.18): 12 testes novos usando snippets exatos do corpus real (`D:\teste.json`) como fixture inline em `parseDiscordAnnouncement.test.ts`, citando o anúncio de origem em cada descrição de teste.

**Validação final (T9.19):** `pnpm run lint` repo-wide verde; `pnpm --filter @artificio/mesas-backend run build` (tsc) verde; `pnpm --filter @artificio/mesas-backend` vitest 239/239 verdes (227 pré-existentes + 12 novos, zero regressão); `tsc --noEmit` do frontend verde. Sem commit/push — aguardando autorização nominal.
