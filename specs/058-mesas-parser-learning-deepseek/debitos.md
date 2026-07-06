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
