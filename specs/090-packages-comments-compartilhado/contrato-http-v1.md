# Contrato HTTP v1 — namespace comunitário do `accounts.`

- **Task:** T2.2b (Fase 2, Bloco B) — fechar o contrato antes do primeiro handler.
- **Fonte:** `spec.md` §Contrato HTTP v1 (linhas 385-494), §Trust boundary e credenciais
  (349-362), §Referência opaca, URL e corpo (364-383), requisitos 5-22; `plan.md`
  §Arquitetura da solução; decisões 12, 17, 32-50 e 53 do grilling (`tasks.md:496-1039`).
- **Estado:** contrato fechado. Nenhum handler implementado ainda — este documento é o que as
  tasks de implementação (T2.6c, T2.7b, T2.12-T2.26) executam.

> **Este documento não gera OpenAPI.** `docs/api/openapi/accounts.openapi.yaml` é **gerado a
> partir do código** (`pnpm api:inventory` → `api:generate-openapi`; o cabeçalho do próprio
> arquivo declara isso). Editá-lo à mão agora seria sobrescrito no primeiro `verify:api`. A
> obrigação de `rtk pnpm verify:api` vale **quando o handler entrar**, como a própria T2.2b diz
> ("quando código/API entrar") — não neste passo.

---

## 1. Camadas e quem chama o quê

Três superfícies distintas, com autenticação distinta. Confundi-las é o erro que o requisito 6a
existe para impedir.

| Superfície | Prefixo | Autenticação | Quem chama |
|---|---|---|---|
| **Interna comunitária** | `/internal/v1/*` | credencial de serviço (`X-Service-Token`) + `X-Acting-User-Id` | somente o **backend** do módulo consumidor |
| **Sessão do titular** | `/api/v1/*`, `/api/account` | cookie de sessão SSO | navegador, direto no `accounts.` |
| **Fachada do módulo** | contrato próprio de cada app | sessão do app | navegador do usuário |

**O navegador nunca chama `/internal/v1`.** A escrita é backend-to-backend (requisito 6a,
`plan.md` §Referência opaca): o backend do módulo valida existência, visibilidade, estado
comentável e ownership do alvo, e só então chama o `accounts.`. Escrita sem credencial de
serviço retorna `401`; escopo incompatível retorna `403`.

Isso também contorna um bloqueio material já medido: a allowlist CSRF do `accounts.` tem cinco
origens (`app.ts:87`) e exclui `downloads` e todos os betas. Server-to-server não passa por
origem de navegador.

### 1.1 Headers das rotas internas

| Header | Obrigatório | Formato | Regra |
|---|---|---|---|
| `X-Service-Token` | sempre | `<token_id>.<segredo>` | resolvido por `resolveServiceCredential`; `realm` e `source_app` saem **daqui**, nunca do corpo |
| `X-Acting-User-Id` | escrita e leitura autenticada | UUID do `users.id` | o ator da operação; ausente em leitura pública |
| `Idempotency-Key` | escrita não idempotente | 8-128 ASCII | ver §6 |
| `X-Correlation-Id` | opcional | ASCII ≤128 | ecoado em toda resposta de erro |

**`realm` e `source_app` não são campos de request.** São derivados da credencial
(`ServiceCredentialIdentity.realm` / `.sourceApp`, `serviceCredential.ts:24-37`). Payload que
tente declará-los é rejeitado com `400`/`invalid_body` — aceitar significaria que uma credencial
de beta escreve em produção, que é exatamente o furo que a migration 007 fechou.

### 1.2 Escopos

Espelham `SERVICE_SCOPES` (`serviceCredential.ts:40-48`) e o `CHECK` da migration 007. Nenhum
escopo novo é criado por este contrato.

| Escopo | Rotas |
|---|---|
| `comment.read` | leitura de árvore, versões públicas |
| `comment.write` | criação, resposta, edição, auto-retirada |
| `vote.write` | mutação de voto |
| `report.write` | denúncia e retirada de denúncia |
| `moderation.write` | remoção, restauração, fila, caso, veredito, recurso, sanção, invalidação de voto |
| `users.read`, `secrets.read` | pré-existentes; fora deste contrato |

`moderation.write` autentica o **serviço**. O papel do ator (`admin`/`moderator`) é verificado
separadamente contra `accounts.users`, a partir de `X-Acting-User-Id` — credencial de serviço
não concede papel de moderação.

---

## 2. Leitura de comentários

### `GET /internal/v1/comments`

Escopo `comment.read`. Devolve a árvore do assunto.

**Query:** `subject_type` (namespaced, ≤64 — ver abaixo), `subject_id` (≤255), `sort`
(`best`\|`top`\|`new`\|`old`, padrão `best`), `cursor` (opaco, opcional). `realm`/`source_app` vêm
da credencial.

> **`subject_type` é namespaced e o ponto é obrigatório.** Formato:
> `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` — pelo menos dois segmentos em minúsculas separados por
> ponto, o primeiro sendo o app. Válidos: `site.post`, `downloads.material`, `mesas.table`.
> Inválidos: `post`, `Material`, `blog.`, `blog..post`.
>
> Não é convenção: `migration_006` linha 118 tem `CHECK (subject_type LIKE '%.%')` em
> `community_comment_subject`. Enviar `post` produzia erro de constraint sem motivo legível, porque
> nem este contrato nem `subjectRefSchema` exigiam o ponto (regex com `*` no lugar de `+`). Os dois
> foram corrigidos em 2026-08-07, depois de o script de medição pegar a divergência contra
> PostgreSQL real (T2.6c).

**Resposta 200:**

```
{
  "state": "fresh",
  "snapshot_revision": 42,
  "comments": [ Comment... ],
  "more": [ { "parent_id": "...", "count": 17, "cursor": "..." } ],
  "truncated": false
}
```

- Árvore inteira no volume normal (decisão 3). Hard cap **1.000 comentários ou 2 MiB**, o que
  ocorrer primeiro; o restante vira nós `more` com cursor próprio, **nunca filho órfão**.
- Ordenação só entre irmãos; `created_at` e `id` desempatam.
- `cursor` opaco assinado fixa assunto, sort, `snapshot_revision`, ramo, sort-key, limite e
  **expiração de 30 minutos**. Cursor de outra consulta → `400`/`invalid_cursor`.
- Cache `private, no-store`; ETag admitido, sem cache persistente de UGC.

**Objeto `Comment` — campos públicos:**

`id`, `parent_id`, `root_id`, `depth`, `body_markdown`, `created_at`, `edited_at`, `state`,
`author` (`{ display_name, avatar_url, badge, state }`), `upvotes`, `downvotes`, `score`,
`my_vote`, `legacy` (`{ source, author_name }` ou `null`).

**Nunca no payload público:** identidade de votante, identidade de denunciante, detalhe de
denúncia, nota interna de moderação, fingerprint, `user_id` cru do autor, `community_actor_id`,
versões antigas, `removed_reason`.

- `my_vote` só aparece com `X-Acting-User-Id`.
- Estado `removed` (tombstone) e `pending_review_hidden`: `body_markdown`, `upvotes`,
  `downvotes` e `score` vêm nulos; posição e descendentes permanecem (decisões 34, 46).
- `badge` é `"admin" | "moderator" | "content_author" | null`, nesta precedência. `admin` e
  `moderator` são o enum de `users.role` (`migration_002:24`), vindos do `JOIN` — papel global.
  `content_author` é o autor/publicador do assunto, que `spec.md:311` classifica como papel **de
  domínio** e que sai de `owner_user_id` afirmado pelo backend (§8), nunca do payload público.
  Papel de domínio **não é promovido a global**, por isso o global vence quando ambos valem.
  `null` para usuário comum (requisito 11: não rotular) e **sempre** para legado (`spec.md:249`,
  15b: sem conta real por trás não há o que assinar).
- `author.state` é `"active" | "deleted" | "legacy"` (T2.9, requisitos 7, 7a-7b; decisão 53).
  `deleted` traz `display_name: "Conta excluída"` — nome neutro **materializado pelo backend**,
  nunca `null`: nulo obrigaria cada consumidor a inventar o próprio texto. `avatar_url` e `badge`
  vêm nulos. `legacy` traz `legacy_author_name` e autoria não verificada.

  **Conta excluída e conta em retenção interna saem idênticas** — mesmo `state`, mesmo payload.
  Distingui-las diria ao público que aquele autor tem caso de moderação aberto; a moderação vê a
  diferença por outra superfície (T2.19), nunca por esta.

  **`badge` é valor de máquina, não texto de tela.** O rótulo em português — "autor do post",
  "autor do material", "mestre da mesa" — é escolha do frontend por `source_app` (T4.10);
  `AGENTS.md:85` reserva a linguagem pública para lá. Daí a palavra neutra: `post_author` mentiria
  num comentário de `downloads.material`, porque `post` é nome de tipo do `site` (`site.post`).

**Erros:** `400` contrato/cursor · `401` credencial ausente · `403` escopo · `429` limite.

---

## 3. Criação e resposta

### `POST /internal/v1/comments` · `POST /internal/v1/comments/:id/replies`

Escopo `comment.write`. Exige `Idempotency-Key` e `X-Acting-User-Id`.

**Body:** `subject_type`, `subject_id`, `canonical_path`, `body_markdown`, `subject_owner_user_id`
(opcional, ver §8), `subject_authorization` (§8). Em `/replies`, o `:id` é o pai; `root_id` e
`depth` são **calculados**, nunca aceitos.

**Invariantes na mesma transação (requisito 8, decisão 12c):**

1. Pai existe, pertence ao mesmo `(realm, source_app, subject_type, subject_id)`.
2. `depth` resultante ≤ 4. Excedente → `422`/`depth_exceeded`.
3. `body_markdown` passa por `sanitizeUserMarkdown`; entrada original **e** saída canônica ≤
   10.000 caracteres (decisão 25). Excesso → `422`/`body_too_long`, **sem truncar**.
4. `markdownToPlainText` do resultado não pode ser vazio → `422`/`body_empty` (decisão 30).
5. Links pela política única de `@artificio/content-editor/comment-links`
   (`findCommentLinkViolation`); violação → `422`/`INVALID_COMMENT_LINK` com `rule` e `offset`
   do `CommentLinkViolation`, **sem ecoar o payload hostil** (decisão 29). As `rule` possíveis
   são `scheme_not_https`, `protocol_relative`, `relative_not_rooted`, `malformed_url`,
   `embedded_credentials` e `input_too_large`.

   **Ordem obrigatória: o limite de 10.000 do item 3 é checado antes da varredura de links.**
   `MAX_SCAN_LENGTH` do pacote é 12.000 (`commentLinks.ts:275`), mais frouxo que o limite do
   comentário. Com a ordem certa, `input_too_large` é **inalcançável por esta rota** — corpo
   acima de 10.000 já saiu com `body_too_long`. A `rule` continua existindo porque o pacote
   serve outros consumidores, e o handler deve tratá-la como `422`/`INVALID_COMMENT_LINK`
   genérico caso apareça; se ela aparecer de fato, é sinal de que a ordem foi invertida.
6. `canonical_path` começa por `/`, sem scheme, host, barra invertida ou credencial.
7. Sanção `commenting` ativa → `403`/`sanctioned` (decisão 48, falha fechada).
8. `notification_event` + `notification_receipt` nascem na **mesma transação** (decisão 1):
   raiz notifica o publicador vinculado; resposta notifica autor do pai **e** publicador;
   destinatários iguais deduplicam para um recibo; o ator nunca se notifica; conta removida ou
   bloqueada não recebe.

Legado **pode ser pai** (decisão 23), mas não pode ser editado nem votado.

**Resposta 201:** o `Comment` criado. **Erros:** `400` · `401` · `403` escopo/sanção · `404`
pai ou assunto inexistente · `409` idempotência · `422` thread/corpo/link · `429`.

---

## 4. Edição e auto-retirada (T2.7, T2.7b, decisões 17, 20)

> **Implementado em `communityCommentLifecycle.ts` (T2.7/T2.7b, 2026-08-09).** As duas rotas
> compartilham a prova de autoria sob `FOR UPDATE`, e o `403` de terceiro vem daí — escopo de
> credencial diz o que o app pode fazer, nunca quem é dono da fala.

### `PATCH /internal/v1/comments/:id`

Escopo `comment.write`. Exige `Idempotency-Key`. Somente o **autor**; terceiro recebe `403`.

Corpo: **apenas `body_markdown`**, com `strict()` — qualquer outro campo é `400`/`invalid_body`,
nunca ignorado em silêncio. Pai, assunto, autoria e `created_at` são imutáveis. Sem
prazo. Mesmas validações 3-5 de §3. Edição idêntica é **no-op**: `200` com o comentário atual,
sem versão nova, sem `edited_at` alterado — a comparação é sobre o Markdown **canônico**, para
que mudança só de espaçamento não crie versão. Edição real cria linha em
`community_comment_version`, move `current_version_id`, marca `edited_at` e **preserva votos e
ranking** (decisão 18). Não gera notificação.

Comentário em `pending_review_hidden` **continua editável, e a edição não o revela**
(decisão 41) — `200`, `visibility_state` fora do `SET`.

Comentário já retirado **não volta a ser editável** → `403`/`comment_removed`.

Legado não é editável → `403`/`legacy_immutable`. A recusa vem **antes** da checagem de autoria:
legado tem ator nulo, e cair em `forbidden_not_author` daria o motivo errado.

**Resposta 200:** o `Comment` atual. Vale igual para edição real, no-op e replay idempotente —
o cliente não precisa distinguir os três.

### `DELETE /internal/v1/comments/:id`

Escopo `comment.write`. Somente o autor. **Sem `Idempotency-Key`** — o efeito já é idempotente:
a segunda chamada encontra o tombstone e recusa com `403`/`comment_removed`, sem segundo efeito
nem segunda linha de auditoria.

Cria **tombstone**, nunca `DELETE` físico: preserva posição e descendentes, e o corpo **permanece
na linha** — quem oculta corpo e score é a leitura (§2), não a escrita. Apagar o texto aqui
destruiria a evidência da denúncia que T2.19 fixa por `reported_version_id`.

Registra ator, motivo e timestamp em `community_moderation_audit`, **na mesma transação** do
estado. O motivo é o valor canônico `"Retirado pelo próprio autor"`, porque a rota não tem corpo e
`community_comment_removal_check` exige `removed_reason` não-vazio; `metadata` guarda o estado
anterior, que é o que distingue retirada de comentário visível da de um já oculto por denúncia.

**Irreversível para o autor** — não existe rota de restauração com escopo `comment.write`; só
`moderator`/`admin` restaura (§5).

Auto-retirada com caso aberto **não encerra a moderação** (decisão 46): o caso segue aberto,
cada denúncia recebe veredito, e a retirada não vale como confissão.

**Resposta 204**, sem corpo. **Erros:** `401` · `403` não-autor/legado/já-retirado · `404` · `429`.

---

## 5. Moderação de conteúdo

Todas exigem escopo `moderation.write` **e** papel `admin`/`moderator` do `X-Acting-User-Id`
verificado contra `accounts.users`. Papel insuficiente → `403`/`forbidden_role`.

| Rota | Contrato |
|---|---|
| `POST /internal/v1/comments/:id/removal` | tombstone moderador; body `{ reason }` ≤500; auditoria na mesma transação; notifica o autor |
| `POST /internal/v1/comments/:id/restore` | limpa `removed_at`/`removed_by`/`removed_reason`; registra quem restaurou; notifica o autor |
| `GET /internal/v1/comments/moderation-queue` | fila agregada por caso; filtro por `realm`, `source_app`, estado, prioridade; cursor |
| `GET /internal/v1/comments/moderation-log` | histórico de ações; cursor |
| `GET /internal/v1/comments/:id/versions` | versão denunciada, versão atual e diff; **restrito à moderação** |

`realm` do filtro é limitado ao da credencial — beta nunca aparece misturado com produção
(requisito 27a).

**Moderação nunca reescreve texto de terceiro** (decisão 22). Não existe rota de edição
moderadora de corpo. Retirada é por tombstone; correção exige nova edição do próprio autor.

---

## 6. Idempotência e concorrência

**`Idempotency-Key`** obrigatória em toda escrita não idempotente: criação, resposta, edição,
denúncia, retirada de denúncia, fechamento de caso, recurso, sanção, invalidação de voto.
8-128 ASCII. Retenção **24 horas**.

- Repetição com **mesmo payload** → devolve a resposta original (mesmo status, mesmo corpo).
- Repetição com **payload diferente** → `409`/`idempotency_key_reuse`.

**Voto não usa chave** (decisão 12): é estado absoluto, e retry idêntico é no-op por
construção. Sem `ETag`, sem `If-Match`.

**Transição terminal concorrente** (decisões 36b, 43): fechamento de caso, auto-hide e retirada
de denúncia serializam por lock/condição no banco. Um moderador vence; o segundo recebe
`409`/`case_already_resolved`, **nunca** um segundo efeito ou uma segunda notificação. Esta é a
correção explícita do check-before-transaction do `downloads` — não se replica o defeito.

---

## 7. Voto (decisões 5, 7, 10, 11, 12)

> **Implementado em `communityCommentVote.ts` (T2.12-T2.14, T2.16, 2026-08-09).**
> Voto, revisão de ranking, faixa de score e auditoria numa transação só. `value: 0`
> **remove a linha** — `community_comment_vote.value` tem `CHECK (value IN (-1, 1))`,
> então zero nem chega ao banco; ausência de linha é "sem voto".

### `PUT /internal/v1/comments/:id/vote`

Escopo `vote.write`. Exige `X-Acting-User-Id`. **Sem `Idempotency-Key`.**

Corpo `strict()`: só `value`, e só os três literais. Campo extra é `400` — ignorá-lo faria
quem mandou `comment_id` achar que votou em outro comentário.

**Body:** `{ "value": -1 | 0 | 1 }`. `0` remove o voto.

- Mesmo valor → **no-op**: `200`, sem nova revisão, sem histórico.
- Mudança real → atualiza `comment_vote`, contagens, `comment_score_version`, incrementa
  `ranking_revision` do assunto sob lock curto, tudo na mesma transação.
- **Autor não vota no próprio comentário** → `403`/`self_vote`.
- Legado não aceita voto → `403`/`legacy_immutable` (decisão 6).
- Comentário em tombstone ou `pending_review_hidden` → `403`/`not_votable`.
- Conta nova vota com o **mesmo peso**, sem quarentena (decisão 11).
- Voto **não gera notificação** (decisão 13).
- Última transação persistida vence; concorrência entre dispositivos não gera conflito.

**Resposta 200:** `{ "my_vote": n, "upvotes": n, "downvotes": n, "score": n }`.

### `POST /internal/v1/moderation/vote-invalidation`

Escopo `moderation.write` + papel. Exige `Idempotency-Key`. Body
`{ target_actor_id, reason }`. Invalida os votos de conta abusiva, recalcula os assuntos
afetados sob **nova `ranking_revision`**, **sem apagar o histórico bruto** (decisão 14).
Desativação comum **não** invalida — preserva votos e score, só bloqueia voto novo.

---

## 8. Autorização do assunto (`CommentSubjectAuthorization`, T2.2, decisão 2)

> **Implementado em `@artificio/comments` (T2.2, 2026-08-05):** `subjectAuthorizationSchema`,
> `subjectRefSchema`, `canonicalPathSchema`, `normalizeGuardResult` e
> `runSubjectAuthorizationConformance`. O handler do `accounts.` valida o campo por esse schema;
> o guard concreto de cada app é escrito na fase de adoção e roda a suíte.

O `accounts.` **não conhece o domínio** dos consumidores. Quem afirma que o alvo existe, está
visível e é comentável é o backend do módulo, no campo `subject_authorization`:

```
{
  "exists": true,
  "visible": true,
  "commentable": true,
  "owner_user_id": "<uuid|null>",
  "canonical_path": "/materiais/xyz"
}
```

**O campo é obrigatório na escrita, e é ele que registra o assunto.** Não existe rota de
"cadastrar assunto": a linha de `community_comment_subject` — que carrega `ranking_revision` e é
alvo do FK do comentário — **nasce no primeiro comentário**, a partir desta afirmação, e tem
`canonical_path`/`owner_user_id` reafirmados a cada escrita (post movido de rota, dono vinculado
depois). `ranking_revision` nunca é reescrito por aqui; ele pertence ao voto (§7).

Negativa em `exists`, `visible` ou `commentable` vira `404` **uniforme** (§13), nunca `400`:
`400` diria que o payload chegou a ser examinado, o que reintroduz o oráculo de existência que o
`404` fecha. `owner_user_id` apontando para conta já excluída no `accounts.` é reduzido a `null`
— sem conta viva não há badge nem destinatário (15a, 15b), e a FK derrubaria a transação inteira
por uma afirmação stale do módulo.

Esta afirmação **só é confiável porque vem por credencial de serviço**. Referência opaca não
substitui autorização por objeto (`plan.md`, OWASP IDOR): se viesse do navegador, o atacante
inventaria dono, badge e assunto inexistente.

**Nomenclatura — snake_case no wire, camelCase no tipo.** O JSON acima usa `owner_user_id` e
`canonical_path`, seguindo o resto da API; `subjectAuthorizationSchema` de `@artificio/comments`
usa `ownerUserId` e `canonicalPath`, seguindo o resto do TypeScript do repo. A conversão é
responsabilidade do handler, num único ponto de entrada — **não** se espalha por camada, e o
schema **não** aceita as duas grafias (aceitar ambas deixaria um campo passar despercebido se a
conversão falhasse).

**Consequência para o badge:** "autor do conteúdo" sai de `owner_user_id` afirmado pelo
backend do domínio, **nunca** do payload público (requisito 11). Papel global (`admin`,
`moderator`) sai do `JOIN` com `accounts.users`. Usuário comum não recebe rótulo.

`owner_user_id` nulo é caso legítimo e **não inventa destinatário** (requisitos 15a, 15b): post
do blog do `site` não tem conta vinculada, e mesa órfã do `mesas` também não. Comentar ali não
notifica ninguém; **responder a um comentário continua notificando quem escreveu o pai**.

---

## 9. Denúncia (decisões 32-34, 37-39, 42, 49)

### `POST /internal/v1/comments/:id/reports`

Escopo `report.write`. Exige `Idempotency-Key` e `X-Acting-User-Id`.

**Body:** `{ reason_code, details? }`.

`reason_code` do registro compartilhado: `malicious_link`, `inappropriate_content`,
`spam_or_off_topic`, `harassment_or_hate`, `personal_data`, `copyright_violation`,
`illegal_content`, `other`.

`details`: texto puro, trim, ≤4.000, **imutável**. Política por motivo — `other`,
`copyright_violation` e `illegal_content` exigem; os demais aceitam. Obrigatório e vazio →
`422`/`details_required`; `forbidden` e preenchido → `422`/`details_forbidden`.

**Invariantes:**

- Exige conta e **terceiro**: autor não denuncia o próprio comentário → `403`/`self_report`.
- No máximo **uma denúncia ativa** por conta/comentário → `409`/`report_already_active`.
- Captura `reported_version_id` **atomicamente** (decisão 39); a versão referenciada não sofre
  purga automática.
- Uma denúncia **prioriza a fila, não oculta**. A **quinta conta distinta** com denúncia ativa
  move o comentário para `pending_review_hidden` atomicamente (decisão 34).
- Denúncia contra **versão já aprovada** é recebida e auditada como `no_determination`, motivo
  interno `approved_version`; **não abre caso, não conta para limiar, não altera visibilidade**
  (decisão 45). O denunciante recebe só o resultado mínimo.

**Identidade do denunciante é persistida e visível somente a `moderator`/`admin`** — nunca ao
público, ao autor denunciado ou a outro denunciante.

### `DELETE /internal/v1/reports/:id`

Escopo `report.write`. Somente o próprio denunciante. Marca `withdrawn`: deixa de contar para o
limiar, **permanece na auditoria**.

**Só antes do auto-hide** (decisão 42). Depois de `pending_review_hidden` → `409`/`report_locked`.
Retirada e inserção da quinta denúncia serializam: se a retirada conclui antes, o limiar é
recalculado; se o auto-hide conclui antes, a retirada é recusada.

---

## 10. Caso, veredito e recurso (decisões 40, 43, 44, 47)

| Rota | Contrato |
|---|---|
| `GET /internal/v1/moderation/cases/:id` | caso com denúncias, quantidade, categorias, prioridade máxima e identidades dos denunciantes — **só moderação** |
| `POST /internal/v1/moderation/cases/:id/resolution` | fecha o caso; `Idempotency-Key`; vencedor único |
| `POST /internal/v1/moderation/cases/:id/reopen` | reabertura manual com motivo (decisão 45) |
| `PATCH /internal/v1/moderation/cases/:id/priority` | reclassificação com motivo e auditoria (decisão 38) |
| `POST /internal/v1/moderation/decisions/:id/appeals` | recurso do autor |
| `POST /internal/v1/moderation/appeals/:id/resolution` | julgamento do recurso |

**Fechamento** — body `{ verdicts: [{ report_id, verdict }], action, reason }`:

- **Veredito é individual por denúncia:** `upheld` \| `dismissed` \| `no_determination`.
- **Ação é única por caso:** `no_change` \| `restore` \| `remove`.
- `no_change` significa **não alterar a visibilidade atual**, esteja ela visível ou retirada
  pelo autor (decisão 46) — substitui o nome anterior `keep_visible`.
- Fecha só quando **todas** as denúncias não retiradas têm veredito, e a ação persiste na
  **mesma transação** com moderador, motivo e auditoria.
- Um vencedor concorrente; o segundo recebe `409`/`case_already_resolved`.
- Existe no máximo **um caso aberto por comentário**; denúncia válida posterior abre **caso
  novo**, não reabre o encerrado (decisão 40).

**Recurso** (decisão 47): somente o **autor**, uma vez por decisão terminal que removeu seu
conteúdo, em até **seis meses**. Referencia caso, decisão e versão. **Não restaura
automaticamente.** Termina em `upheld` ou `reversed`, com notificação privada. Denunciante não
recorre de `not_upheld` → `403`. Segundo recurso → `409`/`appeal_already_filed`. Fora da janela
→ `422`/`appeal_window_expired`. **Não há exigência de segundo moderador** — o mesmo pode
rejulgar, com nova justificativa registrada.

**Resultado é privado e mínimo** (decisão 44): cada denunciante recebe apenas
`action_taken` \| `not_upheld` \| `no_determination` correspondente ao **próprio** veredito.
O autor recebe aviso de auto-hide, remoção e restauração, com categoria pública e próximo
passo. Nenhum dos dois recebe identidade de terceiro, nota interna ou raciocínio reservado.
Evento e recibos nascem na transação da mudança de estado.

---

## 11. Sanção comunitária (decisão 48)

### `POST /internal/v1/moderation/sanctions`

Escopo `moderation.write` + papel. Exige `Idempotency-Key`.

**Body:** `{ target_actor_id, scopes: ["posting"|"commenting"], level, expires_at?, reason }`.
`level`: `warning` \| `temporary` \| `permanent`; `temporary` exige `expires_at`.

- **Separada do SSO**: login, leitura e uso não comunitário continuam. Auto-retirada de conteúdo
  próprio continua permitida.
- **Nenhuma sanção é automática**: denúncia, limiar e reincidência **não** aplicam sanção;
  moderador escolhe nível, prazo e motivo, tudo auditado.
- `commenting` **falha fechado** antes da escrita já na Fase 2 (§3, invariante 7). `posting`
  nasce no contrato central para os apps adotarem — **não** transforma silenciosamente criar
  mesa ou material em postagem.

`GET /internal/v1/moderation/sanctions?actor_id=` lista histórico e gravidade para sugerir
progressão. `DELETE /internal/v1/moderation/sanctions/:id` revoga com motivo e auditoria.

---

## 12. Sessão do titular

Rotas de cookie SSO, **não** de credencial de serviço.

### `DELETE /api/account` — rota existente, preservada

Mantém o `204` atual e a confirmação atual. **Não nasce segunda rota de exclusão** (T2.2b).
Acrescenta o ciclo de T2.15 / decisão 53:

- Nome, e-mail, avatar, refresh e cookies saem no pedido; identidade pública vira "Conta
  excluída". Rotas comunitárias revalidam a conta e **recusam token antigo imediatamente**; os
  demais consumidores SSO respeitam o SLA existente de até 15 minutos — **sem** introspecção por
  request nesta fase.
- Comentários e votos/score **permanecem**.
- Sem caso/recurso ativo: o vínculo ator→conta é desfeito **no mesmo ciclo**.
- Com caso/recurso: restrito à moderação até **seis meses após a decisão final**, depois desfeito
  irreversivelmente. `legal_hold` explícito e auditado suspende o expurgo.
- Bloqueio de recadastro pela mesma identidade Google por **seis meses**, por fingerprint HMAC
  técnico mínimo. **Nunca aparece em API nem em log.**

### Notificações — Fase 3, não Fase 2

`spec.md:398-401` lista `GET /api/v1/notifications`, `/unread-count`, `PUT /:id/read` e
`/read-through`. **A decisão 1 mantém essas rotas na Fase 3.** A Fase 2 entrega apenas o núcleo
transacional: tabelas `notification_event`/`notification_receipt` e geração atômica dos recibos
(§3, invariante 8). Central, polling, API pública e outbox continuam na Fase 3.

Contrato reservado, para a Fase 3 não divergir: cursor por `(occurred_at, id)`, padrão 20 e
máximo 100; ownership **sempre** da sessão, nunca de parâmetro; `PUT` idempotente; **404
uniforme** para recibo inexistente ou de outro usuário — distinguir revelaria que a notificação
existe (requisito 19a); `private, no-store`.

---

## 13. Erros

**Formato único:** `{ "error": { "code": "...", "correlation_id": "..." } }`. Sem detalhe de
existência nem de autorização.

| Código | Quando |
|---|---|
| `400` | contrato malformado, cursor inválido/expirado/de outra consulta, campo derivado enviado no payload |
| `401` | credencial de serviço ausente/desconhecida/revogada, ou sessão ausente |
| `403` | escopo insuficiente, papel insuficiente, não-autor, auto-voto, auto-denúncia, legado imutável, sanção ativa |
| `404` | alvo, caso, recibo ou comentário inexistente — **uniforme**, inclusive para item de outro usuário |
| `409` | reuso de `Idempotency-Key` com payload diferente, caso já resolvido, denúncia já ativa, recurso já protocolado |
| `422` | profundidade, corpo vazio/excedente, link inválido, detalhe obrigatório/proibido, janela de recurso expirada |
| `429` | qualquer bucket aplicável estourado |
| `503` | dependência indisponível |

**Travas:**

- `401` é **genérico**: distinguir "credencial inexistente" de "segredo errado" seria oráculo de
  enumeração de `source_app` (`requireServiceCredential.ts:101-103`).
- `403` para escopo é deliberadamente diferente de `401`: a credencial é válida, a operação é que
  não é permitida. Confundir esconde erro de configuração atrás de "token errado".
- `404` **uniforme**: ID alheio e ID inexistente respondem igual.
- `429` **não revela** qual bucket disparou, limite restante ou sinal interno (decisão 50).
- `INVALID_COMMENT_LINK` carrega posição e regra, **nunca** o payload hostil (decisão 29).

---

## 14. Rate limiting (decisões 50, 54)

Buckets **independentes** por camada, identidade e ação. Nenhum consome a cota de `login`,
`/me` ou `refresh`.

| Camada | Chaves | Buckets |
|---|---|---|
| Fachada do módulo | IP real validado **e** usuário | leitura · criação/resposta · edição · voto · denúncia · recurso |
| `accounts.` | usuário **e** credencial de `source_app` | mesmos seis |

- **Todos** os buckets aplicáveis precisam liberar. Não existe chave composta IP+usuário.
- **IP bruto não entra** em schema, payload interno nem auditoria comunitária. Na fachada, a
  chave existe somente pelo TTL do bucket.
- Conta nova recebe limite de escrita mais estreito e entra na fila para revisão — **não é
  bloqueio de publicação** (requisito 27e).
- Valores são configuração operacional, calibrada pela medição do Cloudflare/trusted proxy
  (T2.10). A medição **não bloqueia** schema nem handler; se falhar, corrige-se o ingress.

---

## 15. Rastreabilidade

| Fluxo | Requisito / decisão | Task |
|---|---|---|
| Leitura em árvore, cap, `more`, cursor | 8a, 8d; decisões 3, 8 | T2.3, T2.3b |
| Criação e resposta + recibos atômicos | 8, 12c; decisões 1, 24, 25, 29, 30 | T2.6c |
| Edição e auto-retirada | 12; decisões 17, 18, 20, 41, 46 | T2.7, T2.7b |
| Autorização do assunto | 6a; decisão 2 | T2.2 |
| Credencial, `realm`, escopo | Trust boundary | **T2.2a (feito)** |
| Política de link e imagem | 10a, 10b; decisões 26-29 | **T2.5b (feito)** |
| Voto e ranking | 8b, 8c, 8d; decisões 5-14, 19, 21 | T2.12-T2.16 |
| Denúncia, limiar, retirada | 12d, 12e; decisões 32-34, 37-39, 42, 49 | T2.17, T2.18, T2.21 |
| Caso, veredito, aprovação | 12f, 12g; decisões 40, 43, 45 | T2.19, T2.20, T2.22 |
| Resultado privado aos dois lados | 12f; decisão 44 | T2.23 |
| Recurso | 12g; decisão 47 | T2.24 |
| Sanção | 12i; decisão 48 | T2.25 |
| Invalidação de voto | 12j; decisão 14 | T2.26 |
| Exclusão de conta | 7b, 7c; decisão 53 | T2.15 |
| Rate limiting | 12b; decisões 50, 54 | T2.10 |

### Aceite de T2.2b

- [x] Nenhum "a definir" — todo fluxo tem método, path, escopo, corpo e códigos.
- [x] Cada fluxo aponta para requisito/decisão e task (§15).
- [x] Dois moderadores concorrentes têm `409` explícito (§6, §10).
- [x] Payload público não inclui identidade de denunciante/votante, fingerprint nem nota interna
      (§2, §9, §10, §12).
- [x] `DELETE /api/account` preservado com `204`, sem segunda rota de exclusão (§12).
- [x] Nenhum endpoint local divergente por app — tudo no namespace interno único.
