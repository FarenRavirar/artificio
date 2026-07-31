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

Nenhuma linha antes de fechar o contrato. Os três consumidores têm modelos diferentes de papel
e autoria; descobrir isso durante a implementação é retrabalho garantido — e aqui o erro sai
caro, porque o alvo é o SSO.

> **Sete decisões fechadas pelo mantenedor na 1ª revisão do Codex (2026-07-27).** Estavam
> implícitas ou ausentes e bloqueavam a Fase 1. Cada uma está escrita na task que a executa:
> **trust boundary** (T0.5), **realm/source_app** (T0.6), **capacidades do `moderator`** (T0.1),
> **formato do corpo** (T0.9), **notificações legadas** (T0.11), **estratégia de migration**
> (T0.12), **URL canônica construída, não recebida** (T0.7).

**Decisão de segurança que atravessa a spec inteira: escrita é backend-to-backend.** O frontend
**nunca** escreve direto no `accounts.` O backend do módulo valida que o objeto existe, está
visível, aceita comentário e quem é o dono — só então chama o `accounts.` com credencial própria
por app. `owner_user_id`, papel e URL vindos do cliente **nunca** são confiados; ownership é
recalculado a partir de dado confiável, e cada objeto é autorizado a cada request (OWASP
Authorization). Referência opaca **não substitui** autorização por objeto: sem essa validação, o
atacante inventa dono, badge, destino e assunto inexistente.

Isso também resolve um bloqueio real: `app.ts:87` restringe o CSRF a cinco origens
(`BRAND_ORIGIN`, `links.`, `mesas.`, `glossario.`, `accounts.`), **excluindo `downloads` e todos
os betas**, enquanto o CORS aceita qualquer `*.artificiorpg.com` (`:97`). Escrita direta do
frontend do `downloads` falharia hoje. Server-to-server não passa por origem de navegador.

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
- [x] T0.8 — **Profundidade de thread: adjacency list, três níveis visíveis** (requisito 8). Raiz `depth=0`, resposta `1`, resposta à resposta `2`; `depth>2` rejeitado na escrita. Volume pequeno não justifica closure table nem materialized path; travessia por CTE recursiva basta no Postgres. Guardar `parent_id`, `depth` e, opcionalmente, `root_id`. · feito quando: limite e estrutura registrados, com a validação de mesmo assunto e mesmo realm feita na transação.
- [x] T0.9 — **Corpo do comentário novo é texto puro** (decisão do mantenedor, 2026-07-27). O `downloads` já opera assim (`routes/comments.ts:11`, até 2.000 caracteres) e o React escapa texto sozinho — HTML em comentário novo criaria superfície de XSS que hoje não existe. HTML sanitizado fica **só** para o `content_html` legado do `site`. Campo nunca ambíguo: `body_text` para o novo, campo próprio para o legado. · feito quando: contrato do corpo escrito, com o limite de tamanho e a separação novo/legado explícitos.
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
- [ ] T1.9 — **Smoke de SSO em todos os consumidores** (T0.3): login, `/me`, logout. Obrigatório — `accounts.` e `packages/auth` foram tocados. **Bloqueada pelo mesmo motivo de T1.13: exige ambiente no ar.** O smoke automático de `_deploy-module.yml` roda as `critical_routes` do manifesto contra o host real, e o `accounts` ganhou nesta fase a rota `admin_roles_no_cookie` (`/admin/roles/users` esperando 401) — a superfície nova que concede papel global sobre todos os projetos e que nenhuma rota crítica cobria. Não pode ser fechada localmente. · feito quando: todos verdes, com evidência.
- [x] T1.10 — **Remoção do papel global local dos apps.** Reescrito pela decisão de T1.5: sem migração e sem fallback (T1.6), some a exigência de "período observável de leitura dupla" e de "usuários conflitantes resolvidos" — não há conflito a resolver. Permanecem: teste **por capacidade** (não por nome de papel), provando que quem podia moderar continua podendo; refresh reidratado do banco (T1.2); rollback ensaiado. Papel de **domínio** (`download_creator.role` na parte que não é global, mestre, autor) **fica onde está** — só o global sai. · feito quando: as três cumpridas, e nenhum app decide papel global por conta própria.

**Estado da Fase 1 em 2026-07-31 — código completo, deploy bloqueado.** T1.1–T1.8
e T1.10 fechadas e verificadas contra o código, não contra a documentação. T1.9 e
T1.13 seguem abertas: as duas exigem ambiente no ar, e nenhuma prova estática as
substitui.

Fechado nesta passada, além do que já vinha da branch anterior:

- **Comparação de `SERVICE_SECRET` em tempo constante nos dois pontos.**
  `adminSecretsRoutes.ts` usava `===` enquanto `app.ts` usava `timingSafeEqual`
  para a **mesma** credencial — e a versão fraca era justamente a que guarda a
  chave de cifra dos segredos. A função virou `src/serviceToken.ts`, usada pelos
  dois, com `isValidServiceToken` recusando segredo ausente (antes, ambiente sem
  `SERVICE_SECRET` dependia de curto-circuito para não autenticar).
- **`authMiddleware` do `glossario` ganhou teste** (10 casos): era o único ponto
  onde `is_global_admin`/`is_global_moderator` nasciam sem cobertura, e onde vive
  o 503 fail-closed da T1.7. O teste também trava a distinção que a T0.1 exige —
  `moderator` global **não** abre rota administrativa.
- **403 do painel deixou de ser erro genérico.** O 403 desta tela nunca é sobre a
  conta alvo: o backend revalida o ator a cada requisição, então ele só aparece
  quando quem opera perdeu o papel durante a sessão. Antes caía num alerta comum
  e o admin rebaixado seguia clicando numa lista que já não podia alterar.
- **`shutdownWithError` saiu do `index.ts` para `src/shutdown.ts`** e ganhou
  teste: dentro do módulo de boot (top-level await) só seria exercitado subindo o
  servidor. O caso que importa é o pool falhar ao fechar sem impedir o exit code
  1 — sem ele, o container fica saudável para o orquestrador com o SSO morto.
- **Smoke do `accounts` cobre a rota nova.** `critical_routes` ganhou
  `admin_roles_no_cookie` (401 em `/admin/roles/users`). Era a superfície mais
  perigosa da fase sem nenhuma rota crítica declarada.
- **Seções obsoletas da spec corrigidas.** `spec.md` §Casamento de identidade
  ainda descrevia migração de papéis, `unmatched`, `excluded_realm` e relatório de
  promoções — tudo eliminado pela decisão de 2026-07-30, mas ainda escrito como se
  fosse o plano. Ficção documental num arquivo que o próximo agente lê como
  contrato.

Validação: repo 38/38 pacotes de teste sem cache (`--force`, 0 cached), lint
24/24, build 24/24, `verify:api` 0 breaking, guard de migrations 47/47. `accounts`
63/63, `glossario` 46/46.

**Duas falhas intermitentes observadas e descartadas:** `mesas-frontend` e
`glossario-backend` falharam uma vez cada na suíte completa com cache, e nenhuma
reproduziu — isoladas, via turbo `--force`, nem na rodada completa sem cache.
Flake de paralelismo, não regressão. Registrado aqui porque "rodou verde na
segunda vez" sem dizer que falhou na primeira é o tipo de omissão que esconde
regressão real.

### Alarme de drift do `accounts.` (achado do mantenedor, 2026-07-30)

T0.12 removeu `apps/accounts/src/migrate.ts` e tirou a migração do boot. Antes,
migration quebrada derrubava o container e aparecia. Agora o container sobe
saudável e o **único** alarme de schema defasado no SSO é
`check_migration_drift.sh` — que hoje falha aberto.

- [x] T1.11 — **`check_migration_drift.sh` falha fechado quando o diretório não existe.** Hoje as linhas 38-41 imprimem `diretório ausente — nada a comparar` e `exit 0`. É o **mesmo padrão do E018 que este script foi escrito para fechar**: o cabeçalho dele (linhas 11-12) descreve `apply_required_migrations.sh` saindo verde por diretório ausente e se declara "o alarme que faltava" — e então repete a falha. A linha 27 documenta `1 em qualquer divergência (fail-closed)`, contradizendo o próprio código.

  **Enumeração feita em 2026-07-30 (não amostragem):** `accounts` (3 migrations), `mesas` (84), `glossario` (5), `downloads` (37) e `links` (2) têm `apps/<mod>/database/`; `site` usa `apps/site/db/migrations/` (16) e cai no ramo especial do workflow; `site-admin` não tem banco. **Nenhum módulo depende hoje do fail-open** — a mudança não quebra deploy existente.

  Diretório ausente passa a ser erro de configuração explícito. Módulo com runner incompatível é excluído nominalmente no orquestrador — hoje apenas o `site`, cujo entrypoint usa `db/migrations/`, `NNN_*.sql` e `ledger.version`. Não existe `--allow-missing`: nenhum módulo do fluxo atual é legitimamente sem migrations, e a flag criaria novo caminho para repetir o falso-verde. · feito quando: diretório ausente sai diferente de zero, a exceção do `site` é explícita no workflow, o comentário do cabeçalho descreve o comportamento real, e os 6 módulos com banco seguem verdes.

- [x] T1.12 — **Verificar o mesmo defeito em `apply_required_migrations.sh`** (linhas 65-66, `diretorio ausente; nada a aplicar`). É a origem do padrão que T1.11 corrige; foi essa saída falso-positiva que mascarou `015`/`016` por 7 dias em beta E prod. **Decisão reportada e aprovada em 2026-07-30:** o runner padrão falha fechado; `_deploy-module.yml` não o chama para o `site`, que usa runner próprio no entrypoint. Testes reais do ramo ausente provaram exit diferente de zero nos dois scripts; `bash -n` verde. · feito quando: corrigido, ou a exceção justificada por escrito.

- [ ] T1.13 — **Confirmar que o `accounts` é coberto de ponta a ponta.** `_deploy-module.yml:519-522` deriva `DRIFT_DIR` por convenção (`apps/${MODULE}/database`), com `if` hardcoded só para o `site`. Rodar o drift contra o banco real do `accounts` e provar que detecta as duas direções: disco à frente (migration não aplicada) e banco à frente (aplicada fora da esteira). · feito quando: as duas direções detectadas em execução real, não por leitura de código.

> **T1.13 é bloqueio duro de deploy — decisão do mantenedor, 2026-07-30.**
> Nenhuma das 3 migrations do `accounts` jamais rodou contra Postgres real (Docker
> indisponível na máquina do Codex). **Nada da Fase 1 vai a beta ou prod antes de
> T1.13 passar em execução real.** Merge de PR e revisão de bot não substituem:
> ambos leem código, e o que falta provar é comportamento contra banco.
>
> Motivo de virar trava explícita agora: a Fase 1 **endurece gates antes do verde
> comprovado** — o preflight da baseline passa a exigir `users.role` como
> `TEXT NOT NULL` (achado do CodeRabbit, 2026-07-30) e o runner e o drift passam a
> falhar fechado (T1.11/T1.12). Cada um é a decisão certa isoladamente, e juntos
> significam que **um banco de produção divergente do esperado aborta o deploy**,
> o que é o comportamento desejado — desde que alguém tenha verificado que o banco
> real passa. Ninguém verificou.
>
> `AGENTS.md` §Bug achado: endurecer gate só **depois** do verde comprovado
> localmente, senão transfere falha mascarada pro próximo PR. O mantenedor optou
> por implementar o endurecimento agora e segurar o deploy até a prova real, em
> vez de afrouxar o gate. As duas direções de T1.13 valem para o schema completo
> da Fase 1, não só para o drift: baseline, `002` e `003` aplicadas do zero, e
> aplicadas sobre banco que já tinha o schema inline anterior.

> **Duas travas do mantenedor (2026-07-30) sobre T1.11–T1.13:**
>
> **1. Mostrar o diff ao mantenedor antes de qualquer deploy.** Mesmo tratamento
> do `deploy-manifest.json`: estes arquivos governam o deploy dos **seis**
> módulos com banco, não só a spec 090. Trocar fail-open por fail-closed muda
> quando o deploy **aborta e faz rollback** — condição errada trava deploy de
> qualquer módulo, ou deixa passar verde o que deveria falhar, no script que é o
> único alarme do SSO. Bots de review do PR não cobrem isto: leem sintaxe e
> padrão, não conhecem o E018.
>
> **2. T1.13 é bloqueio de fase, não item de checklist.** T1.11 não conta como
> fechada sem execução real contra o banco. E014, E015 e E018 passariam todos na
> validação estática — só apareceram rodando.

**Estado em 2026-07-30 — implementado, pendente de prova real.** Quatro arquivos
alterados, verificados pelo Claude:

- `scripts/deploy/check_migration_drift.sh` — diretório ausente vira `::error::`
  + `exit 1` ("não é possível provar conformidade"). Cabeçalho atualizado: não
  contradiz mais o código.
- `scripts/deploy/apply_required_migrations.sh` — mesmo tratamento (T1.12
  concluída).
- `.github/workflows/_deploy-module.yml` — `if [ "$MODULE" = "site" ]` pula o
  runner padrão para o site, que legitimamente não tem `apps/site/database`.
  **Peça necessária:** sem ela, o runner fail-closed quebraria o deploy do site.
  Exceção declarada no lugar de falso-verde.
- `.github/deploy-manifest.json` — `_comment` do `accounts` corrigido; o texto
  antigo ("migrations no-op: accounts migra in-container no boot") ficou falso
  quando T0.12 removeu o `migrate.ts`.

Validação: `bash -n` 2/2, fail-closed real 2/2, `git diff --check` verde.
**Nenhum deploy real rodou** — o caminho feliz (6 módulos com diretório presente
seguindo verdes) está provado só por leitura. T1.13 segue bloqueada por falta de
Docker/Postgres.

> **Nota de processo (2026-07-30).** O `deploy-manifest.json` foi alterado sem o
> diff ser mostrado antes, apesar de a trava acima e a §2 do handoff exigirem
> isso duas vezes. O conteúdo está correto e dentro do escopo autorizado (só
> `_comment`; nenhum `deploy_paths`, `db_*`, `critical_routes` ou
> `health_containers`) — o desvio é de processo, não de resultado.
>
> Segundo caso do mesmo padrão: o primeiro foi decidir o `VALIDATE`/E015 sem
> reportar, quando o handoff pedia avaliação antes. Nos dois o resultado saiu
> certo; nos dois a instrução era reportar antes de agir.
>
> Por que importa: o mantenedor acompanha por celular, via ponte manual entre
> agentes. Quando o agente decide sozinho e informa depois, o ponto de conferência
> deixa de existir — e a trava só é percebida como quebrada se alguém for
> conferir o `git status` por conta própria, que foi o que aconteceu aqui.

> **Débito registrado, não corrigido nesta spec — unificação da declaração de migrations.**
> `.github/deploy-manifest.json` declara `db_user`, `db_name`, `db_service` e
> `deploy_paths` por módulo, mas **não** o diretório de migrations, a coluna nem
> o glob. Por isso o workflow precisa do `if [ "$MODULE" = "site" ]` hardcoded e
> deriva o resto por convenção de nome. Declarar os três no manifesto elimina a
> derivação, mata o `if` especial e faz diretório ausente virar erro de
> configuração por construção. **Toca os 6 módulos com banco — spec própria, não
> cabe aqui.** T1.11 fecha o risco imediato; isto fecha a raiz.

### Desambiguação de rotas — PR próprio, entre a Fase 1 e a Fase 2 (decisão do mantenedor, 2026-07-30)

`pnpm verify:api` saiu 0 durante a Fase 1, mas apontou 3 ambiguidades de rota
**pré-existentes**, anteriores à spec 090. Não vieram desta spec e não quebram
runtime — o Express resolve as três por ordem de registro ou por método:

| Módulo | Rotas em conflito | Por que funciona hoje |
|---|---|---|
| `mesas` | `/api/v1/gm/{slug}/contact` (`gm.ts:497`) × `/api/v1/gm/tables/{id}` (`gmPanel.ts`) | routers distintos no mesmo prefixo; `tables` é literal e vence o placeholder pela ordem |
| `glossário` | `/api/social/{id}/comments` (`socialRoutes.ts:14-15`, GET/POST) × `/api/social/comments/{id}` (`:16`, DELETE) | separadas por método |
| `glossário` | `/api/systems/{systemId}/editions` (`systemRoutes.ts:16-17`, GET/POST) × `/api/systems/editions/{id}` (`:18-19`, PUT/DELETE) | separadas por método |

Raiz comum: placeholder na primeira posição convivendo com literal na mesma
posição. É ambíguo no **contrato** — cliente gerado a partir do OpenAPI não sabe
qual operação escolher —, não em execução.

Corrigir de verdade exige reordenar o path público (ex.: `/api/social/terms/{id}/comments`,
com o literal `terms` desambiguando), o que é **breaking change de API** com
frontend a acompanhar em dois módulos.

**Decisão: PR dedicado, imediatamente após a Fase 1 fechar e antes da Fase 2
começar.** Não entra no commit da Fase 1 porque esse commit já toca
`apps/accounts` e `packages/auth`: se o smoke SSO falhar depois, a causa precisa
ser inequívoca, e rota renomeada junto com mudança no SSO mascara as duas.
Escopo do PR: as 3 rotas e seus consumidores, nada mais.

**Não ampliar escopo para `apps/mesas/**` ou `apps/glossario/**` durante a Fase 1
por causa disto.**

## Fase 2 — Comentários no `accounts.`

- [ ] T2.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T2.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T2.1 — **Schema completo, não mínimo** (requisitos 5, 8, 9). A versão anterior pedia "referência opaca e `parent_id`", o que não basta para nascer com integridade. Exigir: `realm`, `source_app`, `subject_type`, `subject_id TEXT` (T0.6); `user_id`, `parent_id`, `depth`, opcionalmente `root_id`; **`body_text` para o novo e campo próprio para o HTML legado — nunca campo ambíguo** (T0.9); `created_at`; `removed_at`, `removed_by`, `removed_reason`; `legacy_source`, `legacy_id`, `legacy_author_name`, com **`unique (legacy_source, legacy_id)`** para importação idempotente; e índice de listagem na ordem `(realm, source_app, subject_type, subject_id, created_at, id)`. · feito quando: migration idempotente, com header válido, passando no guard.
- [ ] T2.2 — **Criação valida no backend do módulo antes de chamar o `accounts.`** (requisito 6, decisão do mantenedor). O `accounts.` não conhece material nem mesa: quem confirma que o assunto existe, está visível, aceita comentário e quem é o dono é o backend do módulo, que então chama com credencial própria. Referência opaca **não** substitui autorização por objeto — sem isso o atacante comenta em assunto inexistente ou invisível (OWASP IDOR). · feito quando: comentário em assunto inexistente, invisível ou fechado é recusado, e escrita direta do navegador não é aceita.
- [ ] T2.3 — **API de comentário com paginação desde o primeiro dia** (requisito 6). Criar, listar por assunto, responder, retirar — a listagem nasce com **cursor opaco, tamanho máximo e ordenação estável por `(created_at, id)`**. Acrescentar paginação depois quebra contrato de API pública (AIP-158). · feito quando: rotas testadas, escrita anônima rejeitada, e paginação sem duplicação nem item perdido entre páginas.
- [ ] T2.4 — **Integridade de thread validada na transação** (requisito 8). O pai precisa existir, pertencer ao **mesmo `realm`, `source_app` e assunto**, aceitar respostas, não ser legado, e produzir `depth<=2`. Rejeitar na escrita, não corrigir depois. · feito quando: resposta cross-subject, cross-realm, a comentário legado, ou além da profundidade é recusada — inclusive sob concorrência.
- [ ] T2.5 — **Texto puro no comentário novo; DOMPurify só no legado** (requisito 10, decisão do mantenedor). A versão anterior mandava sanitizar "na escrita e na renderização" via DOMPurify para tudo — ambíguo e excessivo: comentário novo é `body_text` e o React escapa sozinho, então não há HTML a sanitizar. O legado do `site` tem `content_html` e é sanitizado **uma vez, na entrada**, com a política e a versão dela registradas; a saída passa por defesa adicional **sem regravar o banco**. Nunca ressanitizar continuamente nem alterar o HTML depois de sanitizado (anula a proteção). · feito quando: testes de XSS cobrindo script, links, SVG/MathML, atributos e o HTML legado.
- [ ] T2.6 — **Badge de autor calculado a partir de fonte confiável** (requisito 11). O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada — nunca do payload público**, senão qualquer um se declara dono. Usuário comum sem rótulo; e-mail nunca exposto. · feito quando: tentativa de forjar dono no payload é ignorada, e o badge sai correto na resposta.
- [ ] T2.7 — **Retirada por tombstone, com auditoria** (requisito 12). Não apagar a linha — apagar quebraria os filhos e perderia o contexto. A resposta pública devolve o estado removido e `removed_at`, **sem o corpo**; `removed_by` e `removed_reason` ficam para a moderação. Autoexclusão e edição continuam proibidas (D111 item 6). · feito quando: filhos sobrevivem à remoção do pai, e usuário removendo o próprio comentário recebe 403.
- [ ] T2.8 — **Legado com proveniência explícita, read-only** (requisito 9). `site.comments` tem nome solto, HTML e `parent_id` **sem FK** (`apps/site/db/migrations/001_init.sql:66`) — a migração precisa detectar pais órfãos e ciclos **antes** de copiar. Importar com `user_id` nulo, `legacy_author_name`, `legacy_source='site'`; conteúdo read-only, sem aceitar resposta. Relações válidas preservadas; órfãs achatadas ou marcadas conforme decisão registrada. · feito quando: escrita sem `user_id` rejeitada, legado legível, e nenhum órfão ou ciclo copiado silenciosamente.
- [ ] T2.9 — **Identidade resolvida no mesmo `SELECT`** (requisito 7), por `JOIN` — não por segunda chamada nem pela rota em lote de T1.4. Conta removida ou desativada cai em nome neutro e avatar nulo. · feito quando: uma consulta devolve comentário e identidade, e o caso da conta removida não vaza nem quebra a lista.
- [ ] T2.10 — **[P1] Separar os rate limiters do `accounts.`** antes de expor comentários. Hoje um único limiter cobre a aplicação inteira em 200 requests/15 min (`app.ts:79`): três catálogos consultando comentários podem consumir a cota de `/login`, `/me` e `/refresh` e derrubar o login de todo mundo. Criar limiters separados para autenticação, leitura pública e escrita; escrita por usuário e IP; leitura com cache. · feito quando: carga de leitura de comentário não afeta a cota de autenticação, provado por teste.
- [ ] T2.11 — **Testes de borda obrigatórios**: pai em outro assunto, pai em outro `realm`, profundidade sob concorrência, assunto inexistente, dono forjado no payload, URL externa na referência, resposta a legado, remoção do próprio comentário, `moderator` com papel revogado mas sessão viva (ver T1.2), paginação sem duplicação, e `accounts.` indisponível. · feito quando: os onze cobertos, cada um falhando fechado.

## Fase 3 — Notificações agregadas

A razão de ser da agregação. Sem esta fase, o ganho sobre banco por app é pequeno.

- [ ] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T3.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T3.1 — **Evento e recibo são tabelas separadas** (requisito 13). A versão anterior falava de "notificação" como uma coisa só, o que impede vários destinatários, deduplicação e canais futuros sem migrar o evento. `notification_event` guarda a ocorrência **imutável**: `id`, `realm`, `source_app`, `type`, `version`, subject opaco, ator, `canonical_path`, dados, `occurred_at`. `notification_receipt` guarda o **estado por usuário**: destinatário, `read_at`. Nomenclatura alinhada ao CloudEvents (`id`, `source`, `type`, `subject`, versionamento) sem adotar a biblioteca. · feito quando: migration idempotente com as duas tabelas, passando no guard.
- [ ] T3.2 — **Conjunto de destinatários definido, não implícito** (requisitos 14-16). Os requisitos 14 e 15 se sobrepõem numa resposta — o pai e o dono do conteúdo podem ser pessoas diferentes, ou a mesma. **Decisão do mantenedor (2026-07-27):** comentário raiz notifica o dono do conteúdo; resposta notifica o autor do pai **e** o dono do conteúdo; quando forem a mesma conta, **um recibo só**; o ator nunca é notificado da própria ação; conta removida ou bloqueada não recebe. · feito quando: as cinco regras testadas, inclusive a deduplicação e a negativa do ator.
- [ ] T3.3 — **Snapshot estruturado no evento, não mensagem pronta nem leitura do domínio vivo** (requisito 13). Montar o texto na leitura consultando o domínio faz a notificação **mudar de sentido depois**: título editado, motivo alterado, nome trocado. Guardar os dados imutáveis necessários — por exemplo `material_title`, `reason`, `actor_name_snapshot` — mais `event_version`. Nem só a string pronta (impede reformatar e traduzir), nem dependência do domínio atual. · feito quando: editar o material depois não altera o texto da notificação histórica.
- [ ] T3.4 — **Comentário, evento e recibo na mesma transação** (requisito 13). Todos vivem no banco do `accounts.`: falha reverte o conjunto. Evento vindo de outro módulo usa `event_id` idempotente e **outbox no produtor**. · feito quando: falha na gravação do evento reverte o comentário, provado por teste.
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
- [ ] T4.2 — **Transporte injetável, não chamada direta ao `accounts.`** (requisito 21). O pacote **não** pode embutir `fetch` do navegador para o `accounts.`: isso contradiz a decisão de escrita backend-to-backend (T0.5) e furaria a validação de assunto e ownership. O pacote recebe um adapter com `listComments`, `createComment`, `reply`, `remove`, `listNotifications`, `markRead` — quem implementa é a fachada do módulo. · feito quando: o pacote funciona contra um adapter de teste, sem conhecer a origem real.
- [ ] T4.3 — **Exports separados por responsabilidade** (requisito 21). `@artificio/comments` traz tipos, schemas e cliente; `@artificio/comments/react` traz hooks e componentes; `@artificio/comments/styles.css` traz o estilo mínimo. Sem isso, backend ou o Astro server-side do `site` seriam obrigados a importar React. · feito quando: um consumidor só de tipos não puxa React na árvore.
- [ ] T4.4 — **`react` e `react-dom` como `peerDependencies`** (requisito 21). Pacote visual novo declara peer, para o consumidor fornecer a própria cópia — duas instâncias de React quebram hooks. · feito quando: nenhum app acaba com React duplicado no bundle.
- [ ] T4.5 — **TanStack Query não é contrato obrigatório** (requisito 21). `downloads` e `mesas` usam React Query (`package.json:24` e `:23`), mas o **`site` não usa** — o núcleo do cliente é agnóstico de framework, e o adapter de React Query fica interno e opcional. · feito quando: o `site` consome o pacote sem instalar React Query.
- [ ] T4.6 — **Cache com estado explícito, não TTL silencioso** (requisito 22). A versão anterior pedia "TTL curto de 60s no padrão do `catalogClient`" — cache em memória **desaparece ao recarregar a página**, então não prova degradação nenhuma. A resposta carrega estado: `fresh`, `stale` ou `unavailable`. **Falha nunca vira "nenhum comentário"** — silenciar erro como lista vazia é mentir para o usuário. Havendo dado stale, mostrar a idade (mesma ideia do `stale-if-error` do HTTP). · feito quando: os três estados são distinguíveis na UI, e indisponibilidade não é exibida como ausência de comentários.
- [ ] T4.7 — **Chave de cache inclui identidade; logout limpa** (requisito 22). Chave por `realm`, `source_app`, subject **e usuário quando o dado é privado**. Comentário de autoria privada e notificação são limpos no logout e na troca de conta; **notificação nunca entra em cache público**. Sem isso, a próxima conta na mesma máquina lê o cache da anterior. · feito quando: trocar de conta não mostra nada da conta anterior.
- [ ] T4.8 — **Timeout e cancelamento no cliente** (requisito 22). Seguir o padrão já aprendido em `packages/catalog-client/src/index.ts:35` (`CATALOG_FETCH_TIMEOUT_MS`, achado de review no PR #145: `fetch` sem timeout pendura a rota do backend consumidor). Hooks consomem `AbortSignal` e cancelam query obsoleta. · feito quando: requisição pendurada não trava a página, e navegar para longe cancela a busca.
- [ ] T4.9 — **Degradação testada contra resposta inválida, não só conexão recusada** (requisito 22). A página precisa sobreviver a timeout, 500, HTML inesperado no lugar de JSON, JSON malformado e schema incompatível — este último é a regra pétrea de normalização (`AGENTS.md`: payload externo é `unknown` até passar por normalizador tipado). · feito quando: os cinco casos mantêm a página do módulo de pé com aviso claro.
- [ ] T4.10 — UI de lista, formulário e thread, consumível por app com estilo próprio (requisito 21). **Contrato visual comum:** tokens CSS do design system, slots e `className`; **sem Tailwind compilado dentro do pacote** — consumidor pode não escanear classes do workspace, e a classe sumiria em produção. Apps customizam tokens, não a estrutura semântica. · feito quando: os três renderizam com identidade própria sem sobrescrever o componente.
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
- [ ] T4.19b — **Registro de ação de moderação** (requisito 27d). Existe `global_role_audit` para papel (`migration_002`), nada equivalente para conteúdo. Toda remoção e restauração grava ator, alvo, motivo e momento — mesmo padrão já aplicado a papéis. · feito quando: as duas ações aparecem no histórico com os quatro campos, e a migration passa no guard.
- [ ] T4.20 — **Conta nova tratada como conta nova** (requisito 27e). Hoje conta criada há dez segundos comenta como quem está há dois anos; com login Google a barreira é baixa e essa é a porta de entrada de spam. Forma **mínima**, derivada de dado existente (`users.created_at` + contagem de comentários do autor), **sem tabela nova**: conta nova entra na fila para revisão e tem limite mais apertado no rate limiter de escrita (requisito 12b). **Não é bloqueio de publicação** — é priorização de revisão. · feito quando: o critério está escrito, a fila destaca esses comentários, e nenhum autor legítimo é impedido de publicar.
- [ ] T4.21 — **Usabilidade da fila** (requisito 27g), 10 Heurísticas de Nielsen. Em especial: estado do sistema visível (quantos pendentes, o que já foi tratado); prevenção de erro com `ConfirmDialog` de `packages/ui` em ação destrutiva **e em lote**; reversibilidade como saída de emergência (T4.19). Ação em lote sem confirmação sobre conteúdo de usuário é o caso que a heurística 5 existe para impedir. · feito quando: checklist registrado, com confirmação verificada nos dois casos.
- [ ] T4.22 — **Acessibilidade da fila** (WCAG 2.2), mesmos critérios executáveis de T4.13: tabela com semântica real, seleção operável por teclado, resultado de ação anunciado por `role="status"` sem mover foco, estado não dependendo só de cor. · feito quando: os quatro verificados, com evidência.

**Fora de escopo (requisito 27f, decisão do mantenedor):** shadow ban — esconder
conteúdo sem avisar o autor contradiz o compromisso de transparência e quebra a
confiança quando descoberto; e moderação automática por IA — custo e falso
positivo desproporcionais ao volume atual. Voltam como spec própria se o volume
mudar.

## Fase 5 — Adoção no `downloads`

Primeiro consumidor: necessidade imediata (spec 089) e dado menos delicado.

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
- [ ] T5.2b — **Os cinco `kind` atuais mapeados como legado** (T0.11). O `downloads` emite `material_approved`, `material_rejected`, `report_resolved`, `report_dismissed` e `system_suggestion_resolved` (`services/notify.ts:10`) — preservar `download_notification` sem tratá-los seria impossível. **Decisão do mantenedor (2026-07-27):** entram como `legacy_downloads` com o **corpo já montado congelado**, legíveis para sempre, sem virar `kind` oficial do registro central; o `downloads` **continua** emitindo esses eventos na tabela local dele. Só comentário migra para o registro novo. · feito quando: os cinco legíveis no histórico, nenhum aparecendo como evento ativo do registro central.
- [ ] T5.2c — **Validação linha a linha, com definição** (requisito 24). "Item a item" sem critério não valida nada. Comparar: quantidade, IDs, hash dos campos normalizados, `created_at`, autoria, estado removido e lido, relações `parent` — e produzir **lista explícita de divergências**, não um "ok". · feito quando: o relatório sai vazio, ou cada divergência tem causa registrada.
- [ ] T5.3 — `routes/comments.ts` e `routes/notifications.ts` delegam ao `accounts.`, mantendo os paths atuais. **Preservar o payload e o status, não só o path:** comentários devolvem array com `id`, `material_id`, `user_id`, `body`, `created_at`; notificações devolvem `kind`, `material_id`, `body`, `read_at`, `created_at`; `POST`, `DELETE`, `PATCH` e os códigos atuais seguem iguais. **`verify:api` não prova compatibilidade semântica** — hoje não existe teste direto de `comments.ts` nem de `notifications.ts`, então escrever contract tests contra o comportamento antigo **antes** de trocar. · feito quando: os contract tests passam contra a fachada nova, e `rtk pnpm verify:api` verde.
- [ ] T5.3b — **[P1] Corrigir o limiter errado no `GET`** (bug real, autorizado pelo mantenedor 2026-07-27). `routes/notifications.ts:12` aplica `writeRateLimiter` num `GET` de leitura: quem só consulta o próprio feed consome cota de escrita e pode ser barrado sem ter escrito nada. · feito quando: leitura usa limiter de leitura, com teste.
- [ ] T5.3c — **Fachada com timeout e degradação por verbo** (requisito 22). `GET` pode servir cache stale ou resposta controlada; **`POST`, resposta, remoção e marcar-lida falham com erro explícito — nunca fingem sucesso**. Timeout curto, correlation ID, nenhuma espera indefinida, e retry automático **apenas** com chave de idempotência. · feito quando: escrita que falhou não aparece como salva para o usuário.
- [ ] T5.4 — UI de comentários no material, com identidade, papéis e threads. · feito quando: comentar, responder e ver autor funcionam na ficha.
- [ ] T5.5 — **Endpoint de caixa de entrada do autor, antes da UI.** A versão anterior pedia a tela sem a API que a sustenta: o `accounts.` **não conhece ownership de material**, então não sabe o que é "meus materiais". O backend do `downloads` resolve — lista os materiais do autor e busca comentários por subjects **em lote** (nunca um subject por vez), ou recebe eventos de comentário endereçados ao dono. Definir paginação, ordenação, não-lidos e autorização. · feito quando: o autor vê e responde comentários dos próprios materiais pelo painel, com uma consulta em lote.
- [ ] T5.6 — **Validar a rastreabilidade dos requisitos 18-22 e 32-35 da spec 089**, sem removê-los de lá. A versão anterior dizia que a 089 "não carrega mais tasks de comentário" — contradiz a própria 089, que mantém a Fase 6 marcada como **MOVIDA** justamente para o rastro não sumir (`089/tasks.md:213`). A referência fica; o que se valida é que ela aponta para cá e que ninguém executa aquelas tasks na 089. · feito quando: as duas specs concordam, com a 089 preservando a marcação de movida.
- [ ] T5.7 — **Tabela local vira read-only, não é apagada nesta fase.** Retenção até o rollback e a reconciliação estarem concluídos. Exclusão é ação posterior, nominal e com backup próprio. · feito quando: `download_comment` e `download_notification` param de receber escrita e continuam legíveis.

## Fase 6 — Adoção no `site`

Segundo consumidor: tem o dado legado, que é o risco real desta spec.

- [ ] T6.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T6.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T6.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T6.1 — **`pg_dump` dos DOIS bancos** — `site` (origem) e `accounts.` (destino) —, com checksum e **comando de restauração testado**, não só gerado. Dump seletivo de tabela pode não carregar as dependências necessárias para restaurar isoladamente; validar isso antes de confiar nele como rollback. · feito quando: os dois dumps validados por restauração real de teste, com caminho registrado.
- [ ] T6.2 — **Export read-only aqui, importador do lado do `accounts.`** (requisitos 9, 23, 25). A versão anterior mandava a migration do `site` migrar "para o `accounts.`" — mesmo erro corrigido na Fase 5: migration do banco do `site` **não escreve** no banco do `accounts.` Fluxo: export read-only no `site`; importador one-shot pertencente ao `accounts.`, idempotente por `(legacy_source, legacy_id)`; relatório de reconciliação. Migrar com `user_id` nulo e `legacy_author_name` preservado. · feito quando: o importador roda duas vezes com resultado idêntico, e o `site` não toca o banco central.
- [ ] T6.3 — **Quantidade medida, não "25"** (requisito 25). O número veio de uma contagem em beta e virou constante na spec — mas o aceite precisa comparar contra `N_source` **medido por `realm` e por ambiente** no momento da migração, senão valida contra um número que já mudou. (A nota anterior atribuía essa confirmação à T0.4, que trata de casamento de identidades, não de contagem — a medição é aqui.) · feito quando: `N_source` medido e registrado antes do import, e o aceite compara contra ele.
- [ ] T6.4 — **Arquitetura de runtime do comentário no `site`** (requisito 25). A versão anterior dizia só "adotar o pacote", sem dizer onde ele roda — e o blog é **SSG** (`astro.config.mjs:7`), com os posts gerados por `getStaticPaths` (`pages/blog/[slug].astro:7`); o servidor só consulta comentários para um contador administrativo (`server/server.ts:116`). Definir: fachada Express **same-origin**; validação de post publicado; `subject_id = String(post.id)`; `canonical_path = /blog/${slug}/`; **ilha React abaixo do artigo, `client:visible`** (adia o JavaScript até entrar no viewport, sem hidratar a página toda); lista degradável e escrita SSO backend-to-backend. · feito quando: a página estática continua estática e a ilha carrega só quando visível.
- [ ] T6.5 — Adotar o pacote para comentário novo, mantendo o legado read-only. · feito quando: comentário novo exige SSO e legado não aceita resposta.
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
- [ ] T8.1 — `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test` e `rtk pnpm verify:api` verdes — **e verdes provando alguma coisa**. A raiz só delega ao Turbo (`package.json:7`), o lint do `site` é no-op e o teste dele usa lista fechada de arquivos (`apps/site/package.json:15-16`): os quatro podem passar sem ter executado um único teste da fachada. Exigir testes **nomeados** de fachada, ilha, degradação e integração dentro do script efetivamente executado. · feito quando: os quatro exit 0, e os testes desta spec aparecem na saída.
- [ ] T8.2 — **Validação sem deploy de beta do `accounts.` — ele não existe.** A versão anterior pedia "deploy em beta de `accounts.`": impossível. O manifesto declara o módulo **PROD-ONLY** com `env_override: "prod"`, e a build-matrix do workflow **bloqueia** `dispatch env=beta` para `accounts` (`.github/deploy-manifest.json:147`) — beta reusa o `accounts.` de produção. O aceite nunca poderia ser cumprido. **Estratégia decidida pelo mantenedor (2026-07-27):** mudança central **aditiva, compatível e inicialmente desabilitada**; ativação limitada a `realm=beta` com credenciais allowlisted dos módulos beta; comparação de erro, latência e autenticação contra controle; só depois, habilitação produtiva separada. População, duração, métricas e rollback definidos **antes** de ligar. Cada ação real segue exigindo autorização nominal. · feito quando: o canário roda em `realm=beta` sem afetar prod, com as métricas comparadas e registradas.
- [ ] T8.3 — **Smoke de SSO que prova mudança de papel**, não só sessão. Login, `/me` e logout não provam nada sobre autorização. Incluir: `moderator` no login, no `/me`, no access token **e no refresh**; promoção e revogação observadas **dentro do SLA** de T1.2; falha fechada durante indisponibilidade; **todos** os consumidores de `packages/auth`; isolamento entre `realm` beta e prod. · feito quando: os cinco verificados em todos os consumidores, com evidência.
- [ ] T8.4 — **Smoke de agregação, corrigido.** A versão anterior pedia "comentar no `downloads`, **responder pelo `site`**" — contradiz o trust boundary: a fachada do `site` teria de validar um alvo que pertence ao `downloads`, ou a resposta nasceria em outro `source_app`, quebrando a integridade do pai. O correto: comentar e responder **dentro de cada módulo** (`downloads`, `site`, `mesas`); as notificações dos três aparecem na **mesma central**; e cada link leva de volta ao módulo e ao contexto certos. Navegar da central até o `downloads` é o cruzamento legítimo — e é isso que a redação anterior provavelmente queria dizer. · feito quando: os três módulos comentam e respondem, e a central mostra os três com links corretos.
- [ ] T8.5 — Smoke de moderação unificada: moderador global retira comentário nos três módulos. · feito quando: as três retiradas funcionam sem papel por app.
- [ ] T8.6 — **Smoke de degradação em cinco modos, não um.** Simular timeout, conexão recusada, HTTP 500, resposta inválida (HTML no lugar de JSON, JSON malformado, schema incompatível) e circuito aberto. Em todos: a página continua de pé; a área de comentários mostra aviso; **escrita e moderação falham fechadas**; retries limitados. · feito quando: os cinco verificados por configuração de teste — **nunca** derrubando o `accounts.` real.
- [ ] T8.7 — **Gates de dados antes de encerrar:** reconciliação dos legados do `downloads` e do `site` conferida; isolamento por `realm` provado; **colisão intencional de `subject_id` entre apps** testada (mesmo ID em módulos diferentes não pode se misturar); tombstone preservando filhos; legado não aceitando resposta; recibos deduplicados quando o pai e o publicador são a mesma conta; estado de leitura compartilhado entre módulos. · feito quando: os sete passam, com evidência.
- [ ] T8.8 — **Rollback definido antes de precisar dele.** Desligar a feature e as credenciais dos módulos; **preservar o schema aditivo e os dados já escritos**; restaurar os consumidores anteriores; comprovar que a autenticação central continua saudável. **Apagar tabela não é rollback** — é perda de dado com outro nome. · feito quando: o procedimento está escrito e ensaiado, não só descrito.
- [ ] T8.9 — Se algum critério falhar, **parar e reportar** — não fechar como parcial. · feito quando: todos batem, ou o bloqueio está registrado com evidência.

---

## Bloqueios conhecidos

- **`accounts.` é sagrado — e `packages/auth` também entra.** Toda fase que toca o `accounts.`
  (1, 2, 3) exige aprovação + SDD Completo + smoke de todos os consumidores SSO. **A criação do
  `moderator` toca `packages/auth` obrigatoriamente**: `UserRole` é `"user" | "admin"`
  (`types.ts:1`), e o decoder, o cliente e `verifyRefreshToken` (`tokens.ts:44`) rejeitam
  qualquer outro valor. São duas aprovações nominais, pedidas juntas em T0.14.
- **[P0] O refresh perpetua papel antigo.** `/api/auth/refresh` (`app.ts:162`) reassina a partir
  do token, sem reler o banco, e o refresh dura 7 dias com rotação — papel revogado sobrevive
  indefinidamente em sessão ativa. Enquanto T1.2 não corrigir, o `accounts.` não é fonte de
  verdade material, e nenhuma decisão de autorização baseada nele é confiável.
- **[P1] Um único rate limiter cobre o `accounts.` inteiro** (200 req/15 min, `app.ts:79`).
  Expor comentários sem separar os limiters faz tráfego de leitura consumir a cota de `/login`,
  `/me` e `/refresh`. T2.10 separa antes.
- **CSRF exclui os consumidores desta spec.** A allowlist tem cinco origens (`app.ts:87`) e
  deixa `downloads` e todos os betas de fora, enquanto o CORS aceita qualquer subdomínio
  (`:97`). Escrita direta do frontend falharia hoje — mais um motivo para a escrita ser
  backend-to-backend (T0.5).
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
  dos três módulos, não só login. Requisito 22 e T4.3 são a mitigação.
- **Os 25 comentários do `site`** provavelmente existem em produção — T0.4 confirma, T6.1 faz
  dump antes de tocar.
- **`accounts.` passa a guardar conteúdo de usuário**, não só identidade. Inverte a regra de
  isolamento de dados do monorepo, deliberadamente, para viabilizar a agregação.
- **A spec 089 depende desta** para os requisitos 18-22 e 32-35.
