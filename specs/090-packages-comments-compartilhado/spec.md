# 090 — Comentários, notificações e papéis unificados no `accounts.`

- **Módulo/Pacote:** `apps/accounts` (dono) + `packages/comments` (cliente/UI) + `apps/downloads`, `apps/site`, `apps/mesas`
- **Gate relacionado:** B (SSO) e D (bloqueia a entrega de comentários do downloads, hoje na spec 089)

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
