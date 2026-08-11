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
4. **O papel global nasce no `accounts.`; não é migrado de app nenhum** (decisão do mantenedor, 2026-07-30, substituindo a versão anterior deste requisito). A conta central é definitiva e mandatória — `downloads`, `mesas` e `glossario` deixam de ser fonte de papel global e viram consumidores puros. `downloads` não foi lançado e pode ser refeito; travar a arquitetura do SSO para preservar o papel local dele não se justifica.
4a. **O mantenedor é admin desde o primeiro boot.** `accounts.` lê `ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL` na inicialização e garante `role='admin'` para essa conta — idempotente, sem efeito se o papel já estiver correto, sem falhar o boot se a conta ainda não existir. **O e-mail vive no `.env` da VM, nunca literal em código ou SQL:** o repositório é público desde 2026-06-14, e o histórico do Git é permanente — e-mail literal sobrevive à própria remoção e vira alvo nominal de phishing contra a conta que administra a plataforma. Sem este requisito, subir a Fase 1 deixaria **ninguém** como admin (`users.ts:71` cria toda conta como `user`) e o único conserto seria `UPDATE` manual em produção. **O mantenedor autorizou (2026-07-30) que a variável entre no `.env` de produção e de beta**, com o e-mail dele como valor. A escrita na VM é ação própria, executada quando a T1.5a existir e o código souber ler a variável — autorizar o registro não antecipa o comando, que é aprovado no ato, com o diff à vista.
4b. **Promoção e rebaixamento acontecem por painel no `accounts.`**, não por script nem por SQL. Toda ação é auditada em `global_role_audit` com ator identificado; rebaixar a si mesmo é recusado, para o admin único não se trancar para fora. A princípio existe um único admin — o mantenedor.
4c. **Não há leitura dupla nem fallback para papel local.** Ausência de papel no `accounts.` significa `user`. Fallback reintroduziria o app como autoridade pela porta dos fundos: um app desatualizado ou comprometido concederia privilégio que o central nega. Consequência aceita e desejada: o `accounts.` fora do ar não promove ninguém (requisito 2a) e nenhuma ação privilegiada passa.

### Comentários no `accounts.`

5. Comentário é armazenado no `accounts.`, com referência opaca ao alvo (`subject_type`, `subject_id`) — o `accounts.` não conhece "material", "post" nem "mesa".
5a. **`realm` e `source_app` entram na chave** (decisão do mantenedor, 2026-07-27). O manifesto declara o `accounts.` prod-only, mas beta o reutiliza (`plan.md:30`): sem separação, comentário de teste em beta aparece em produção e o mesmo `subject_id` colide entre apps. Os dois campos estão em toda linha, nos índices e na chave de listagem, desde a primeira migration.
5b. **A URL de volta é construída pelo servidor, nunca aceita inteira do cliente.** Guardar `source_app` + `canonical_path`; a origem vem de registro allowlisted. Receber a URL pronta abriria phishing e open redirect, e separar beta de prod sai de graça.
6. Comentar exige conta do SSO; não há fluxo anônimo de escrita.
6a. **A escrita é backend-to-backend** (decisão do mantenedor, 2026-07-27). O frontend nunca escreve direto no `accounts.`: o backend do módulo valida que o assunto existe, está visível, aceita comentário e quem é o dono, e só então chama com **credencial própria por app**. `owner_user_id`, papel e URL vindos do cliente nunca são confiados — referência opaca não substitui autorização por objeto (OWASP IDOR). Resolve junto um bloqueio real: a allowlist CSRF do `accounts.` tem cinco origens (`app.ts:87`) e exclui `downloads` e todos os betas, enquanto o CORS aceita qualquer subdomínio (`:97`) — escrita direta do navegador falharia hoje.
7. Comentário carrega identidade resolvida (nome, avatar) sem o app consumidor precisar de segunda chamada. Resolvida por `JOIN` no mesmo `SELECT` — comentários e usuários vivem no mesmo banco. Conta removida ou desativada cai em nome neutro e avatar nulo; e-mail nunca é exposto.
7a. **O ator comunitário não é a própria linha autenticável da conta.** Comentários, votos,
    denúncias e auditoria referenciam uma identidade comunitária opaca. Enquanto a conta está
    ativa, um vínculo restrito liga esse ator ao usuário do SSO; a API pública nunca expõe esse
    vínculo. Isso permite preservar conversa e score sem obrigar retenção nominal eterna.
7b. **Pedido de exclusão neutraliza a pessoa e preserva a conversa.** Nome, e-mail, avatar,
    refresh/cookies e identidade pública são eliminados ou revogados no pedido; endpoints
    comunitários revalidam a conta e recusam imediatamente token antigo. Nos demais consumidores
    SSO, access token já emitido respeita o SLA global existente de no máximo 15 minutos — não se
    cria introspecção por request nesta fase. Comentários permanecem como
    “Conta excluída”, e votos/score permanecem. Sem caso ou recurso ativo, o vínculo nominal é
    desfeito irreversivelmente no mesmo ciclo. Havendo caso/recurso, somente a moderação mantém o
    vínculo até seis meses após a decisão final; depois ele é desfeito. `legal_hold` explícito e
    auditado suspende esse expurgo enquanto durar. Exclusão voluntária impede novo cadastro pela
    mesma identidade Google por seis meses usando somente identificador técnico mínimo; sanção
    mantém esse identificador enquanto a sanção durar. Esta regra **substitui a retenção nominal
    permanente da decisão 15**, sem revogar a preservação/invalidação de votos da decisão 14.
7c. **Contexto declarado da política:** controlador Paulo Henrique Mota Lima, representando o
    grupo Artifício RPG; pessoa física; contato `artificiorpg@gmail.com`; projeto gratuito, sem
    exploração econômica organizada, e mercado pretendido somente Brasil. Mudança de controlador,
    monetização ou direcionamento a outro mercado exige revisar esta política antes do novo uso.
7d. **Tratamento específico de idade não integra a Fase 2.** Decisão do mantenedor em 2026-08-04:
    a fase será implementada integralmente em pré-lançamento; adequação específica ao ECA Digital
    será tratada depois, antes do uso integral da comunidade, e não bloqueia implementação nem
    validação técnica desta fase. Esta decisão registra diferimento explícito; não declara que a
    adequação futura já existe.
8. Comentário pode responder outro por **adjacency list com cinco níveis visuais**: raiz
   `depth=0`, respostas até `depth=4`; `root_id`, `parent_id` e `depth` são estruturais, e
   `root_id` nunca é aceito do cliente. Não há limite de respostas irmãs. Pai, assunto,
   `realm`, `source_app`, estado e profundidade são validados **na mesma transação**.
8a. **A leitura segue a árvore do Reddit, não lista plana.** No volume normal devolve a árvore
    inteira. O hard cap defensivo é 1.000 comentários ou 2 MiB, o que ocorrer primeiro; só o
    restante vira nós `more` com cursor próprio, sem produzir filho órfão.
8b. **Voto e score fazem parte do comentário.** Só terceiro autenticado vota; autor não recebe
    auto-upvote nem vota no próprio comentário. Cada conta mantém uma escolha ativa por
    comentário (`-1`, `0`, `1`), com `0` removendo o voto. Mesmo estado é no-op; mudança real
    atualiza voto, auditoria, contagens e ranking na mesma transação. Voto não gera notificação.
8c. `score = upvotes - downvotes`. Os quatro sorts são: **Melhores** por limite inferior de
    Wilson unilateral (`z=1.281551565545`, `algorithm_version='reddit-wilson-80-v1'`, padrão),
    **Mais votados** por score, **Recentes** por data descendente e **Mais antigos** por data
    ascendente. Ordenação ocorre entre irmãos; data e UUID desempatem. Contagens e score são
    públicos imediatamente; `my_vote` aparece só autenticado; identidades de votantes ficam
    restritas à moderação enquanto existir vínculo permitido por 7b, depois resta apenas o ator
    opaco e o histórico do voto.
8d. **Ranking é versionado por assunto.** Cada assunto mantém `ranking_revision`; comentário
    registra `created_revision`; cada mudança real de voto cria versão de score sob lock curto.
    Cursor opaco assinado fixa assunto, sort, `snapshot_revision`, ramo, chave de ordenação,
    limite e expiração de 30 minutos. Navegação preserva posição naquela revisão; contagem e
    voto pessoal podem refletir o estado atual. Histórico de score não é destruído nesta fase.
8d-i. **Chave de assinatura do cursor: `ACCOUNTS_COMMENT_CURSOR_KEY`, dedicada, obrigatória.**
    8d exige cursor "opaco assinado" e não dizia com qual chave. Decidido em 2026-08-07 pelo
    mantenedor, seguindo o precedente **REV-023**, que criou "chave dedicada p/ cifrar
    `admin_secrets` (**desacoplada do `JWT_SECRET`**)" — `apps/accounts/docker-compose.prod.yml`.
    O padrão de `apps/accounts/src/env.ts` é um segredo por finalidade, todos `min(32)`:
    `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ACCOUNTS_SECRETS_KEY`. Cursor é finalidade nova, logo
    chave própria — rotacionar o JWT não pode invalidar cursor em voo, nem o contrário.
    **Obrigatória**, ao contrário de `ACCOUNTS_SECRETS_KEY`: não há caminho degradado, porque
    cursor assinado com valor default é cursor forjável, e falhar o boot é preferível a assinar
    com segredo previsível. Daí o `:?` no compose de prod.
    **A ordem de instalação é parte da decisão** (precedente REV-023, `specs/048-.../reviews.md`,
    2026-06-27): valor gerado e inserido **por SSH direto no `.env` da VM, não via GitHub
    Secrets**, e **antes** de o compose exigi-lo — com `:?` o deploy falha se a env não existir,
    e como o `accounts` sustenta o SSO, a falha derruba o login de todos os projetos, não só a
    rota nova. Foi a armadilha que mordeu a T2.2a-op em 2026-08-05.
    Um arquivo só: `accounts` é PROD-only (D042), então não há `.env.beta` a preencher.
    `packages/comments/src/treeCursor.ts` recebe o segredo **por parâmetro** e nunca lê
    `process.env` — quem monta a chave é o `apps/accounts`, dono da env.
8e. IDs públicos de comentário, evento e recibo usam UUID v4. `legacy_id` permanece separado.
    Não introduzir UUID v7, ULID ou biblioteca nova.
9. Os comentários legados do `site` — 25 medidos em produção em 2026-08-04, mas recontados como
   `N_source` no cutover — são importados **imutáveis**: sem edição nem voto,
   score `0`, autoria não verificada e marca visual de antigo/importado. **Podem receber resposta
   nova** de conta autenticada; antigo descreve proveniência, não congela a conversa. Usam
   `user_id` nulo, `legacy_author_name`, `legacy_source` e
   `unique (legacy_source, legacy_id)` para importação idempotente. `site.comments` tem
   `parent_id` sem FK (`apps/site/db/migrations/001_init.sql:66`): pais órfãos e ciclos são
   detectados antes da cópia.
10. **Comentário novo usa o pipeline Markdown compartilhado existente.** Backend aplica
    `sanitizeUserMarkdown` de `@artificio/content-editor/sanitize`, persiste somente o Markdown
    canônico em `body_markdown` e devolve Markdown, nunca HTML montado. Consumidores renderizam
    por `MarkdownContent`/`renderMarkdown`; HTML bruto permanece desabilitado e a saída passa por
    DOMPurify. Criação e edição validam entrada original e resultado canônico em até 10.000
    caracteres, rejeitam excesso sem truncar e exigem conteúdo textual visível por
    `markdownToPlainText`. **O limite conta pontos de código, não unidades UTF-16** — é o que
    `LENGTH()` do PostgreSQL conta, e divergir recusaria corpo que o banco aceita (5.001 emoji
    davam 10.002 em `String.length`). O HTML legado continua em campo próprio, sanitizado uma vez
    na entrada com política/versionamento e protegido de novo na saída sem regravar o banco.

10a. **Links usam uma política única em `@artificio/content-editor`.** Links reconhecidos são
     HTTPS-only; ausência de esquema canonicaliza para `https://`; `http:` e qualquer esquema
     explícito diferente são recusados com `INVALID_COMMENT_LINK`. Host exato
     `artificiorpg.com` ou subdomínio real abre na mesma aba; externo abre em nova aba. Todo link
     recebe `rel="ugc nofollow"`; externo acrescenta `noopener noreferrer`. Caminho `/rota` é
     resolvido contra a origem confiável do `source_app`; `//host`, `../` e relativo ambíguo são
     rejeitados. Comparação é estrutural por `URL`, nunca por substring.
10b. Imagem existe só como referência HTTPS clicável. `![alt](https://...)` vira link textual;
     não há `<img>`, fetch automático, upload, Cloudinary, proxy, preview ou busca server-side.
     Sintaxe Markdown incompleta que o CommonMark trata como texto continua texto. Não há
     `@menções`: `@texto` não resolve conta nem cria destinatário.
10c. **A sanitização é idempotente: `f(f(x)) = f(x)`.** Não é elegância — consumidores sanitizam
     na escrita **e** de novo na leitura (`apps/downloads/backend/src/routes/comments.ts` persiste
     na linha 47 e re-sanitiza na 65), então uma função não idempotente faz o conteúdo armazenado
     mudar ou desaparecer a cada leitura, sem erro nenhum. Duas propriedades sustentam isso e
     valem como invariante, não como detalhe de implementação: **entidade HTML digitada pelo
     usuário nunca vira markup** (`&lt;b&gt;` permanece `&lt;b&gt;`, jamais `<b>`), e **caractere de
     controle interno do sanitizador nunca é aceito da entrada** — se o pré-passo usa marcador
     reservado, ele é descartado antes de qualquer processamento, senão o próprio marcador vira
     vetor de injeção. Ambas foram violadas e corrigidas na PR #246; o histórico está em `tasks.md`
     T2.5.
11. Comentário exibe o papel do autor quando aplicável — autor do conteúdo, moderador, admin —, sem rotular usuário comum. O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada, nunca do payload público** — senão qualquer um se declara dono.
12. **Autor pode editar e retirar o próprio comentário.** Edição não tem prazo e altera apenas
    `body_markdown`; cria versão, marca `edited_at`, preserva votos/ranking e não notifica.
    Edição idêntica é no-op. Auto-retirada cria tombstone irreversível para o autor, preservando
    posição e filhos. Só moderador/admin restaura. Esta regra substitui D111 item 6 e a antiga
    proibição de autoedição/autoexclusão.
12a. Moderador/admin retira ou restaura com motivo e auditoria, mas **nunca reescreve texto de
     terceiro**. Tombstone e `pending_review_hidden` não expõem corpo nem score ao público;
     posição e descendentes permanecem. Versões antigas e dados de ação ficam restritos à
     moderação.
12b. **Rate limiters são separados por ação e camada** antes da exposição: autenticação,
     leitura, criação/resposta, edição, voto, denúncia e recurso têm buckets próprios. A fachada
     aplica IP real validado e usuário; o `accounts.` aplica usuário e credencial de
     `source_app`. Todos os buckets aplicáveis precisam permitir a operação; nenhum consome cota
     de login, `/me` ou refresh. IP bruto não entra no schema comunitário nem é propagado ao
     `accounts.` como dado do comentário; na fachada, a chave existe somente pelo TTL do bucket.
     Valores são configuração operacional. A medição pelo Cloudflare/trusted proxy acontece antes
     do uso integral da comunidade e calibra os números sem bloquear schema ou implementação; se
     falhar, corrige-se o ingress, não o modelo comunitário. Erro 429 não revela qual bucket
     disparou.
12c. **Criação/resposta, evento e recibos nascem na mesma transação já na Fase 2.** Raiz
     notifica publicador vinculado; resposta notifica autor do pai e publicador; destinatários
     iguais deduplicam; ator e conta inválida são excluídos. Central, polling e API pública de
     notificações continuam na Fase 3. Voto e edição não notificam.
12d. **Denúncia de comentário pertence ao núcleo central.** Exige conta, terceiro e no máximo
     uma denúncia ativa por conta/comentário. Cada denúncia fixa a versão imutável denunciada,
     motivo, detalhe e ator privado do denunciante; a moderação resolve a conta somente enquanto
     existir vínculo permitido por 7b e vê versão denunciada,
     atual e diff. Um `moderation_case` aberto agrega as denúncias de um episódio; caso encerrado
     não é reaberto por denúncia posterior.
12e. Uma denúncia prioriza a fila, mas não oculta. Cinco contas válidas distintas com denúncias
     ativas mudam atomicamente para `pending_review_hidden`; editar não republica. Denunciante
     só retira antes desse limiar. Auto-retirada do autor preserva o caso e a evidência.
12f. Cada denúncia termina em `upheld`, `dismissed`, `no_determination` ou `withdrawn`; o caso
     aplica uma única ação `no_change`, `restore` ou `remove`. Fechamento exige veredito de todas
     as denúncias aplicáveis e uma ação, na mesma transação e com um único vencedor concorrente.
     Resultado privado e mínimo chega a denunciante e autor pelo núcleo de notificações.
12g. Versão aprovada não reabre caso nem auto-hide por nova denúncia da mesma versão; denúncia é
     auditada como `no_determination`. Moderador pode reabrir com motivo; edição cria versão nova
     denunciável. Remoção moderadora admite um recurso do autor em até seis meses, uma vez por
     decisão, sem restauração automática; o mesmo moderador pode rejulgar com nova justificativa.
12h. O registro compartilhado de motivos declara código, rótulo, prioridade e política de
     detalhe (`required|optional|forbidden`). Detalhe é texto puro, trim, máximo 4.000, imutável
     e restrito à moderação. Prioridade ordena a fila, nunca decide culpa nem auto-hide.
12i. Sanção comunitária é separada do SSO: escopos `posting` e `commenting`, com `warning`,
     suspensão temporária ou permanente, sempre escolhidos por moderador e auditados. Login,
     leitura e uso não comunitário continuam. Conta nova pode comentar e votar; entra na fila e
     recebe limites mais apertados, sem peso secreto nem bloqueio automático.
12j. Desativação comum preserva votos e score, bloqueando voto novo. Moderador pode invalidar
     votos de conta abusiva, recalculando assuntos e revisões sem apagar histórico. Exclusão de
     conta segue o ciclo do requisito 7b: identidade pública neutralizada imediatamente, vínculo
     nominal temporário apenas para caso/recurso ou `legal_hold`, expurgo irreversível no prazo e
     bloqueio mínimo de recadastro/sanção separado do ator comunitário. Não existe retenção nominal
     permanente por simples pedido de exclusão.

### Notificações unificadas

13. Notificação é armazenada no `accounts.` e agrega eventos de **todos** os módulos.
13a. **Evento e recibo são tabelas separadas.** `notification_event` guarda a ocorrência imutável (`id`, `realm`, `source_app`, `type`, `version`, subject opaco, ator, `canonical_path`, dados, `occurred_at`); `notification_receipt` guarda o estado por usuário (destinatário, `read_at`). Juntar os dois impediria vários destinatários, deduplicação e canais futuros sem migrar o evento.
13a-i. **Este par é a base única; os dois sistemas legados são absorvidos** (decisão do mantenedor, 2026-08-10). Existem hoje três modelos independentes, medidos: `download_notification` (`apps/downloads/database/migration_018_download_notification.sql:12-21`), `notifications` do `mesas` (`apps/mesas/database/migration_06_system_suggestions.sql:29-41` + `migration_106_notifications_action_metadata.sql:12-14`) e `notification_event`/`notification_receipt` (`apps/accounts/database/migration_006_community_comments.sql:469-525`). O par do `accounts.` é a base porque tem as três propriedades irreversíveis que os outros não têm — `realm` estrutural (nas chaves, índices e no FK composto), idempotência do produtor (`event_id` UNIQUE) e separação evento/entrega. As duas capacidades maduras dos legados são **absorvidas**, não descartadas: `PATCH /read-all` e `metadata` JSONB vêm do `mesas` (`apps/mesas/backend/src/routes/notifications.ts:33-52`, `migration_106:13`); o padrão de frontend React Query + Zod + `invalidateQueries` vem do `downloads` (`apps/downloads/frontend/src/hooks/useNotifications.ts:9-26`). `download_notification` e `notifications` viram produtores do par consolidado e param de ser fonte própria.
13a-ii. **`source_app` aceita todos os módulos e também `accounts`** (decisão do mantenedor, 2026-08-10). O CHECK atual (`migration_006:473,506`) admite só `downloads|site|mesas`, o que não representa evento nascido no próprio `accounts.` — aviso de moderação, decisão de denúncia, recurso e sanção. A consolidação exige migration que amplie o CHECK; nenhum evento fica sem origem representável.
13b. **O evento carrega snapshot estruturado**, não mensagem pronta nem dependência do domínio vivo. Título editado, motivo alterado ou nome trocado **não podem** mudar o sentido de uma notificação histórica. Guardar os dados imutáveis necessários (ex.: `material_title`, `reason`, `actor_name_snapshot`) mais `event_version`. Só a string pronta impediria reformatar; só o domínio vivo faria o passado mudar.
13c. **Comentário, evento e recibo nascem na mesma transação.** Falha reverte o conjunto. Evento vindo de outro módulo usa `event_id` idempotente e outbox no produtor.
13c-i. **A gravação do evento é transacional; a entrega é assíncrona** (decisão do mantenedor, 2026-08-10). Vale para **todo** evento, inclusive aviso de moderação: nenhuma ação de mérito trava à espera de confirmação de entrega. Um caminho acoplado só para moderação chegou a ser considerado e foi **descartado pelo mantenedor** — criaria um modo de falha (ação bloqueada) sem proteger nada que o outbox já não garanta, já que o evento é durável desde a transação e a entrega é apenas questão de quando. Medição de 2026-08-10 desmentiu a premissa que a Fase 3 carregava: em vez de best-effort, quatro das cinco emissões do `downloads` são **transacionais demais** — `moderation.ts:152`, `:227`, `:354` e `reports.ts:308` passam `trx` e correm dentro de `db.transaction()`, então falha do INSERT de notificação faz **rollback da rejeição, da aprovação e da decisão de denúncia**. A quinta (`systemSuggestionsAdmin.ts:346`) é o oposto por decisão documentada no próprio código (`:339-341`) e coberta por teste (`systemSuggestionsAdmin.test.ts:391`): pós-commit, sem `await`, com `.catch()` que engole. As duas pontas são defeito. O consolidado usa **outbox**: o evento entra na mesma transação da ação de mérito — não se perde —, e o fan-out/entrega roda fora dela — não derruba moderação. Acoplar (estado atual dos quatro) e desacoplar puro (estado do quinto) apenas trocam um defeito pelo outro.
13d. **O evento não vaza conteúdo restrito:** título, motivo e link de conteúdo privado não são expostos a quem não tem acesso atual. O link leva ao módulo, e o módulo **revalida a autorização** — notificação não é passe de acesso.
13d-i. **Contradição entre 13b e 13d resolvida: o nome do conteúdo some quando o acesso some** (decisão do mantenedor, 2026-08-10). As duas cláusulas eram incompatíveis — 13b congela o título para que o histórico não mude, 13d proíbe expor título a quem perdeu acesso, e a leitura não consultava acesso atual. Caso que decidiu: João é notificado de uma resposta na mesa "Curse of Strahd"; o mestre torna a mesa privada; seis meses depois João **não** lê mais o nome dela na central — o item degrada para "Maria respondeu seu comentário", preservando a ocorrência e descartando o nome. Quem mantém acesso continua vendo o nome. Consequência aceita: a listagem **revalida acesso por item**, então o snapshot de 13b deixa de ser suficiente sozinho para renderizar — ele congela o texto contra *edição*, não contra *perda de acesso*. Alternativa recusada: nunca citar o conteúdo em notificação nenhuma, que resolveria por eliminação mas deixaria todo aviso genérico para todo usuário, o tempo todo.
13e. **Aviso de moderação aparece mínimo na lista; motivo e recurso ficam no detalhe** (decisão do mantenedor, 2026-08-10). Remoção de comentário, decisão de denúncia, resultado de recurso e sanção geram notificação, mas a lista mostra só a ocorrência ("seu comentário foi removido") — motivo, prazo e caminho de recurso vivem na página de detalhe, fora do feed. A central é tela que o usuário abre em qualquer lugar; motivo de moderação exposto na listagem vaza em ombro alheio e em captura de tela, sem que ele tenha escolhido mostrar.
14. Responder a um comentário notifica o autor do comentário pai.
15. **Notificação segue interação, não propriedade** (decisão do mantenedor, 2026-07-27 — modelo WordPress, Facebook e Twitter). Quem recebe é quem **participou da conversa**: quem publicou o conteúdo e quem comentou nela. Comentar num conteúdo notifica quem o publicou, **quando existe conta vinculada**; responder a um comentário notifica quem escreveu o pai. Quem nunca interagiu não recebe nada, e ninguém precisa "ser dono" de um objeto para acompanhar a própria conversa.
15a. **Conteúdo sem conta vinculada simplesmente não gera notificação de publicação** — não inventa destinatário. É o caso dos posts do blog: `site.posts` **não tem** `author_user_id` nem equivalente (`apps/site/db/migrations/001_init.sql:28`), e o `Post` exportado só carrega conteúdo e metadados (`src/lib/content.ts:17`). Comentar num post não notifica ninguém; **responder a um comentário continua notificando quem o escreveu**, que é o que preserva a conversa. Nenhum badge de autor em post. A limitação é registrada, não contornada com dono fictício, e nenhuma migration nova entra no `site` por causa disso.
15b. **No `mesas`, quem recebe é a conta publicadora** (decisão do mantenedor, 2026-07-27) — a única com vínculo real no `accounts.` `gm_id` pode ser nulo, mesa importada pode ser órfã, e `publisher_role`/`actual_gm_name` (`db/types.ts:227`) permitem que quem anuncia não seja o mestre real. Mestre nomeado apenas em texto, sem conta, não recebe nada — não há para onde notificar. Mesa órfã não gera notificação de publicação. Badge só quando há conta real por trás.
15c. **O conjunto de destinatários é definido, não implícito** — os requisitos 14 e 15 se sobrepõem numa resposta. Decisão do mantenedor (2026-07-27): comentário raiz notifica quem publicou o conteúdo (havendo conta); **resposta notifica quem escreveu o pai e quem publicou o conteúdo**; sendo a mesma conta, **um recibo só**; conta removida ou bloqueada não recebe.
16. O usuário não é notificado das próprias ações.
16c. **Exclusão de conta apaga os recibos dela; os eventos que ela causou permanecem, anônimos** (decisão do mantenedor, 2026-08-10). As notificações que a pessoa **recebeu** são eliminadas com a conta — já é o comportamento do FK `ON DELETE CASCADE` em `notification_receipt.recipient_user_id` (`migration_006:508`) —, e nada dela sobra na própria central. Os eventos que ela **causou** ficam: quem foi notificado de uma resposta não perde o histórico porque a outra pessoa saiu, e o ator aparece como "Conta excluída", conforme o modelo de identidade eliminável já definido. Apagar também os eventos causados abriria buraco na conversa de terceiros e colidiria com a imutabilidade de `notification_event` (`migration_006:1220-1231`).
16b. **Falta de destinatário válido nunca impede a ação** (decisão do mantenedor, 2026-08-10). Conta excluída, banida por sanção permanente ou nunca vinculada não recebe recibo, e a ação de mérito — inclusive moderação — conclui normalmente, com o evento registrando que não houve destinatário. Tratar ausência de destinatário como falha impediria moderar conteúdo de conta excluída, que é justamente o que mais precisa ser moderado.
16a. **Resposta a comentário legado não notifica ninguém, e nada é reconstruído se o autor reivindicar conta depois** (decisão do mantenedor, 2026-08-10). Comentário importado tem identidade separada, sem conta vinculada (requisito 9), então não há destinatário no momento da resposta — nenhum recibo pendente fica guardado à espera de vínculo. Se o autor legado vier a reivindicar a conta (fluxo de migração do glossário, D061), passa a receber apenas o que ocorrer **depois** do vínculo. Recibo retroativo despejaria de uma vez toda a conversa que ele perdeu, e obrigaria a guardar destinatário potencial para identidade que pode nunca ser reivindicada.
17. Existe **uma** central de notificações, acessível de qualquer módulo, mostrando eventos de todos.
17a. **A central é canônica no `accounts.`**, em `/conta/notificacoes` (decisão do mantenedor, 2026-07-27) — os módulos apontam para ela, sem cópia própria, para não haver três páginas divergindo. O deep-link precisa existir nas duas pontas: o fallback SPA serve hoje uma lista fixa de paths (`apps/accounts/src/app.ts:553` — `["/", "/login", "/conta", "/admin/papeis"]`) e o roteamento do frontend é `if/else` sobre `location.pathname`, sem react-router (`apps/accounts/frontend/src/main.tsx`). Notificação existe para ser clicada de fora, então `/conta/notificacoes` entra na lista e ganha seu ramo — sem trocar o roteamento do app de auth por causa disso.
17a-i. **Central e sino coexistem** (decisão do mantenedor, 2026-08-10). A central é a página completa; **cada app ganha sino no header** mostrando as próprias notificações, lendo da mesma fonte única. Aviso só na central tiraria a notificação de onde a ação acontece — quem aprova material no `downloads` não deveria precisar sair do módulo para saber disso. O sino é componente compartilhado (`packages/ui`), não cópia por app: três sinos divergentes seria o mesmo defeito que 17a evita nas páginas. **Aprovação nominal do mantenedor concedida em 2026-08-10**, na mesma decisão.
17b-i. **A central é separada por `realm`: beta nunca aparece em produção** (decisão do mantenedor, 2026-08-10). O usuário é o mesmo nos dois ambientes e o SSO é compartilhado, mas a central de produção mostra só eventos de produção, e a de beta só de beta — é o que o schema já impõe, com `realm` nas chaves únicas, nos índices e no FK composto (`migration_006:490,512,514`), e o que T0.6 exige em toda superfície. Consequência: **cada ambiente tem sua própria central**, servida pelo `accounts.` daquele ambiente; não existe uma central única mostrando os dois com rótulo. Misturar faria conteúdo de teste passar por real na tela de quem só usa o produto.
17c. **Lista única com filtro por módulo** (decisão do mantenedor, 2026-08-10). O default mostra tudo em ordem cronológica, cada item rotulado com a origem, e o usuário pode filtrar por módulo. Abas por módulo esconderiam notificação atrás de aba não aberta; lista sem filtro obrigaria quem usa um módulo só a garimpar entre eventos de outros.
17d. **Notificação lida permanece, sem prazo** (decisão do mantenedor, 2026-08-10). Nenhum expurgo automático, nenhuma expiração: o histórico continua acessível. É a paginação por cursor (19a) que sustenta isso — o custo de leitura não cresce com o tamanho da tabela. **Exceção única: aviso cujo alvo deixou de existir sai da lista** (17e), porque não leva a lugar nenhum.
17e. **Alvo removido tira o aviso social da lista; aviso de moderação nunca sai** (decisão do mantenedor, 2026-08-10). São dois casos que parecem um só:
- **Aviso social** — "Maria respondeu você", e Maria depois apaga a resposta. O item sai da central: notificação existe para levar a algum lugar, e sem alvo ela só ocupa espaço na lista. O evento **não é apagado** — `notification_event` é append-only por trigger (`migration_006:1220-1231`) —, some da leitura, e o histórico do sistema permanece íntegro.
- **Aviso de moderação** — "seu comentário foi removido". Aqui o alvo sumir é *o assunto* do aviso, não um acidente: é a prova do que aconteceu e a porta de entrada do recurso, cujo prazo de seis meses (requisito 27d) corre a partir dele. **Permanece na central em qualquer circunstância**, inclusive depois de o conteúdo ser expurgado. Aplicar a regra do aviso social aqui apagaria o registro de que alguém foi moderado — o mesmo efeito prático do shadow ban recusado como fora de escopo.
17f. **Aviso de moderação é único, e o prazo vive no detalhe** (decisão do mantenedor, 2026-08-10). A remoção notifica **uma vez**; a página de detalhe mostra quanto resta do prazo de recurso. Sem lembrete de proximidade do fim: repetir cobrança sobre assunto desagradável pesa mais do que ajuda, e o prazo está sempre disponível para quem abrir o item.
17g. **O que o aviso de moderação diz ao autor** (decisões do mantenedor, 2026-08-10):
- **Categoria mais texto escrito para ele; nota interna nunca.** O detalhe traz o motivo público (ex.: "Spam") e a explicação dirigida ao autor. A análise interna do moderador não vaza em nenhuma superfície — é o que já vale para o workspace de caso (requisito 27d). Só a categoria seria uniforme e barato, mas deixaria a pessoa recorrendo sem saber do quê; é a explicação concreta que torna o recurso de seis meses utilizável em vez de formal.
- **A decisão é institucional: o autor lê "a moderação", nunca o nome de quem decidiu.** A auditoria interna guarda o ator (requisito 27d), e a exposição pública transformaria voluntário de moderação em alvo de retaliação de quem acabou de ser moderado.
17k. **Recurso aceito avisa só o autor** (decisão do mantenedor, 2026-08-10). Comentário restaurado volta à thread sem notificar quem havia respondido nela: eles reencontram o conteúdo ao voltar, e avisar terceiros transformaria a reversão de um erro de moderação em evento público sobre a vida alheia. O resultado do recurso é privado do recorrente (decisão 47).
17h. **Quem denunciou recebe o desfecho, no mínimo possível** (decisão do mantenedor, 2026-08-10). "Sua denúncia foi analisada", sem dizer qual ação foi tomada nem contra quem — fecha o ciclo para quem se deu ao trabalho de denunciar, sem revelar decisão sobre outra pessoa nem transformar denúncia em instrumento de vigilância. Silêncio total faria a denúncia parecer descartada e desestimularia o uso; contar o desfecho exporia o denunciado a quem o denunciou.
17j. **Sanção avisa uma vez, com a data de fim** (decisão do mantenedor, 2026-08-10). Suspensão de comentar/postar notifica no início, dizendo até quando dura, e nada mais durante o período — nem lembrete, nem aviso de término. Coerente com 17f: a central não fica cutucando quem já foi punido. A suspensão nunca atinge leitura nem SSO (decisão 48), então o usuário segue navegando normalmente com a data em mãos.
17i. **Auto-retirada não notifica ninguém** (decisão do mantenedor, 2026-08-10). O autor apagar a própria fala é ação dele sobre conteúdo dele: não notifica o autor (requisito 16) e não notifica quem respondeu. Quem participava da thread descobre ao voltar nela, onde o placeholder já explica o que houve. Avisar terceiros de que alguém se retirou transformaria uma saída silenciosa em evento público, que é o oposto do que a retirada busca.
17b. **Atualização por polling curto ao focar a página**, mais invalidação após mutação. SSE e WebSocket ficam fora: ampliariam infraestrutura sem requisito que peça tempo real.
18. Notificação carrega link de volta ao contexto de origem, no módulo correto — construído a partir de `canonical_path` e de `realm`+`source_app` allowlisted, **nunca de URL inteira vinda do cliente** (requisito 5b).
19. Notificação tem estado de leitura, e marcar como lida vale em todos os módulos.
19a. **A API de notificação nasce completa:** lista paginada por cursor com ordem `(occurred_at, id)` e limite máximo; contagem de não lidas; marcar uma como lida; marcar todas até um instante; mutações idempotentes; ownership sempre extraído da sessão; **404 uniforme** para ID inexistente ou de outro usuário (senão a resposta revela que a notificação existe); cache privado, nunca compartilhado.
19b. **A ordem `(occurred_at, id)` é do evento e exige índice próprio.** O índice parcial existente (`migration_006:517-525`) ordena por `created_at` do **recibo**, não por `occurred_at` do **evento** — hoje as duas ordens praticamente coincidem, porque evento e recibo nascem na mesma transação (`apps/accounts/src/communityCommentWrite.ts:528`), mas divergem assim que entrar evento externo com `occurred_at` retroativo, que é justamente o que o outbox de 13c-i habilita. Paginar pelo recibo economizaria uma migration hoje e produziria ordenação errada depois; o índice novo entra junto da API.
19c. **Nenhum dos três sistemas atuais pagina** — `downloads` e `mesas` usam `limit 50` fixo, sem parâmetro de cursor ou offset (`apps/downloads/backend/src/routes/notifications.ts:18`, `apps/mesas/backend/src/routes/notifications.ts:23`), e o `accounts.` não tem rota de leitura. A paginação nasce na consolidação; não há comportamento legado a preservar aqui.
20. **Canal: in-app apenas.** E-mail e push ficam fora desta spec (decisão do mantenedor). A separação evento/recibo (13a) é o que permite ligar um canal depois sem migrar dado.
20a. **O usuário controla o que recebe, por tipo de evento, no perfil do `accounts.`** (decisão do mantenedor, 2026-08-10). A preferência vive junto da identidade, não em cada módulo — um só lugar, coerente com a central única de 17a. O eixo é o **tipo de evento** (resposta ao meu comentário, comentário no meu conteúdo, ...), não o módulo: quem quer silêncio quer silenciar um tipo de barulho, não um produto inteiro.
20b. **Aviso de moderação ignora a preferência e sempre chega.** Comentário removido, decisão de denúncia, resultado de recurso e sanção não são notificação social: são devido processo. A DSA exige que o autor saiba da decisão e do caminho de contestação (é o que sustenta a janela de seis meses do requisito 27d); notificação desligável transformaria remoção em remoção silenciosa, que é exatamente o shadow ban recusado como fora de escopo. A tela deixa explícito que esses avisos não se desligam.
20a-i. **Um item de preferência por tipo técnico de evento** (decisão do mantenedor, 2026-08-10). A tela lista cada `event_type` individualmente, não grupos temáticos — controle máximo, sem agregação que esconda um tipo dentro de outro. **Consequência assumida:** a lista cresce a cada tipo novo (hoje já são comentário raiz, resposta, moderação, denúncia, recurso, sanção, mais os cinco `kind` herdados do `downloads` — requisito 24e), e os nomes nascem do código, então cada tipo precisa de rótulo escrito para o usuário: `material_rejected` não pode chegar assim à tela. Registrar tipo novo passa a ter custo de produto, não só de schema — sem rótulo legível, a tela degrada sozinha.
20a-ii. **A preferência é única e vale nos dois `realm`** (decisão do mantenedor, 2026-08-10). Diferente da central (17b-i), que separa beta de produção, a configuração acompanha a identidade: ajustada uma vez, vale em todo lugar. Preferência por ambiente duplicaria a tela e exporia ao usuário comum um conceito — `realm` — que só existe para quem opera o produto.
20c. **Desligar impede o recibo, não o evento.** A ocorrência continua registrada em `notification_event` — histórico do sistema não depende de preferência de leitor —, mas nenhum `notification_receipt` nasce para quem desligou aquele tipo. Consequência assumida: religar passa a valer para eventos **novos**, e o período desligado não é reconstruído. A alternativa (gravar recibo oculto) faria religar despejar meses de acúmulo de uma vez; não gravar nada apagaria o rastro de que o evento existiu.

### Contrato e consumo

21. `packages/comments` fornece cliente e UI; a persistência é do `accounts.`, não do pacote.
    **Fornece também o contrato de autorização de assunto** (`CommentSubjectAuthorization` e a
    suíte de conformidade, T2.2, criados em 2026-08-05): esse export é consumido pelo **backend**
    de cada módulo, não pela UI, e por isso o export `.` é livre de React — só
    `@artificio/comments/react` carrega componente.
21a. **O transporte é injetado, não embutido.** O adapter cobre leitura/criação/resposta,
     edição, auto-retirada, voto, denúncia/retirada, recurso, moderação e notificações; cada
     fachada implementa as capacidades autorizadas do domínio. Chamada direta do navegador ao
     `accounts.` contradiria 6a e furaria validação de assunto/ownership.
21b. **Exports separados:** `@artificio/comments` (tipos, schemas, cliente), `@artificio/comments/react` (hooks e componentes), `@artificio/comments/styles.css`. Backend e o Astro server-side do `site` não podem ser obrigados a importar React. `react` e `react-dom` são `peerDependencies`.
21c. **TanStack Query não é obrigatório.** `downloads` e `mesas` o usam, o **`site` não** — o núcleo do cliente é agnóstico de framework, com adapter de React Query interno e opcional.
21d. **Estilo por tokens, não por Tailwind compilado dentro do pacote.** O consumidor pode não escanear as classes do workspace, e elas sumiriam em produção. Tokens CSS do design system, slots e `className`; apps customizam tokens, não a estrutura semântica.
22. Indisponibilidade do `accounts.` **degrada** a experiência, nunca derruba a página do módulo consumidor.
22a. **A resposta carrega estado explícito — `fresh`, `stale` ou `unavailable`.** Falha nunca
     vira "nenhum comentário". `packages/comments` conserva como `stale`, com idade e aviso,
     somente o último resultado da tela ainda montada. Recarregar, abrir outra página, logout ou
     troca de conta descarta esse estado; durante queda, a área mostra `unavailable`. Não há
     IndexedDB, localStorage, Redis nem cache público/Cloudflare nesta fase.
22b. **A chave de cache inclui identidade quando o dado é privado** (`realm`, `source_app`, subject, usuário). Comentário privado e notificação são limpos no logout e na troca de conta; notificação nunca entra em cache público.
22c. **Cliente com timeout e cancelamento**, no padrão já aprendido em `packages/catalog-client/src/index.ts:35` — `fetch` sem timeout pendura a rota do backend consumidor (achado de review, PR #145). Hooks consomem `AbortSignal`.
22d. **Degradação vale para resposta inválida, não só conexão recusada:** timeout, 500, HTML no lugar de JSON, JSON malformado e schema incompatível. O último é a regra pétrea de normalização — payload externo é `unknown` até passar por normalizador tipado.
23. Nenhum app acessa diretamente o banco do `accounts.` — só a API. **Isso inclui migração:** SQL do módulo não transfere dado para o banco central. A transferência é por export read-only na origem mais importador one-shot **pertencente ao `accounts.`**; a migration local só marca cutover e estado.
24. `downloads` migra `download_comment` e `download_notification` para o `accounts.`, preservando os dados.
24a. **O rollout é expand → backfill → catch-up → cutover**, com high-water mark, inserts idempotentes e reconciliação. "Copiar antes de parar de ler" perde tudo o que nascer entre a cópia e a troca. A tabela local vira read-only e é retida para rollback — apagá-la é ação posterior, nominal e com backup.
24b. **A validação é linha a linha, com critério declarado:** quantidade, IDs, hash dos campos normalizados, `created_at`, autoria, estado removido e lido, relações `parent`, e lista explícita de divergências.
24c. **A fachada preserva payload e status, não só os paths** — e os contract tests do comportamento antigo são escritos **antes** da troca, porque hoje não existe teste direto de `comments.ts` nem de `notifications.ts`, e `verify:api` não prova compatibilidade semântica.
24d. **Dois bugs do `downloads` são corrigidos junto** (decisão do mantenedor, 2026-07-27; segundo item **corrigido por medição em 2026-08-10**): `GET /api/v1/notifications` usa `writeRateLimiter` (`routes/notifications.ts:12`), fazendo leitura consumir cota de escrita. O segundo bug foi descrito ao contrário do que o código faz — ver 13c-i: as emissões de `moderation.ts` e `reports.ts` são **transacionais**, e é o acoplamento, não o best-effort, que quebra a moderação. A migração corrige a semântica real em vez de reproduzir qualquer uma das duas pontas.
24e. **Os cinco `kind` que o `downloads` já emite** — `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed`, `system_suggestion_resolved` (`services/notify.ts:12`) — têm o **corpo congelado como legado**: o texto já vem pronto no banco e entra como snapshot de versão própria, sem virar `kind` oficial do registro central nem ser reconstruído em estrutura que nunca existiu. **Superado em 2026-08-10 quanto ao destino:** a consolidação (13a-i) faz o `downloads` **parar** de emitir na tabela própria e passar a produzir evento no par consolidado; `download_notification` fica read-only e seu histórico é migrado. Não é só comentário que migra — os cinco `kind` migram como legado congelado, e a emissão nova de todos eles nasce no registro central.
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
| retirar comentário público | sim | sim | autor auto-retira só o próprio; demais usuários não | herdada | herdada na adoção | herdada na adoção | herdada para comentário público |
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

### Casamento de identidade

`accounts.` é a origem do papel global (requisito 4). O casamento de identidade existe para
preservar **ownership** local (termos, mesas, materiais, votos, comentários) quando a mesma pessoa
volta pelo SSO.

1. `downloads`: `download_creator.user_id` casa somente com `accounts.users.id` exato.
2. `mesas`: primeiro `users.google_id = accounts.users.id`; fallback por e-mail normalizado
   somente quando `google_id` é nulo ou já igual ao mesmo ID central
   (`backend/src/middleware/auth.ts`).
3. `glossario`: primeiro `users.sso_user_id = accounts.users.id`; fallback por e-mail
   normalizado somente quando `sso_user_id` é nulo ou já igual ao mesmo ID central
   (`auth/resolveLocalUser.ts`); sem match, provisiona conta local nova.
4. Dois critérios apontando para contas centrais diferentes, e-mail duplicado ou vínculo local
   ocupado por outro ID: o vínculo **não** é feito. A conta segue sem privilégio local herdado,
   e o papel global continua vindo do `accounts.` normalmente — identidade ambígua nunca
   concede autoridade.
5. Duplicidade de conta no `accounts.` é higiene de identidade, com spec própria: não é resolvida
   aqui e não bloqueia esta fase.

### Trust boundary e credenciais

Cada backend consumidor recebe token próprio, aleatório de no mínimo 256 bits, mantido **só no
`.env` da VM** (`/opt/artificio/apps/<mod>/.env` e `/opt/artificio-beta/apps/<mod>/.env.beta`,
permissão `600`) e interpolado pelo `docker compose`; nunca por arquivo versionado. **Não passa
por secret do GitHub Actions** — verificado em 2026-08-04 e reconfirmado em 2026-08-07:
`SERVICE_CREDENTIAL` não aparece em nenhum workflow. A consequência operacional é o motivo de a
frase existir: acrescentar a chave ao cofre do Actions **não** a leva para a VM, e quem distribui
esses valores é o mantenedor, manualmente (`docs/agents/github-actions-secrets.md`).

`accounts.` mantém registro allowlisted `token -> source_app + realms + operações`, compara em
tempo constante e rejeita token ausente, desconhecido, fora do realm ou tentando afirmar outro
`source_app`. Rotação usa janela curta `current` + `next`: publica `next` no `accounts.`, troca
consumidor, confirma tráfego, revoga `current`. Logs guardam só identificador da credencial,
nunca o segredo. Desde 2026-08-07 (T2.2a-op, passo 6) a credencial registrada é o **único**
mecanismo aceito: o `SERVICE_SECRET` global e seu fallback foram removidos do código.

Frontend fala somente com fachada same-origin. Backend valida sessão, existência, visibilidade,
estado comentável e ownership do objeto; então chama `accounts.` com `X-Service-Token`,
`X-Acting-User-Id`, correlation ID e chave de idempotência. `accounts.` nunca aceita do browser
`owner_user_id`, papel, origem completa ou autorização por objeto. Escrita direta sem credencial
de serviço retorna 401; escopo incompatível retorna 403.

### Referência opaca, URL e corpo

- Chave: `(realm, source_app, subject_type, subject_id)`, com `realm in ('beta','prod')`,
  `source_app in ('downloads','site','mesas')`, `subject_type` namespaced e `subject_id` textual.
- Limites: `source_app` 32, `subject_type` 64, `subject_id` 255, `canonical_path` 1024,
  `body_markdown` 10.000, detalhe de denúncia 4.000, `removed_reason` 500 e chave de
  idempotência 8–128 caracteres ASCII.
- `canonical_path` começa por `/`, não contém scheme, host, barra invertida nem credencial. A
  origem é resolvida no servidor por `(realm, source_app)` allowlisted.
- Comentário novo usa `body_markdown` canônico pelo perfil compartilhado de comentários;
  entrada e saída canônica respeitam 10.000 caracteres e precisam produzir texto visível.
  Legado usa `legacy_content_html` separado, política de sanitização versionada e defesa
  adicional na saída sem regravar.
- Raiz tem `depth=0`; respostas vão até `depth=4`. Pai, assunto, realm, app e estado são
  validados na mesma transação. Legado pode ser pai, mas não pode ser editado nem votado.
- Alvo removido bloqueia escrita na fachada e preserva leitura autorizada. Mudança de slug não
  altera identidade: backend envia caminho atual nas novas operações e mantém redirect do
  caminho anterior. Eventos históricos permanecem imutáveis.
- Comentário e tombstone são retidos sem prazo nesta spec. Isso não prolonga o vínculo nominal,
  que segue 7b. Exclusão física do conteúdo exige decisão, migration e backup próprios.

### Contrato HTTP v1

Rotas internas exigem credencial por app; rotas da central exigem sessão SSO. Fachadas dos
módulos preservam seus contratos públicos atuais.

| Método e rota | Contrato |
|---|---|
| `GET /internal/v1/comments` | árvore por chave opaca e sort; cap 1.000/2 MiB; `more` com cursor da revisão |
| `POST /internal/v1/comments` | cria raiz; exige `Idempotency-Key`; ator vem do backend |
| `POST /internal/v1/comments/:id/replies` | cria resposta na mesma transação do evento e recibos |
| `PUT /internal/v1/comments/:id/vote` | estado absoluto `-1\|0\|1`; mesmo estado é no-op; terceiro autenticado |
| `POST /internal/v1/comments/:id/removal` | tombstone; exige `admin`/`moderator` central comprovado |
| `DELETE /api/account` | rota existente; confirmação atual permanece; aplica exclusão, retenção, bloqueio de recadastro e aviso de 7b–7c; sucesso continua `204` |
| `POST /internal/v1/comments/:id/restore` | desfaz tombstone; exige `admin`/`moderator`; registra quem restaurou |
| `GET /internal/v1/comments/moderation-queue` | fila de moderação; filtro por `realm`, `source_app`, estado; cursor |
| `GET /internal/v1/comments/moderation-log` | histórico de ações de moderação; cursor |

**Rotas de notificação ficam na Fase 3** (decisão 1 do grilling). `GET /api/v1/notifications`,
`/unread-count`, `PUT /:id/read` e `/read-through` constavam desta tabela antes do grilling e
foram movidas: a Fase 2 entrega somente o **núcleo transacional** — `notification_event`,
`notification_receipt` e a geração atômica dos recibos junto do comentário. O contrato dessas
quatro rotas está **reservado** em `contrato-http-v1.md` §12 (cursor `(occurred_at, id)`, padrão
20 e máximo 100, ownership sempre da sessão, `404` uniforme, `private, no-store`), para a Fase 3
implementar sem divergir do formato. Requisito 19a descreve esse contrato; a decisão 1 fixa a
fase.

O contrato completo — incluindo edição/auto-retirada, denúncia, caso, recurso, sanção e
invalidação de voto — está em `contrato-http-v1.md`. Todos os fluxos usam o namespace interno
único; não existem endpoints locais divergentes por app.

**Materializado em `contrato-http-v1.md` (T2.2b, 2026-08-05).** A tabela acima é o resumo; o
documento é a fonte para implementação — método, path, escopo, headers, corpo, invariantes
transacionais, códigos e campos públicos versus moderação de cada fluxo, incluindo edição,
auto-retirada, denúncia, caso, recurso, sanção e invalidação de voto.

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

Comentários formam árvore ordenada entre irmãos por `best`, `top`, `new` ou `old`; `best` é o
padrão. Cursor opaco assinado fixa assunto, sort, `snapshot_revision`, ramo, chave de ordenação,
limite e validade de 30 minutos; cursor de outra consulta retorna 400. Criação/resposta e demais
escritas não idempotentes exigem `Idempotency-Key`; voto usa estado absoluto e retry idêntico é
no-op, sem chave. Repetição com mesmo payload devolve a resposta original; payload diferente
retorna 409; retenção da chave é 24 horas. **O armazenamento é `community_idempotency_key`**
(`migration_008`, criada na PR #246): a unicidade de `(realm, source_app, operation,
idempotency_key)` **é** o mecanismo — o handler insere primeiro e desempata pelo `ON CONFLICT`,
nunca consulta-antes-insere, que é o check-before-transaction do `downloads` que esta spec manda
não replicar. Guarda hash SHA-256 do payload, não o corpo: reter `body_markdown` por 24h ampliaria
a superfície de conteúdo hostil sem ganho, porque a comparação só distingue igual de diferente.

Códigos: 400 contrato/cursor, 401 sessão ou serviço ausente, 403 escopo/papel, 404 alvo ou recibo
inexistente (uniforme), 409 idempotência ou estado concorrente, 422 thread/corpo, 429 limite e
503 dependência indisponível. Respostas usam `{ error: { code, correlation_id } }`, sem detalhe
de existência ou autorização.

Cache: notificações e escritas são `private, no-store`; leitura interna admite ETag sem cache
persistente de UGC. `fresh`/`stale` existe somente no estado da tela montada; reload/logout/troca
de conta descarta. Não há IndexedDB, localStorage, Redis nem edge cache nesta fase.

Rate limiting separado: autenticação, leitura, criação/resposta, edição, voto, denúncia e recurso
usam buckets independentes. Fachada chaveia por IP real validado e usuário; `accounts.` por usuário
e credencial do app. IP bruto não é coluna, payload nem auditoria do domínio comunitário; sua chave
efêmera some com o TTL do limiter na fachada. Valores são configuração calibrada depois da medição
do proxy, sem bloquear a implementação; comentário nunca consome cota de autenticação.

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
- Todos os `N_source` legados do `site`, recontados no cutover, aparecem marcados como
  antigos/importados, sem edição nem voto, mas aceitam resposta nova autenticada.
- Com o `accounts.` indisponível, a página do módulo carrega com aviso — não quebra.
- Payload hostil é neutralizado: comentário novo passa pelo perfil Markdown compartilhado,
  recusa link inválido e nunca renderiza HTML/imagem remota; HTML legado passa por sanitização
  única na entrada, testada contra script, links, SVG/MathML e atributos.
- Resposta além de `depth=4` é rejeitada, assim como pai em outro assunto ou `realm`; resposta a
  legado é aceita e recebe profundidade correta.
- Os quatro sorts preservam hierarquia; navegação com `more` na mesma revisão não duplica, perde
  nem orfana comentário; cursor expira em 30 minutos.
- Autor não vota no próprio comentário; terceiro troca/remove voto sem duplicar efeito; Wilson
  vem da função PostgreSQL versionada e bate com vetores de referência.
- Autor edita e auto-retira; edição preserva votos; tombstone preserva filhos; somente moderação
  restaura e ninguém da moderação reescreve a fala alheia.
- Quatro denúncias não ocultam; a quinta conta distinta oculta sem quebrar a árvore. Decisão
  concorrente de caso tem um vencedor, auditoria e notificações mínimas aos dois lados.
- Versão aprovada resiste a nova brigada; edição cria versão denunciável; recurso do autor respeita
  a janela de seis meses; sanção comunitária não bloqueia login nem uso não comunitário.
- **Papel revogado no banco deixa de valer na sessão ativa dentro do SLA declarado**, provado por teste de promoção e de revogação. Sem isso o `accounts.` não é fonte de verdade.
- **Ação moderadora com o `accounts.` indisponível falha fechada**, enquanto a leitura pública de comentário continua servindo.
- **Dono forjado no payload é ignorado**: o badge de autor sai do que o backend do domínio afirma, não do que o cliente envia.
- **Escrita direta do navegador no `accounts.` é recusada** — só o backend do módulo escreve, com credencial própria.
- **Comentário criado em beta não aparece em prod**, e o mesmo `subject_id` em apps diferentes não colide.
- **Paginação não duplica nem perde item** entre páginas, sob inserção concorrente.
- **Carga de leitura de comentário não consome a cota de autenticação** — limiters separados, provado por teste.
- **Auto-retirada preserva os filhos** e é irreversível para o autor; terceiro recebe 403; somente
  moderação restaura com auditoria.
- **Exclusão de conta preserva conversa e score sem PII eterna:** perfil vira “Conta excluída”,
  vínculo sem caso some no mesmo ciclo, vínculo de caso/recurso expira seis meses após decisão
  final, `legal_hold` suspende, e o executor remove vencidos. Recadastro voluntário é bloqueado por
  seis meses; sanção mantém somente identificador mínimo enquanto durar.
- **IP não entra no domínio comunitário:** nenhum schema/payload/auditoria guarda IP; a fachada usa
  chave efêmera pelo TTL, e `accounts.` limita por usuário+credencial. Smoke mascarado prova o IP
  real do ingress antes do uso integral.
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
- **Reações/curtidas além do voto ternário** definido em 8b.
- `Hot`, controversos, random, Q&A e live; os quatro sorts aceitos estão em 8c.
- Upload, hospedagem, proxy ou preview automático de imagem em comentário.
- `@menções` e resolução de conta por nome/e-mail.
- **Comentário anônimo novo** — legado é read-only; escrita exige SSO.
- **Página pública de perfil.**
- **Aferição de idade e adequação específica ao ECA Digital.** Decisão do mantenedor em 2026-08-04:
  trabalho posterior, antes do uso integral da comunidade; não bloqueia a implementação completa da
  Fase 2 em pré-lançamento e não deve ser apresentado como já entregue.
- **Eventos de domínio não ligados ao ciclo do comentário** (ex.: publicação de material). A
  Fase 2 gera os eventos necessários para criação/resposta, auto-hide, remoção/restauração,
  decisão de denúncia e recurso. **Não confundir com o histórico existente:** notificações do
  `downloads` sobre aprovação, rejeição e denúncia de material migram como legado read-only, sem
  virar `kind` ativo do registro central.

## Riscos e impacto em outros módulos

> ⚠️ **Esta é a mudança mais invasiva do projeto até aqui.** `accounts.` é sagrado
> (`AGENTS.md`): mudança de código lá exige **aprovação + SDD Completo + smoke de todos os apps
> que consomem SSO**. Nunca quebrar a sessão compartilhada.

- **Ponto único de falha novo.** Hoje uma queda do `accounts.` impede login; depois desta spec,
  também deixa os três módulos sem comentários e sem notificações. Daí o requisito 22:
  degradar com aviso, nunca quebrar a página.
- **Papel global centraliza o blast radius.** Papel errado no `accounts.` tira acesso de
  moderação em todos os projetos. Bootstrap, painel auditado, refresh reidratado e rollback de
  papel precisam continuar comprovados; não existe fallback local.
- **Dado real medido.** `downloads` tinha zero comentários/notificações em beta e prod na medição
  de 2026-08-04; `site` tinha 25 comentários em produção. Ambos são remedidos e recebem `pg_dump`
  antes do cutover; contagem histórica não é autorização para pular guarda.
- **Dado cruza fronteira de banco.** Comentário sai do banco do app e vai para o do `accounts.`
  Isso inverte a regra de isolamento do monorepo — deliberadamente, para viabilizar agregação —
  mas significa que o `accounts.` passa a guardar conteúdo de usuário, não só identidade.
- **`mesas` ganha superfície pública nova.** Comentário em mesa é conteúdo de usuário exposto:
  herda sanitização e moderação, e amplia o que precisa ser moderado.
- **A spec 089 depende desta** para os requisitos 18-22 e 32-35. Enquanto a 090 não fechar,
  aquela parte fica em aberto — dependência declarada, não débito esquecido.
- **Ordem de adoção importa.** `downloads` tem a necessidade imediata; `site` tem o dado mais
  delicado; `mesas` não tem nada a preservar.

---

## Apêndice: Decisões do Grilling (2026-08-04)

55 decisões de produto fechadas antes da implementação. Cada decisão está aplicada nos
requisitos 1-28 e no `contrato-http-v1.md`. Lista condensada para referência de implementação.

**Notificações e arquitetura:**
1. Fase 2 absorve núcleo transacional de notificações: `notification_event`, `notification_receipt`, recibos e dedup na mesma transação do comentário. Central, polling e API pública ficam na Fase 3.
2. Contrato `CommentSubjectAuthorization` — alvo existente, visível, comentável, `ownerUserId`, `canonicalPath` — validado pelo backend do domínio antes de chamar o `accounts.`.

**Árvore e navegação:**
3. Árvore inteira no volume normal; 5 níveis visuais (`depth<=4`); `root_id` obrigatório; cap 1.000/2 MiB com `more`, nunca filho órfão.
8. Ranking versionado por assunto; cursor stateless assinado HMAC-SHA256, TTL 30 min; `snapshot_revision` congela posição na navegação.
16. IDs públicos UUID v4; `BIGINT` proibido; sem UUID v7/ULID.

**Voto e score:**
4. Votos e score entram na Fase 2 — comportamento Reddit.
5. Só terceiro vota; autor não; comentário novo nasce score 0.
6. Legado não aceita voto; score 0 permanente.
7. Quatro sorts: Melhores (Wilson 80% unilateral, padrão), Mais votados, Recentes, Mais antigos. Entre irmãos, nunca mistura níveis. `created_at`+`id` desempatam.
9. Score público imediato — sem janela de ocultação.
10. Resposta pública: `upvotes`, `downvotes`, `score`; autenticado vê `my_vote`. Moderação vê identidade dos votantes e histórico.
11. Conta nova vota com mesmo peso, sem quarentena.
12. Voto: `PUT` estado absoluto `-1|0|1`; mesmo valor é no-op; última gravação vence; sem `Idempotency-Key`.
13. Voto não gera notificação.
14. Desativação comum preserva votos/score mas bloqueia voto novo. Abuso permite invalidação pelo moderador com recálculo de ranking; histórico bruto permanece.
19. Wilson: `z=1.281551565545` (80%), sem decaimento temporal, `algorithm_version='reddit-wilson-80-v1'`. PostgreSQL é fonte canônica: função `IMMUTABLE`, `numeric`, coluna gerada. TypeScript não duplica fórmula.
21. `score = upvotes - downvotes` como coluna gerada; `best_score` por função SQL imutável.

**Edição e identidade:**
17. Autor edita e retira o próprio; edição sem prazo, preserva votos; auto-retirada via tombstone irreversível para o autor. Revoga D111 item 6.
18. Edição preserva votos e ranking. Marcador público `edited_at`; bait-and-switch tratado por histórico da moderação.
20. Edição: só `body_markdown`; pai, assunto, autoria e `created_at` imutáveis. Idêntica é no-op.
22. Moderação nunca edita texto alheio — só retira ou restaura.

**Legado:**
23. Legado imutável mas responde: pode ser pai de comentário novo. Antigo descreve proveniência, não congela conversa.

**Markdown e links:**
24. Comentário novo usa `@artificio/content-editor`: `sanitizeUserMarkdown` na escrita; consumidores via `MarkdownContent`/`renderMarkdown`; HTML desabilitado, DOMPurify na defesa final. Campo `body_markdown`.
25. Máximo 10.000 caracteres; validado na entrada e na saída canônica. Excesso rejeita, nunca trunca.
26. Imagem só como referência HTTPS clicável: `![alt](url)` vira link textual, sem `<img>` nem fetch server-side.
27. Links HTTPS-only; sem esquema canonicaliza; `http:` rejeitado. Host da suíte vs externo por `URL` estrutural; externo ganha `noopener noreferrer`.
28. Link root-relative (`/rota`) pertence ao `source_app`; `//host`, `../` e relativo ambíguo rejeitados.
29. Link proibido falha com `INVALID_COMMENT_LINK` + posição + regra, sem ecoar payload hostil. Markdown malformado permanece texto. Política única em `@artificio/content-editor/comment-links`.
30. Comentário precisa produzir texto visível após `markdownToPlainText`; sem mínimo arbitrário além de não-vazio.
31. Sem `@menções` nesta fase; `@texto` é literal.

**Denúncia:**
32. Denúncia entra no núcleo da Fase 2: persistência, API interna, fila compartilhada, resolução e auditoria no `accounts.`.
33. Exige conta, terceiro e unicidade: 1 ativa por ator/comentário. Identidade do denunciante visível só a `moderator`/`admin`.
34. Limiar: 5 contas distintas → `pending_review_hidden` (placeholder público, corpo e score somem). Não é tombstone nem decisão de moderador.
35. Fluxo maduro do `downloads` sobe ao compartilhado; domínio específico fica no adaptador.
36. Três defeitos do `downloads` corrigidos na adoção: rate limiter de leitura, concorrência na decisão terminal, auditoria.
37. Motivos em registro compartilhado: `malicious_link`, `inappropriate_content`, `spam_or_off_topic`, `harassment_or_hate`, `personal_data`, `copyright_violation`, `illegal_content`, `other`.
38. Prioridade (P0–P2) ordena fila mas nunca oculta/decide sozinha. Moderador reclassifica com auditoria.
39. Denúncia fixa `reported_version_id` atômico; edição posterior não altera evidência. Versão referenciada sem purga automática.

**Moderação:**
40. Caso episódico: 1 aberto por comentário; denúncias são linhas individuais imutáveis. Caso novo após encerramento.
41. Editar não revela comentário auto-oculto; só moderação restaura.
42. Denunciante retira só antes do auto-hide. Transição serializada com lock.
43. Veredito individual por denúncia (`upheld`/`dismissed`/`no_determination`); ação única por caso (`no_change`/`restore`/`remove`). Mesma transação.
44. Resultado privado e mínimo: denunciante recebe `action_taken`/`not_upheld`/`no_determination` do próprio veredito; autor recebe auto-hide/remoção/restauração.
45. Versão aprovada imune a reabertura automática; denúncia posterior vira `no_determination`. Edição cria versão nova, denunciável.
46. Auto-retirada com caso aberto não encerra moderação; `no_change` preserva tombstone.

**Recurso e sanção:**
47. Recurso: autor, 6 meses, uma vez por decisão de remoção. Sem exigência de segundo moderador.
48. Sanção comunitária: `posting`/`commenting`, `warning` → suspensão temporária → permanente. Separada do SSO; nunca automática.
49. Detalhe da denúncia: `required|optional|forbidden` por motivo; ≤4.000 caracteres; imutável; restrito à moderação.

**Segurança e infra:**
50. Rate limiting: buckets independentes por camada (fachada: IP+usuário; `accounts.`: usuário+credencial), identidade e ação. IP nunca entra no schema comunitário.
51. Sem cache persistente: estado `stale` em memória da tela montada; reload durante queda mostra `unavailable`.
54. IP na fachada só durante TTL do limiter; nunca no schema, payload ou auditoria.

**Jurídico e ciclo de vida:**
52. Controlador: Paulo Henrique Mota Lima (pessoa física), `artificiorpg@gmail.com`. Projeto gratuito, Brasil.
53. Exclusão: identidade pública neutralizada; vínculo ator→conta desfeito em 6 meses (ou com caso/recurso + 6 meses). Comentários viram "Conta excluída"; votos/score permanecem. Bloqueio de recadastro 6 meses. Revoga retenção permanente da decisão 15.
55. Fase 2 em pré-lançamento; adequação ao ECA Digital é trabalho posterior.
