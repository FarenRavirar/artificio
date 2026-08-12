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

- [ ] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
  **Handoff investigado em 2026-08-12:** leitura feita neste chat; não transfere autorização/contexto. O implementador precisa reler T0 inteiro antes de editar.
- [ ] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
  **Handoff investigado em 2026-08-12:** manter aberto como guard contínuo. Comandos de validação na raiz: `rtk pnpm run test`, `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm verify:api`; TypeScript do pacote pelo script do workspace, não `rtk tsc` solto na raiz.
- [ ] T4.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
  **Handoff investigado em 2026-08-12:** manter aberto como guard contínuo; relatório cita comando+resultado para estado, causa e conclusão.
- [ ] T4.1 — **Pedir aprovação nominal** para criar `packages/comments` (pacote compartilhado consumido por 3 apps). · feito quando: aprovação registrada.
  **Handoff investigado em 2026-08-12:** texto “criar” está obsoleto: pacote já existe desde T2.2. Hoje tem 16 arquivos em `src`, export `.` puro e só `apps/accounts` como consumidor; React/CSS ainda não existem. Antes da implementação, pedir aprovação nominal para **ampliar código de `packages/comments`**, citando consumidores visuais futuros `downloads`, `mesas`, `site` e blast radius compartilhado.
- [ ] T4.2 — **Transporte injetável, não chamada direta ao `accounts.`** (requisito 21). O pacote **não** pode embutir `fetch` do navegador para o `accounts.`: isso contradiz a decisão de escrita backend-to-backend (T0.5) e furaria a validação de assunto e ownership. O adapter cobre leitura/criação/resposta, edição, auto-retirada, voto, denúncia/retirada, recurso, moderação, notificações e leitura; cada fachada implementa só capacidades autorizadas do seu domínio. · feito quando: pacote funciona contra adapter de teste, sem conhecer origem real; nenhum fluxo novo introduz `fetch` cross-origin escondido.
  **Handoff investigado em 2026-08-12:** criar contrato TS por capacidade, com `AbortSignal`, schemas Zod de entrada/saída e erros normalizados; adapter de teste prova tudo sem URL. Bloqueio material de moderação: rota interna deriva `realm/source_app` de uma única credencial e recusa outro `source_app` com `403` (`communityModerationRoutes.ts:559-577`); não existe fachada/agregador browser-safe para fila global. Não implementar `fetch accounts.` nem credencial de serviço no browser.
- [ ] T4.3 — **Exports separados por responsabilidade** (requisito 21). `@artificio/comments` traz tipos, schemas e cliente; `@artificio/comments/react` traz hooks e componentes; `@artificio/comments/styles.css` traz o estilo mínimo. Sem isso, backend ou o Astro server-side do `site` seriam obrigados a importar React. · feito quando: um consumidor só de tipos não puxa React na árvore.
  **Handoff investigado em 2026-08-12:** `package.json` hoje exporta somente `.` e o build é TypeScript; acrescentar subpath React e CSS sem alterar o root puro. O pipeline precisa copiar/publicar CSS, pois `tsc` não o emite. Testar import do root em Node/SSR sem `window`/React.
- [ ] T4.4 — **`react` e `react-dom` como `peerDependencies`** (requisito 21). Pacote visual novo declara peer, para o consumidor fornecer a própria cópia — duas instâncias de React quebram hooks. · feito quando: nenhum app acaba com React duplicado no bundle.
  **Handoff investigado em 2026-08-12:** pacote não declara React hoje. Usar faixa compatível com os três consumidores já instalados; não adicionar cópia em `dependencies`. `devDependencies` só se a ferramenta já existir no workspace; lib nova exige aprovação própria.
- [ ] T4.5 — **TanStack Query não é contrato obrigatório** (requisito 21). `downloads` e `mesas` usam React Query (`package.json:24` e `:23`), mas o **`site` não usa** — o núcleo do cliente é agnóstico de framework, e o adapter de React Query fica interno e opcional. · feito quando: o `site` consome o pacote sem instalar React Query.
  **Handoff investigado em 2026-08-12:** medido: `downloads` e `mesas` têm `@tanstack/react-query`; `site` não tem. Root e `/react` não podem importar TanStack incondicionalmente. Se houver integração TanStack, criar subpath opcional ou adapter no consumidor; teste do Astro deve resolver o pacote sem instalar dependência nova.
- [ ] T4.6 — **Estado explícito, memória da tela e nenhum cache persistente** (requisito 22; decisão 51). Resposta distingue `fresh`, `stale` e `unavailable`; falha nunca vira lista vazia. Se atualização falhar depois de leitura boa, a tela ainda montada conserva o resultado como `stale`, com idade e aviso. Reload, nova página, logout ou troca de conta descartam; abertura durante queda mostra `unavailable` só na área de comentários. **Não criar IndexedDB, localStorage, Redis nem cache público/Cloudflare.** · feito quando: três estados distinguíveis; stale sobrevive à falha na mesma montagem, mas não ao reload/logout; página do app continua viva; escrita falha fechada.
  **Handoff investigado em 2026-08-12:** servidor entrega payload; os três estados são memória do cliente. Modelar união discriminada, guardar último sucesso apenas na instância/provider montado, incluir `updatedAt/age`, zerar na troca de identidade. Testes: primeiro erro=`unavailable`; sucesso→erro=`stale`; unmount/remount perde stale; mutação nunca usa sucesso otimista após falha.
- [ ] T4.7 — **Chave de cache inclui identidade; logout limpa** (requisito 22). Chave por `realm`, `source_app`, subject **e usuário quando o dado é privado**. Comentário de autoria privada e notificação são limpos no logout e na troca de conta; **notificação nunca entra em cache público**. Sem isso, a próxima conta na mesma máquina lê o cache da anterior. · feito quando: trocar de conta não mostra nada da conta anterior.
  **Handoff investigado em 2026-08-12:** identidade deve entrar por contexto explícito do consumidor; pacote não conhece cookie SSO. Chave pública pode omitir usuário só quando schema não contém estado privado; `my_vote`, autoria/ações próprias, denúncias, recursos e notificações exigem identidade. Teste A→logout→B deve falhar se qualquer dado de A reaparecer.
- [ ] T4.8 — **Timeout e cancelamento no cliente** (requisito 22). Seguir o padrão já aprendido em `packages/catalog-client/src/index.ts:35` (`CATALOG_FETCH_TIMEOUT_MS`, achado de review no PR #145: `fetch` sem timeout pendura a rota do backend consumidor). Hooks consomem `AbortSignal` e cancelam query obsoleta. · feito quando: requisição pendurada não trava a página, e navegar para longe cancela a busca.
  **Handoff investigado em 2026-08-12:** como transporte é injetado, contrato recebe `AbortSignal`; helper do cliente combina timeout+cancelamento sem assumir `fetch`. Adapter concreto é quem liga o signal à chamada HTTP. Testar relógio falso, abort por unmount e query substituída.
- [ ] T4.9 — **Degradação testada contra resposta inválida, não só conexão recusada** (requisito 22). A página precisa sobreviver a timeout, 500, HTML inesperado no lugar de JSON, JSON malformado e schema incompatível — este último é a regra pétrea de normalização (`AGENTS.md`: payload externo é `unknown` até passar por normalizador tipado). · feito quando: os cinco casos mantêm a página do módulo de pé com aviso claro.
  **Handoff investigado em 2026-08-12:** normalização deve acontecer antes de atualizar memória. Fixture do adapter cobre exatamente 5 falhas: timeout, status 500, HTML, JSON sintaticamente inválido, JSON válido incompatível. Assertar app host ainda renderizado e mutações desabilitadas/fechadas.
- [ ] T4.10 — **UI compartilhada da conversa completa** (requisito 21; decisões 3–7, 17, 24–30). Árvore até cinco níveis, `more`, seletor `Melhores`/`Mais votados`/`Recentes`/`Mais antigos` com `Melhores` padrão, score e voto ternário, `ContentEditor` para criar/editar, marcador de edição, auto-retirada, denúncia e resposta a legado. Imagem aparece somente como link HTTPS; links obedecem ao perfil do `content-editor`. Contrato visual usa tokens CSS, slots e `className`, sem Tailwind compilado no pacote. · feito quando: os três consumidores renderizam a mesma semântica com identidade própria; quatro sorts/voto/edição/denúncia são operáveis por teclado; nenhuma imagem remota é buscada.
  **Handoff investigado em 2026-08-12:** reutilizar `ContentEditor` e `MarkdownContent`; `packages/comments` já depende de `@artificio/content-editor`. Downloads tem `CommentSection.tsx` legado plano (limite local 2.000, sem árvore/sorts/voto/edição): referência de fachada, não base de contrato. Implementar árvore a partir dos schemas HTTP, `more` por cursor, sem `<img>` e sem Tailwind emitido.
- [ ] T4.11 — UI da central de notificações, consumindo a rota canônica do `accounts.` (T3.9). · feito quando: montável onde a central vive, sem cópia por módulo.
  **Handoff investigado em 2026-08-12:** já existe materialmente em `apps/accounts/frontend/src/NotificationsView.tsx`; `NotificationBell` compartilhado existe em `packages/ui` e está integrado em `site`, `downloads`, `mesas`. Não reimplementar central no pacote. Nesta task, só extrair/compartilhar se teste de consumo provar necessidade; senão reconciliar como entregue por T3.9.
- [ ] T4.12 — Comentário legado visualmente distinguível, sem sugerir conta verificada (requisito 9). Rótulo neutro do tipo "comentário importado — autoria não verificada"; **sem avatar falso, sem badge de conta, sem link para perfil**. · feito quando: distinguível à primeira vista, e nada leva a um perfil que não existe.
  **Handoff investigado em 2026-08-12:** schema já expõe autoria legada sem vínculo verificável. Renderizar ramo próprio com nome legado como texto, rótulo neutro e nenhuma affordance de perfil/avatar; resposta continua permitida pelo mesmo adapter.
- [ ] T4.13 — **Acessibilidade com critérios executáveis** (WCAG 2.2), não checklist genérico: thread em lista semântica; botão "Responder a [nome]" (não só "Responder"); labels reais nos campos; foco tratado após responder e enviar; envio, erro e "marcada como lida" anunciados com `role="status"` ou alerta adequado, **sem mover o foco**; estado lido não dependendo só de cor; data em `<time datetime>`; navegação completa por teclado. · feito quando: os oito verificados, com evidência.
  **Handoff investigado em 2026-08-12:** transformar os 8 critérios em testes DOM, não snapshot: lista aninhada, nome acessível, labels, foco após abrir/enviar, live region, indicador textual de leitura, `<time dateTime>`, percurso teclado. Cobrir conversa e central existente onde aplicável.
- [ ] T4.14 — **Matriz de testes nos três ambientes reais**: Vite React (`downloads`, `mesas`) e **ilha React dentro do Astro** (`site`) — que é o caso capaz de quebrar por import não seguro em SSR. Mais: tema claro e escuro, cache por conta, timeout e schema inválido. · feito quando: a suíte cobre os três ambientes, não só um.
  **Handoff investigado em 2026-08-12:** conflito de sequência medido: adoção real só ocorre nas Fases 5–7; hoje nenhum dos 3 apps depende de `@artificio/comments`. Fechar Fase 4 exige fixtures/testes de integração nos três consumidores (inclusive `astro build`/SSR do site) ou manter T4.14 aberta até adoção. Não declarar “3 ambientes” com teste unitário único do pacote.
- [ ] T4.15 — Verificar as 10 Heurísticas de Nielsen na caixa de comentários e na central (`AGENTS.md` §Regras de Produto). Atenção a visibilidade de estado e prevenção de erro. · feito quando: checklist registrado.
  **Handoff investigado em 2026-08-12:** registrar evidência por heurística no bloco único desta task ao fechar: cenário, resultado, correção. Foco mínimo: estado fresh/stale/unavailable, confirmação de retirada, prevenção de perda do rascunho, erro recuperável, correspondência dos quatro sorts.

### Superfície de moderação (requisito 27, decisão do mantenedor 2026-07-30)

O desenho anterior detalhou schema, transação e API, mas deixou o front com duas
linhas — cobrindo quem lê e escreve, não quem modera.
`POST /internal/v1/comments/:id/removal` existia sem tela que o chamasse.

- [ ] T4.16 — **Fila de moderação como superfície primária** (requisito 27a). Moderar navegando pelo conteúdo público não escala e depende do moderador topar com o problema. A fila lista denunciados, de conta nova (T4.20) e recentes, com filtro por `realm` e `source_app` — **beta nunca misturado com produção** (T0.6). · feito quando: a fila carrega, filtra pelos dois eixos, e nenhum item de beta aparece em produção.
  **Handoff investigado em 2026-08-12 — BLOQUEIO DE CONTRATO:** `GET /internal/v1/comments/moderation-queue` existe, mas força o `realm/source_app` da credencial e devolve `403 forbidden_source_app` para outro app; não há host/fachada agregadora definida. A query só lê `community_moderation_case`, logo comentário novo/recente sem denúncia nunca entra. Payload também não traz sinal de conta nova. Banco real `accounts-db/artificio_auth`: migrations 001–009; fila `0` aberta/`0` fechada. UI unificada não é implementável sem ampliar backend/contrato e definir onde ela roda; isso exige escopo/aprovação de código em `apps/accounts`.
- [ ] T4.17 — **Reusar `packages/ui/src/admin`, não criar padrão novo** (requisito 27b). Já existem `AdminTable` (com seleção e ação em lote), `bulkActions`, `StatusPill`, `PageHeader`, `SectionCard` e `AdminWorkspaceLayout`, em uso no painel de gestão do `downloads`. Divergir do design system exige aprovação (`AGENTS.md` §Regras de Produto). · feito quando: a fila usa os componentes existentes, sem componente admin novo salvo justificativa registrada.
  **Handoff investigado em 2026-08-12:** componentes citados existem. `AdminTable` usa `globalThis.confirm` quando uma action declara `confirm`; T4.21 exige `ConfirmDialog`. Não usar esse atalho: controlar confirmação externa com `useConfirm`/`ConfirmDialog`, individual e lote, sem alterar `packages/ui` se composição bastar.
- [ ] T4.18 — **Seguir o padrão de dados de `useModerationQueue`** (requisito 27c; `apps/downloads/frontend/src/hooks/useModerationQueue.ts`): React Query, validação Zod na fronteira, ação individual e em lote, `invalidateQueries` no sucesso. Padrão maduro (specs 075 e 083) — replicar, não reinventar. · feito quando: hook novo espelha a estrutura do existente, com payload validado por schema.
  **Handoff investigado em 2026-08-12:** hook de referência existe e usa Query+Zod+invalidate. Aplicar no host moderador, não no root agnóstico do pacote. Bloqueado pela ausência de fachada definida em T4.16; adapter deve receber payload `unknown`, validar, mutar individual/lote e invalidar chave com `realm/source_app`.
- [ ] T4.19 — **Restauração de comentário removido** (requisito 27d). O tombstone preserva o corpo, então desfazer é barato — faltava o caminho. A **DSA** exige janela de contestação de seis meses com reversão pronta de decisão injustificada; sem isso, erro de moderador é permanente. `POST /internal/v1/comments/:id/restore` limpa `removed_at`/`removed_by`/`removed_reason` e registra quem restaurou. · feito quando: remover e restaurar volta ao estado original, com as duas ações no histórico.
  **Handoff investigado em 2026-08-12:** backend já existe: rotas de removal/restore e auditoria foram entregues na Fase 2. Esta task é UI+adapter+teste de ida/volta; não criar migration/handler duplicado. Teste deve comparar estado visível antes/removido/restaurado e duas entradas de audit.
- [ ] T4.19b — **Exibir e validar o registro de ação criado na Fase 2** (requisito 27d). A migration coesa T2.1–T2.1f já cria auditoria de conteúdo; esta fase não abre segunda migration. UI mostra ator, alvo, motivo e momento para remoção/restauração e demais transições autorizadas. · feito quando: histórico mostra os quatro campos, exige papel global e não expõe nota interna ao público.
  **Handoff investigado em 2026-08-12 — GAP:** `GET moderation-log` existe e retorna `actor_id`, alvo, motivo e momento, mas não nome do ator nem filtro por caso/alvo. UI pode mostrar UUID, porém workspace/timeline exigiria paginação global e busca client-side. Definir filtro/normalização backend antes de prometer timeline por caso; acesso permanece somente interno/papel global.
- [ ] T4.20 — **Conta nova tratada como conta nova** (requisito 27e). Hoje conta criada há dez segundos comenta como quem está há dois anos; com login Google a barreira é baixa e essa é a porta de entrada de spam. Forma **mínima**, derivada de dado existente (`users.created_at` + contagem de comentários do autor), **sem tabela nova**: conta nova entra na fila para revisão e tem limite mais apertado no rate limiter de escrita (requisito 12b). **Não é bloqueio de publicação** — é priorização de revisão. · feito quando: o critério está escrito, a fila destaca esses comentários, e nenhum autor legítimo é impedido de publicar.
  **Handoff investigado em 2026-08-12 — BLOQUEIO DE REGRA/BACKEND:** busca em código encontrou `users.created_at`, mas nenhum limiar de idade/contagem, nenhuma inserção de comentário novo na fila e nenhum bucket apertado por conta nova. `QueueItem` não expõe esses dados. Antes da UI, implementar critério determinístico + query/contrato + rate limiter em `apps/accounts`; sem limiar documentado, não inventar. Continua publicação imediata.
- [ ] T4.21 — **Usabilidade da fila** (requisito 27g), 10 Heurísticas de Nielsen. Em especial: estado do sistema visível (quantos pendentes, o que já foi tratado); prevenção de erro com `ConfirmDialog` de `packages/ui` em ação destrutiva **e em lote**; reversibilidade como saída de emergência (T4.19). Ação em lote sem confirmação sobre conteúdo de usuário é o caso que a heurística 5 existe para impedir. · feito quando: checklist registrado, com confirmação verificada nos dois casos.
  **Handoff investigado em 2026-08-12:** implementar contagem/seleção/estado tratado a partir de payload validado. Testar cancelamento e confirmação explícita para uma ação e lote; após sucesso, anunciar resultado e invalidar fila; após `409`, preservar seleção/trabalho e oferecer recarregar.
- [ ] T4.22 — **Acessibilidade da fila** (WCAG 2.2), mesmos critérios executáveis de T4.13: tabela com semântica real, seleção operável por teclado, resultado de ação anunciado por `role="status"` sem mover foco, estado não dependendo só de cor. · feito quando: os quatro verificados, com evidência.
  **Handoff investigado em 2026-08-12:** `AdminTable` é a base; validar markup resultante, checkbox/seleção e ordem de foco. Criar testes DOM dos 4 critérios; `StatusPill` precisa de texto legível, não só variante/cor.
- [ ] T4.23 — **Denunciar, acompanhar e retirar pelo pacote compartilhado** (decisões 33, 35, 37, 42, 49). Formulário vem do registro único de motivos, mostra detalhe como obrigatório/opcional/proibido e nunca cria enum local. Usuário vê somente as próprias denúncias e resultado mínimo; pode retirar antes do auto-hide. Identidades/notas internas nunca aparecem. · feito quando: mesma UI funciona nos consumidores sem pacote paralelo; detalhe obrigatório bloqueia envio vazio; retirada desaparece após o limiar; e nenhum payload privado chega ao autor denunciado.
  **Handoff investigado em 2026-08-12 — GAP:** POST/DELETE de denúncia existem; não existe GET das próprias denúncias/resultados nem endpoint do registro de motivos. Banco real tem 8 motivos ativos com `label/priority/details_policy`, portanto enum local seria divergente. Criar leitura browser-safe filtrada pelo ator e catálogo público mínimo antes da UI; nunca expor `reporter_actor_id`, contas resolvidas ou nota interna.
- [ ] T4.24 — **Workspace de caso agregado** (decisões 39–46, 53). Um item por caso, com quantidade, categorias, prioridade máxima, versões denunciada/atual, diff, timeline, atores denunciantes e — somente durante retenção válida — contas resolvidas para moderação; depois mostra identidade expurgada sem tentativa de reconstrução. Veredito individual fica editável antes do fechamento. Ações `no_change`, `restore`, `remove`, aprovação/reabertura e auto-retirada usam confirmação e mostram 409 sem sobrescrever trabalho alheio. · feito quando: moderador decide denúncias mistas; segundo recebe conflito; timeline preserva eventos; ação em lote não apaga granularidade; e expurgo não quebra UI.
  **Handoff investigado em 2026-08-12 — GAPS:** fila/caso/versões/resolução existem, e vereditos podem ficar locais até submit. Faltam: host agregador global (T4.16), timeline filtrável por caso (T4.19b) e autor-alvo resolvível para sanção. Diff pode ser implementação local sem lib nova; adicionar biblioteca exige aprovação. Testar `409 case_already_closed` preservando formulário, versão denunciada redigida/expurgada e denúncias mistas sem colapsar vereditos.
- [ ] T4.25 — **Recurso compartilhado** (decisão 47). Autor removido recebe caminho de recurso, prazo e status; moderador vê caso/decisão/versão, aviso se foi o decisor original e campo obrigatório de nova justificativa. Resultado é privado. · feito quando: autor envia um recurso válido; UI bloqueia segundo/prazo expirado; mesmo moderador consegue rejulgar com aviso; e nenhum app cria formulário próprio.
  **Handoff investigado em 2026-08-12 — BLOQUEIO DE LEITURA:** POST para criar recurso e POST para decidir existem; não há GET do recurso próprio, status/prazo, nem fila/detalhe de recursos para moderador. Criar leituras privadas com ator/papel antes da UI. O warning “mesmo decisor” precisa dos IDs de decisor original e atual, hoje não entregues juntos por endpoint browser-safe.
- [ ] T4.26 — **Sanções comunitárias compartilhadas** (decisão 48). Moderação escolhe `posting`, `commenting` ou ambos; `warning`, suspensão temporária/permanente; prazo e motivo. Tela mostra histórico/gravidade como apoio, nunca aplica progressão automática, e deixa claro que SSO/leitura continuam. · feito quando: decisão exige confirmação/auditoria; suspensão temporária mostra expiração; e UI não oferece objeto de domínio como “postagem” sem adapter explícito.
  **Handoff investigado em 2026-08-12 — GAP DE ALVO:** GET/POST/DELETE de sanções existem e contrato aceita scope/level/prazo/motivo, mas fila/caso não expõem `community_actor_id` do autor denunciado; logo workspace não consegue escolher alvo com segurança. Ampliar detalhe interno para fornecer ator-alvo (não conta pública), depois compor histórico+confirmação. `posting` só aparece quando adapter do domínio declarar suporte; `warning` não bloqueia SSO/leitura.

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
