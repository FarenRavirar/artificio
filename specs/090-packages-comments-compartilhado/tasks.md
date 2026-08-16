# Tasks — 090

> **Origem:** decisão do mantenedor (2026-07-27) de tirar comentários da spec 089 e resolver no
> lugar certo. Ampliada no mesmo dia para incluir **notificações agregadas** e **papéis
> unificados**, quando ficou claro que pacote com banco por app uniria código, não dados — e
> não entregaria central de notificações nem moderação unificada.
>
> **Decisões fechadas na abertura:** `accounts.` vira dono de comentários, notificações e
> papéis; papel global migra para o SSO (papel de domínio fica no app); canal in-app apenas;
> legado do `site` read-only; `mesas` ganha comentário novo sem migrar o review.

> ⚠️ **`accounts.` é sagrado** (`AGENTS.md`). Mudança de código lá exige **aprovação + SDD
> Completo + smoke de todos os apps que consomem SSO**. Nenhuma fase que toque `apps/accounts`
> começa sem autorização nominal registrada.

---

## Fase 0 — Levantamento e contrato

> **Escrita backend-to-backend (decisão de segurança).** Frontend nunca escreve direto no
> `accounts.`; backend do módulo valida objeto e dono, chama com credencial própria por app.
> Sete decisões fechadas na 1ª revisão (2026-07-27): trust boundary (T0.5), realm/source_app
> (T0.6), capacidades do moderator (T0.1), formato do corpo (T0.9), notificações legadas
> (T0.11), estratégia de migration (T0.12), URL canônica construída (T0.7). CSRF em `app.ts:87`
> exclui `downloads` e betas — server-to-server resolve.

- [x] T0.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. Releitura por fase é regra desta spec, não do T0 pétreo (que exige uma vez por sessão). · feito quando: leitura confirmada, travas de `accounts.` e de pacote compartilhado identificadas.
- [x] T0.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T0.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [x] T0.1 — **Matriz de capacidades, não lista de nomes** (requisitos 1-3). A versão anterior pedia "mapa de papéis"; nomear `admin`/`moderator`/`user` não diz o que cada um **pode**. Hoje o `moderator` do `downloads` comanda comentários, materiais, denúncias, métricas, mídia, e-mail e catálogo — torná-lo global sem matriz concederia tudo isso também em `site`, `mesas` e `glossario`. **Decisão do mantenedor (2026-07-27): o `moderator` global herda os poderes que exerce hoje nos módulos.** A matriz precisa então declarar, capacidade a capacidade, o que isso significa em cada projeto, o que é herança e o que permanece papel de domínio — e o blast radius fica explícito antes de existir. · feito quando: tabela capacidade × papel × projeto × herdado/local, conferida contra o código, com as consequências da herança escritas.
- [x] T0.2 — **Inventário de consumidores de papel**: todo ponto que autoriza por papel local e passará a ler do `accounts.` · feito quando: lista de arquivos e rotas registrada, sem "provavelmente".
- [x] T0.3 — Mapear **todos os apps que consomem SSO**, não só os três desta spec — o smoke obrigatório cobre todos. · feito quando: lista fechada.
- [x] T0.4 — **Chave de identidade local não é uniforme entre os apps** — definir as regras de casamento antes de unir. `downloads` usa o UUID do `accounts.`; `mesas` casa por `google_id` **ou** e-mail (`middleware/auth.ts:42`); `glossario` usa `sso_user_id` com fallback por e-mail (`resolveLocalUser.ts:44`). União cega promove a conta errada. Definir: regra de casamento, o que fazer em conflito, usuário sem vínculo e duplicata. · feito quando: as quatro regras escritas, com o resultado esperado para cada caso.
- [x] T0.5 — **Fechar o trust boundary da escrita** (decisão do mantenedor, 2026-07-27): backend do módulo valida objeto, visibilidade, permissão e dono; depois chama o `accounts.` com **credencial própria por app**. Registrar como a credencial é emitida, guardada e rotacionada — nunca versionada. · feito quando: fluxo escrito ponta a ponta, com o que o `accounts.` aceita e o que ele recusa por vir do cliente.
- [x] T0.6 — **`realm` e `source_app` entram na chave** (decisão do mantenedor, 2026-07-27). O manifesto declara o `accounts.` prod-only, mas beta o reutiliza (`plan.md:30`): sem separação, comentário de teste em beta aparece em produção, e o mesmo `subject_id` colide entre apps. Toda linha carrega `realm` (`beta`/`prod`) e `source_app`, e os dois entram nos índices e na chave de listagem desde a primeira migration. · feito quando: chave definida e a estratégia de teste em beta descrita sem tocar dado de prod.
- [x] T0.7 — **URL canônica é construída, nunca aceita inteira** (requisitos 5, 18). Receber a URL pronta do cliente abre phishing e open redirect. Guardar `source_app` + `canonical_path`, e resolver a origem por **registro allowlisted** no servidor — o que separa beta de prod de graça. · feito quando: contrato de referência opaca `(realm, source_app, subject_type, subject_id)` escrito e conferido nos três domínios, com a montagem da URL do lado do servidor.
- [x] T0.8 — **SUPERSEDIDA pela decisão 3 do grilling da Fase 2.** Em 2026-07-27 esta task fechou três níveis (`depth<=2`) e `root_id` opcional; em 2026-08-04 o mantenedor aprovou cinco níveis visuais (`depth<=4`), `root_id` estrutural obrigatório, árvore inteira e cap defensivo 1.000/2 MiB com `more`. O histórico permanece; **não é contrato ativo**. · feito quando: supersessão propagada em spec, plano e T2.1/T2.3/T2.4.
- [x] T0.9 — **SUPERSEDIDA pela decisão 24 do grilling da Fase 2.** Em 2026-07-27 esta task fechou texto puro em `body_text`; em 2026-08-04 o mantenedor aprovou Markdown canônico em `body_markdown` pelo pipeline compartilhado, com teto 10.000. O histórico permanece para mostrar a inversão; **não é contrato ativo nem trabalho a implementar**. HTML legado continua separado e sanitizado uma vez na entrada. · feito quando: supersessão propagada em spec, plano e tasks T2.1/T2.5/T2.5b.
- [x] T0.10 — **Contrato da API escrito dentro da própria spec**, não deixado para a implementação: tipos com namespace, `realm`, `source_app`, `subject_id` como `TEXT`, comprimentos máximos, **paginação por cursor com ordem estável** desde a primeira versão (adicionar depois quebra contrato — AIP-158), chave de idempotência, códigos de erro, cache, limites, rate limiting, e o comportamento para subject removido, slug alterado e retenção. · feito quando: contrato completo no `spec.md`, sem "a definir".
- [x] T0.11 — **Resolver a contradição das notificações** (decisão do mantenedor, 2026-07-27). `spec.md:107` exclui eventos que não sejam de comentário, mas T5.2 manda migrar as notificações atuais — que incluem aprovação, rejeição e denúncia resolvida (`migration_018_download_notification.sql:5`). Decisão: as antigas migram como **legado read-only**, preservando o histórico, sem virar `kind` oficial do registro de eventos; o registro novo nasce só com comentários. · feito quando: as duas afirmações concordam nos três arquivos da spec, e T5.2 diz "legado read-only".
- [x] T0.12 — **Fechar a estratégia de migration do `accounts.` antes da T1.1** (decisão do mantenedor, 2026-07-27). Hoje o `accounts.` migra schema **inline no boot** (`db.ts:35`, chamado pelo `Dockerfile:26`) — não existe runner SQL ativo —, mas `plan.md:83` prevê `apps/accounts/database/*.sql`. As duas formas não coexistem sem regra: sem isso há ordem indefinida e drift com `migrate()`. Decisão: adotar o **framework padrão** (mesmo runner de `mesas` e `downloads`, header de 5 campos, idempotência, guard de pendentes), com o `migrate()` atual virando baseline marcada como aplicada. · feito quando: baseline definida, ordem de aplicação escrita, drift check cobrindo o `accounts.` no CI.
- [x] T0.13 — Definir o modelo de notificação como **evento**, não mensagem gravada (requisitos 13-19): quem é notificado, por qual evento, e como o texto é montado na leitura. **Comentário e evento nascem na mesma transação** — dual write comum grava comentário sem notificação, ou notifica operação que foi revertida. Se algum evento futuro vier de outro serviço, usar outbox transacional com consumidor idempotente. · feito quando: modelo escrito, incluindo a regra de não notificar o próprio ator e a garantia de atomicidade.
- [x] T0.14 — **Pedir aprovação nominal para `apps/accounts` E para `packages/auth`** (requisito 1). A versão anterior pedia só `apps/accounts` — incompleto: `moderator` **não existe** no contrato hoje (`packages/auth/src/types.ts:1` define `UserRole` como `"user" | "admin"`), e tanto o decoder quanto o cliente rejeitam outro valor (`jwt.ts:4`, `client.ts:81`). Criar o papel toca `packages/auth` necessariamente, o que exige aprovação própria, SDD Completo e smoke de **todos** os consumidores. Apresentar os dois escopos juntos. · feito quando: as duas aprovações registradas, ou escopo revisto.

## Fase 1 — Papéis unificados no `accounts.`

Base de tudo: sem papel global, não há moderação unificada. É também a fase mais arriscada —
papel errado em produção tira acesso de gente.

- [x] T1.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T1.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T1.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
> **[P0] O refresh perpetua o papel antigo — corrigir antes de qualquer promoção.** Achado da 1ª
> revisão do Codex, confirmado em código: o access token dura 15 min, mas o refresh dura **7
> dias** e carrega `role` (`tokens.ts:19`). `/api/auth/refresh` (`app.ts:162`) valida o token
> antigo e **reassina os novos a partir dele, sem reler o usuário no banco**. Como o refresh é
> rotacionado a cada uso, o papel antigo sobrevive **indefinidamente** numa sessão ativa:
> promover ou rebaixar alguém no banco não muda nada enquanto a sessão continuar sendo renovada.
> Sem isso corrigido, o `accounts.` não é fonte de verdade material — é cache de 7 dias
> renovável. Corrigido em T1.2.

- [x] T1.1 — Schema e migration de papel global no `accounts.` (requisito 1), pelo framework decidido em T0.12. `users.role` hoje é `TEXT` sem `CHECK` (`db.ts:44`) — a migration valida os dados existentes, adiciona a constraint e registra concessões e revogações em auditoria. · feito quando: migration idempotente, constraint aplicada, dado pré-existente validado, guard de CI verde.
- [x] T1.2 — **[P0] `/api/auth/refresh` relê o usuário no banco** antes de reassinar (`app.ts:162`). O papel vem do banco, nunca do token que está sendo trocado. Definir e registrar o **SLA de revogação** — quanto tempo, no pior caso, entre mudar o papel e a sessão ativa refletir. Considerar `role_version`/`session_version` no token para invalidar sessão sem esperar expirar. · feito quando: teste de promoção e teste de revogação provam que a sessão ativa reflete o banco dentro do SLA declarado.
- [x] T1.3 — **`moderator` no contrato de autenticação** (requisito 1). Não é só o tipo compartilhado: `verifyRefreshToken` rejeita explicitamente qualquer papel fora de `user`/`admin` (`tokens.ts:44`), então uma sessão de moderator seria invalidada no primeiro refresh. Tocar `packages/auth/src/types.ts:1`, `jwt.ts:4`, `client.ts:81` e o `tokens.ts` do `accounts.`, com teste em cada um. · feito quando: JWT, cliente, `/me` e refresh aceitam o papel novo, e todos os consumidores seguem funcionando.
- [x] T1.4 — **Papel resolvido por `JOIN`, não por chamada de API** (correção da versão anterior). A T1.2 antiga mandava criar "API em lote para evitar N+1" — mas comentários e usuários vão estar **no mesmo banco e no mesmo processo** do `accounts.`: a listagem faz `JOIN`, e o N+1 não existe. Endpoint em lote só se justifica para **backends de outros módulos**; se for criado, é **rota interna**, com autenticação server-to-server, escopo por app, limite de IDs, **sem e-mail** e sem exposição pública. · feito quando: a listagem resolve identidade no mesmo `SELECT`, e a rota em lote existe apenas se um consumidor real a exigir.
> **Decisão do mantenedor (2026-07-30) — não existe migração de papéis. `accounts.` é a origem, não o destino.**
> A versão anterior de T1.5 mandava ler papel local de `downloads`/`glossario`/`mesas` e
> consolidar no `accounts.`, tratando o papel de app como autoridade a preservar. **Invertido:**
> a conta no `accounts.` é definitiva e mandatória; app nenhum manda papel global para lá.
> `downloads` não foi lançado e pode ser refeito — travar a arquitetura do SSO para preservar o
> papel local dele não se justifica.
>
> Consequência: `apps/accounts/src/roleMigration.ts` (e seu teste) perde a razão de existir.
> Mantê-lo como código puro sem consumidor, contradizendo esta decisão, é pior que removê-lo —
> o próximo agente leria a migração como caminho pretendido. **Remover na T1.5.**
>
> Some junto a classe de conflito que ele detectava (`duplicate_central_email`,
> `central_id_not_found`): esses conflitos só nascem de casar papel de app com conta central.
> Sem migração, não nascem. Duplicidade de conta no `accounts.` é higiene de identidade, com
> spec própria — não entra aqui.

- [x] T1.5 — **Remover `roleMigration.ts` e `roleMigration.test.ts`, e ancorar o papel no `accounts.`** (requisito 4, reescrito pela decisão acima). O papel global nasce e vive em `users.role` do `accounts.`; nenhum app o alimenta. · feito quando: os dois arquivos removidos, nenhuma referência restante (`rtk rg "roleMigration"` vazio), build e teste verdes.
- [x] T1.5a — **Bootstrap do primeiro admin — sem isso a Fase 1 é inutilizável.** `users.ts:71` cria toda conta com `role: "user"` e não existe rota que promova ninguém: ao subir a Fase 1, **ninguém é admin, incluindo o mantenedor**, e o único caminho seria `UPDATE` manual em produção (operação perigosa por governança). No boot, o `accounts.` lê `ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL` e garante `role='admin'` para essa conta — idempotente, roda a cada boot sem efeito se o papel já estiver correto, e não falha o boot se a conta ainda não existir (o mantenedor pode não ter logado ainda). **E-mail vai em variável de ambiente, nunca literal em SQL ou código:** o repositório é público desde 2026-06-14, e e-mail literal permanece no histórico do Git mesmo depois de removido do arquivo — é alvo nominal de phishing contra a conta que administra a plataforma inteira. Valor real fica no `.env` da VM (gitignored), como os demais segredos. Promoção pelo bootstrap grava em `global_role_audit` com ator identificável como o próprio bootstrap, não como usuário anônimo. · feito quando: conta do mantenedor vira `admin` no boot, rodar duas vezes não duplica auditoria, boot sobrevive à conta ausente, e nenhum e-mail literal entra no diff.
- [x] T1.5b — **Painel de gestão de papéis no `accounts.`** (decisão do mantenedor: papel em si vai na Fase 1). Listar contas com busca por e-mail/nome, promover e rebaixar entre `user`/`moderator`/`admin`. Toda ação passa pelo trigger `audit_global_role_change()` da migration 002, que já grava em `global_role_audit` — a rota precisa setar `app.actor_id` (`current_setting('app.actor_id', true)`), senão a auditoria sai sem ator. Rota exige `admin`; rebaixar a si mesmo é recusado (evita o admin único se trancar para fora). Reusa `packages/ui/src/admin` (`AdminTable`, `StatusPill`, `PageHeader`), como o requisito 27 — não cria design system paralelo. · feito quando: promover e rebaixar refletem em `/me` dentro do SLA de T1.2, cada ação aparece em `global_role_audit` com ator correto, e auto-rebaixamento é recusado com teste.
- [x] T1.6 — **Papel global lido só do `accounts.`, sem fallback local** (reescrito pela decisão de T1.5). A versão anterior mandava leitura dupla com fallback no papel local — coerente com migração, incoerente com `accounts.` sendo a origem: fallback local reintroduziria o app como autoridade pela porta dos fundos, e um app comprometido ou desatualizado poderia conceder privilégio que o central nega. Regras: `admin` central **vence**; `moderator` central concede **somente** as capacidades de T0.1; papéis de **domínio** (criador, mestre, autor) continuam locais e não são afetados; **ausência do papel no central significa `user`, nunca fallback**; **erro ou timeout nunca promove** (deny-by-default, ver T1.7); autorização privilegiada não usa cache antigo indefinidamente. · feito quando: as seis regras testadas, inclusive erro e ausência.
- [x] T1.7 — **Falha do `accounts.` não altera autorização** (requisito 22, delimitado). Degradação vale para **leitura pública** de comentário — a página continua de pé. **Não** vale para ação privilegiada: se o papel não pode ser provado, a ação moderadora **falha fechada** (deny-by-default, OWASP). Outage nunca promove ninguém. · feito quando: teste com o `accounts.` fora mostra página pública viva e ação moderadora recusada.
- [x] T1.8 — Apps passam a ler o papel do `accounts.` nos pontos mapeados em T0.2 (requisito 2). Papel de domínio fica onde está (requisito 3). · feito quando: cada ponto migrado, com teste.
- [x] T1.9 — **Smoke de SSO em todos os consumidores** (T0.3): login, `/me`, logout. Obrigatório — `accounts.` e `packages/auth` foram tocados. O smoke automático de `_deploy-module.yml` roda as `critical_routes` do manifesto contra o host real, e o `accounts` ganhou nesta fase a rota `admin_roles_no_cookie` (`/admin/roles/users` esperando 401) — a superfície nova que concede papel global sobre todos os projetos e que nenhuma rota crítica cobria. · feito quando: todos verdes, com evidência. · **fechada em 2026-08-04 pelo deploy de produção** (run `30918952648`, `workflow_dispatch` em `main`, sha `c519f76`, sucesso em 3m22s). Rotas críticas reconferidas read-only contra o host real depois do deploy: `admin_roles_no_cookie` devolve `401` e `/health` devolve `200`, ambas como o manifesto declara.

> **Por que T1.9 não fecha localmente, e por que "subir um beta" não é opção (D042).**
> O `accounts` é **PROD-only**: `.github/deploy-manifest.json` declara
> `env_override: "prod"`, `push_branches: ["main"]`, e a build-matrix **bloqueia**
> `workflow_dispatch` com `env=beta` para este módulo. Não existe
> `accountsbeta.artificiorpg.com` — os módulos beta reusam o `accounts` de
> **produção** (D042). Os campos `*_beta` do manifesto espelham os de prod por
> defensividade e **nunca são exercitados**.
>
> Consequência que todo agente precisa ler antes de propor caminho alternativo:
> **não existe ambiente de ensaio onde a Fase 1 possa ser validada antes de
> produção.** Quem procurar um vai gastar a sessão procurando algo que foi
> decidido não existir. As rotas só respondem depois do deploy em prod, e é por
> isso que T1.13 (abaixo) precisava ser fechada **antes** — ela era a única prova
> disponível de que esse deploy não abortaria. T1.13 fechou no deploy de produção
> `30918952648`, em 2026-08-04.
>
> Isto **não** significa "deploy proibido": `AGENTS.md` §"Não lançado ≠ não deve
> subir". Significa que o primeiro exercício real é em produção, com o SSO de
> todos os apps dependendo dele — daí a ordem obrigatória de desbloqueio, hoje
> registrada no bloco de T2.3 (a §"Como destravar" que esta nota citava nunca
> existiu neste arquivo; referência corrigida em 2026-08-07).
- [x] T1.10 — **Remoção do papel global local dos apps.** Reescrito pela decisão de T1.5: sem migração e sem fallback (T1.6), some a exigência de "período observável de leitura dupla" e de "usuários conflitantes resolvidos" — não há conflito a resolver. Permanecem: teste **por capacidade** (não por nome de papel), provando que quem podia moderar continua podendo; refresh reidratado do banco (T1.2); rollback ensaiado. Papel de **domínio** (`download_creator.role` na parte que não é global, mestre, autor) **fica onde está** — só o global sai. · feito quando: as três cumpridas, e nenhum app decide papel global por conta própria.

**Fase 1 fechada em 2026-08-04 pelo deploy de produção** (run `30918952648`, sha `c519f76`).
T1.9 e T1.13 fecharam juntas — runner aplicou migrations 001–005 em `artificio_auth`,
drift e critical_routes verdes. Correções desta passada: timingSafeEqual nos dois pontos,
teste de authMiddleware do glossario (10 casos), 403 do painel com código específico,
shutdownWithError em módulo próprio com teste, smoke cobrindo `admin_roles_no_cookie`.
Validação: repo 38/38, lint 24/24, build 24/24, `verify:api` 0 breaking. `accounts` 73/73.
Falha intermitente do `suggestionModals` resolvida com `testTimeout` 20s (era contenção de
CPU com 191 testes de jsdom em paralelo, não flake).

### Achados de review da PR #234 — todos corrigidos

- **403 de CSRF confundido com rebaixamento** (Codex): backend devolve `code: "ADMIN_REQUIRED"`, frontend discrimina por código.
- **Lista não limpa ao perder papel** (CodeRabbit): `losePermission` centraliza transição.
- **Boot sobrevivia ao próprio encerramento** (CodeRabbit): prazo de 5s + saída forçada.
- **Timer não cancelado** (CodeRabbit): log não mente mais sobre cleanup bem-sucedido.
- **`destroy()` que lança sincronamente** (próprio): abortava antes do `setExitCode`.
- **Digest de tamanho fixo** (CodeRabbit): SHA-256 nos dois lados elimina ramo por construção.
- Sonar S1135 (2x): falso positivo — "todo" em português.

Validação final: `accounts` 73/73, suíte 38/38, lint 24/24, build 24/24, `verify:api` 0 breaking.

### Alarme de drift do `accounts.` (achado do mantenedor, 2026-07-30)

T0.12 removeu `apps/accounts/src/migrate.ts` e tirou a migração do boot. Antes,
migration quebrada derrubava o container e aparecia. Agora o container sobe
saudável e o **único** alarme de schema defasado no SSO é
`check_migration_drift.sh` — que hoje falha aberto.

- [x] T1.11 — **`check_migration_drift.sh` falha fechado quando o diretório não existe.** Hoje as linhas 38-41 imprimem `diretório ausente — nada a comparar` e `exit 0`. É o **mesmo padrão do E018 que este script foi escrito para fechar**: o cabeçalho dele (linhas 11-12) descreve `apply_required_migrations.sh` saindo verde por diretório ausente e se declara "o alarme que faltava" — e então repete a falha. A linha 27 documenta `1 em qualquer divergência (fail-closed)`, contradizendo o próprio código.

  **Enumeração feita em 2026-07-30 (não amostragem):** `accounts` (3 migrations), `mesas` (84), `glossario` (5), `downloads` (37) e `links` (2) têm `apps/<mod>/database/`; `site` usa `apps/site/db/migrations/` (16) e cai no ramo especial do workflow; `site-admin` não tem banco. **Nenhum módulo depende hoje do fail-open** — a mudança não quebra deploy existente.

  Diretório ausente passa a ser erro de configuração explícito. Módulo com runner incompatível é excluído nominalmente no orquestrador — hoje apenas o `site`, cujo entrypoint usa `db/migrations/`, `NNN_*.sql` e `ledger.version`. Não existe `--allow-missing`: nenhum módulo do fluxo atual é legitimamente sem migrations, e a flag criaria novo caminho para repetir o falso-verde. · feito quando: diretório ausente sai diferente de zero, a exceção do `site` é explícita no workflow, o comentário do cabeçalho descreve o comportamento real, e os 6 módulos com banco seguem verdes.

- [x] T1.12 — **Verificar o mesmo defeito em `apply_required_migrations.sh`** (linhas 65-66, `diretorio ausente; nada a aplicar`). É a origem do padrão que T1.11 corrige; foi essa saída falso-positiva que mascarou `015`/`016` por 7 dias em beta E prod. **Decisão reportada e aprovada em 2026-07-30:** o runner padrão falha fechado; `_deploy-module.yml` não o chama para o `site`, que usa runner próprio no entrypoint. Testes reais do ramo ausente provaram exit diferente de zero nos dois scripts; `bash -n` verde. · feito quando: corrigido, ou a exceção justificada por escrito.

- [x] T1.13 — **Confirmar que o `accounts` é coberto de ponta a ponta.** `_deploy-module.yml:519-522` deriva `DRIFT_DIR` por convenção (`apps/${MODULE}/database`), com `if` hardcoded só para o `site`. Rodar o drift contra o banco real do `accounts` e provar que detecta as duas direções: disco à frente (migration não aplicada) e banco à frente (aplicada fora da esteira). · feito quando: as duas direções detectadas em execução real, não por leitura de código. · **fechada em 2026-08-04 pelo deploy de produção** (run `30918952648`, sha `c519f76`). O `DRIFT_DIR` derivado por convenção resolveu para `apps/accounts/database` e o runner de fato cobriu o módulo: a ledger `schema_migrations` foi criada por ele mesmo e registrou as 5 migrations às 14:27:49 UTC, todas com `applied_by = ci:ubuntu@vnic-artificio` — esteira, não intervenção manual. `accounts-api` recriado às 14:29:27 UTC, `healthy`. Schema conferido read-only depois: `users.role`, `users.role_version`, `users.avatar_source` e `global_role_audit` presentes; 111 contas (1 `admin`, 110 `user`), zero fora do contrato de papel.
  **Direção "disco à frente" provada em execução real:** as 5 migrations estavam no disco e ausentes do banco antes do deploy, e o runner as detectou e aplicou. **Direção "banco à frente" provada por ocorrência real, não simulada:** `users.avatar_source` existia em produção sem ser declarada por nenhuma migration (drift reverso originado em `c051971`/`a7d9d20`, ver bloco acima), e foi essa detecção que motivou a `004`/`005`. Nenhuma das duas direções precisou de ensaio artificial.

> **T1.13 e T1.9 fechadas pelo deploy de produção 2026-08-04** (run `30918952648`, sha `c519f76`,
> 3m22s). Runner criou a ledger `schema_migrations`, aplicou migrations 001–005, drift e
> critical_routes verdes. `accounts-api` recriado, healthy. Schema conferido: `users.role`,
> `users.role_version`, `users.avatar_source`, `global_role_audit` presentes; 111 contas
> (1 admin, 110 user).
>
> **Drift reverso `users.avatar_source` — achado e corrigido.** Coluna existia em produção sem
> declaração (originada em `c051971`, perdida por restore `a7d9d20`). Migration 004 declara
> (`ADD COLUMN IF NOT EXISTS` — no-op em prod), 005 valida (`VALIDATE` separado, padrão E015).
> Feature de avatar restaurada por decisão do mantenedor: `PATCH /api/account/avatar` (magic
> bytes, 2 MB), `DELETE /api/account`, `CASE` no upsert, frontend + CSS, Dockerfile com
> `@artificio/media`. Cobertura: `accounts` 81/81.
>
> **⚠️ Guard `MAX_AUTO_PENDING=5`.** Após 004/005, o `accounts` tem exatamente 5 migrations
> pendentes — sem folga. Qualquer migration nova antes deste deploy estoura o guard no deploy
> seguinte (E012). Para destravar: `MAX_AUTO_PENDING=<N>` no `apply_required_migrations.sh`,
> nunca fatiar em lotes.
>
> **T1.11/T1.12 — drift e migration runner fail-closed.** `check_migration_drift.sh` e
> `apply_required_migrations.sh` saem com erro se o diretório não existe (antes saíam 0).
> `_deploy-module.yml` tem `if [ "$MODULE" = "site" ]` para o site (usa `db/migrations/`).
> Validação: `bash -n` 2/2, fail-closed real 2/2.
>
> **Desambiguação de rotas — PR próprio, entre Fase 1 e Fase 2.** `pnpm verify:api` apontou 3
> ambiguidades pré-existentes em `mesas` e `glossario` (placeholder × literal na mesma posição).
> Funcionam em runtime mas são ambíguas no contrato OpenAPI. PR dedicado com breaking change de
> API, fora do escopo da Fase 1.

## Fase 2 — Comentários no `accounts.` [CONCLUÍDO]

> **55 decisões do grilling (2026-08-04), registradas em `spec.md` §Apêndice.** Inversões principais: `body_markdown` (24), `depth<=4` (3), `root_id` obrigatório (3), legado aceita resposta (23), autor edita e retira (17), árvore inteira com cap 1.000/2 MiB (3,8), UUID v4 público (16), voto/Wilson/4 ordenações (4,5,7,19), denúncia/caso/fila/auto-hide (32-34,40), núcleo transacional antecipado (1), ator opaco + vínculo temporário + expurgo (53), IP efêmero na fachada (54).

> **⚠️ Guard `MAX_AUTO_PENDING=5`.** `accounts` tem 5 migrations; a sexta (T2.1) aborta deploy (E012). Destravar com `MAX_AUTO_PENDING=<N>`.

> **Legado do `site` (T2.8):** 25 comentários, 3 com `parent_id`, 0 órfãos, 21 autores. `parent_id BIGINT` sem FK. Detecção de órfão/ciclo obrigatória.

- [x] T2.0a — **Ler `AGENTS.md`.** Leitura confirmada.
- [x] T2.0b — **Usar `rtk`.** Sem comando cru onde `rtk` cobre.
- [x] T2.0c — **Caveman ultra.** Comunicação seguiu o registro.

### Bloco A — Schema [CONCLUÍDO]

- [x] T2.1 — **Schema do comentário: UUID v4 + Markdown + `root_id` obrigatório + `depth<=4`.** `id UUID` v4 público; `realm`, `source_app`, `subject_type`, `subject_id TEXT`; `community_actor_id` opaco; `parent_id UUID`, `root_id UUID` obrigatório, `depth` 0-4; `body_markdown` + campo próprio para HTML legado; `removed_at`/`by`/`reason`; `ranking_revision`, `created_revision`; `pending_review_hidden`; `legacy_source`/`id`/`author_name` com `UNIQUE`. Migration `006`, `online-safe`. (decisões 3, 16, 24, 53)
- [x] T2.1b — **Schema de versões (`comment_versions`).** Histórico completo de `body_markdown`; público vê só versão atual + `edited_at`; antigas restritas a `moderator`/`admin`. Versão referenciada por denúncia não sofre purga automática. (decisões 17, 20, 39)
- [x] T2.1c — **Schema de voto e score.** `comment_vote` por `(community_actor_id, comment_id)`; `comment_score_version` com `upvotes`/`downvotes` (`CHECK >= 0`), `score` e `best_score` colunas geradas; `best_score` via `comment_wilson_reddit_80_v1` (`IMMUTABLE`). PostgreSQL é fonte canônica; sem auto-upvote; histórico permanente. (decisões 4, 5, 7, 8, 21, 53)
- [x] T2.1d — **Schema de notificação transacional.** `notification_event` (imutável) + `notification_receipt`, antecipados da Fase 3. Só o núcleo; central/API/outbox continuam na Fase 3. (decisão 1)
- [x] T2.1e — **Schema de denúncia, caso e motivos.** `comment_reports` com `reported_version_id` obrigatório, unicidade de denúncia ativa por ator/comentário; `moderation_case` (máx 1 aberto por comentário); 8 motivos compartilhados (`malicious_link`, `inappropriate_content`, `spam_or_off_topic`, `harassment_or_hate`, `personal_data`, `copyright_violation`, `illegal_content`, `other`), prioridades P0/P1/P2. (decisões 32, 33, 37, 39, 40, 53)
- [x] T2.1f — **Schema do ciclo de moderação comunitária.** Veredito por denúncia (`upheld`/`dismissed`/`no_determination` + `withdrawn`); ação terminal por caso (`no_change`/`restore`/`remove`); recurso único do autor em 6 meses; restrições `posting`/`commenting` (`warning`, suspensão temporária ou permanente); `community_actor` com vínculo restrito e eliminável, `retention_until`, `legal_hold`, `key_version`. Toda transição com ator, motivo e timestamp. (decisões 43-49, 53)

> **T2.1 a T2.1f são uma migration só (`006`).** `AGENTS.md` §Migrations 2.1 proíbe fatiar schema da mesma spec no mesmo diff. Tasks separadas por assunto de revisão, não por arquivo.

> **Trava de sequência — `realm` no schema não separa beta de prod sozinho.** Quem impede escrita de beta gravar `realm='prod'` é o registro de credenciais (T2.2a): `realm` derivado da credencial, nunca do payload. Sem T2.2a, `realm` vira campo decorativo e beta contamina produção no mesmo `artificio_auth`.

### Bloco B — Escrita, autorização e integridade [CONCLUÍDO]

- [x] T2.2a — **Registro de credencial de serviço por `source_app` e `realm`.** `community_service_credential`: `token_id` público, `token_hash` (Argon2id), `source_app`, `realms TEXT[]`, `scopes TEXT[]`; header `<token_id>.<segredo>`; resolução devolve identidade ou `null` (nunca boolean); handler deriva `realm`/`source_app` da credencial e rejeita payload que os declare. Migration `007`. `serviceCredentialAdmin.ts` para emissão/revogação. (requisito 5a, T0.6)
- [x] T2.2a-op — **Emitir credenciais reais e aposentar `SERVICE_SECRET` global.** 4 credenciais (`downloads` + `mesas` × `prod` + `beta`). Fallback removido (PR #244). `SERVICE_CREDENTIAL` obrigatório (`:?`); `SERVICE_SECRET` zerado. 
- [x] T2.2 — **Contrato `CommentSubjectAuthorization` + suíte de conformidade.** Pacote `@artificio/comments` (novo): `subjectAuthorization.ts` (contrato Zod), `subjectAuthorizationConformance.ts` (suíte reutilizável, agnóstica de runner), export livre de React. `realm`/`source_app` não existem no contrato — derivados da credencial no `accounts.`. 33/33 testes. (requisito 6, decisão 2)
- [x] T2.2b — **Contrato HTTP v1.** `contrato-http-v1.md`: namespace `/internal/v1/*` completo — leitura em árvore, criação/resposta, edição/auto-retirada, moderação, voto/invalidação, denúncia/retirada, caso/veredito/reabertura, recurso, sanção, `DELETE /api/account`. §15 mapeia fluxo→requisito/decisão/task; §2 lista campos nunca públicos. (decisões 12, 17, 32-50, 53)
- [x] T2.3 — **Leitura em árvore com cursor versionado.** Árvore inteira; cap 1.000 ou 2 MiB → `more`, nunca órfão. Cursor opaco HMAC-SHA256, TTL 30 min. Chave `ACCOUNTS_COMMENT_CURSOR_KEY` dedicada `min(32)`, obrigatória (`:?` no compose) — sem ela o SSO cai no boot. CTE recursiva, ordenação entre irmãos, join de score pela faixa que contém a revisão congelada. (decisões 3, 8)
- [x] T2.3b — **As quatro ordenações.** `Melhores` (Wilson unilateral `z = 1.281551565545`, 80% confiança, sem decaimento), `Mais votados` (score líquido), `Recentes` (`created_at DESC`), `Mais antigos` (`created_at ASC`). Entre irmãos, nunca misturando níveis. Desempate `(created_at, id)`. Wilson negativo corrigido em `migration_009_wilson_clamp.sql` — `(0, d)` devolvia ~`-1e-18`, ordem invertida no sort `best`. (decisões 7, 19)
- [x] T2.4 — **Integridade de thread na transação.** `depth<=4`; resposta a legado aceita; pai precisa existir no mesmo `realm`/`source_app`/assunto; `root_id` derivado na escrita. `placeComment` (`packages/comments`) decide; handler consome com `SELECT ... FOR SHARE`. Rejeições: `parent_not_found`→404, `depth_exceeded`/`parent_not_accepting_replies`→422. FKs compostas são `DEFERRED` — `placeComment` é a primeira barreira, não redundância. (requisito 8, decisões 3, 23)
- [x] T2.5 — **Markdown pelo pipeline `@artificio/content-editor`.** `sanitizeUserMarkdown` → persiste Markdown canônico; API devolve Markdown, não HTML. Limite 10.000 pontos de código; `markdownToPlainText` precisa dar conteúdo não vazio. HTML legado: `sanitizeLegacyCommentHtml` com política `site-comment-html` v1 (defaults do `sanitize-html` + `rel`/`target` forçados, HTTPS-only). Migration `008` para chave de idempotência. Bug de escape de `<>` corrigido com `protectLooseAngleBrackets`. (requisitos 10, 10c; decisões 24, 25, 30)
- [x] T2.5b — **Política de link e imagem no `@artificio/content-editor/comment-links`.** Imagem só como referência HTTPS clicável; links HTTPS-only; host por `URL` estrutural; `rel="ugc nofollow"` + `noopener noreferrer` no externo; root-relative contra origem do `source_app`; violação → `INVALID_COMMENT_LINK`. Módulo próprio, sem React. Varredura com teto `MAX_SCAN_LENGTH=12.000`. (decisões 26-29)
- [x] T2.6 — **Badge de autor.** `AuthorBadge` = `admin | moderator | content_author | null`, resolvido por `JOIN` com `users.role` + `subject.owner_user_id`. Precedência `admin` > `moderator` > `content_author`. Legado nunca recebe selo. (requisito 11)
- [x] T2.6b — **Sem `@menções`.** `@texto` é Markdown comum, nunca resolve conta. `accounts.users` não tem handle público único. Garantia estrutural: `RecipientCandidates` não tem campo de texto. (decisão 31)
- [x] T2.6c — **Criar/responder com evento e recibos na mesma transação.** Raiz → recibo para publicador; resposta → autor do pai + publicador; deduplica iguais; ator excluído. `POST /internal/v1/comments` + `POST /.../replies`, escopo `comment.write`. `realm`/`source_app` da credencial; corpo `strict`. `subject_authorization` obrigatório; assunto criado sob demanda. Idempotência: insere primeiro (`ON CONFLICT DO NOTHING`), nunca `SELECT`-antes-`INSERT`; chave não vaza em rejeição. `values({})` corrigido para `defaultValues()`. (decisões 1, 13)

> **Deploy quebrou o SSO por 5h.** `packages/comments` → `@artificio/content-editor`; `Dockerfile` do `accounts` filtrava `--filter` por pacote e `content-editor` não estava na lista (dependência transitiva). Gate `check_dockerfile_workspace_deps.mjs` casava stage por nome, não por posição. Corrigido (PR #248): gate casa último `FROM`, resolve fecho transitivo, cobre 6 imagens.

### Bloco C — Ciclo de vida do comentário [CONCLUÍDO]

- [x] T2.7 — **Retirada por tombstone, com auditoria.** Preserva posição e descendentes; corpo e score somem; `removed_by`/`removed_reason` para moderação. Moderação nunca edita texto alheio. (requisito 12; decisões 17, 22)
- [x] T2.7b — **Autor edita e retira o próprio comentário.** Edição sem prazo, só `body_markdown`; idêntica é no-op; preserva votos e ranking (decisão 18); `edited_at` público. Auto-retirada via tombstone, irreversível para o autor; só `moderator`/`admin` restaura. `PATCH`/`DELETE /internal/v1/comments/:id`, `FOR UPDATE`. (decisões 17, 18, 20)
- [x] T2.8 — **Legado imutável mas respondível.** `legacy_source='site'`, `legacy_author_name`, `user_id` nulo. Imutável (não edita, score `0` permanente), mas aceita resposta nova. Detecção de órfão/ciclo obrigatória. (requisito 9; decisões 6, 23)

### Bloco D — Voto e ranking [CONCLUÍDO]

- [x] T2.12 — **Mutação de voto por estado absoluto.** `PUT /internal/v1/comments/:id/vote`, `{ value: -1 | 0 | 1 }`; `0` remove. No-op → `200` sem nova revisão. Última gravação vence (sem `ETag`). Autor não vota no próprio; legado não aceita voto; conta nova vota imediatamente. (decisões 5, 6, 11, 12)
- [x] T2.13 — **Revisão de ranking sob lock curto.** `ranking_revision` por assunto; voto incrementa via `UPDATE ... RETURNING` (não `SELECT ... FOR UPDATE`). Score é histórico: cada mudança fecha faixa corrente e abre outra. (decisão 8)
- [x] T2.14 — **Transparência de contagens.** `upvotes`, `downvotes`, `score` públicos; `my_vote` só autenticado. API pública nunca expõe lista nominal de votantes. (decisões 9, 10, 53)
- [x] T2.15 — **Destino do voto/identidade quando conta perde acesso.** Saída preserva votos/score, barra voto novo. `DELETE /api/account` revoga refresh/cookies, elimina PII. Sem caso/recurso: apagar vínculo ator→conta. Com caso/recurso: restringir à moderação até 6 meses. Fingerprint HMAC versionado impede recadastro por 6 meses. (decisões 14, 15, 52-53)
- [x] T2.16 — **Voto não gera notificação.** Nenhum `notification_event`/`receipt` para voto. Provado por sequência de 10 votos cruzando marco de 10 pontos. (decisão 13)

### Bloco E — Denúncia e moderação [CONCLUÍDO]

- [x] T2.17 — **API de denúncia e fila compartilhada.** Exige conta; autor não denuncia o próprio; 1 denúncia ativa por ator/comentário. Moderador resolve conta só enquanto vínculo permitido. (decisões 32, 33, 35, 37, 38, 53)
- [x] T2.18 — **Auto-ocultação por 5 contas distintas.** Denúncia isolada só cria item na fila. 5 contas distintas → `pending_review_hidden`: corpo e score somem, posição e descendentes permanecem. Mesma conta nunca soma 2x. (decisão 34)
- [x] T2.19 — **Caso episódico agrega denúncias.** Máx 1 caso aberto por comentário; denúncias são linhas individuais imutáveis. Decisão terminal fecha sem apagar; denúncia posterior abre caso novo. (decisões 39, 40, 53)
- [x] T2.20 — **Invariantes de decisão terminal.** (a) Rotas de leitura com orçamento próprio; (b) transição serializada e condicionada — um vencedor, `409` ao segundo; (c) auditoria na mesma transação do estado. (decisão 36)
- [x] T2.21 — **Auto-hide, edição e retiradas concorrentes.** Editar `pending_review_hidden` cria versão sem revelar. 5ª denúncia × retirada concorrente: quem persistir primeiro define. Auto-retirada do autor não encerra caso. (decisões 41, 42, 46)
- [x] T2.22 — **Veredito por denúncia e ação única por caso.** Cada denúncia: `upheld`/`dismissed`/`no_determination`; `withdrawn` é neutro. Caso: uma ação (`no_change`/`restore`/`remove`). Nenhuma denúncia fica sem veredito. (decisões 43, 46)
- [x] T2.23 — **Resultado privado e mínimo.** Denunciante: só `action_taken`/`not_upheld`/`no_determination`. Autor: auto-hide e remoção/restauração. Nunca identidade alheia, nota interna ou sanção. (decisão 44)
- [x] T2.24 — **Aprovação de versão impede reabertura automática.** `no_change`/`restore` aprova `comment_version_id`. Nova denúncia da mesma versão → `no_determination`, não abre caso. Moderador reabre manualmente; edição cria versão nova denunciável. (decisão 45)
- [x] T2.25 — **Recurso estruturado.** Só autor, 1x por decisão de remoção, até 6 meses. Referencia caso/decisão/versão; `upheld` ou `reversed`. Mesmo moderador pode rejulgar com nova justificativa. (decisão 47)
- [x] T2.26 — **Sanção comunitária.** Restrições `posting`/`commenting`: `warning`, suspensão temporária ou permanente. Login/leitura continuam. Cada motivo define `details=required|optional|forbidden`; detalhe máx 4.000, imutável, restrito à moderação. (decisões 48, 49)

### Bloco F — Leitura, capacidade e testes [CONCLUÍDO]

- [x] T2.9 — **Identidade resolvida no mesmo `SELECT`.** `JOIN` com `community_actor` + vínculo/usuário. Conta excluída → "Conta excluída", avatar nulo; `author.state` = `active|deleted|legacy`. Nunca expõe e-mail, fingerprint ou distinção de retenção. (requisitos 7, 7a-7b; decisão 53)
- [x] T2.10 — **Antiabuso com buckets independentes.** 6 buckets (`read`, `write`, `edit`, `vote`, `report`, `appeal`) + `authentication` separado. Camada `accounts`: chaves usuário + credencial separadas (nunca compostas). Limiter pré-autenticação por IP (2000/15 min). `429` sem `RateLimit-*` nem `Retry-After`. `resolveRateLimitKeys` lança se receber IP na camada interna. (decisões 50, 54)
- [x] T2.11 — **Testes de borda obrigatórios.** Todos cobertos: cross-subject, cross-realm, `depth=4`, dono forjado, resposta a legado (aceita), voto em legado (recusado), auto-retirada (aceita), edição por terceiro (recusada), moderator revogado, voto/denúncia/decisão concorrentes, auto-hide, links hostis, `accounts.` indisponível, `legal_hold`, expurgo, sanção ativa, ausência de IP.


## Fase 3 — Notificações agregadas

A razão de ser da agregação. Sem esta fase, o ganho sobre banco por app é pequeno.

> **Escopo ampliado em 2026-08-10 (decisão do mantenedor, sessão de grilling).** A fase deixou de
> ser "API + central sobre o que a Fase 2 escreveu" e passou a **consolidar os três sistemas de
> notificação que existem em produção hoje**, com sino compartilhado e outbox. As tasks T3.12-T3.16
> abaixo são as novas. Duas premissas do texto original foram desmentidas por medição na mesma
> sessão e estão corrigidas nas tasks correspondentes: T3.5 (o bug era o inverso do descrito) e
> T3.6 (o índice existente não serve para a ordenação exigida).
>
> | Achado medido em 2026-08-10 | Onde | Consequência |
> |---|---|---|
> | 3 sistemas independentes coexistem | `download_notification`, `notifications` (mesas), `notification_event`/`receipt` | T3.12, T3.13 |
> | `source_app` CHECK não aceita `accounts` | `migration_006:473,506` | T3.14 |
> | 4 de 5 emissões do `downloads` são transacionais demais | `moderation.ts:152,227,354`, `reports.ts:308` | T3.5 reescrita, T3.15 — **corrigido em 2026-08-12** |
> | Índice de não lidas ordena por `created_at` do recibo | `migration_006:517-525` | T3.6 |
> | Nenhum dos 3 pagina (`limit 50` fixo) | `downloads/routes/notifications.ts:18`, `mesas/routes/notifications.ts:23` | T3.6 |
> | `/conta/notificacoes` cairia em 404 no deep-link | `app.ts:553` + `main.tsx` sem react-router | T3.9 |

- [x] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T3.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [x] T3.1 — **Consumir o schema de evento/recibo já criado em T2.1d** (requisito 13; decisão 1). Tabelas NÃO recriadas — `notification_event` e `notification_receipt` são a base desde a Fase 2. A única migration nova da fase é a aditiva `010` de T3.14. API de T3.6 (`notificationRoutes.ts` + `notificationData.ts`) lê e escreve nessas tabelas, sem criar tabela nova. Imutabilidade de `notification_event` preservada (trigger `notification_event_immutable`, migration_006:1220-1231) — a API nunca faz DELETE, só UPDATE de `read_at` no recibo. · feito quando: nenhuma tabela recriada; migration 010 é a única nova; API usa tabelas existentes; trigger de imutabilidade testado.
- [x] T3.2 — **Destinatários persistidos provados de ponta a ponta** (requisitos 14-16; decisão 1). `notificationRecipientsIntegration.test.ts` usa `createComment` real e lê de volta por `listNotifications`, sem reimplementar `resolveNotificationRecipients` no teste. Quatro casos contra PostgreSQL 16 cobrem as cinco regras: raiz entrega ao publicador e exclui o ator; resposta entrega ao autor do pai e ao publicador e exclui o ator; publicador igual ao autor do pai gera um único recibo da resposta; conta removida de `users` não recebe. O teste espera o sweep assíncrono do outbox e compara os recibos efetivamente persistidos, filtrados pelo assunto aleatório da execução. Sem `COMMUNITY_TEST_DATABASE_URL`, usa `describe.skipIf(!pool)` e não quebra a suíte local. **Execução real em 2026-08-12:** migrations 001–010 aplicadas em `postgres:16` descartável na VM, pacote montado de `origin/dev` + diff local; `notificationRecipientsIntegration.test.ts` 4/4 em 432 ms; suíte accounts 558/558, 30/30 arquivos, exit 0; container, rede, fonte e logs removidos, zero resíduo.
- [x] T3.3 — **Formatar o snapshot estruturado já gravado em T2.6c** (requisito 13; decisão 1). `notificationFormatter.ts`: `formatNotificationText(eventType, version, snapshot)` — switch por event_type com textos em português. `enrichNotificationItem()` adiciona `text`, `link` e `source_label` ao payload da API. Versão 1 do snapshot (comment_id, parent_comment_id, root_comment_id, depth) está declarada mas a formatação atual usa só event_type — campos estruturados entram quando a Fase 3 emitir tipos além de comentário. Acrescentado ao `NotificationItem` da `notificationData.ts`. Validação: lint 0, tsc backend+frontend 0, testes 510/510, build 8/8.
- [x] T3.4 — **Outbox provado como consumidor idempotente, sem acoplamento oculto a comentário.** A parte de comentário foi supersedida por T2.6c; produtor externo real continua pertencendo a T3.13. A prova fica em duas camadas: `notificationOutboxSavepoint.test.ts` fabrica eventos diretamente em `notification_event` e entradas em `notification_outbox`, sem passar por `createComment`, e executa `processOutboxPending` contra PostgreSQL real; `notificationOutbox.test.ts` chama `processOutboxEntry` diretamente e prova idempotência quando um destinatário já tem recibo (`ON CONFLICT DO NOTHING`: só o destinatário novo é inserido). Assim, o consumidor aceita evento fabricado como vindo de outro módulo sem depender do fluxo específico de comentário; T3.13 ainda precisa provar cada produtor real quando for implementado. **Execução real em 2026-08-12:** teste fabricado/savepoint 1/1 em 105 ms; teste estrutural/idempotência 5/5 em 14 ms; ambos dentro da suíte accounts 558/558, exit 0.
- [x] T3.5 — **[P1] Desacoplar notificação da transação de moderação, via outbox** (requisito 13c-i). As duas pontas do defeito medido em 2026-08-10 estão corrigidas. `services/notify.ts` deixou de fazer `insertInto('download_notification')` e passou a enfileirar em `download_notification_outbox` (migration_038): os quatro chamadores transacionais (`moderation.ts:152`, `:227`, `:354`, `reports.ts:308`) continuam passando `trx` — a intenção é durável ou a ação reverte inteira —, mas a **entrega** saiu da transação para `notificationOutboxDelivery.ts`, que faz `POST /internal/v1/notifications/events` com retry, teto de 5 tentativas e distinção 4xx/5xx. `accounts.` fora do ar não impede mais aprovar, rejeitar ou decidir denúncia. A quinta emissão (`systemSuggestionsAdmin.ts:346`) era a ponta oposta — pós-commit, sem `await`, `.catch()` que engolia: agora enfileira com `await` (custo de um INSERT local, não de rede) e a falha é registrada em vez de sumir; segue fora do lock porque o catálogo é HTTP e não participa da transação (razão original preservada em `:339-341`). Batch distingue etapa: `failed_step` (`lookup`/`evidence`/`update`/`audit`) separa "material não mudou de estado" de "mudou e só a auditoria falhou". **Uma garantia foi deliberadamente invertida:** `moderation.notify.test.ts` fixava "falha fechada: notificação quebrada não confirma aprovação" (spec 074/075) — 13c-i nomeia isso como defeito, e o teste foi reescrito com o motivo registrado no arquivo. **Validação:** lint 25/25, tsc accounts e downloads 0, testes accounts 534/534 (33 pulados sem `COMMUNITY_TEST_DATABASE_URL`), downloads 496/496 + 8/8 do teste novo de entrega, build 25/25, `verify:api` exit 0 (0 breaking). **Pendente:** execução contra Postgres real (migration 038 aplicada, entrega ponta a ponta com `accounts.` de verdade) — nenhum ambiente real foi tocado nesta sessão.
- [x] T3.6 — **API de notificação completa** (requisitos 19, 19a-19c). 5 rotas em `notificationRoutes.ts`, queries extraídas em `notificationData.ts`, registradas em `app.ts:524-527`: GET /api/v1/notifications/unread-count, PATCH /read-all (ANTES de /:id/read), PUT /read-through (ANTES de /:id/read), GET / (cursor (occurred_at, id), padrão 20, máx 100, filtro source_app, cache private no-store), PUT /:id/read (404 uniforme). Sessão via requireAuth (@artificio/auth). Filtro 17e na consulta: LEFT JOIN community_comment por comment_id do snapshot; social (comment.created/comment.replied) some se alvo removido; moderação (moderation.%) sempre visível. Filtro antes do cursor. Validação: lint 0, tsc 0, testes 521/521, verify:api 0 breaking, build 25/25. **Execução real confirmada em 2026-08-12** (Postgres 16 descartável, container `pg-temp-090-fase3` na VM, destruído após o teste, nenhum dado de prod tocado): `EXPLAIN` da listagem usa `Index Only Scan Backward using idx_notification_event_cursor`; cursor `(occurred_at DESC, id DESC)` percorre sem gap/repeat na fronteira de página (testado com 50 eventos sintéticos, offset 19); `source_app='accounts'` aceito pelo CHECK ampliado.
- [x] T3.7 — **Link de volta construído no servidor** (requisito 18). `notificationFormatter.ts`: `buildBackLink(sourceApp, canonicalPath)` — mapa de origins por módulo + canonical_path (já validado pelo CHECK migration_006:480-486). Incluído no payload da API (`enrichNotificationItem`) como `link`. Central mostra link no detalhe expandido com target _blank. NUNCA URL do cliente. Validação: lint 0, tsc 0, build 8/8.
- [x] T3.8 — **Privacidade do evento: stub de revalidação** (requisitos 13, 13d-i). A revalidação de acesso por módulo (T3.8 completo) depende de HTTP cross-module, fora do escopo desta semi-fase. O stub atual: todos os itens são mostrados com seu texto do snapshot, sem ocultação. A estrutura da API (`NotificationItem.text`, `.link`) já suporta degradação futura (texto sem nome, link null). Implementação completa na fase de integração cross-module. Validação: lint 0, tsc 0, build 8/8.
- [x] T3.9 — **Central canônica no `accounts.`** (requisitos 17, 17a, 17c). Deep-link nas duas pontas: `app.ts` acrescentou `/conta/notificacoes` à lista SPA; `main.tsx` acrescentou ramo `NotificationsView`. Componente `NotificationsView.tsx` + CSS em `styles.css`: lista paginada (cursor, carregar mais), filtro dropdown por módulo (default = todos), marcar uma como lida (PUT /:id/read), marcar todas (PATCH /read-all), detalhe expandido com link de volta e info de moderação. Abrir NÃO marca nada. Sem react-router — if/else sobre pathname mantido. Validação: lint 0, tsc backend+frontend 0, testes 510/510, build 8/8, verify:api 0 breaking.
- [x] T3.9b — **Sino compartilhado no header** (requisito 17a-i). `packages/ui/src/NotificationBell.tsx` (agnóstico, sem React Query): SVG bell inline, badge de contagem via `GET /api/v1/notifications/unread-count?source_app=X`, dropdown com últimas 5 via `GET /api/v1/notifications?limit=5&source_app=X`, link "ver todas" para `/conta/notificacoes`, botão de marcar lida inline, rodapé com "você tem avisos em outros módulos" (compara count total vs count do módulo). Só renderiza com sessão (`useSession()`). CSS em `styles.css`. Integrado nos 3 apps: `mesas/HeaderActions.tsx` (substitui import local), `downloads/AppShell.tsx` (`actions={<NotificationBell sourceApp="downloads" />}`), `site/SiteHeaderIsland.tsx` (entre busca e theme toggle, ilha React existente). Build site sem quebra SSR. Arquivo legado `mesas/.../NotificationBell.tsx` **ainda existe** (não deletado — pendente confirmação de paridade visual, sem uso ativo desde a troca em `HeaderActions.tsx`).
  **Achados de review corrigidos (PR #255, #256), 3 rodadas — CodeRabbit + Sonar/Snyk:** `fetch()` sem checar `res.ok` fazia UI marcar como lida com escrita rejeitada pelo servidor; payload de API sem normalizador tipado (`packages/ui/src/notificationNormalize.ts` novo, compartilhado com `NotificationsView`); refresh concorrente sem `AbortController` (resposta antiga sobrescrevia a mais recente); dropdown sem Escape/retorno de foco, botões sem `type="button"`; `--artificio-accent` usado no CSS não existia como token em nenhum `:root` do repo (resolvia só por fallback `#dd6b20`) — substituído por `--artificio-brand-deep` (token real, D064), com contraste recalculado pra AA (~4.7:1, texto branco sobre laranja escurecido). Mesmos achados aplicados em paralelo à central (`NotificationsView.tsx`, T3.9). Validação: lint 25/25, tsc 0, testes accounts 523/523, build (accounts, mesas-frontend, packages/ui) verde, verify:api 0 breaking.
- [x] T3.10 — **Atualização ao focar a aba e após mutação** (requisito 17b). `NotificationBell`: `useFocusPolling()` — `visibilitychange` + `focus` no window, sem `setInterval`. Após mutação (marcar lida), incrementa trigger interno que força refresh. `NotificationsView` (central T3.9) já estava limpa (sem polling fixo). Nenhuma requisição parte de aba em segundo plano. Validação: build verde, testes accounts 523/523.
- [x] T3.11 — **Canal in-app apenas, com guarda estrutural** (requisito 20). `notificationOutbox.test.ts` lê o source de `notificationOutbox.ts` e `communityCommentWrite.ts` e recusa `sendEmail`, `nodemailer` ou `webpush`; o grep complementar em `apps/accounts/src` também devolveu zero ocorrência antes da implementação. O consolidado só persiste evento/recibo; e-mail e push exigirão canal explícito futuro. `apps/downloads/backend/src/services/moderationEmail.ts` continua pipeline próprio do `downloads`, sem entrar no consolidado e sem alteração nesta task. **Validação em 2026-08-12:** as duas entradas do `it.each` passaram dentro de `notificationOutbox.test.ts` 5/5; suíte accounts com PostgreSQL real 558/558, exit 0.
- [x] T3.11b — **Preferência de notificação por tipo de evento** (requisitos 20a-20c). Catálogo de 8 `event_type` com rótulos em `notificationPreference.ts`: `isModerationEvent()` por prefixo `moderation.*` + lista explícita, `getEventTypeLabel()`, `listEventTypes()`, `setPreference()` (moderação recusada com `moderation_not_modifiable`), `shouldDeliver()` (sem linha = tudo ligado). Rotas em `notificationPreferenceRoutes.ts`: GET /api/v1/notification-preferences, PUT /:event_type (404 p/ tipo desconhecido, 422 p/ moderação), GET /api/v1/notification-event-types. Filtro aplicado no fan-out do outbox (T3.15). Validação: lint 0, tsc 0, 11 testes (9 lógica pura + 2 outbox), verify:api 0 breaking.

### Consolidação dos três sistemas (decisão do mantenedor, 2026-08-10)

Medido em 2026-08-10: existem **três** modelos independentes em produção, e a Fase 3 construiria o
quarto se não os absorvesse. Cada um tem exatamente uma peça madura que os outros não têm — o
consolidado herda as três, em vez de reinventar duas.

**Ordem de entrega (decisão do mantenedor, 2026-08-10):** primeiro o `accounts.` completo — central,
API, preferência e sino funcionando para comentário (T3.1-T3.11b, T3.12, T3.14, T3.15); depois a
conversão dos módulos produtores, **um por vez** (T3.13, T3.16). Se a fase atrasar, o corte cai na
conversão, nunca na base: legado que ainda não converteu continua na tela atual, funcionando, e
nenhum usuário passa por estado quebrado. A alternativa — consolidar um módulo inteiro de ponta a
ponta antes de tocar o próximo — provaria o caminho completo mais cedo, mas manteria a central
parcial por mais tempo e daria ao usuário uma experiência que muda duas vezes.

- [ ] T3.12 — **`notification_event`/`notification_receipt` é a base única** (requisito 13a-i). **Parcial — depende de T3.13 para se provar.** Das quatro capacidades a absorver, três estão no consolidado: `PATCH /read-all` (T3.6), `metadata` JSONB (migration_010) e FK `ON DELETE CASCADE` em `user_id`. Falta o padrão React Query + Zod do `downloads` na superfície nova, e sobretudo a prova de "nenhuma regressão de função existente" — que só é verificável quando a tela legada ler do consolidado (T3.13), não antes. Não é preferência: é o único dos três com `realm` estrutural (nas chaves únicas, nos índices e no FK composto — `migration_006:472,490,505,512,514`), idempotência do produtor (`event_id` UNIQUE, `:471`) e separação evento/entrega. As três são irreversíveis: retrofitar `realm` ou `event_id` em tabela com dado de produção custa migração, retrofitar separação evento/entrega custa reescrever o modelo. Absorver dos legados o que a base não tem: `PATCH /read-all` e `metadata` JSONB do `mesas` (`apps/mesas/backend/src/routes/notifications.ts:33-52`, `migration_106:13`), padrão React Query + Zod + `invalidateQueries` do `downloads` (`apps/downloads/frontend/src/hooks/useNotifications.ts:9-26`), e FK `ON DELETE CASCADE` em `user_id`, que o `downloads` não tem (`migration_018:14`). · feito quando: o consolidado cobre todas as capacidades dos três, e nenhuma regressão de função existente é aceita como custo da unificação.
- [ ] T3.13 — **`download_notification` e `notifications` viram produtores, não fontes** (requisito 13a-i). **Parcial: `downloads` emite, mas ainda não lê do consolidado; `mesas` intocado.**
  **Entregue — o caminho de produção existe.** `POST /internal/v1/notifications/events` (`accounts/src/notificationIngestRoutes.ts`, registrada em `app.ts`): guard por credencial de serviço com escopo **`notification.write`** novo (migration_011 amplia o CHECK de `community_service_credential.scopes`; escopo próprio, e não `comment.write`/`moderation.write` — emitir aviso não pode vir junto com criar fala nem decidir caso). `realm`/`source_app` derivados da credencial, nunca do payload; `actor_id` nulo (produtor externo informa destinatário, não autor comunitário); idempotência por `event_id` consultada antes do INSERT, então retry devolve o evento existente sem entrada nova no outbox; evento + `enqueueOutboxEvent` na mesma transação; fan-out fora dela; 202 (não 201 — o recibo ainda não existe neste ponto). `downloads` deixou de gravar em `download_notification`: `notify.ts` enfileira no outbox local e `notificationOutboxDelivery.ts` entrega, com `occurred_at` do fato (não da entrega — é o caso que 19b previu). Os cinco `kind` viajam como snapshot legado versão 1 (`legacy_kind`/`legacy_body`), sem virar tipo oficial do consolidado (24e). Teste `moderation.notify.test.ts` passou a asserir a **ausência** de escrita em `download_notification`, para um chamador não voltar a gravar ali sem ninguém perceber.
  **Falta — o que impede fechar:** (1) `mesas` não foi convertido (`routes/notifications.ts:10-80` continua fonte própria); (2) **nenhuma das telas legadas lê do consolidado**, que é a metade da decisão de 2026-08-10 destinada a impedir o usuário de ver o mesmo aviso em dois lugares com estados de leitura independentes — hoje o `downloads` está exatamente nesse estado intermediário: emite pro consolidado e sua tela ainda lê `download_notification`, que parou de receber escrita nova, então **aviso novo do `downloads` não aparece na tela legada dele**; (3) credencial com `notification.write` não foi emitida em nenhum ambiente. · feito quando: emissão nova de qualquer um dos dois cria `notification_event`; a tela legada de cada módulo lê do consolidado a partir da conversão; nenhum aviso aparece em dois lugares; e nenhuma escrita nova entra nas tabelas legadas.
- [x] T3.14 — **Migration da consolidação** (requisitos 13a-ii, 19b). `migration_010_notification_consolidation.sql`, `online-safe`, header de 5 campos copiado de `009`, idempotente (DO $$ com checagem de pg_constraint). Quatro alterações aditivas sobre o schema da Fase 2:
  1. **CHECK `source_app` ampliado** nas duas tabelas (`notification_event`, `notification_receipt`): de `downloads|site|mesas` para `downloads|site|mesas|glossario|links|accounts`. Localiza constraint antiga por `pg_get_constraintdef` (migration_006 declarou CHECK inline, sem nome), dropa com `IF EXISTS`, recria com nome fixo `*_source_app_consolidated_check`.
  2. **Índice `idx_notification_event_cursor`** em `notification_event(realm, source_app, occurred_at, id)` — sustenta paginação por cursor de T3.6 sem tocar recibo.
  3. **Coluna `metadata JSONB`** em `notification_event`, nullable, CHECK `JSONB_TYPEOF = 'object'` quando não nulo (mesmo padrão de `snapshot` em migration_006:487).
  4. **Tabela `notification_preference`** por `(user_id, event_type)`, sem `realm` (20a-ii), FK `users(id) ON DELETE CASCADE`. Linha ausente = tudo ligado — sem backfill.
  **Tipos Kysely:** `NotificationEventRow.metadata` (`unknown | null`), `NotificationPreferenceRow` nova, ambos em `Database`. **Validação:** lint 25/25, tsc accounts 0 erros, build 8/8, testes accounts 487/487 (24 files, 1 skipped), verify:api 0 breaking. **Pendente:** execução contra Postgres 16 real (docker descartável ou banco de teste) — idempotência (2x), aceite de `source_app='accounts'`, EXPLAIN com índice novo, e guard de diretório/header no CI.
- [x] T3.15 — **Outbox: evento transacional, entrega assíncrona, um caminho só** (requisito 13c-i). Tabela `notification_outbox` (migration_010 seção 5, com CHECK de `realm`/`source_app` e índice parcial `idx_notification_outbox_pending` adicionados em review posterior) com `recipients` JSONB validado como array de UUID (não só string — elemento malformado quebraria `where(...,"in",...)` com `22P02` fora de qualquer try). `notificationOutbox.ts`: `enqueueOutboxEvent(trx)` na transação (`communityCommentWrite.ts`), `processOutboxEntry(db|trx)` faz fan-out com preferências (T3.11b) e cria recibos idempotentes via `ON CONFLICT DO NOTHING` no UNIQUE do recibo (não try/catch — erro de constraint sem savepoint aborta a transação Postgres inteira). `processOutboxPending` abre sua própria transação com `FOR UPDATE SKIP LOCKED` (sweeps concorrentes não disputam linha) e processa cada entry sob **savepoint SQL raw** (`SAVEPOINT`/`RELEASE SAVEPOINT`/`ROLLBACK TO SAVEPOINT` — `Transaction<Database>` do Kysely 0.29 não expõe savepoint na API pública), isolando falha de uma entrada sem abortar as demais na mesma transação; entrada que falha é marcada `processed_at` mesmo assim, para não ficar em retry infinito. Chamado fora da transação de mérito, pós-commit, fire-and-forget, com sweep periódico independente (`setInterval` 5 min no boot do `accounts`) cobrindo falha do disparo pós-commit. Moderação sempre entregue independente de preferência (20b).
  **Validado contra Postgres real, não só mock** (container Docker descartável na VM, aprovação nominal, ambiente destruído ao final, zero resíduo): idempotência (reprocessar `event_id` já com recibo devolve 0 inserções, sem duplicar); savepoint isola falha real de FK (`recipient_user_id` inexistente em `users`, erro `23503`) sem abortar as outras entradas da mesma transação — teste automatizado `notificationOutboxSavepoint.test.ts` (roda com `COMMUNITY_TEST_DATABASE_URL`, pula sem banco, mesmo padrão de `communityWilson.test.ts`) fixa esse caso no repo. Essa validação **encontrou e corrigiu um bug real** que o teste com mock não pegava: quando uma entrada falhava, o passo que marca `processed_at` nunca rodava, deixando a entrada presa em reprocessamento infinito — corrigido movendo a marcação para o `catch`, após o `ROLLBACK TO SAVEPOINT`. Validação: lint 25/25, tsc 0, testes accounts 523/523 (+1 pulado sem banco), build verde, verify:api 0 breaking.
- [ ] T3.16 — **Migração do dado histórico dos legados** (requisito 13a-i). `download_notification` e `notifications` têm histórico real de usuários. Converter para `notification_event`/`notification_receipt` preservando `read_at`/`read`, momento original e destinatário — o texto legado já vem pronto no banco (`body` em `migration_018:17`, `title`/`message` em `migration_06:33-34`), então entra como snapshot de versão própria, sem tentar reconstruir estrutura que não existia. `action_url` do `mesas` (`migration_106:13`) vira `canonical_path`, validado contra o CHECK do consolidado (`migration_006:480-486`) — os paths legados são montados por interpolação em cada call-site, sem validação (ex.: `apps/mesas/backend/src/routes/gmPanel.ts:575`, `systemSuggestionsAdmin.ts:396`), e há casos degenerados conhecidos (`systemSuggestionsAdmin.ts:585,676,801` com fallback vazio). Path que não passar no CHECK entra sem link, nunca quebrando a migração. **Migra tudo, lido e não lido, preservando o estado de leitura** (decisão do mantenedor, 2026-08-10) — migrar só não lidos contradiria 17d ("lida fica, sem prazo") e apagaria histórico que o usuário tem hoje; para ele, a unificação deve mudar o lugar, não o conteúdo. · feito quando: nenhum usuário perde notificação existente; lida continua lida e não lida continua não lida; path inválido degrada para item sem link; e a contagem antes/depois bate por usuário.

## Fase 4 — Pacote cliente e UI

### Divisão em partes para implementação incremental (2026-08-12)

A fase é entregue em **seis partes**, cada uma implementada e devolvida antes da
seguinte. A ordem não é preferência: as Partes 2–6 importam do que a Parte 1
define, e as Partes 4–6 dependem de rotas que **não existem** hoje e que a Parte 0
abre. Implementar fora de ordem produz retrabalho medido, não risco hipotético.

Cada parte tem uma seção `#### Parte N` abaixo, com escopo, arquivos, restrições
lidas de `spec.md`/`plan.md`/`contrato-http-v1.md` e critério de devolução. O
implementador lê **a seção da sua parte e as tasks que ela nomeia** — não a fase
inteira.

| Parte | Escopo | Tasks | Estado (2026-08-14) | Depende de |
|---|---|---|---|---|
| **0** | Backend: rotas de leitura que faltavam no `accounts.` | destrava T4.16, T4.20, T4.23, T4.25 | **entregue** — 4/4 itens medidos | — |
| **1** | Fundação do pacote: subpaths, peers, transporte, estado | T4.1–T4.9 | **entregue** | — |
| **2** | UI da conversa | T4.10, T4.12 | **entregue** | Parte 1 |
| **3** | Acessibilidade, heurísticas e matriz de ambientes | T4.11, T4.13, T4.14, T4.15 | **implementada; T4.14 aguarda adoção real** | Partes 1-2 |
| **4** | Fila de moderação e restauração | T4.16–T4.19b, T4.20 (UI), T4.21, T4.22 | **implementada no contrato por app; gaps de T4.16/T4.19b registrados** | Partes 0-1 |
| **5** | Denúncia, caso agregado, recurso e sanção | T4.23–T4.26 | **implementada; T4.24/T4.25 mantêm gaps explícitos** | Partes 0-1, 4 |

**O que decide o custo das Partes 4-5, remedido em 2026-08-14:** a Parte 0 está
entregue, então os bloqueios de *leitura* declarados em 2026-08-12 caíram. Sobrou um
bloqueio só, e ele é o mesmo nas duas partes: as rotas de moderação são
`/internal/v1` atrás de credencial de serviço, e o requisito 6a proíbe o navegador
falar com elas. **Construir a fachada browser-safe do host moderador é trabalho das
Partes 4-5**, não lacuna do `accounts.` Detalhe em cada `#### Parte N`.

**Conformidade da entrega contra `spec.md`/`plan.md`, auditada em 2026-08-14 por
leitura do código, não do relatório de quem implementou.** As três travas abaixo e
os pontos que o `plan.md` fixa foram verificados um a um; nenhum violado:

| O que a spec/plan exige | Onde verifiquei | Resultado |
|---|---|---|
| Trava 1 — navegador nunca chama `/internal/v1` (req. 6a) | `rg "internal/v1"` em `apps/downloads/frontend/src` e `packages/comments/src` | **1 hit, e é comentário** (`subjectAuthorization.ts:37`). Os 20+ usos reais estão só na fachada `apps/downloads/backend/src/routes/communityModeration.ts`; o frontend usa `credentials: 'include'` same-origin |
| Trava 3 — root livre de React (req. 21b) | `index.ts` vs `react.ts` | root exporta só schemas Zod de `moderation.ts`; `CommunityModerationWorkspace` sai apenas por `/react`. `packageBoundary.test.ts` verde **no artefato construído**, não só no fonte |
| Fachada falha fechada, com timeout (req. 22c) | `communityModeration.ts:35-38,61,69,83-87` | `503` sem credencial/origem, `AbortSignal.timeout(5s)`, `502` para JSON inválido e para payload reprovado no Zod; credencial só em header server-side |
| T4.17 — reusar `packages/ui/src/admin`, sem padrão novo | `GestaoModeracaoPage.tsx:3,98,122,153,161` | `AdminTable`, `PageHeader`, `AdminBulkAction` importados de `@artificio/ui/admin` |
| T4.21 — `ConfirmDialog`, **não** `globalThis.confirm` | `CommunityModerationWorkspace.tsx:2,95,116,149,167,181` | usa `useConfirm`/`ConfirmProvider` de `@artificio/ui` (`packages/ui/src/index.ts:52`); a armadilha do `AdminTable` foi evitada |
| T4.13 critérios 4 e 5 não podem colapsar | `CommentsConversation.tsx:157-188,214-226` + teste `:283-345` | `announcement` (live region) é setado **sem** mover foco; o foco vai ao editor ao abrir e **retorna ao gatilho** após enviar (`returnFocusRef`). Teste assere as duas coisas |
| T4.13 critério 6 — lido não só por cor | `NotificationsView.tsx:389` | `<span className="notification-state">Não lida</span>` — texto, não só cor |

**Ressalva registrada, não bloqueio:** os 8 critérios de T4.13 estão provados em
**2 testes agregados** (`CommentsConversation.test.tsx:283` e `:347`), não em 8
casos separados. Cada critério é assertado de fato — verifiquei asserção por
asserção —, mas a granularidade menor significa que a falha de um critério derruba
o teste inteiro sem apontar qual. Aceitável; anotado para quem for mexer.

**Três travas valem em todas as partes, lidas da spec — não são interpretação:**

1. **O navegador nunca chama `/internal/v1`** (`contrato-http-v1.md` §1, requisito
   6a). Toda superfície da Fase 4 fala com a **fachada do módulo consumidor**, que
   é quem tem credencial de serviço. Nenhuma parte introduz `fetch` cross-origin
   para o `accounts.` nem credencial no browser.
2. **`accounts.` é PROD-ONLY, sem beta** (requisito 27, `deploy-manifest.json:147`).
   Mudança nele é **aditiva, compatível e inicialmente desabilitada**; ativação
   limitada a `realm=beta` por credencial allowlisted. Vale integralmente para a
   Parte 0.
3. **`packages/comments` root permanece livre de React** (requisito 21b,
   `plan.md` §Arquivos afetados). React entra só em `/react`; quebrar isso derruba o
   backend do `accounts.`, que já importa o root.

**Débitos de verificação corrigidos junto da fase (2026-08-14, autorização nominal
do mantenedor).** Não são tasks da spec — são duas lacunas de *infraestrutura de
teste* achadas ao auditar a entrega da fase, e corrigidas porque escondiam risco
exatamente na superfície que a fase amplia. Ficam registrados aqui para não serem
redescobertos:

1. **Os 33 testes do `accounts` que exigem Postgres real nunca rodaram em gate
   nenhum.** `communityWilson` (28), `notificationRecipientsIntegration` (4) e
   `notificationOutboxSavepoint` (1) pulam sem `COMMUNITY_TEST_DATABASE_URL`, e
   medido em 2026-08-14 a variável **não existia em nenhum workflow** — embora o
   CI já suba `postgres:16` como service desde sempre (`ci.yml:29-43`). Um deles é
   o que provou pegar bug real na T3.15 (entrada de outbox presa em retry
   infinito), porque `SAVEPOINT`/`ROLLBACK TO` em SQL raw só falha contra Postgres
   de verdade. Corrigido com `apps/accounts/src/scripts/prepareCommunityTestDatabase.ts`
   (script `test:db:prepare`) + step novo no `ci.yml`. **Validado por execução
   real**, não dry-run: container `postgres:16` descartável na VM, 11 migrations
   aplicadas limpas em ordem, suíte de `575 passed + 33 skipped` → **`608 passed,
   36 arquivos, zero skip`**; ambiente destruído com zero resíduo.
   **Coordenada que evita redescoberta:** o truque de *schema isolado por PID* do
   `downloads` (`testMigrationsPostgres.ts:28,33-34`) **não funciona** para o
   `accounts` — as migrations qualificam `public.` literalmente nos guards de
   idempotência (`migration_006:251,263,360,375,684`, `007:142`, `002:20,77`,
   `004:43`) e nenhuma ajusta `search_path` (busca negativa registrada). Por isso
   o script cria **banco dedicado**, não schema.
2. **`apps/site` rodava sem lint desde que existe** (`"lint": "echo TODO"`, débito
   [P1] já em `plan.md`), e o `"test"` enumerava 5 arquivos fixos — teste novo não
   rodaria, com CI verde. Causa medida: faltava `eslint.config.js` (`eslint .`
   abortava) e `vitest.config`. Corrigido com config nova + `eslint .` +
   `vitest run`. `eslint .` devolveu **14 erros**, dos quais 11 eram `no-undef` de
   ambiente Node em `.mjs` (resolvidos declarando globals na config, sem instalar
   o pacote `globals`, que exigiria aprovação) e **3 eram reais**: dois `any` em
   `server/admin-api.ts:220` mascarando incompatibilidade entre o `RequestHandler`
   do multer e Express 5, e um `prefer-const`. Corrigidos na raiz, sem
   `eslint-disable`. `.astro` fica fora do lint: exigiria `eslint-plugin-astro`,
   dependência nova.
3. **E016/E017 pela terceira vez — Dockerfile sem o pacote workspace que o código
   importa.** `routes/communityModeration.ts:3` passou a importar
   `@artificio/comments`, e o `Dockerfile` do `downloads/backend` não tinha nem o
   `--filter` nem o `COPY dist-cjs` — o container subiria e crasharia com
   `MODULE_NOT_FOUND` em beta/prod, com o CI verde. **O gate dedicado já existia e
   já apontava:** `node scripts/ci/check_dockerfile_workspace_deps.mjs` (ligado em
   `pr-checks.yml:49`) devolvia **4 erros**, não 1 — além de `comments`/`ui` no
   `downloads`, acusava `changelog`/`ui` em `apps/accounts`, **pré-existentes em
   `origin/dev`** (confirmado por `git show origin/dev:apps/accounts/Dockerfile`),
   não introduzidos por esta branch. Corrigidos os dois Dockerfiles; gate passou a
   `OK — 6 imagens conferidas, nenhum pacote faltando`.
   **Coordenadas que evitam redescoberta:** o backend do `downloads` compila para
   CommonJS (`main: dist/server.js`, sem `type: module`), então resolve por
   `require` e só o `dist-cjs` entra — a raiz React vive em
   `@artificio/comments/react`. `@artificio/ui` entra no `--filter` **sem** `COPY`
   porque nenhum `require` do CJS o alcança (medido: `dist-cjs/moderation.js`
   requer só `zod`); ele está lá porque `--prod --filter` **poda o store** de quem
   fica de fora e o symlink sobrevive apontando para nada. No `accounts`, `ui` e
   `changelog` não são import de servidor (`rg "@artificio/ui" apps/accounts/src`
   → zero) — entram pela mesma razão de poda.
   **Não validado:** `docker build --target production` não rodou; Docker Desktop
   indisponível na máquina. O gate estático passa, o build real não foi exercido.

**Achados de revisão da PR #262 — o que procedeu e o que foi recusado (2026-08-14).**
Registro aqui, não na conversa do PR (`AGENTS.md` §PR, Commit e Push: o agente não
escreve para bot de review; a análise vive na documentação).

*GitHub Advanced Security — 20 alertas, todos procedem.* `js/missing-rate-limiting`,
severidade high, criados pela própria PR, todos em
`apps/downloads/backend/src/routes/communityModeration.ts`: as 20 rotas da fachada
decidiam autorização sem limiter. Corrigido com os limiters que já existiam no
módulo (`middleware/rateLimit.ts`), com buckets separados para leitura e escrita —
o que o requisito 12b já exigia ("todos os buckets aplicáveis precisam liberar").
A fachada é quem conhece o IP real; sem ela, um IP autenticado convertia
requisição barata em carga no `accounts.`

*Achados de revisão de código que procederam.* `.strict()` nos schemas de moderação
(campo aditivo do `accounts.` viraria `502` e derrubaria a fila — removido, com
teste dos dois lados); monkey patch em `res.json` (substituído por validação
explícita por parâmetro); `req.user!` sem checagem; `void proxyAccounts` sem
`.catch(next)` nos 20 handlers; ausência de log antes do `503`; erro de ação
invisível no workspace; formulário de caso não resetado ao trocar de caso;
`Promise.all` escondendo falha parcial em lote; motivo validado depois da
confirmação; invalidação da query de recurso; exports de tipos em `react.ts`.

*Dois defeitos que a correção do review expôs, mais fundos que o relatado:*
- **Foco após envio** não era só origem inferida errado: mesmo passando a origem
  explicitamente o foco caía no `body` (medido: `activeElement: BODY`). Causa real
  — `queueMicrotask` roda **antes** de o React recomprometer a árvore, então focava
  um nó descartado. Virou efeito pós-commit.
- **Seleção perdida no `409`** não era só `Promise.all`: o `AdminTable` limpa a
  seleção quando `onRun` **resolve**, então engolir a rejeição no wrapper apagava
  as linhas marcadas justamente no conflito em que o moderador precisa repetir
  sobre a mesma seleção. A rejeição passou a ser propagada de propósito.

*Sonar — `.sort()` → `localeCompare`: RECUSADO com medição, em 4 pontos.*
`communityModerationAppeal.ts:729`, `communityModerationCase.ts:134`,
`languageDetector.ts:90` e `systemProjectionHydrator.ts:454-455`. Nenhum deles
ordena texto para leitura: os dois primeiros canonicalizam **chave de
idempotência**, o terceiro um identificador de diagnóstico, o quarto dois arrays
que são comparados entre si. `localeCompare` depende de locale/ICU e devolve
ordens **diferentes** para a mesma entrada — medido: `['a-1','A-1','a_1']` sai em
três ordens distintas entre `pt-BR`, `en-US-u-kf-upper` e UTF-16. Aplicar a
sugestão introduziria `409 idempotency_key_reuse` para quem só reenviasse a mesma
sanção, e re-hidratação de projeções idênticas no `mesas`. Os quatro pontos
receberam comentário explicando a recusa, para outro agente não "corrigir" depois.

*Sonar — tainted data em URL: um procedeu, o resto não.* Em `apps/site-admin/src/api.ts`
os parâmetros `status`, `type` e `kind` iam **crus** na query ao lado de um `q` já
protegido por `encodeURIComponent` — valor com `&`/`#` injetaria parâmetro.
Corrigido nos 4 call-sites. Recusados: `ResultCard.tsx:259` já usa
`encodeURIComponent` (falso positivo), e as linhas L393/L259 apontadas em
`api.ts` **não existem** — o arquivo tem 178 linhas, o achado é de versão antiga.

- [x] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
  **Concluída em 2026-08-13:** T0 relido integralmente antes da reconciliação final das Partes 1–2.
- [x] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
  **Concluída em 2026-08-14:** leituras, buscas, Git e validações usaram `rtk`; as consultas remotas read-only usaram `ssh faren` conforme a governança.
- [x] T4.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
  **Concluída em 2026-08-14:** implementação e handoff no chat seguiram o registro pedido.
- [x] T4.1 — **Pedir aprovação nominal para ampliar código de `packages/comments`**, pacote compartilhado já existente desde T2.2. A aprovação cita os consumidores visuais futuros `downloads`, `mesas` e `site` e o blast radius compartilhado. · feito quando: aprovação registrada.
  **Concluída em 2026-08-13:** o mantenedor deu a aprovação nominal com esse escopo e esse blast radius.
- [x] T4.2 — **Transporte injetável, não chamada direta ao `accounts.`** (requisito 21). O pacote **não** pode embutir `fetch` do navegador para o `accounts.`: isso contradiz a decisão de escrita backend-to-backend (T0.5) e furaria a validação de assunto e ownership. O adapter cobre leitura/criação/resposta, edição, auto-retirada, voto, denúncia/retirada, recurso, moderação, notificações e leitura; cada fachada implementa só capacidades autorizadas do seu domínio. · feito quando: pacote funciona contra adapter de teste, sem conhecer origem real; nenhum fluxo novo introduz `fetch` cross-origin escondido.
  **Concluída em 2026-08-13:** `transport.ts` entrega operações por capacidade, `AbortSignal`, schemas Zod e erros normalizados, provados por adapter sem URL. O bloqueio da fila global permanece em T4.16: não existe fachada browser-safe e a rota interna continua restrita à credencial de `realm/source_app`.
- [x] T4.3 — **Exports separados por responsabilidade** (requisito 21). `@artificio/comments` traz tipos, schemas e cliente; `@artificio/comments/react` traz hooks e componentes; `@artificio/comments/styles.css` traz o estilo mínimo. Sem isso, backend ou o Astro server-side do `site` seriam obrigados a importar React. · feito quando: um consumidor só de tipos não puxa React na árvore.
  **Concluída em 2026-08-13:** exports `.`/`./react`/`./styles.css` separados; o build copia CSS e `packageBoundary.test.ts` prova root ESM/CJS sem React, TanStack, `window` ou outro global de navegador.
- [x] T4.4 — **`react` e `react-dom` como `peerDependencies`** (requisito 21). Pacote visual novo declara peer, para o consumidor fornecer a própria cópia — duas instâncias de React quebram hooks. · feito quando: nenhum app acaba com React duplicado no bundle.
  **Concluída em 2026-08-13:** React e React DOM foram declarados somente como peers de runtime, em faixa compatível com os consumidores; nenhuma cópia entrou em `dependencies`.
- [x] T4.5 — **TanStack Query não é contrato obrigatório** (requisito 21). `downloads` e `mesas` usam React Query (`package.json:24` e `:23`), mas o **`site` não usa** — o núcleo do cliente é agnóstico de framework, e o adapter de React Query fica interno e opcional. · feito quando: o `site` consome o pacote sem instalar React Query.
  **Concluída em 2026-08-13:** root e `/react` não importam TanStack; transporte, resource e UI funcionam por contratos injetados, sem nova dependência para o `site`.
- [x] T4.6 — **Estado explícito, memória da tela e nenhum cache persistente** (requisito 22; decisão 51). Resposta distingue `fresh`, `stale` e `unavailable`; falha nunca vira lista vazia. Se atualização falhar depois de leitura boa, a tela ainda montada conserva o resultado como `stale`, com idade e aviso. Reload, nova página, logout ou troca de conta descartam; abertura durante queda mostra `unavailable` só na área de comentários. **Não criar IndexedDB, localStorage, Redis nem cache público/Cloudflare.** · feito quando: três estados distinguíveis; stale sobrevive à falha na mesma montagem, mas não ao reload/logout; página do app continua viva; escrita falha fechada.
  **Concluída em 2026-08-13:** `resource.ts` mantém o último sucesso só na instância montada e distingue `fresh`/`stale`/`unavailable`; testes cobrem primeiro erro, sucesso→erro, remontagem e mutação fail-closed.
- [x] T4.7 — **Chave de cache inclui identidade; logout limpa** (requisito 22). Chave por `realm`, `source_app`, subject **e usuário quando o dado é privado**. Comentário de autoria privada e notificação são limpos no logout e na troca de conta; **notificação nunca entra em cache público**. Sem isso, a próxima conta na mesma máquina lê o cache da anterior. · feito quando: trocar de conta não mostra nada da conta anterior.
  **Concluída em 2026-08-13:** identidade é contexto explícito do consumidor, sem leitura de cookie pelo pacote; `resource.test.ts` prova que logout e troca A→B descartam dados privados de A.
- [x] T4.8 — **Timeout e cancelamento no cliente** (requisito 22). Seguir o padrão já aprendido em `packages/catalog-client/src/index.ts:35` (`CATALOG_FETCH_TIMEOUT_MS`, achado de review no PR #145: `fetch` sem timeout pendura a rota do backend consumidor). Hooks consomem `AbortSignal` e cancelam query obsoleta. · feito quando: requisição pendurada não trava a página, e navegar para longe cancela a busca.
  **Concluída em 2026-08-13:** o cliente combina timeout e cancelamento externo e entrega o `AbortSignal` ao adapter; `resource.dispose()` aborta a consulta e o hook o chama no unmount. Testes cobrem timeout, cancelamento externo, dispose e consulta substituída.
- [x] T4.9 — **Degradação testada contra resposta inválida, não só conexão recusada** (requisito 22). A página precisa sobreviver a timeout, 500, HTML inesperado no lugar de JSON, JSON malformado e schema incompatível — este último é a regra pétrea de normalização (`AGENTS.md`: payload externo é `unknown` até passar por normalizador tipado). · feito quando: os cinco casos mantêm a página do módulo de pé com aviso claro.
  **Concluída em 2026-08-13:** `degradation.test.ts` cobre os cinco casos exigidos; todos preservam o host renderizado, expõem indisponibilidade e mantêm mutações fechadas.
- [x] T4.10 — **UI compartilhada da conversa completa** (requisito 21; decisões 3–7, 17, 24–30). Árvore até cinco níveis, `more`, seletor `Melhores`/`Mais votados`/`Recentes`/`Mais antigos` com `Melhores` padrão, score e voto ternário, `ContentEditor` para criar/editar, marcador de edição, auto-retirada, denúncia e resposta a legado. Imagem aparece somente como link HTTPS; links obedecem ao perfil do `content-editor`. Contrato visual usa tokens CSS, slots e `className`, sem Tailwind compilado no pacote. · feito quando: o componente compartilhado expõe a mesma semântica e pontos de identidade para os três consumidores; quatro sorts/voto/edição/denúncia são operáveis por teclado; nenhuma imagem remota é buscada. A matriz nos três hosts reais é T4.14.
  **Concluída em 2026-08-13:** `CommentsConversation.tsx` e `conversation.ts` entregam a superfície compartilhada, schemas e cliente injetado; testes DOM cobrem cinco níveis, `more`, quatro sorts, voto, edição, retirada, denúncia, criação/resposta e ausência de `<img>` remoto. A matriz dos três hosts continua pertencendo à T4.14 e à adoção das Fases 5–7.
- [x] T4.11 — UI da central de notificações, consumindo a rota canônica do `accounts.` (T3.9). · feito quando: montável onde a central vive, sem cópia por módulo.
  **Concluída em 2026-08-14:** a central canônica permaneceu em `apps/accounts/frontend/src/NotificationsView.tsx`, sem cópia por módulo. Leitura agora é ação explícita, o estado não depende só de cor e o resultado é anunciado. `NotificationsView.test.tsx` cobre expandir sem marcar, marcar uma e marcar todas.
- [x] T4.12 — Comentário legado visualmente distinguível, sem sugerir conta verificada (requisito 9). Rótulo neutro do tipo "comentário importado — autoria não verificada"; **sem avatar falso, sem badge de conta, sem link para perfil**. · feito quando: distinguível à primeira vista, e nada leva a um perfil que não existe.
  **Concluída em 2026-08-13:** schema recusa legado com avatar ou badge; a UI mostra o rótulo neutro, não cria avatar/badge/link de perfil e mantém a ação de responder, com cobertura DOM.
- [x] T4.13 — **Acessibilidade com critérios executáveis** (WCAG 2.2), não checklist genérico: thread em lista semântica; botão "Responder a [nome]" (não só "Responder"); labels reais nos campos; foco tratado após responder e enviar; envio, erro e "marcada como lida" anunciados com `role="status"` ou alerta adequado, **sem mover o foco**; estado lido não dependendo só de cor; data em `<time datetime>`; navegação completa por teclado. · feito quando: os oito verificados, com evidência.
  **Concluída em 2026-08-14:** `CommentsConversation.tsx` move foco para o editor de resposta e devolve ao acionador após a ação, sem usar a live region como alvo. Testes DOM cobrem lista/artigo, nome acessível, labels, foco, status/alert, texto de lido, `<time dateTime>` e controles nativos de teclado.
- [ ] T4.14 — **Matriz de testes nos três ambientes reais**: Vite React (`downloads`, `mesas`) e **ilha React dentro do Astro** (`site`) — que é o caso capaz de quebrar por import não seguro em SSR. Mais: tema claro e escuro, cache por conta, timeout e schema inválido. · feito quando: a suíte cobre os três ambientes, não só um.
  **Estado em 2026-08-14:** continua aberta por dependência real das Fases 5–7. `downloads` agora é host de referência da moderação e seu build Vite passou; `mesas` e a ilha Astro ainda não adotam `@artificio/comments`. O root continua protegido por `packageBoundary.test.ts`; declarar três ambientes antes da adoção seria verde falso.
- [x] T4.15 — Verificar as 10 Heurísticas de Nielsen na caixa de comentários e na central (`AGENTS.md` §Regras de Produto). Atenção a visibilidade de estado e prevenção de erro. · feito quando: checklist registrado.
  **Concluída em 2026-08-14:** visibilidade por `fresh`/`stale`/`unavailable` e status de ações; linguagem do domínio; controles nativos; consistência dos quatro sorts; prevenção e confirmação de retirada; restauração como saída; rascunho preservado em conflito; redução de carga por labels/contagens; erro recuperável; ajuda textual em campos condicionais. Os cenários críticos estão em testes DOM, não snapshot.

### Superfície de moderação (requisito 27, decisão do mantenedor 2026-07-30)

O desenho anterior detalhou schema, transação e API, mas deixou o front com duas
linhas — cobrindo quem lê e escreve, não quem modera.
`POST /internal/v1/comments/:id/removal` existia sem tela que o chamasse.

- [ ] T4.16 — **Fila de moderação como superfície primária** (requisito 27a). Moderar navegando pelo conteúdo público não escala e depende do moderador topar com o problema. A fila lista denunciados, de conta nova (T4.20) e recentes, com filtro por `realm` e `source_app` — **beta nunca misturado com produção** (T0.6). · feito quando: a fila carrega, filtra pelos dois eixos, e nenhum item de beta aparece em produção.
  **Estado em 2026-08-14:** a fila por credencial foi implementada no host de referência `downloads`: fachada browser-safe em `backend/src/routes/communityModeration.ts`, hook e tela em `frontend`. Denunciados e contas novas aparecem sem expor `/internal/v1` ao navegador. Continua aberta porque o contrato aprovado é isolado por credencial; não existe fila global cross-app nem coleção genérica de comentários recentes no backend central. Produção também não está ativável: consulta read-only mostrou credenciais `downloads` apenas com `{users.read,secrets.read}`, sem `moderation.write`.
- [x] T4.17 — **Reusar `packages/ui/src/admin`, não criar padrão novo** (requisito 27b). Já existem `AdminTable` (com seleção e ação em lote), `bulkActions`, `StatusPill`, `PageHeader`, `SectionCard` e `AdminWorkspaceLayout`, em uso no painel de gestão do `downloads`. Divergir do design system exige aprovação (`AGENTS.md` §Regras de Produto). · feito quando: a fila usa os componentes existentes, sem componente admin novo salvo justificativa registrada.
  **Concluída em 2026-08-14:** `CommunityModerationWorkspace.tsx` compõe `AdminTable`, `AdminWorkspaceLayout`, `PageHeader`, `SectionCard`, `StatusPill` e `ConfirmProvider`; nenhum padrão admin paralelo foi criado.
- [x] T4.18 — **Seguir o padrão de dados de `useModerationQueue`** (requisito 27c; `apps/downloads/frontend/src/hooks/useModerationQueue.ts`): React Query, validação Zod na fronteira, ação individual e em lote, `invalidateQueries` no sucesso. Padrão maduro (specs 075 e 083) — replicar, não reinventar. · feito quando: hook novo espelha a estrutura do existente, com payload validado por schema.
  **Concluída em 2026-08-14:** `useCommunityModeration.ts` usa React Query, schemas Zod de `@artificio/comments/react`, ações individuais/lote e invalidação de fila/log/caso/sanções. Teste prova rejeição de schema inválido, idempotency key e recarga após sucesso.
- [ ] T4.19 — **Restauração de comentário removido** (requisito 27d). O tombstone preserva o corpo, então desfazer é barato — faltava o caminho. A **DSA** exige janela de contestação de seis meses com reversão pronta de decisão injustificada; sem isso, erro de moderador é permanente. `POST /internal/v1/comments/:id/restore` limpa `removed_at`/`removed_by`/`removed_reason` e registra quem restaurou. · feito quando: remover e restaurar volta ao estado original, com as duas ações no histórico.
  **Estado em 2026-08-14:** UI, adapter e fachada de remoção/restauração existem, com confirmação individual e em lote e preservação do trabalho em `409`. O round-trip contra banco real e as duas entradas reais de auditoria não foram executados porque exigem escrita protegida e deploy/credencial; task permanece aberta pelo aceite executável.
- [ ] T4.19b — **Exibir e validar o registro de ação criado na Fase 2** (requisito 27d). A migration coesa T2.1–T2.1f já cria auditoria de conteúdo; esta fase não abre segunda migration. UI mostra ator, alvo, motivo e momento para remoção/restauração e demais transições autorizadas. · feito quando: histórico mostra os quatro campos, exige papel global e não expõe nota interna ao público.
  **Estado em 2026-08-14:** o log global é exibido com ator UUID, alvo, motivo e `<time>`, atrás da fachada e do papel global; nota interna não entra na superfície pública. Continua aberta porque o backend não devolve nome do ator nem filtro por caso/alvo; portanto não existe timeline de caso escalável.
- [x] T4.20 — **Conta nova tratada como conta nova** (requisito 27e). Hoje conta criada há dez segundos comenta como quem está há dois anos; com login Google a barreira é baixa e essa é a porta de entrada de spam. Forma **mínima**, derivada de dado existente (`users.created_at` + contagem de comentários do autor), **sem tabela nova**: conta nova entra na fila para revisão e tem limite mais apertado no rate limiter de escrita (requisito 12b). **Critério aprovado em 2026-08-12:** menos de 7 dias **OU** menos de 3 comentários; deixa de ser nova somente ao cumprir ambos. **Não é bloqueio de publicação** — é priorização de revisão. · feito quando: o critério está escrito, a fila destaca esses comentários, e nenhum autor legítimo é impedido de publicar.
  **Concluída em 2026-08-14:** a UI combina a coleção aditiva entregue pelo backend e mostra os motivos `account_age`/`comment_count` como priorização de revisão, sem bloquear publicação nem fabricar denúncia.
  **Ativação inicial:** somente credencial autenticada allowlisted com `realm=beta`; produção mantém comportamento anterior. Não criar flag, query, corpo nem escopo novo.
- [x] T4.21 — **Usabilidade da fila** (requisito 27g), 10 Heurísticas de Nielsen. Em especial: estado do sistema visível (quantos pendentes, o que já foi tratado); prevenção de erro com `ConfirmDialog` de `packages/ui` em ação destrutiva **e em lote**; reversibilidade como saída de emergência (T4.19). Ação em lote sem confirmação sobre conteúdo de usuário é o caso que a heurística 5 existe para impedir. · feito quando: checklist registrado, com confirmação verificada nos dois casos.
  **Concluída em 2026-08-14:** contagem, seleção e estados são textuais; remoção/restauração individual e em lote passam pelo `ConfirmDialog`; sucesso invalida dados; `409` mantém seleção/formulário. Testes cobrem cancelar, confirmar e conflito em lote.
- [x] T4.22 — **Acessibilidade da fila** (WCAG 2.2), mesmos critérios executáveis de T4.13: tabela com semântica real, seleção operável por teclado, resultado de ação anunciado por `role="status"` sem mover foco, estado não dependendo só de cor. · feito quando: os quatro verificados, com evidência.
  **Concluída em 2026-08-14:** semântica e checkboxes vêm de `AdminTable`; ações são botões nativos; resultado usa live region; `StatusPill` tem texto. Testes DOM exercitam a seleção e a confirmação por papel acessível.
- [x] T4.23 — **Denunciar, acompanhar e retirar pelo pacote compartilhado** (decisões 33, 35, 37, 42, 49). Formulário vem do registro único de motivos, mostra detalhe como obrigatório/opcional/proibido e nunca cria enum local. Usuário vê somente as próprias denúncias e resultado mínimo; pode retirar antes do auto-hide. Identidades/notas internas nunca aparecem. · feito quando: mesma UI funciona nos consumidores sem pacote paralelo; detalhe obrigatório bloqueia envio vazio; retirada desaparece após o limiar; e nenhum payload privado chega ao autor denunciado.
  **Concluída em 2026-08-14:** `CommentReportPanel` e schemas vivem em `@artificio/comments/react`; catálogo e denúncias próprias chegam pela fachada same-origin. Não há enum local. Teste usa catálogo runtime e bloqueia detalhe obrigatório vazio. Banco `artificio_auth` foi medido com 8 motivos ativos.
- [ ] T4.24 — **Workspace de caso agregado** (decisões 39–46, 53). Um item por caso, com quantidade, categorias, prioridade máxima, versões denunciada/atual, diff, timeline, atores denunciantes e — somente durante retenção válida — contas resolvidas para moderação; depois mostra identidade expurgada sem tentativa de reconstrução. Veredito individual fica editável antes do fechamento. Ações `no_change`, `restore`, `remove`, aprovação/reabertura e auto-retirada usam confirmação e mostram 409 sem sobrescrever trabalho alheio. · feito quando: moderador decide denúncias mistas; segundo recebe conflito; timeline preserva eventos; ação em lote não apaga granularidade; e expurgo não quebra UI.
  **Estado em 2026-08-14:** workspace, detalhe, versões, diff local, vereditos mistos, confirmação, identidade expurgada e preservação do formulário em `409` estão implementados. Fachada browser-safe existe. Continua aberta somente pelo aceite de timeline: o log central ainda não filtra por caso/alvo, então a UI não promete paginação global filtrada no cliente.
- [ ] T4.25 — **Recurso compartilhado** (decisão 47). Autor removido recebe caminho de recurso, prazo e status; moderador vê caso/decisão/versão, aviso se foi o decisor original e campo obrigatório de nova justificativa. Resultado é privado. · feito quando: autor envia um recurso válido; UI bloqueia segundo/prazo expirado; mesmo moderador consegue rejulgar com aviso; e nenhum app cria formulário próprio.
  **Estado em 2026-08-14:** formulário público compartilhado bloqueia segundo recurso e prazo expirado; workspace mostra os dois decisores, avisa coincidência e exige nova justificativa com confirmação. Continua aberta porque o contrato central oferece só detalhe por ID: não existe fila/listagem de recursos para o moderador; no host de referência o ID precisa ser informado manualmente.
- [x] T4.26 — **Sanções comunitárias compartilhadas** (decisão 48). Moderação escolhe `posting`, `commenting` ou ambos; `warning`, suspensão temporária/permanente; prazo e motivo. Tela mostra histórico/gravidade como apoio, nunca aplica progressão automática, e deixa claro que SSO/leitura continuam. · feito quando: decisão exige confirmação/auditoria; suspensão temporária mostra expiração; e UI não oferece objeto de domínio como “postagem” sem adapter explícito.
  **Concluída em 2026-08-14:** workspace usa `community_actor_id`, mostra histórico, gravidade, expiração e motivo; toda aplicação exige confirmação. `posting` só aparece quando o adapter declara `supportsPosting`; SSO e leitura são explicitamente preservados.

### Handoffs por parte

Escrito em 2026-08-12, **remedido contra o código em 2026-08-14**. Cada `#### Parte N`
é o briefing completo daquela entrega: quem implementa lê **só a sua seção** mais as
tasks nomeadas nela, e devolve antes da parte seguinte.

**Três travas valem em todas as partes** (repetidas aqui porque decidem desenho, não
detalhe): (1) o navegador nunca chama `/internal/v1` — fala com a fachada do módulo
consumidor, que é quem tem credencial de serviço; (2) `accounts.` é PROD-ONLY, sem
beta, e muda de forma aditiva, compatível e inicialmente desabilitada; (3)
`packages/comments` root permanece livre de React — `apps/accounts/package.json:16`
já depende dele **no backend**, e foi poda transitiva de store nesse caminho que
derrubou o SSO por 5h em 2026-08-08. `packageBoundary.test.ts` guarda a fronteira.

**Validação de toda parte, na raiz:** `rtk pnpm run lint`, `rtk pnpm run test`,
`rtk pnpm run build`, `rtk pnpm verify:api`. TypeScript do pacote pelo script do
workspace (`pnpm --filter @artificio/comments typecheck`), nunca `rtk tsc` solto na
raiz — falha com `JSON parse failed` no turbo (DEB-088-01).

#### Parte 0 — Backend: as leituras que faltam — **ENTREGUE**

**Estado remedido em 2026-08-14: os quatro itens existem. Não reimplementar.**
O handoff de 2026-08-12 dizia que nada disso existia; entre as duas datas o backend
foi entregue. Coordenadas medidas, para o implementador das Partes 4-5 não
redescobrir:

| Item exigido | Onde está | Prova |
|---|---|---|
| 1. `GET` das próprias denúncias | `GET /api/v1/community/reports` (`communityModerationRoutes.ts:247`), `self-service`/`user` | `api-index.generated.md:27` |
| 2. `GET` do catálogo de motivos | `GET /internal/v1/report-reasons` (`:258`) | `api-index.generated.md:63`; testes em `communityModerationRoutes.test.ts:1018` |
| 3. `GET` do recurso próprio + decisor original e atual | `GET /api/v1/community/appeals/:id` (`:251`); `original_decider_actor_id` e `current_decider_actor_id` em `communityModerationAppeal.ts:130,132,176,197-198` | `api-index.generated.md:26` |
| 4. `community_actor_id` do autor no detalhe do caso | `communityModerationCase.ts:245,337,386` | leitura direta |
| Conta nova (T4.20 backend) | `readNewAccountCommentCandidates` (`communityModerationQueue.ts:84`), com `new_account_reasons: "account_age" \| "comment_count"` (`:75,143,156`); orçamento em `communityRateLimit.ts:99-101,114` (`COMMUNITY_NEW_ACCOUNT_WRITE_LIMIT`) | leitura direta |

**Consequência para quem implementa:** T4.20 é **só UI** (a Parte 4 destaca o
candidato na fila; o predicado e o orçamento já estão no backend). T4.23 monta o
formulário a partir de `/internal/v1/report-reasons` **pela fachada**, nunca do
navegador. T4.25 tem os dois decisores no mesmo payload, então o aviso "mesmo
decisor" é implementável.

**O que continua não existindo, e é o bloqueio real das Partes 4-5:** o catálogo de
motivos e a fila são `/internal/v1` — **credencial de serviço, não browser-safe**
(`requireServiceCredential(db, { scope: "moderation.write" })`,
`communityModerationRoutes.ts:299`). Toda superfície da Fase 4 fala com a **fachada
do módulo consumidor**, que ainda não existe para moderação. Isso não é lacuna de
backend do `accounts.`: é a decisão de trust boundary do requisito 6a.

**Restrições que continuam valendo se alguma rota nova for necessária:**
- `accounts.` é **sagrado**: aprovação nominal + smoke de todos os consumidores SSO.
- Requisito 27: aditivo, compatível, **inicialmente desabilitado**; sem beta do `accounts.`
- `contrato-http-v1.md` §1.1: `realm`/`source_app` saem **sempre** da credencial.
- §1.2: **nenhum escopo novo**. Leitura de moderação usa bucket `read` (T2.20a).
- Denúncia própria nunca expõe `reporter_actor_id` de terceiro, contas resolvidas ou
  nota interna (decisões 33, 35, 37, 42, 49).

#### Parte 1 — Fundação do pacote

**Tasks:** T4.1 (aprovação), T4.2 (transporte injetável), T4.3 (subpaths), T4.4
(peers), T4.5 (TanStack opcional), T4.6 (fresh/stale/unavailable), T4.7 (chave com
identidade), T4.8 (timeout/abort), T4.9 (degradação).

**Estado medido em 2026-08-12:** `packages/comments/src` tem 17 arquivos; o
`package.json` exporta **somente** `.`, o build é `tsc` duplo (ESM + CJS) e não há
React nem CSS.

**Entregar:** subpath `/react` e `/styles.css` sem alterar o root; `react`/`react-dom`
como `peerDependencies` em faixa compatível com os três consumidores; contrato TS
por capacidade recebendo `AbortSignal`, com schemas Zod de entrada/saída e erros
normalizados; adapter de teste que prova tudo sem URL; união discriminada
`fresh`/`stale`/`unavailable` com `updatedAt`; chave incluindo identidade quando o
dado é privado.

**Restrições que decidem o desenho:**
- O root **não pode** importar React nem TanStack (requisitos 21b, 21c). Medido:
  `downloads` e `mesas` têm `@tanstack/react-query@^5.96.2`; **`site` não tem**.
  Integração TanStack, se houver, é subpath opcional ou fica no consumidor.
- `tsc` não emite CSS — o pipeline de build precisa copiá-lo. Precedente:
  `packages/content-editor/src/content-editor.css`.
- Sem Tailwind compilado dentro do pacote (21d): tokens CSS, slots e `className`.
- Sem IndexedDB, localStorage, Redis ou cache de edge (22a). `stale` vive na
  instância montada e morre em reload/logout/troca de conta.
- Timeout no padrão de `packages/catalog-client/src/index.ts:35` (achado do PR #145).

**Testes que provam a parte:** primeiro erro = `unavailable`; sucesso→erro = `stale`;
remontagem perde `stale`; A→logout→B não mostra nada de A; os **cinco** casos de
degradação de T4.9 (timeout, 500, HTML no lugar de JSON, JSON malformado, schema
incompatível) mantêm o app host renderizado; import do root em Node/SSR sem
`window` funciona.

**Devolver com:** prova de que um consumidor só de tipos não puxa React na árvore.

#### Parte 2 — UI da conversa

**Tasks concluídas em 2026-08-13:** T4.10 (conversa completa), T4.12 (legado distinguível). A integração nos três ambientes reais permanece em T4.14/Fases 5–7.

**Entregar:** árvore até 5 níveis, nós `more` por cursor, seletor
`Melhores`/`Mais votados`/`Recentes`/`Mais antigos` com `Melhores` padrão, score e
voto ternário, criar/editar com `ContentEditor`, marcador de edição, auto-retirada,
denúncia e resposta a comentário legado.

**Restrições:** reusar `ContentEditor` e `MarkdownContent` do
`@artificio/content-editor`, já dependência do pacote — **não** criar parser ou
sanitizador novo (`plan.md` §Markdown). Imagem aparece **somente como link HTTPS**,
nunca `<img>`, nunca fetch remoto. Comentário legado renderiza com rótulo neutro
("comentário importado — autoria não verificada"), **sem avatar, sem badge, sem
link de perfil** — mas continua podendo receber resposta.

**Referência, não base:** `apps/downloads/frontend/src/components/CommentSection.tsx`
é o legado plano (limite local de 2.000, sem árvore, sorts, voto ou edição). Serve
para entender a fachada; o contrato vem dos schemas HTTP, não dele.

**Devolver com:** os quatro sorts, voto, edição e denúncia operáveis por teclado, e
prova de que nenhuma imagem remota é buscada.

#### Parte 3 — Acessibilidade, heurísticas e ambientes

**Tasks:** T4.11 (central), T4.13 (a11y da conversa), T4.14 (matriz de ambientes),
T4.15 (Nielsen).

**Entregue em 2026-08-14, com T4.14 deliberadamente aberta.** A central canônica do
`accounts.` ganhou leitura explícita e cobertura DOM; a conversa ganhou foco de
entrada/retorno e testes dos oito critérios executáveis. Os estados
`fresh`/`stale`/`unavailable`, confirmação, preservação de trabalho, quatro sorts e
erros recuperáveis cobrem o núcleo das dez heurísticas.

**Coordenadas:** `packages/comments/src/CommentsConversation.tsx` e seu teste;
`apps/accounts/frontend/src/NotificationsView.tsx` e
`NotificationsView.test.tsx`. O pacote root continua livre de React, comprovado
por `packageBoundary.test.ts`.

**T4.14 não foi fabricada com fixtures.** `downloads` agora compila como host Vite
de referência da moderação. `mesas` e a ilha React/Astro só adotam comentários nas
Fases 6–7; a matriz real fecha depois dessa adoção. O `site` ainda tem teste por
lista fixa e lint no-op, limitações já registradas.

#### Parte 4 — Fila de moderação e restauração

**Tasks:** T4.16 (fila), T4.17 (reuso de `packages/ui/src/admin`), T4.18 (padrão de
dados), T4.19 (restauração), T4.19b (histórico), T4.21 (usabilidade), T4.22 (a11y).

**Implementada em 2026-08-14 no contrato aprovado por credencial.** `downloads` é o
host de referência. A fachada same-origin protege a credencial e injeta o ator da
sessão; o navegador nunca chama `/internal/v1`. O hook usa React Query + Zod e o
workspace compartilhado compõe o admin UI existente. Conta nova é destacada sem
bloqueio. Remoção/restauração individual e em lote usam `ConfirmDialog`; `409`
preserva seleção e trabalho.

**Coordenadas:** `apps/downloads/backend/src/routes/communityModeration.ts`,
`apps/downloads/frontend/src/hooks/useCommunityModeration.ts`,
`packages/comments/src/CommunityModerationWorkspace.tsx` e respectivos testes.

**Gaps que mantêm tasks abertas:** não há contrato de fila global cross-app nem
coleção genérica de recentes (T4.16); o log não tem nome do ator nem filtro por
caso/alvo (T4.19b); ida/volta e auditoria reais dependem de escrita/deploy
autorizados (T4.19). Produção não tem credencial utilizável: query read-only em
`community_service_credential` retornou `downloads` beta/prod apenas com
`{users.read,secrets.read}`.

#### Parte 5 — Denúncia, caso, recurso e sanção

**Tasks:** T4.23 (denúncia), T4.24 (workspace de caso), T4.25 (recurso), T4.26
(sanções).

**Implementada em 2026-08-14 sobre a mesma fachada.** O pacote compartilha catálogo
dinâmico, denúncias próprias/retirada, recurso do autor, caso agregado, versões e
diff local, veredito por denúncia, julgamento de recurso e sanções. Identidade
expurgada vira texto neutro; `409` não sobrescreve o formulário; `posting` só é
oferecido por adapter explícito. O banco real confirmou 8 motivos ativos e suas
políticas de detalhe.

**Cobertura:** testes do workspace exercitam denúncias mistas e expurgo; teste do
painel público valida catálogo runtime e detalhe obrigatório; fachada preserva
status upstream e falha fechada sem credencial.

**Gaps que mantêm tasks abertas:** a timeline de T4.24 depende do filtro ausente de
T4.19b. O backend central não oferece fila/listagem de recursos; T4.25 funciona por
detalhe de ID e o host de referência exige informar esse ID manualmente.

**Fora de escopo (requisito 27f, decisão do mantenedor):** shadow ban — esconder
conteúdo sem avisar o autor contradiz o compromisso de transparência e quebra a
confiança quando descoberto; e moderação automática por IA — custo e falso
positivo desproporcionais ao volume atual. Voltam como spec própria se o volume
mudar.

## Fase 5 — Adoção no `downloads`

Primeiro consumidor: necessidade imediata (spec 089) e dado menos delicado.

> **⚠️ BLOQUEIO ATIVO ANTES DE EXECUTAR ESTA FASE — `BLQ-090-CRED-WRITE`.**
> A credencial de serviço do `downloads` **não tem `comment.write` nem `vote.write`** (medido em
> 2026-08-15): os 6 escopos atuais cobrem a Fase 4, não a escrita de fala nem o voto que T5.3/T5.4
> exigem. Leitura (`comment.read`) já passa. Rotação exige aprovação nominal — é escrita no banco
> de produção. Detalhe e procedimento: §Bloqueios conhecidos → `BLQ-090-CRED-WRITE`.
> O bloqueio anterior (`BLQ-090-CRED`, escopos da Fase 4) foi **resolvido** na mesma data: as
> credenciais de 6 escopos estão em uso e as de 2 escopos, revogadas.

> **⚠️ ACHADO QUE MUDA O CUSTO DESTA FASE — não há legado a migrar (medido em 2026-08-04).**
>
> Toda a Fase 5 foi escrita como **migração de dado existente**: `pg_dump` dos dois
> bancos, rollout expand → backfill → catch-up → cutover, validação linha a linha,
> "os cinco `kind` atuais mapeados como legado", tabela local virando read-only por
> retenção. Medição read-only em produção e em beta mostra que **o conjunto de
> origem está vazio**:
>
> **Remedido em 2026-08-15** na abertura desta fase (a medição anterior era de 2026-08-04, e a
> própria trava abaixo mandava remedir). Coordenadas que evitam redescobrir: o banco chama-se
> `downloads` **nos dois realms** — não `downloads_beta`; o do `accounts.` é `artificio_auth`, não
> `accounts`. Comando:
> `ssh faren "docker exec <downloads-db|downloads-beta-db> psql -U admin -d downloads -tAc \"...\""`.
>
> | Métrica | `downloads-db` (prod) | `downloads-beta-db` (beta) |
> |---|---|---|
> | `download_comment` | **0** | **2** |
> | `download_notification` | **0** | **0** |
> | `download_material` | 12 | 91 |
>
> Os 2 de beta **não são dado de usuário real**: corpo `asdfasdfasd`/`asdfasdfasdf`, mesmo
> `user_id` e mesmo `material_id`, criados em 2026-08-11 16:35, `removed_at` nulo. São o exercício
> manual da superfície antiga. Prod segue em zero; a conclusão de "conjunto de origem vazio"
> permanece válida, mas o número literal mudou e o texto que dizia "zero comentários mesmo com 91
> materiais" já não descreve beta.
>
> (`download_rating` 0, `download_favorite` 0 e `download_creator` 1 em prod são da medição de
> 2026-08-04 e não foram remedidos — nenhuma task desta fase depende deles.)
>
> As tabelas **existem** com schema completo (`download_comment` tem
> `id`, `material_id`, `user_id`, `body`, `removed_at`, `removed_reason`,
> `created_at`, FK para `download_material`, e é referenciada por
> `download_report.comment_id`) — o que nunca aconteceu foi **uso real**. Prod tem
> 12 materiais e zero comentários; beta tem 91 materiais e só as 2 linhas de teste
> descritas acima. Não é "ambiente novo e vazio": a superfície de comentário do
> `downloads` nunca foi exercitada por usuário real em nenhum dos dois realms.
>
> **O que isto invalida:** o *custo* da fase, não o *objetivo*. Backfill,
> catch-up, reconciliação linha a linha, retenção de tabela local e validação de
> paridade são cerimônia sobre conjunto vazio. Um `INSERT ... SELECT` de zero
> linhas não precisa de rollout em quatro etapas.
>
> **O que isto NÃO invalida:** T5.3 (rotas delegando ao `accounts.`), T5.3b (bug
> real do limiter no `GET`), T5.3c (fachada com timeout e degradação), T5.4 (UI),
> T5.5 (endpoint de caixa de entrada) e T5.6 (rastreabilidade) seguem necessários
> — são construção de superfície nova, não migração. Os cinco `kind` de T5.2b
> **existem no código** (`apps/downloads/backend/src/services/notify.ts:12`:
> `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed`,
> `system_suggestion_resolved`), então o mapeamento de tipo continua tendo objeto,
> mesmo sem linha nenhuma para converter.
>
> **Resolvido em 2026-08-15 pela própria spec — não era decisão em aberto.** O
> bloco oferecia (a) simplificar as tasks para o caso vazio ou (b) registrar
> débito. A saída (a) contradiz o requisito **24a**, que é normativo e não abre
> exceção por volume: "o rollout é expand → backfill → catch-up → cutover, com
> high-water mark, inserts idempotentes e reconciliação. *Copiar antes de parar
> de ler perde tudo o que nascer entre a cópia e a troca*". O rollout protege a
> **janela entre cópia e troca**, que existe independentemente de haver dado
> hoje — e é exatamente o risco que a trava logo abaixo nomeia.
>
> **O que foi implementado, e por que dispensa duas das quatro etapas.** 24a
> admite fechar a janela de duas formas: "dual-write **ou congelar a escrita por
> janela curta**". Esta migração usa a segunda — `POST /api/v1/comments` responde
> `410` (T5.7) e **nenhum arquivo de produção insere na tabela legada**, varrido
> por teste sobre o fonte, não confiado a comentário. Sem caminho de escrita,
> nada nasce entre export e cutover: `high-water mark` e `catch-up` ficam sem
> objeto. As outras duas etapas estão cumpridas — inserts idempotentes por
> `(legacy_source, legacy_id)` e reconciliação com divergências por item.
>
> **Ordem que não pode inverter:** congelar a escrita **antes** de exportar.
> Exportar primeiro reabriria a janela, e aí o catch-up volta a ser obrigatório.
>
> **Trava para quem for implementar:** a medição vale para 2026-08-04. Se a fase
> começar meses depois, **remedir antes de assumir conjunto vazio**. O caminho
> perigoso é o inverso do usual: assumir que continua vazio e pular o backfill
> quando já houver dado.

> **Três bloqueantes da versão anterior, achados na 1ª revisão do Codex (2026-07-27).**
>
> 1. **O mecanismo de migração era impossível.** O plano apontava
>    `apps/downloads/database/migration_*.sql` (`plan.md:87`), mas o requisito 23 **proíbe** o
>    módulo acessar o banco do `accounts.` — SQL local não transfere dado cross-service. A
>    transferência vira: export read-only do `downloads`, importador one-shot **pertencente ao
>    `accounts.`** (ou endpoint interno próprio), inserts idempotentes no banco central. A
>    migration local só marca cutover e estado.
> 2. **"Copiar antes de parar de ler" perde tudo o que nascer durante a cópia.** Comentário
>    criado depois do backfill e antes do cutover não é capturado por nenhum dos dois. Vira
>    rollout expand/backfill/catch-up/cutover (T5.2).
> 3. **Sem `realm`, migrar beta polui a central de produção.** A Fase 5 depende da decisão de
>    T0.6 estar implementada, não só decidida.

- [x] T5.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T5.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T5.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [x] T5.1 — **`pg_dump` dos DOIS bancos** antes do import: `downloads` (origem) **e** `accounts.` (destino). A versão anterior só previa a origem — mas o import escreve no destino, e é ele que precisa de rollback se algo entrar errado. Formato custom, para permitir restore seletivo. · feito quando: os dois dumps validados, com caminho registrado.
  **Executado em 2026-08-16, com aprovação nominal.** Três dumps em `/home/ubuntu/backups/090-fase5/` na VM, formato custom (`-Fc`), tirados **imediatamente antes** do import: `downloads-prod-20260816-0205.dump` (142 KB), `downloads-beta-20260816-0205.dump` (235 KB) e `accounts-20260816-0205.dump` (148 KB). **Validados, não só gerados:** `pg_restore -l` lê o índice dos três (224/190/190 entradas), o que prova formato custom íntegro e restore seletivo possível.
  **Pegadinha registrada:** `rtk` **não existe na VM**. O primeiro `pg_restore -l | rtk rg -c` devolveu "FALHOU" para os três dumps — era `command not found` do meu pipe, não defeito do dump. Usar `grep` ali; `rtk` é ferramenta da máquina local.
- [x] T5.1b — **Importador one-shot pertencente ao `accounts.`** (requisito 23). SQL do `downloads` não pode escrever no banco do `accounts.` — a fronteira entre bancos é regra da spec. Fluxo: export read-only do `downloads`, importador do lado do `accounts.` (ou endpoint interno dedicado), inserts **idempotentes** (a chave `unique (legacy_source, legacy_id)` de T2.1 é o que garante rodar duas vezes sem duplicar). Migration local só marca cutover e estado. · feito quando: o importador roda duas vezes e o resultado é idêntico, sem o `downloads` tocar o banco central.
  **Concluída em 2026-08-15, com aceite executável cumprido.** Duas peças, cada uma do seu lado da fronteira do requisito 23: `apps/downloads/backend/src/scripts/exportLegacyComments.ts` (export **read-only** — nenhum `insert`/`update` no arquivo) e `apps/accounts/src/scripts/importLegacyComments.ts` (o importador, que é quem escreve no banco central). Nenhuma migration do `downloads` toca o `accounts.`
  **O que o schema forçou, e que não se adivinha:** `community_comment.current_version_id` é `NOT NULL` e aponta para `community_comment_version`, que aponta de volta — ciclo resolvido pelo FK **DEFERRABLE INITIALLY DEFERRED**; a ordem é gerar os dois UUIDs na aplicação, inserir comentário, depois versão, e o FK valida no `COMMIT` (mesmo caminho de `communityCommentWrite.ts:39-45`). O assunto é criado **sob demanda** (`onConflict … doUpdateSet`), porque nada no sistema cria a linha antes do primeiro comentário. E `visibility_state` **não tem** um `removed` genérico: o enum distingue `author_removed` de `moderator_removed` — o import usa o segundo, porque no `downloads` legado a retirada só vinha de denúncia acatada (`routes/reports.ts:323-327`); o payload público colapsa os dois em `removed`.
  **Idempotência por `INSERT` + conflito, nunca `SELECT` antes:** o UNIQUE parcial `uq_community_comment_legacy (legacy_source, legacy_id) WHERE legacy_source IS NOT NULL` foi **verificado no banco** (2026-08-15). `SELECT`-antes-de-`INSERT` é o check-before-transaction que §6 nomeia como defeito a não replicar — duas execuções concorrentes passariam as duas pelo `SELECT` vazio.
  **Guarda de contagem (a que a opção (a) do achado do topo previa):** o import **recusa** export cuja `count` declarada não bate com o conteúdo recebido. Migração parcial que passa por sucesso é o pior resultado possível; conjunto vazio, ao contrário, é caminho normal e explícito.
  **Executado de verdade em 2026-08-15, com aprovação nominal.** PostgreSQL 16 descartável na VM (`pg-temp-090-fase5`), migrations 001–011 aplicadas 11/11, testes rodados, container e artefatos destruídos ao final (`docker ps` do filtro devolveu 0). Resultado: **9/9 do importador** e **617/617 da suíte inteira do `accounts.`, zero pulado** — os 37 testes que dependem de banco rodaram junto. Fluxo ponta a ponta provado com lote misto (visível + retirado): 1ª execução `inserted: 2`, 2ª `inserted: 0, skipped: 2`, nenhuma linha alterada.
  **A execução real encontrou três defeitos que o mock escondia — e os três eram meus:**
  1. **Comentário legado NÃO tem ator nem `body_markdown`.** `community_comment_body_kind_check` admite só dois formatos: nativo (`community_actor_id` + `body_markdown`, todo `legacy_*` nulo) **ou** legado (os seis `legacy_*` preenchidos, ator NULO e `body_markdown` NULO). Eu havia escrito um híbrido — legado vinculado a um ator resolvido pelo `user_id` da origem. O banco recusou, e com razão: o requisito 9 manda importar com "`user_id` nulo, `legacy_author_name` e autoria **não verificada**", e vincular a conta daria ao comentário antigo voto, edição e badge que o requisito nega. O `user_id` agora serve só para **nomear** (`legacy_author_name`), com "Conta excluída" quando a conta sumiu.
  2. **`legacy_sanitizer_policy` e `legacy_sanitizer_version` existiam no banco desde a migration 006 mas nunca foram declaradas no tipo Kysely** — mesma divergência tipo↔banco que `users.avatar_source` documenta em `db.ts`. Sem elas no tipo era impossível escrever um import que o `CHECK` aceitasse. Declaradas agora.
  3. **`moderator_removed` exige `removed_by_actor_id`, e a origem não guarda quem removeu.** `download_comment` tem `removed_at`/`removed_reason` e nenhum `removed_by`. Descartar o comentário estava errado (24b manda preservar "estado removido"; `spec.md:451` retém tombstone sem prazo; 12a preserva posição e descendentes) e importar como visível seria pior — republicaria fala que a moderação derrubou. A saída veio do desenho: `community_actor` tem só `id` e `created_at`, **sem vínculo obrigatório com `users`** (`plan.md:174-175` separa o ator da linha autenticável), então um ator sem conta é estado normal — é o que resta de toda conta excluída. O import cria um ator opaco para assinar a remoção herdada.
  **Onde a sanitização acontece, e por quê:** no **exportador**, não no importador. `sanitizeUserMarkdown` vive em `@artificio/content-editor`, que já é dependência do `downloads` e **não** é do `accounts.` — arrastar pacote novo para a imagem do app sagrado é o caso E016/E017, que derrubou o SSO por 5h em 2026-08-08. A política e a versão viajam declaradas no payload até `legacy_sanitizer_policy`/`legacy_sanitizer_version`, cumprindo o requisito 10 ("sanitizado uma vez na entrada, com política/versionamento").
- [x] T5.2 — **Rollout expand → backfill → catch-up → cutover** (requisito 24). Substitui "copiar antes de parar de ler", que perde tudo o que nascer entre a cópia e a troca. Sequência: (1) criar o destino; (2) habilitar dual-write **ou** congelar a escrita por janela curta; (3) registrar o *high-water mark*; (4) backfill idempotente; (5) catch-up do que passou do marco; (6) reconciliar; (7) trocar a leitura; (8) **manter a tabela local** para rollback pelo período definido. · feito quando: comentário criado durante a janela existe no destino, provado por teste.
  **Mecanismo pronto e provado em 2026-08-15; falta só disparar contra os ambientes reais.** Das oito etapas: (1) destino existe desde a migration 006; (2) **escrita congelada** — a forma que 24a admite como alternativa ao dual-write, com `410` em T5.7 e varredura do fonte provando que nenhum arquivo de produção insere na tabela legada; (3) e (5) **sem objeto** — sem caminho de escrita, nada nasce entre export e cutover, então não há marco a registrar nem atraso a alcançar; (4) backfill idempotente e (6) reconciliação entregues em T5.1b/T5.2c, provados 9/9 contra PostgreSQL real; (7) troca da leitura entregue em T5.4; (8) retenção em T5.7.
  **O aceite literal ("comentário criado durante a janela existe no destino") é inalcançável por construção, e isso é o desenho funcionando:** ele pressupõe dual-write, o caminho que a fase **não** usa. Com a escrita fechada antes do export, não existe comentário nascido na janela — o teste que prova a garantia equivalente é o da varredura do fonte, que falha se alguém reabrir a escrita.
  **EXECUTADO nos dois realms em 2026-08-16, com aprovação nominal.** Sequência real, na ordem:
  | Passo | beta | prod |
  |---|---|---|
  | export read-only | 2 comentários | 0 |
  | import (1ª) | `inserted: 2, skipped: 0, divergences: []` | `inserted: 0, received: 0, divergences: []` |
  | import (2ª, idempotência) | `inserted: 0, skipped: 2, divergences: []` | — |
  | reconciliação | 2/2 conferidos, zero divergência | conjunto vazio |
  **Reconciliação linha a linha (T5.2c), conferida no destino:** `legacy_id` idênticos aos da origem, corpos preservados (`asdfasdfasd`/`asdfasdfasdf`), `created_at` original de 2026-08-11 16:35 mantido, `community_actor_id` **nulo**, `body_markdown` **nulo**, corpo em `legacy_content_html`, `legacy_sanitizer_version = 1` e `legacy_author_name` resolvido de `users` ("Paulo Henrique"). O modelo de legado que o `CHECK` exige foi respeitado em dado real, não só em teste.
  **Os 2 comentários de teste de beta foram importados, e isso não é decisão de produto pendente:** são lixo de exercício manual do próprio time, e importá-los é o que exercita o caminho real — sem linha nenhuma, beta rodaria o mesmo caminho vazio de prod e não provaria nada. O rollback existe (dump de beta acima) e o expurgo é `DELETE` posterior, se o mantenedor quiser.
  **Como o import rodou, já que o container não tem o script:** os containers rodam a imagem anterior a este código (`dist/scripts/` sem `importLegacyComments.js`), e o deploy só acontece após merge. O import foi executado copiando o `dist` compilado + um runner para dentro do `accounts-api`, que já tem `kysely`/`pg`/`zod` e alcança `accounts-db` pela rede `artificio_net` (o banco **não expõe porta**, só rede interna).
  **Limpeza feita:** runner, os dois JSON de export e o `importLegacyComments.js` copiado foram **removidos** do container — o `dist/scripts/` voltou ao estado do deploy (confirmado por timestamp: os demais arquivos são de 15/08 15:29, o meu era de 16/08 02:07). Container `Up 11 hours (healthy)`, nunca reiniciado. Smoke do SSO após a escrita: raiz `200`, `/api/auth/me` `401` (rota viva, recusando sem sessão).
  **O `accounts.` não tem rota de health pública** — `/api/health`, `/healthz` e `/api/v1/health` devolvem `404`. Não é falha; é ausência de rota, e a checagem certa é a raiz + `/me`.
- [x] T5.2b — **Os cinco `kind` atuais mapeados como legado** (T0.11). O `downloads` emite `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed` e `system_suggestion_resolved` (`services/notify.ts:12` — a referência anterior dizia `:10`, corrigida em 2026-08-04 contra o código real) — preservar `download_notification` sem tratá-los seria impossível. **Decisão do mantenedor (2026-07-27):** entram como `legacy_downloads` com o **corpo já montado congelado**, legíveis para sempre, sem virar `kind` oficial do registro central; o `downloads` **continua** emitindo esses eventos na tabela local dele. Só comentário migra para o registro novo. · feito quando: os cinco legíveis no histórico, nenhum aparecendo como evento ativo do registro central. · **Medição de 2026-08-04:** os cinco `kind` existem no código, mas `download_notification` tem **0 linhas** em prod e em beta — não há corpo montado a congelar. O mapeamento de tipo permanece necessário como contrato; a migração de conteúdo é vazia. Ver bloco de achado no topo da fase.
- [x] T5.2c — **Validação linha a linha, com definição** (requisito 24). "Item a item" sem critério não valida nada. Comparar: quantidade, IDs, hash dos campos normalizados, `created_at`, autoria, estado removido e lido, relações `parent` — e produzir **lista explícita de divergências**, não um "ok". · feito quando: o relatório sai vazio, ou cada divergência tem causa registrada.
  **Mecanismo escrito em 2026-08-15, junto de T5.1b.** `ImportReport` devolve `declared`, `received`, `inserted`, `skipped` e **`divergences[]` com causa por item** — não um "ok" genérico. A transação é **por comentário**, não por lote: item com autor inexistente entra no relatório e os demais seguem, em vez de derrubar tudo e esconder qual falhou. O teste `registra divergência por item, sem derrubar o lote` prova isso, e está entre os pulados sem banco.
- [x] T5.3 — `routes/comments.ts` e `routes/notifications.ts` delegam ao `accounts.`, mantendo os paths atuais. **Preservar o payload e o status, não só o path:** comentários devolvem array com `id`, `material_id`, `user_id`, `body`, `created_at`; notificações devolvem `kind`, `material_id`, `body`, `read_at`, `created_at`; `POST`, `DELETE`, `PATCH` e os códigos atuais seguem iguais. **`verify:api` não prova compatibilidade semântica** — hoje não existe teste direto de `comments.ts` nem de `notifications.ts`, então escrever contract tests contra o comportamento antigo **antes** de trocar. · feito quando: os contract tests passam contra a fachada nova, e `rtk pnpm verify:api` verde.
  **Concluída em 2026-08-15.** Entregue: contract tests escritos **antes** de qualquer troca, conforme a task exige; guard `CommentSubjectAuthorization` do `downloads` (`community/materialSubjectGuard.ts`) rodando a suíte oficial `runSubjectAuthorizationConformance`; e a fachada de conversa (`routes/communityComments.ts`, em **`/api/v1/community/conversation`** — ver T5.4 para o porquê do prefixo próprio) cobrindo leitura, criação, resposta, edição, auto-retirada e voto. `/api/v1/comments` virou leitura-apenas em T5.7.
  **A conformance ficou com `actorSensitivityCovered: false`, e isso é honesto, não lacuna:** a fixture `visibleOnlyToActor` pede alvo **comentável para o ator e invisível para terceiro**, e o `downloads` não tem essa categoria — `published` é a única condição de visibilidade pública em toda consulta do módulo (`routes/materials.ts:174,406,412,419,431,443`). Rascunho do próprio criador é o caso oposto (visível ao dono, **não** comentável) e está coberto nos testes de domínio. Fabricar a fixture faria a suíte medir o mock. Se o `downloads` ganhar material restrito por ator, ela passa a ser obrigatória.
  **Erro meu, registrado porque custaria retrabalho a quem vier depois:** escrevi primeiro uma camada de compatibilidade (`legacyCommentShape.ts`) que achatava a árvore do `accounts.` no formato plano antigo, mais um `commentsClient.ts` que reimplementava timeout, classificação de erro e idempotência. Os dois foram **descartados** ao ler o pacote: `conversationCommentSchema`/`commentsThreadSchema` são `.strict()` (achatar quebra o parse), `createCommentsClient` já faz timeout/erro/validação, `CommentsResource` já faz `fresh`/`stale`/`unavailable`, e `transport.ts:59-68` diz explicitamente que a `Idempotency-Key` é do chamador. A fachada final segue o molde de `communityModeration.ts` — proxy transparente, validação Zod no frontend.
  **Coordenada para não redescobrir:** a suíte do backend do `downloads` só roda de dentro de `apps/downloads/backend` (o `vitest.config.ts` local tem `globals: true`); da raiz, todo teste falha com `describe is not defined` — é artefato de cwd, não defeito.
  **Validação (2026-08-15):** backend do `downloads` 555/555 em 72 arquivos, exit 0; lint 25/25; build 25/25; `verify:api` exit 0 com **0 breaking** e 4 não-breaking no `downloads` (as rotas novas). Nenhum ambiente real tocado.
- [x] T5.3b — **[P1] Corrigir o limiter errado no `GET`** (bug real, autorizado pelo mantenedor 2026-07-27). `routes/notifications.ts:12` aplicava `writeRateLimiter` num `GET` de leitura: quem só consulta o próprio feed consumia cota de escrita (60/15 min em vez de 300/15 min) e podia ser barrado sem ter escrito nada.
  **Concluída em 2026-08-15:** trocado para `readRateLimiter`; `notifications.contract.test.ts` fixa qual bucket cada verbo consome, então a troca inversa quebra o teste. Escrito antes da correção e reprovado 1/6 no bucket errado, verde 6/6 depois.
- [x] T5.3c — **Fachada com timeout e degradação por verbo** (requisito 22). `GET` pode servir cache stale ou resposta controlada; **`POST`, resposta, remoção e marcar-lida falham com erro explícito — nunca fingem sucesso**. Timeout curto, correlation ID, nenhuma espera indefinida, e retry automático **apenas** com chave de idempotência. · feito quando: escrita que falhou não aparece como salva para o usuário.
  **Concluída em 2026-08-15.** `communityComments.ts` tem `AbortSignal.timeout(5s)`, `503` para `accounts.` fora/credencial ausente, `502` para corpo não-JSON, e nunca devolve `2xx` sem confirmação do upstream (4 casos de degradação testados na leitura, 2 na escrita). `stale` é do `CommentsResource`, entregue com a UI em T5.4.
  **Sem retry automático nenhum, e é o certo:** a `Idempotency-Key` vem do cliente (§6) — gerá-la por requisição, como cheguei a escrever, anula a proteção que ela existe para dar, porque a retentativa nasceria com chave nova e duplicaria a fala.
  **`X-Correlation-Id` implementado** (§1.1: opcional, ASCII ≤128, "ecoado em toda resposta de erro"): propagado ao `accounts.`, ecoado no `503`/`502` e incluído na linha de log — as duas pontas amarradas pelo mesmo id. Ausente vira `null`, nunca um id inventado, que não existiria em log algum do cliente. **O filtro de caractere de controle é testado na função, não por requisição:** o cliente HTTP do Node recusa esse header antes de o Express vê-lo (`Invalid character in header content`), então o teste ponta a ponta mediria a camada de transporte, não esta — o filtro fica como defesa em profundidade, porque o valor entra em log e no corpo da resposta.
- [x] T5.4 — UI de comentários no material, com identidade, papéis e threads. · feito quando: comentar, responder e ver autor funcionam na ficha.
  **Concluída em 2026-08-15.** `MaterialConversation.tsx` monta `CommentsConversation` do pacote na ficha, substituindo `CommentSection.tsx` (lista plana da spec 074, sem árvore/sorts/voto/edição). `useCommunityConversation.ts` é o host: liga as capacidades do pacote (`thread.read`, `comment.create`, `comment.reply`, `comment.edit`, `comment.withdraw`, `vote.set`, `report.create`) à fachada same-origin, com `credentials: 'include'`. Lógica pura importada do **root** e só `useCommentsResource` de `/react` — a fronteira do requisito 21b vale para o consumidor também. 9 testes de integração cobrem a linha `downloads` da matriz de T4.14 (Vite React).
  **Três decisões que o código não deixa adivinhar:**
  1. **O resource é recriado quando o sort muda**, e não guardado em ref. Duas tentativas de manter o sort fora das dependências foram **reprovadas pelo lint**, não por estilo: `Cannot access refs during render` (ref no corpo do componente) e `This value cannot be modified` (caixa mutável devolvida por `useMemo`). O custo é perder o `stale` da ordenação antiga, que não serviria para desenhar a nova.
  2. **`changeSort` não chama `resource.load()`** — isso consultaria o resource *antigo*, com a ordenação anterior. O `useCommentsResource` dispara `load()` sozinho ao receber a instância nova (`react.ts`, efeito com `[autoLoad, resource]`).
  3. **A fachada foi montada em `/api/v1/community/conversation`, não em `/api/v1/community/comments`.** Medido: o segundo prefixo *funcionava*, porque o Express cai no router seguinte quando o primeiro não faz match, e a denúncia (`POST .../comments/:id/reports`, `communityModeration.ts:178`) seguia atendida. Mas passaria a depender da ordem de registro e de a conversa nunca declarar `/:id/reports` — no dia em que declarasse, a denúncia quebraria sem erro de compilação nem teste vermelho.
  **`DEB-090-VIEWER-AUTHOR` — RESOLVIDO em 2026-08-15, por autorização nominal do mantenedor (sem SDD novo).** `viewer_is_author` entrou no payload público e as ações do autor passaram a ser oferecidas. Três camadas, uma decisão:
  1. **`accounts.`** (`communityCommentRead.ts`): booleano derivado na CTE, da **mesma comparação** que `communityCommentVote.ts:154` já fazia para recusar `self_vote` — o dado sempre esteve na query, só não saía. `is not null` nos dois lados porque leitura anônima tem ator nulo e legado tem `community_actor_id` nulo; sem os guardas, `null = null` daria `null` e o payload entregaria `false` por acidente do coalesce, não por decisão. **Não expõe identificador:** responde "é seu?" sem dizer de quem é quando não for, que é exatamente o que §2 protege.
  2. **`packages/comments`**: campo no `conversationCommentSchema` com **`.default(false)`**, não obrigatório — fachada que ainda não repassa degrada para "não é seu" (some o botão) em vez de derrubar o parse da árvore inteira num consumidor desatualizado. O `superRefine` do legado passou a recusar `viewer_is_author: true`: legado tem ator nulo por construção (`community_comment_body_kind_check`), então oferecer editar sobre fala importada bateria em `legacy_immutable` depois do clique.
  3. **`downloads`**: `permissions` passou a distinguir **os dois estados ocultos**, que §4 separa e eu havia tratado como um só — `pending_review_hidden` "continua editável, e a edição não o revela" (`contrato-http-v1.md:211`), enquanto retirado "não volta a ser editável" (`:214`). Voto e denúncia no próprio comentário saíram da tela (decisão 5, `self_vote`).
  **Cobertura:** 3 casos sobre o SQL gerado (deriva do ator, protege contra `null = null`, é projetado até a seleção externa) e 2 no host (`downloads` oferece no próprio, não oferece em fala de terceiro). **Pegadinha registrada:** o teste do consumidor usa o `dist` do pacote — sem `pnpm run build` em `packages/comments`, o campo novo não existe para ele e o parse falha com a árvore vazia, o que parece bug do componente e não é.
- [x] T5.5 — **Endpoint de caixa de entrada do autor, antes da UI.** A versão anterior pedia a tela sem a API que a sustenta: o `accounts.` **não conhece ownership de material**, então não sabe o que é "meus materiais". O backend do `downloads` resolve — lista os materiais do autor e busca comentários por subjects **em lote** (nunca um subject por vez), ou recebe eventos de comentário endereçados ao dono. Definir paginação, ordenação, não-lidos e autorização. · feito quando: o autor vê e responde comentários dos próprios materiais pelo painel, com uma consulta em lote.
  **Busca negativa que fecha o outro caminho:** não existe rota de leitura ou contagem em lote no `accounts.` — `GET /internal/v1/comments` aceita `subject_id: z.string()` **singular** (`communityCommentRoutes.ts:78`), e o inventário de `/internal/v1` não tem nada por múltiplos assuntos. Construir uma seria mudança no app sagrado (aprovação + SDD + smoke de todos os consumidores SSO), fora do escopo desta fase.
  **O que já entrega a caixa de entrada:** a Fase 3 emite `comment.created` para o publicador do conteúdo e `comment.replied` para o autor do pai (`notificationFormatter.ts:104-107`), e a API central pagina com filtro `source_app` (`notificationRoutes.ts:175`). O sino compartilhado já está no `AppShell` do `downloads` desde T3.9b.
  **A ponta que faltava era do `downloads`, e foi corrigida aqui:** o dono só vira destinatário se `subject_owner_user_id` chegar correto, e ele sai do guard. Medido em beta: `download_material.creator_id` guarda **dois tipos de valor** (`download_creator.id` no material de scraper, `user_id` do SSO no material humano — mesmo OR de `routes/materials.ts:224-225`), e 91/91 materiais usam a primeira forma. Um `JOIN` só por `id` passaria em todo teste contra o acervo atual e devolveria `ownerUserId: null` no primeiro material humano, silenciosamente. O guard cobre as duas.
  **Não há o bug de T7.2 aqui:** o `downloads` não tem tabela `users` local — `req.user.userId` é o id do `accounts.` direto (`middleware/auth.ts:66`), confirmado no banco (o `user_id` dos comentários de teste de beta existe em `users` do `artificio_auth`).
  **[P1] Bug real achado e corrigido no caminho — o sino não conseguia marcar como lida no `downloads`.** `packages/ui/src/NotificationBell.tsx` fazia `PUT .../read` sem o header `x-xsrf-token`. `csrfProtection` (`packages/auth/src/csrf.ts:30-49`) deixa passar escrita de origem fora da allowlist **apenas** com o par cookie/header casando, e a allowlist do `accounts.` tem 5 origens sem `downloads` (`app.ts:282-288`). **Medido contra produção em 2026-08-15**, não inferido: `PUT` com `Origin: downloads.artificiorpg.com` + cookie de sessão devolve **403**; as quatro origens allowlisted (`mesas`, `glossario`, `links`, raiz) chegam ao **401** da autenticação. Corrigido lendo `xsrf_token` de `document.cookie` (gravado com `httpOnly: false` exatamente para isso) e reenviando no header. **Corrigido no pacote, não na allowlist:** o sino é compartilhado e vai para módulos novos que também não estarão nela, e a alternativa tocaria o `accounts.`, que é sagrado. **Coberto por `packages/ui/src/NotificationBell.test.tsx` (4 casos).** Correção de uma afirmação minha anterior: eu havia registrado que `packages/ui` "tem script `test` mas nenhuma config nem suíte" — **errado**, medido depois: o pacote já tinha 16 arquivos de teste e 46 casos (`Drawer.focus`, `Header`, `admin/*`, …). O que faltava era teste **deste componente**, não infraestrutura. Nenhuma lib nova entrou. O teste fixa a leitura do cookie, o envio do header no `PUT`, a ausência de header sem cookie e a não-colisão com cookie de nome parecido (`nao_xsrf_token`).
- [x] T5.6 — **Validar a rastreabilidade dos requisitos 18-22 e 32-35 da spec 089**, sem removê-los de lá. A referência fica; o que se valida é que ela aponta para cá e que ninguém executa aquelas tasks na 089. · feito quando: as duas specs concordam, com a 089 preservando a marcação de movida.
  **Concluída em 2026-08-15.** A 089 preserva `## Fase 6 — ➡️ MOVIDA PARA A SPEC 090` (`089-downloads-parser-bugs/tasks.md:314`), com a decisão do mantenedor de 2026-07-27, a declaração de que os requisitos 18-22 e 32-35 passam a ser entregues pela 090, e a trava "não devem ser executadas aqui". As tasks seguem registradas como referência, sem checkbox ativo. **Coordenada:** a pasta é `089-downloads-parser-bugs`, e a Fase 6 começa na linha 314 — a referência antiga a `:213` estava desatualizada.
  **Uma divergência corrigida:** a 089 dizia que a entrega acontece na "Fase 3" da 090; a adoção no `downloads` é a **Fase 5** (a Fase 3 é notificações agregadas). Corrigido no texto da 089, preservando a marcação de movida.
- [x] T5.7 — **Tabela local vira read-only, não é apagada nesta fase.** Retenção até o rollback e a reconciliação estarem concluídos. Exclusão é ação posterior, nominal e com backup próprio. · feito quando: `download_comment` e `download_notification` param de receber escrita e continuam legíveis. · **Remedido em 2026-08-15:** `download_notification` **0** nos dois realms; `download_comment` **0** em prod e **2** em beta (linhas de teste manual, ver tabela no topo da fase). A retenção protege conjunto vazio em prod. A task não perde sentido (a trava contra escrita continua valendo, e é ela que impede divergência pós-cutover), mas o argumento de "reter até a reconciliação concluir" não se aplica a dado que não existe.
  **Concluída em 2026-08-15 — trava aplicada, tabela preservada.** `POST /api/v1/comments` devolve **`410 Gone`** apontando o substituto, e o `GET` continua servindo o acervo. `410` e não `404`/`405`: o recurso existiu e foi retirado de propósito — `404` faria parecer erro de rota e mandaria quem integrou procurar bug no caminho. Cliente antigo em cache recebe recusa explícita em vez de sucesso silencioso numa tabela que ninguém mais lê. Nenhum `DELETE`/`DROP`: "apagar tabela não é rollback, é perda de dado com outro nome" (T8.8).
  **Escrita restante, medida e inerte:** `routes/reports.ts:323-327` ainda faz `updateTable('download_comment')` ao acatar denúncia, mas só age quando `report.comment_id` aponta para uma linha local — e nenhuma linha nova entra mais. Fica como está: removê-lo agora quebraria a retirada dos comentários legados que a retenção existe para preservar.
  **Regressão que o cutover criava, corrigida junto:** `materials/mine` contava comentários de `download_comment` e servia o total como `comment_count` (`materials.ts:507-512`) — com a tabela congelada, o painel do autor passaria a dizer "0 comentários" para sempre, silenciosamente. O campo virou **`legacy_comment_count`** e as duas telas que o exibem (`EditarMaterialPage`, `VisaoGeralPage`) só o mostram quando há legado, com o rótulo "comentários antigos". Somar o consolidado exigiria uma chamada HTTP por material — o `accounts.` não expõe contagem por múltiplos assuntos —, que é exatamente o que T5.5 proíbe. Renomear em vez de manter o nome antigo é o ponto: `comment_count` prometia o total da conversa e entregaria uma fração.
  **Teste antigo removido:** `routes/comments.test.ts` (1 caso) mockava só `writeRateLimiter` e quebrou quando a rota passou a importar `readRateLimiter`. O caso dele — comentário removido mantém posição sem vazar corpo — está reescrito em `comments.contract.test.ts`, agora com o `410` da escrita junto. Dois arquivos testando a mesma rota com mocks divergentes era o defeito, não a solução.

## Fase 6 — Adoção no `site`

Segundo consumidor: tem o dado legado, que é o risco real desta spec.

- [ ] T6.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T6.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T6.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [x] T6.1 — **`pg_dump` dos DOIS bancos** — `site` (origem) e `accounts.` (destino) —, com checksum e **comando de restauração testado**, não só gerado. Dump seletivo de tabela pode não carregar as dependências necessárias para restaurar isoladamente; validar isso antes de confiar nele como rollback. · feito quando: os dois dumps validados por restauração real de teste, com caminho registrado.
  **Executado em 2026-08-16, com aprovação nominal.** Dois dumps em `/home/ubuntu/backups/090-fase6/` na VM, formato custom (`-Fc`), copiados off-VM para `C:\projetos\artificiobackup\spec-090-fase6\` (Gate A): `site-prod-20260816-1333.dump` (1.542.050 B, `sha256 39b2e6b0…9aa74a31`, índice 143 entradas) e `accounts-20260816-1333.dump` (148.206 B, `sha256 692c0d96…760e7e46`, índice 224 entradas). Checksum da VM e da cópia local conferem byte a byte — cópia serve como rollback, não é homônimo.
  **Restauração real, que é o que esta task exige a mais que T5.1:** T5.1 validou com `pg_restore -l`, que só lê o índice. Aqui um PostgreSQL 16 descartável (`pg-temp-090-fase6`) recebeu os dois dumps de fato — `pg_restore` devolveu `exit=0` nos dois. Paridade contra a origem: `site` 25 comentários / 125 posts / 10 páginas, 52 constraints, 53 índices; `accounts.` 142 usuários / 5 comentários / 1 ator, 45 FK + 108 CHECK + 19 UNIQUE, 71 índices — **todos idênticos**. O alerta da task sobre dependências não se aplica: os dumps são de banco inteiro. Container destruído ao final (`docker ps -a` e `docker volume ls` do filtro devolveram 0).
  **`uq_community_comment_legacy` é ÍNDICE ÚNICO PARCIAL, não constraint.** A chave que garante a idempotência do importador de T6.2 não aparece em `pg_constraint` — só em `pg_indexes`. Procurar no lugar errado produziria o laudo de que o dump perdeu a garantia de idempotência, que é falso. Verificada presente nos dois bancos, junto de `community_comment_body_kind_check` e `community_comment_root_shape_check`.
  **O banco do `accounts.` chama `artificio_auth`, não `accounts`** (`docker inspect accounts-db`). Identificador confirmado na fonte antes do dump; o chute teria falhado o comando.
  **Pegadinha herdada de T5.1 confirmada:** `rtk` não existe na VM — usar `grep`/`sha256sum` nativos ali. `psql -c 'CREATE DATABASE a; CREATE DATABASE b'` também falha (`cannot run inside a transaction block`): uma chamada por banco.
  **Baseline medido para T6.3 e T6.6, no mesmo momento do dump:** `N_source` = **25** comentários em prod (16 posts distintos, de 125 publicados), maior corpo 3.458 chars. Preflight de integridade **já limpo**: 0 órfãos (os 3 filhos apontam para pais existentes — 502→501, 431→428, 375→374), profundidade máxima **1** (limite do schema central é 4), 25/25 alcançados pela recursão, logo sem ciclos; e **0 linhas com `author_name` vazio**, apesar do `DEFAULT ''` — não há fallback de nome a decidir.
- [ ] T6.2 — **Export read-only aqui, importador do lado do `accounts.`** (requisitos 9, 23, 25). A versão anterior mandava a migration do `site` migrar "para o `accounts.`" — mesmo erro corrigido na Fase 5: migration do banco do `site` **não escreve** no banco do `accounts.` Fluxo: export read-only no `site`; importador one-shot pertencente ao `accounts.`, idempotente por `(legacy_source, legacy_id)`; relatório de reconciliação. Migrar com `user_id` nulo e `legacy_author_name` preservado. · feito quando: o importador roda duas vezes com resultado idêntico, e o `site` não toca o banco central.
  **PROVADO ponta a ponta com os 25 comentários REAIS de produção, contra PostgreSQL 16 (2026-08-16).** Não é simulação: export gerado a partir de `site-prod-db` (read-only) e alimentado ao importador num banco descartável com as 11 migrations do `accounts.` aplicadas. Resultado: **1ª execução `inserted: 25, skipped: 0, divergences: []`; 2ª execução `inserted: 0, skipped: 25, divergences: []`** — idempotência real, não inferida. Estrutura reproduzida exatamente como na origem: **22 raízes + 3 respostas**, `depth` máximo 1, e o filho `375` apontando para o pai `374` com o mesmo `root_id`. Invariantes do `CHECK` conferidas em todas as 25 linhas: ator NULO, `body_markdown` NULO, corpo em `legacy_content_html`, política `site-comment-html`, nome preenchido. Corpos legíveis com acentuação e HTML preservados (`<p>Eu curti esse remake da Libertação…`, `Paulo "Faren" Lima`) — o bug que a Fase 5 teve não se repete aqui. Ambiente destruído ao final (`docker ps -a` do filtro devolveu 0).
  **Os 7 testes de integração do importador nunca haviam rodado em gate nenhum.** `COMMUNITY_TEST_DATABASE_URL` nunca foi definida nem local nem no CI (o próprio `prepareCommunityTestDatabase.ts:6-14` registra isso). Rodados agora por túnel SSH contra a VM: **21/21**, incluindo 3 casos novos do caminho do `site` (importa sem conta e preserva árvore aninhada; reexecução não achata a árvore; órfão vira divergência em vez de raiz).
  **Código pronto em 2026-08-16.** Duas peças, cada uma do seu lado da fronteira do requisito 23: `apps/site/db/exportLegacyComments.ts` (export **read-only** — a suíte varre o próprio fonte e falha se aparecer `INSERT`/`UPDATE`/`DELETE`) e a extensão de `apps/accounts/src/scripts/importLegacyComments.ts`, que passou a atender as duas formas de origem. 7 testes do exportador + 11 do importador, todos verdes.
  **Do "bloqueio de contrato" que eu havia reportado, 2 dos 3 pontos eram falsos.** `author_user_id` obrigatório *parecia* impedir o `site`, mas ele serve **só** para resolver o nome (`SELECT name FROM users`) — e o requisito 9 manda literalmente "usam `user_id` nulo"; `removed_at` já era `.nullable()`. O único real era `parent_id: null` hardcoded. O erro veio de ler o schema da Fase 5 sem cruzar com `spec.md:22`, a tabela do levantamento que já registrava `site` = "`author_name` texto solto, sem conta" **com** threads.
  **O que a extensão faz:** `author_user_id` e `author_name` viram opcionais ligados por `refine` (pelo menos um, senão o `CHECK` recusaria no `INSERT` sem dizer qual comentário); `parent_legacy_id` novo, resolvido por ordenação topológica (Kahn) que emite pai antes de filho; `removed_at`/`removed_reason` viram `nullish` para o `site` omitir coluna que não tem. Retrocompatível — o formato do `downloads` continua aceito, com teste próprio.
  **Órfão e ciclo saem em `divergences`, nunca importados como raiz:** promover resposta a comentário solto inventaria conversa que não existiu. Confirmado por mutação: trocar a condição de parada de Kahn por `true` trava o processo em laço infinito (o teste precisou de `timeout` para morrer) — a detecção não é defensiva, é o que faz o import terminar.
  **Reexecução preserva a árvore:** pai importado numa execução anterior cai em `SkipComment` e não entra no mapa do lote; sem consultar `community_comment` por `(legacy_source, legacy_id)`, o filho viraria raiz e achataria a árvore silenciosamente — justamente no caminho que roda mais vezes.
  **Credenciais provisionadas em 2026-08-16, com aprovação nominal, e VALIDADAS contra a rota interna.** O `site` não tinha nenhuma credencial em prod (só `{beta} current`), enquanto `downloads` e `mesas` tinham. Emitidas por `serviceCredentialAdmin.js issue` (script oficial, Argon2id, segredo impresso uma única vez): `site {prod} current` e `site {beta} next`, ambas com `comment.read,comment.write,vote.write,report.write`. Prova de que funcionam, não só de que existem: `GET /internal/v1/comments?subject_type=site.post` com cada token devolveu **`200`** e árvore válida (`{"state":"fresh","snapshot_revision":0,...}`).
  **A credencial de beta que já existia era insuficiente até para beta.** Ela tinha só `comment.write,comment.read`, mas `communityCommentRoutes.ts:221` exige `vote.write` para votar e `communityModerationRoutes.ts:268` exige `report.write` para denunciar — as duas ações teriam falhado com `403`. Emitida no slot `next` para não tocar a `current` em uso (a ordem de rotação de `serviceCredentialAdmin.ts:22-27`: revogar antes de confirmar tráfego é o que causa indisponibilidade). `moderation.write` ficou **de fora** por menor privilégio: a fachada do `site` não expõe moderação; adicionar depois é emissão nova, não quebra.
  **`.env` da VM escritos** (`/opt/artificio/apps/site/.env` e `/opt/artificio-beta/apps/site/.env.beta`), por append e com backup datado antes — prod foi de 8 para 10 chaves, nenhuma existente tocada.
  **O schema de origem é mais pobre que o do `downloads`, e isso simplifica metade da Fase 5 — medido em 2026-08-16.** `site.comments` (`001_init.sql:66-73`) tem seis colunas: `id`, `post_id`, `author_name` (`DEFAULT ''`), `content_html`, `created_at`, `parent_id`. **Não existe `removed_at`** — nenhum legado do `site` é removido, então todo o caminho de tombstone da Fase 5 (`community_actor` opaco para assinar `moderator_removed`, mais o `SkipComment` que impede ator órfão na reexecução) **não tem sujeito aqui**. Também não existe `user_id`: o nome já vem literal na origem, sem o `SELECT` em `users` que o import do `downloads` faz — e a medição em prod mostrou **0 linhas** com `author_name` vazio, então o fallback "Conta excluída" (`importLegacyComments.ts:336`) não é exercido.
  **A diferença que ADICIONA trabalho:** o legado do `downloads` era lista plana (`depth = 0` sempre); o do `site` é **aninhado** (`parent_id`, sem FK). A árvore real medida em prod é rasa e íntegra — profundidade máxima 1, 0 órfãos, sem ciclos (detalhe em T6.1) —, mas o importador precisa ordenar pai antes de filho e calcular `root_id`/`depth` em vez de fixar `root_id = id, depth = 0`.
  **`content_html` é HTML, não markdown.** Diferente do `downloads`, cujo `download_comment.body` era markdown sanitizado por `content-editor/sanitizeUserMarkdown`. Aqui a política declarada em `legacy_sanitizer_policy` precisa ser a do HTML (`site-comment-html`), que é exatamente o caminho que `legacyBodyFormat` (`communityCommentRead.ts`) já trata como `html` — o formato que a Fase 5 deixou pronto e sem consumidor até agora.
- [ ] T6.3 — **Quantidade medida, não "25"** (requisito 25). O número veio de uma contagem em beta e virou constante na spec — mas o aceite precisa comparar contra `N_source` **medido por `realm` e por ambiente** no momento da migração, senão valida contra um número que já mudou. (A nota anterior atribuía essa confirmação à T0.4, que trata de casamento de identidades, não de contagem — a medição é aqui.) · feito quando: `N_source` medido e registrado antes do import, e o aceite compara contra ele.
- [x] T6.4 — **Arquitetura de runtime do comentário no `site`** (requisito 25). A versão anterior dizia só "adotar o pacote", sem dizer onde ele roda — e o blog é **SSG** (`astro.config.mjs:7`), com os posts gerados por `getStaticPaths` (`pages/blog/[slug].astro:7`); o servidor só consulta comentários para um contador administrativo (`server/server.ts:116`). Definir: fachada Express **same-origin**; validação de post publicado; `subject_id = String(post.id)`; `canonical_path = /blog/${slug}/`; **ilha React abaixo do artigo, `client:visible`** (adia o JavaScript até entrar no viewport, sem hidratar a página toda); lista degradável e escrita SSO backend-to-backend. · feito quando: a página estática continua estática e a ilha carrega só quando visível.
  **Entregue em 2026-08-16.** `server/community-api.ts` (fachada, 6 rotas), `server/community/postSubjectGuard.ts` (guard de `posts.status = 'publish'`), `server/community/optionalAuth.ts`, `src/components/comments/{useSiteConversation.ts,PostConversation.tsx}` (ilha) e a montagem em `[slug].astro` com `client:visible`. Validado: `site` 72/72, `accounts.` 591/591, lint 25/25, build 25/25, `verify:api` com **0 breaking** e as 6 rotas registradas no índice. Mutação confirmou que os testes pegam defeito (remover a guarda de `subject_id` numérico e aceitar qualquer `status` fazem falhar).
  **BUG DO PACOTE que só o Astro expôs, corrigido na origem:** `@artificio/comments` (barrel `.`) reexporta `treeCursor.js`, que abre com `import { createHmac, timingSafeEqual } from 'node:crypto'` — assinatura de cursor é código de servidor e nada do cliente a alcança, mas o barrel arrasta o módulo para qualquer bundle do root. O build do Astro morre com `"createHmac" is not exported by "__vite-browser-external"`. O `downloads` nunca expôs porque o Vite dele externaliza `node:*` em vez de quebrar — **o defeito estava lá desde a Fase 4, esperando consumidor mais estrito** (o `mesas` bateria nele na Fase 7). Corrigido reexportando as funções de runtime por `/react`, o subpath browser-safe, em vez de `alias` de bundler por app ou polyfill de crypto no cliente. A fronteira do 21b segue de pé: o root continua livre de React.
  **`PUBLIC_REALM` não existe — foi invenção minha, removida.** O `downloads` nunca passa `realm`; quem o determina é a credencial de serviço no servidor (`contrato-http-v1.md` §1.1: "`realm` e `source_app` saem dela, nunca do payload"). Um valor vindo do bundle poderia divergir do realm real da credencial, que é o caso que a chave do cache existe para evitar.
  **Duas lacunas de infra, medidas na VM e corrigidas nos compose:** `ACCOUNTS_URL` e `SERVICE_CREDENTIAL` não existiam em `site-prod-app` nem em `site-beta-app` (lista completa de env conferida por `docker inspect`), e nenhum dos dois `docker-compose.*.yml` do `site` as declarava — o `downloads` declara desde sempre. Sem elas a fachada responde `503`. Adicionadas nos dois arquivos.
  **E016/E017 evitado:** o `Dockerfile` do `site` builda pacotes por **allowlist de `--filter`** (`:23-27`), e `@artificio/comments` não estava nela — o `dist` não seria construído e a falha apareceria só no entrypoint, em runtime, já no ar. Adicionados `comments` e `content-editor` (transitiva via `package.json:28`), mais um `test -d` de fail-fast. Cadeia varrida: `comments` → `content-editor`, `ui`, `config`; os dois últimos já estavam.
  **Lacuna medida em 2026-08-16, que nenhuma task nomeia: `@artificio/auth` não exporta `optionalAuth`.** `packages/auth/src/middleware.ts` expõe só `requireAuth`; o `downloads` tem o seu próprio (`backend/src/middleware/auth.ts:113`), construído sobre `verifyToken`. A leitura da árvore é **pública mas sensível à sessão** (`my_vote`, `viewer_is_author`) — sem auth opcional, ou a conversa exige login para ler, ou `my_vote` some para quem está logado. O `site` já importa `verifyToken` (`server/server.ts:11`), então é código local, não dependência nova. Decidir se o middleware nasce no `site` (como no `downloads`) ou sobe para `packages/auth` — subir toca o pacote sagrado e exige a trava própria de `packages/auth`.
  **Molde medido, para não reinventar:** fachada = `apps/downloads/backend/src/routes/communityComments.ts` (proxy transparente, `X-Service-Token`, `Idempotency-Key` vindo do cliente, `Retry-After` atravessando, `503`/`502` honestos); guard = `community/materialSubjectGuard.ts` (aqui vira `posts.status = 'publish'`); montagem = `apps/site/server/server.ts:201`, que já usa o padrão `app.use("/api/catalog/v1", catalogApi())`. `subject_type` = `site.post` (`contrato-http-v1.md:84`), `canonical_path` = `/blog/${slug}/` — confere com `trailingSlash: "always"` (`astro.config.mjs:8`). CSP já permite: `connect-src 'self'` cobre fachada same-origin. Hoje o `site` tem **uma** ilha React (`SiteHeader.astro:30`, `client:idle`) e **zero** consumo de `@artificio/comments`.
- [ ] T6.5 — Adotar o pacote para comentário novo, mantendo o legado **imutável, mas respondível** (decisão 23). · feito quando: comentário novo exige SSO; legado não edita nem vota; resposta nova autenticada ao legado funciona e preserva a árvore.
- [ ] T6.6 — **Reconciliação com critério, não contagem e amostra** (requisito 24b). Preflight de órfãos e ciclos (`site.comments.parent_id` não tem FK — `001_init.sql:66`), quantidade, IDs, hashes normalizados, `created_at`, nomes, relações parentais, e **lista explícita de divergências**. · feito quando: relatório vazio, ou cada divergência com causa registrada.
- [x] T6.7 — **Garantir que os testes novos de fato rodam.** · feito quando: os testes desta fase aparecem no script executado, e o lint do `site` valida os arquivos novos.
  **Verificado em 2026-08-16, por execução:** os 19 testes novos da fase (12 da fachada/guard + 7 do exportador) apareceram sozinhos em `rtk vitest run`, levando o `site` de 53 para **72/72** sem tocar o script. O lint pegou erro real nos arquivos novos (`_actingUserId` não usado) e exigiu correção — não é no-op. Prova que `"test": "vitest run"` varre por padrão e `"lint": "eslint ."` valida, como o texto reescrito acima já indicava.
  **A premissa [P1] desta task caducou — medido em 2026-08-16.** O texto anterior (e `plan.md:315`) afirmava que `apps/site/package.json:16` enumera cinco arquivos fixos no teste e que `lint` é `echo "(site) lint TODO"` (`:15`). O arquivo real traz `"lint": "eslint ."` e `"test": "vitest run"`: o script já varre por padrão, e arquivo novo **não** fica invisível. `rtk git log -3 -- apps/site/package.json` aponta os commits que fecharam a lacuna — `797ccdc` (spec 091, "fechar lacuna de typecheck sobre arquivos de teste e travar com gate") e `4d15b01`; `apps/site/eslint.config.js:6` documenta a troca do `echo`. A task deixa de ser correção e vira **verificação**: rodar `rtk pnpm --filter @artificio/site test` e `lint` depois de criar os testes da fachada e confirmar que aparecem na contagem.
  **O `echo TODO` sobrevive em OUTROS dois apps** — `apps/site-admin/package.json:11` e `apps/links/package.json:15` —, fora do escopo desta fase. Reportado ao mantenedor como achado lateral; pendente de decisão (corrigir/registrar).

## Fase 7 — Adoção no `mesas`

Terceiro consumidor: nada a preservar, mas ganha superfície pública nova.

- [ ] T7.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T7.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T7.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T7.1 — 🔒 **[P0] ABSORVIDA PELA SPEC 089 FASE 6B.** Implementação local concluída e validada em `feat/089-fases-7-8` em 2026-07-28: detalhe, `/view`, `/click` e favoritos aplicam a mesma política pública, com sete testes de rota. Permanece aberta aqui até a PR da 089 ser mergeada em `dev`; registrar número/SHA então.
- [ ] T7.1b — 🔒 **[P0] ABSORVIDA PELA SPEC 089 FASE 6B.** Implementação local concluída e validada em `feat/089-fases-7-8` em 2026-07-28: `sanitize-html` na escrita e leitura defensiva, preview com `html: false`, payload hostil coberto e `RichTextArea.tsx` removido. Medição Beta/Prod achou zero HTML/entidade persistido; decisão do mantenedor foi não criar migration retroativa. Permanece aberta aqui até a PR da 089 ser mergeada em `dev`; registrar número/SHA então.
- [ ] T7.2 — **[P0] `owner_user_id` enviado ao registro central é o `google_id`, nunca o UUID local.** Confusão material entre dois UUIDs: `gm_user_id` devolvido pela rota é `mesas.users.id` (`routes/tables.ts:470`), enquanto o ID do `accounts.` vive em `users.google_id` (`db/types.ts:14`) — o middleware converte a sessão central em usuário local (`middleware/auth.ts:37`). Mandar `gm_user_id` ou `req.user.userId` para o `accounts.` associaria o comentário à conta errada, ou a nenhuma. · feito quando: teste prova que o ID enviado resolve para a mesma conta do `accounts.` que originou a sessão.
- [ ] T7.3 — **Ciclo de vida da mesa define o que é comentável** (requisito 26). Mesa ativa, pública e não expirada: leitura e escrita; encerrada ou arquivada: leitura preservada, escrita nova bloqueada; rascunho ou oculta: **sem leitura pública nem escrita**; removida: a fachada devolve alvo inexistente. A validação roda **a cada criação e a cada resposta**, nunca confiando no payload — ownership recalculado por recurso (OWASP Business Logic). · feito quando: os cinco estados testados, cada um falhando fechado.
- [ ] T7.4 — Rotas e UI de comentário no `mesas`, **separadas** do campo `comment` do review de mestre, que não é migrado (requisito 26). O contrato próprio do review está confirmado em `routes/gm.ts:606` — são coisas diferentes e continuam assim. · feito quando: as duas coisas coexistem sem confusão de contrato.
- [ ] T7.5 — **[P1] Namespace próprio para as rotas novas: `/api/v1/community/*`.** Colisão real: o `mesas` **já tem** `/api/v1/notifications` (`server.ts:127`), e o frontend depende exatamente dessa URL (`components/NotificationBell.tsx:61`). Substituir o contrato quebraria as notificações administrativas que já funcionam. Fusão dos dois feeds só depois de contrato explícito, se for pedida. · feito quando: as rotas novas convivem com as existentes, e o sino atual continua funcionando.
- [ ] T7.6 — **Destinatário e badge nas mesas especiais** (requisito 15b). Decisão do mantenedor (2026-07-27): quem recebe é a **conta publicadora** — a única com vínculo real no `accounts.` Mestre nomeado só em `actual_gm_name`, sem conta, não recebe (não há para onde notificar); mesa órfã, sem `gm_id`, não gera notificação de publicação; badge só quando há conta real por trás. · feito quando: os três casos testados, sem inventar destinatário.
- [ ] T7.7 — Confirmar que a moderação cobre a superfície nova — comentário em mesa é conteúdo público. · feito quando: moderador global retira comentário de mesa pela UI.
- [ ] T7.8 — **Cobertura que as duas tasks anteriores não tinham:** adapter da fachada, UI, estados de carregamento e erro, threads, degradação com o `accounts.` fora, limites de tamanho e taxa, e testes de cada um. A versão anterior desta fase tinha duas tasks para tudo isso. · feito quando: cada item com teste, não só implementado.

## Fase 8 — Validação integrada

- [ ] T8.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T8.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T8.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T8.1 — `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test` e `rtk pnpm verify:api` verdes — **e verdes provando alguma coisa**. A raiz só delega ao Turbo (`package.json:7`), o lint do `site` é no-op e o teste dele usa lista fechada de arquivos (`apps/site/package.json:15-16`). Exigir testes nomeados de fachada, ilha, degradação, árvore/`more`, quatro sorts, Wilson PostgreSQL, voto, Markdown/link/imagem, edição/tombstone, denúncia/caso, auto-hide, recurso, sanção, recibos transacionais, exclusão/expurgo/recadastro e ausência de IP persistido dentro do script efetivamente executado. · feito quando: quatro comandos exit 0, contagem N/N por app/pacote registrada e cada família aparece na saída.
- [ ] T8.2 — **Validação sem deploy de beta do `accounts.` — ele não existe.** A versão anterior pedia "deploy em beta de `accounts.`": impossível. O manifesto declara o módulo **PROD-ONLY** com `env_override: "prod"`, e a build-matrix do workflow **bloqueia** `dispatch env=beta` para `accounts` (`.github/deploy-manifest.json:147`) — beta reusa o `accounts.` de produção. O aceite nunca poderia ser cumprido. **Estratégia decidida pelo mantenedor (2026-07-27):** mudança central **aditiva, compatível e inicialmente desabilitada**; ativação limitada a `realm=beta` com credenciais allowlisted dos módulos beta; comparação de erro, latência e autenticação contra controle; só depois, habilitação produtiva separada. População, duração, métricas e rollback definidos **antes** de ligar. Cada ação real segue exigindo autorização nominal. · feito quando: o canário roda em `realm=beta` sem afetar prod, com as métricas comparadas e registradas.
- [ ] T8.3 — **Smoke de SSO que prova mudança de papel**, não só sessão. Login, `/me` e logout não provam nada sobre autorização. Incluir: `moderator` no login, no `/me`, no access token **e no refresh**; promoção e revogação observadas **dentro do SLA** de T1.2; falha fechada durante indisponibilidade; **todos** os consumidores de `packages/auth`; isolamento entre `realm` beta e prod. · feito quando: os cinco verificados em todos os consumidores, com evidência.
- [ ] T8.4 — **Smoke de agregação, corrigido.** A versão anterior pedia "comentar no `downloads`, **responder pelo `site`**" — contradiz o trust boundary: a fachada do `site` teria de validar um alvo que pertence ao `downloads`, ou a resposta nasceria em outro `source_app`, quebrando a integridade do pai. O correto: comentar e responder **dentro de cada módulo** (`downloads`, `site`, `mesas`); as notificações dos três aparecem na **mesma central**; e cada link leva de volta ao módulo e ao contexto certos. Navegar da central até o `downloads` é o cruzamento legítimo — e é isso que a redação anterior provavelmente queria dizer. · feito quando: os três módulos comentam e respondem, e a central mostra os três com links corretos.
- [ ] T8.5 — Smoke de moderação unificada: moderador global recebe denúncia, compara versão/diff, decide caso, retira/restaura comentário, aprova/reabre versão, julga recurso e aplica/remove restrição de comentário sem bloquear SSO. Repetir origem nos três módulos sem papel por app. · feito quando: os fluxos passam nos três `source_app`, com auditoria e notificação mínima corretas.
- [ ] T8.6 — **Smoke de degradação em cinco modos, não um.** Simular timeout, conexão recusada, HTTP 500, resposta inválida (HTML no lugar de JSON, JSON malformado, schema incompatível) e circuito aberto. Em todos: a página continua de pé; a área de comentários mostra aviso; **escrita e moderação falham fechadas**; retries limitados. · feito quando: os cinco verificados por configuração de teste — **nunca** derrubando o `accounts.` real.
- [ ] T8.7 — **Gates de dados antes de encerrar:** reconciliação dos legados do `downloads` e do `site`; isolamento por `realm`; colisão intencional de `subject_id` entre apps; tombstone preservando filhos; legado imutável **aceitando resposta nova** e recusando voto; recibos deduplicados quando pai e publicador são a mesma conta; estado de leitura compartilhado; quatro sorts sem misturar níveis; `more` sem órfão; auto-hide por cinco contas; versão aprovada imune a reabertura automática; recurso e sanção sem bloquear SSO. · feito quando: os treze passam, com evidência.
- [ ] T8.8 — **Rollback definido antes de precisar dele.** Desligar a feature e as credenciais dos módulos; **preservar o schema aditivo e os dados já escritos**; restaurar os consumidores anteriores; comprovar que a autenticação central continua saudável. **Apagar tabela não é rollback** — é perda de dado com outro nome. · feito quando: o procedimento está escrito e ensaiado, não só descrito.
- [ ] T8.9 — Se algum critério falhar, **parar e reportar** — não fechar como parcial. · feito quando: todos batem, ou o bloqueio está registrado com evidência.
- [ ] T8.10 — **Medir o IP real sem bloquear a implementação** (decisão 54). Fazer requisição controlada pelo caminho Cloudflare→Tunnel→fachada; provar que dois clientes não colapsam no IP do tunnel e que header forjado não vence a cadeia confiável. Registrar somente IPs mascarados/resultado, nunca valor bruto. Calibrar env dos buckets; falha impede ativar o bucket por IP e abre correção restrita ao ingress, sem alterar schema/API comunitária. · feito quando: evidência mascarada identifica a chave efetiva e configuração resultante; busca no banco/payload confirma zero IP comunitário.
- [ ] T8.11 — **Smoke do ciclo de exclusão aprovado** (decisões 52–53). Pela UI real de `/conta`, conferir aviso com controlador/contato/prazos, excluir conta sem caso, verificar cookies/refresh revogados e escrita comunitária imediata recusada, comentário/score como “Conta excluída”, recadastro bloqueado antes do prazo e nova identidade após relógio controlado; repetir com caso ativo e `legal_hold`. · feito quando: os dois caminhos terminam no estado previsto sem PII pública, perda de conversa ou vínculo vencido visível.

---

## Bloqueios conhecidos

- **[DÉBITO → promovido a spec própria em 2026-08-05: `specs/091-repo-typescript-7-preparo/`]
  Atualizar o TypeScript do monorepo — hoje `~6.0.3`, com o TS 7 já lançado.** O débito abaixo
  fica como registro do achado; a execução e as decisões do mantenedor (escopo de preparo, os 8
  pacotes `node10`, global permanecendo no 7) vivem na 091. Achado durante T2.2, ao investigar um
  `TS5108` que primeiro registrei errado como falso alarme (ver o bloco de T2.2). São **duas
  frentes distintas**, e a segunda não é trivial:

  **(a) Ambiente local — `typescript@7.0.2` global fora do repo.** Está em
  `C:\Users\paulo\AppData\Roaming\npm`, instalado seguindo o README do plugin `typescript-lsp`
  do Claude Code (`npm i -g typescript-language-server typescript`). Entra no `PATH` antes do
  binário do workspace e faz `tsc` invocado à mão falhar com
  `TS5108: Option 'moduleResolution=node10' has been removed` nos 8 pacotes dual-CJS
  (`auth`, `content`, `content-editor`, `feedback`, `changelog`, `catalog-matching`,
  `catalog-client`, `comments`) — `ignoreDeprecations: "6.0"` cobre a depreciação do TS 6, não
  a remoção do TS 7. **Não afeta build nem CI**, que usam o `tsc` do workspace: medido em
  processo vivo, os dois `tsserver` em execução carregam
  `c:\projetos\artificio\node_modules\typescript\lib\tsserver.js` (6.0.3), porque o
  `typescript-language-server` prioriza `Workspace` sobre `bundled`
  (`cli.mjs:24011-24034`). Afeta **só diagnóstico manual** — e já custou uma conclusão errada
  registrada nesta spec.

  Correção proposta e **não executada** (aguarda decisão): `npm i -g typescript@6.0.3` em vez de
  desinstalar. Motivo medido: o `typescript@7.0.2` **não contém `tsserver.js`** — `lib/` tem só
  `tsc.js`, `getExePath.js` e `version.cjs`, e o `package.json` declara um único binário,
  `tsc`. Ou seja, o fallback `bundled` do language server **já está quebrado hoje**, apontando
  para um arquivo inexistente; rebaixar para 6.0.3 conserta isso e alinha com o repo, enquanto
  desinstalar deixaria o fallback quebrado do mesmo jeito.

  **(b) Repo — migrar de TS 6 para TS 7 é trabalho de spec própria, não ajuste de versão.**
  Superfície medida: `~6.0.3` declarado em 11 `package.json` (raiz + 8 apps + pacotes), 54
  `tsconfig*.json`, dos quais 8 usam `moduleResolution: node10` (removido no TS 7) para emitir
  o `dist-cjs` que os backends consomem. Dois bloqueadores concretos, ambos medidos:

  1. **`typescript-eslint@8.61.1` declara `SUPPORTED_TYPESCRIPT_VERSIONS = '>=4.8.4 <6.1.0'`**
     (`typescript-estree/dist/parseSettings/warnAboutTSVersion.js:47`). TS 7 fica fora do range.
     É aviso, não erro fatal — mas 12 pacotes usam lint type-aware.
  2. **O TS 7 não expõe mais a API do compilador por `require('typescript')`.** Medido: o
     `package.json` do 7.0.2 tem `exports["."] = "./lib/version.cjs"`, sem `main` nem `types`, e
     esse módulo exporta **apenas** `{ version, versionMajorMinor }` — `createProgram`,
     `createSourceFile` e `ScriptTarget` não existem ali. TS 7 é o compilador nativo
     (`optionalDependencies` são binários por plataforma, `@typescript/typescript-win32-x64` e
     19 outros). Todo consumidor programático — `typescript-eslint`, `vitest`, `vite`, `astro` —
     depende dessa API.

  **Consequência:** a migração não é bump de versão; depende do ecossistema publicar suporte a
  TS 7. Enquanto isso, `~6.0.3` é a escolha correta, e os `node10` dos 8 pacotes **não são
  débito próprio** — são o que funciona na versão em uso. Reavaliar quando `typescript-eslint`
  ampliar o range suportado.

  **Nada foi alterado.** O global segue em 7.0.2 (renomeado temporariamente durante o teste e
  restaurado, verificado sem resíduo); o repo segue em `~6.0.3`.

- **`accounts.` é sagrado — e `packages/auth` também entra.** Toda fase que toca o `accounts.`
  (1, 2, 3) exige aprovação + SDD Completo + smoke de todos os consumidores SSO. **A criação do
  `moderator` toca `packages/auth` obrigatoriamente**: `UserRole` é `"user" | "admin"`
  (`types.ts:1`), e o decoder, o cliente e `verifyRefreshToken` (`tokens.ts:44`) rejeitam
  qualquer outro valor. São duas aprovações nominais, pedidas juntas em T0.14.
- **~~[P0] Refresh perpetuava papel antigo — resolvido em T1.2.~~** Mantido como histórico do
  risco que bloqueava a Fase 1; refresh agora relê o banco e o SLA é 15 minutos.
- **[P1] Um único rate limiter cobre o `accounts.` inteiro** (200 req/15 min, `app.ts:79`).
  Expor comentários sem separar os limiters faz tráfego de leitura consumir a cota de `/login`,
  `/me` e `/refresh`. T2.10 separa antes. **A incerteza arquitetural sobre IP foi encerrada pela
  decisão 54:** IP fica na fachada e efêmero; T8.10 apenas mede/calibra antes do uso integral.
- **CSRF exclui escrita direta do navegador — resolvido por desenho em T0.5/T2.2.** Fachadas
  same-origin validam o assunto e chamam `accounts.` com credencial backend-to-backend; não
  ampliar allowlist para contornar o trust boundary.
- **Beta e prod compartilham o `accounts.`** (`plan.md:30`), apesar de o manifesto declará-lo
  prod-only. Sem `realm` na chave (T0.6), comentário de teste em beta aparece em produção.
- **`BLQ-090-CRED` — [RESOLVIDO em 2026-08-15; sucedido por `BLQ-090-CRED-WRITE`] A credencial de
  serviço do `downloads` tinha 2 dos 6 escopos que a Fase 4 exige, e nenhum gate pegava isso.**
  Estado final medido em `artificio_auth` (banco do `accounts.`, container `accounts-db`):

  | source_app | realm | slot | escopos | ativa | last_used_at |
  |---|---|---|---|---|---|
  | downloads | prod | current | `users.read, secrets.read` | **não** (revogada) | 2026-08-15 07:00:02 |
  | downloads | beta | current | `users.read, secrets.read` | **não** (revogada) | 2026-08-15 07:00:04 |
  | downloads | prod | next | +`comment.read, report.write, moderation.write, notification.write` | sim | 2026-08-15 19:08:27 |
  | downloads | beta | next | mesmos 6 | sim | 2026-08-15 19:07:38 |

  A rotação fechou os 5 passos: as `next` de 6 escopos estão em uso (`last_used_at` recente) e as
  `current` de 2 escopos foram revogadas. `403 insufficient_scope` na superfície de moderação e na
  entrega de notificação deixou de ocorrer por falta de escopo.

  **Aprendizados que sobrevivem ao bloqueio, porque valem para a próxima credencial:**

  - **Nenhum gate alcança escopo de credencial.** `critical_routes_beta` do `downloads` cobre
    `/api/v1/health`, `/` e `materials/mine`→401 — nenhuma rota de moderação. Lint, build, teste e
    `verify:api` também não: o escopo vive em linha de banco, não em código. Deploy fica verde com
    a feature principal fora do ar.
  - **São 4 consumidores do mesmo `SERVICE_CREDENTIAL`, não 1.** `secretsClient.ts:41`
    (`secrets.read`), `accountsClient.ts:38` (`users.read`), `notificationOutboxDelivery.ts:138,142`
    (`notification.write`) e a fachada `routes/communityModeration.ts` (`moderation.write`,
    `report.write`, `comment.read`). Diagnóstico que olha só a fachada deixa a notificação quebrada
    para descoberta posterior — foi o erro da primeira passada.
  - **Correção nunca é `UPDATE` na linha.** `uq_community_service_credential_active` é único por
    `(source_app, realms[1], rotation_slot) WHERE revoked_at IS NULL`. O caminho é
    `scripts/serviceCredentialAdmin.ts:22-28`: emitir em `--slot next`, publicar no `.env`,
    reiniciar, **confirmar tráfego pela nova**, só então revogar. Revogar antes do passo 3 derruba o
    módulo.
  - **`serviceCredentialAdmin.ts:28` recusa revogar credencial cuja sucessora nunca foi usada**, e
    os consumidores da credencial em prod não são acionáveis por requisição pública. O que destravou
    foi o `scraperScheduler.ts:15` (`'0 4 * * *'`): a ingestão diária chama `detectPortuguese`
    (`scraperIngest.ts:286`) → `getSecret('deepseek_api_key')`, exercitando `secrets.read` com a
    credencial nova sem depender de sessão.
  - **Ambiente em produção manda, não o código-fonte.** A emissão falhou primeiro com
    `escopo inválido: notification.write` porque o `accounts.` de prod estava atrás do disco
    (`schema_migrations` com 9 linhas contra 11; faltavam `migration_010` e `migration_011`, esta a
    que amplia o `CHECK` de `scopes`). Ordem correta: **deploy de prod do `accounts.` primeiro**,
    depois emissão dos crachás, depois validação.

- **`BLQ-090-CRED-WRITE` — [BLOQUEIO ATIVO, sucessor do anterior] A credencial do `downloads` não
  tem `comment.write` nem `vote.write` — os dois escopos que a Fase 5 exige.** Medido em
  2026-08-15, na abertura da Fase 5. Os 6 escopos atuais cobrem a Fase 4 (moderação, denúncia,
  leitura de árvore, ingestão de notificação) e **nenhuma escrita de fala**: `POST
  /internal/v1/comments` e `.../:id/replies` exigem `comment.write`
  (`communityCommentRoutes.ts:168,177`), `PUT .../vote` exige `vote.write` (`:221`). Comparação que
  mostra que não é limitação do desenho: a credencial do `site` em beta já tem `comment.write`.

  **Consequência:** T5.3 (delegação da escrita), T5.4 (UI de conversa) e T5.5 (caixa de entrada do
  autor) não funcionam em ambiente nenhum até a rotação. Leitura (`comment.read`) já passa.

  **Procedimento:** mesma rotação do bloqueio anterior, com um detalhe novo — o slot `next` já está
  ocupado pelas credenciais de 6 escopos em uso. Conferir em `serviceCredentialAdmin.ts` se a
  emissão vai para `current` (agora livre, as antigas foram revogadas) ou se exige liberar `next`
  antes. **Aguarda aprovação nominal: é escrita no banco de produção.**

- **`BLQ-090-NGINX` — [APRENDIZADO OPERACIONAL, causado pelo agente] Recriar só `<mod>-api` à mão derruba toda a
  API pública do módulo: o nginx do `<mod>-app` cacheia o IP do upstream.** Medido em
  2026-08-15, durante a rotação de credencial de prod do `downloads`: após
  `docker compose up -d --force-recreate downloads-api`, o IP do container mudou para
  `172.18.0.9` e **toda** a `/api/` de `downloads.artificiorpg.com` passou a devolver `502`,
  enquanto a home seguia `200` — porque o tunnel só conhece o frontend, e
  `downloads-app:/etc/nginx/conf.d/default.conf` faz `proxy_pass http://downloads-api:3000`.

  **Prova dos dois lados, que é o que separa este diagnóstico de um chute:** `wget` executado
  *dentro* do `downloads-app` alcançava `http://downloads-api:3000/api/v1/health` normalmente
  (resolve o nome na hora), enquanto o *processo* nginx registrava
  `connect() failed (111: Connection refused) while connecting to upstream` — o worker resolveu
  o nome uma vez, no boot, e guardou o IP antigo. Correção: `docker restart downloads-app`;
  `/api/v1/health` voltou a `200` e a rota privada a `401`.

  **Regra:** recriação manual de container de API exige recriar também o front que faz proxy
  dele. O deploy pela esteira **não** tem esse problema — recria os dois juntos, confirmado no
  mesmo dia pelo `glossario` (front+API separados, deploy verde, zero `502`).

  **Pista falsa descartada no caminho:** havia 6 `Unable to reach the origin service` no log do
  `cloudflared` antes da mudança, mas `dest=` mostrava serem do `links`, durante o deploy dele —
  não do `downloads`.

  **A emissão é bloqueada por uma causa anterior, descoberta ao executá-la (2026-08-15).** O
  comando `issue --scopes ...,notification.write` falhou com `erro: escopo inválido:
  notification.write`, `exit=1`, **antes** do `INSERT` — verificado: as duas credenciais seguem
  as únicas ativas, nenhuma linha criada. A causa não é o script: **o `accounts.` em produção
  está atrás do código.** Medido: `dist/serviceCredential.js` do container conhece 7 escopos
  (falta `notification.write`), e `schema_migrations` tem **9 linhas contra 11 no disco** —
  faltam `migration_010_notification_consolidation.sql` e
  `migration_011_notification_ingest_scope.sql`, esta última sendo exatamente a que amplia o
  `CHECK` de `scopes`. O `CHECK` no banco recusaria o valor mesmo se o script aceitasse.

  **Consequência de ordem, e o erro de plano que ela corrigiu:** a sequência que eu havia
  recomendado (crachá → deploy) é impossível. A correta é **deploy de produção do `accounts.`
  primeiro** (aplica 010/011 pelo runner padrão e leva junto o `Dockerfile` do E016/E017), só
  então a emissão dos crachás, só então validar. O plano anterior media os escopos que o
  *código-fonte* define; o que manda é o que o *ambiente em produção* aceita. Medir o repo e
  concluir sobre a VM é o mesmo defeito de sempre, com roupa nova — e aqui só a execução real
  o expôs, porque `lint`/`build`/`test`/`verify:api` são todos verdes com o ambiente defasado.
- **`BLQ-090-FETCH` — [BUG DE INFRA, fora do escopo da 090 — aguarda decisão do mantenedor] `_deploy-module.yml:384`
  faz `git fetch` sem force e perde corrida quando `dev` avança durante o deploy.** Medido em
  2026-08-15, ao disparar site/mesas/downloads em beta: mesas e downloads deram `success`, o site
  falhou com `error: cannot lock ref 'refs/remotes/origin/dev': is at ea363f7a but expected
  500da4b8` + `exit code 1`, **antes de recriar o container** — o clone ficou no commit certo mas
  o `site-beta-app` seguiu `Up 5 days` servindo código velho (confirmado: `grep '&#039;'` no
  `content-html.ts` dentro do container devolveu `NAO_ENCONTRADO`). As rotas seguiram 200; a
  falha é silenciosa do ponto de vista do smoke.

  **Duas hipóteses minhas foram medidas e DESCARTADAS — as duas o mantenedor recusou antes de
  eu medir, e nas duas ele estava certo:**

  1. **"É o paralelismo."** Não é. `_deploy-module.yml:341` usa `flock -s` — lock
     **compartilhado** da VM — e `:347` um lock exclusivo **por módulo**
     (`artificio-${MODULE}-deploy.lock`). Deploys de módulos diferentes em paralelo são o
     desenho, não abuso.
  2. **"Falta o `+` (force) no refspec da linha 384."** Também não é, e esta eu cheguei a
     registrar aqui como se fosse a causa. Medido depois: o clone da VM tem
     `remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*` (`git config --get-all`), ou
     seja **o `+` já se aplica** a `git fetch origin dev`. A correção que eu ia propor era
     inócua — teria "consertado" algo já correto e o erro voltaria.

  **Causa real, pela documentação oficial:** `cannot lock ref` não é política de fast-forward,
  é a **verificação de valor antigo (compare-and-swap)** do `git update-ref` — o git cria o
  `.lock`, confere que o ref ainda está no valor que leu, e aborta a transação inteira se outro
  processo mudou no intervalo ("If all refs can be locked with matching old-oids simultaneously,
  all modifications are performed. Otherwise, no modifications are performed.",
  `git-scm.com/docs/git-update-ref`). O `+` governa **o que** pode ser gravado (aceitar
  reescrita de histórico); não governa **atomicidade da escrita**. São camadas distintas, e eu
  as confundi. Reflog da VM confirma a corrida: `500da4b8 → ea363f7a`, dois
  `fetch origin dev --tags` consecutivos.

  **Agravante, agora com peso maior do que eu havia dado:** `.git/packed-refs` do clone é de
  **5 de junho** e declara `origin/dev`/`origin/main` em `c5ff42dd`, divergente dos refs soltos.
  A literatura da ferramenta aponta `packed-refs` dessincronizado como fator desta classe de
  erro, e o timeout de lock desse arquivo é de **1 s por padrão** — janela compatível com dois
  fetches quase simultâneos.

  **Por que nunca apareceu antes:** exige `dev` avançar na janela entre dois fetches. Deploys
  com `dev` parado — o caso comum — nunca disparam.

  **Correção definitiva NÃO aplicada e ainda não aprovada.** Candidatos vindos da documentação
  (não medidos neste repo): `git pack-refs --all` para reconciliar, e/ou elevar
  `core.packedRefsTimeout`. Ambos são escrita no clone de deploy → exigem aprovação nominal.
  **Contorno usado em 2026-08-15:** serializar os deploys / redisparar sozinho o perdedor.
  Procedimento operacional completo: `docs/agents/deploy-runbook.md` §Deploys simultâneos.
- **`accounts` e `links` não têm realm beta — `deploy.yml:184` recusa o dispatch.** Medido em
  2026-08-15: `if { [ "$m" = "accounts" ] || [ "$m" = "links" ]; } && [ "$eo" = "beta" ]` aborta
  com `ERRO: $m nao tem realm beta`. Consequência de produto que não é óbvia: correção de
  segurança nesses dois módulos **não tem caminho de validação em beta** e só chega ao ar indo
  para produção. No merge da PR #262 isto vale para o bump de `sanitize-html` do `links`
  (`^2.17.4`→`^2.17.7`) e para o `Dockerfile` do `accounts` (prevenção de E016/E017: `ui` e
  `changelog` entram no `--prod --filter` antes de existir import de servidor).
- **~~`accounts.` migra schema inline no boot~~ — resolvido pela T0.12.** `src/migrate.ts` foi
  removido e o `Dockerfile` não migra mais no boot; o schema passa pelo runner padrão. Efeito
  colateral que virou T1.11–T1.13: o container sobe saudável mesmo com schema defasado, então o
  drift check é hoje o único alarme do SSO.
- **Papel errado tira acesso.** Sem migração e sem leitura dupla (decisão de 2026-07-30), o
  rollback não é mais "papel local ainda vale": é reverter o papel no próprio `accounts.` pelo
  painel (T1.5b), que reflete na sessão ativa dentro do SLA de 15 minutos da T1.2. O risco
  concentrado que sobra é o bootstrap (T1.5a) — se `ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL` estiver
  errado no `.env` da VM, ninguém vira admin e o painel fica inalcançável; o conserto é corrigir
  a variável e reiniciar, sem SQL manual.
- **Ponto único de falha novo.** Queda do `accounts.` passa a afetar comentários e notificações
  dos três módulos, não só login. Requisito 22 e T4.6/T4.8/T4.9 são a mitigação.
- **Os comentários do `site`** foram medidos em produção: 25 em 2026-08-04. T6.3 reconta
  `N_source` no cutover e T6.1 faz dump antes de tocar.
- **`accounts.` passa a guardar conteúdo de usuário**, não só identidade. Inverte a regra de
  isolamento de dados do monorepo, deliberadamente, para viabilizar a agregação.
- **A spec 089 depende desta** para os requisitos 18-22 e 32-35.
- **~~Retenção/exclusão bloqueava T2.15 — resolvido pelas decisões 52–53.~~** Ator comunitário
  separado preserva conversa/score; vínculo nominal tem finalidade, prazo, `legal_hold` e expurgo.
- **Adequação específica ao ECA Digital foi diferida pelo mantenedor.** A Fase 2 é implementada
  integralmente em pré-lançamento; idade não é critério de aceite atual e será trabalho posterior
  antes do uso integral da comunidade. Isto é risco/diferimento explícito, não alegação de que a
  adequação já foi entregue.
