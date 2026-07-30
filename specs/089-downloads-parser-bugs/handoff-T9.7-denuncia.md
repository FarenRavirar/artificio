# Handoff — T9.7a–T9.7h · Ferramenta única de denúncia (spec 089, Fase 9)

**Para:** agente implementador (Codex)
**De:** sessão Claude Code de 2026-07-29 (auditoria + decisões do mantenedor)
**Branch atual:** `docs/089-fase-9`
**Autor das decisões:** mantenedor, nominalmente, 2026-07-29
**Revisão 2** — incorpora as duas lacunas apontadas pelo Codex (mapa de prioridade, campo de abuso) e a reclassificação pelo moderador.

---

## 0. Antes de qualquer coisa

1. **Ler `AGENTS.md` inteiro.** T0 pétreo. Sem isso não está autorizado a dizer que entendeu o estado do projeto.
2. Ler `specs/089-downloads-parser-bugs/spec.md` requisito **38d** (reescrito em 2026-07-29) e `tasks.md` **T9.7a–T9.7h**.
3. `spec.md` requisito **38d** e `tasks.md` **T9.7a** — D111 item 6 segue firme e a contenção de 2026-07-12 foi revogada. Por ordem posterior do mantenedor, o registro fica somente nesta spec.

**Autorização:** nada de `git commit`, `git push`, PR, merge ou deploy sem autorização nominal do mantenedor, **por ação**. Editar arquivo local dentro do escopo abaixo não precisa. `git commit --amend` é proibido sem exceção.

---

## 1. O achado, em uma frase

O funil de denúncia foi construído do meio para o fim: **a API é madura, as telas de acompanhamento e moderação existem, e não há nenhum `POST /api/v1/reports` no frontend.** Ninguém consegue criar denúncia pela interface — para alvo nenhum.

Evidência verificada em 2026-07-29:

| Verificação | Resultado |
|---|---|
| `POST /api/v1/reports` no frontend | **zero ocorrências**. `useMyReports.ts:30` (`GET /mine`), `useReportsQueue.ts:25` (`GET /`), `:39` (`PATCH /:id`) — nada mais |
| `MaterialPage.tsx` | nenhuma menção a denúncia (busca case-insensitive por `denunc|report`) |
| `download_report` | só `material_id`, e `NOT NULL` (`migration_005_download_report.sql:11`). Não há `comment_id` |

**Três lugares afirmam o canal inexistente:**
- `apps/downloads/backend/src/routes/comments.ts:70` — "retirada só por denúncia/moderação"
- `apps/downloads/frontend/src/components/CommentSection.tsx:19` — "UI já existe na ficha via denúncia" (falso em dobro)
- `apps/downloads/frontend/src/pages/SobreEUsoPage.tsx:74` — "canal de denúncia disponível na página do material", em seção de **direitos autorais** (pior lugar: manda autor com problema de copyright para botão ausente)

Sem esse formulário, a **D111 item 6** ("comentário: retirada só por denúncia") é inexequível.

---

## 2. Decisões do mantenedor (2026-07-29) — não reabrir

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Denúncia é UMA ferramenta só.** Alvo (material ou comentário) é dado de entrada | Uma tabela, uma API, uma fila, **um** componente de UI. NÃO construir "denunciar comentário" como fluxo separado de "denunciar material" |
| 2 | **Nada sai do ar automaticamente** | Revoga a contenção de 2026-07-12 (`reports.ts:65`: 1 denúncia P0 → `withdrawn`). Denúncia enfileira; moderação humana decide |
| 3 | **Uma denúncia por (denunciante, alvo)** | Índice único **no banco**, não só validação de aplicação |
| 4 | **Qualquer usuário logado pode denunciar** | Conta `accounts.` obrigatória (D111 item 6, sem anônimo). Sem restrição a "quem baixou" |
| 5 | **Comentário acatado fica com marca "removido pela moderação"** | Não desaparece. Corpo **não** volta na resposta; autor e data preservados |
| 6 | **Política de abuso publicada no `/sobre-e-uso`** | Exigência literal do DSA artigo 23, não cortesia |
| 7 | **Prioridade derivada da categoria no servidor** (mapa na §3) | `priority` sai do corpo da requisição. Hoje qualquer cliente manda `P0` |
| 8 | **Moderador reclassifica a prioridade** ao triar | `PATCH /:id` aceita `priority`. Denunciante nunca escolhe; moderador corrige |
| 9 | **Sinal de abuso é dado do caso, não bloqueio** | Dois campos novos na `036` (§4). Fila avisa; denúncia **nunca** é recusada |

### Base da decisão 2 (por que não é conservadorismo)

- **DSA artigo 16** exige decisão "tempestiva, diligente, não-arbitrária e objetiva" — remoção por sinal único é o vetor clássico de *brigading* (mass-reporting coordenado).
- **DSA artigo 23** exige **aviso prévio** antes de suspender o direito de denunciar, avaliando volume absoluto, proporção, gravidade e intenção. Caso a caso, nunca automático.
- A decisão de 2026-07-12 foi tomada quando a criação de denúncia não existia no frontend — a regra era inalcançável, o risco era teórico. Com o formulário ligado, vira porta de entrada do abuso.

### Fora de escopo (decidido, não esquecido)

**Suspensão do direito de denunciar.** Exige aviso prévio, prazo definido e canal de contestação (artigo 23). Construir pela metade é pior que não ter. O sinal de abuso **marca** o caso; nunca recusa a denúncia.

**Reputação ponderada de denunciante.** Avaliada e descartada: útil em escala de milhões, onde ninguém lê tudo. Aqui a moderação é humana e o volume baixo — um score opaco que o moderador não sabe interpretar cria o risco inverso (despriorizar denúncia legítima de conta nova). O sinal binário + a sequência bruta resolvem o mesmo problema sem opacidade.

---

## 3. Mapa de prioridade (lacuna 1, resolvida)

`P0`–`P3` **nunca tiveram semântica definida** neste projeto — só a ordenação da fila (`orderBy('priority', 'asc')`, P0 primeiro). O mapa abaixo define isso pela primeira vez.

**Critério: reversibilidade do dano se o conteúdo ficar no ar até a moderação olhar.** Não é gravidade moral — é custo da espera.

| Categoria (`REPORT_CATEGORIES`, `reports.ts:14-20`) | Prioridade | Justificativa |
|---|---|---|
| `malicious_link` | **P0** | Único caso em que a espera causa dano ativo e **irreversível**: quem clicou e foi infectado/fraudado não tem desfazer |
| `copyright_violation` | **P1** | Dano legal real e crescente, mas reversível ao remover. Exposição jurídica do projeto |
| `inappropriate_content` | **P1** | Dano a quem vê e reputacional. Reversível, mas não deve esperar dias |
| `broken_link` | **P3** | Sem dano — só frustração. Provavelmente verdadeiro e trivial de verificar |
| `other` | **P2** | Desconhecido. **Não** pode ser P3 (esconderia coisa grave que o denunciante não soube classificar) nem P0 (viraria a porta de escape de quem quer prioridade) |

### ⚠️ P0 NÃO REMOVE NADA

`P0` significa **"primeiro na fila"**, nunca "sai do ar". A decisão 2 revogou a remoção automática.

O nome "P0" carrega a memória do comportamento antigo (`reports.ts:65`). **Registrar isso em comentário no código, no mapa**, para que o próximo agente não reintroduza a remoção pensando que corrige um esquecimento. Este é o erro mais provável desta entrega.

### `other` em P2 é deliberado

É a categoria que se usa quando não se achou onde encaixar — inclusive para coisa grave. No fundo da fila seria ponto cego. A decisão 8 (reclassificação) existe justamente para o moderador corrigir `other` → `P0` quando for o caso.

---

## 4. Campos de abuso (lacuna 2, resolvida)

Confirmado: entram na **mesma** `migration_036` (mesma feature, mesma spec — §Migrations 2.1 proíbe fatiar).

```sql
reporter_abuse_flagged   BOOLEAN  NOT NULL DEFAULT FALSE,
reporter_dismissed_streak SMALLINT NOT NULL DEFAULT 0,
```

**Por que dois campos e não só o booleano.** O booleano registra *que* foi sinalizado, não *por quê*. O moderador abrindo a fila precisa decidir, e "possível abuso" sem contexto não sustenta decisão — o artigo 23 exige avaliação sobre volume, proporção, gravidade e intenção. `reporter_dismissed_streak` grava a sequência de descartadas **no momento da criação**, que é o valor que `isReporterAbusive` (`services/reportAbuseGuard.ts`) já calcula e hoje descarta. Custo: uma coluna. Ganho: a fila mostra "3 descartadas em sequência" em vez de um alerta opaco, e existe base concreta para os exemplos que o `/sobre-e-uso` precisa publicar (T9.7g).

**Semântica:** ambos são **snapshot da criação**, não valor vivo. Não recalcular depois — o que importa é o que se sabia quando a denúncia entrou.

**Nunca bloqueia.** A denúncia é criada normalmente, entra na fila normalmente. Os campos só alimentam o aviso ao moderador (T9.7f).

---

## 5. As 8 subtasks, em ordem de dependência

Ordem é **dependência real**: schema antes de API, API antes de UI, UI antes de validação. Cada uma é fechável sozinha.

### T9.7a — registro na spec revogando a contenção automática

Registrar em `spec.md`/`tasks.md` a revogação nominal (mantenedor, 2026-07-29) e o contrato novo: denúncia enfileira, moderação humana decide, nada sai do ar automaticamente. Revogação **explícita** da decisão de 2026-07-12. Registrar também o mapa de prioridade (§3) e a reclassificação pelo moderador (decisão 8) — são decisões de produto, não detalhe de implementação. Ordem documental posterior do mantenedor: nenhum registro desta fase em `decisions.md`, `project-state.md` ou backlog.

O comentário de `reports.ts:60-65` deve ser **reescrito citando a decisão nova**, nunca apagado — `AGENTS.md` §Regras Gerais de Código proíbe apagar comentário que documenta decisão.

### T9.7b — Migration `036` (uma só)

`apps/downloads/database/migration_036_*.sql`.

- `comment_id` UUID nullable, FK para `download_comment(id)` `ON DELETE CASCADE`
- **`material_id` precisa de `DROP NOT NULL`** — hoje é `NOT NULL` (`migration_005:11`) e o `CHECK` XOR não funciona sem isso. `DROP NOT NULL` **é permitido** em `online-safe`
- `CHECK` de alvo exclusivo: exatamente um de (`material_id`, `comment_id`) — nunca ambos, nunca nenhum
- **Índice único parcial** por `(reporter_user_id, material_id)` e por `(reporter_user_id, comment_id)` — garantia da decisão 3
- `reporter_abuse_flagged BOOLEAN NOT NULL DEFAULT FALSE` (§4)
- `reporter_dismissed_streak SMALLINT NOT NULL DEFAULT 0` (§4)

**Uma migration só.** O guard `MAX_AUTO_PENDING=5` conta cada arquivo como pendente. Header de 5 campos obrigatório (copiar de `migration_035_download_cover_asset_identity.sql`, que está verde):

```sql
-- @class: online-safe
-- @requires-backup: false
-- @author: spec-089
-- @created: <AAAA-MM-DD>
-- @description: <uma linha>
```

Idempotência obrigatória (roda 2x sem erro): `IF NOT EXISTS` em `ADD COLUMN`; `ADD CONSTRAINT` **não** aceita `IF NOT EXISTS` no Postgres 16 — envolver em `DO $$ ... END $$` checando `pg_constraint`, exatamente como a `035` faz.

### T9.7c — API `reports.ts`

1. **Apagar** o bloco `if (priority === 'P0' && material.editorial_state === 'published')` (linhas ~65-77) que faz `withdrawn`. T9.7a autoriza. Manter comentário explicando **por que** foi removido, citando a decisão.
2. `priority` **sai** do `createReportSchema` (linha ~25). Derivada da categoria pelo mapa da §3, em constante nomeada e testável.
3. Schema aceita `material_id` XOR `comment_id`, validando existência do alvo (404 se não existe).
4. Denúncia duplicada → **409**, sem criar linha. O índice único da T9.7b é a rede; tratar a violação para devolver 409, não 500.
5. `isReporterAbusive` passa a ser consultado **na criação**, gravando `reporter_abuse_flagged` e `reporter_dismissed_streak`. Nunca recusa (artigo 23).
6. **`decisionSchema` (linha ~162) aceita `priority` opcional** (decisão 8): moderador reclassifica ao triar. Registrar a mudança via `logModerationAudit` (já importado, `reports.ts:9`) — reclassificação é ação de moderação e precisa de trilha.

**Atenção ao 409 existente:** `PATCH` hoje recusa caso já `resolved`/`dismissed` (linha ~186). Reclassificar prioridade faz sentido só **antes** da decisão final — manter esse 409 valendo para `priority` também.

Testes devem provar: denúncia **não** altera `editorial_state`; `priority` do corpo do `POST` é ignorada; cada categoria mapeia à prioridade da §3; duplicata dá 409; alvo comentário entra na fila; `PATCH` com `priority` reclassifica e gera auditoria; `PATCH` com `priority` em caso já decidido dá 409.

### T9.7d — Marca "removido pela moderação"

`comments.ts:55-68` hoje filtra `removed_at is null` e o comentário evapora, indistinguível de nunca ter existido.

Passar a devolver o comentário removido **com marca e sem corpo** — o texto denunciado não pode continuar público. Preservar autor e data para a thread não perder contexto. Ajustar `CommentSection` para renderizar o estado.

Teste obrigatório: **o corpo original não vaza na resposta da API.**

### T9.7e — Componente de denúncia reutilizável (a peça que nunca existiu)

Um componente, alvo como propriedade — **não** dois fluxos (decisão 1).

- Categoria em linguagem clara para o usuário. **Não expor P0-P3** — prioridade é interna (decisão 7)
- Estados de erro cobertos: já denunciado (409), não autenticado, falha de rede
- Acoplar em `MaterialPage` e em cada comentário do `CommentSection`
- **WCAG 2.2** junto: foco visível e não encoberto, erro associado ao campo em texto, mudança de estado anunciada programaticamente (requisito 39a cobra nos cenários)

### T9.7f — Fila de moderação: alvo comentário, aviso de abuso, reclassificação

`GestaoDenunciasPage` hoje pressupõe material. Três acréscimos:

1. Alvo comentário: exibir o corpo denunciado, o material onde está e o autor — decidir sem sair da tela. Acatar aplica a remoção com marca da T9.7d
2. **Aviso de abuso** quando `reporter_abuse_flagged`, mostrando `reporter_dismissed_streak` ("denunciante com N denúncias descartadas em sequência"). Informativo — não esconde nem despriorizada a denúncia
3. **Reclassificar prioridade** (decisão 8), com o mapa da §3 como valor de partida visível

### T9.7g — `/sobre-e-uso`: política de denúncia e abuso

`SobreEUsoPage.tsx:74` hoje **mente**. Seção nova explicando:
- o que acontece ao denunciar (cria caso, moderação humana decide)
- que **nada é removido automaticamente**
- que comentário acatado fica marcado como removido
- que a denúncia é única por pessoa por alvo
- o que consideramos abuso do sistema, **com exemplos das circunstâncias avaliadas** — o artigo 23 exige isso literalmente nos termos. `reporter_dismissed_streak` (§4) dá base concreta para o exemplo

Corrigir a promessa da seção de direitos autorais para apontar o canal real.

### T9.7h — Os três comentários falsos

`comments.ts:70`, `CommentSection.tsx:19`, `SobreEUsoPage.tsx:74` (este coberto pela T9.7g).

Reescrever para descrever o que o código faz **depois** desta entrega, preservando a referência à D111 item 6 e à decisão da T9.7a. `AGENTS.md` §Regras Gerais de Código: proibido apagar comentário que documenta decisão; exige atualizá-lo citando a origem.

---

## 6. Armadilhas conhecidas

| Armadilha | Como evitar |
|---|---|
| **Reintroduzir remoção automática porque "P0"** | Erro mais provável desta entrega. P0 = primeiro na fila, nunca "sai do ar". Comentar no código |
| `material_id` é `NOT NULL` hoje | O `CHECK` XOR não funciona sem `DROP NOT NULL`. Permitido em `online-safe` |
| Fatiar a migration por tabela/coluna | Proibido (§Migrations 2.1). Uma só. `MAX_AUTO_PENDING=5` conta cada arquivo |
| `ADD CONSTRAINT IF NOT EXISTS` | Não existe no Postgres 16. Usar `DO $$` + `pg_constraint`, como a `035` |
| Reconstruir denúncia como dois fluxos | Decisão 1 proíbe. Alvo é dado de entrada |
| Recalcular `reporter_dismissed_streak` depois | É snapshot da criação, não valor vivo |
| Bloquear denúncia de denunciante sinalizado | Artigo 23 proíbe recusa automática. Marca, não bloqueia |
| Expor P0-P3 ao usuário no formulário | Prioridade é interna. Usuário escolhe categoria |
| Apagar comentário "errado" do código | Proibido. Reescrever citando a decisão nova |
| Silenciar lint/tipo/teste para passar | Proibido (`@ts-ignore`, `eslint-disable`, `.skip`). Corrigir a raiz |
| Achar bug fora do escopo e decidir sozinho | **Parar e perguntar** ao mantenedor: corrigir agora ou registrar débito |

---

## 7. Validação antes de declarar qualquer subtask fechada

```bash
# migration idempotente — roda 2x
# backend
cd apps/downloads/backend && rtk tsc -p tsconfig.json --noEmit && rtk vitest run
# frontend
cd apps/downloads/frontend && rtk tsc -p tsconfig.json --noEmit && rtk vitest run
# raiz — obrigatório porque toca apps/**
rtk pnpm verify:api
rtk pnpm run lint
```

`rtk` é obrigatório no lugar do comando cru (§T0). Na raiz do monorepo, `rtk lint`/`rtk tsc` falham com "JSON parse failed" (DEB-088-01) — usar `rtk pnpm run <script>`.

**Baseline atual:** downloads backend 463/463 verde antes desta entrega.

`pnpm verify:api` é obrigatório **antes** de montar commit que toque `apps/**` — o hook pre-commit regenera `docs/api/generated/*`, e se só rodar no hook os artefatos ficam fora do commit já feito.

A API muda contrato (`POST /reports` aceita `comment_id`, `PATCH /:id` aceita `priority`) — `docs/api/openapi/downloads.openapi.yaml` precisa acompanhar, com os campos `x-artificio-*` obrigatórios.

---

## 8. Estado do repositório no handoff

**Branch:** `docs/089-fase-9`

Há trabalho não commitado do mantenedor em andamento (fase 9: `creators.ts`, `PerfilPage.tsx`, `VisaoGeralPage.tsx`, `SugestoesSistemaPage.tsx` novo, entre outros). **Não** reverter, não commitar por conta própria, não assumir que é lixo.

Modificados pela sessão de auditoria, ainda não commitados:
- `specs/089-downloads-parser-bugs/spec.md` — requisito 38d reescrito
- `specs/089-downloads-parser-bugs/tasks.md` — T9.7 subdividida em 8; T9.9 cenários ajustados
- `specs/089-downloads-parser-bugs/plan.md` — tabela de arquivos afetados atualizada
- `specs/089-downloads-parser-bugs/handoff-T9.7-denuncia.md` — este arquivo
- `specs/backlog.md` — `D-API-AMBIGUOUS-PATHS` (não relacionado)
- `AGENTS.md` — regra de heredoc em mensagem de commit (não relacionado)

**Número da migration:** `036` vale para 2026-07-29. Se a fase 9 criar migration antes, conferir o maior `migration_NNN` em `apps/downloads/database/` e ajustar.

---

## 9. Fonte das referências regulatórias

- [DSA artigo 16 — notice and action](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html)
- [DSA artigo 23 — measures against misuse](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_23.html)
- [Santa Clara Principles](https://santaclaraprinciples.org/) — transparência da ação de moderação, base da decisão 5
