# Plano — 090

## Arquitetura da solução

`accounts.` deixa de ser só provedor de identidade e passa a ser **dono de comentários,
notificações e papéis**. Os módulos consomem por API; nenhum toca o banco do `accounts.`

```
apps/accounts (dono)
├── papéis globais      — admin | moderator | user
├── comentários         — árvore, versões Markdown, tombstone, autoria SSO
├── votos e ranking     — estado ternário, score/Wilson versionado por assunto
├── moderação           — denúncias, casos, recursos, sanções e auditoria
└── notificações        — evento/recibo transacional e link de volta

packages/comments (cliente + UI)
├── client   — adapter injetável das fachadas, estado em memória, degradação
├── ui       — árvore, editor, votos, sorts, denúncia, central de notificações
└── moderation — fila, ação em lote, restauração, histórico (requisito 27)
```

`@artificio/content-editor` continua dono do pipeline Markdown. A Fase 2 acrescenta nele um
perfil compartilhado de comentário; não cria parser/sanitizador/renderizador dentro de
`packages/comments` nem implementação por app.

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

**Sequência reconciliada da Fase 2:** o schema `notification_event`/
`notification_receipt` e a geração atômica dos eventos de criação/resposta entram junto do
comentário. A Fase 3 não recria tabela nem refaz essa transação: acrescenta API pública, central,
polling e eventos externos/outbox. Voto e edição não produzem notificação. Auto-hide,
remoção/restauração, decisão de denúncia e recurso usam o mesmo núcleo para avisos privados e
mínimos definidos na spec.

### Árvore, voto e ranking (requisitos 8-12)

- `comment` usa UUID v4, `parent_id`, `root_id`, `depth<=4`, `created_revision` e estado de
  visibilidade. `comment_versions` guarda cada `body_markdown` válido.
- Legado mantém identidade separada, score zero, sem edição/voto, mas pode ser pai de resposta
  nova; a árvore não cria seção paralela para ele.
- No volume normal, uma leitura monta a árvore inteira. O teto 1.000 comentários/2 MiB produz
  nós `more` por ramo, nunca lista plana nem filho órfão.
- Um registro por assunto mantém `ranking_revision`. Voto real serializa atualização curta,
  grava estado atual em `comment_vote` e abre nova faixa em `comment_score_version`.
- PostgreSQL calcula `score` como coluna gerada e `best_score` pela função imutável
  `comment_wilson_reddit_80_v1` em `numeric`. TypeScript orquestra; não duplica a fórmula.
- Cursor stateless assinado fixa assunto, sort, revisão, ramo, sort-key, limite e expiração de
  30 minutos. Posição permanece na revisão; contagens e `my_vote` podem ser atuais.
- Ordenação ocorre só entre irmãos: `best` (padrão/Wilson), `top`, `new`, `old`.
- Voto usa `PUT` de estado absoluto `-1|0|1`; mesmo valor é no-op e última transação vence. Autor
  não vota no próprio comentário; conta nova tem mesmo peso; voto nunca gera recibo.

### Edição, retirada e identidade

Autor altera somente `body_markdown`, sem prazo. Edição idêntica é no-op; edição real cria versão,
marca `edited_at` e preserva voto/ranking. Auto-retirada cria tombstone irreversível pelo autor;
moderador pode restaurar, mas nunca editar fala alheia. Público vê versão atual, marcador de edição
e placeholders; moderação vê histórico. Invalidação de votos por abuso recalcula os assuntos sob
nova `ranking_revision`, sem apagar o histórico bruto.

O schema separa `community_actor` da linha autenticável de `users`. Comentário, voto, denúncia,
versão e auditoria apontam para `community_actor.id`; uma relação restrita e eliminável liga o ator
ao `users.id` enquanto necessária. Assim, exclusão não quebra FKs nem apaga conversa/score:

- nome, e-mail, avatar, refresh/cookies e identidade pública são eliminados/revogados no pedido, e
  o ator público vira “Conta excluída”. Rotas comunitárias revalidam a conta e recusam access token
  antigo imediatamente; outros consumidores mantêm o SLA SSO existente de até 15 minutos, sem
  introspecção global nova;
- sem caso/recurso ativo, a ligação ator→conta é removida irreversivelmente no mesmo ciclo;
- com caso/recurso, a ligação recebe `retention_until = decisão final + 6 meses`; `legal_hold`
  auditado impede a limpeza até ser liberado;
- um executor idempotente remove ligações vencidas; leitura/moderação também trata ligação vencida
  como inexistente, fechando vazamento mesmo antes da próxima execução;
- um fingerprint com HMAC-SHA-256 do identificador Google, finalidade e versão de chave impede
  recadastro voluntário por seis meses. Ele não aparece em API/log. Sanção reutiliza o mecanismo
  enquanto durar; ao acabar a última finalidade, a linha é removida;
- reingresso depois dos seis meses cria novo ator. O voto antigo continua no score, mas não volta a
  ser nominalmente atribuível à nova conta — trade-off aceito ao rejeitar retenção permanente.

O segredo do HMAC é configuração do `accounts.`, nunca versionado; `key_version` permite rotação
sem misturar fingerprints. Rotação preserva versões ainda necessárias até seus bloqueios vencerem.
O aviso de privacidade e a confirmação de exclusão exibem controlador, contato, efeitos, prazos e
exceções antes da confirmação. Controlador declarado: Paulo Henrique Mota Lima, representando o
grupo Artifício RPG, pessoa física; contato `artificiorpg@gmail.com`; operação gratuita e dirigida
ao Brasil.

### Markdown e links de comentário

Na escrita, `accounts.` chama `sanitizeUserMarkdown`; o banco guarda `body_markdown` canônico.
Entrada original e saída canônica têm teto 10.000 e precisam produzir texto visível. Na leitura,
consumidores usam `MarkdownContent`/`renderMarkdown`; HTML bruto fica desabilitado e DOMPurify é
defesa final. HTML legado permanece em campo próprio, sanitizado uma vez na importação.

O perfil de comentário no `@artificio/content-editor` transforma imagem Markdown em link textual
HTTPS, sem `<img>` nem fetch. Link reconhecido é HTTPS-only; sem esquema canonicaliza;
`http:`/outro esquema/URL ambígua falha com `INVALID_COMMENT_LINK`. Host da suíte é comparado por
`URL`; externo abre com `ugc nofollow noopener noreferrer`; root-relative resolve contra origem
confiável do app. Cliente e backend usam a mesma política, mas backend continua autoridade.
`@texto` continua literal: sem handle público único, não existe resolução de menção nem destinatário
novo nesta fase.

### Denúncia, caso e sanção

`comment_reports` guarda evidência individual ligada à versão denunciada; `moderation_case` é a unidade
episódica de trabalho, com no máximo um caso aberto por comentário. Registro compartilhado define
motivos, prioridade e `details=required|optional|forbidden`; detalhe é texto puro imutável, até
4.000, restrito à moderação. A quinta conta distinta oculta temporariamente sob lock; edição ou
auto-retirada não apaga o caso/evidência.

Fechamento grava veredito por denúncia e uma ação por caso na mesma transação. Uma versão aprovada
fica imune a reabertura automática; edição gera versão nova. Recurso do autor referencia decisão e
versão, uma vez em seis meses; o mesmo moderador pode rejulgar com justificativa. Restrições
`posting`/`commenting` são comunitárias e auditadas, sem bloquear SSO. A ligação nominal temporária
segue o ciclo acima; conteúdo, ator opaco e histórico de score sobrevivem sem manter PII ou vínculo
identificável depois do prazo.

Transição terminal usa lock/condição no banco: um moderador vence, o segundo recebe conflito. Estado,
auditoria e notificações mínimas persistem na mesma transação; nunca `console.log` como trilha. Cada
denunciante recebe só o resultado próprio; autor recebe auto-hide e remoção/restauração, sem nota
interna nem identidade de terceiro.

### Antiabuso e rate limiting

A fachada conhece o IP real do usuário e aplica buckets separados por IP e usuário. O `accounts.`
recebe tráfego backend-to-backend e aplica por usuário e credencial do `source_app`. Leitura,
criação/resposta, edição, voto, denúncia e recurso não compartilham orçamento, e nenhum usa a cota
de autenticação. Todos os buckets aplicáveis precisam liberar; não há chave composta IP+usuário.
IP bruto não atravessa a API interna nem entra em tabela/auditoria comunitária; a fachada conserva a
chave somente durante o TTL do bucket. O contrato de ingress existente continua: medir o endereço
que atravessa Cloudflare/trusted proxy antes do uso integral e calibrar configuração. A medição não
trava schema nem handlers; falha interrompe somente a ativação do limiter por IP e vira correção do
ingress, sem alterar o modelo do `accounts.`. Conta nova pode agir com mesmo peso, mas entra na fila
e recebe limite de escrita mais estreito.

### Pré-lançamento e adequação de idade

A Fase 2 implementa integralmente schema, API, moderação e interfaces em pré-lançamento. Por decisão
do mantenedor em 2026-08-04, aferição de idade e adequação específica ao ECA Digital não entram no
desenho nem nos critérios de aceite desta fase; serão trabalho posterior antes do uso integral da
comunidade. Não adicionar data de nascimento, consentimento parental ou provedor de aferição ao
`accounts.` nesta fase — isso evitaria fingir uma solução jurídica parcial e retrabalho no SSO.

### Degradação (requisito 22)

A trava mais importante do desenho. Hoje uma queda do `accounts.` impede login; depois desta
spec, também afeta comentários e notificações dos três módulos.

- Listagem de comentários indisponível → a página do módulo carrega, com aviso claro na área de
  comentários
- Central de notificações indisponível → o resto da navegação funciona
- Enquanto a tela está montada, a última leitura bem-sucedida pode permanecer `stale`, com idade
  e aviso. Reload, nova página, logout e troca de conta descartam. Sem cache persistente, Redis ou
  edge nesta fase

Nunca propagar erro do `accounts.` como erro da página.

## Arquivos afetados (por módulo/pacote)

| Caminho | Natureza |
|---|---|
| `apps/accounts/**` | **dono** — papéis, comentários, notificações, API. Sagrado: aprovação + SDD Completo + smoke de todos os consumidores SSO |
| `apps/accounts/database/*.sql` | framework padrão já adotado na Fase 1; a Fase 2 acrescenta **duas** migrations: `006` coesa de comentário/versão, voto/ranking, evento/recibo, denúncia/caso, auditoria e restrição comunitária (Bloco A), e `007` do registro de credencial de serviço (Bloco B, T2.2a). São separadas porque entram em PRs distintas e a `007` é independente da `006` em produção — o critério de `AGENTS.md` §Migrations 2.1 é PR/reversibilidade, não "uma tabela por arquivo" |
| `apps/accounts/src/serviceCredential.ts` + `requireServiceCredential.ts` | T2.2a — resolução de credencial por `source_app`/`realm`/escopo, devolvendo **identidade** em vez de `boolean`. Substituiu o `SERVICE_SECRET` global, que vivia em `serviceToken.ts` — módulo **removido em 2026-08-07** (T2.2a-op, passo 6) junto com o fallback, quando ficou sem chamador. Operacional de emissão/rotação em `docs/agents/deploy-runbook.md` §Credenciais de serviço |
| `apps/accounts/src/scripts/serviceCredentialAdmin.ts` | T2.2a — emissão, listagem e revogação de credencial; janela de rotação `current`/`next` |
| `specs/090-packages-comments-compartilhado/contrato-http-v1.md` | T2.2b — contrato HTTP v1 fechado antes do primeiro handler. **Não é OpenAPI:** `docs/api/openapi/accounts.openapi.yaml` é gerado do código (`verify-api.ts:9` roda `api:generate-openapi` sobre o inventário de rotas), então editá-lo antes do handler seria sobrescrito. `verify:api` entra quando o handler entrar. **É a primeira fonte a consultar ao implementar qualquer rota do Bloco B** — método, path, escopo, query, shape de resposta, campos públicos e códigos de erro já estão fixados ali para as rotas de leitura, criação, voto, edição, denúncia, moderação e recurso. Task de implementação **não redecide contrato**; se parecer que falta definição, ler este arquivo antes de tratar como lacuna |
| `apps/accounts/src/app.ts` | reler o usuário no banco em `/api/auth/refresh` (`:162`, hoje reassina do token — papel revogado sobrevive 7 dias renováveis); separar os rate limiters (`:79`, hoje 200 req/15 min para a aplicação inteira) |
| `apps/accounts` — conta/privacidade | ator comunitário separado, exclusão de PII/sessões, vínculo temporário, fingerprint de recadastro/sanção, executor de expurgo e aviso ao titular |
| `apps/accounts/src/tokens.ts` | `verifyRefreshToken` (`:42-44`) rejeita qualquer papel fora de `user`/`admin` — sessão de moderator morreria no primeiro refresh |
| `packages/auth/src/{types,jwt,client}.ts` | **sagrado, aprovação nominal própria**: `UserRole` é `"user" \| "admin"` (`types.ts:1`); criar `moderator` toca o tipo, o decoder (`jwt.ts:4`) e o cliente (`client.ts:81`) |
| `packages/comments/**` | pacote novo — cliente e UI. **Criado em T2.2 (2026-08-05)** com o export `.` livre de React: `subjectAuthorization.ts` (contrato `CommentSubjectAuthorization` + schemas Zod) e `subjectAuthorizationConformance.ts` (suíte agnóstica de runner). Dual ESM/CJS no padrão de `catalog-client`, porque o primeiro consumidor é **backend**. **T2.3 (2026-08-07) acrescentou `treeCursor.ts`** (cursor stateless assinado HMAC-SHA256, TTL 30 min, relógio injetável; segredo **por parâmetro**, sem ler `process.env`) **e `treeAssembly.ts`** (corte pelo teto 1.000/2 MiB **por ramo de raiz**, que é o que sustenta "nunca filho órfão"). Ambos são **lógica pura, sem banco** — deliberado: é o que permite o aceite de 1.500 comentários rodar em teste sem PostgreSQL. A query e o handler ficam em `apps/accounts`, dono dos comentários nesta mesma tabela — **entregues no mesmo 2026-08-07** (`src/communityCommentRead.ts` + `src/communityCommentRoutes.ts`), o que fez o pacote virar **dependency de `apps/accounts`** e entrar no filtro explícito do `Dockerfile` (traz `zod` própria; caso E016/E017). `@artificio/comments/react` e `/styles.css` entram na Fase 4 |
| `packages/content-editor/**` | perfil compartilhado de comentário: Markdown canônico, links HTTPS-only e imagem como referência; mudança em pacote compartilhado exige aprovação e teste dos consumidores. **Implementado em T2.5b** como módulo próprio `src/commentLinks.ts` + subpath `@artificio/content-editor/comment-links` (ESM e CJS), **não** editando `sanitize.ts` — aquele arquivo tem ~50 consumidores sem relação com comentário, e `index.ts` importa CSS, que arrastaria React para o backend |
| `packages/*/tsconfig.build.json` | débito transversal corrigido junto de T2.5b: 10 pacotes emitiam `*.test.js` no `dist`, que vai inteiro para as imagens de `mesas`/`downloads`/`glossario`. Projeto de emit separado do de type-check — o `tsconfig.json` precisa **incluir** teste (ESLint type-aware), o build precisa **excluir** |
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
- **Schema:** uma migration coesa da Fase 2 cria comentário/versão, voto/ranking,
  evento/recibo, denúncia/caso, auditoria e restrições comunitárias. Tasks separam assuntos de
  revisão, não arquivos; o `AGENTS.md` proíbe fatiar schema interdependente no mesmo diff. O
  `site` usa framework próprio (`db/migrations/`, `NNN_*.sql`), não o runner do monorepo.
- **API:** rotas novas no `accounts.`; `downloads` mantém os paths atuais, delegando por trás.
  `pnpm verify:api` obrigatório.

## Impacto em consumidores

- **Todos os apps com SSO**, não só os três. Mudança no `accounts.` afeta quem consome sessão —
  o smoke precisa cobrir todos, não apenas os que ganharão comentários.
- **`downloads`** tinha zero comentários/notificações em beta e prod na medição de 2026-08-04;
  precisa remedição e guarda de conjunto vazio antes do cutover.
- **`site`** tinha 25 comentários em produção na medição de 2026-08-04; usa `N_source` recontado
  no import — o dado mais delicado.
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

1. Testes do `accounts.`: árvore até `depth=4`, cap/`more`, versões, tombstones, votos, função
   Wilson PostgreSQL, cursores por revisão, denúncia/caso sob concorrência, recurso, sanção e
   geração transacional de recibos; mais exclusão sem caso, retenção com caso/recurso, `legal_hold`,
   expurgo vencido, recadastro antes/depois de seis meses e sanção ativa.
2. Testes dos pacotes: Markdown/link/imagem, editor, quatro sorts, voto, denúncia, estado em
   memória e **degradação com o `accounts.` fora**.
3. Testes por app: rota responde, comentário persiste com autoria correta, legado legível.
4. **Smoke de SSO em todos os consumidores** — login, `/me`, logout. Obrigatório: o `accounts.`
   foi tocado.
5. Prova de que papel global nasce somente no `accounts.`, ausência vira `user` e nenhum app
   mantém fallback local, cumprindo o requisito 4.
6. `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test`, `rtk pnpm verify:api`.
7. Smoke em beta nos três módulos: comentar, responder, receber notificação **de outro
   módulo**, moderar.
8. Smoke do ingress: requisição controlada atravessa Cloudflare/trusted proxy, a fachada distingue
   IPs clientes e cabeçalho forjado não vence a cadeia confiável. Resultado calibra configuração;
   IP não aparece no payload interno nem no banco comunitário.

O passo 7 é o que prova a agregação — a razão de ser desta spec. Comentar no `downloads` e ver
a notificação na mesma central que mostra evento do `site` é o critério que nenhum desenho com
banco por app conseguiria atender.

Teste verde sem smoke não fecha a spec: foi assim que a spec 088 fechou uma fase que não
funcionava.
