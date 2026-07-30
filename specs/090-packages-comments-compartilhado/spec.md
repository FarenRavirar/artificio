# 090 — Comentários, notificações e papéis unificados no `accounts.` + ampliação do catálogo `downloads`

- **Módulo/Pacote:** `apps/accounts` (dono) + `packages/comments` (cliente/UI) + `apps/downloads`, `apps/site`, `apps/mesas`
- **Gate relacionado:** B (SSO) e D (bloqueia a entrega de comentários do downloads, hoje na spec 089)

> **Esta spec tem duas frentes independentes.** Requisitos **1-28** são a unificação de
> comentários/notificações/papéis no `accounts.` — bloqueados atrás de aprovação nominal e SDD
> Completo, porque tocam `accounts.` e `packages/auth`. Requisitos **29-32** são a ampliação do
> catálogo do `downloads` (parser, detector de idioma, facetas, ficha de material), acrescentados
> em 2026-07-28 por decisão do mantenedor; não tocam `accounts.`, `packages/auth` nem
> `packages/comments`, e podem ser executados sem a aprovação que trava a frente 1-28. **R32 é
> P0** — bug corrente que já contaminou o acervo de beta.

## Problema

Três projetos precisam de comentários; nenhum tem implementação reaproveitável, e o levantamento
de 2026-07-27 mostra três estágios diferentes do mesmo problema:

| Módulo | Comentários hoje | Autoria | Threads | Notificações |
|---|---|---|---|---|
| `downloads` | `download_comment` + `routes/comments.ts` | `user_id` do SSO, **sem nome nem avatar** | não | `download_notification`, com `material_id` — **acoplada ao domínio** |
| `site` | tabela `comments`, 25 registros reais | `author_name` **texto solto**, sem conta | sim (`parent_id`) | nenhuma |
| `mesas` | campo `comment` dentro de review de mestre (`gm.ts:613`) | vinculada ao review | não se aplica | `adminNotifications.ts` — só admin |

Construir isso três vezes multiplica o custo e garante divergência. Mas o problema é maior que
duplicação de código: **o usuário é um só e a experiência é fragmentada**. Ele comenta em três
lugares, tem papéis diferentes em cada um, e não existe lugar onde veja o que respondeu a ele.

### Duas coisas que só a agregação resolve

Um pacote compartilhado com banco por app uniria o **código**, não os **dados** — cada app
guardaria o seu, e continuariam impossíveis:

1. **Central de notificações.** "Alguém respondeu seu comentário" precisa chegar ao usuário
   independentemente de qual módulo gerou o evento. Com dados isolados, cada app teria a sua
   caixa, e o usuário teria três.
2. **Moderação unificada.** Ver e moderar tudo num lugar exige consulta cross-módulo, que o
   isolamento de dados impede por construção.

Decisão do mantenedor (2026-07-27): **`accounts.` passa a ser o dono** de comentários,
notificações e papéis. É onde a identidade já vive, e é o único ponto que todos os módulos já
consultam.

### Papéis: unificar de verdade

Hoje cada app tem seu modelo (`downloads` usa `download_creator.role`; `mesas` e `site` têm
outros). O mantenedor foi explícito: os papéis **vão ter a mesma função — e onde não têm,
passarão a ter**. Papel (admin, moderador, usuário) passa a viver no `accounts.` e valer em
todos os módulos.

Isso é o que torna a moderação unificada possível: sem papel global, "moderador" significaria
coisas diferentes em cada módulo, e não haveria como autorizar uma tela central.

## Requisitos (numerados, testáveis)

### Papéis no `accounts.` (base de tudo)

1. `accounts.` é a fonte de verdade de papel global: `admin`, `moderator`, `user`. **`moderator` não existe hoje** — `UserRole` é `"user" | "admin"` (`packages/auth/src/types.ts:1`), e o decoder, o cliente e `verifyRefreshToken` (`tokens.ts:44`) rejeitam qualquer outro valor. Criá-lo toca `packages/auth`, o que exige aprovação nominal própria além da do `accounts.`
1a. **O papel global é fonte de verdade material, não cache de 7 dias.** `/api/auth/refresh` (`app.ts:162`) hoje reassina os tokens a partir do token antigo, **sem reler o usuário no banco**; como o refresh dura 7 dias e é rotacionado a cada uso, um papel revogado sobrevive indefinidamente em sessão ativa. O refresh passa a reler o banco, com **SLA de revogação declarado**.
1b. **O `moderator` global tem matriz de capacidades declarada**, não só um nome. Decisão do mantenedor (2026-07-27): **herda os poderes que exerce hoje nos módulos** — no `downloads` isso inclui comentários, materiais, denúncias, métricas, mídia, e-mail e catálogo. A matriz declara, capacidade a capacidade, o que a herança significa em `site`, `mesas` e `glossario`, e o que permanece papel de domínio. Sem ela, promover alguém concederia poder administrativo em todos os projetos de uma vez, sem ninguém ter decidido isso.
2. Todo módulo obtém o papel do `accounts.`, sem manter cópia própria de papel global.
2a. **Falha do `accounts.` nunca promove ninguém.** A degradação do requisito 22 vale para leitura pública de comentário — a página fica de pé. Ação privilegiada com papel não comprovável **falha fechada** (deny-by-default). Erro e timeout não concedem acesso, e autorização privilegiada não usa cache antigo indefinidamente.
3. Papel de **domínio** continua no app (ex.: criador de material no `downloads`) — o que migra é o papel global, não o papel de negócio.
4. A migração preserva os papéis atuais: quem é admin ou moderador hoje continua sendo, sem intervenção manual. É **idempotente** e produz relatório determinístico com origem, conta no `accounts.`, papel anterior, papel final, conflito e motivo de cada caso não casado.
4a. **As chaves de identidade local divergem entre os apps** — a migração define a regra de casamento antes de unir. `downloads` usa o UUID do `accounts.`; `mesas` casa por `google_id` **ou** e-mail (`middleware/auth.ts:42`); `glossario` usa `sso_user_id` com fallback por e-mail (`resolveLocalUser.ts:44`). Regras necessárias: casamento, conflito, usuário sem vínculo e duplicata. Papéis de beta não são unidos à autoridade de prod sem decisão explícita.

### Comentários no `accounts.`

5. Comentário é armazenado no `accounts.`, com referência opaca ao alvo (`subject_type`, `subject_id`) — o `accounts.` não conhece "material", "post" nem "mesa".
5a. **`realm` e `source_app` entram na chave** (decisão do mantenedor, 2026-07-27). O manifesto declara o `accounts.` prod-only, mas beta o reutiliza (`plan.md:30`): sem separação, comentário de teste em beta aparece em produção e o mesmo `subject_id` colide entre apps. Os dois campos estão em toda linha, nos índices e na chave de listagem, desde a primeira migration.
5b. **A URL de volta é construída pelo servidor, nunca aceita inteira do cliente.** Guardar `source_app` + `canonical_path`; a origem vem de registro allowlisted. Receber a URL pronta abriria phishing e open redirect, e separar beta de prod sai de graça.
6. Comentar exige conta do SSO; não há fluxo anônimo de escrita.
6a. **A escrita é backend-to-backend** (decisão do mantenedor, 2026-07-27). O frontend nunca escreve direto no `accounts.`: o backend do módulo valida que o assunto existe, está visível, aceita comentário e quem é o dono, e só então chama com **credencial própria por app**. `owner_user_id`, papel e URL vindos do cliente nunca são confiados — referência opaca não substitui autorização por objeto (OWASP IDOR). Resolve junto um bloqueio real: a allowlist CSRF do `accounts.` tem cinco origens (`app.ts:87`) e exclui `downloads` e todos os betas, enquanto o CORS aceita qualquer subdomínio (`:97`) — escrita direta do navegador falharia hoje.
7. Comentário carrega identidade resolvida (nome, avatar) sem o app consumidor precisar de segunda chamada. Resolvida por `JOIN` no mesmo `SELECT` — comentários e usuários vivem no mesmo banco. Conta removida ou desativada cai em nome neutro e avatar nulo; e-mail nunca é exposto.
8. Comentário pode responder outro, com `parent_id` e limite explícito de profundidade aplicado na escrita. **Adjacency list, três níveis visíveis**: raiz `depth=0`, resposta `1`, resposta à resposta `2`; `depth>2` rejeitado. O volume não justifica closure table nem materialized path — CTE recursiva basta. A validação de que o pai existe, pertence ao mesmo `realm`/`source_app`/assunto, aceita resposta e não é legado acontece **na transação**.
9. Os 25 comentários legados do `site` são migrados em modo **read-only**: exibidos, distinguíveis, sem resposta nem edição. Com proveniência explícita (`user_id` nulo, `legacy_author_name`, `legacy_source`) e `unique (legacy_source, legacy_id)` para importação idempotente. `site.comments` tem `parent_id` **sem FK** (`apps/site/db/migrations/001_init.sql:66`) — pais órfãos e ciclos são detectados **antes** de copiar, não depois.
10. **Comentário novo é texto puro; HTML sanitizado existe só no legado** (decisão do mantenedor, 2026-07-27). O `downloads` já opera assim (`routes/comments.ts:11`) e o React escapa texto sozinho — HTML em comentário novo criaria superfície de XSS que hoje não existe. O `content_html` legado é sanitizado **uma vez, na entrada**, com política e versão registradas; a saída passa por defesa adicional **sem regravar o banco**. Nunca ressanitizar continuamente nem alterar o HTML depois de sanitizado, o que anularia a proteção. Campo nunca ambíguo: `body_text` para o novo, campo próprio para o legado.
11. Comentário exibe o papel do autor quando aplicável — autor do conteúdo, moderador, admin —, sem rotular usuário comum. O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada, nunca do payload público** — senão qualquer um se declara dono.
12. Retirada é ação de moderador/admin; sem autoexclusão livre nem edição pelo autor (D111 item 6). **Por tombstone, não por exclusão de linha**: apagar quebraria os filhos e perderia o contexto. A resposta pública devolve o estado removido e `removed_at`, sem o corpo; `removed_by` e `removed_reason` ficam para a moderação.
12a. **A API pública nasce paginada.** Cursor opaco, tamanho máximo e ordenação estável por `(created_at, id)`. Acrescentar paginação depois quebra contrato (AIP-158).
12b. **Os rate limiters do `accounts.` são separados por natureza** antes de comentários serem expostos. Hoje um único limiter cobre a aplicação inteira em 200 requests/15 min (`app.ts:79`): tráfego de leitura de três catálogos consumiria a cota de `/login`, `/me` e `/refresh`, derrubando o login. Limiters distintos para autenticação, leitura pública e escrita; escrita por usuário e IP; leitura com cache.
12c. **Comentário e evento de notificação nascem na mesma transação.** Dual write comum grava comentário sem notificação, ou notifica operação que foi revertida. Evento vindo de outro serviço, se houver, usa outbox transacional com consumidor idempotente.

### Notificações unificadas

13. Notificação é armazenada no `accounts.` e agrega eventos de **todos** os módulos.
13a. **Evento e recibo são tabelas separadas.** `notification_event` guarda a ocorrência imutável (`id`, `realm`, `source_app`, `type`, `version`, subject opaco, ator, `canonical_path`, dados, `occurred_at`); `notification_receipt` guarda o estado por usuário (destinatário, `read_at`). Juntar os dois impediria vários destinatários, deduplicação e canais futuros sem migrar o evento.
13b. **O evento carrega snapshot estruturado**, não mensagem pronta nem dependência do domínio vivo. Título editado, motivo alterado ou nome trocado **não podem** mudar o sentido de uma notificação histórica. Guardar os dados imutáveis necessários (ex.: `material_title`, `reason`, `actor_name_snapshot`) mais `event_version`. Só a string pronta impediria reformatar; só o domínio vivo faria o passado mudar.
13c. **Comentário, evento e recibo nascem na mesma transação.** Falha reverte o conjunto. Evento vindo de outro módulo usa `event_id` idempotente e outbox no produtor.
13d. **O evento não vaza conteúdo restrito:** título, motivo e link de conteúdo privado não são expostos a quem não tem acesso atual. O link leva ao módulo, e o módulo **revalida a autorização** — notificação não é passe de acesso.
14. Responder a um comentário notifica o autor do comentário pai.
15. **Notificação segue interação, não propriedade** (decisão do mantenedor, 2026-07-27 — modelo WordPress, Facebook e Twitter). Quem recebe é quem **participou da conversa**: quem publicou o conteúdo e quem comentou nela. Comentar num conteúdo notifica quem o publicou, **quando existe conta vinculada**; responder a um comentário notifica quem escreveu o pai. Quem nunca interagiu não recebe nada, e ninguém precisa "ser dono" de um objeto para acompanhar a própria conversa.
15a. **Conteúdo sem conta vinculada simplesmente não gera notificação de publicação** — não inventa destinatário. É o caso dos posts do blog: `site.posts` **não tem** `author_user_id` nem equivalente (`apps/site/db/migrations/001_init.sql:28`), e o `Post` exportado só carrega conteúdo e metadados (`src/lib/content.ts:17`). Comentar num post não notifica ninguém; **responder a um comentário continua notificando quem o escreveu**, que é o que preserva a conversa. Nenhum badge de autor em post. A limitação é registrada, não contornada com dono fictício, e nenhuma migration nova entra no `site` por causa disso.
15b. **No `mesas`, quem recebe é a conta publicadora** (decisão do mantenedor, 2026-07-27) — a única com vínculo real no `accounts.` `gm_id` pode ser nulo, mesa importada pode ser órfã, e `publisher_role`/`actual_gm_name` (`db/types.ts:227`) permitem que quem anuncia não seja o mestre real. Mestre nomeado apenas em texto, sem conta, não recebe nada — não há para onde notificar. Mesa órfã não gera notificação de publicação. Badge só quando há conta real por trás.
15c. **O conjunto de destinatários é definido, não implícito** — os requisitos 14 e 15 se sobrepõem numa resposta. Decisão do mantenedor (2026-07-27): comentário raiz notifica quem publicou o conteúdo (havendo conta); **resposta notifica quem escreveu o pai e quem publicou o conteúdo**; sendo a mesma conta, **um recibo só**; conta removida ou bloqueada não recebe.
16. O usuário não é notificado das próprias ações.
17. Existe **uma** central de notificações, acessível de qualquer módulo, mostrando eventos de todos.
17a. **A central é canônica no `accounts.`**, em `/conta/notificacoes` (decisão do mantenedor, 2026-07-27) — os módulos apontam para ela, sem cópia própria, para não haver três páginas divergindo. O frontend do `accounts.` hoje só trata `/`, `/login` e `/conta` (`main.tsx:294`). Sino global no `Header` seria `packages/ui` e exige aprovação nominal própria.
17b. **Atualização por polling curto ao focar a página**, mais invalidação após mutação. SSE e WebSocket ficam fora: ampliariam infraestrutura sem requisito que peça tempo real.
18. Notificação carrega link de volta ao contexto de origem, no módulo correto — construído a partir de `canonical_path` e de `realm`+`source_app` allowlisted, **nunca de URL inteira vinda do cliente** (requisito 5b).
19. Notificação tem estado de leitura, e marcar como lida vale em todos os módulos.
19a. **A API de notificação nasce completa:** lista paginada por cursor com ordem `(occurred_at, id)` e limite máximo; contagem de não lidas; marcar uma como lida; marcar todas até um instante; mutações idempotentes; ownership sempre extraído da sessão; **404 uniforme** para ID inexistente ou de outro usuário (senão a resposta revela que a notificação existe); cache privado, nunca compartilhado.
20. **Canal: in-app apenas.** E-mail e push ficam fora desta spec (decisão do mantenedor). A separação evento/recibo (13a) é o que permite ligar um canal depois sem migrar dado.

### Contrato e consumo

21. `packages/comments` fornece cliente e UI; a persistência é do `accounts.`, não do pacote.
21a. **O transporte é injetado, não embutido.** O pacote recebe um adapter (`listComments`, `createComment`, `reply`, `remove`, `listNotifications`, `markRead`) implementado pela fachada do módulo — chamada direta do navegador ao `accounts.` contradiria o requisito 6a e furaria a validação de assunto e ownership.
21b. **Exports separados:** `@artificio/comments` (tipos, schemas, cliente), `@artificio/comments/react` (hooks e componentes), `@artificio/comments/styles.css`. Backend e o Astro server-side do `site` não podem ser obrigados a importar React. `react` e `react-dom` são `peerDependencies`.
21c. **TanStack Query não é obrigatório.** `downloads` e `mesas` o usam, o **`site` não** — o núcleo do cliente é agnóstico de framework, com adapter de React Query interno e opcional.
21d. **Estilo por tokens, não por Tailwind compilado dentro do pacote.** O consumidor pode não escanear as classes do workspace, e elas sumiriam em produção. Tokens CSS do design system, slots e `className`; apps customizam tokens, não a estrutura semântica.
22. Indisponibilidade do `accounts.` **degrada** a experiência, nunca derruba a página do módulo consumidor.
22a. **A resposta carrega estado explícito — `fresh`, `stale` ou `unavailable`.** Falha **nunca** vira "nenhum comentário": exibir erro como lista vazia mente para o usuário. Havendo dado stale, mostrar a idade. Cache com TTL em memória não prova degradação — some ao recarregar a página.
22b. **A chave de cache inclui identidade quando o dado é privado** (`realm`, `source_app`, subject, usuário). Comentário privado e notificação são limpos no logout e na troca de conta; notificação nunca entra em cache público.
22c. **Cliente com timeout e cancelamento**, no padrão já aprendido em `packages/catalog-client/src/index.ts:35` — `fetch` sem timeout pendura a rota do backend consumidor (achado de review, PR #145). Hooks consomem `AbortSignal`.
22d. **Degradação vale para resposta inválida, não só conexão recusada:** timeout, 500, HTML no lugar de JSON, JSON malformado e schema incompatível. O último é a regra pétrea de normalização — payload externo é `unknown` até passar por normalizador tipado.
23. Nenhum app acessa diretamente o banco do `accounts.` — só a API. **Isso inclui migração:** SQL do módulo não transfere dado para o banco central. A transferência é por export read-only na origem mais importador one-shot **pertencente ao `accounts.`**; a migration local só marca cutover e estado.
24. `downloads` migra `download_comment` e `download_notification` para o `accounts.`, preservando os dados.
24a. **O rollout é expand → backfill → catch-up → cutover**, com high-water mark, inserts idempotentes e reconciliação. "Copiar antes de parar de ler" perde tudo o que nascer entre a cópia e a troca. A tabela local vira read-only e é retida para rollback — apagá-la é ação posterior, nominal e com backup.
24b. **A validação é linha a linha, com critério declarado:** quantidade, IDs, hash dos campos normalizados, `created_at`, autoria, estado removido e lido, relações `parent`, e lista explícita de divergências.
24c. **A fachada preserva payload e status, não só os paths** — e os contract tests do comportamento antigo são escritos **antes** da troca, porque hoje não existe teste direto de `comments.ts` nem de `notifications.ts`, e `verify:api` não prova compatibilidade semântica.
24d. **Dois bugs do `downloads` são corrigidos junto** (decisão do mantenedor, 2026-07-27): `GET /api/v1/notifications` usa `writeRateLimiter` (`routes/notifications.ts:12`), fazendo leitura consumir cota de escrita; e a emissão de notificação é best-effort (`moderation.ts:138-147`, `reports.ts:195` — `try/catch` com `console.error`), então material é rejeitado e o autor nunca fica sabendo. A migração corrige a semântica em vez de reproduzi-la.
24e. **Os cinco `kind` que o `downloads` já emite** — `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed`, `system_suggestion_resolved` (`services/notify.ts:10`) — entram como **legado read-only com o corpo congelado**, sem virar `kind` oficial do registro central. O `downloads` continua emitindo esses eventos na própria tabela; só comentário migra para o registro novo.
25. `site` adota o pacote, com os legados migrados e legíveis. **A quantidade é medida por `realm` e ambiente no momento da migração** — "25" veio de uma contagem em beta e não serve como critério fixo.
25a. **A arquitetura de runtime do `site` é declarada, não deixada para a implementação.** O blog é SSG (`astro.config.mjs:7`), com os posts gerados por `getStaticPaths` (`pages/blog/[slug].astro:7`). Comentário entra como **ilha React `client:visible` abaixo do artigo**, servida por fachada Express same-origin que valida post publicado; `subject_id = String(post.id)`, `canonical_path = /blog/${slug}/`. A página estática continua estática.
26. `mesas` ganha comentários — feature nova, separada do campo `comment` do review de mestre, que **não** é migrado (contrato próprio confirmado em `routes/gm.ts:606`).
26a. **O ciclo de vida da mesa define o que é comentável**, revalidado a cada criação e a cada resposta: ativa, pública e não expirada aceita leitura e escrita; encerrada ou arquivada preserva a leitura e bloqueia escrita nova; rascunho ou oculta não tem leitura pública nem escrita; removida devolve alvo inexistente.
26aa. **[P0] Pré-requisito de segurança — o `mesas` sanitiza rich text na escrita.** Violação corrente da regra pétrea: o preview renderiza `markdown-it` com `html: true` sem sanitizar (`frontend/src/components/MarkdownEditor.tsx:15`, em 6 telas) e o backend persiste `bio_long` (`db/types.ts:104`) e `closed_group_description` (`:134`) sem passar por sanitizador. **Não é XSS ativo hoje** — nenhuma tela pública renderiza esses campos como HTML, e o único `dangerouslySetInnerHTML` do frontend (`RichTextArea.tsx:153`) não tem consumidor —, mas o HTML cru **já está no banco**: qualquer superfície nova que renderize conteúdo rico, inclusive a UI de comentários desta spec, ativa o payload que já foi persistido. Achado na revisão da spec 089 (2026-07-27) e trazido para cá por decisão do mantenedor no mesmo dia, porque esta é a spec de conteúdo de usuário e sanitização (requisito 10). A 089 registra a dependência no requisito 27a.
26b. **[P0] Pré-requisito de segurança:** hoje o detalhe público de mesa busca **apenas por `slug`** (`routes/tables.ts:476`), sem `status` nem `archived_at`, enquanto a listagem filtra os dois (`:345`) — mesa em rascunho ou arquivada é acessível por quem souber o slug. Reusar essa validação para decidir o que é comentável tornaria alvo oculto comentável. A correção é pré-requisito da adoção, com task e evidência próprias.
26c. **O identificador enviado ao registro central é o `google_id`, nunca o UUID local.** `gm_user_id` é `mesas.users.id` (`routes/tables.ts:470`); o ID do `accounts.` vive em `users.google_id` (`db/types.ts:14`), e o middleware converte a sessão central em usuário local (`middleware/auth.ts:37`). Confundir os dois associaria comentário à conta errada.
26d. **Rotas novas em namespace próprio (`/api/v1/community/*`).** O `mesas` já expõe `/api/v1/notifications` (`server.ts:127`), e o frontend depende dessa URL exata (`components/NotificationBell.tsx:61`) — substituir o contrato quebraria as notificações administrativas existentes. Fusão de feeds só com contrato explícito.
27. **A validação da mudança central não passa por deploy de beta do `accounts.`, que não existe.** O módulo é PROD-ONLY (`env_override: "prod"`) e o workflow bloqueia `env=beta` (`.github/deploy-manifest.json:147`); beta reusa o `accounts.` de produção. O caminho é: mudança **aditiva, compatível e inicialmente desabilitada**; ativação limitada a `realm=beta` com credenciais allowlisted; comparação de erro, latência e autenticação contra controle; habilitação produtiva em passo separado. População, duração, métricas e rollback definidos antes de ligar.
28. **O rollback preserva dado.** Desligar feature e credenciais dos módulos, manter o schema aditivo e o que já foi escrito, restaurar os consumidores anteriores, e comprovar que a autenticação central segue saudável. Apagar tabela não é rollback.

## Contratos fechados na Fase 0

Esta seção materializa T0.1–T0.13. Checkbox aberto antes desta redação significava contrato
ainda não escrito; não significava decisão pendente do mantenedor.

### Matriz de capacidades do papel global

`admin` continua superusuário global. `moderator` recebe exatamente as capacidades abaixo;
capacidade de um domínio não se propaga por semelhança de nome para outro projeto. Papéis de
domínio (`creator`, `gm`, `player`, `member`, autor/publicador) continuam locais e nunca são
promovidos implicitamente a papel global.

| Capacidade | `admin` | `moderator` | `user` / papel local | `downloads` | `site` | `mesas` | `glossario` |
|---|---|---|---|---|---|---|---|
| retirar comentário público | sim | sim | não; autor não autoexclui | herdada | herdada na adoção | herdada na adoção | herdada para comentário público |
| moderar material | sim | sim | criador só gerencia o próprio material | herdada | não se aplica | não se aplica | não se aplica |
| tratar denúncia | sim | sim | pode denunciar | herdada | não herda administração editorial | não herda administração de mesa | não herda administração de feedback |
| ler métricas de moderação | sim | sim | não | herdada | não | não | não |
| operar mídia | sim | sim | criador só opera mídia própria | herdada | não | não | não |
| consultar/reprocessar e-mail operacional | sim | sim | não | herdada | não | não | não |
| operar catálogo já liberado ao moderador | sim | sim | não | herdada | não | não | não |
| ingest, scraper, taxonomia estrutural e automações | sim | não | não | permanece `admin` | permanece `admin` | permanece `admin` | permanece `admin` |
| gerir usuários, segredos, configurações e auditoria global | sim | não | não | permanece `admin` | permanece `admin` | permanece `admin` | permanece `admin` |

No `downloads`, a herança corresponde ao código atual: `admin.ts`, `moderation.ts`,
`reports.ts`, `rejectionCategories.ts`, `emailLog.ts`, `materialCover.ts`,
`materialMetadata.ts` e os guards de `materials.ts` aceitam `moderator`; `scraper.ts`,
`materialTypeSuggestionsAdmin.ts` e `systemSuggestionsAdmin.ts` continuam exclusivos de
`admin`. Nos outros projetos, o único poder novo desta spec é moderação de comentário. Nenhum
poder editorial, de catálogo, mesa, termo, usuário ou configuração nasce por analogia.

### Inventário de consumidores de papel

- `downloads`: resolução local em `backend/src/middleware/auth.ts`; autorização em
  `routes/admin.ts`, `emailLog.ts`, `materialCover.ts`, `materialMetadata.ts`, `materials.ts`,
  `moderation.ts`, `rejectionCategories.ts`, `reports.ts`, `scraper.ts`,
  `materialTypeSuggestionsAdmin.ts` e `systemSuggestionsAdmin.ts`.
- `mesas`: resolução local em `backend/src/middleware/auth.ts`; guards administrativos em
  `activityLog.ts`, `adminProfile.ts`, `adminSettingSuggestions.ts`,
  `adminSystemProjection.ts`, `adminTables.ts`, `communicationPlatforms.ts`,
  `devFeedbackAdmin.ts`, `gm.ts`, `scenarios.ts`, `systems.ts`,
  `scenarioSuggestionsAdmin.ts`, `systemSuggestionsAdmin.ts`, `vttPlatforms.ts`,
  `routes/inbox/{drafts,import}.ts` e nas rotas `discord/{automation,chatExporterAutomation,
  corrections,discovery,drafts,duplicates,fetch,import,messageParse,messages,metrics,
  parse-batch,preview,settings,sources,sync,utils}.ts`.
- `glossario`: vínculo e resolução em `auth/resolveLocalUser.ts`,
  `middlewares/authMiddleware.ts` e `refreshUserRole.ts`; autorização em
  `adminActivityRoutes.ts`, `categoryRoutes.ts`, `exportRoutes.ts`,
  `feedbackAdminRoutes.ts`, `scenarioRoutes.ts`, `systemRoutes.ts`, `termRoutes.ts`,
  `userRoutes.ts` e nos controllers que escolhem estado por papel.
- `site`: não mantém papel global local. `server/admin-api.ts`, `catalog-api.ts` e
  `catalog-material-types-admin-api.ts` consomem a sessão SSO; `site-admin` é superfície do
  mesmo backend, não autoridade separada.
- `links`: não mantém papel local; painel e sugestões usam diretamente a sessão SSO.

Consumidores fechados para o smoke de SSO: `accounts`, `links`, `site` (incluindo
`site-admin`), `glossario`, `mesas` e `downloads`. Não há outro app executável em `apps/`.

### Casamento de identidade e migração de papéis

1. `downloads`: `download_creator.user_id` casa somente com `accounts.users.id` exato.
2. `mesas`: primeiro `users.google_id = accounts.users.id`; fallback por e-mail normalizado
   somente quando `google_id` é nulo ou já igual ao mesmo ID central.
3. `glossario`: primeiro `users.sso_user_id = accounts.users.id`; fallback por e-mail
   normalizado somente quando `sso_user_id` é nulo ou já igual ao mesmo ID central.
4. Dois critérios apontando para contas centrais diferentes, e-mail duplicado, vínculo local
   ocupado por outro ID ou mais de uma linha candidata são `conflict`: nenhuma promoção ocorre.
5. Usuário local sem conta central é `unmatched`: permanece no papel local durante leitura
   dupla e não cria conta central artificial.
6. Múltiplas origens válidas para a mesma conta são reduzidas por `admin > moderator > user`,
   preservando acesso; cada origem e a redução aparecem no relatório.
7. Papel de beta nunca promove autoridade de prod. Linhas beta entram no relatório, mas são
   `excluded_realm` até autorização nominal própria.

O relatório é determinístico e ordenado por `(origin, local_user_id)`, com: origem, realm,
identidade local, conta central, papel anterior, papel final, conflito e motivo. Segunda execução
produz o mesmo relatório e nenhuma escrita adicional.

### Trust boundary e credenciais

Cada backend consumidor recebe token próprio, aleatório de no mínimo 256 bits, por secret do
GitHub e `.env` da VM; nunca por arquivo versionado. `accounts.` mantém registro allowlisted
`token -> source_app + realms + operações`, compara em tempo constante e rejeita token ausente,
desconhecido, fora do realm ou tentando afirmar outro `source_app`. Rotação usa janela curta
`current` + `next`: publica `next` no `accounts.`, troca consumidor, confirma tráfego, revoga
`current`. Logs guardam só identificador da credencial, nunca o segredo.

Frontend fala somente com fachada same-origin. Backend valida sessão, existência, visibilidade,
estado comentável e ownership do objeto; então chama `accounts.` com `X-Service-Token`,
`X-Acting-User-Id`, correlation ID e chave de idempotência. `accounts.` nunca aceita do browser
`owner_user_id`, papel, origem completa ou autorização por objeto. Escrita direta sem credencial
de serviço retorna 401; escopo incompatível retorna 403.

### Referência opaca, URL e corpo

- Chave: `(realm, source_app, subject_type, subject_id)`, com `realm in ('beta','prod')`,
  `source_app in ('downloads','site','mesas')`, `subject_type` namespaced e `subject_id` textual.
- Limites: `source_app` 32, `subject_type` 64, `subject_id` 255, `canonical_path` 1024,
  `body_text` 2.000, `removed_reason` 500 e chave de idempotência 8–128 caracteres ASCII.
- `canonical_path` começa por `/`, não contém scheme, host, barra invertida nem credencial. A
  origem é resolvida no servidor por `(realm, source_app)` allowlisted.
- Comentário novo usa `body_text` texto puro, após trim, entre 1 e 2.000 caracteres. HTML novo
  é rejeitado como tipo de campo, não interpretado. Legado usa `legacy_content_html` separado,
  política de sanitização versionada e defesa adicional na saída sem regravar.
- Raiz tem `depth=0`; respostas têm `1` ou `2`. Pai, assunto, realm, app, estado e legado são
  validados na mesma transação. `depth>2` retorna 422.
- Alvo removido bloqueia escrita na fachada e preserva leitura autorizada. Mudança de slug não
  altera identidade: backend envia caminho atual nas novas operações e mantém redirect do
  caminho anterior. Eventos históricos permanecem imutáveis.
- Comentário e tombstone são retidos sem prazo nesta spec. Exclusão física exige decisão,
  migration e backup próprios.

### Contrato HTTP v1

Rotas internas exigem credencial por app; rotas da central exigem sessão SSO. Fachadas dos
módulos preservam seus contratos públicos atuais.

| Método e rota | Contrato |
|---|---|
| `GET /internal/v1/comments` | lista por chave opaca; cursor; `limit` padrão 20, máximo 100 |
| `POST /internal/v1/comments` | cria raiz; exige `Idempotency-Key`; ator vem do backend |
| `POST /internal/v1/comments/:id/replies` | cria resposta na mesma transação do evento e recibos |
| `POST /internal/v1/comments/:id/removal` | tombstone; exige `admin`/`moderator` central comprovado |
| `GET /api/v1/notifications` | lista recibos do usuário da sessão; cursor; padrão 20, máximo 100 |
| `GET /api/v1/notifications/unread-count` | contagem da sessão |
| `PUT /api/v1/notifications/:id/read` | idempotente; 404 uniforme para ID alheio/inexistente |
| `PUT /api/v1/notifications/read-through` | marca todas até `occurred_at` fornecido |
| `POST /internal/v1/comments/:id/restore` | desfaz tombstone; exige `admin`/`moderator`; registra quem restaurou |
| `GET /internal/v1/comments/moderation-queue` | fila de moderação; filtro por `realm`, `source_app`, estado; cursor |
| `GET /internal/v1/comments/moderation-log` | histórico de ações de moderação; cursor |

### 27. Superfície de moderação no front (requisito novo, 2026-07-30)

**Decisão do mantenedor:** o desenho até aqui detalhou schema, transação e API,
mas deixou o front com duas linhas (`ui — lista, formulário, thread, central de
notificações`). Isso cobre quem **lê e escreve** comentário. Não cobre quem
**modera** — `POST /internal/v1/comments/:id/removal` existia sem nenhuma tela
que o chamasse: o moderador teria o poder e nenhuma superfície.

27a. **Fila de moderação, não caça ao comentário.** Moderar navegando pelo
conteúdo público não escala e depende de o moderador topar com o problema. A
fila é a superfície primária: comentários denunciados, de conta nova (27e) e
recém-criados, com filtro por `realm` e `source_app` — beta nunca aparece
misturado com produção.

27b. **Reusar `packages/ui/src/admin`, não criar padrão novo.** Já existem
`AdminTable` (14 KB, com seleção e ações em lote), `bulkActions`, `StatusPill`,
`PageHeader`, `SectionCard` e `AdminWorkspaceLayout`, usados hoje pelo painel de
gestão do `downloads`. A fila de comentários é mais uma consumidora desses
componentes. Divergir do design system exige aprovação (regra de produto).

27c. **Seguir o padrão de dados de `useModerationQueue`** (`apps/downloads/
frontend/src/hooks/useModerationQueue.ts`): React Query + validação Zod na
fronteira, ação individual e em lote, `invalidateQueries` no sucesso. O padrão
está maduro no `downloads` (specs 075 e 083) — replicar, não reinventar.

27d. **Ação de moderação é reversível e auditada.** Duas lacunas do desenho
anterior, ambas fechadas aqui:

- **Restauração:** o tombstone preserva o corpo (requisito 12), então desfazer é
  barato — faltava só o caminho. Erro de moderação sem reversão é permanente,
  e a **DSA** exige janela de contestação de seis meses com reversão pronta de
  decisão injustificada. `POST /internal/v1/comments/:id/restore` limpa
  `removed_at`/`removed_by`/`removed_reason` e registra a restauração.
- **Registro de ação:** existe `global_role_audit` para mudança de papel
  (`migration_002`), mas nada equivalente para conteúdo. Toda remoção e
  restauração grava quem agiu, sobre o quê, por quê e quando — mesmo padrão já
  aplicado a papéis.

27e. **Conta nova é tratada como conta nova.** Hoje todo usuário autenticado é
igual: conta criada há dez segundos comenta como quem está há dois anos. Com
login Google (barreira baixa — qualquer um cria conta), isso é a porta de
entrada de spam. O [Discourse](https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/)
trata como estrutural: nível de confiança inicial restrito, que sobe com
participação real.

Adotar a forma **mínima**, derivada de dado que já existe (`users.created_at` +
contagem de comentários do autor), **sem tabela nova**: conta nova entra na fila
para revisão e tem limite de escrita mais apertado no rate limiter de escrita
(requisito 12b). Não é bloqueio de publicação — é priorização de revisão.

27f. **Fora de escopo, decisão do mantenedor:** shadow ban (esconder conteúdo
sem avisar o autor contradiz o compromisso de transparência da plataforma e
quebra a confiança quando descoberto) e moderação automática por IA (custo e
taxa de falso positivo desproporcionais ao volume atual). Se o volume mudar,
volta como spec própria.

27g. **Usabilidade da fila** — as 10 Heurísticas de Nielsen valem aqui como em
qualquer interface do produto. Em especial: estado do sistema visível (quantos
pendentes, o que já foi tratado), prevenção de erro (confirmação em ação
destrutiva ou em lote, via `ConfirmDialog` de `packages/ui`), e reversibilidade
como saída de emergência (27d). Ação em lote sem confirmação sobre conteúdo de
usuário é exatamente o caso que a heurística 5 existe para impedir.

Comentários ordenam por `(created_at, id)` ascendente; notificações, descendente. Cursor é opaco,
assinado e contém os dois campos da ordenação; cursor de outra consulta retorna 400. Escritas
exigem `Idempotency-Key`; repetição com mesmo payload devolve a resposta original, payload
diferente retorna 409, retenção da chave é 24 horas.

Códigos: 400 contrato/cursor, 401 sessão ou serviço ausente, 403 escopo/papel, 404 alvo ou recibo
inexistente (uniforme), 409 idempotência ou estado concorrente, 422 thread/corpo, 429 limite e
503 dependência indisponível. Respostas usam `{ error: { code, correlation_id } }`, sem detalhe
de existência ou autorização.

Cache: notificações e escritas são `private, no-store`; leitura interna de comentários admite
ETag e cache privado de 30 segundos na fachada. Cache stale persistente da fachada inclui realm,
app, assunto e identidade quando privada; logout/troca de conta limpa dado privado. Estado de
resposta é `fresh`, `stale` com idade, ou `unavailable`, nunca lista vazia inventada.

Rate limiting separado: autenticação mantém 200 requests/15 min/IP; leitura de comentários,
300/min/IP; escrita, 20/15 min/usuário e 60/15 min/IP; API interna, 300/min/credencial;
notificações, 120/min/usuário. Limite excedido nunca consome cota de autenticação.

### Evento e recibo

`notification_event` é imutável e guarda `event_id`, realm, app, `type='comment.created'`,
`version=1`, assunto opaco, ator, caminho canônico, snapshot estruturado e `occurred_at`.
`notification_receipt` guarda `(event_id, recipient_user_id, read_at)`, único por evento e
destinatário. Texto é montado na leitura.

Comentário raiz gera recibo para publicador vinculado. Resposta gera para autor do pai e
publicador vinculado. Destinatários iguais deduplicam; ator, conta removida, bloqueada ou
inexistente são excluídos. Comentário, evento e todos os recibos usam uma transação. Evento
externo futuro exige outbox no produtor, `event_id` idempotente e consumidor idempotente.

### Baseline e ordem de migrations do `accounts.`

`migration_001_accounts_baseline.sql` reproduz idempotentemente extensão, `users` e
`admin_secrets` do antigo `migrate()`. Em banco existente, o runner executa os `IF NOT EXISTS`,
confirma o schema e grava a baseline em `schema_migrations`; em banco vazio, cria o mesmo schema
e grava a mesma linha. Depois dela, nenhuma migration inline roda no boot.

Ordem: runner compartilhado antes de subir o container, ordem lexical, lock e transação do
framework; baseline 001; papel global 002; demais migrations da spec depois. O
`Dockerfile` deixa de executar `dist/migrate.js`, e `migrate()`/`migrate.ts` deixam de ser fonte
de schema. O diretório canônico é `apps/accounts/database/`.

Os gates existentes já cobrem o módulo sem alteração de lógica: `.github/migration-dir-allowlist`
aceita `apps/*/database/`; `_deploy-module.yml` aplica `apps/${MODULE}/database` e executa drift
pós-deploy; headers e idempotência passam pelo guard compartilhado. O registro do manifesto que
ainda chama migrations de `accounts` de no-op deve ser atualizado junto da adoção para não
documentar estado falso.

### SLA de mudança de papel

`/api/auth/refresh` relê `users` por `sub` antes de emitir qualquer token novo. Promoção ou
revogação aparece imediatamente no próximo refresh. O access token já emitido continua válido
por no máximo 15 minutos; portanto o SLA de autorização é **15 minutos no pior caso** e imediato
após refresh. `role_version` cresce a cada alteração e viaja nos tokens para auditoria e futura
invalidação antecipada; esta fase não adiciona consulta ao banco em toda request, evitando tornar
cada rota de todos os projetos dependente de round-trip central.

### Catálogo do `downloads` — ampliação de 2026-07-28

Bloco acrescentado por decisão do mantenedor (2026-07-28), durante a Fase 5 da spec 089. Os
quatro requisitos abaixo tocam **`apps/downloads`** (parser, detector de idioma, facetas e
ficha de material) e **não dependem** do `accounts.`, de `packages/comments` nem de
`packages/auth`. Numeração continua a da spec para não renumerar 1-28.

> **Dependência de sequência:** R32 é P0 e corrige um furo do D119 que já contaminou o acervo
> de beta. Enquanto ele não fechar, qualquer medição de taxa de rejeição por idioma (incluindo
> T5.6 da spec 089) mede um acervo com material inglês aprovado como português — o número sai,
> mas não prova o que promete. O mantenedor optou (2026-07-28) por manter a correção aqui e
> registrar a contaminação como ressalva do gate da 089, em vez de corrigir dentro dela.

29. **Autoria é buscável, não facetada.** `authors` sai do conjunto de facetas de seleção do
    catálogo e passa a ser alcançável por busca textual. Motivo medido no acervo recoletado de
    beta (2026-07-28): 80 materiais `opera_rpg`, dos quais 61 com autoria preenchida, e a
    autoria é majoritariamente única por material — como faceta viraria uma lista de dezenas de
    entradas com contagem 1, que não filtra nada e ocupa a sidebar inteira. Editora/selo
    **continua** faceta: é cardinalidade baixa e agrupa de fato.
29a. **A remoção não deixa faceta órfã.** `authors` e `author_keys` permanecem na tabela e
    continuam sendo gravados pelo ingest — o que muda é a exposição em `/facets` e na sidebar.
    Removê-los do schema quebraria R30 e a busca do próprio R29.

30. **A extração aproveita o que o parser já lê e descarta.** `parseInformationRows`
    (`services/scrapers/itchIoParser.ts:133`) já percorre a tabela de informações inteira da
    página do itch.io, mas `parseItchGameDetail` (`:171`) devolve apenas `tags`, `description`,
    `coverImageUrl` e `publisherName` — o resto é lido e jogado fora no mesmo escopo. Passam a
    ser extraídos e persistidos, quando a fonte os declarar: `genre`, `file_format`,
    `page_count`, `license_kind`, `scenario`, `target_audience`, `creation_method` e
    `description_html`.
30a. **Campo ausente na fonte permanece nulo explícito, nunca inventado nem copiado de outro.**
    Mesmo contrato já firmado para `authorsCredits` no itch (`itchIoParser.ts:121-132`, spec
    088 requisito 38): ausência declarada é dado, não lacuna a preencher por inferência.
30b. **`description_html` entra pela mesma fronteira de sanitização do resto do rich text**
    (`sanitizeRichHtml`, spec 086 Fase 2), sanitizado no backend antes de persistir e antes de
    servir. Hoje o parser só extrai `og:description` (meta curta, texto puro) e
    `description_html` está vazio em **todos** os 90 materiais do acervo; passar a extrair o
    corpo da página cria superfície de HTML hostil que hoje não existe nesse campo.
30c. **A cobertura é medida antes e depois, por plataforma.** Baseline de 2026-07-28 no acervo
    recoletado: `file_format`, `license_kind`, `page_count`, `genre`, `scenario`,
    `target_audience`, `creation_method` e `description_html` em **0 de 90** materiais;
    `publisher_name` em 10 (só `itch_io` e `grimorios_e_dados`); `authors` em 61 (só
    `opera_rpg`). Sem medir, "melhorou" não é verificável.

31. **Editora/selo ganha apresentação e afordância de clique.** Hoje é um parágrafo solto no fim
    da ficha (`frontend/src/pages/MaterialPage.tsx:315-319`), depois do bloco Detalhes,
    renderizado como `text-sm` com `--fg-muted` sobre fundo neutro — cinza sobre cinza, sem
    link, sem destaque, no ponto de menor atenção da página. Passa a aparecer **abaixo do
    título**, em cor de link, clicável para o catálogo filtrado por aquela editora, no padrão
    que Amazon e Mercado Livre usam para marca/vendedor (referência do mantenedor, 2026-07-28).
31a. **O destino do clique é o catálogo filtrado pela faceta de editora**, não busca textual
    solta — a editora continua sendo faceta real (R29), então o link leva ao filtro
    estruturado.
31b. **Contraste e alvo de toque atendem o mínimo já exigido no projeto:** contraste de texto
    conforme a paleta de `packages/ui` e alvo clicável de 44px, mesma régua aplicada aos demais
    CTAs da ficha. A mudança é de hierarquia visual e usabilidade (Nielsen: visibilidade e
    reconhecimento em vez de recordação), não só de cor.
31c. **Material sem editora não deixa espaço morto nem rótulo vazio** abaixo do título.

32. **[P0] Bug — o detector de idioma aprova inglês como "português confiante".**
    `detectWithFranc` (`services/languageDetector.ts:60`) calcula
    `confident = runnerUpScore < CONFIDENT_RUNNER_UP_THRESHOLD` olhando **apenas a margem para o
    segundo colocado**, sem verificar se o primeiro colocado é `por`. Quando franc erra o topo,
    a margem folgada faz o guarda-corpo de baixa confiança não disparar justamente no caso em
    que ele deveria.
    Reproduzido com o texto real do acervo (2026-07-28):
    ```
    francAll("Cat5Crew A party game ready to take you to space.")
      → [['por', 1], ['eng', 0.82], ['spa', 0.81]]
    ```
    `0.82 < 0.95`, logo `confident: true`, `isPortuguese: true`, e o gate de
    `scraperIngest.ts:278` (`!detection.isPortuguese || !detection.confident`) deixa passar.
    Resultado em beta: `cat5crew` ("A party game ready to take you to space.") e `minihex`
    ("Tribute to the game The Mini Quest") gravados com `detected_language='por'` e
    `language_confident=true` — **2 dos 3 materiais do `itch_io`**. Furo direto do D119
    ("somente material em português").
32a. **A causa é a faixa de texto curto, e a correção precisa cobri-la.** Os dois casos têm 49 e
    42 caracteres, passando o piso `MIN_TEXT_LENGTH_FOR_FRANC = 40` por pouco — faixa em que
    franc é reconhecidamente instável. Elevar o piso sozinho apenas empurra os dois para o
    fallback; a confiança precisa deixar de ser derivada só da margem.
32b. **A correção é fail-closed, no padrão que o resto do detector já segue:** idioma não
    comprovadamente português não entra, e indeterminação rejeita em vez de aprovar. Nenhuma
    mudança pode transformar rejeição atual em aprovação silenciosa.
32c. **Regressão coberta por teste com os textos reais de `cat5crew` e `minihex`**, não com
    fixture sintética — foram eles que passaram pelo gate em produção de beta.
32d. **O acervo contaminado é corrigido, não só o código.** Após a correção, os materiais de
    beta aprovados indevidamente são reavaliados e removidos do acervo público. Beta é
    descartável (decisão do mantenedor, 2026-07-28), então recoleta limpa é caminho aceito;
    prod ainda não está populado, logo não há dado real a migrar.

## Critérios de aceite

- Usuário logado comenta, responde e vê nome/avatar corretos nos **três** módulos.
- Responder a um comentário gera notificação ao autor do pai, visível na central, **vinda de qualquer módulo**.
- A central mostra eventos dos três módulos juntos, e cada um leva de volta ao contexto certo.
- Moderador global modera comentário dos três módulos, sem precisar de papel por app.
- Quem é admin/moderador hoje continua sendo após a migração, sem intervenção manual.
- Os 25 legados do `site` aparecem, marcados como legado, sem permitir resposta.
- Com o `accounts.` indisponível, a página do módulo carrega com aviso — não quebra.
- Payload hostil é neutralizado: comentário novo é texto puro (nada a sanitizar), e o HTML legado passa por sanitização única na entrada, testada contra script, links, SVG/MathML e atributos.
- Resposta além do limite de profundidade é rejeitada, com teste — assim como resposta a pai em outro assunto, em outro `realm`, ou a comentário legado.
- **Papel revogado no banco deixa de valer na sessão ativa dentro do SLA declarado**, provado por teste de promoção e de revogação. Sem isso o `accounts.` não é fonte de verdade.
- **Ação moderadora com o `accounts.` indisponível falha fechada**, enquanto a leitura pública de comentário continua servindo.
- **Dono forjado no payload é ignorado**: o badge de autor sai do que o backend do domínio afirma, não do que o cliente envia.
- **Escrita direta do navegador no `accounts.` é recusada** — só o backend do módulo escreve, com credencial própria.
- **Comentário criado em beta não aparece em prod**, e o mesmo `subject_id` em apps diferentes não colide.
- **Paginação não duplica nem perde item** entre páginas, sob inserção concorrente.
- **Carga de leitura de comentário não consome a cota de autenticação** — limiters separados, provado por teste.
- **Remoção de comentário preserva os filhos**; usuário removendo o próprio comentário recebe 403.
- **Nenhum comentário legado órfão ou em ciclo é copiado silenciosamente** — detectados antes da cópia.
- **Smoke de SSO completo:** login, `/me`, logout funcionando em todos os consumidores após a mudança no `accounts.`

### Catálogo do `downloads` (requisitos 29-32)

- **Texto em inglês é rejeitado pelo gate de idioma.** Os textos reais de `cat5crew` ("A party
  game ready to take you to space.") e `minihex` ("Tribute to the game The Mini Quest") não
  entram no acervo, com teste que falha contra o código atual e passa depois da correção.
- **Nenhum material do acervo tem `detected_language='por'` sobre texto não português**, medido
  por varredura do acervo recoletado, não por amostra.
- **Nenhuma rejeição que hoje ocorre vira aprovação** depois da mudança no detector — a
  correção só aperta, nunca afrouxa.
- **`authors` não aparece como faceta selecionável** em `/facets` nem na sidebar do catálogo, e
  a busca textual por nome de autor continua encontrando o material.
- **Editora/selo continua faceta funcional** depois da remoção de `authors` — uma coisa não
  levou a outra junto.
- **Os campos do requisito 30 saem de 0 e passam a ser preenchidos** quando a página da fonte os
  declara, com cobertura por plataforma medida antes e depois (baseline em 30c).
- **Campo ausente na fonte permanece nulo**, sem valor inventado nem copiado de outro campo —
  provado com material cuja página não declara o dado.
- **`description_html` extraído passa pelo sanitizador** antes de persistir e antes de servir,
  testado contra script, atributo de evento, link `javascript:` e SVG/MathML.
- **Editora/selo aparece abaixo do título, em cor de link, e o clique leva ao catálogo filtrado
  por aquela editora** — verificado na ficha real, não só em teste de unidade.
- **Ficha de material sem editora não exibe rótulo vazio nem espaço morto** abaixo do título.
- **Contraste e alvo de 44px conferidos** no novo elemento de editora/selo.
- `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test` e `rtk pnpm verify:api` verdes.

## Fora de escopo

- **E-mail e push** como canais de notificação (decisão do mantenedor: in-app apenas). `packages/email` existe e pode ser ligado depois.
- **Migrar o campo `comment` do review de mestre** (`mesas`) — é parte da avaliação, não comentário.
- **Reações, curtidas ou votos** em comentário.
- **Comentário anônimo novo** — legado é read-only; escrita exige SSO.
- **Página pública de perfil.**
- **Notificação de eventos que não sejam de comentário** (ex.: moderação, publicação) — o desenho deve permitir, mas esta spec entrega só comentário. **Não confundir com o histórico existente:** as notificações que o `downloads` já tem — aprovação, rejeição e denúncia resolvida (`migration_018_download_notification.sql:5`) — **migram como legado read-only** (decisão do mantenedor, 2026-07-27), para o histórico não se perder. Elas não viram `kind` oficial do registro de eventos, e nada é gerado nesses tipos daqui em diante. A 1ª revisão do Codex apontou a contradição entre esta linha e a T5.2, que mandava migrar tudo; a decisão acima resolve as duas.

## Riscos e impacto em outros módulos

> ⚠️ **Esta é a mudança mais invasiva do projeto até aqui.** `accounts.` é sagrado
> (`AGENTS.md`): mudança de código lá exige **aprovação + SDD Completo + smoke de todos os apps
> que consomem SSO**. Nunca quebrar a sessão compartilhada.

- **Ponto único de falha novo.** Hoje uma queda do `accounts.` impede login; depois desta spec,
  também deixa os três módulos sem comentários e sem notificações. Daí o requisito 22:
  degradar com aviso, nunca quebrar a página.
- **Migração de papéis é irreversível na prática.** Se o papel global sair dos apps e a
  migração estiver errada, alguém perde acesso de moderação em produção. Exige mapa
  antes-e-depois conferido, e rollback testado.
- **Dado real em dois módulos.** `downloads` tem comentários e notificações em beta; `site` tem
  25 comentários em beta e **provavelmente em produção** — confirmar antes de qualquer
  migration, com `pg_dump`.
- **Dado cruza fronteira de banco.** Comentário sai do banco do app e vai para o do `accounts.`
  Isso inverte a regra de isolamento do monorepo — deliberadamente, para viabilizar agregação —
  mas significa que o `accounts.` passa a guardar conteúdo de usuário, não só identidade.
- **`mesas` ganha superfície pública nova.** Comentário em mesa é conteúdo de usuário exposto:
  herda sanitização e moderação, e amplia o que precisa ser moderado.
- **A spec 089 depende desta** para os requisitos 18-22 e 32-35. Enquanto a 090 não fechar,
  aquela parte fica em aberto — dependência declarada, não débito esquecido.
- **Ordem de adoção importa.** `downloads` tem a necessidade imediata; `site` tem o dado mais
  delicado; `mesas` não tem nada a preservar.
