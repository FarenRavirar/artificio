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

## Fase 2 — Comentários no `accounts.`

> **55 decisões do grilling da Fase 2 — registradas em 2026-08-04; grilling CONCLUÍDO.**
> Decisões 1–55 foram movidas para `spec.md` §Apêndice. As tasks T2.1–T2.26 e T4.6 foram
> reescritas para não contradizê-las; onde uma task dizia o oposto, a revogação está anotada
> na própria task.
>
> **Encerramento do grilling.** Não restam escolhas de produto conhecidas para a
> Fase 2. Antes de implementar, `spec.md`, `plan.md` e as tasks T2 antigas precisam
> ser reconciliados com as decisões 1–51: o texto original ainda contém contratos
> deliberadamente revogados durante o grilling, entre eles texto puro, profundidade
> 2, proibição de edição/auto-retirada, proibição de responder ao legado e cache
> stale obrigatório entre recargas. Este bloco é a decisão mais recente; a
> reconciliação documental é o próximo passo, não uma nova rodada de produto.
>
> Este bloco prevalece sobre formulações anteriores da Fase 2 que tratem
> `root_id` como opcional, limitem profundidade a `2`, imponham cap por quantidade
> de filhos, tratem paginação como lista plana, deixem notificações somente para a
> Fase 3 ou tratem comentários como superfície sem votos.
>
> **Fechamento pós-grilling (2026-08-04).** As decisões 52–55 resolvem os dois pontos
> que a primeira reconciliação deixou abertos: retenção/exclusão e posição do IP. O
> tratamento de idade foi diferido nominalmente e não compõe o aceite desta fase.
>
> **Tasks reformuladas a partir destas decisões em 2026-08-04.** O bloco 1–55 acima é a
> fonte; T2.1–T2.26, T8.10–T8.11 e as tasks dependentes de pacote/UI na Fase 4 são a execução
> dele e foram reescritas para não
> contradizê-lo. Onde uma task dizia o oposto de uma decisão, o texto antigo foi
> substituído e a revogação anotada na própria task — não silenciosamente. Mapa
> das inversões, para quem revisar sem reler as 55 decisões:
>
> | O que a task dizia antes | O que passou a valer | Decisão |
> |---|---|---|
> | `body_text`, texto puro | `body_markdown` pelo pipeline `@artificio/content-editor` | 24 |
> | `depth<=2` | `depth<=4` (cinco níveis visuais) | 3 |
> | `root_id` opcional | `root_id` obrigatório | 3 |
> | Legado **não** aceita resposta (T2.4, T2.8, T2.11) | Legado **aceita** resposta nova | 23 |
> | Autoedição e autoexclusão proibidas (T2.7, D111 item 6, requisito 12) | Autor **edita e retira** o próprio comentário | 17 |
> | Listagem plana com cursor `(created_at, id)` | Árvore inteira, cap 1.000/2 MiB, cursor por `snapshot_revision` | 3, 8 |
> | `BIGINT` implícito na identidade | UUID v4 público | 16 |
> | Sem votos | Voto, score Wilson e quatro ordenações | 4, 5, 7, 19 |
> | Sem denúncia (fila prometia, contrato não entregava) | Denúncia, caso, fila e auto-hide no núcleo | 32–34, 40 |
> | Notificação toda na Fase 3 | Núcleo transacional antecipado para cá | 1 |
> | Vínculo nominal permanente/soft-delete bloqueado | Ator opaco + vínculo temporário + expurgo | 53 |
> | IP indefinido no `accounts.` | IP efêmero na fachada; usuário+credencial no central | 54 |
>
> **Tasks novas criadas pela reformulação:** T2.1b–T2.1f (schema de versão, voto,
> notificação e denúncia), T2.5b (perfil de comentário e política de link no
> pacote compartilhado), T2.6b (sem menções), T2.7b (edição/auto-retirada),
> T2.6c (criação + recibos atômicos), T2.12–T2.16 (voto), T2.17–T2.26
> (denúncia, moderação, recurso e sanção), T4.23–T4.26 (superfícies compartilhadas
> de denúncia, caso, recurso e sanção). T4.6 materializa a decisão 51.
>
> **Os dois itens antes abertos foram fechados pelas decisões 52–55.** T2.15 agora
> tem ciclo de retenção/exclusão executável; T2.10 não persiste nem propaga IP e usa
> a separação fachada versus `accounts.` já decidida. A medição real calibra o
> limiter antes do uso integral, sem bloquear schema/handlers. Adequação de idade é
> trabalho posterior nominalmente diferido, não critério da Fase 2.

> **Estado medido do ambiente (2026-08-04).** `artificio_auth` (prod): `users`, `admin_secrets`,
> `global_role_audit`, `schema_migrations`. Nenhuma tabela de comentário existe — T2.1 escreve schema
> novo.
>
> **⚠️ Guard `MAX_AUTO_PENDING=5`.** `accounts` tem exatamente 5 migrations (`001`…`005`); a
> migration de T2.1 é a sexta → deploy aborta (E012). Destravar com `MAX_AUTO_PENDING=<N>` no
> `apply_required_migrations.sh`, nunca fatiar em lotes. Decisão do mantenedor.
>
> **Legado do `site` (T2.8):** 25 comentários, 3 com `parent_id`, 0 órfãos, 21 autores distintos.
> `parent_id BIGINT` sem FK confirmado em `001_init.sql:66`. Detecção de órfão/ciclo obrigatória.

- [x] T2.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T2.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.

### Bloco A — Schema

- [x] T2.1 — **Schema do comentário, com identidade pública UUID v4 e corpo Markdown** (requisitos 5, 7a, 8, 9; decisões 3, 16, 24, 53). Reformulado em 2026-08-04: a formulação anterior pedia `body_text` (texto puro), `depth<=2` e FK nominal permanente em `user_id`; todos foram substituídos. Exigir: `id UUID` v4 como identidade pública, **nunca `BIGINT` enumerável** (decisão 16), sem UUID v7/ULID/lib nova; `realm`, `source_app`, `subject_type`, `subject_id TEXT` (T0.6); `community_actor_id` opaco em vez de autoria presa ao `users.id`; `parent_id UUID`, `root_id UUID` **obrigatório, não opcional** (decisão 3), `depth` com raiz em `0` e máximo `4`; **`body_markdown` para o comentário novo e campo próprio para o HTML legado — nunca campo ambíguo** (T0.9, decisão 24); `created_at`, `edited_at`; `removed_at`, `removed_by`, `removed_reason`; `ranking_revision` por assunto e `created_revision` por comentário (decisão 8); estado de visibilidade que comporte `pending_review_hidden` (decisão 34); `legacy_source`, `legacy_id`, `legacy_author_name`, com **`unique (legacy_source, legacy_id)`** para importação idempotente; e índice de listagem na ordem `(realm, source_app, subject_type, subject_id, created_at, id)`. · feito quando: migration idempotente, com header válido, passando no guard; excluir vínculo nominal não quebra FK de comentário/voto.
- [x] T2.1b — **Schema de versões do comentário** (decisões 17, 20, 39). `comment_versions` guarda todo `body_markdown` já válido, com autor da versão e timestamp. O público lê só a versão atual e `edited_at`; versões antigas são restritas a `moderator`/`admin`. A tabela é pré-requisito de T2.7b (edição) e de T2.12 (denúncia fixa `reported_version_id`) — sem ela a evidência de denúncia é ambígua. Versão referenciada por denúncia **não sofre purga automática**; expurgo de conteúdo sensível é ato administrativo explícito e auditado, que remove o corpo da revisão e preserva os metadados do evento. · feito quando: editar cria versão nova sem destruir a anterior, e o público não alcança versão antiga.
- [x] T2.1c — **Schema de voto e score** (decisões 4, 5, 7, 8, 21, 53). `comment_vote` guarda o **estado atual** do voto, único por `(community_actor_id, comment_id)` — nunca pela FK nominal de `users`. `comment_score_version` guarda `upvotes` e `downvotes` como **colunas base não negativas**, `score` como **coluna gerada** `upvotes - downvotes`, `best_score` como **coluna gerada por função SQL `IMMUTABLE` versionada** — inicialmente `comment_wilson_reddit_80_v1`, aritmética `numeric` para ordenação e cursor determinísticos —, mais `algorithm_version` e o intervalo de revisões em que a versão é válida. **PostgreSQL é a fonte canônica**: TypeScript/Kysely autoriza o ator, serializa a troca e cria a versão dentro da transação, mas **não mantém segunda implementação produtiva da fórmula** (decisão 21). Comentário novo nasce com score `0`; não há auto-upvote (decisão 5). Histórico de score é retido permanentemente nesta fase, sem rotina destrutiva (decisão 8). · feito quando: migration idempotente; tentativa de gravar `score` ou `best_score` diretamente falha; `upvotes`/`downvotes` negativos são rejeitados; e remover vínculo ator→conta não altera voto/score.
- [x] T2.1d — **Schema de notificação transacional antecipado da Fase 3** (decisão 1). Entram **agora** `notification_event` e `notification_receipt`, com a mesma estrutura que T3.1 especifica — evento imutável separado do estado por destinatário. Não entram central de notificações, polling, API pública de notificações nem outbox/eventos externos: esses continuam na Fase 3. Justificativa da antecipação: sem recibo transacional, o comentário nasceria com notificação best-effort, que é exatamente o defeito que T3.5 corrige no `downloads`. · feito quando: as duas tabelas existem e a Fase 3 não precisa migrá-las, só consumi-las.
- [x] T2.1e — **Schema de denúncia, caso de moderação e registro de motivos** (decisões 32, 33, 37, 39, 40, 53). `comment_reports` com `comment_id`, `reported_version_id` **obrigatório** apontando para `comment_versions`, `reporter_actor_id`, motivo, detalhes, estado e auditoria; integridade garante que a versão pertence ao mesmo comentário. Unicidade: **no máximo uma denúncia ativa por ator e comentário** (decisão 33). `moderation_case` com **no máximo um caso aberto por comentário** (decisão 40); cada denúncia permanece linha individual imutável ligada ao caso. A conta real do denunciante só é resolvida enquanto o vínculo temporário de T2.15 existir. Registro compartilhado de motivos declara código, rótulo, prioridade e obrigatoriedade de detalhes para `malicious_link`, `inappropriate_content`, `spam_or_off_topic`, `harassment_or_hate`, `personal_data`, `copyright_violation`, `illegal_content` e `other` (decisão 37), com prioridades iniciais P0/P1/P2 da decisão 38. Nenhum app cria enum ou state machine paralelo. · feito quando: migration idempotente; segunda denúncia ativa do mesmo ator no mesmo comentário é rejeitada; segundo caso aberto é rejeitado; e expurgo do vínculo não apaga a denúncia.
- [x] T2.1f — **Schema do ciclo completo de moderação comunitária e retenção de identidade** (decisões 43–49, 53). **Task nova pela reconciliação de 2026-08-04:** incluir veredito por denúncia (`upheld`, `dismissed`, `no_determination`, preservando `withdrawn`); ação terminal por caso (`no_change`, `restore`, `remove`); aprovação/reabertura auditada por `comment_version_id`; recurso único do autor por decisão removida, com prazo de seis meses e resultado `upheld|reversed`; restrições centrais independentes `posting`/`commenting`, com `warning`, suspensão temporária ou permanente; registro de motivo com `details=required|optional|forbidden`; `community_actor`, vínculo restrito e eliminável ator→conta, `retention_until`, `legal_hold` auditado e bloqueio mínimo de recadastro/sanção com `key_version`. Toda transição guarda ator, motivo e timestamp. · feito quando: migration idempotente; banco recusa segundo recurso; restrição temporária exige expiração; não existe estado terminal sem auditoria; vínculo vencido pode ser apagado sem remover ator/conteúdo/score; e IP não aparece em nenhuma tabela comunitária.

> **Evidência do Bloco A — 2026-08-04.** `migration_006_community_comments.sql`
> passou no guard como `online-safe`, foi aplicada e reaplicada com sucesso em
> PostgreSQL real num banco descartável da VM. `phase-2-measurement.sql` (nesta
> mesma pasta) passou em transação com `ROLLBACK`, cobrindo colunas geradas,
> contagens negativas, expurgo do vínculo, unicidades de denúncia/caso/recurso,
> detalhe obrigatório, expiração de suspensão e auditoria terminal. O banco
> descartável foi removido e sua ausência foi confirmada; `artificio_auth` não
> recebeu escrita desta validação.
>
> O script de medição nasceu em `apps/accounts/src/communityMigration.integration.sql`
> e foi movido para cá em 2026-08-04: `_enforce-migration-dir.yml` bloqueia
> **qualquer** `.sql` adicionado fora da allowlist (`apps/*/database/`,
> `apps/*/db/migrations/`, `specs/*/phase-*-measurement.sql`), não só arquivos
> chamados `migration_*`. No caminho antigo a PR travaria no CI. Evidência de spec
> é exatamente o caso que o padrão `phase-*-measurement.sql` da allowlist prevê,
> e deve sair quando a spec fechar.

> **Correções da review da PR #241 — 2026-08-04, todas reproduzidas em Postgres
> real antes de corrigir.** Dois furos do invariante "não existe estado terminal
> sem auditoria" (T2.1f) passaram pela validação original do Bloco A:
>
> 1. **INSERT direto em estado terminal escapava da auditoria.** O trigger só
>    tratava `TG_OP = 'UPDATE'`, então inserir caso já `closed`, denúncia já
>    resolvida ou recurso já decidido gravava estado terminal sem evento nenhum.
>    Corrigido separando os ramos INSERT e UPDATE nas cinco tabelas.
> 2. **Auditoria de transação anterior servia de álibi (Codex P2).** O check só
>    procurava "existe linha com este alvo/ação/ator/motivo"; evento commitado
>    numa transação que falhou depois era reusado por uma transição posterior.
>    Corrigido com `audit.xmin = pg_current_xact_id()::xid`, que exige a auditoria
>    ter nascido na transação corrente. `::xid` trunca o xid8 para os mesmos 32
>    bits de `xmin`, então a igualdade sobrevive a wraparound.
>
> Também corrigidos: `community_comment_version` era **deletável** (a versão é a
> evidência fixada por `reported_version_id`/`decision_version_id`; expurgo tem
> caminho próprio via `redacted_at`); e `ON DELETE SET NULL` nas quatro tabelas
> append-only falhava com "append-only" no meio da cascata — trocado por `NO
> ACTION`, porque o expurgo do requisito 7b desfaz o **vínculo** ator→conta, não o
> `community_actor` opaco.
>
> **Recusado da review:** incluir `source_app` em `uq_community_restriction_active`.
> T2.1f pede "restrições centrais independentes" e o requisito 12i trata sanção
> como comunitária; suspensão por app deixaria o sancionado migrar de módulo e
> seguir comentando. Comportamento confirmado em Postgres real (segunda suspensão
> em outro app é recusada) e o porquê ficou comentado na migration.
>
> **Lição de método:** os dois furos foram encontrados por reprodução em banco
> real, não por leitura — e a primeira rodada de testes deu falso-positivo porque
> terminava em `ROLLBACK`, e o trigger é `DEFERRABLE INITIALLY DEFERRED`, logo só
> dispara no `COMMIT`. Teste de constraint deferida que não commita não testa nada.

> **Trava de sequência — `realm` no schema não separa beta de prod sozinho.**
> Registrada em 2026-08-04, durante a conferência do Bloco A. A migration `006`
> materializa o **eixo** de separação (`realm` na PK de `community_comment_subject`,
> nas FKs compostas de toda tabela vinculada, no índice de listagem e em
> `uq_community_restriction_active`), mas **não** o enforcement. Quem impede uma
> escrita de beta gravar `realm='prod'` é o registro allowlisted
> `token -> source_app + realms + operações` do `spec.md` §"Trust boundary e
> credenciais" — `realm` precisa ser **derivado da credencial de serviço**, nunca
> aceito do payload.
>
> **O que existe hoje não serve para isso, e é aqui que se erra.** O `accounts.`
> já tem `X-Service-Token` (`src/serviceToken.ts`, usado em `/internal/users/:id`
> e nas rotas de segredo), mas é um **segredo único e global**: `isValidServiceToken`
> compara o header contra **um** `SERVICE_SECRET` de ambiente. Não há registro de
> tokens, não há vínculo `token -> source_app`, não há vínculo `token -> realms`.
> Um token válido é indistinguível de qualquer outro — o `accounts.` não sabe se
> quem chamou é `downloads` ou `mesas`, nem se é beta ou prod. Reaproveitar esse
> mecanismo para a escrita de comentários **não** implementa a trust boundary da
> spec: dá 401 para quem não tem o segredo e passe livre para quem tem, inclusive
> para afirmar qualquer `realm` e qualquer `source_app`.
>
> Consequência operacional, e é o ponto: **nenhuma rota de escrita produtiva sobe
> antes do registro por credencial existir** — o `SERVICE_SECRET` global não é
> substituto provisório aceitável. No instante em que existir escrita sem
> enforcement por token, `realm` vira campo decorativo e beta contamina produção no
> mesmo banco: o `accounts.` é PROD-only (D042, `env_override: "prod"`), beta reusa
> a instância de produção, e os dois realms convivem em `artificio_auth`. Corrigir
> depois exige migration de dados; respeitar a ordem custa zero.
>
> Isto **não** contradiz T0.6/requisito 5a — é o complemento operacional deles. A
> decisão de pôr `realm` na chave desde a primeira migration (mantenedor, 2026-07-27)
> existe justamente porque o banco é compartilhado; esta nota só registra que o
> schema é metade do mecanismo, e a outra metade ainda não foi construída.

> **Medição do `SERVICE_SECRET` no ambiente real — 2026-08-04, leitura, sem escrita.**
> A trava acima foi escrita a partir de leitura de código; esta nota registra a
> **medição** que a confirmou e mostrou que o problema é maior do que a leitura
> sugeria. Método: SHA-256 do valor de cada `.env` na VM, comparando só o digest —
> o segredo em si nunca foi impresso.
>
> | Arquivo | digest (12 primeiros) |
> |---|---|
> | `/opt/artificio/apps/accounts/.env` | `d88e6d303ed1` |
> | `/opt/artificio/apps/downloads/.env` | `d88e6d303ed1` |
> | `/opt/artificio/apps/mesas/.env` | `d88e6d303ed1` |
> | `/opt/artificio-beta/apps/accounts/.env.beta` | `d88e6d303ed1` |
> | `/opt/artificio-beta/apps/downloads/.env.beta` | `d88e6d303ed1` |
> | `/opt/artificio-beta/apps/mesas/.env.beta` | `d88e6d303ed1` |
>
> **É literalmente o mesmo valor em seis serviços e nos dois realms.** Três
> consequências que a leitura isolada do `accounts.` não revelava:
>
> 1. **O mesmo segredo abre `GET /admin/secrets/:name`** (`adminSecretsRoutes.ts:50`),
>    que devolve **segredo decifrado** (chave da DeepSeek, entre outros). Não existe
>    escopo por operação: quem pode resolver e-mail de usuário pode ler a chave de
>    API de todo mundo. `downloads` e `mesas` têm hoje essa credencial.
> 2. **Vazar o segredo de um app compromete todos, nos dois realms.** Comprometer o
>    container de menor blast radius entregaria escrita comunitária de qualquer
>    `source_app` em qualquer `realm`.
> 3. **Rotação é atômica-ou-quebra:** trocar exige atualizar seis lugares ao mesmo
>    tempo. Segredo que na prática não pode ser rotacionado é segredo que, uma vez
>    suspeito, permanece em uso.
>
> **Limite honesto do achado:** as duas rotas que usam o segredo hoje
> (`/internal/users/:id` e `/admin/secrets/:name`) são de **leitura**, chamadas por
> backend em rede interna. Não há indício de exploração. O que muda com o Bloco B é
> que a escrita comunitária transformaria a lacuna em **corrupção silenciosa de dado
> persistido** — linhas de beta gravadas como `realm='prod'` no mesmo
> `artificio_auth` —, e aí não existe rollback barato: a migration corretiva teria de
> **adivinhar** qual linha era de beta, informação que não foi gravada em lugar nenhum.
>
> Por que segredo único não serve, em uma frase: `isValidServiceToken` responde
> *"esse token é igual ao segredo?"*, uma pergunta booleana, enquanto a escrita
> comunitária precisa responder *quem chamou*, *em qual realm pode escrever* e *que
> operações pode fazer* — com um valor único as três respostas são a mesma, logo
> nenhuma delas é resposta. Correção detalhada em T2.2a.

> **Como esta nota nasceu — erro de processo do agente, 2026-08-04.** A trava acima
> só existe porque o agente errou antes de acertar, e o erro se repete fácil.
>
> Ao conferir o Bloco A, o agente levantou o banco compartilhado (`realm` beta e prod
> em `artificio_auth`) como **decisão pendente do mantenedor**, dizendo que "depois do
> primeiro deploy, separar exige migration de dados". Estava errado nos dois pontos:
> a decisão já existia, era do mantenedor, datada de 2026-07-27, e estava escrita em
> **três** lugares independentes (`tasks.md` T0.6, `plan.md` §"Referência opaca",
> `spec.md` requisito 5a); e a migration de dados era exatamente o que aquela decisão
> evitou, ao exigir `realm` na chave **desde a primeira migration**. O agente
> apresentou como risco não percebido algo que a spec já tratava como premissa — e
> gastou um turno do mantenedor para descobrir isso.
>
> **Causa:** conferir o artefato (a migration) sem ler a decisão que o originou. O
> schema foi lido linha a linha; `tasks.md` T0.6, que manda `realm` entrar na chave e
> explica por quê, não foi aberto antes de o alarme ser dado.
>
> **Regra que fica, para quem conferir qualquer bloco desta spec:** antes de declarar
> risco aberto, lacuna ou decisão pendente, procurar a decisão na própria spec
> (`grep` do termo em `spec.md`/`plan.md`/`tasks.md`). Se estiver decidida, o trabalho
> é **verificar se o código cumpre a decisão** — não reabrir o debate. Foi essa
> verificação, feita só depois, que produziu o achado que de fato valia: o
> `SERVICE_SECRET` global não implementa a trust boundary por `realm`. O achado real
> estava a um `grep` de distância do alarme falso.
>
> `AGENTS.md` §Erros conhecidos já manda não confiar em documentação sem verificar o
> código. Este caso é o inverso e o complemento: **não alarmar sem ler a documentação**.
> Código é a verdade material sobre o que *está* construído; a spec é a verdade sobre
> o que *foi decidido*. Confundir os dois papéis gera alarme falso numa direção e
> falso-verde na outra.

> **Nota de sequenciamento — T2.1 a T2.1f são uma migration só, não seis.**
> `AGENTS.md` §Migrations item 2.1 proíbe fatiar em vários arquivos o schema de uma
> mesma spec no mesmo diff quando as tabelas nascem juntas e dependem umas das
> outras — e aqui dependem: denúncia referencia versão, versão referencia
> comentário, score referencia comentário. Fatiar também multiplicaria o problema
> do guard `MAX_AUTO_PENDING=5` descrito no topo da fase: cinco arquivos contam
> como cinco migrations pendentes. As tasks estão separadas por **assunto de
> revisão**, não por arquivo de migration.

### Bloco B — Escrita, autorização e integridade

- [x] T2.2a-op — **Emitir as credenciais reais e aposentar o `SERVICE_SECRET` global** (operacional de T2.2a; `spec.md` §"Trust boundary e credenciais"). **Débito registrado em 2026-08-04 por decisão do mantenedor, para iniciar em seguida.** T2.2a entrega o mecanismo; esta task o coloca em uso — sem ela o registro existe e ninguém o usa, e o segredo único medido (mesmo digest em vários serviços e nos dois realms; ver a ressalva de contagem no levantamento de 2026-08-07 ao fim deste bloco) continua sendo a credencial de fato. **CONCLUÍDA em 2026-08-07.** Passos 1–4 em 2026-08-05 (emissão e distribuição), passo 5 em 2026-08-07 (corte confirmado), passo 6 no mesmo dia (remoção do fallback, PR #244, `2e53ffc`), deployado nos dois realms e verificado container a container. Os quatro critérios de aceite atendidos — evidência no bloco de encerramento ao fim desta task. **Não é bloqueio de deploy:** o fallback `SERVICE_SECRET` mantém `downloads` e `mesas` funcionando, então a migration 007 pode subir antes desta task; o que não pode é a task ser esquecida, porque o fallback é justamente o que se quer remover.

  Escopo, na ordem em que precisa acontecer:
  1. **Aplicar a migration 007** (deploy normal; prod tem 001–005 hoje, então 006 e 007 somam 2 pendentes, sob o `MAX_AUTO_PENDING=5`).
  2. **Emitir uma credencial por app por realm** com `node dist/scripts/serviceCredentialAdmin.js issue`: `downloads` (`users.read`, `secrets.read`) e `mesas` (`secrets.read`), em `prod` e em `beta` — quatro credenciais, quatro segredos distintos. O segredo é impresso **uma única vez** e não é recuperável.
  3. **Popular `SERVICE_CREDENTIAL`** no `.env` de cada serviço na VM e nos secrets do Actions. **Escrita em produção: exige aprovação nominal própria** (`AGENTS.md` §Autorização).
  4. **Confirmar o corte** pelo log `[serviceCredential] SERVICE_SECRET legado usado em ...`: enquanto ele aparecer, há consumidor no mecanismo antigo. `list` mostra `último uso` por credencial e é a prova positiva do outro lado.
  5. **Só então remover o fallback**: tirar `allowLegacySecret` das duas rotas (`app.ts`, `adminSecretsRoutes.ts`), remover `SERVICE_SECRET` dos compose e dos `.env.example`, e tornar `SERVICE_CREDENTIAL` obrigatório (`:?`) no lugar do atual `:-`.

  **Ordem importa e inverter causa indisponibilidade:** remover o fallback antes do passo 4 derruba a moderação do `downloads` (resolução de e-mail do autor) e o enrichment do `mesas` (chave da DeepSeek). A rotação futura segue a janela `current` + `next` documentada no cabeçalho de `serviceCredentialAdmin.ts`.

  · feito quando: as quatro credenciais existem e estão em uso; o log de uso legado não aparece por um ciclo completo de deploy; `SERVICE_SECRET` não existe mais em nenhum compose, `.env.example` ou código; e `SERVICE_CREDENTIAL` é obrigatório nos serviços que o consomem.

  **Credenciais emitidas em 2026-08-05, fallback removido 2026-08-07.** PR #244 (`2e53ffc`). `docker compose config` mostra `SERVICE_CREDENTIAL` nos 4 consumidores reais, zero `SERVICE_SECRET`. `list` confirmou zero uso legado por 2h.

  **Ressalva:** medição original contava 12 containers com o mesmo segredo; verificação real achou 4.

  Estado medido: `schema_migrations` em prod tem `001`–`005`; `006`/`007`
  pendentes. `SERVICE_CREDENTIAL` **ausente** nos `.env` de prod; `SERVICE_SECRET` presente.
  **Execução (2026-08-05 a 2026-08-07):** migration 007 aplicada. 4 credenciais emitidas
  (`downloads` + `mesas` × `prod` + `beta`). PR #244 (`2e53ffc`) removeu fallback; deployado
  nos dois realms. `docker compose config` mostra zero `SERVICE_SECRET`. · feito quando:
  credenciais em uso, uso legado zero, `SERVICE_SECRET` removido, `SERVICE_CREDENTIAL` obrigatório.

- [x] T2.2a — **Registro de credencial de serviço por `source_app` e `realm`** (requisito 5a; decisão T0.6; `spec.md` §"Trust boundary e credenciais"). **Task nova, criada em 2026-08-04 a partir de medição no ambiente real** (evidência no bloco abaixo). Pré-requisito duro de T2.6c e de qualquer rota de escrita comunitária: enquanto a credencial for um valor único global, `realm` e `source_app` só podem vir do payload, o que a trust boundary proíbe expressamente. Exigir: tabela `community_service_credential` com `token_id` público indexado, `token_hash` (Argon2id — **não** SHA-256; ver nota de dependência), `source_app`, `realms TEXT[]`, `scopes TEXT[]`, `revoked_at`, `last_used_at`; header no formato `<token_id>.<segredo>`, onde o `token_id` em claro permite `SELECT` por índice sem rodar KDF contra toda a tabela; função de resolução que devolve **identidade (`{sourceApp, realms, scopes}`) ou `null`**, nunca `boolean` — é a mudança de tipo de retorno que carrega a correção; handler **deriva** `realm`/`source_app` da credencial e rejeita com `400` o payload que tentar declarar qualquer um dos dois; comparação do `token_id` em tempo constante, senão o lookup vaza quais IDs existem; **uma credencial por app por realm** (`downloads-beta` e `downloads-prod` são linhas distintas com segredos distintos), porque é isso que dá revogação granular e rotação sem coordenação global; `realms` é array pelo caso excepcional documentado, mas toda credencial emitida nasce com **um** realm, tornando gravar `realm='prod'` a partir de beta impossível por construção e não por validação lembrada; script de emissão/revogação de credencial; migração dos três consumidores atuais (`apps/downloads/backend/src/services/accountsClient.ts:30`, `apps/downloads/backend/src/services/secretsClient.ts:35`, `apps/mesas/backend/src/services/adminSecrets.ts:46`); `SERVICE_SECRET` permanece aceito como fallback nas duas rotas existentes durante a transição, com registro de uso (**nunca o valor**), e só é removido depois de provado que ninguém o usa. · feito quando: credencial de beta não consegue gravar `realm='prod'` por nenhum caminho; payload que declara `realm`/`source_app` é rejeitado; escopo separa leitura de usuário de leitura de segredo; revogar uma credencial não afeta as outras; e busca negativa prova que nenhum log/erro ecoa o segredo.

  **Escopo confirmado pelo mantenedor em 2026-08-04:** a correção **não** se limita ao
  escopo comunitário. `GET /internal/users/:id` e `GET /admin/secrets/:name` migram
  para o mesmo registro, porque o débito de segurança descrito abaixo já está em
  produção hoje e restringir a correção ao Bloco B o deixaria vivo.

  **Implementado em 2026-08-04, validado em PostgreSQL real.** Artefatos:
  `apps/accounts/database/migration_007_service_credentials.sql`;
  `src/serviceCredential.ts` (resolução), `src/requireServiceCredential.ts` (guard),
  `src/scripts/serviceCredentialAdmin.ts` (emissão/listagem/revogação);
  consumidores `apps/downloads/backend/src/services/{accountsClient,secretsClient}.ts`
  e `apps/mesas/backend/src/services/adminSecrets.ts` passam a preferir
  `SERVICE_CREDENTIAL` com fallback em `SERVICE_SECRET`. Evidência executável em
  `phase-2-credentials-measurement.sql` (nesta pasta), 15 invariantes verdes.

  **Dois defeitos que só o banco encontrou** — ambos passariam por build, lint e
  leitura estática:

  1. **`CHECK` não aceita subquery.** `cardinality(ARRAY(SELECT DISTINCT unnest(...)))`
     — a forma óbvia de exigir array sem duplicata — falha com `cannot use subquery
     in check constraint`, e o erro só aparece ao **aplicar** a migration. Corrigido
     com a função `community_text_array_has_no_duplicate`, `IMMUTABLE`, que encapsula
     a subquery num escopo onde ela é permitida.
  2. **O índice único bloqueava a rotação que a própria spec exige.**
     `spec.md` §"Trust boundary e credenciais" define a janela curta `current` +
     `next`: publica `next`, troca o consumidor, confirma tráfego, revoga `current`.
     Um índice sobre `(source_app, realms[1])` ativo torna essa sequência impossível
     e força downtime a cada rotação — que é exatamente como um segredo acaba nunca
     sendo rotacionado, o problema que a task existe para resolver. Corrigido com a
     coluna `rotation_slot` (`current|next`) na chave do índice parcial.

  **Decisões que o revisor precisa conferir:**

  - **Argon2id via `@node-rs/argon2`** (dependência nova, autorizada pelo mantenedor
    em 2026-08-04). Resolve por optionalDependency de plataforma, não por
    postinstall, então convive com o `--ignore-scripts` do Dockerfile. O guard
    `hashSync('probe')` no Dockerfile existe porque `test -d` provaria só que a
    pasta existe: o modo de falha real é o binário da plataforma faltar, que
    apareceria só na primeira autenticação em produção, com CI verde (E016/E017).
  - **`SERVICE_SECRET` continua aceito** nas duas rotas legadas, sob
    `allowLegacySecret` opt-in por rota, e **nunca** produz identidade
    (`req.serviceCredential` fica indefinido). Rota comunitária nova jamais liga a
    opção. Sai quando o log `[serviceCredential] SERVICE_SECRET legado usado em ...`
    parar de aparecer.
  - **`SERVICE_CREDENTIAL` entra opcional (`:-`) nos compose**, não obrigatório:
    obrigatório derrubaria o deploy antes de a credencial ser emitida.
  - **403 `insufficient_scope` não cai no fallback de admin** em
    `/admin/secrets/:name`. Credencial válida sem escopo é erro de configuração e
    precisa aparecer como tal, não virar "tente com cookie".

- [x] T2.2 — **Contrato `CommentSubjectAuthorization` e suíte de conformidade** (requisito 6; decisão 2). Reformulado: a versão anterior dizia apenas "o backend do módulo valida antes de chamar", sem contrato nomeado. O `accounts.` não conhece material nem mesa e **não deve fingir que conhece**; ele define um contrato único — alvo existente, visível, comentável, `ownerUserId` confiável e `canonicalPath` — mais uma **suíte de conformidade reutilizável** que cada backend consumidor roda contra a própria implementação. O guard específico é implementado por cada app na sua fase de adoção, antes de chamar o `accounts.`. Referência opaca **não** substitui autorização por objeto — sem isso o atacante comenta em assunto inexistente ou invisível (OWASP IDOR). · feito quando: o contrato e a suíte existem no compartilhado; comentário em assunto inexistente, invisível ou fechado é recusado; e escrita direta do navegador não é aceita.

> **T2.2 — fechada em 2026-08-05. Entregável: `packages/comments` (pacote novo).**
>
> `src/subjectAuthorization.ts` (contrato + schemas Zod) · `src/subjectAuthorizationConformance.ts`
> (suíte reutilizável) · `src/index.ts` · dois arquivos de teste · `package.json`,
> `tsconfig{,.build,.cjs}.json`, `eslint.config.js`.
>
> **Validação:** `tsc -p tsconfig.json --noEmit` limpo · `eslint .` limpo · **33/33** testes
> (22 do contrato, 11 da suíte) · build oficial (`rtk pnpm --filter @artificio/comments run build`)
> `exit 0` do zero, com `dist` e `dist-cjs` completos e **carregados em Node** —
> `require('./dist-cjs')` e `import('./dist/index.js')` devolvem 10 exports cada · `dist` sem
> nenhum `*.test.js` · `rtk pnpm run lint` **25/25** · `rtk pnpm verify:api` verde, `breaking=0`
> nos seis apps.
>
> **Decisões de desenho, com o porquê:**
>
> 1. **O export `.` é livre de React.** Quem consome primeiro é o **backend** de cada módulo, que
>    precisa do guard antes de chamar o `accounts.` (requisito 21b — backend e o Astro
>    server-side do `site` não podem ser obrigados a importar React). `@artificio/comments/react`
>    e `/styles.css` entram na Fase 4. Estrutura copiada de `packages/catalog-client`, que é o
>    pacote do repo com o mesmo perfil (dual ESM/CJS, Zod, sem React).
> 2. **`realm` e `source_app` não existem no contrato.** São derivados da credencial de serviço no
>    `accounts.` (T2.2a). Aceitá-los aqui reabriria o furo que a migration 007 fechou — credencial
>    de beta escrevendo em produção.
>
>    **Precisão medida:** o schema **descarta** os campos (`strip` default do Zod), mas o parse
>    devolve `success: true` — não é erro. Verificado: `subjectRefSchema.safeParse({...,realm:'prod'})`
>    sai `success: true` com `data` sem `realm`, e `normalizeGuardResult` com `realm` injetado na
>    autorização devolve o objeto limpo. A proteção real, portanto, **é o handler usar o objeto
>    parseado e nunca o cru** — quem ler o corpo original continua vendo o campo injetado. Isso é
>    obrigação do handler de T2.6c, não do schema, e está anotado aqui porque a formulação anterior
>    ("não aceita") sugeria uma rejeição que não existe.
> 3. **`normalizeGuardResult` existe porque o tipo não basta.** Um guard escrito noutro app é
>    `unknown` até passar por schema (regra pétrea de normalização): um guard com bug devolvendo
>    `{ authorized: true, authorization: { exists: false } }` viraria escrita autorizada em assunto
>    inexistente. Aqui vira recusa.
> 4. **A suíte é agnóstica de runner.** Devolve `ConformanceReport`, não chama `expect` — assim o
>    pacote não arrasta `vitest` para a dependência de produção de nenhum consumidor. Cada app roda
>    contra a própria implementação, com as próprias fixtures, na sua fase de adoção.
> 5. **Seis checagens, e a sexta é a que pega o defeito real:** a suíte pede um alvo
>    `visibleOnlyToActor` — visível ao próprio ator, invisível a terceiro — e **compara as duas
>    respostas**. Só a divergência prova que o guard consulta `actingUserId`; um guard que ignora o
>    parâmetro devolve o mesmo nas duas chamadas e é reprovado. Quando o app não fornece essa
>    fixture, o relatório traz `actorSensitivityCovered: false`, para que `passed: true` não seja
>    lido como "guard correto". Há teste do teste para guard permissivo, que recusa tudo, que ignora
>    o ator, que recusa o alvo ao próprio dono, que inventa dono e que confunde invisível com
>    inexistente.
> 6. **`ownerUserId` nulo é caso legítimo, não erro.** Post do blog do `site` não tem
>    `author_user_id` e mesa órfã do `mesas` também não (requisitos 15a, 15b). A suíte tem checagem
>    dedicada reprovando guard que **inventa** dono nesse caso — dono fictício viraria destinatário
>    de notificação fabricado.
> 7. **`canonicalPath` recusa mais do que a spec lista.** Além de scheme, host, barra invertida e
>    credencial (`spec.md` §Referência opaca), recusa **protocol-relative** (`//host/rota` passa em
>    "começa com `/`" e mesmo assim sai do domínio) e **caractere de controle** (`\n`/`\r` num
>    caminho que entra em header de redirect permite response splitting). Nenhum dos dois estava
>    escrito; ambos são o mesmo tipo de furo que o requisito 5b existe para fechar.
>
> **Achado de lint tratado sem silenciar a regra:** a checagem de caractere de controle nasceu como
> regex `[\x00-\x1f]` e o `no-control-regex` acusou. Um `eslint-disable` seria mascarar erro
> (proibido por `AGENTS.md`), e a defesa é legítima. Trocada por varredura de code point
> (`charCodeAt`), que não usa regex — não há o que silenciar, e o comportamento é o mesmo.
>
> **Dependências:** nenhuma nova entra no monorepo. `zod ^4.4.3` já é a versão usada por
> `accounts`, `config` e `catalog-client`; `vitest`, `typescript`, `typescript-eslint` e
> `@eslint/js` são devDependencies da raiz, herdadas. `pnpm-lock.yaml` mudou só pelo pacote novo.
>
> **`TS5108` — causa raiz medida, e a primeira explicação estava errada.** O build acusou
> `TS5108: Option 'moduleResolution=node10' has been removed`. Registrei primeiro como "falso
> alarme do proxy `rtk` numa cadeia `&&`". **Errado, e a medição que sustentava isso estava
> viciada:** eu lia `echo "exit=$?"` depois de um pipe, capturando o status do `tail`, não do
> `tsc`.
>
> Causa real: existe um **`tsc` global versão 7.0.2** em `C:\Users\paulo\AppData\Roaming\npm\tsc`,
> fora do repo, e ele entra no `PATH` da shell antes do binário do workspace. O TS 7 **removeu**
> `moduleResolution: node10` de vez — `ignoreDeprecations: "6.0"` cobre a depreciação do 6, não a
> remoção do 7. O repo usa TS 6.0.3, onde a opção funciona. Medido lado a lado no mesmo
> `tsconfig.cjs.json`: binário 6.0.3 do repo → `exit 0`; binário 7.0.2 global → `exit 1`. A
> "alternância" que eu atribuí a ruído era só qual dos dois o `npx` resolvia a cada chamada.
>
> **Consequência prática:** `pnpm run build` (e o CI) usam o `tsc` do workspace e passam —
> `rtk pnpm --filter @artificio/comments run build` sai `0` com `dist`/`dist-cjs` completos, do
> zero. O erro só aparece invocando `tsc` à mão da shell. Os 8 pacotes com `node10` (`auth`,
> `content`, `content-editor`, `feedback`, `changelog`, `catalog-matching`, `catalog-client`,
> `comments`) se comportam igual — não é defeito deste pacote nem débito do repo.
>
> **Achado lateral — decisão do mantenedor em 2026-08-05: registrar como débito.** O `tsc` global
> 7.0.2 diverge do 6.0.3 do repo e reproduz esse falso negativo em qualquer diagnóstico manual.
> A investigação seguinte mostrou que o assunto é maior que o global: atualizar o repo para TS 7
> depende do ecossistema, porque o TS 7 deixou de expor a API do compilador por
> `require('typescript')`. Registrado em §Bloqueios conhecidos, primeiro item, com a superfície
> medida e os dois bloqueadores. **Nada alterado** — global segue 7.0.2, repo segue `~6.0.3`.
- [x] T2.2b — **Fechar o contrato HTTP v1 ampliado antes do primeiro handler** (decisões 12, 17, 32–50, 53). **Task nova pela reconciliação:** voto já tem rota e payload decididos; edição/auto-retirada, denúncia/retirada, caso/veredito, aprovação/reabertura, recurso, sanção e invalidação de voto ainda precisam ser materializados no mesmo namespace interno. Preservar `DELETE /api/account` e seu `204`, acrescentando o ciclo de T2.15 sem criar segunda rota de exclusão. Definir método/path, schema de request/response, estado/idempotência, papel/ownership, códigos 400/401/403/404/409/422/429 e campos públicos versus moderação, sem endpoints locais divergentes por app. Atualizar fonte OpenAPI/allowlist aplicável e rodar `rtk pnpm verify:api` quando código/API entrar. · feito quando: tabela/contrato completo não contém “a definir”; cada fluxo aponta para requisito/decisão e task; dois moderadores concorrentes têm 409 explícito; payload público não inclui identidade de denunciante/votante, fingerprint nem nota interna.

> **T2.2b — fechada em 2026-08-05. Entregável: `specs/090-packages-comments-compartilhado/contrato-http-v1.md`.**
>
> Contrato completo do namespace `/internal/v1/*` mais as rotas de sessão: leitura em árvore,
> criação/resposta, edição/auto-retirada, moderação de conteúdo, voto e invalidação, denúncia e
> retirada, caso/veredito/reabertura, recurso, sanção, `DELETE /api/account` e o contrato
> reservado de notificações. Para cada fluxo: método, path, escopo exigido, headers, corpo,
> invariantes transacionais, códigos e campos públicos versus moderação.
>
> **Os quatro critérios de aceite:** (a) nenhum "a definir"; (b) §15 mapeia cada fluxo a
> requisito/decisão e task; (c) `409`/`case_already_resolved` explícito para dois moderadores
> concorrentes, com a serialização por lock que corrige o check-before-transaction do
> `downloads` (decisão 36b); (d) §2 lista nominalmente o que nunca entra no payload público —
> identidade de votante/denunciante, detalhe de denúncia, nota interna, fingerprint,
> `user_id` cru e `community_actor_id`.
>
> **Três verificações contra o código real, não contra a spec:**
>
> 1. **`docs/api/openapi/accounts.openapi.yaml` é gerado, não editável.** O cabeçalho do arquivo
>    declara a origem, e `verify-api.ts:9` roda `api:generate-openapi` a partir do inventário de
>    rotas do código. Editá-lo agora seria sobrescrito no primeiro `verify:api`. Por isso o
>    entregável é documento de contrato, e `verify:api` fica para quando o handler entrar — que é
>    o que a própria task já dizia ("quando código/API entrar"). Nenhum comando de validação de
>    API rodou nesta task, porque nenhum se aplica a ela.
> 2. **Escopos e headers saem de T2.2a, não de invenção.** `SERVICE_SCOPES`
>    (`serviceCredential.ts:40-48`), `ServiceCredentialIdentity` (`:24-37`) e a semântica
>    `401` genérico versus `403` por escopo (`requireServiceCredential.ts:80,101-103`) foram lidos
>    do código. `realm`/`source_app` derivam da credencial e são **rejeitados** como campo de
>    payload.
> 3. **`DELETE /api/account` devolve `204` de fato** (`app.ts:395`), com
>    `confirmation_required` em `400` (`:358`). O contrato preserva os dois.
>
> **Correção de um erro meu durante a redação, registrada para não voltar:** escrevi primeiro que
> `input_too_large` seria checado **antes** do limite de 10.000 caracteres, "para um corpo gigante
> não custar parsing". Está errado: `MAX_SCAN_LENGTH` é **12.000** (`commentLinks.ts:275`), mais
> frouxo que o limite do comentário. Com a ordem correta (10.000 primeiro), aquela `rule` é
> **inalcançável** por esta rota. O contrato agora fixa a ordem e diz que, se ela aparecer em
> produção, é sinal de que a ordem foi invertida.
>
> **Uma divergência entre `spec.md` e as decisões, resolvida a favor da decisão:** `spec.md:398-401`
> lista `GET /api/v1/notifications`, `/unread-count`, `PUT /:id/read` e `/read-through` na tabela
> do contrato v1, mas a **decisão 1** mantém a API pública de notificações na Fase 3 — a Fase 2
> entrega só o núcleo transacional (evento/recibo na mesma transação do comentário). O contrato
> segue a decisão e deixa as quatro rotas em §12 como **contrato reservado**, com cursor,
> ownership por sessão e `404` uniforme já fixados, para a Fase 3 não divergir. Não é escopo novo;
> é a Fase 3 não podendo inventar formato diferente depois.

- [x] T2.3 — **Leitura em árvore com cursor versionado por revisão** (requisito 6; decisões 3, 8). No volume normal a leitura devolve a árvore inteira, sem limite de respostas irmãs; hard cap defensivo de **1.000 comentários ou 2 MiB**, o que ocorrer primeiro, e só então raízes/ramos restantes viram `more`, **nunca filho órfão**. A primeira leitura fixa `snapshot_revision`; o cursor é opaco e assinado, carregando assunto, sort, revisão, sort-key, ramo, limite e expiração de **30 minutos**. Expansões usam a mesma revisão, sem duplicar nem perder item — score e `my_vote` podem vir do estado atual, mas a **posição fica congelada**. Sem transação aberta entre requests, sem cache de paginação, sem cron. Supersede a versão anterior, que paginava lista plana por `(created_at, id)` (revogado pelo grilling). · feito quando: árvore de 1.500 comentários devolve `more` sem órfão; expansão na mesma revisão não duplica nem perde item; e cursor expirado falha explicitamente em vez de devolver posição errada.

  **Entregue, deployado e exercitado em produção.** `treeCursor.ts` (HMAC-SHA256, TTL com relógio
  injetável, assinatura verificada **antes** da expiração), `treeAssembly.ts` (corte por ramo de raiz
  — nunca por posição, é o que sustenta "nunca filho órfão"), `communityCommentRead.ts` (CTE
  recursiva; ordenação **entre irmãos**, nunca entre níveis; join de score pela faixa que **contém**
  a revisão congelada) e `communityCommentRoutes.ts` (`realm`/`source_app` da credencial; assunto sem
  comentário devolve árvore vazia com revisão 0, **não 404**). O porquê de cada decisão vive no
  comentário de cada arquivo.

  **Smoke real em 2026-08-08 — o bloqueio caiu.** `GET` com credencial devolveu `200` com a árvore
  de 3 comentários (2 raízes + 1 resposta `depth=1`), `state=fresh`, `snapshot_revision=0`; sem
  credencial, `401`. A CTE, o join de score e a montagem da árvore rodaram contra PostgreSQL real
  pela primeira vez. O que continua **não** exercitado por dado real: truncamento em `more` e
  expansão por cursor, que exigem árvore acima do cap de 1.000 — cobertos só por teste com fake.

  **`ACCOUNTS_COMMENT_CURSOR_KEY` — 8d-i fechada.** Chave dedicada, `min(32)`, **obrigatória** (`:?`
  no compose): cursor assinado com default é forjável, então falhar o deploy é o comportamento
  correto. **Um arquivo só** — `accounts` é PROD-only (D042): `deploy.yml:179-186` aborta com
  `env=beta`. **Se a chave sumir do `.env`, o `accounts` não sobe e o SSO de todos os projetos cai no
  boot** — pré-condição de boot, não configuração opcional.

  **Validação de `subject_type` unificada (2026-08-08).** A rota de leitura validava só o
  comprimento, então `?subject_type=post` — sem o ponto que `migration_006:118` exige — devolvia
  `200` com árvore vazia em vez de `400`: o consumidor não distinguia "assunto sem comentários" de
  "campo malformado". A escrita já exigia o ponto desde T2.6c; as duas tinham o regex escrito à mão e
  só uma foi corrigida. Agora ambas consomem `SUBJECT_TYPE_PATTERN`/`SUBJECT_TYPE_MESSAGE` de
  `@artificio/comments`, e a divergência deixa de ser possível por construção.

  **Cobertura honesta:** os testes de rota usam fake de Kysely, que devolve as linhas na ordem que
  mandamos. Provam tradução e contrato HTTP, **nunca a corretude do SQL** — quem prova isso é o smoke
  acima e os testes de T2.3b contra `accounts-db`.

  **Achados laterais da VM, ainda sem resposta do mantenedor** (read-only, 2026-08-07):
  `/opt/artificio-beta/apps/accounts/.env.beta` é vestígio morto desde 2026-06-27 e **contém
  segredo** — remoção é decisão do mantenedor; `SERVICE_SECRET` ainda está nos dois `.env`, mas
  `docker inspect accounts-api` confirma que **não** está no container em execução (resíduo em
  arquivo, não credencial viva).

  **Não reabrir:** o contrato HTTP não é escopo desta task (fechado em `contrato-http-v1.md` §2 por
  T2.2b — T2.3 implementa, não redecide), e **T2.3 não depende de T2.13**, apesar da numeração: a
  leitura fixa `snapshot_revision` e navega dentro dela, nunca incrementa; quem incrementa é o voto
  (`spec.md` 8d).

- [x] T2.3b — **As quatro ordenações do produto** (decisões 7, 19). `Melhores` (padrão de abertura) usa o **limite inferior de Wilson unilateral com `z = 1.281551565545`** (80% de confiança), sem decaimento temporal, sob `algorithm_version = 'reddit-wilson-80-v1'`; `Mais votados` ordena por score líquido; `Recentes` por `created_at DESC`; `Mais antigos` por `created_at ASC`. A ordenação acontece **entre irmãos, nunca misturando níveis** da árvore. `created_at` e `id` formam o desempate estável. Tombstone mantém a posição estrutural mas não expõe corpo nem score. `Controversos`, `Random`, `Q&A`, `Live` e `Hot` **não entram**. Fórmula e vetores de referência entram em teste, **testando diretamente a função PostgreSQL** de T2.1c, não uma reimplementação em TypeScript. Algoritmo futuro cria nova versão e nova série de score; nunca reinterpreta histórico silenciosamente. · feito quando: os quatro sorts testados; vetores de Wilson batem contra a função SQL; e nenhuma ordenação mistura níveis da árvore.

  **Vetores e ordenação cobertos; falta a prova sobre árvore real.**
  `apps/accounts/src/communityWilson.test.ts` (novo, 28 casos) executa a **função
  PostgreSQL**, não uma reimplementação: 11 vetores numéricos literais medidos em 2026-08-07,
  `z = 1.281551565545` discriminado contra `1.96` (o valor que se copia por engano — daria `0.2065`
  em vez de `0.3784`), monotonicidade, `IMMUTABLE` determinística, e os quatro sorts com as três
  linhas de fixture escolhidas para **discordarem entre si** (`best=b,a,c`, `top=c,a,b`, `new=c,b,a`,
  `old=a,b,c`) — um sort que caísse no critério errado devolveria ordem diferente. Também travados:
  desempate `(created_at, id)` sob score empatado, e o `coalesce` que impede comentário **sem faixa
  de score** de abrir a conversa (sem ele, `NULLS FIRST` do PostgreSQL põe o sem-voto acima do mais
  bem avaliado). Todas as asserções validadas contra `accounts-db`; suíte `accounts` 148/148, lint
  25/25, `verify:api` `breaking=0`.

  O arquivo **pula** sem `COMMUNITY_TEST_DATABASE_URL` (28 skipped) em vez de falhar: o monorepo não
  provisiona PostgreSQL no CI, e falhar deixaria `pnpm test` vermelho em toda máquina sem banco
  local. Pular declara a ausência; nunca finge cobertura.

  **Lacuna de processo, não da task — e T8.1 já a nomeia.** `plan.md` §Validação item 1 exige
  "função Wilson PostgreSQL" entre os testes do `accounts.`, e item 6 manda rodar
  `rtk pnpm run test`. Com o skip, item 6 roda **sem** cumprir item 1 — verde sem executar a função.
  T8.1 é ainda mais explícita: exige Wilson PostgreSQL "**dentro do script efetivamente
  executado**", com "cada família aparecendo na saída". Um teste que pula não aparece.
  Hoje as asserções foram conferidas à mão contra `accounts-db`; nada garante que continuem sendo.
  Fechar exige PostgreSQL no CI — escopo novo, **decisão do mantenedor**, e pré-requisito de T8.1,
  não só desta task.

  **Como conferir sem CI, e o que não funciona** (medido em 2026-08-07, para o próximo agente não
  repetir a busca): `accounts-db` **não expõe porta** (`docker port accounts-db` devolve vazio), e
  abrir túnel SSH local (`ssh -f -N -L`) é **bloqueado pelo classificador** do harness. Sobra
  executar SQL direto — read-only, sempre permitido:
  `ssh faren "docker exec accounts-db psql -U admin -d artificio_auth -tAc \"<query>\""`.
  Foi assim que cada asserção de `communityWilson.test.ts` foi validada. Não substitui rodar a suíte;
  serve para conferir que os valores esperados continuam sendo os reais.

  **"Nenhuma ordenação mistura níveis" fechado em 2026-08-09, sobre o SQL — e semear voto em
  produção nunca teria provado isso.** A afirmação anterior desta task ("exercitar de verdade exige
  semear voto, decisão do mantenedor") estava errada e devolvia ao mantenedor uma decisão que não
  era dele: a propriedade é da **consulta**, não do dado. Quem impede a mistura é
  `partition by c.parent_id` no `row_number()` — irmãos competem entre si e com mais ninguém — mais
  o `order by sort_path` final. Semear voto mudaria a ordem *dentro* de cada nível, que é justamente
  o que já estava coberto.

  `communityCommentReadSql.test.ts` (novo, 18 casos) compila a query real de `readCommentTree` com
  o compilador Postgres de produção — driver que grava o SQL em vez de conectar — e afirma sobre o
  texto: `partition by` e `order by sort_path` nos quatro sorts; `best_score` só em `best` e `score`
  só em `top`; `new`/`old` invertidos; desempate `(created_at, id)` em todos; `coalesce` impedindo
  o sem-voto de abrir a conversa; e as duas cláusulas que congelam a foto (`created_revision <=`,
  faixa de `valid_from/valid_to_revision`). Mesmo precedente de `communityCommentWriteSql.test.ts`:
  `values({})` compilava e só falhava no banco — aqui o risco é o simétrico, cláusula trocada que
  devolve linhas plausíveis na ordem errada.

  **Achado do próprio teste:** `new` desempata por `id desc`, não `asc` — meu regex assumia `asc` nos
  quatro. O código está certo e a assimetria é deliberada (no sort "mais recentes primeiro", `id asc`
  poria o mais antigo de dois empatados na frente); o teste é que estava errado, e agora documenta a
  razão.

  **O que continua aberto, e o dono é T8.1:** executar a **função Wilson** em PostgreSQL dentro da
  suíte. Remedido em 2026-08-09, porque a medição de 2026-08-07 podia ter envelhecido:
  `docker ps --filter ancestor=postgres:16-alpine --format '{{.Names}} {{.Ports}}'` devolve
  `5432/tcp` **sem mapeamento** nos nove containers, e o Docker local está desligado
  (`failed to connect to the docker API at npipe:...dockerDesktopLinuxEngine`). Sem porta e sem
  daemon local, `COMMUNITY_TEST_DATABASE_URL` não tem para onde apontar. Provisionar PostgreSQL no
  CI é escopo novo e pré-requisito de T8.1 — os 28 casos continuam pulando e declarando a ausência.

  **Não repetir os testes de `assembleTree` por sort.** Medição: `sort` entra em `AssemblyInput`
  (`treeAssembly.ts:61`) e **nunca é lido no corpo** — as linhas chegam já ordenadas do banco
  (`treeAssembly.ts:36`). Os 18 casos com `sort: 'best'` não são lacuna: rodar os mesmos com
  `top`/`new`/`old` exercitaria um parâmetro morto e compraria cobertura falsa. Os quatro sorts vivem
  em `siblingOrder` (`communityCommentRead.ts:164`), que é SQL.

  **Bug do Wilson negativo — corrigido em `migration_009_wilson_clamp.sql`.**
  `comment_wilson_reddit_80_v1(0, d)` devolvia ~`-1e-18` em vez de `0` para qualquer `d > 0`: com
  `p̂ = 0` o numerador é `z²/(2n) - z·√(z²/(4n²))`, que simplifica para zero, mas `SQRT` em `numeric`
  arredonda e a subtração de dois valores quase iguais perde os dígitos (cancelamento catastrófico).

  Não era cosmético: o resíduo **encolhe** conforme `n` cresce, então a ordem entre comentários sem
  upvote saía **invertida** — `(0,1)` = `-2.9e-18` ficava **abaixo** de `(0,1000)` = `-7.8e-21`, ou
  seja, um downvote ranqueava pior que mil no sort `best`, o padrão de abertura da conversa
  (`spec.md` 8c). Depois da 009 os dois devolvem `0` e empatam, e quem os separa passa a ser o
  desempate determinístico `(created_at, id)`.

  **Substitui a função em vez de criar `_v2`** porque `algorithm_version` versiona mudança de
  algoritmo (decisão 7), e isto é a mesma fórmula devolvendo o valor que sempre deveria ter
  devolvido. Seguro porque `community_comment_score_version` tem **zero linhas** (medido): não há
  `best_score` gravado para reinterpretar. `CREATE OR REPLACE` não recalcula coluna `STORED`
  existente — com dado gravado, a migration precisaria de backfill e a decisão seria outra.

  Verificado antes de escrever: `GREATEST(..., 0)` não altera nenhum caso válido — `(3,1)` continua
  `0.4325414503689864693780673158507718692420314295228099`. Header validado pelo `parse_header` real
  (`CLASS=online-safe`, `HEADER OK`); expressão nova executada em `accounts-db`, os quatro casos
  `(0,1)`, `(0,5)`, `(0,100)`, `(0,1000)` devolvem `0` exato.

  **Não é vazamento de contrato:** `best_score` não é campo público — `contrato-http-v1.md:103` lista
  `upvotes`, `downvotes`, `score` e não o inclui. O efeito era só de ordenação.

  **Por que a medição existente não pegou:** `phase-2-measurement.sql:115` exige `best_score = 0` mas
  só insere `(0, 0)` — o caso `(0, d > 0)` nunca foi exercitado. Ela nasceu para provar o valor
  inicial, não a faixa.
- [x] T2.4 — **Integridade de thread validada na transação** (requisito 8; decisões 3, 23). Reformulado em dois pontos que o grilling revogou: a profundidade máxima é **`depth<=4`**, não `depth<=2`; e **resposta a comentário legado é permitida**, não recusada — o registro importado continua imutável, sem voto e marcado como antigo/autoria não verificada, mas **pode ser pai** de comentário novo de conta autenticada (decisão 23: antigo descreve proveniência, não congela a conversa). O pai precisa existir, pertencer ao **mesmo `realm`, `source_app` e assunto**, aceitar respostas e produzir `depth<=4`. `root_id` é derivado na escrita, nunca aceito do cliente. Rejeitar na escrita, não corrigir depois. · feito quando: resposta cross-subject, cross-realm ou além de `depth=4` é recusada — inclusive sob concorrência — e resposta a legado é **aceita** com `depth` correto.

  **Entregue e exercitado contra PostgreSQL real.** `packages/comments/src/threadIntegrity.ts`
  (`placeComment`) decide se o pai aceita a resposta e deriva `(parent_id, root_id, depth)`; o
  handler de T2.6c o consome dentro da transação (`communityCommentWrite.ts:360`), depois de buscar o
  pai com `SELECT ... FOR SHARE` filtrando pelos quatro campos de escopo, e mapeia a rejeição para o
  contrato: `parent_not_found` → `404`, `depth_exceeded` e `parent_not_accepting_replies` → `422`
  (`contrato-http-v1.md` §3). Em `ok: true` com `depth = 0`, `root_id` volta **nulo** de propósito: a
  raiz é o próprio `id`, que só existe depois do `INSERT`, e `community_comment_root_shape_check`
  exige `root_id = id` — quem fecha isso é o handler, na mesma transação.

  **Smoke de 2026-08-08:** resposta real em produção devolveu `depth=1`, `parent_id` do pai e
  `root_id` herdado da raiz — o caminho feliz atravessou a transação inteira contra PostgreSQL. Os
  eixos de rejeição seguem cobertos por teste com fake (`communityCommentWriteRoutes.test.ts:217`),
  não por dado real: forçá-los em produção exigiria semear comentário inválido de propósito.

  Cobertos: os quatro eixos de escopo (`realm`, `source_app`, `subject_type`, `subject_id`) como
  `parent_not_found` — **nunca** um código distinto, porque "existe mas não é seu" confirma o
  identificador para quem sonda entre realms; `depth<=4` com o teto revogado de `depth<=2` travado
  por teste próprio; tombstone e `pending_review_hidden` recusando filho novo; **resposta a legado
  aceita** (decisão 23), sem marca própria na função, já que não há regra diferente a aplicar; e
  `root_id` herdado do **pai**, nunca `parent.id` — o erro fácil funciona no primeiro nível e cria
  raízes falsas a partir do segundo.

  Também travada a **ordem das checagens**: escopo antes de profundidade (senão `depth_exceeded`
  revela que o id existe em outro realm e que a árvore dele está cheia) e estado antes de
  profundidade (senão o usuário é mandado a responder mais acima, onde também falharia).

  **A função não escreve nada, de propósito.** `contrato-http-v1.md` §3 exige os invariantes "na
  mesma transação": validar antes de abri-la deixa janela para o pai ser removido entre a checagem e
  o `INSERT`. A busca do pai (`SELECT ... FOR SHARE`) é do handler; a decisão é da função. É o que
  permite testar as regras sem PostgreSQL.

  **`placeComment` é a PRIMEIRA barreira, não redundância.** Corrige o que este bloco afirmava antes:
  as FKs compostas `_parent_subject_fk`/`_root_subject_fk` são **DEFERRABLE INITIALLY DEFERRED**
  (medido em 2026-08-07, T2.6c), então **não disparam no `INSERT`** — só no `COMMIT`. Cross-subject
  não é impossível "por construção" no momento da escrita: sem a validação em TypeScript, a resposta
  atravessaria a transação inteira (comentário, versão, evento, recibos) e só estouraria no commit,
  como erro genérico, sem os `404`/`422` que o contrato exige. O `DEFERRED` existe para permitir o
  ciclo comentário↔versão, não para afrouxar a checagem.

  `community_comment_depth_check` (`depth BETWEEN 0 AND 4`) e `community_comment_root_shape_check`
  **são** imediatos e continuam sendo a segunda barreira real.

  **Bloqueio:** "inclusive sob concorrência" não está provado. Exige a transação real de T2.6c e
  PostgreSQL — mesmo bloqueio de T2.3/T2.3b. A task não fecha antes disso.
- [x] T2.5 — **Markdown pelo pipeline compartilhado existente; DOMPurify só no legado** (requisitos 10, 10c; decisões 24, 25, 30). **Validação de corpo entregue e em uso na rota de escrita desde T2.6c; falta só o legado do `site`.** A Fase 2 **não cria parser, sanitizador nem renderizador paralelo**: a escrita passa por `sanitizeUserMarkdown` de `@artificio/content-editor/sanitize` e persiste **Markdown canônico** — a API devolve Markdown, **não HTML montado** —, e consumidores renderizam só por `MarkdownContent`/`renderMarkdown`, cujo `markdown-it` roda com `html: false` e cuja saída passa por DOMPurify. Limite de **10.000 caracteres** validado na entrada original **e** no canônico (decisão 25); excesso rejeita a operação inteira, **nunca trunca nem persiste versão parcial**. Depois da canonicalização, `markdownToPlainText` precisa dar **conteúdo não vazio** (decisão 30) — espaços, HTML removido, separador isolado ou marcador sem texto são rejeitados; emoji, código, citação e link com rótulo são aceitos. As três regras valem para criação e edição. O legado do `site` tem `content_html`, sanitizado **uma vez na entrada** com política e versão registradas, e a saída ganha defesa adicional **sem regravar o banco** — nunca ressanitizar continuamente. Supersede a versão anterior, que mandava texto puro (revogado pela decisão 24). · feito quando: testes de XSS cobrindo script, links, SVG/MathML, atributos e o HTML legado; entrada de 10.001 caracteres rejeitada antes do parsing; comentário que sanitiza para vazio rejeitado; e `sanitizeUserMarkdown` provada idempotente sobre entrada hostil, inclusive entidade HTML e marcador interno do sanitizador (requisito 10c).

  **Merged na PR #246** (`c04453e` → `3468b2c`, `dev` em `7146c56`).

  `validateCommentBody` (`packages/comments/src/commentBody.ts`) implementa os invariantes 3–5 de
  `contrato-http-v1.md` §3 no **pacote compartilhado**, não no `accounts.`, porque `spec.md` 8 manda
  cliente e backend usarem a **mesma** política — duas implementações divergiriam, e o usuário veria
  o editor aceitar corpo que a API recusa. A ordem é a regra: o limite roda **antes** da varredura de
  links (§3 item 5), coberto por teste que falha se alguém trocar as etapas. Limite conta **pontos de
  código**, não `String.length`: `LENGTH()` do PostgreSQL conta 3 em `'🎲🎲🎲'` e o UTF-16 contaria 6,
  o que recusaria corpo que o banco aceita.

  O contrato afirma que essa ordem torna `input_too_large` inalcançável. **Medido: vale para ASCII e
  falha fora do BMP** — 10.000 emoji são 10.000 pontos de código (dentro do limite) e 20.000 unidades
  UTF-16 (acima do `MAX_SCAN_LENGTH` de 12.000, que mede custo de varredura). Sem checagem própria, o
  usuário receberia `INVALID_COMMENT_LINK` num corpo sem link nenhum.

  **Consumidor existe desde T2.6c:** `communityCommentWrite.ts:250` chama `validateCommentBody`
  dentro da transação, e o smoke de produção (2026-08-08) exercitou as duas pontas contra PostgreSQL
  real — corpo em branco recusado como `body_empty`, link `http://` como `INVALID_COMMENT_LINK`.

  **Legado do `site` fechado em 2026-08-09 — `sanitizeLegacyCommentHtml`.** Vive em
  `@artificio/content-editor/sanitize` (subpath já livre de React), com
  `LEGACY_COMMENT_SANITIZER_POLICY = 'site-comment-html'` e `_VERSION = 1` para gravar em
  `community_comment.legacy_sanitizer_policy`/`_version` (`migration_006:147-148`) — é o que permite
  **não ressanitizar continuamente**: a linha carrega sob qual regra foi limpa, e mudar a política
  vira versão 2 em vez de reprocessamento geral.

  **A política são os defaults da `sanitize-html` mais duas regras — decisão do mantenedor,
  2026-08-09, depois de medir o que a biblioteca já entrega.** A primeira versão recortava a
  allowlist para `p`/`br`/`a`, derivada do conteúdo real; o mantenedor perguntou se biblioteca
  pronta não resolvia, e a medição mostrou que **resolve quase tudo**: contra `sanitize-html@2.17.6`,
  os defaults (70 tags) neutralizam **10 de 10** vetores testados — `<script>`, `<svg><script>`,
  MathML, `onclick`, `<img onerror>`, `<iframe>`, `style=`, `<form>`, `javascript:`, `data:` — sem
  configuração nenhuma, e são idempotentes sobre entidade e `&` solto. Recortar reduziria superfície
  **teórica** (nada executável sobra no default) ao custo de sumir em silêncio com um `<strong>` que
  apareça no dump. Escolhida a robustez.

  **As duas regras que a lib não tem como presumir**, ambas medidas: (a) o default permite `target`
  em `<a>` e **não** permite `rel` — a pior combinação para UGC, porque a página de destino ganha
  `window.opener` (reverse tabnabbing); (b) `allowedSchemes` default traz `http`, `ftp` e `tel`, e
  10a é HTTPS-only. O `rel="nofollow ugc"` que o WordPress gravou também **seria descartado** pelo
  default, transformando 25 links legados em links seguidos por buscador — por isso ele é reescrito,
  nunca herdado: valor de origem não decide segurança de saída.

  **Ordem de execução do `sanitize-html`, medida porque quebrou a idempotência:** `transformTags`
  roda **antes** da filtragem de esquema. Confiando só em `allowedSchemes`,
  `<a href="javascript:...">` chegava ao transform com `href` presente, ganhava `rel`/`target`, e só
  depois perdia o `href` — a segunda passagem via âncora sem `href` e removia os atributos, violando
  10c. Por isso o esquema é checado dentro do transform, por `URL` (comparação estrutural, não
  prefixo textual: `https:evil` e `HtTpS://` erram em direções opostas). Pego pelo próprio teste de
  idempotência, não em revisão.

  **Função separada de `sanitizeUserMarkdown`, e não parâmetro dela:** são problemas opostos. O
  Markdown novo remove **todo** HTML (`allowedTags: []`), porque ali qualquer tag é ataque; o legado
  **é** HTML, e descartar tudo transformaria 25 comentários com parágrafo e link em texto corrido.

  **Conteúdo real, para referência de T2.8:** os dois bancos do `site` (`site-prod-db`/`site-beta-db`,
  banco `site`, 25 linhas cada, idênticos) usam exatamente `a`, `br`, `p`; atributos de `<a>` são
  `href` e `rel="nofollow ugc"`; contadores de vetor hostil todos **zero** (`href="http:`,
  `javascript:`, `<script`, `on*=`, `<img`, `style=`).

  Cobertura: 19 casos em `sanitize.test.ts` — estrutura preservada, formatação que o dump não tem
  hoje mas sobrevive, oito vetores hostis, quatro esquemas recusados sem deixar `rel`/`target` em
  casca sem `href`, reescrita de `rel`/`target`, idempotência em sete entradas com tripla
  sanitização, e entidade digitada que não vira markup (10c). `content-editor` 99/99 (era 80).

  **O que resta é de T2.8, não daqui:** chamar esta função na importação e gravar política/versão
  por linha. A função e a política existem e estão provadas; o `INSERT` do legado é a task da
  importação.

  ### Lacuna de idempotência HTTP — fechada por `migration_008`

  `contrato-http-v1.md` §6 e `spec.md` 396/419/512-514 exigem `Idempotency-Key` em toda escrita não
  idempotente **desde a Fase 2** (24h de retenção, `409`/`idempotency_key_reuse`). **Nenhuma migration
  criava onde guardar.** Onde escapou: a regra é **propriedade transversal de sete fluxos**, e a
  rastreabilidade da §15 organiza **por fluxo** — não teve linha, não teve dono, e nenhuma task de
  schema (T2.1–T2.1f) a incluiu. O aceite de T2.2b conferiu fluxos, não regras transversais. Mesmo
  padrão que criou T2.5b.

  `migration_008_idempotency_key.sql` fecha. **A unicidade de
  `(realm, source_app, operation, idempotency_key)` é o mecanismo**: o handler insere primeiro e
  desempata pelo `ON CONFLICT`, **nunca** consulta-antes-insere — o check-before-transaction do
  `downloads` que a §6 manda não replicar. Guarda `request_hash` (SHA-256), não o corpo. **Bloqueio:
  não aplicada contra PostgreSQL** — exigiria escrita em banco da VM. Header validado pelo
  `parse_header` real (`CLASS=online-safe`, `HEADER OK`), sem DDL destrutivo.

  ### Bug de escape em `sanitize.ts` — e as duas regressões que a correção introduziu

  `sanitize-html` escapava `<`/`>` que **sobreviviam como texto**: `> citação` virava `&gt; citação` e
  o `markdown-it` perdia o blockquote; idem `a > b` e `1 < 2`. Alcance medido: **~140 chamadas** em
  `downloads` e `mesas` — bio, descrição de material, comentário, nota de moderação, sinopse de mesa.

  **Duas tentativas de correção introduziram defeito pior que o original. Ambas foram achadas pelo
  review, não pelo agente**, e a raiz das duas é a mesma: uma premissa tratada como garantida sem
  teste do caso hostil.

  1. **Idempotência quebrada.** Desfazer o escape dentro de `textFilter` convertia **entidade
     digitada pelo usuário** em markup — `&lt;b&gt;ok&lt;/b&gt;` virava `<b>ok</b>` na primeira
     passagem e `ok` na segunda. `downloads/routes/comments.ts` persiste a saída (L47) e re-sanitiza
     na leitura (L65): o conteúdo armazenado mudaria a cada leitura, **sem erro nenhum**. Medido: `<`
     e `&lt;` chegam idênticos ao `textFilter` (`sanitize-html/index.js:615`) — indistinguíveis por
     construção, então a abordagem era irrecuperável, não mal ajustada.
  2. **Bypass por sentinela injetada.** A correção seguinte usa pré-passo que troca por marcador
     (área de uso privado do Unicode) o `<`/`>` fora de tag. O marcador foi escolhido porque "não é
     produzido por teclado" — verdadeiro e **irrelevante: colar não é digitar**. Corpo contendo o
     caractere passava intocado pelo sanitizador e a restauração o convertia em `<` real. Medido:
     saía `<script>alert(1)</script>` **literal**. Bypass completo.

  Estado final: pré-passo `protectLooseAngleBrackets` roda **antes** do escape, onde `<` e `&lt;`
  ainda são coisas diferentes, e protege apenas o `<`/`>` fora de tag — a varredura acompanha estado
  de tag, porque proteger todo `>` fazia o sanitizador perder o fechamento e engolir o texto seguinte.
  `stripSentinels` descarta no ponto de entrada qualquer marcador vindo de fora. Entidade preservada,
  tag removida, idempotência travada em 9 casos com tripla sanitização.

  **Erro do agente que permitiu o primeiro bug passar:** os testes de citação da versão inicial
  afirmavam apenas `ok: true` e passavam **com a marcação destruída**, porque texto escapado também é
  não-vazio. Reescritos para igualdade exata contra a entrada.

  **Lição registrada para quem tocar `sanitize.ts` depois:** toda mudança ali precisa provar
  idempotência (`f(f(x)) = f(x)`) e testar entrada hostil que imite o mecanismo interno — as duas
  regressões teriam sido pegas por qualquer um dos dois testes, e nenhum existia.

  **Validação:** repo 41/41 teste, 25/25 lint, 25/25 build, `verify:api` `breaking=0`;
  `content-editor` 80/80 (era 57), `comments` 97/97, `mesas` 707/707.

- [x] T2.5b — **Perfil de comentário e política de link no `@artificio/content-editor`** (decisões 26, 27, 28, 29). **Task nova, criada em 2026-08-04 a partir de leitura do código real.** As decisões 26–29 pressupõem um perfil de renderização de comentário que **hoje não existe no pacote**: `packages/content-editor/src/sanitize.ts:10` e `ContentEditor.tsx:6` configuram `MarkdownIt` com `html: false`, o que já barra HTML bruto, mas **não há desativação de `<img>` nem qualquer política de destino de link**. Sem esta task, as decisões 26–29 não têm onde ser implementadas — e a decisão 29 proíbe expressamente implementação local por app. Exigir, dentro do pacote compartilhado já existente: (a) **imagem só como referência HTTPS clicável** — `![alt](https://...)` vira link textual explícito (“alt — abrir imagem externa”), o browser **não busca o recurso até o clique**, sem upload, Cloudinary, hospedagem, proxy, preview ou busca server-side; (b) **links HTTPS-only** — URL sem esquema é canonicalizada para `https://`, `http:` ou qualquer outro esquema explícito é **rejeitado com mensagem específica, nunca promovido silenciosamente**; (c) **comparação de host estrutural por `URL`**, nunca `includes`/sufixo frouxo que aceite `artificiorpg.com.evil.example` — host exato `artificiorpg.com` ou subdomínio real abre na mesma aba, externo abre em nova aba; (d) **`rel="ugc nofollow"` em todo link de usuário**, mais `noopener noreferrer` no externo; (e) **link root-relative `/rota`** resolvido pelo consumidor contra a origem confiável derivada de `source_app`, **nunca contra host enviado no comentário**, rejeitando `//host`, `../`, relativo sem `/` inicial e qualquer forma ambígua; (f) **política de falha única e compartilhada** — sintaxe incompleta que o CommonMark trata como literal é aceita e exibida literalmente, mas quando o parser **reconhece** um link cujo destino viola (a)–(e), criação ou edição inteira é rejeitada com código estável **`INVALID_COMMENT_LINK`**, posição e mensagem da regra, **sem ecoar o payload hostil** e sem remover ou reescrever nada silenciosamente. `accounts.` e todos os frontends importam a **mesma** política; o cliente usa para erro imediato/prévia, o backend repete como **autoridade final**. Mudança em pacote compartilhado: exige aprovação e verificação de impacto nos consumidores (`AGENTS.md` §Autorização). · feito quando: `<img>` não é buscado pelo browser em nenhum caminho de render; `http://`, `//host` e `artificiorpg.com.evil.example` são rejeitados com `INVALID_COMMENT_LINK`; `[texto](` incompleto permanece literal; e os consumidores atuais do pacote seguem verdes.
  **Implementado em 2026-08-04, com aprovação nominal do mantenedor para alterar o
  pacote compartilhado.** Artefatos: `packages/content-editor/src/commentLinks.ts`
  (+ testes, 48 verdes), subpath `@artificio/content-editor/comment-links` com
  build ESM e CJS. Consumidores verificados: 38/38 pacotes verdes, incluindo
  `downloads-backend` 495/495 e `mesas-backend` 707/707.

  **Módulo próprio, não edição de `sanitize.ts`.** Dois motivos materiais:
  `sanitize.ts` é consumido por ~50 arquivos de `downloads`/`mesas` que não têm
  relação com comentário, e `index.ts` importa CSS — o `accounts.` precisa da
  política no servidor e não pode arrastar React para a árvore do backend.

  **Revisão e correções:** PR #242 passou por 3 rodadas de review (Codex, CodeRabbit,
  CodeQL, Sonar, TruffleHog). Achados principais: `??` desligava fallback legado (defeito
  do agente), autolink contornava política HTTPS-only, varredura quadrática com teto
  `MAX_SCAN_LENGTH=12.000`, `LINK_RE` otimizado (unrolled loop, 248ms→107ms no teto),
  timing de token_id corrigido (Argon2id descartável na ausência). Validado: `accounts`
  133/133, `content-editor` 57/57, suíte 38/38, lint 24/24, build 24/24. TruffleHog
  vermelho irremediável (histórico do commit `508d117`), Trivy é bug conhecido
  (`aquasecurity/trivy#3811`).

  **Débito transversal corrigido (2026-08-04):** 10 dos 13 pacotes emitiam `*.test.js` no
  `dist`; 27 artefatos de teste iam para imagens de produção. Gravidade: código morto, não
  crash (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Solução: `tsconfig.build.json` por pacote (10
  arquivos). Resultado: 0 artefatos de teste no `dist`; lint 24/24, build 24/24, testes 38/38.

- [x] T2.6 — **Badge de autor calculado a partir de fonte confiável** (requisito 11). O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada — nunca do payload público**, senão qualquer um se declara dono. Usuário comum sem rótulo; e-mail nunca exposto. Comentário legado exibe marca de **antigo/importado com autoria não verificada** (decisões 6, 23), misturado à árvore e à ordenação normais — sem seção própria e sem ocultação. · feito quando: tentativa de forjar dono no payload é ignorada; badge sai correto na resposta; e legado aparece na árvore normal com a marca de não verificado.
  **Entregue em 2026-08-09.** `AuthorBadge` = `admin | moderator | content_author | null`, calculado
  em `communityCommentRead.ts` (`authorBadge`) a partir de duas fontes que o payload público não
  alcança: `users.role` pelo `JOIN` já existente, e `community_comment_subject.owner_user_id`, que
  o domínio afirma por credencial de serviço (§8). O assunto entrou no mesmo `SELECT` — segunda
  consulta leria o dono fora da foto da árvore, e o join é por chave primária.

  **As palavras não foram inventadas, e a busca por elas custou três voltas do mantenedor.**
  `admin`/`moderator` são o enum de `users.role` (`migration_002:24`, `db.ts:25`,
  `adminRoleRoutes.ts:10`). `content_author` é o papel "autor/publicador" que `spec.md:311`
  classifica como **de domínio**, escrito no registro técnico que `AGENTS.md:85` reserva para
  identificador — o rótulo em português ("autor do post", "autor do material", "mestre da mesa")
  é escolha do frontend por `source_app`, em T4.10. Um valor no wire, vários textos na tela: por
  isso a palavra é neutra em vez de carregar `post`, que é nome de tipo do `site`
  (`site.post`) e mentiria num comentário de `downloads.material`.

  **Precedência `admin` > `moderator` > `content_author`**, de `spec.md:311`: papel de domínio
  **nunca é promovido a papel global**, então quando os dois coexistem aparece o global. Legado
  nunca recebe selo, checado antes de tudo (`spec.md:249`, 15b) — o fixture do teste força papel
  global **e** marca de dono ao mesmo tempo, então reordenar as checagens quebra.

  `user` vira `null`: requisito 11 manda não rotular usuário comum, e `"user"` no wire viraria
  rótulo vazio na tela.

- [x] T2.6b — **Sem `@menções` nesta fase** (decisão 31). Qualquer `@texto` permanece **texto
  Markdown comum** e nunca resolve conta nem cria destinatário. Motivo material: `accounts.users`
  **não possui handle público único** — nome Google é mutável e não único, e-mail não pode ser
  exposto. Notificação continua derivada apenas da estrutura confiável: autor do comentário pai e
  dono do assunto, excluindo o ator. Menção futura exige decisão própria de identidade pública;
  **não será simulada por heurística sobre nome**. · feito quando: `@qualquercoisa` renderiza como
  texto e não gera nenhum `notification_receipt`.

  **Entregue em 2026-08-09, e a garantia é estrutural, não uma regra a lembrar.** Seis casos em
  `commentBody.test.ts` provam que `@ana`, `@admin`, conta inexistente, e-mail, arroba solta e
  menção dentro de código atravessam a canonicalização **por igualdade exata** — `toContain('@')`
  passaria com o `@ana` já virado link. Um caso em `notificationRecipients.test.ts` trava a
  entrada: `RecipientCandidates` não tem campo de texto, então não existe caminho de `@texto` até
  um recibo, e o teste falha no dia em que alguém acrescentar um — que é exatamente quando a
  decisão 31 estaria sendo revogada sem decisão.

- [x] T2.6c — **Criar/responder junto do evento e dos recibos** (decisões 1 e 13). **Task nova pela reconciliação de 2026-08-04:** T2.1d criava só o schema e as tasks antigas deixavam a atomicidade ativa em T3.4, tarde demais. Na mesma transação do comentário: raiz gera recibo para publicador vinculado; resposta gera para autor do pai e publicador; destinatários iguais deduplicam; ator e conta removida/bloqueada são excluídos. Evento guarda snapshot estruturado e versionado, sem depender do domínio vivo. Falha em qualquer evento/recibo reverte o comentário. Voto e edição não passam por este fluxo. · feito quando: falha ao inserir recibo reverte criação/resposta; pai e publicador iguais produzem um recibo; e ator não recebe.

  **Núcleo transacional e rotas HTTP entregues.** `apps/accounts/src/communityCommentWrite.ts`
  (`createComment`) faz comentário, versão, evento e recibos em **uma** transação;
  `packages/comments/src/notificationRecipients.ts` (`resolveNotificationRecipients`) decide os
  destinatários; e `communityCommentRoutes.ts` expõe `POST /internal/v1/comments` e
  `POST /internal/v1/comments/:id/replies` sob escopo `comment.write`. `packages/comments` 132/132
  (era 117), `accounts` 181/181, repo 41/41, lint 25/25, build 25/25, `verify:api` `breaking=0`
  `non-breaking=2` (as duas rotas novas).

  **Duas rotas, um handler:** a única diferença é de onde vem o pai (`:id` contra `null`), e §3
  define os mesmos invariantes, corpo e erros para as duas. `realm`/`source_app` saem da credencial;
  o corpo é `strict`, então payload que os declara — ou que declara `root_id`/`depth` — vira `400` em
  vez de ser ignorado em silêncio (`spec.md` 6a). Ignorar deixaria uma credencial de beta tentando
  `realm: 'prod'` achar que foi aceita.

  **Trust boundary da escrita fechado em 2026-08-09 — dois furos que a entrega original deixou
  abertos, achados relendo §3/§8 contra o handler.** Nenhum teste podia pegar: os dois estavam no
  contrato e ausentes do código, e os testes descreviam o código.

  1. **`subject_authorization` não era aceito.** §3 lista o campo no corpo e §8 o define como a
     afirmação do domínio sobre o alvo; o `createBodySchema` era `strict()` **sem ele**, então o
     consumidor que seguisse o contrato levava `400`/`invalid_body` — e o `accounts.` escrevia
     contra referência opaca, que é o IDOR de `plan.md` §Referência opaca. Hoje o campo é
     obrigatório, convertido de `snake_case` num ponto só (§8) e revalidado por
     `subjectAuthorizationSchema` mesmo vindo por credencial de serviço; negativa do domínio vira
     `404` uniforme antes da transação, sem queimar chave de idempotência.
  2. **Nada criava a linha do assunto.** `createComment` fazia `SELECT`-ou-`404`, e medido por
     `rtk rg "community_comment_subject" apps packages -t ts`: 2 `selectFrom`, **0 `insertInto`**.
     Consequência: o **primeiro** comentário de qualquer assunto falhava com `404`. Não apareceu no
     smoke porque a linha de `beta/site/site.post/smoke-090` tinha sido inserida à mão — erro do
     agente, que escondeu o defeito por um dia. Hoje o assunto é criado sob demanda por
     `ON CONFLICT DO UPDATE` com `RETURNING`, reafirmando `canonical_path`/`owner_user_id` e nunca
     `ranking_revision`.

  `subject_not_found` saiu de `WriteRejectionCode`: a recusa do alvo passou para a rota, e manter o
  código no núcleo sugeriria que a transação ainda pode recusar assunto. `owner_user_id` de conta já
  excluída é reduzido a `null` — a exclusão no `accounts.` não propaga para a tabela do módulo, e
  inserir o id direto derrubaria a transação inteira por FK.

  Cobertura nova: 12 casos em `communityCommentWriteRoutes.test.ts` (campo ausente, as três
  negativas do domínio, quatro formas de `canonical_path` hostil, divergência entre corpo e
  autorização, campo desconhecido aninhado) e o `ON CONFLICT DO UPDATE` em
  `communityCommentWriteSql.test.ts`, pelo mesmo motivo que o `values({})` está lá: `DO NOTHING`
  compila, passa no `tsc` e devolve zero linhas no conflito — o caso comum.

  `:id` malformado devolve o mesmo `404` de pai inexistente: distinguir diria ao chamador qual
  formato de id o sistema usa.

  Testes de rota em `communityCommentWriteRoutes.test.ts` (33 casos) cobrem guard, escopo, os dois
  headers obrigatórios, a forma do corpo, **o caminho de sucesso** e a tradução de cada rejeição em
  status. `createComment` é mockado: o que a rota precisa provar é o mapeamento
  payload+credencial → input e o `201` de volta — inclusive que `realm`/`source_app` saem da
  credencial, e que o `:id` da URL vira `parentId`. A transação em si é provada contra PostgreSQL
  real, não por fake que provaria a si mesmo.

  **Sem `try/catch` engolindo erro, de propósito.** `spec.md` 13c manda a falha reverter o conjunto,
  e isso é a correção explícita do defeito do `downloads` (requisito 24d), onde a emissão é
  best-effort (`moderation.ts:138-147`, `reports.ts:195`) e o material é rejeitado sem o autor saber.

  **Idempotência insere primeiro** — nunca `SELECT` antes do `INSERT`, que é o
  check-before-transaction que `contrato-http-v1.md` §6 nomeia como defeito a não replicar. Registro
  vencido não conta como repetição: passadas as 24h a chave está livre, senão uma chave reusada meses
  depois devolveria comentário antigo em vez de criar o novo.

  Duas correções vindas do review da PR #247, ambas sobre a mesma transação:

  - **`ON CONFLICT DO NOTHING`, não `try/catch` na violação de unicidade.** No PostgreSQL um erro
    **aborta a transação inteira**: capturar a exceção e consultar em seguida rodaria o replay numa
    transação morta (`25P02`), transformando a repetição legítima — que deve devolver a resposta
    original — em `500`. `DO NOTHING` devolve zero linhas sem levantar erro, e a transação segue viva.
  - **Rejeição esperada é exceção (`CommentWriteRejection`), não retorno.** Retornar normalmente faz o
    Kysely **commitar**, e a linha de `community_idempotency_key` do passo 1 ficaria gravada para um
    pedido que falhou: a chave queimava por 24h, e o cliente que corrigisse o payload e reenviasse
    receberia `409` em vez de criar o comentário. O `catch` externo converte só esse tipo; qualquer
    outro erro é relançado, senão volta o best-effort do `downloads`.

  **`created_at` é string ISO no tipo, serializado na criação.** A criação recebe `Date` do driver; o
  replay recebe o campo de volta de `response_body` (`jsonb`), já string. Sem normalizar, o mesmo
  endpoint devolvia dois tipos de runtime conforme fosse primeira chamada ou repetição — e o
  `res.json()` escondia a divergência, porque serializa os dois igual.

  **Destinatários** (`spec.md` 15a-15c, 16), com teste por combinação: raiz notifica publicador;
  resposta notifica autor do pai **e** publicador; iguais deduplicam para um recibo; ator nunca se
  notifica em nenhum papel; `owner_user_id` nulo **não inventa destinatário** — post do blog não tem
  conta vinculada, e responder ali continua notificando quem escreveu o pai. Lista vazia é resultado
  normal, não falha.

  ### Medição contra PostgreSQL real — `phase-2-write-measurement.sql`

  Rodado em 2026-08-07 num banco descartável (`artificio_t26c_measure`, migrations 001–009, aprovado
  nominalmente, `DROP` feito ao fim; VM conferida de volta a `postgres` + `artificio_auth`). Seis
  invariantes verdes, terminando em `ROLLBACK` com 0 linhas em toda tabela.

  **Foi a medição que pegou três erros que nenhum teste em TypeScript pegaria:**

  1. **`notification_receipt.event_id` referencia `notification_event.id`, não `event_id`.** São
     colunas distintas: `id` é a chave da linha, `event_id` é a chave de idempotência do produtor
     externo (13c, evento vindo por outbox). O handler passava o valor errado e quebraria na primeira
     escrita real, como `foreign_key_violation` genérico.
  2. **`subject_type` exige um ponto** (`CHECK (subject_type ~~ '%.%')`): é `site.post`, não `post`.
     O contrato HTTP documenta o tamanho (≤64) e **não** o formato — débito documental registrado
     abaixo.
  3. **As FKs de árvore são `DEFERRED`**, então cross-subject não é barrado no `INSERT`. Corrigiu a
     afirmação errada que este `tasks.md` fazia em T2.4.

  Também provou, de passagem, que **as migrations 008 e 009 aplicam** — nenhuma das duas tinha rodado
  em PostgreSQL até aqui — e que o clamp da 009 funciona no banco: `(0,5)` devolve `0`, `(3,1)` fica
  intacto, `(0,1)` e `(0,1000)` empatam.

  **`subject_type` namespaced — quatro camadas divergiam, hoje há uma fonte só.** O ponto é exigido
  pelo `CHECK` da 006 desde sempre; contrato, schema do pacote e as duas rotas não o exigiam, cada um
  por um motivo diferente, e a primeira correção pegou só duas das quatro. Todos consomem
  `SUBJECT_TYPE_PATTERN`/`SUBJECT_TYPE_MESSAGE` de `@artificio/comments`; fixtures sem ponto viraram
  `downloads.material`. Detalhe e o custo da duplicação em T2.3.

  **Deployado em 2026-08-08** (run `31241754320`): as duas rotas estão publicadas — 20 arquivos
  `communityComment*` no `dist` do container, contra zero antes.

  **A leitura respondeu; a escrita quebrou no primeiro POST real.** Credencial
  `site-beta-46a7b787` emitida com `comment.write,comment.read`; `GET` devolveu
  `{"state":"fresh","snapshot_revision":0,"comments":[]}` para assunto vazio — contrato exato, e
  `401` sem credencial. O `POST` devolveu `{"error":"syntax error at or near \")\""}`.

  **Causa: `.values({})` no `INSERT` do ator comunitário.** `community_actor` só tem colunas com
  default, então o objeto vazio compila para `INSERT INTO community_actor () VALUES ()` — sintaxe que
  o PostgreSQL recusa. Corrigido com `.defaultValues()`.

  **Nenhuma das três camadas de teste podia pegar**, e o gap é estrutural — *query builder gera SQL
  que só falha no banco*:
  - `tsc` **não pega**: medido, o build falhou com `Unused '@ts-expect-error' directive` quando tentei
    marcar a linha. O tipo aceita `{}` sem reclamar, porque toda coluna tem default;
  - `communityCommentWriteRoutes.test.ts` **mocka** `createComment`;
  - `phase-2-write-measurement.sql` escreve o ator em SQL direto (`INSERT ... DEFAULT VALUES`), então
    exercita o banco, não o builder.

  Fechado por `communityCommentWriteSql.test.ts`: compila as queries com o dialeto Postgres real
  (`DummyDriver` não conecta, o compilador é o de produção) e afirma sobre o texto gerado — inclusive
  documentando que `values({})` produz `() values ()`. Não exige banco.

  **Auditoria das outras 7 escritas da transação** (`information_schema`): `community_comment` tem 8
  colunas obrigatórias sem default, `notification_event` 9, `community_idempotency_key` 8,
  `notification_receipt` 4, `community_comment_version` 3, `community_actor_account_link` 2. Nenhuma
  aceitaria `values({})` — nem compilaria. `community_actor` era o único caso.

  **Transação validada de ponta a ponta contra PostgreSQL real** (banco descartável, container
  efêmero na `artificio_net`; `accounts-api` não foi tocado): raiz com `root_id = id` e `depth=0`;
  resposta herdando `root_id` com `depth=1`; replay devolvendo **o mesmo id** com `replayed:true`;
  payload diferente na mesma chave → `409`; pai inexistente → `404`; `depth=5` → `depth_exceeded`;
  corpo em branco → `body_empty`; link `http://` → `INVALID_COMMENT_LINK`; contagens 2 comentários /
  2 eventos / **0 recibos** (correto: `owner_user_id` nulo e o ator é o próprio autor).

  E o que mais importava, porque era a correção do review da PR #247: **a chave de idempotência não
  vaza quando o pedido é rejeitado** — consulta após um `parent_not_found` devolve vazio, o
  `ROLLBACK` levou a linha junto.

  **Smoke completo em produção — 2026-08-08.** PR #249 merged, promote fast-forward (`583aa8c`),
  deploy run `31265541466` verde em 2m17s. Credencial temporária emitida em `slot=next` (a `current`
  intacta) e **revogada ao fim**. Sob `beta/site/site.post/smoke-090`, com o SSO servindo normalmente
  (`accounts-api` `healthy`, 4/4 rotas críticas):

  - `POST` raiz devolveu `201` — o `INSERT INTO community_actor` que quebrava agora passa;
  - `POST` idêntico repetido devolveu **o mesmo `id` e o mesmo `created_at`**, `201`: replay do
    recibo, e o banco ficou com 1 linha, não 2;
  - resposta aninhada devolveu `depth=1`, `parent_id` do pai e `root_id` herdado;
  - `GET` com credencial devolveu a árvore dos 3; sem credencial, `401`;
  - **3 comentários, 1 ator, 1 vínculo** — o ator é reusado entre escritas, e o
    `ON CONFLICT DO NOTHING` do vínculo funciona.

  **Encoding: não é bug do produto — era do agente, e foi corrigido.** O primeiro comentário gravou
  `U+FFFD` no lugar de `—`: o `curl` inline sob shell Windows converteu para a codepage local antes
  do envio. Reenviado por `--data-binary` de arquivo UTF-8, `ção — ü é 日本` gravou íntegro
  (`position('—')=14`, `position('日')=20`, zero `U+FFFD`). O corpo servido pela API foi corrigido em
  `community_comment` no mesmo dia; `community_comment_version` mantém o texto original porque é
  **append-only por trigger** — histórico preservado é a função da tabela, não divergência a
  consertar. Nenhum código faz `select` nela: a leitura sai de `community_comment.body_markdown`
  (`communityCommentRead.ts:295`, sem join).

  **Mapa de imutabilidade do schema, para o próximo agente não descobrir batendo no trigger:** só
  `community_comment_version` (`_guard_update` em UPDATE, `_reject_delete` em DELETE) e
  `notification_event` (`_immutable` em UPDATE+DELETE) são append-only. `community_comment`,
  `community_actor`, `community_actor_account_link`, `community_idempotency_key`,
  `community_comment_subject` e `notification_receipt` **não têm trigger algum** (medido em
  `pg_trigger`). Consequência prática: **não existe "apagar o comentário e refazer"** — a versão e o
  evento recusam `DELETE`, então a linha de comentário some e o histórico dela fica órfão.
  Correção de conteúdo passa por `community_comment` (o que a API lê) ou pelo expurgo formal
  (`redacted_at` + ator + motivo + corpo nulo), que existe para conteúdo abusivo, não para erro de
  operação.

  ### O primeiro deploy derrubou o SSO por 5 horas — causa e prevenção

  Run `31238673567` (2026-08-08, 04:11): `accounts-api` em restart loop, `502` em
  `accounts.artificiorpg.com`, **CI verde**. `Cannot find package 'sanitize-html' imported from
  /app/packages/content-editor/dist/sanitize.js`.

  **Causa:** T2.5 fez `packages/comments` importar `@artificio/content-editor`, e o `Dockerfile` do
  `accounts` filtra pacote a pacote no `pnpm install --prod --filter`. `content-editor` não estava na
  lista porque é dependência de **segundo nível** — o app não o importa direto.

  **O mecanismo não é o do E016/E017, e confundi-los custou horas.** Ali o `dist` não chegava na
  imagem. Aqui o `dist` estava lá: o que sumiu foi o **store**. Medido dentro da imagem quebrada,
  `packages/content-editor/node_modules/sanitize-html` **existia**, como symlink para
  `.pnpm/sanitize-html@2.17.6`, cujo alvo tinha sido podado. Contraste que confirma:
  `zod`/`kysely`/`express` (dos pacotes filtrados) sobreviveram.

  **O gate de CI não podia ter pego, por três motivos independentes** — e o pior deles não é o
  documentado: `check_dockerfile_workspace_deps.mjs` procurava `FROM ... AS production` **pelo
  nome**, e o Dockerfile do `accounts` chama os stages de `deps`/`build`/`runtime`. O app era pulado
  em silêncio; **nunca foi conferido, em nenhum PR**. Além disso o gate varria só imports diretos de
  `src/` (não via transitividade) e cobrava só `COPY`, nunca `--filter` — limite já registrado em
  `errors.md:236` e nunca fechado.

  **Corrigido nas PRs #248** (`97551b5`, `e313b93`): o gate casa o **último `FROM`** (posição, não
  nome), resolve fecho transitivo e cobra `--filter` mais os `test -d` das deps externas que o
  `dist`/`dist-cjs` de cada pacote resolve. Cobertura foi de 3 para **6 imagens**. Testado contra os
  defeitos reais, não só contra o verde: o incidente de hoje e o E017 reproduzido são **pegos**, e o
  estado correto passa.

  **A lição que fica**, e que o `deploy-runbook.md` passou a registrar: antes de deployar app com
  `Dockerfile` de produção, cruzar os `@artificio/*` **alcançáveis** (incluindo transitivos) contra a
  lista de `--filter`/`COPY`. Sem Docker local dá para provar na VM, rodando o `pnpm install --prod
  --filter` real numa imagem limpa — foi assim que o defeito e a correção foram medidos antes do
  segundo deploy.

### Bloco C — Ciclo de vida do comentário

- [x] T2.7 — **Retirada por tombstone, com auditoria** (requisito 12; decisões 17, 22). Não apagar a linha — apagar quebraria os filhos e perderia o contexto. A resposta pública devolve o estado removido e `removed_at`, **sem o corpo e sem o score**; `removed_by` e `removed_reason` ficam para a moderação. Tombstone **preserva posição e descendentes** (decisão 3). **A proibição de autoexclusão foi revogada** — ver T2.7b. Poderes de remoção e restauração da moderação permanecem separados dos do autor. **Moderação nunca edita o texto de outro usuário** (decisão 22): `moderator`/`admin` podem retirar ou restaurar versões válidas, sempre com motivo e auditoria, mas **não reescrevem a fala alheia nem fazem redação parcial**; conteúdo que exponha PII é retirado por tombstone, e versão corrigida exige nova edição do próprio autor — assim a identidade exibida nunca assina texto produzido pela moderação. · feito quando: filhos sobrevivem à remoção do pai; corpo e score somem da resposta pública; e não existe caminho de código em que a moderação grave `body_markdown`.
- [x] T2.7b — **Autor edita e retira o próprio comentário** (decisões 17, 18, 20). **Task nova: esta decisão revoga expressamente D111 item 6, o requisito 12 e a formulação anterior de T2.7**, que proibiam autoedição e autoexclusão. Edição: sem prazo, **somente `body_markdown`** — pai, assunto, autoria e `created_at` são imutáveis; registra `edited_at`; público vê só a versão atual mais o marcador de edição; versões antigas ficam restritas à moderação (T2.1b); **edição idêntica é no-op** e **edição não gera notificação**. **Edição preserva votos e ranking** (decisão 18): trocar o corpo não apaga, recalcula nem invalida votos — `upvotes`, `downvotes`, score e versões de ranking seguem vinculados ao mesmo comentário. O risco de bait-and-switch é tratado pelo **marcador público de edição e pelo histórico completo da moderação**, não por zerar a reação de terceiros. Auto-retirada usa tombstone — **nunca `DELETE` físico** —, preserva posição e descendentes, oculta o corpo público, entra no histórico com ator/motivo/timestamp e é **irreversível para o autor**; apenas `moderator`/`admin` restaura a última versão válida, com auditoria. · feito quando: autor edita e o score não muda; edição idêntica não cria versão nem notificação; auto-retirada preserva os filhos; e autor não consegue desfazer a própria retirada.
  **Estado T2.7 + T2.7b — entregues em 2026-08-09** (`communityCommentLifecycle.ts`,
  `PATCH`/`DELETE /internal/v1/comments/:id`). As duas moram no mesmo arquivo porque são as
  únicas escritas que mudam comentário já existente e param no mesmo lugar: prova de autoria sob
  `FOR UPDATE`. Separá-las duplicaria essa checagem.

  **Validação:** `accounts` 295/295 (era 229; +66 casos, 28 skip inalterados do Wilson/T8.1) ·
  lint 25/25 · build 25/25 · test 41/41 · `verify:api` `accounts: breaking=0 non-breaking=1`,
  com as duas rotas no inventário e no `accounts.openapi.yaml`.

  **`community_comment` sem trigger é desenho, não lacuna — e a spec já dizia isso.** A medição
  (`pg_trigger` de `artificio_auth`, 2026-08-09: 17 triggers em tabelas `community*`, nenhum
  sobre `community_comment`) apenas confirma o **mapa de imutabilidade já registrado no bloco de
  T2.6c** acima: só `community_comment_version` e `notification_event` são append-only;
  `community_comment`, `community_actor`, `community_actor_account_link`,
  `community_idempotency_key`, `community_comment_subject` e `notification_receipt` não têm
  trigger algum, de propósito.

  O critério de T2.1f é **"não existe estado terminal sem auditoria"**, e "terminal" ali é o
  vocabulário da moderação — caso fechado, denúncia resolvida, recurso decidido, restrição
  levantada. São exatamente as cinco tabelas cobertas por `require_community_terminal_audit`.
  **Tombstone não é estado terminal:** T2.7 mantém o poder de restauração da moderação, e a
  decisão 46 diz que a auto-retirada não encerra o caso — a linha do comentário **precisa**
  continuar mutável, porque é nela que `POST /restore` (§5) escreve. Somar um trigger de
  auditoria ali criaria fricção justamente na rota que a spec exige que exista. T4.19b fecha:
  "a migration coesa T2.1–T2.1f já cria auditoria de conteúdo; esta fase não abre segunda
  migration".

  Consequência aceita, e o motivo de o teste ser o que é: a atomicidade estado+auditoria da
  retirada é sustentada **pelo handler**. Se o `insert` na auditoria sair do código, a retirada
  continua funcionando e a trilha some sem erro — por isso `communityCommentLifecycleSql.test.ts`
  afirma a **linha de auditoria**, não só o estado do comentário.

  **Duas lacunas de tipo corrigidas no caminho, ambas introduzidas antes desta task:**
  `CommunityCommentRow` não declarava `removed_at`, `removed_by_actor_id` nem `removed_reason`
  (existem em `migration_006:158-160` desde o início), e `community_moderation_audit` não estava
  no `Database`. O tipo descrevia uma tabela sem retirada e um schema sem trilha de auditoria.

  **O motivo canônico da auto-retirada** (`"Retirado pelo próprio autor"`) resolve um choque
  real entre contrato e schema: §4 define `DELETE` **sem corpo**, e
  `community_comment_removal_check` exige `removed_reason` não-vazio em `author_removed`.
  Inventar campo de motivo contrariaria o contrato; string vazia bateria no `CHECK`.

  **Decisão 18 na prática — o ponto mais contraintuitivo:** editar **preserva** voto, score e
  `ranking_revision`. Os testes de SQL compilado afirmam que a transação inteira nunca menciona
  `community_comment_vote`, `community_comment_score_version` nem `ranking_revision`. Zerar
  puniria quem corrige uma vírgula e não impediria o mal-intencionado, que edita antes do
  primeiro voto chegar.

  **Cobertura, 66 casos em dois arquivos.** `communityCommentLifecycleSql.test.ts` (36) afirma
  sobre o **SQL compilado**, porque os invariantes caros são negativos — o que *não* entra no
  `SET`: sete colunas imutáveis, quatro tabelas nunca tocadas, nenhum `DELETE`, `body_markdown`
  fora do `SET` da retirada, auditoria presente, `FOR UPDATE` e não `FOR SHARE`, `realm`/
  `source_app` no `WHERE` do `SELECT` **e** do `UPDATE`. Um `SET` a mais não falha em lugar
  nenhum — só apaga voto de terceiro em silêncio, e nenhum teste de rota com mock veria isso.
  `communityCommentLifecycleRoutes.test.ts` (30) cobre o contrato HTTP, incluindo os seis campos
  imutáveis recusados com `400` e a **ausência** de rota de restauração pelo autor.

  **Erro meu no caminho, corrigido:** escrevi `createApp(db, env)` nos 20 pontos do teste de
  rotas; a assinatura real é `createApp(env, db)` (`app.ts:195`). Deu `500` com
  `db.selectFrom is not a function` em 28 casos, e o `500` mascarava tudo — inclusive os casos
  que deveriam parar na validação. Achado por probe que imprimiu o corpo do erro, não pela
  mensagem do vitest.

  **Erro meu de processo, no mesmo tema:** registrei aqui e na PR #250 que estender
  `require_community_terminal_audit` a `community_comment` era "pendente de decisão do
  mantenedor". Não era decisão nenhuma — o mapa de imutabilidade de T2.6c, o critério de T2.1f
  ("estado terminal"), a decisão 46 e T4.19b já respondiam, todos neste arquivo. Devolvi como
  bifurcação o que a pesquisa resolvia, que é o custo que `AGENTS.md` §Pesquisar antes de
  perguntar nomeia.

- [ ] T2.8 — **Legado com proveniência explícita, imutável mas respondível** (requisito 9; decisões 6, 23). Reformulado: a versão anterior dizia "read-only, **sem aceitar resposta**" — a segunda metade foi **revogada pela decisão 23**. O registro importado é imutável (não edita, não recebe voto, score `0` permanente) e marcado como antigo/autoria não verificada, mas **pode ser pai de comentário novo** de conta autenticada; a resposta nova obedece ao limite estrutural de `depth<=4`, à autorização do assunto e às regras atuais. `site.comments` tem nome solto, HTML e `parent_id` **sem FK** (`apps/site/db/migrations/001_init.sql:66`) — a migração precisa detectar pais órfãos e ciclos **antes** de copiar. Importar com `user_id` nulo, `legacy_author_name`, `legacy_source='site'`. Relações válidas preservadas; órfãs achatadas ou marcadas conforme decisão registrada. · feito quando: escrita sem `user_id` rejeitada; legado legível; **resposta nova a comentário legado é aceita**; voto em legado é recusado; e nenhum órfão ou ciclo copiado silenciosamente.

  **Conjunto real medido em 2026-08-04** (ver bloco no topo da fase): 25 comentários,
  3 com `parent_id`, **0 órfãos**, 21 autores distintos. A ausência de FK em
  `parent_id` é real e confirmada, mas o dano que ela permitiria não ocorreu neste
  conjunto. A detecção de órfão e ciclo **continua obrigatória** — é barata, e o
  conjunto pode mudar entre esta medição e o import — porém o caminho esperado é
  "nenhum órfão encontrado", não achatamento em massa. Se o import encontrar
  órfãos, isso significa que o banco mudou depois de 2026-08-04 e o número precisa
  ser remedido antes de decidir o tratamento.
### Bloco F — Leitura, capacidade e testes

- [x] T2.9 — **Identidade resolvida no mesmo `SELECT` sem depender da conta viva** (requisitos 7, 7a–7b; decisão 53). Fazer `JOIN` do comentário ao `community_actor` e, somente quando permitido, ao vínculo/usuário — não segunda chamada nem rota em lote de T1.4. Conta excluída devolve “Conta excluída” e avatar nulo mesmo durante retenção interna; conta ativa devolve perfil; vínculo vencido ou ausente nunca quebra a lista nem reaparece para moderação. · feito quando: uma consulta cobre ativo/excluído/retido/expirado; API pública nunca distingue retenção interna; e-mail/fingerprint nunca entram no resultado.
  **Estado T2.9 — entregue em 2026-08-09** (`communityCommentRead.ts`,
  `authorIdentity`). O `JOIN` já existia desde T2.3; o que faltava era o
  tratamento das contas que não existem mais.

  **Validação:** coberto por 7 casos novos em `communityCommentRoutes.test.ts`;
  números completos no bloco de T2.12-T2.16 abaixo (mesma sessão).

  **Medição que definiu o desenho:** `users` **não tem** coluna de exclusão
  lógica — `information_schema.columns` em produção devolve `id, google_sub,
  email, name, avatar, role, created_at, avatar_source, role_version`, e
  `deleteUser` faz `DELETE` físico (`users.ts:87`). Com o `ON DELETE CASCADE` de
  `community_actor_account_link.user_id`, excluir a conta **apaga o vínculo**: o
  `LEFT JOIN` não casa e `u.name` chega nulo. O ator sobrevive, que é o que
  sustenta comentário e voto sem FK nominal (requisito 7a).

  **O gap real era `display_name: null`.** Requisito 7 pede **nome neutro**, não
  ausência de nome. Nulo obrigaria cada consumidor a inventar o próprio texto, e
  o primeiro que esquecesse renderizaria comentário sem autor. A string "Conta
  excluída" está fixada em quatro pontos da spec (`spec.md:86`, `spec.md:712`,
  decisão 53, T2.9) e passou a ser materializada **pelo backend**.

  **`author.state` acompanha, em valor de máquina** (`active | deleted |
  legacy`), pelo mesmo motivo de `badge` ser enum: comparar
  `display_name === "Conta excluída"` quebraria a interface no dia em que a
  redação mudasse. Legado é `legacy`, não `deleted` — classificá-lo como excluído
  sugeriria que alguém apagou a conta de um comentário de 2019, quando ele nunca
  teve conta (decisão 6).

  **O oráculo que a task fecha:** conta excluída e conta em retenção interna saem
  **idênticas**. Um `state` próprio para retenção diria ao público que aquele
  autor tem caso de moderação aberto. Isso vale sem código extra —
  `retention_until` e `legal_hold` só existem na linha de vínculo e a leitura nem
  os seleciona —, e um teste de busca negativa afirma a ausência de `email`,
  `google_sub`, `retention_until`, `legal_hold`, `user_id`, `actor_id` e
  `fingerprint` no payload.

- [x] T2.10 — **[P1] Antiabuso com buckets independentes por camada, identidade e ação** (decisões 50, 54). Antes de expor comentários, separar autenticação, leitura, criação/resposta, edição, voto, denúncia e recurso. Backend de cada app aplica IP real validado e usuário; `accounts.` aplica usuário e credencial de `source_app`. Todos os buckets aplicáveis precisam permitir a operação; não combinar IP+usuário numa chave única. Excesso retorna 429 genérico, sem revelar bucket, saldo ou sinal interno. IP bruto permanece somente na chave efêmera da fachada pelo TTL: não entra no payload interno, banco ou auditoria comunitária. Valores são configuração operacional; medição Cloudflare/trusted proxy calibra antes do uso integral e, se falhar, abre correção do ingress sem redesenhar o `accounts.`. · feito quando: carga de comentário não consome cota de `/login`, `/me` ou `/refresh`; cada ação tem orçamento independente; NAT não vira bloqueio coletivo; testes provam as chaves reais das duas camadas e busca negativa prova ausência de IP no contrato/schema comunitário.

  **Verificado contra o código real em 2026-08-04 — procede, com correção de referência e um agravante novo.**
  A referência `app.ts:79` **está desatualizada**: o limiter vive hoje em
  `apps/accounts/src/app.ts:201`. O diagnóstico em si continua correto e foi
  confirmado linha a linha: é `app.use(rateLimit({ windowMs: 15*60*1000, max: 200 }))`,
  registrado **antes** de `cookieParser`, `csrfProtection`, `express.json` e `cors`
  — ou seja, cobre a aplicação inteira, incluindo qualquer rota de comentário que
  a Fase 2 adicionar. A cota é compartilhada com `/login`, `/me` e `/refresh`.

  **Agravante registrado em 2026-08-04: o limiter não declara `keyGenerator`.**
  Sem ele, `express-rate-limit` chaveia por IP de origem. Como há
  `app.set("trust proxy", env.TRUSTED_PROXY_CIDR)` com default `172.18.0.0/16`
  (`apps/accounts/src/env.ts:38`) e Cloudflare na borda, ficou em aberto se a
  cota se aplicava por usuário final ou por IP de saída da borda — no segundo
  caso, os 200 req/15 min seriam o teto do **SSO inteiro**.

  **Medido e fechado em 2026-08-09: o regime é por usuário final.** Três `GET
  https://accounts.artificiorpg.com/health` da estação do mantenedor devolveram
  `ratelimit-remaining` 199 → 198 → 197; o quarto, disparado **da VM** (IP de
  saída distinto, via `ssh faren`), devolveu **199** — contador próprio, não 196.
  Contadores independentes por origem, logo `X-Forwarded-For` chega e é honrado.
  A cadeia sustenta: `cloudflared` é `172.18.0.23` e `accounts-api` é
  `172.18.0.17`, ambos em `artificio_net`, dentro do `172.18.0.0/16` confiado
  (`docker inspect`, e `printenv TRUSTED_PROXY_CIDR` no container devolve o
  default).

  **O que isso muda para quem implementar:** o cenário ruim está descartado — não
  há teto coletivo a corrigir com urgência, e os limiters novos podem ser
  dimensionados por identidade. O problema declarado da task **continua de pé**:
  cota única de 200/15 min compartilhada entre `/login`, `/me`, `/refresh` e as
  cinco rotas de comentário já entregues.

  **Ampliação decorrente do grilling (2026-08-04).** A formulação original previa
  três limiters — autenticação, leitura pública e escrita. As decisões 11 e 12
  acrescentam **voto**, e a 33 acrescenta **denúncia**, ambos com característica
  própria: são mutações baratas, de alta frequência legítima e alvo direto de
  abuso coordenado, e a decisão 11 exige explicitamente **rate limit por usuário
  e IP** como proteção inicial do voto. Não cabe reaproveitar o orçamento de
  escrita de comentário para eles — um usuário legítimo vota muito mais do que
  comenta, e um orçamento único ou barra o uso normal ou não contém o abuso.
  T2.20(a) depende deste desenho: as rotas de leitura da fila de denúncia
  **não** podem consumir o limiter de escrita.

  **Entregue em 2026-08-09.** `packages/comments/src/rateLimitBuckets.ts` (regra
  compartilhada pelas duas camadas) + `apps/accounts/src/communityRateLimit.ts`
  (aplicação na camada interna) + `skip` no limiter global de `app.ts`.

  **Validação:** `accounts` 313/313 (era 304; +24 casos, 28 skip inalterados do
  Wilson/T8.1) · `comments` 154/154 (era 139) · lint 25/25 · build 25/25 · test
  41/41 · `verify:api` exit 0.

  **A cota do SSO deixou de ser consumida por comentário.** O limiter de
  `app.ts:201` cobria a aplicação inteira, `/internal/v1/*` incluído. O `skip` é
  por **prefixo**, não por lista de rotas: rota comunitária nova nasce fora do
  bucket de autenticação sem depender de alguém lembrar de acrescentá-la.
  `/internal/users/:id` (spec 083) continua dentro do limiter do SSO — não é rota
  comunitária. O teste que fixa isso dispara 201 escritas (uma a mais que o teto
  global de 200) e afirma que `/api/auth/me` responde `401`, não `429`; um
  segundo caso prova que o `skip` **não** desligou a proteção de quem ele deve
  proteger.

  **Buckets e chaves.** Seis buckets (`read`, `write`, `edit`, `vote`, `report`,
  `appeal`), e `authentication` **fora da união** de propósito: não existe valor
  a passar que faça uma rota comunitária cair na cota de login. Na camada
  `accounts`, duas dimensões — usuário e credencial — viram **chaves separadas**,
  nunca uma composta: composta daria ao mesmo usuário orçamento novo a cada
  `source_app`, e um módulo com bug gastaria a cota de todos os seus usuários sem
  estourar nada. `resolveRateLimitKeys` **lança** se receber IP na camada interna
  (decisão 54) — ignorar em silêncio deixaria o IP virar chave um dia sem
  ninguém saber que não devia.

  **Orçamentos** (configuração operacional, §14): `read` 300/6000, `write` e
  `edit` 30/600, `vote` 120/2400, `report` 20/400, `appeal` 10/200 — por usuário
  e por credencial, janela de 15 min. O da credencial é maior por ordem de
  grandeza porque conta o módulo inteiro; igualá-los faria tráfego normal
  derrubar o app.

  **`429` não revela nada** (decisão 50): formato único de erro (§13), sem
  `RateLimit-*` e sem `Retry-After` — esses headers *são* o saldo que a decisão
  manda não expor. Teste afirma a ausência dos três.

  **Erro meu, corrigido no caminho:** o store nasceu como singleton de módulo e
  quebrou **12 testes de outros arquivos** com `429`, porque compartilhavam o
  contador do mesmo usuário fictício. O sintoma foi em teste, mas o defeito não
  era: duas instâncias de `createApp` no mesmo processo dividiriam orçamento sem
  nada no desenho dizendo que dividem. Store passou a ser criado por instância de
  router.

  **Limite conhecido, aceito e explícito:** contadores em memória. Reiniciar o
  processo zera; duas réplicas contam separado. É consequência da decisão 54 — a
  chave carrega identidade e existe só pelo TTL do bucket; persistir criaria
  registro de atividade por usuário que nenhuma decisão autorizou e que teria de
  entrar no fluxo de exclusão (decisão 53). Para o volume atual serve; quando não
  servir, troca-se o armazenamento, não o desenho das chaves.

  **A camada `facade` está definida e não aplicada.** `resolveRateLimitKeys`
  cobre as duas camadas (é o que impede as listas de bucket divergirem), mas
  nenhum app consumidor a chama ainda — a fachada de cada módulo entra na fase de
  adoção, e é lá que o IP real validado passa a ser chaveado.
- [ ] T2.11 — **Testes de borda obrigatórios**. Reformulado: a lista anterior tinha onze itens e incluía "resposta a legado" como caso que **deveria falhar** — invertido pela decisão 23, agora é caso que deve **passar**. Cobrir: pai em outro assunto; pai em outro `realm`; profundidade sob concorrência (`depth=4` é o teto); assunto inexistente; dono forjado no payload; **resposta a legado, que deve ser aceita**; voto em legado, recusado; **auto-retirada do próprio comentário, aceita**; edição por terceiro, recusada; `moderator` revogado com sessão viva; árvore/cursor; voto concorrente; auto-hide; denúncia repetida; decisão concorrente; links hostis; conteúdo vazio/excessivo; `accounts.` indisponível; exclusão sem caso; exclusão com caso/recurso; `legal_hold`; expurgo vencido; recadastro antes/depois de seis meses; sanção ativa; e ausência de IP no payload/schema. · feito quando: todos cobertos, cada negativo falhando fechado, positivos passando, e relógio controlado prova cada prazo sem teste dependente do tempo real.

### Bloco D — Voto e ranking

- [x] T2.12 — **Mutação de voto por estado absoluto** (decisões 11, 12). **Task nova.** `PUT /internal/v1/comments/:id/vote` recebe `{ value: -1 | 0 | 1 }`; `0` **remove** o voto. Mesmo valor é **no-op**: devolve `200`, **sem nova revisão nem novo registro de histórico**. Troca ou remoção real atualiza voto, contagens, score, versão de ranking e auditoria **na mesma transação**. **Não há `ETag`, `If-Match` nem `Idempotency-Key`**: concorrência entre dispositivos resolve por **última gravação vence**, pela última transação persistida. Token do app e `X-Acting-User-Id` continuam obrigatórios; retry idêntico não duplica efeito. **Somente terceiros votam** (decisão 5): o autor não recebe auto-upvote e **não pode votar no próprio comentário** — divergência deliberada do Reddit, porque aqui o score representa reação de outras contas, não participação do autor. **Comentário legado não aceita voto** (decisão 6). **Conta nova vota imediatamente e com o mesmo peso** (decisão 11): sem espera, quarentena, voto pendente, peso secreto ou assimetria entre upvote e downvote. Proteções iniciais: uma escolha ativa por conta/comentário, rate limit por usuário e IP (T2.10), credencial backend-to-backend e auditoria completa. Endurecimento futuro exige **abuso medido**, não prevenção oculta. · feito quando: voto repetido idêntico não incrementa revisão; voto no próprio comentário recusado; voto em legado recusado; e dois dispositivos concorrentes convergem para a última transação, sem linha duplicada.
- [x] T2.13 — **Revisão de ranking incrementada sob lock transacional curto** (decisão 8). **Task nova.** Cada assunto mantém `ranking_revision`; cada comentário registra `created_revision`; **mudança de voto incrementa a revisão sob lock transacional curto**. Isto é o que permite o cursor de T2.3 ser stateless: época fixa, ranking vivo sem consistência e snapshot por sessão foram **explicitamente descartados** no grilling. O lock precisa ser curto o bastante para não serializar o assunto inteiro sob carga — dimensionar e medir, não presumir. Referências pesquisadas registradas na decisão 8: árvore truncada e `more` do Reddit (`reddit-archive/reddit`, `r2/r2/models/builder.py`), contrato `MoreChildrenRequest`, limite de snapshot exportado do PostgreSQL 16 e padrão `search_after` + point-in-time do Elasticsearch. · feito quando: votos concorrentes em comentários do mesmo assunto não perdem incremento de revisão, e a navegação paginada iniciada antes deles mantém posição estável.
- [x] T2.14 — **Transparência de contagens e visibilidade do voto** (decisões 9, 10, 53). **Task nova.** A resposta pública expõe `upvotes`, `downvotes` e `score`; quando autenticada, também `my_vote`. **Score é público imediatamente**: não existe `score_hidden_until`, janela de ocultação nem política por `source_app` nesta fase. A superfície de **moderação** acessa histórico completo por ator e resolve a conta votante somente enquanto existir vínculo permitido por T2.15; após expurgo, não há caminho de reidentificação. **A API pública nunca expõe lista nominal.** · feito quando: resposta pública traz as três contagens e nenhuma identidade; `my_vote` só aparece autenticado; rota de moderação exige papel/auditoria; e relógio vencido remove a identidade sem alterar histórico/score.
- [ ] T2.15 — **Destino do voto e da identidade quando a conta perde acesso** (decisões 14, 15 supersedida em parte, 52–53). **Task nova.** Saída/desativação preserva votos e score, barra voto novo; abuso permite invalidar votos com motivo, auditoria, nova `ranking_revision` e recálculo, sem apagar histórico bruto. Adaptar o `DELETE /api/account` existente (`apps/accounts/src/app.ts:345` e `users.ts:85`): revogar refresh/cookies e eliminar nome/e-mail/avatar/identidade pública no pedido; rotas comunitárias revalidam a conta e recusam access token antigo imediatamente; os demais consumidores permanecem no SLA SSO já aprovado de até 15 minutos. Conteúdo e score passam a “Conta excluída”. Sem caso/recurso, apagar o vínculo ator→conta no mesmo ciclo. Com caso/recurso, restringi-lo à moderação até seis meses após a decisão final; `legal_hold` auditado suspende; executor idempotente remove vencidos e toda leitura trata vencido como ausente. Criar fingerprint HMAC versionado apenas para impedir recadastro voluntário por seis meses ou enquanto sanção durar; nunca expor/logar; remover ao acabar a finalidade. Publicar no fluxo de exclusão controlador, contato, efeitos, prazos, SLA e exceções. · feito quando: os sete cenários temporais de T2.11 passam; comentário/voto sobrevivem sem FK nominal; conta reaparece só como nova identidade após seis meses; token antigo não escreve na comunidade; e busca negativa prova ausência de PII/IP no ator desvinculado.
- [x] T2.16 — **Voto não gera notificação** (decisão 13). **Task nova.** Nem voto individual nem marco agregado ("seu comentário chegou a 10 pontos") cria `notification_event` ou `notification_receipt`; o autor acompanha contagens na própria thread. O núcleo transacional antecipado da Fase 3 (T2.1d) continua **restrito a criação de comentário e resposta**. · feito quando: sequência de votos não produz nenhum recibo, provado por teste.

  **Estado T2.12 + T2.13 + T2.14 + T2.16 — entregues em 2026-08-09**
  (`communityCommentVote.ts`, `PUT /internal/v1/comments/:id/vote`).

  **As quatro moram na mesma transação porque §7 as define assim** — "atualiza
  voto, contagens, `comment_score_version`, incrementa `ranking_revision` do
  assunto sob lock curto, tudo na mesma transação". Separá-las em módulos daria
  funções que só funcionam chamadas juntas, na ordem certa; a primeira vez que
  alguém chamasse duas o score ficaria fora da revisão que o cursor congelou.
  T2.16 é a **ausência** de notificação, e vive no mesmo lugar pelo mesmo motivo.

  **Validação:** `accounts` 372/372 (era 313; +59 casos, 28 skip inalterados do
  Wilson/T8.1) · lint 25/25 · build 25/25 · test 41/41 · `verify:api`
  `accounts: 23 rotas` (era 22), `breaking=0 non-breaking=1`.

  **`value: 0` remove a linha, não grava zero.** `community_comment_vote.value`
  tem `CHECK (value IN (-1, 1))`: zero nem chega ao banco. Ausência de linha é a
  representação de "sem voto", e é o que `my_vote` devolve como `0` no payload.

  **O lock de T2.13 é `UPDATE ... RETURNING`, não `SELECT ... FOR UPDATE`.**
  Trava a linha do assunto e devolve a revisão nova numa instrução; duas idas ao
  banco segurariam o lock por mais tempo, e ele precisa ser curto para não
  serializar o assunto inteiro. O teste de SQL compilado afirma a forma e afirma
  a **ausência** de `for update` sobre `community_comment_subject`.

  **Score é histórico, não campo mutável.** Cada mudança fecha a faixa corrente
  (`valid_to_revision = revisão nova`) e abre outra. `score` e `best_score` são
  colunas geradas e **nunca** entram no `INSERT` — gravá-las levanta erro em
  runtime, e decisão 21 diz que a fórmula de Wilson vive na função SQL. Teste
  afirma a ausência das duas colunas e da palavra `wilson` no SQL inteiro.

  **No-op sai antes do lock.** Mesmo valor devolve `200` sem incrementar revisão,
  sem histórico e sem faixa nova: incrementar invalidaria o cursor de quem está
  navegando por uma requisição que não mudou nada. Tomar o lock do assunto para
  ela ainda serializaria votos legítimos de outros comentários.

  **`FOR SHARE` no comentário, não `FOR UPDATE`.** O voto não escreve na linha do
  comentário; a trava compartilhada só impede que ele vire tombstone no meio da
  transação, sem serializar votos concorrentes no mesmo comentário — que é o caso
  comum e precisa escalar.

  **Ator criado depois das recusas.** Quem nunca comentou pode votar, mas o ator
  nasce **após** as checagens de legado, auto-voto e visibilidade: criá-lo antes
  gravaria identidade comunitária por causa de um voto que foi recusado. Teste
  cobre os dois caminhos.

  **T2.16 provado por sequência, não por caso isolado:** dez votos sucessivos
  cruzando o marco de 10 pontos, cada um afirmando ausência de
  `notification_event` e `notification_receipt` — o gatilho que um sistema com
  notificação agregada usaria.

  **Lacuna de tipo corrigida no caminho, anterior a estas tasks:**
  `community_comment_vote_audit` não estava no `Database` do Kysely, apesar de
  existir em `migration_006:403`. O schema tinha trilha de auditoria de voto e o
  tipo não.

  **Não entregue, e por quê: T2.15** (destino do voto e da identidade quando a
  conta perde acesso). Ela exige fingerprint HMAC versionado, executor idempotente
  de expurgo, publicação de controlador/prazos/SLA no fluxo de exclusão e
  tratamento de caso/recurso — que é Bloco E, ainda não implementado. Os sete
  cenários temporais do aceite dela dependem de `moderation_case` vivo. Fatiá-la
  agora exigiria inventar contrato que a spec não fixou.

### Bloco E — Denúncia e moderação

- [ ] T2.17 — **API de denúncia e fila compartilhada** (decisões 32, 33, 35, 37, 38, 53). **Task nova — fecha lacuna real do contrato.** Persistência, API interna, fila compartilhada, resolução e auditoria pertencem à mesma entrega. Regras: exige conta; autor não denuncia o próprio comentário; no máximo uma denúncia ativa por ator/comentário. A moderação vê o ator e resolve a conta somente enquanto existir vínculo permitido por T2.15; público, outros denunciantes e autor denunciado nunca recebem nenhum dos dois. Após expurgo, denúncia/evidência permanecem, sem reidentificação. O fluxo do `downloads` é fonte de aprendizado: estados, nova denúncia após terminal, “minhas denúncias”, retirada permitida, prioridade, detalhes/nota separados, aviso, sinal de abuso sem punição automática, contexto e auditoria. Tudo geral vive no `accounts.` e no único `packages/comments`; domínio fica no adapter. Moderador reclassifica prioridade com motivo. · feito quando: denúncia do autor recusada; segunda ativa do mesmo ator recusada; identidade respeita retenção; nenhum app mantém state machine própria.
- [ ] T2.18 — **Auto-ocultação por limiar de cinco contas distintas** (decisão 34). **Task nova.** Uma denúncia isolada **apenas cria ou prioriza item na fila** — não oculta nada. Ao atingir **cinco contas distintas**, o comentário passa ao estado próprio **`pending_review_hidden`**: público vê placeholder, **corpo e score somem**, **posição e descendentes permanecem**. Isto **não é tombstone nem decisão de moderador**, e precisa ser estado distinto no schema (T2.1). A fila conserva corpo, denúncias e identidades; a moderação confirma a retirada ou **descarta as denúncias e restaura a visibilidade**, tudo auditado. Contam **somente denúncias ativas, ainda não resolvidas, de contas válidas**; a mesma conta **nunca soma duas vezes**. O limiar alto é deliberado: em baixo volume a auto-ocultação será rara, priorizando resistência a coordenação entre poucas contas. Categoria e prioridade **nunca ocultam sozinhas** (decisão 38) — este limiar é o **único** auto-hide da fase. · feito quando: quatro denúncias não ocultam; a quinta oculta preservando os filhos; denúncia repetida da mesma conta não conta duas vezes; e restauração pela moderação devolve corpo e score.
- [ ] T2.19 — **Caso episódico agrega denúncias sem perder granularidade** (decisões 39, 40, 53). **Task nova.** Existe no máximo um `moderation_case` aberto por comentário; cada denúncia continua linha individual imutável ligada ao caso. A fila mostra item agregado com quantidade, categorias, prioridade máxima e atores denunciantes; contas reais aparecem somente enquanto o vínculo de T2.15 permitir. Decisão terminal fecha caso/denúncias sem apagar histórico; denúncia posterior abre caso novo. Cada denúncia fixa `reported_version_id` atomicamente; edição não altera evidência nem retira da fila. Moderação vê versão denunciada/atual, diff e histórico; relatório não duplica corpo. · feito quando: duas denúncias produzem um item e duas evidências; edição não some; terminal fecha sem apagar; denúncia posterior abre caso; expurgo nominal não modifica o caso.
- [ ] T2.20 — **Invariantes de decisão terminal implementados corretamente desde o início** (decisão 36). **Task nova.** Os três defeitos identificados no fluxo local do `downloads` **não são reproduzidos** no núcleo: (a) rotas de leitura (`GET /mine`, `GET /abuse-check/:userId`, `GET /reports`) usam **orçamento de leitura**, nunca o limiter de escrita; (b) decisão terminal **não** faz check-before-transaction seguido de `UPDATE` só por `id` — a transição é **serializada e condicionada**, garantindo **um único vencedor, uma única notificação e conflito explícito ao segundo moderador**; (c) auditoria de decisão é **registro persistente na mesma transação do estado**, nunca `console.log`. A correção do fluxo local do `downloads` acontece na **fase de adoção** dele, não aqui — organização temporal decidida pelo mantenedor, **não autorização para preservar os bugs** (`AGENTS.md` §Bug achado: o item segue até o verde). · feito quando: dois moderadores decidindo em concorrência produzem um vencedor e um `409`; uma única notificação é emitida; e a auditoria da decisão sobrevive a rollback do restante da requisição sendo — corretamente — revertida junto.
- [ ] T2.21 — **Auto-hide, edição e retiradas concorrentes** (decisões 41, 42, 46). **Task nova pela reconciliação.** Editar após `pending_review_hidden` cria versão, mas não revela nem fecha caso. Denunciante só retira denúncia enquanto o comentário segue visível; quinta denúncia e retirada concorrente usam o mesmo lock/transação — quem persistir primeiro define o resultado, sem auto-restauração por queda posterior do total. Auto-retirada do autor cria tombstone imediato, preserva versões/evidência e não encerra caso nem vale como confissão; `no_change` preserva a visibilidade atual. · feito quando: edição de oculto continua oculta; corrida quinta denúncia × retirada termina em um estado válido; autor retira sem apagar caso; e nenhuma transição restaura automaticamente.
- [ ] T2.22 — **Veredito por denúncia e ação única por caso** (decisões 43, 46). **Task nova pela reconciliação.** Cada denúncia não retirada termina individualmente como `upheld`, `dismissed` ou `no_determination`; `withdrawn` permanece neutro. Caso recebe uma ação `no_change`, `restore` ou `remove`. Interface pode sugerir valor em lote, mas backend exige veredito final de cada denúncia e uma ação; persiste tudo com moderador, motivo e auditoria na mesma transação. `no_change` não significa “tornar visível”: preserva visibilidade/tombstone existente. · feito quando: caso não fecha com denúncia sem veredito; decisões mistas permanecem individuais; e rollback não deixa caso fechado pela metade.
- [ ] T2.23 — **Resultado privado e mínimo aos dois lados** (decisão 44). **Task nova pela reconciliação.** Cada denunciante recebe apenas `action_taken`, `not_upheld` ou `no_determination` do próprio veredito; nunca identidade alheia, nota interna, sanção ou raciocínio reservado. Autor recebe auto-hide e remoção/restauração com categoria pública aplicável e próximo passo. Evento e recibos nascem na transação do estado, deduplicam destinatário e excluem o ator. · feito quando: payloads públicos/privados provam ausência dos campos vedados; uma decisão cria exatamente os recibos esperados; e falha de recibo reverte a transição.
- [ ] T2.24 — **Aprovação de versão impede reabertura automática** (decisão 45). **Task nova pela reconciliação.** `no_change` sobre conteúdo visível ou `restore` com denúncias improcedentes aprova o `comment_version_id` revisado. Nova denúncia da mesma versão é recebida/auditada como `no_determination` com motivo interno `approved_version`, mas não abre caso, não soma limiar nem muda visibilidade. Moderador pode reabrir manualmente com motivo. Edição cria versão nova novamente denunciável. · feito quando: cinco denúncias posteriores da versão aprovada não ocultam; reabertura manual é auditada; e editar permite novo caso sem reutilizar o antigo.
- [ ] T2.25 — **Recurso estruturado da remoção moderadora** (decisão 47). **Task nova pela reconciliação.** Só autor, uma vez por decisão terminal que removeu seu conteúdo, em até seis meses. Recurso referencia caso, decisão e versão; não restaura automaticamente; termina em `upheld` ou `reversed` e notifica privadamente. O mesmo moderador pode rejulgar, mas a UI identifica que foi o decisor original e exige nova justificativa; outro moderador pode assumir sem ser trava. · feito quando: terceiro/denunciante/segundo recurso/prazo expirado são recusados; o caso original não é sobrescrito; e resultado aparece em auditoria e notificação.
- [ ] T2.26 — **Sanção comunitária e detalhe declarativo** (decisões 48, 49). **Task nova pela reconciliação.** Restrições independentes `posting`/`commenting`, com `warning`, suspensão temporária ou permanente; temporária exige duração e pode oferecer presets. Moderador escolhe escopo, nível, prazo e motivo — nenhuma denúncia/reincidência sanciona automaticamente. Login, leitura, uso não comunitário e auto-retirada continuam. `commenting` falha fechado antes da escrita; `posting` nasce no contrato central, sem classificar silenciosamente objetos de domínio. Cada motivo define `details=required|optional|forbidden`; detalhe é texto puro, trim, máximo 4.000, imutável, restrito à moderação e nunca ecoado em log/erro/notificação. · feito quando: restrição de comentário não bloqueia login; restrição de postagem não alcança domínio sem adapter explícito; campos obrigatório/proibido são validados; e toda sanção tem auditoria.

## Fase 3 — Notificações agregadas

A razão de ser da agregação. Sem esta fase, o ganho sobre banco por app é pequeno.

- [ ] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T3.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T3.1 — **Consumir o schema de evento/recibo já criado em T2.1d** (requisito 13; decisão 1). **A migration antes descrita aqui foi antecipada para a Fase 2 e não deve ser recriada.** Nesta fase, validar que `notification_event` imutável e `notification_receipt` por destinatário sustentam paginação, leitura e canais futuros sem alterar o schema central. · feito quando: nenhuma migration duplicada nasce; API/central usam as tabelas existentes; e contrato de imutabilidade continua testado.
- [ ] T3.2 — **Reusar destinatários já gerados em T2.6c** (requisitos 14-16; decisão 1). Raiz, resposta, deduplicação, exclusão do ator e de conta inválida são invariantes da criação na Fase 2. Aqui a API e a central provam que leem exatamente esses recibos, sem recalcular destinatário pelo domínio vivo. · feito quando: as cinco regras aparecem corretamente na central e nenhuma leitura cria recibo novo.
- [ ] T3.3 — **Formatar o snapshot estruturado já gravado em T2.6c** (requisito 13; decisão 1). A Fase 2 guarda dados imutáveis e `event_version`; esta fase monta texto para API/central sem consultar domínio vivo nem regravar mensagem pronta. · feito quando: editar título/nome depois não altera o sentido histórico; versões conhecidas formatam; versão desconhecida degrada sem vazar payload.
- [ ] T3.4 — **SUPERSEDIDA para comentário por T2.6c; ativa só para evento externo.** A atomicidade de comentário/evento/recibo já é pré-condição da Fase 2 e não espera esta fase. Evento futuro vindo de outro módulo usa `event_id` idempotente e outbox no produtor. · feito quando: teste de T2.6c continua verde e primeiro produtor externo, se entrar nesta fase, prova outbox + consumidor idempotente.
- [ ] T3.5 — **[P1] Corrigir a semântica best-effort que existe hoje**, em vez de reproduzi-la na migração. Bug real confirmado: `moderation.ts:138-147` e `reports.ts:195` chamam `emitNotification` dentro de `try/catch` e apenas fazem `console.error` se falhar — o material é rejeitado, a notificação se perde, e o autor **nunca fica sabendo**. Correção autorizada pelo mantenedor (2026-07-27). · feito quando: falha ao notificar não deixa a operação de moderação concluída silenciosamente.
- [ ] T3.6 — **API de notificação completa** (requisito 19). A versão anterior listava três verbos sem contrato. Exigir: lista **paginada por cursor**, ordenação `(occurred_at, id)`, limite máximo; contagem de não lidas; marcar uma como lida; **marcar todas até um instante**; mutações idempotentes; **ownership sempre extraído da sessão**, nunca do parâmetro; **404 uniforme** para ID inexistente ou de outro usuário (senão a resposta revela que a notificação existe); cache **privado**, nunca compartilhado. · feito quando: marcar lida num módulo reflete nos outros, e ID de terceiro devolve 404 igual a ID inexistente.
- [ ] T3.7 — **Link de volta construído no servidor** (requisito 18). Repete a trava de T0.7: o app registra `canonical_path`, **nunca a URL inteira vinda do navegador**; a origem é derivada de `realm`+`source_app` allowlisted. E o módulo **revalida a autorização** quando o usuário abre o link — notificação não é passe de acesso. · feito quando: notificação de cada módulo leva ao lugar certo, e link para conteúdo que o usuário perdeu acesso não abre.
- [ ] T3.8 — **Privacidade do evento** (requisito 13). O evento não expõe título, motivo nem link de conteúdo privado a quem não tem acesso **atual** — o snapshot de T3.3 congela o texto, mas não pode virar vazamento de conteúdo restrito. · feito quando: usuário sem acesso ao conteúdo não lê o título dele pela notificação.
- [ ] T3.9 — **Central canônica no `accounts.`** (requisito 17, decisão do mantenedor, 2026-07-27). O frontend do `accounts.` hoje só trata `/`, `/login` e `/conta` (`main.tsx:294`) — a central não tem onde morar. Fica em `accounts.artificiorpg.com/conta/notificacoes`, **uma só**, e os módulos apontam para ela; evita três páginas divergindo. Componente reutilizável é opcional. **Sino global no `Header` é `packages/ui`** e exige aprovação nominal própria — se entrar, é task separada. · feito quando: a mesma central mostra eventos dos três módulos, e nenhum módulo tem cópia própria.
- [ ] T3.10 — **Atualização por polling curto, não tempo real** (requisito 17). Polling ao focar a página mais invalidação após mutação bastam; SSE ou WebSocket ampliaria infraestrutura sem requisito que peça. · feito quando: contagem de não lidas atualiza sem conexão persistente.
- [ ] T3.11 — **Canal in-app apenas** (requisito 20). E-mail e push ficam fora — a separação evento/recibo de T3.1 é justamente o que permite ligar um canal depois sem migrar dado. · feito quando: nenhum envio externo é disparado.

## Fase 4 — Pacote cliente e UI

- [ ] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T4.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T4.1 — **Pedir aprovação nominal** para criar `packages/comments` (pacote compartilhado consumido por 3 apps). · feito quando: aprovação registrada.
- [ ] T4.2 — **Transporte injetável, não chamada direta ao `accounts.`** (requisito 21). O pacote **não** pode embutir `fetch` do navegador para o `accounts.`: isso contradiz a decisão de escrita backend-to-backend (T0.5) e furaria a validação de assunto e ownership. O adapter cobre leitura/criação/resposta, edição, auto-retirada, voto, denúncia/retirada, recurso, moderação, notificações e leitura; cada fachada implementa só capacidades autorizadas do seu domínio. · feito quando: pacote funciona contra adapter de teste, sem conhecer origem real; nenhum fluxo novo introduz `fetch` cross-origin escondido.
- [ ] T4.3 — **Exports separados por responsabilidade** (requisito 21). `@artificio/comments` traz tipos, schemas e cliente; `@artificio/comments/react` traz hooks e componentes; `@artificio/comments/styles.css` traz o estilo mínimo. Sem isso, backend ou o Astro server-side do `site` seriam obrigados a importar React. · feito quando: um consumidor só de tipos não puxa React na árvore.
- [ ] T4.4 — **`react` e `react-dom` como `peerDependencies`** (requisito 21). Pacote visual novo declara peer, para o consumidor fornecer a própria cópia — duas instâncias de React quebram hooks. · feito quando: nenhum app acaba com React duplicado no bundle.
- [ ] T4.5 — **TanStack Query não é contrato obrigatório** (requisito 21). `downloads` e `mesas` usam React Query (`package.json:24` e `:23`), mas o **`site` não usa** — o núcleo do cliente é agnóstico de framework, e o adapter de React Query fica interno e opcional. · feito quando: o `site` consome o pacote sem instalar React Query.
- [ ] T4.6 — **Estado explícito, memória da tela e nenhum cache persistente** (requisito 22; decisão 51). Resposta distingue `fresh`, `stale` e `unavailable`; falha nunca vira lista vazia. Se atualização falhar depois de leitura boa, a tela ainda montada conserva o resultado como `stale`, com idade e aviso. Reload, nova página, logout ou troca de conta descartam; abertura durante queda mostra `unavailable` só na área de comentários. **Não criar IndexedDB, localStorage, Redis nem cache público/Cloudflare.** · feito quando: três estados distinguíveis; stale sobrevive à falha na mesma montagem, mas não ao reload/logout; página do app continua viva; escrita falha fechada.
- [ ] T4.7 — **Chave de cache inclui identidade; logout limpa** (requisito 22). Chave por `realm`, `source_app`, subject **e usuário quando o dado é privado**. Comentário de autoria privada e notificação são limpos no logout e na troca de conta; **notificação nunca entra em cache público**. Sem isso, a próxima conta na mesma máquina lê o cache da anterior. · feito quando: trocar de conta não mostra nada da conta anterior.
- [ ] T4.8 — **Timeout e cancelamento no cliente** (requisito 22). Seguir o padrão já aprendido em `packages/catalog-client/src/index.ts:35` (`CATALOG_FETCH_TIMEOUT_MS`, achado de review no PR #145: `fetch` sem timeout pendura a rota do backend consumidor). Hooks consomem `AbortSignal` e cancelam query obsoleta. · feito quando: requisição pendurada não trava a página, e navegar para longe cancela a busca.
- [ ] T4.9 — **Degradação testada contra resposta inválida, não só conexão recusada** (requisito 22). A página precisa sobreviver a timeout, 500, HTML inesperado no lugar de JSON, JSON malformado e schema incompatível — este último é a regra pétrea de normalização (`AGENTS.md`: payload externo é `unknown` até passar por normalizador tipado). · feito quando: os cinco casos mantêm a página do módulo de pé com aviso claro.
- [ ] T4.10 — **UI compartilhada da conversa completa** (requisito 21; decisões 3–7, 17, 24–30). Árvore até cinco níveis, `more`, seletor `Melhores`/`Mais votados`/`Recentes`/`Mais antigos` com `Melhores` padrão, score e voto ternário, `ContentEditor` para criar/editar, marcador de edição, auto-retirada, denúncia e resposta a legado. Imagem aparece somente como link HTTPS; links obedecem ao perfil do `content-editor`. Contrato visual usa tokens CSS, slots e `className`, sem Tailwind compilado no pacote. · feito quando: os três consumidores renderizam a mesma semântica com identidade própria; quatro sorts/voto/edição/denúncia são operáveis por teclado; nenhuma imagem remota é buscada.
- [ ] T4.11 — UI da central de notificações, consumindo a rota canônica do `accounts.` (T3.9). · feito quando: montável onde a central vive, sem cópia por módulo.
- [ ] T4.12 — Comentário legado visualmente distinguível, sem sugerir conta verificada (requisito 9). Rótulo neutro do tipo "comentário importado — autoria não verificada"; **sem avatar falso, sem badge de conta, sem link para perfil**. · feito quando: distinguível à primeira vista, e nada leva a um perfil que não existe.
- [ ] T4.13 — **Acessibilidade com critérios executáveis** (WCAG 2.2), não checklist genérico: thread em lista semântica; botão "Responder a [nome]" (não só "Responder"); labels reais nos campos; foco tratado após responder e enviar; envio, erro e "marcada como lida" anunciados com `role="status"` ou alerta adequado, **sem mover o foco**; estado lido não dependendo só de cor; data em `<time datetime>`; navegação completa por teclado. · feito quando: os oito verificados, com evidência.
- [ ] T4.14 — **Matriz de testes nos três ambientes reais**: Vite React (`downloads`, `mesas`) e **ilha React dentro do Astro** (`site`) — que é o caso capaz de quebrar por import não seguro em SSR. Mais: tema claro e escuro, cache por conta, timeout e schema inválido. · feito quando: a suíte cobre os três ambientes, não só um.
- [ ] T4.15 — Verificar as 10 Heurísticas de Nielsen na caixa de comentários e na central (`AGENTS.md` §Regras de Produto). Atenção a visibilidade de estado e prevenção de erro. · feito quando: checklist registrado.

### Superfície de moderação (requisito 27, decisão do mantenedor 2026-07-30)

O desenho anterior detalhou schema, transação e API, mas deixou o front com duas
linhas — cobrindo quem lê e escreve, não quem modera.
`POST /internal/v1/comments/:id/removal` existia sem tela que o chamasse.

- [ ] T4.16 — **Fila de moderação como superfície primária** (requisito 27a). Moderar navegando pelo conteúdo público não escala e depende do moderador topar com o problema. A fila lista denunciados, de conta nova (T4.20) e recentes, com filtro por `realm` e `source_app` — **beta nunca misturado com produção** (T0.6). · feito quando: a fila carrega, filtra pelos dois eixos, e nenhum item de beta aparece em produção.
- [ ] T4.17 — **Reusar `packages/ui/src/admin`, não criar padrão novo** (requisito 27b). Já existem `AdminTable` (com seleção e ação em lote), `bulkActions`, `StatusPill`, `PageHeader`, `SectionCard` e `AdminWorkspaceLayout`, em uso no painel de gestão do `downloads`. Divergir do design system exige aprovação (`AGENTS.md` §Regras de Produto). · feito quando: a fila usa os componentes existentes, sem componente admin novo salvo justificativa registrada.
- [ ] T4.18 — **Seguir o padrão de dados de `useModerationQueue`** (requisito 27c; `apps/downloads/frontend/src/hooks/useModerationQueue.ts`): React Query, validação Zod na fronteira, ação individual e em lote, `invalidateQueries` no sucesso. Padrão maduro (specs 075 e 083) — replicar, não reinventar. · feito quando: hook novo espelha a estrutura do existente, com payload validado por schema.
- [ ] T4.19 — **Restauração de comentário removido** (requisito 27d). O tombstone preserva o corpo, então desfazer é barato — faltava o caminho. A **DSA** exige janela de contestação de seis meses com reversão pronta de decisão injustificada; sem isso, erro de moderador é permanente. `POST /internal/v1/comments/:id/restore` limpa `removed_at`/`removed_by`/`removed_reason` e registra quem restaurou. · feito quando: remover e restaurar volta ao estado original, com as duas ações no histórico.
- [ ] T4.19b — **Exibir e validar o registro de ação criado na Fase 2** (requisito 27d). A migration coesa T2.1–T2.1f já cria auditoria de conteúdo; esta fase não abre segunda migration. UI mostra ator, alvo, motivo e momento para remoção/restauração e demais transições autorizadas. · feito quando: histórico mostra os quatro campos, exige papel global e não expõe nota interna ao público.
- [ ] T4.20 — **Conta nova tratada como conta nova** (requisito 27e). Hoje conta criada há dez segundos comenta como quem está há dois anos; com login Google a barreira é baixa e essa é a porta de entrada de spam. Forma **mínima**, derivada de dado existente (`users.created_at` + contagem de comentários do autor), **sem tabela nova**: conta nova entra na fila para revisão e tem limite mais apertado no rate limiter de escrita (requisito 12b). **Não é bloqueio de publicação** — é priorização de revisão. · feito quando: o critério está escrito, a fila destaca esses comentários, e nenhum autor legítimo é impedido de publicar.
- [ ] T4.21 — **Usabilidade da fila** (requisito 27g), 10 Heurísticas de Nielsen. Em especial: estado do sistema visível (quantos pendentes, o que já foi tratado); prevenção de erro com `ConfirmDialog` de `packages/ui` em ação destrutiva **e em lote**; reversibilidade como saída de emergência (T4.19). Ação em lote sem confirmação sobre conteúdo de usuário é o caso que a heurística 5 existe para impedir. · feito quando: checklist registrado, com confirmação verificada nos dois casos.
- [ ] T4.22 — **Acessibilidade da fila** (WCAG 2.2), mesmos critérios executáveis de T4.13: tabela com semântica real, seleção operável por teclado, resultado de ação anunciado por `role="status"` sem mover foco, estado não dependendo só de cor. · feito quando: os quatro verificados, com evidência.
- [ ] T4.23 — **Denunciar, acompanhar e retirar pelo pacote compartilhado** (decisões 33, 35, 37, 42, 49). Formulário vem do registro único de motivos, mostra detalhe como obrigatório/opcional/proibido e nunca cria enum local. Usuário vê somente as próprias denúncias e resultado mínimo; pode retirar antes do auto-hide. Identidades/notas internas nunca aparecem. · feito quando: mesma UI funciona nos consumidores sem pacote paralelo; detalhe obrigatório bloqueia envio vazio; retirada desaparece após o limiar; e nenhum payload privado chega ao autor denunciado.
- [ ] T4.24 — **Workspace de caso agregado** (decisões 39–46, 53). Um item por caso, com quantidade, categorias, prioridade máxima, versões denunciada/atual, diff, timeline, atores denunciantes e — somente durante retenção válida — contas resolvidas para moderação; depois mostra identidade expurgada sem tentativa de reconstrução. Veredito individual fica editável antes do fechamento. Ações `no_change`, `restore`, `remove`, aprovação/reabertura e auto-retirada usam confirmação e mostram 409 sem sobrescrever trabalho alheio. · feito quando: moderador decide denúncias mistas; segundo recebe conflito; timeline preserva eventos; ação em lote não apaga granularidade; e expurgo não quebra UI.
- [ ] T4.25 — **Recurso compartilhado** (decisão 47). Autor removido recebe caminho de recurso, prazo e status; moderador vê caso/decisão/versão, aviso se foi o decisor original e campo obrigatório de nova justificativa. Resultado é privado. · feito quando: autor envia um recurso válido; UI bloqueia segundo/prazo expirado; mesmo moderador consegue rejulgar com aviso; e nenhum app cria formulário próprio.
- [ ] T4.26 — **Sanções comunitárias compartilhadas** (decisão 48). Moderação escolhe `posting`, `commenting` ou ambos; `warning`, suspensão temporária/permanente; prazo e motivo. Tela mostra histórico/gravidade como apoio, nunca aplica progressão automática, e deixa claro que SSO/leitura continuam. · feito quando: decisão exige confirmação/auditoria; suspensão temporária mostra expiração; e UI não oferece objeto de domínio como “postagem” sem adapter explícito.

**Fora de escopo (requisito 27f, decisão do mantenedor):** shadow ban — esconder
conteúdo sem avisar o autor contradiz o compromisso de transparência e quebra a
confiança quando descoberto; e moderação automática por IA — custo e falso
positivo desproporcionais ao volume atual. Voltam como spec própria se o volume
mudar.

## Fase 5 — Adoção no `downloads`

Primeiro consumidor: necessidade imediata (spec 089) e dado menos delicado.

> **⚠️ ACHADO QUE MUDA O CUSTO DESTA FASE — não há legado a migrar (medido em 2026-08-04).**
>
> Toda a Fase 5 foi escrita como **migração de dado existente**: `pg_dump` dos dois
> bancos, rollout expand → backfill → catch-up → cutover, validação linha a linha,
> "os cinco `kind` atuais mapeados como legado", tabela local virando read-only por
> retenção. Medição read-only em produção e em beta mostra que **o conjunto de
> origem está vazio**:
>
> | Métrica | `downloads-db` (prod) | `downloads-beta-db` (beta) |
> |---|---|---|
> | `download_comment` | **0** | **0** |
> | `download_notification` | **0** | **0** |
> | `download_material` | 12 | 91 |
> | `download_rating` | 0 | — |
> | `download_favorite` | 0 | — |
> | `download_creator` | 1 | — |
>
> As tabelas **existem** com schema completo (`download_comment` tem
> `id`, `material_id`, `user_id`, `body`, `removed_at`, `removed_reason`,
> `created_at`, FK para `download_material`, e é referenciada por
> `download_report.comment_id`) — o que nunca aconteceu foi **uso**. Beta tem 91
> materiais e ainda assim zero comentários, então não é "ambiente novo e vazio":
> a superfície de comentário do `downloads` nunca foi exercitada por usuário real.
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
> **Decisão pendente do mantenedor — não decidida pelo agente.** Duas saídas:
> (a) simplificar as tasks de migração desta fase para o caso vazio, mantendo
> apenas uma verificação de guarda ("se a contagem não for zero no momento do
> cutover, parar e reavaliar"); ou (b) manter o texto atual como está e registrar
> este achado como débito. Enquanto não houver decisão registrada, **o texto das
> tasks abaixo permanece válido** — nenhuma foi reescrita a partir deste achado.
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

- [ ] T5.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T5.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T5.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T5.1 — **`pg_dump` dos DOIS bancos** antes do import: `downloads` (origem) **e** `accounts.` (destino). A versão anterior só previa a origem — mas o import escreve no destino, e é ele que precisa de rollback se algo entrar errado. Formato custom, para permitir restore seletivo. · feito quando: os dois dumps validados, com caminho registrado.
- [ ] T5.1b — **Importador one-shot pertencente ao `accounts.`** (requisito 23). SQL do `downloads` não pode escrever no banco do `accounts.` — a fronteira entre bancos é regra da spec. Fluxo: export read-only do `downloads`, importador do lado do `accounts.` (ou endpoint interno dedicado), inserts **idempotentes** (a chave `unique (legacy_source, legacy_id)` de T2.1 é o que garante rodar duas vezes sem duplicar). Migration local só marca cutover e estado. · feito quando: o importador roda duas vezes e o resultado é idêntico, sem o `downloads` tocar o banco central.
- [ ] T5.2 — **Rollout expand → backfill → catch-up → cutover** (requisito 24). Substitui "copiar antes de parar de ler", que perde tudo o que nascer entre a cópia e a troca. Sequência: (1) criar o destino; (2) habilitar dual-write **ou** congelar a escrita por janela curta; (3) registrar o *high-water mark*; (4) backfill idempotente; (5) catch-up do que passou do marco; (6) reconciliar; (7) trocar a leitura; (8) **manter a tabela local** para rollback pelo período definido. · feito quando: comentário criado durante a janela existe no destino, provado por teste.
- [ ] T5.2b — **Os cinco `kind` atuais mapeados como legado** (T0.11). O `downloads` emite `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed` e `system_suggestion_resolved` (`services/notify.ts:12` — a referência anterior dizia `:10`, corrigida em 2026-08-04 contra o código real) — preservar `download_notification` sem tratá-los seria impossível. **Decisão do mantenedor (2026-07-27):** entram como `legacy_downloads` com o **corpo já montado congelado**, legíveis para sempre, sem virar `kind` oficial do registro central; o `downloads` **continua** emitindo esses eventos na tabela local dele. Só comentário migra para o registro novo. · feito quando: os cinco legíveis no histórico, nenhum aparecendo como evento ativo do registro central. · **Medição de 2026-08-04:** os cinco `kind` existem no código, mas `download_notification` tem **0 linhas** em prod e em beta — não há corpo montado a congelar. O mapeamento de tipo permanece necessário como contrato; a migração de conteúdo é vazia. Ver bloco de achado no topo da fase.
- [ ] T5.2c — **Validação linha a linha, com definição** (requisito 24). "Item a item" sem critério não valida nada. Comparar: quantidade, IDs, hash dos campos normalizados, `created_at`, autoria, estado removido e lido, relações `parent` — e produzir **lista explícita de divergências**, não um "ok". · feito quando: o relatório sai vazio, ou cada divergência tem causa registrada.
- [ ] T5.3 — `routes/comments.ts` e `routes/notifications.ts` delegam ao `accounts.`, mantendo os paths atuais. **Preservar o payload e o status, não só o path:** comentários devolvem array com `id`, `material_id`, `user_id`, `body`, `created_at`; notificações devolvem `kind`, `material_id`, `body`, `read_at`, `created_at`; `POST`, `DELETE`, `PATCH` e os códigos atuais seguem iguais. **`verify:api` não prova compatibilidade semântica** — hoje não existe teste direto de `comments.ts` nem de `notifications.ts`, então escrever contract tests contra o comportamento antigo **antes** de trocar. · feito quando: os contract tests passam contra a fachada nova, e `rtk pnpm verify:api` verde.
- [ ] T5.3b — **[P1] Corrigir o limiter errado no `GET`** (bug real, autorizado pelo mantenedor 2026-07-27). `routes/notifications.ts:12` aplica `writeRateLimiter` num `GET` de leitura: quem só consulta o próprio feed consome cota de escrita e pode ser barrado sem ter escrito nada. · feito quando: leitura usa limiter de leitura, com teste.
- [ ] T5.3c — **Fachada com timeout e degradação por verbo** (requisito 22). `GET` pode servir cache stale ou resposta controlada; **`POST`, resposta, remoção e marcar-lida falham com erro explícito — nunca fingem sucesso**. Timeout curto, correlation ID, nenhuma espera indefinida, e retry automático **apenas** com chave de idempotência. · feito quando: escrita que falhou não aparece como salva para o usuário.
- [ ] T5.4 — UI de comentários no material, com identidade, papéis e threads. · feito quando: comentar, responder e ver autor funcionam na ficha.
- [ ] T5.5 — **Endpoint de caixa de entrada do autor, antes da UI.** A versão anterior pedia a tela sem a API que a sustenta: o `accounts.` **não conhece ownership de material**, então não sabe o que é "meus materiais". O backend do `downloads` resolve — lista os materiais do autor e busca comentários por subjects **em lote** (nunca um subject por vez), ou recebe eventos de comentário endereçados ao dono. Definir paginação, ordenação, não-lidos e autorização. · feito quando: o autor vê e responde comentários dos próprios materiais pelo painel, com uma consulta em lote.
- [ ] T5.6 — **Validar a rastreabilidade dos requisitos 18-22 e 32-35 da spec 089**, sem removê-los de lá. A versão anterior dizia que a 089 "não carrega mais tasks de comentário" — contradiz a própria 089, que mantém a Fase 6 marcada como **MOVIDA** justamente para o rastro não sumir (`089/tasks.md:213`). A referência fica; o que se valida é que ela aponta para cá e que ninguém executa aquelas tasks na 089. · feito quando: as duas specs concordam, com a 089 preservando a marcação de movida.
- [ ] T5.7 — **Tabela local vira read-only, não é apagada nesta fase.** Retenção até o rollback e a reconciliação estarem concluídos. Exclusão é ação posterior, nominal e com backup próprio. · feito quando: `download_comment` e `download_notification` param de receber escrita e continuam legíveis. · **Medição de 2026-08-04:** ambas com **0 linhas** em prod e beta — a retenção protege conjunto vazio. A task não perde sentido (a trava contra escrita continua valendo, e é ela que impede divergência pós-cutover), mas o argumento de "reter até a reconciliação concluir" não se aplica a dado que não existe. Ver bloco de achado no topo da fase.

## Fase 6 — Adoção no `site`

Segundo consumidor: tem o dado legado, que é o risco real desta spec.

- [ ] T6.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T6.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T6.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T6.1 — **`pg_dump` dos DOIS bancos** — `site` (origem) e `accounts.` (destino) —, com checksum e **comando de restauração testado**, não só gerado. Dump seletivo de tabela pode não carregar as dependências necessárias para restaurar isoladamente; validar isso antes de confiar nele como rollback. · feito quando: os dois dumps validados por restauração real de teste, com caminho registrado.
- [ ] T6.2 — **Export read-only aqui, importador do lado do `accounts.`** (requisitos 9, 23, 25). A versão anterior mandava a migration do `site` migrar "para o `accounts.`" — mesmo erro corrigido na Fase 5: migration do banco do `site` **não escreve** no banco do `accounts.` Fluxo: export read-only no `site`; importador one-shot pertencente ao `accounts.`, idempotente por `(legacy_source, legacy_id)`; relatório de reconciliação. Migrar com `user_id` nulo e `legacy_author_name` preservado. · feito quando: o importador roda duas vezes com resultado idêntico, e o `site` não toca o banco central.
- [ ] T6.3 — **Quantidade medida, não "25"** (requisito 25). O número veio de uma contagem em beta e virou constante na spec — mas o aceite precisa comparar contra `N_source` **medido por `realm` e por ambiente** no momento da migração, senão valida contra um número que já mudou. (A nota anterior atribuía essa confirmação à T0.4, que trata de casamento de identidades, não de contagem — a medição é aqui.) · feito quando: `N_source` medido e registrado antes do import, e o aceite compara contra ele.
- [ ] T6.4 — **Arquitetura de runtime do comentário no `site`** (requisito 25). A versão anterior dizia só "adotar o pacote", sem dizer onde ele roda — e o blog é **SSG** (`astro.config.mjs:7`), com os posts gerados por `getStaticPaths` (`pages/blog/[slug].astro:7`); o servidor só consulta comentários para um contador administrativo (`server/server.ts:116`). Definir: fachada Express **same-origin**; validação de post publicado; `subject_id = String(post.id)`; `canonical_path = /blog/${slug}/`; **ilha React abaixo do artigo, `client:visible`** (adia o JavaScript até entrar no viewport, sem hidratar a página toda); lista degradável e escrita SSO backend-to-backend. · feito quando: a página estática continua estática e a ilha carrega só quando visível.
- [ ] T6.5 — Adotar o pacote para comentário novo, mantendo o legado **imutável, mas respondível** (decisão 23). · feito quando: comentário novo exige SSO; legado não edita nem vota; resposta nova autenticada ao legado funciona e preserva a árvore.
- [ ] T6.6 — **Reconciliação com critério, não contagem e amostra** (requisito 24b). Preflight de órfãos e ciclos (`site.comments.parent_id` não tem FK — `001_init.sql:66`), quantidade, IDs, hashes normalizados, `created_at`, nomes, relações parentais, e **lista explícita de divergências**. · feito quando: relatório vazio, ou cada divergência com causa registrada.
- [ ] T6.7 — **[P1] Garantir que os testes novos de fato rodam.** `apps/site/package.json:16` enumera **cinco arquivos fixos** no script de teste: arquivo novo fica invisível se o script não mudar. E `site.lint` é `echo "(site) lint TODO"` (`:15`) — não valida nada. Sem corrigir, a fase pode fechar verde sem ter executado um teste sequer da fachada. · feito quando: os testes desta fase aparecem no script executado, e o lint do `site` deixa de ser no-op ou a limitação fica registrada com decisão do mantenedor.

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
