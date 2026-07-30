# Plano — 090

## Arquitetura da solução

`accounts.` deixa de ser só provedor de identidade e passa a ser **dono de comentários,
notificações e papéis**. Os módulos consomem por API; nenhum toca o banco do `accounts.`

```
apps/accounts (dono)
├── papéis globais      — admin | moderator | user
├── comentários         — subject_type + subject_id opacos, parent_id, autoria SSO
└── notificações        — agregadas de todos os módulos, com link de volta

packages/comments (cliente + UI)
├── client   — chamadas à API do accounts., cache, degradação
├── ui       — lista, formulário, thread, central de notificações
└── moderation — fila, ação em lote, restauração, histórico (requisito 27)
```

A superfície de moderação reusa `packages/ui/src/admin` (`AdminTable`,
`bulkActions`, `StatusPill`, `AdminWorkspaceLayout`) e o padrão de dados de
`useModerationQueue` do `downloads` — não introduz design system nem stack de
dados própria.

### Por que o `accounts.` e não um serviço novo

A identidade já vive lá, e os três módulos já o consultam. Um serviço novo exigiria subdomínio,
deploy e mais uma dependência para os mesmos três apps — sem ganho sobre usar quem já é
consultado por todos.

O custo é concentrar risco: `accounts.` passa a guardar **conteúdo de usuário**, não só
identidade. É o que torna o requisito 22 (degradação) inegociável.

### Referência opaca (requisito 5)

`accounts.` recebe `(realm, source_app, subject_type, subject_id)` e nunca consulta tabela de
domínio. Quem valida se o alvo existe e é comentável é o app. Isso é o que permite os três
consumirem o mesmo serviço sem o `accounts.` saber o que é um material de RPG.

**Referência opaca não substitui autorização por objeto** (1ª revisão do Codex, 2026-07-27). Se
a escrita vier do navegador, o atacante inventa dono, badge, destino e assunto inexistente —
o `accounts.` não tem como saber. **Decisão do mantenedor: a escrita é backend-to-backend.** O
backend do módulo valida existência, visibilidade, permissão e dono, e então chama o `accounts.`
com credencial própria por app. `owner_user_id`, papel e URL vindos do cliente nunca são
confiados; ownership é recalculado a cada request a partir de dado confiável.

Isso resolve também um bloqueio material: a allowlist CSRF do `accounts.` tem cinco origens
(`app.ts:87`) e **exclui `downloads` e todos os betas**, enquanto o CORS aceita qualquer
`*.artificiorpg.com` (`:97`). Escrita direta do frontend do `downloads` falharia hoje.
Server-to-server não passa por origem de navegador.

**`realm` separa beta de prod.** O manifesto declara o `accounts.` prod-only, mas beta o
reutiliza (linha 30 acima): sem `realm` na chave, comentário de teste em beta aparece em
produção, e o mesmo `subject_id` colide entre apps. Decisão do mantenedor: `realm` e
`source_app` em toda linha, nos índices e na chave de listagem, desde a primeira migration.

Para o link de volta (requisito 18), o app registra `source_app` + `canonical_path` — **nunca a
URL inteira**. A origem é resolvida no servidor por registro allowlisted; aceitar URL pronta do
cliente abriria phishing e open redirect.

### Papéis: global versus domínio (requisitos 1-4)

Distinção que decide o desenho:

| Tipo | Onde vive | Exemplos |
|---|---|---|
| **Global** | `accounts.` | `admin`, `moderator`, `user` |
| **Domínio** | app | criador de material, mestre de mesa, autor de post |

Só o global sai do app. `download_creator.role` hoje mistura os dois (`role: 'admin'` ali é
global); a separação manda o papel global para o `accounts.` e deixa o de criador onde está.

**`accounts.` é a origem do papel global, não o destino de uma migração** (decisão do mantenedor,
2026-07-30). A versão anterior deste plano previa consolidar no `accounts.` os papéis locais de
`downloads`/`glossario`/`mesas`, tratando o papel de app como autoridade a preservar. Invertido:
a conta central é definitiva e mandatória, e app nenhum alimenta papel global. `downloads` não foi
lançado e pode ser refeito — travar a arquitetura do SSO para preservar o papel local dele não se
justifica.

Isso elimina três coisas de uma vez: a rotina de migração (`roleMigration.ts`, removida em T1.5),
a classe de conflito que ela detectava (e-mail duplicado, vínculo quebrado — só nasce ao casar
papel de app com conta central) e o fallback para papel local (T1.6), que reintroduziria o app
como autoridade pela porta dos fundos.

O requisito 4 passa a ser cumprido por construção, não por conferência: o mantenedor é admin no
`accounts.` desde o boot, via `ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL` (T1.5a), e promove quem mais
precisar pelo painel de gestão (T1.5b), com tudo registrado em `global_role_audit`. O e-mail vive
no `.env` da VM, nunca literal em código ou SQL — o repositório é público desde 2026-06-14, e o
histórico do Git é permanente.

### Notificações (requisitos 13-19)

Modelo de evento, não de mensagem, separado em duas tabelas:

- `notification_event` guarda a ocorrência imutável, o assunto opaco, o ator e os dados de
  apresentação versionados;
- `notification_receipt` guarda destinatário e `read_at`, com unicidade por evento e usuário.

Um evento pode assim chegar a mais de um destinatário sem duplicar a ocorrência, e destinatário
repetido recebe um recibo só. O texto é montado na leitura, não gravado — isso permite mudar a
redação sem migrar dado, e localizar depois se necessário.

Regras de geração:
- comentário raiz → notifica publicador vinculado do conteúdo (requisito 15)
- resposta → notifica autor do pai e publicador vinculado (requisitos 14 e 15c)
- destinatários iguais geram um recibo; conta removida ou bloqueada não recebe
- ator nunca é notificado da própria ação (requisito 16)

O dono do conteúdo é informado pelo app ao comentar — o `accounts.` não sabe quem é dono de um
material.

### Degradação (requisito 22)

A trava mais importante do desenho. Hoje uma queda do `accounts.` impede login; depois desta
spec, também afeta comentários e notificações dos três módulos.

- Listagem de comentários indisponível → a página do módulo carrega, com aviso claro na área de
  comentários
- Central de notificações indisponível → o resto da navegação funciona
- Cache com TTL curto reduz a janela, no padrão que `catalogClient` já usa (60s)

Nunca propagar erro do `accounts.` como erro da página.

## Arquivos afetados (por módulo/pacote)

| Caminho | Natureza |
|---|---|
| `apps/accounts/**` | **dono** — papéis, comentários, notificações, API. Sagrado: aprovação + SDD Completo + smoke de todos os consumidores SSO |
| `apps/accounts/database/*.sql` | migrations de papel, comentário e notificação. **Não existe hoje:** o `accounts.` migra schema **inline no boot** (`src/db.ts:35`, chamado pelo `Dockerfile:26`), sem runner SQL ativo. Decisão do mantenedor (2026-07-27): adotar o framework padrão, com o `migrate()` atual virando baseline marcada como aplicada — T0.12 fecha ordem, coexistência e drift check antes da T1.1 |
| `apps/accounts/src/app.ts` | reler o usuário no banco em `/api/auth/refresh` (`:162`, hoje reassina do token — papel revogado sobrevive 7 dias renováveis); separar os rate limiters (`:79`, hoje 200 req/15 min para a aplicação inteira) |
| `apps/accounts/src/tokens.ts` | `verifyRefreshToken` (`:42-44`) rejeita qualquer papel fora de `user`/`admin` — sessão de moderator morreria no primeiro refresh |
| `packages/auth/src/{types,jwt,client}.ts` | **sagrado, aprovação nominal própria**: `UserRole` é `"user" \| "admin"` (`types.ts:1`); criar `moderator` toca o tipo, o decoder (`jwt.ts:4`) e o cliente (`client.ts:81`) |
| `packages/comments/**` | pacote novo — cliente e UI |
| `apps/downloads/backend/src/routes/comments.ts` | passa a delegar ao `accounts.` |
| `apps/downloads/backend/src/routes/notifications.ts` | idem |
| `apps/downloads/database/migration_*.sql` | **marca cutover e estado apenas — não transfere dado.** SQL do módulo não escreve no banco do `accounts.` (requisito 23). A transferência é export read-only aqui + importador one-shot do lado do `accounts.` |
| importador one-shot no `accounts.` | recebe o export do `downloads`, insere de forma idempotente (`unique (legacy_source, legacy_id)`), reconcilia |
| `apps/downloads/backend/src/services/notify.ts` | os 5 `kind` (`:10`) continuam emitidos localmente; migram como legado read-only com corpo congelado |
| `apps/downloads/backend/src/routes/{moderation,reports}.ts` | **bug real:** `emitNotification` em `try/catch` com só `console.error` (`moderation.ts:138-147`, `reports.ts:195`) — notificação some, autor não sabe |
| `apps/site/server/**` + `db/migrations/` | fachada Express same-origin + **export read-only** dos legados (quantidade medida, não "25"); a migration local **não escreve** no banco do `accounts.` |
| `apps/site/src/pages/blog/[slug].astro` | ilha React `client:visible` abaixo do artigo — o blog é SSG (`astro.config.mjs:7`), a página continua estática |
| `apps/site/package.json` | **[P1]** teste enumera 5 arquivos fixos (`:16`) e lint é `echo "TODO"` (`:15`) — teste novo não roda se o script não mudar |
| `apps/mesas/backend/src/routes/tables.ts` | **[P0] bug real:** detalhe público busca só por `slug` (`:476`), sem `status`/`archived_at` que a listagem filtra (`:345`) — mesa oculta acessível hoje |
| `apps/mesas/frontend/src/components/MarkdownEditor.tsx` + backend de `bio_long`/`closed_group_description` | **[P0] violação pétrea:** `markdown-it` com `html: true` sem sanitizar (`:15`, 6 telas) e backend persistindo HTML cru (`db/types.ts:104`, `:134`). Vem da spec 089 (requisito 27a), trazido para cá por ser a spec de sanitização |
| `apps/mesas/backend/src/routes/**` | rotas novas em `/api/v1/community/*` — `/api/v1/notifications` já existe (`server.ts:127`) e o frontend depende da URL (`NotificationBell.tsx:61`) |
| frontends dos três | consumir a UI do pacote |

**Não tocar:** o campo `comment` do review de mestre (`mesas/gm.ts:613`).

## Contratos/interfaces tocados

- **Auth/accounts:** tocado profundamente. Papel global, comentários e notificações passam a
  viver lá. **Exige aprovação + SDD Completo + smoke de todos os apps que consomem SSO**
  (`AGENTS.md`). Auth é sagrado: nunca quebrar a sessão compartilhada.
- **Schema:** migrations no `accounts.` (3 domínios novos) e nos apps (remoção/migração do que
  sai). O `site` usa framework próprio (`db/migrations/`, `NNN_*.sql`), não o runner do
  monorepo.
- **API:** rotas novas no `accounts.`; `downloads` mantém os paths atuais, delegando por trás.
  `pnpm verify:api` obrigatório.

## Impacto em consumidores

- **Todos os apps com SSO**, não só os três. Mudança no `accounts.` afeta quem consome sessão —
  o smoke precisa cobrir todos, não apenas os que ganharão comentários.
- **`downloads`** tem comentários e notificações em beta a migrar.
- **`site`** tem 25 comentários em beta e **provavelmente em produção** — o dado mais delicado.
- **`mesas`** não tem nada a preservar, mas ganha superfície pública nova.
- **Papéis:** todo app que hoje decide autorização por papel local precisa passar a ler do
  `accounts.` — mapear os consumidores antes de mudar.

## Rollback

- **Papéis:** sem leitura dupla e sem fallback local (decisão de 2026-07-30) — o papel global vem
  só do `accounts.`, e ausência significa `user`. O rollback não é o papel local: é o painel de
  gestão (T1.5b) mais o bootstrap (T1.5a), que restauram qualquer papel em segundos, com
  auditoria. Fallback para papel de app seria pior que o problema: um app desatualizado
  concederia privilégio que o central nega.
- **Comentários e notificações:** migração aditiva — copiar para o `accounts.` antes de parar
  de ler do app. `pg_dump` antes de cada migration.
- **Por app:** a adoção é independente; um app volta ao código anterior sem afetar os outros.
- **`accounts.`:** rollback de código é reversão de commit, mas dado migrado exige plano
  próprio. Nenhuma migration destrutiva sem dump verificado.

## Validação (como provo que funciona)

1. Testes do `accounts.`: papéis, threads, limite de profundidade, sanitização, geração de
   notificação, regra de não notificar o próprio ator.
2. Testes do pacote: cliente, cache, **degradação com o `accounts.` fora**.
3. Testes por app: rota responde, comentário persiste com autoria correta, legado legível.
4. **Smoke de SSO em todos os consumidores** — login, `/me`, logout. Obrigatório: o `accounts.`
   foi tocado.
5. Mapa de papéis antes-e-depois, provando o requisito 4.
6. `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test`, `rtk pnpm verify:api`.
7. Smoke em beta nos três módulos: comentar, responder, receber notificação **de outro
   módulo**, moderar.

O passo 7 é o que prova a agregação — a razão de ser desta spec. Comentar no `downloads` e ver
a notificação na mesma central que mostra evento do `site` é o critério que nenhum desenho com
banco por app conseguiria atender.

Teste verde sem smoke não fecha a spec: foi assim que a spec 088 fechou uma fase que não
funcionava.
