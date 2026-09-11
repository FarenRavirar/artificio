# Handoff — correção de 5 achados da revisão T9.7/T9.8 (spec 089, Fase 9)

**Para:** agente implementador (Codex)
**De:** sessão Claude Code de 2026-07-30
**Branch:** `docs/089-fase-9`
**Origem:** achados do próprio Codex na revisão da implementação local de T9.7/T9.8, verificados no código em 2026-07-30

---

## Veredito do mantenedor: corrigir agora, nenhum vira débito

Os cinco fazem T9.7 ou T9.8 falhar no **próprio critério de aceite**. T9.8 está aberta justamente porque a validação não terminou, então não há task fechada indevidamente — este é o momento barato. `AGENTS.md` §Conclusão de Tarefas: "nunca deixar tarefa fechada após uma validação real provar que ela não roda".

**Nada mais bloqueado.** As duas decisões pendentes foram tomadas pelo mantenedor em 2026-07-30 (§4 opção A; §4b corrigir agora).

| # | Arquivo | Gravidade | Estado |
|---|---|---|---|
| 1 | `reports.ts:76-83` | alta — dado do artigo 23 saturado | ✅ corrigido, verde |
| 2 | `ReportButton.tsx:30-59` | média — UI contraditória | ✅ corrigido, verde |
| 3 | `reports.ts:240-265` | **alta — inconsistência + auditoria falsa** | ✅ corrigido, verde |
| 4 | `EditarMaterialPage.tsx:137-145` | **alta — perda de trabalho do usuário** | **decidido (A)**, a implementar — §4 |
| 4b | `migration_036_*.sql` | alta — idempotência aparente | **decidido (corrigir)**, a implementar — §4b |
| 5 | `tasks.md:637` | documental | ✅ corrigido nesta sessão |

**Validação reportada em 2026-07-30 para os achados 1-3:** backend 12/12 focados + suíte completa verde; frontend 4/4 focados + 296/296 completa. Sem commit nem push.

**Dois itens seguem abertos por bloqueio de ambiente, não por descuido** — ver §4c.

---

## 1. `reporter_dismissed_streak` satura em 3

**Local:** `apps/downloads/backend/src/routes/reports.ts:76-83`

**Raiz: uma constante fazendo dois papéis.** `ABUSE_DISMISSED_STREAK_THRESHOLD = 3` (`services/reportAbuseGuard.ts:7`) é o **limiar de decisão** ("3 seguidas já é abuso"), mas está sendo usada como **tamanho da janela de busca**:

```ts
.limit(ABUSE_DISMISSED_STREAK_THRESHOLD)   // <-- busca só 3 registros
```

Consequência: `reporter_abuse_flagged` fica correto por acidente (3 já basta para o booleano), mas `reporter_dismissed_streak` **nunca passa de 3**. Denunciante com 8 descartadas em sequência grava `3`.

**Por que importa.** O campo existe para sustentar a avaliação do **DSA artigo 23**, que exige considerar *volume absoluto* e *proporção*. "8 descartadas" versus "3 descartadas" é a diferença entre padrão consolidado e incidente isolado — exatamente o que o moderador precisa distinguir, e a base dos exemplos que a T9.7g tem de publicar no `/sobre-e-uso`.

**Correção:** separar as duas constantes em `reportAbuseGuard.ts`.

```ts
export const ABUSE_DISMISSED_STREAK_THRESHOLD = 3;   // limiar de decisão (inalterado)
export const ABUSE_LOOKBACK_WINDOW = 20;             // janela de busca (nova)
```

`20` é suficiente para caracterizar padrão sem varrer histórico inteiro. Usar `ABUSE_LOOKBACK_WINDOW` no `.limit()`.

**Comentar a distinção no código** — os dois números coexistindo sem explicação convidam o próximo agente a "unificar" e reintroduzir o bug.

**Teste obrigatório:** denunciante com 8 descartadas consecutivas grava `reporter_dismissed_streak = 8` e `reporter_abuse_flagged = true`. Um teste com 3 não pega a regressão.

---

## 2. Estado de sucesso não é limpo

**Local:** `apps/downloads/frontend/src/components/ReportButton.tsx:30-59`

`toggle()` limpa `error` mas **não** `success`. `submit()` limpa `error` mas **não** `success`. Sequência que quebra:

1. Denuncia com êxito → `success = true`
2. Reabre o formulário em outro alvo → `success` continua `true`
3. Nova tentativa falha → `error` preenchido, `success` ainda `true`
4. UI mostra **sucesso e erro juntos**

**Correção:** `setSuccess(false)` em `toggle()` e no início de `submit()`.

**Teste:** sucesso seguido de falha renderiza só o erro.

---

## 3. Duas escritas sem transação — e auditoria que mente

**Local:** `apps/downloads/backend/src/routes/reports.ts:240-265`

Ordem atual: **(a)** atualiza `download_report` → **(b)** grava `logModerationAudit` → **(c)** remove `download_comment`.

Falhando **(c)**: denúncia `resolved`, comentário **ainda público**, e existe registro de auditoria afirmando que a moderação agiu.

**Este é o ponto mais grave, e vai além do relatado:** não é só estado inconsistente — é a **trilha de auditoria mentindo**. Registro de moderação que não corresponde a ação executada é pior que ausência de registro, porque um humano lendo depois confia nele.

**Correção:**
1. Envolver **(a)** e **(c)** em `db.transaction()`, garantindo que denúncia resolvida e comentário removido caiam juntos ou não caiam.
2. Mover `logModerationAudit` para **depois** do commit. Auditoria não registra ação que rolou de volta.

### 3.1 — Segundo defeito no mesmo trecho (não relatado)

Linha ~245:

```ts
.set({
  case_state: parsed.data.case_state,
  priority: parsed.data.priority,      // <-- sem condicional
  ...
})
```

`priority` é **opcional** no `decisionSchema` (T9.7c, reclassificação). Moderador que manda só `case_state` passa `undefined` para uma coluna `NOT NULL DEFAULT 'P3'`. Dependendo de como o Kysely serializa, é ignorado silenciosamente ou tenta gravar nulo.

**Correção:** só incluir `priority` no `set` quando definido (spread condicional). Está na mesma edição do item 3 — corrigir junto.

**Testes:** (a) falha na remoção do comentário deixa a denúncia **não** resolvida e nenhum registro de auditoria; (b) `PATCH` com só `case_state` preserva a `priority` existente.

---

## 4. ✅ DECIDIDO (2026-07-30, opção A) — Checklist marca ✓ sobre dado não salvo

**Local:** `apps/downloads/frontend/src/pages/painel/EditarMaterialPage.tsx:137-145`

Quatro dos sete itens leem **estado local do formulário**, não dado persistido:

| Item | Fonte | Persistido? |
|---|---|---|
| Básico: título e tipo | `material.title`, `material.material_type_id` | ✅ sim |
| Descrição e créditos | `descriptionMarkdown`, `authors` | ❌ local |
| Sistema | `systemId` | ❌ local |
| Capa | `material.cover_image_url \|\| coverUrl` | ⚠️ misto |
| Destino | `externalUrl` | ❌ local |
| Prévia do conteúdo | `descriptionMarkdown` | ❌ local |
| Enviar para revisão | `canSubmitForReview` | ✅ sim |

**E a linha 187 promete:** *"Faça na ordem que preferir. Tudo fica salvo para continuar depois."*

Resultado: a pessoa digita, vê ✓, **lê que está salvo**, sai, e perde o trabalho. Viola diretamente o critério de aceite da T9.8 ("consegue sair e retomar sem perder progresso").

**Este é o pior dos cinco** — os outros causam estado errado ou UI confusa; este causa **perda de trabalho do usuário**, induzida por uma afirmação nossa.

### Três caminhos — decisão do mantenedor, NÃO decidir sozinho

| Opção | O que muda | Custo | Risco |
|---|---|---|---|
| **A (recomendada)** | Checklist lê **só** `material.*` (persistido). Texto da linha 187 ajustado para descrever o que passa a ser verdade | baixo | ✓ acende só depois de salvar — pode parecer que não registrou |
| **B** | Salvamento automático por campo | alto | muda comportamento de gravação; autosave dentro de task de revisão |
| **C** | Remove a promessa da linha 187, mantém o checklist | mínimo | ✓ continua mentindo sobre estado |

### DECISÃO DO MANTENEDOR (2026-07-30): opção A

**Checklist lê somente `material.*` (dado persistido). Texto da linha 187 reescrito.**

Implementar:

1. **Os sete itens derivam de dado persistido.** `descriptionMarkdown`, `authors`, `systemId`, `externalUrl` e `coverUrl` saem do cálculo do `taskItems` — entram os campos correspondentes de `material`. O item "Capa" hoje é misto (`material.cover_image_url || coverUrl`) e passa a ler **só** `material.cover_image_url`, consistente com os demais.
2. **Linha 187 reescrita.** A frase atual ("Faça na ordem que preferir. Tudo fica salvo para continuar depois.") é falsa e é o que induz a perda. Texto novo, que descreve o comportamento real e explica o ✓ antes de a pessoa se confundir:

   > Faça na ordem que preferir. Cada etapa marca ✓ quando você salva — e continua salva se você sair.

3. **Comentário no código** explicando por que o checklist não pode ler estado local, citando este achado — senão o próximo agente "melhora" a responsividade do ✓ e reintroduz o bug.

**Razão de produto (por que A, e não B nem C).** O momento mais frágil da relação com quem publica é a primeira publicação: pessoa voluntária, material gratuito, nenhuma obrigação de estar aqui. Perder vinte minutos de descrição depois de ver sete ✓ verdes e ler "tudo fica salvo" não produz "erro do sistema" na cabeça dela — produz "não confio nisso". Material não publicado não aparece no catálogo e o projeto nunca sabe que existiu.

**B (salvamento automático) foi descartada, não esquecida.** É o que a promessa literalmente diz e seria a melhor experiência num mundo sem restrição, mas: é a maior mudança de comportamento de gravação do app entrando **dentro de uma task de revisão**; autosave em material com estado editorial (`draft`/`in_review`/`rejected`) abre perguntas não respondidas (salva rascunho durante revisão? escreve sobre o que o moderador está lendo?); e fecharia a T9.8 com feature nova não testada sobre bug recém-descoberto. **Boa ideia para spec própria depois** — não para agora.

**C (só remover a promessa) foi rejeitada.** Conserta a frase e deixa o ✓ mentindo: continua indicando "pronto" para dado que não existe, só sem prometer por escrito. É a correção que faz o sintoma sumir sem tocar a causa — vedado por `AGENTS.md` §Regras Gerais de Código ("solução mínima é proibido como critério de correção de bug"). E piora a experiência sem resolver: a pessoa perde a frase tranquilizadora **e** continua perdendo dado.

**Custo honesto de A, e como o texto o resolve.** Em A, a pessoa digita e o ✓ **não** acende até salvar — pode parecer que não registrou. O texto novo do item 2 existe exatamente para isso: explica o comportamento do ✓ antes da confusão acontecer, e mantém a garantia de retomada que a T9.8 promete.

---

## 4b. ✅ DECIDIDO (2026-07-30) — `migration_036`: filtro de `pg_constraint` sem `conrelid`

**Local:** `apps/downloads/database/migration_036_download_report_targets.sql`, os dois blocos `DO $$`.

**Defeito.** O `IF NOT EXISTS` filtra só por `conname`:

```sql
SELECT 1 FROM pg_constraint WHERE conname = 'chk_download_report_single_target'
```

Nome de constraint no PostgreSQL é único **por tabela**, não por banco. A consulta pergunta "existe constraint com esse nome em **qualquer** tabela?" quando deveria perguntar "nesta tabela?". Uma constraint homônima em outra tabela faz o bloco pular a criação silenciosamente, e a migration passa verde sem ter criado o `CHECK`.

`migration_028_download_material_type_central.sql:32` já usa o padrão correto no mesmo repositório.

### DECISÃO: corrigir agora

**Motivo decisivo: a migration nunca foi executada.** O PostgreSQL descartável não estava disponível, então ela não rodou — nem 1×, nem 2×. Corrigir agora é editar arquivo que ninguém aplicou.

Registrar como débito significaria deixar entrar em beta um arquivo com defeito conhecido, e depois precisar de uma `037` só para consertar — porque **migration já aplicada não se reescreve** (`AGENTS.md` §Migrations item 2). Esta ainda não foi. A janela para corrigir de graça é agora e fecha no primeiro deploy.

O nome `chk_download_report_single_target` é específico o bastante para provavelmente não colidir hoje. Mas idempotência que funciona porque o nome não repetiu ainda não é idempotência — é sorte, e o `apply_required_migrations.sh` roda contra bancos em estados diferentes (beta, prod, local).

**Correção:** acrescentar o filtro de tabela nos **dois** blocos, no padrão da `028`:

```sql
SELECT 1 FROM pg_constraint
WHERE conrelid = 'download_report'::regclass
  AND conname = 'chk_download_report_single_target'
```

Idem para `chk_download_report_dismissed_streak_nonnegative`.

---

## 4c. Bloqueios externos — não são conclusão, são bloqueio registrado

Dois itens **não podem ser marcados como fechados**, e o motivo não é descuido do implementador: falta de ambiente.

| Item | Bloqueio | Consequência |
|---|---|---|
| **T9.7b** — migration roda 2× sem erro | PostgreSQL descartável indisponível | Migration **não executada**. O critério de aceite exige execução real |
| **T9.9** — cenários visual/teclado | Navegador interno indisponível; Chrome do mantenedor não autorizado | Validação de acessibilidade e usabilidade **não executada** |

`AGENTS.md` §Conclusão de Tarefas é explícito: **dry-run, plano ou leitura de código não fecham tarefa cujo aceite exige execução real.** Ambas permanecem abertas com o bloqueio registrado — o que é o comportamento correto, não uma falha.

**Sobre o Chrome:** usar o Chrome do mantenedor (perfil logado, cookies e sessão reais) exige autorização nominal por ação (`AGENTS.md` §Autorização). Não inferir autorização por a task pedir validação visual.

**Para desbloquear a T9.7b**, o caminho mais barato é um Postgres em container local — exige Docker rodando e é decisão do mantenedor. Sem isso, a migration segue revisada mas não provada.

---

## 5. Contagem de cenários — JÁ CORRIGIDO

`tasks.md:637` (T9.9) listava 6 cenários e o critério dizia "os cinco cenários". Erro introduzido em 2026-07-29 ao desdobrar "moderar comentário" em "denunciar" + "moderar denúncia" sem atualizar a contagem.

**Corrigido nesta sessão** para "os **seis** cenários". Verificado que `spec.md` requisito 39a não repete a contagem — não havia segunda ocorrência. (O "cinco campos" em `spec.md:670` é de outro assunto, Fase 1, campos `plainText` — não mexer.)

Nenhuma ação para o Codex neste item.

---

## Validação antes de declarar qualquer correção fechada

```bash
cd apps/downloads/backend  && rtk tsc -p tsconfig.json --noEmit && rtk vitest run
cd apps/downloads/frontend && rtk tsc -p tsconfig.json --noEmit && rtk vitest run
# na raiz, porque toca apps/**
rtk pnpm verify:api
rtk pnpm run lint
```

`rtk` obrigatório no lugar do comando cru (§T0). Na raiz, `rtk lint`/`rtk tsc` falham com "JSON parse failed" (DEB-088-01) — usar `rtk pnpm run <script>`.

Cada correção precisa de **teste que falharia antes dela**. Especialmente o achado 1: teste com 3 descartadas passa nos dois casos e não prova nada — usar 8.

---

## Regras que valem para esta entrega

- **Nada de `git commit`/`push`/PR/merge** sem autorização nominal do mantenedor, por ação. `--amend` proibido sem exceção.
- **Proibido silenciar** lint/tipo/teste (`@ts-ignore`, `eslint-disable`, `.skip`) para fazer passar. Corrigir a raiz.
- **Comentário que documenta decisão não se apaga** (`AGENTS.md` §Regras Gerais de Código) — reescrever citando a decisão atual, com origem rastreável (spec/PR/achado).
- **"Solução mínima" não é critério** para correção de bug: resolver a causa raiz por completo, não abafar o sintoma citado. Escopo mínimo vale para *abrangência* (não sair mexendo em código não relacionado), nunca para *profundidade*.
- **Achou outro bug?** Parar e perguntar ao mantenedor: corrigir agora ou registrar débito. Nunca decidir sozinho.
