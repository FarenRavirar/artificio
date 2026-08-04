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
> isso que T1.13 (abaixo) precisa ser fechada **antes** — ela é a única prova
> disponível de que esse deploy não vai abortar.
>
> Isto **não** significa "deploy proibido": `AGENTS.md` §"Não lançado ≠ não deve
> subir". Significa que o primeiro exercício real é em produção, com o SSO de
> todos os apps dependendo dele — daí a ordem obrigatória da §"Como destravar".
- [x] T1.10 — **Remoção do papel global local dos apps.** Reescrito pela decisão de T1.5: sem migração e sem fallback (T1.6), some a exigência de "período observável de leitura dupla" e de "usuários conflitantes resolvidos" — não há conflito a resolver. Permanecem: teste **por capacidade** (não por nome de papel), provando que quem podia moderar continua podendo; refresh reidratado do banco (T1.2); rollback ensaiado. Papel de **domínio** (`download_creator.role` na parte que não é global, mestre, autor) **fica onde está** — só o global sai. · feito quando: as três cumpridas, e nenhum app decide papel global por conta própria.

**Estado da Fase 1 em 2026-07-31 — código completo, deploy bloqueado.** T1.1–T1.8
e T1.10 fechadas e verificadas contra o código, não contra a documentação. T1.9 e
T1.13 seguem abertas: as duas só fecham no deploy de produção, porque o
`accounts` é PROD-only e não tem ambiente de ensaio (D042). **Isso não quer dizer
que não haja nada a fazer antes:** o diagnóstico que determina se o deploy vai
passar ou abortar é leitura do banco de prod, é read-only, e está descrito passo
a passo em §"Como destravar T1.13 e T1.9". Fazer esse diagnóstico **antes** do
deploy é o que separa um deploy previsível de um rollback em produção.

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
  (Esta versão inicial ainda tinha três caminhos de falha, todos fechados nos
  achados de review registrados abaixo.)
- **Smoke do `accounts` cobre a rota nova.** `critical_routes` ganhou
  `admin_roles_no_cookie` (401 em `/admin/roles/users`). Era a superfície mais
  perigosa da fase sem nenhuma rota crítica declarada.
- **Seções obsoletas da spec corrigidas.** `spec.md` §Casamento de identidade
  ainda descrevia migração de papéis, `unmatched`, `excluded_realm` e relatório de
  promoções — tudo eliminado pela decisão de 2026-07-30, mas ainda escrito como se
  fosse o plano. Ficção documental num arquivo que o próximo agente lê como
  contrato.

Validação desta passada: repo 38/38 pacotes sem cache (`--force`, 0 cached), lint
24/24, build 24/24, `verify:api` 0 breaking, guard de migrations 47/47.
`glossario` 46/46. (`accounts` estava em 63/63 aqui; chegou a 73/73 depois dos
achados de review registrados abaixo.)

**Falha intermitente da suíte — investigada e corrigida, não era flake.** A
primeira leitura registrada aqui dizia "descartada, não reproduziu". Estava
errada: medindo 3 rodadas completas, reproduzia **~1 em 3**.

Duas coisas escondiam a causa. O turbo atribuía a falha ao `glossario-backend`,
que reportava 46/46 passando — a saída intercalada apontava o pacote errado, e o
`ELIFECYCLE` real era do `mesas-frontend`. E o pacote sempre passava isolado, o
que reforçava a leitura de ruído.

Causa real: `suggestionModals` estourava `Test timed out in 5000ms` com 191
testes de jsdom disputando CPU com os outros 37 pacotes em paralelo. Os mocks de
`fetch` resolvem na hora e não há promessa pendente — faltava CPU, não correção
de lógica. `testTimeout` 20s e `asyncUtilTimeout` 5s (o `waitFor` do
testing-library usa 1s próprio, independente do Vitest). Depois: 6 rodadas
completas 38/38.

Uma rodada isolada acusou `@artificio/site#test`, que não reproduziu em nenhuma
das seguintes e cujo log não foi capturado. **Não diagnosticado** — registrado
como aberto, não como resolvido.

### Achados de review da PR #234 — todos corrigidos

Quatro passadas de bot. O padrão vale registro: em três delas o achado principal
foi defeito introduzido na correção anterior — certo no miolo, errado na borda.

- **403 de CSRF confundido com rebaixamento** (Codex). `csrfProtection` devolve
  403 igual ao guard de papel, e o `accounts` aplica esse middleware
  globalmente. O painel travava a tela do admin legítimo num erro de origem, e
  recarregar não resolvia. O backend passou a devolver `code: "ADMIN_REQUIRED"`
  nos dois 403 que significam perda de papel; o frontend discrimina por código,
  não por status nem por texto de mensagem (que quebraria ao traduzir).
- **Lista não limpa ao perder papel** (CodeRabbit). A listagem limpava as linhas
  ao receber o 403; o PATCH não. Ator revogado ao salvar seguia vendo nome e
  e-mail de todas as contas. `losePermission` centraliza a transição para os
  caminhos não divergirem de novo.
- **Boot podia sobreviver ao próprio encerramento** (CodeRabbit). `destroy()`
  que nunca resolve travava o `await` e o exit code jamais era definido; e mesmo
  definido, `process.exitCode` só encerra com o event loop vazio, que um pool
  travado impede. Prazo de 5s + saída forçada. Sem a correção, o teste trava o
  próprio runner.
- **Timer não cancelado** (CodeRabbit, 2ª passada). `Promise.race` não cancela o
  perdedor: o timer registrava "cleanup timed out" para limpeza bem-sucedida. O
  log de encerramento é o que se lê para decidir se o SSO caiu por falha de
  banco — mentir ali custa diagnóstico.
- **`destroy()` que lança sincronamente** (achado próprio, revisando o diff
  acumulado). Terceira porta para o mesmo falso-verde: a exceção escapava do
  executor da Promise e abortava a função antes do `setExitCode`. Tipo declara
  `Promise`, mas tipo não é garantia de runtime — e este é o caminho de
  encerramento de emergência.
- **Digest de tamanho fixo em `timingSafeEqualStrings`** (CodeRabbit). A
  ramificação por comprimento existia, embora o custo do ramo variasse com o
  input do atacante, não com o segredo. SHA-256 nos dois lados elimina o ramo
  por construção; adotado por ser estritamente melhor, não porque a alegação de
  oráculo estivesse correta.

**Não corrigido, por ser falso positivo:** Sonar S1135 acusa dois "TODO" que são
a palavra portuguesa *todo* dentro de comentários ("todo par vira 32 bytes",
"Tratar todo 403 como rebaixamento"). A regra casa por substring e não distingue
idioma. Ambos `INFO`, quality gate passou.

Validação final: `accounts` 73/73, suíte 38/38 sem cache, lint 24/24, build
24/24, `verify:api` 0 breaking, guard de migrations 47/47.

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

> **Como destravar T1.13 e T1.9 — ordem obrigatória, decidida em 2026-07-31.**
> Escrita porque a formulação anterior ("exige ambiente no ar", "execução real")
> induziu à conclusão errada de que **nada** podia ser feito sem deploy. O
> diagnóstico que decide tudo é **read-only** e não precisa de autorização
> (`AGENTS.md`: read-only é sempre permitido, inclusive na VM).
>
> **Estado do ambiente (verificado em 2026-07-31):** `accounts-api` e
> `accounts-db` estão **de pé e healthy** na VM. O banco `artificio_auth` existe
> e serve o SSO agora. O bloqueio nunca foi "não há banco" — é "ninguém leu o
> banco".
>
> **Estado do banco de produção, medido em 2026-07-31 (não inferido).** Leitura
> read-only via `ssh faren` + `psql`:
>
> | Objeto | Prod | Quem cria |
> |---|---|---|
> | `users`, `admin_secrets` | existem | `001`, com `IF NOT EXISTS` |
> | `users.role` `TEXT NOT NULL` | ✅ | preflight da `001` **passa** |
> | `users.avatar_source` | **existe, fora da esteira** | `004` (declaração) |
> | `users.role_version` | ausente | `002` |
> | `global_role_audit` + trigger | ausente | `002` |
> | `users_role_check` | ausente | `002`/`003` |
> | `schema_migrations` | ausente | **o próprio runner** |
>
> Dados: **103 contas** (1 `admin`, 102 `user`), zero fora do contrato de papel,
> zero fora do contrato de `avatar_source`.
>
> **Baseline manual NÃO é necessária — hipótese anterior refutada.** A versão
> anterior deste bloco supunha que a ausência de `schema_migrations` faria o
> deploy abortar, e mandava rodar `reconcile_migrations.sh --mark-applied`.
> **Errado:** o runner **cria a ledger ele mesmo**
> (`apply_required_migrations.sh:73-80`, `CREATE TABLE IF NOT EXISTS`) antes de
> listar pendências. Ele então acha 5 pendentes, aplica todas, e só depois o
> drift roda — contra uma ledger já preenchida. A `001` foi escrita justamente
> para isso: `CREATE TABLE IF NOT EXISTS` + preflight que exige o schema inline
> anterior, e esse preflight passa contra prod. **Não rodar `--mark-applied`
> aqui**: marcaria como aplicada uma migration cujo efeito (`002`) o banco não
> tem, e o schema ficaria permanentemente incompleto sem nenhum alarme.
>
> **~~Único passo restante — deploy.~~ EXECUTADO em 2026-08-04.** `gh workflow run
> deploy.yml --ref main -f module=accounts -f mode=deploy -f env=prod` rodou como
> run `30918952648` (sha `c519f76`, sucesso em 3m22s). O job rodou o runner, o
> drift **e** as `critical_routes`, fechando T1.13 e T1.9 juntos, como previsto.
> Evidência medida nas próprias tasks acima. **Fase 1 encerrada; o `accounts.`
> com papel global está em produção.**
>
> **Aviso a quem ler este bloco depois:** o texto acima descreve o estado de
> 2026-07-31 e foi mantido por valor histórico — não é o estado atual. Um agente
> já leu esta seção como se fosse presente e concluiu que a Fase 1 seguia
> bloqueada. Banco e código são a verdade material (`AGENTS.md`); confirmar
> contra a ledger antes de agir sobre este bloco.
>
> **Atenção ao guard `MAX_AUTO_PENDING=5`.** Com a `004`/`005` o `accounts` tem
> **exatamente 5** migrations pendentes. O comparador é `-gt`
> (`apply_required_migrations.sh:95`), então `5 > 5` é falso e o deploy passa —
> **sem folga**. Qualquer migration nova antes deste deploy estoura o guard e
> aborta. Se acontecer, o caminho é o do §Migrations item 4 (aplicar com o mesmo
> script oficial e `MAX_AUTO_PENDING` ajustado ao total), nunca fatiar em lotes.
>
> **Achado da investigação — `users.avatar_source`, drift reverso real
> (2026-07-31, corrigido a pedido do mantenedor).**
> A coluna existe em produção (`TEXT NOT NULL DEFAULT 'google'`, 103 linhas todas
> `'google'`) e **não era declarada por nenhuma migration nem pelo código**. Grep
> em `apps` e `packages` inteiros: zero ocorrências. É exatamente a segunda
> direção que T1.13 pede para provar — banco à frente do disco — e não precisou
> ser simulada: estava em produção.
>
> Origem, pelo histórico: `c051971` (2026-06-29) criou a coluna via `migrate.ts`
> inline junto com a feature de **avatar personalizado** — `avatar_source` valia
> `'custom'` quando o usuário subia a própria imagem, e um `CASE` no upsert
> impedia o login seguinte do Google de sobrescrevê-la. **`a7d9d20`, 5 horas
> depois** ("restore ultimo runtime verde do SSO"), reescreveu `users.ts` a partir
> de um ponto anterior e levou junto a rota de upload, a proteção e a declaração.
> A coluna, já em produção, ficou. A baseline `001` foi escrita a partir do código
> pós-restore e por isso também não a tem — um banco recriado pela esteira
> nasceria **sem** a coluna, divergente de prod.
>
> Correção aplicada: `migration_004_avatar_source.sql` declara a coluna
> (`ADD COLUMN IF NOT EXISTS` — **no-op em prod**, cria em banco novo) mais
> `CHECK ... NOT VALID`, e `migration_005` faz o `VALIDATE` separado, mesmo par
> `002`/`003` por causa do E015. `UserRow` em `db.ts` passa a declarar o campo.
> **A `001` não foi editada** — arquivo já aplicado não se reescreve
> (`AGENTS.md` §Migrations item 2); ganhou só um comentário explicando por que a
> coluna não está lá.
>
> **Feature restaurada por decisão do mantenedor (2026-07-31), não adiada.** A
> primeira versão desta análise propôs só declarar a coluna e tratar a volta da
> troca de avatar como spec própria. O mantenedor decidiu o contrário: **restaurar
> agora**, já que nada disso foi deployado. Escopo do que voltou, tudo perdido no
> mesmo restore `a7d9d20`:
>
> - **`PATCH /api/account/avatar`** — upload com validação por **magic bytes**
>   (o rótulo `Content-Type` é escolhido por quem envia; o conteúdo é confrontado
>   com a assinatura real de PNG/JPEG/WebP), teto de 2 MB antes do upload, `503`
>   discriminado quando o Cloudinary não está configurado, e reemissão dos cookies
>   de sessão — o avatar viaja dentro do token, então sem isso a foto nova só
>   apareceria no login seguinte.
> - **`DELETE /api/account`** — exclusão pelo titular, exigindo o próprio e-mail
>   digitado como confirmação. **Também estava perdida** e ninguém tinha notado:
>   é o caminho de exclusão de conta, com peso de LGPD, e o `accounts.` é a origem
>   da identidade de todos os projetos.
> - **O `CASE` no upsert** — a proteção que dá sentido à coluna, mais
>   `updateUserAvatar` marcando `'custom'`. As duas escritas são a mesma decisão.
> - **Frontend e CSS** — seção "Foto de perfil", zona de exclusão e as 4 classes
>   de estilo que também tinham sumido (`accounts-tool-panel`,
>   `accounts-danger-zone`, `accounts-file-button`, `accounts-login-danger`), sem
>   as quais a UI subiria sem formatação.
> - **Dependência e Dockerfile** — `@artificio/media` voltou ao `package.json`, e
>   o `Dockerfile` ganhou filtro explícito + `test -d packages/media/node_modules/cloudinary`.
>   Sem isso o container subiria verde e quebraria só na primeira troca de foto,
>   com `MODULE_NOT_FOUND` (padrão E016/E017).
>
> **Adaptações ao schema atual (não é cópia literal do commit antigo):**
> `updateUserAvatar` devolve `role_version`, os tokens de teste carregam
> `roleVersion`, e `readUserFromBody` no frontend passou a aceitar `moderator` e
> exigir `roleVersion` — a versão de 2026-06-29 só conhecia `user`/`admin` e
> **descartaria silenciosamente** a resposta de um moderador, trocando a foto no
> banco e não na tela.
>
> **Cobertura:** 81 testes no `accounts` (eram 73). Os 3 novos em `users.test.ts`
> cobrem os dois ramos do `CASE` e a marcação `'custom'`; provados por remoção —
> tirando o `CASE`, o caso `custom` falha e os outros seguem verdes.
>
> **O que não fazer:** procurar ambiente de beta do `accounts` (não existe, ver
> T1.9); propor `--allow-missing` ou baixar a severidade do drift; aplicar as
> migrations à mão fora do `apply_required_migrations.sh` (gera drift reverso,
> §Migrations item 5).

> **T1.13 é bloqueio duro de deploy — decisão do mantenedor, 2026-07-30.**
> Nenhuma das migrations do `accounts` jamais rodou contra Postgres real — eram 3
> quando isto foi escrito, são **5** desde 2026-07-31 (`004`/`005`, drift de
> `avatar_source`) (Docker
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
seguindo verdes) está provado só por leitura. T1.13 segue aberta.

**Correção de 2026-07-31:** a frase original aqui dizia "T1.13 segue bloqueada por
falta de Docker/Postgres". Está errada e induziu retrabalho. O que falta é Docker
**na máquina do agente**, para ensaiar num Postgres descartável. O Postgres do
`accounts` **existe e está healthy na VM** (`accounts-db`), e ler o schema dele é
read-only — o caminho está em §"Como destravar T1.13 e T1.9". Ausência de ambiente
local nunca significou ausência de banco real.

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

> **Decisões do grilling da Fase 2 — registradas em 2026-08-04; grilling CONCLUÍDO com 51 decisões.**
>
> 1. **A Fase 2 absorve o núcleo transacional mínimo de notificações da Fase 3.**
>    Entram agora `notification_event`, `notification_receipt`, geração dos recibos,
>    deduplicação de destinatários e exclusão do próprio ator, sempre na mesma
>    transação do comentário. Não entram ainda central de notificações, polling,
>    API pública de notificações nem eventos externos/outbox.
> 2. **A fase continua centrada no `accounts.` sem fingir que o registro central
>    conhece o domínio dos consumidores.** Ela define um contrato único
>    `CommentSubjectAuthorization` — alvo existente, visível, comentável,
>    `ownerUserId` confiável e `canonicalPath` — e uma suíte de conformidade
>    reutilizável. Cada backend implementará o guard específico na sua fase de
>    adoção, antes de chamar o `accounts.`.
> 3. **A árvore e a navegação seguem o Reddit como modelo primordial.** No volume
>    normal, a leitura devolve a árvore inteira; não há limite de quantidade de
>    respostas irmãs. Raiz usa `depth=0` e são permitidos quatro níveis de resposta,
>    até `depth=4` — cinco níveis visuais. `root_id`, `parent_id` e `depth` são dados
>    estruturais. Tombstone preserva posição e descendentes. A resposta tem hard
>    cap defensivo de **1.000 comentários ou 2 MiB**, o que ocorrer primeiro; só
>    então raízes/ramos restantes viram `more`, com cursor próprio e nunca filho
>    órfão. Assim o limite não aparece no volume esperado, mas uma thread não pode
>    consumir memória sem teto no `accounts.`, que também sustenta o SSO.
> 4. **Votos e score entram no produto e no desenho da Fase 2.** O comportamento de
>    abertura e ordenação seguirá o modelo do Reddit, incluindo ordenação por
>    relevância baseada em score e alternativas selecionáveis. Ainda não estão
>    decididos: semântica do voto, algoritmo e versionamento do score, tratamento
>    temporal, desempate, identidade/unicidade do voto, troca/remoção, antifraude,
>    exposição de contagens e interação entre score, tombstone, legado e
>    paginação. Não implementar schema/API antes de essas decisões fecharem.
> 5. **Somente terceiros votam.** O autor não recebe auto-upvote e não pode votar
>    no próprio comentário; todo comentário novo nasce com score `0`. Esta decisão
>    diverge deliberadamente do auto-upvote visível no modelo do Reddit: aqui o
>    score representa reação de outras contas, não participação do próprio autor.
> 6. **Comentário legado não aceita voto.** Os 25 comentários importados do `site`
>    permanecem totalmente read-only, com score `0`. Eles continuam misturados à
>    árvore e à ordenação normais — sem seção própria e sem ocultação —, apenas com
>    marca visual de comentário antigo/importado e autoria não verificada. Assim,
>    não ganham peso algorítmico novo, mas também não perdem o contexto histórico.
> 7. **Score e ordenações.** `score = upvotes - downvotes`; `Melhores` usa o
>    limite inferior de Wilson sobre a proporção positiva, sem decaimento temporal;
>    `Mais votados` ordena por score líquido; `Recentes` por `created_at DESC`;
>    `Mais antigos` por `created_at ASC`. A ordenação acontece entre irmãos, nunca
>    mistura níveis da árvore. Tempo e `id` formam o desempate estável. Tombstone
>    mantém a posição estrutural, mas não expõe corpo nem score. Estes são os quatro
>    sorts do produto; `Controversos`, `Random`, `Q&A`, `Live` e `Hot` não entram.
>    A abertura padrão é sempre `Melhores`; o usuário pode trocar o sort.
> 8. **Ranking versionado por assunto; cursor stateless.** Época fixa, ranking
>    vivo sem consistência e snapshot por sessão foram descartados. Cada assunto
>    mantém `ranking_revision`; comentário registra `created_revision`; mudança de
>    voto incrementa a revisão sob lock transacional curto. `comment_vote` guarda
>    o estado atual, único por usuário/comentário, e `comment_score_version` guarda
>    `upvotes`, `downvotes`, score, Wilson, `algorithm_version` e intervalo de
>    revisões válido. A primeira leitura fixa `snapshot_revision`; cursor opaco
>    assinado carrega identidade do assunto, sort, revisão, último sort-key, ramo,
>    limite e expiração. Páginas e expansões `more` usam a mesma revisão, sem
>    duplicar ou perder item; score exibido e voto do usuário podem vir do estado
>    atual, mas a posição permanece congelada naquela navegação. Nova visita usa a
>    revisão mais recente imediatamente. Cursor vale **30 minutos**; expirado exige
>    recarregar. Histórico de score fica retido permanentemente nesta fase — sem
>    rotina destrutiva. O modelo evita transação PostgreSQL aberta entre requests,
>    cache/sessão de paginação e cron. Referências pesquisadas: árvore truncada e
>    `more` do Reddit (`reddit-archive/reddit`, `r2/r2/models/builder.py`), contrato
>    atual `MoreChildrenRequest`, limite de snapshot exportado do PostgreSQL 16 e
>    padrão `search_after` + point-in-time da documentação do Elasticsearch.
> 9. **Score público imediatamente.** Não existe `score_hidden_until`, janela de
>    ocultação nem política por `source_app` nesta fase. O baixo volume atual e a
>    escrita autenticada tornam o custo comportamental do efeito-manada menor que a
>    complexidade e a ambiguidade de esconder o número. Se abuso real aparecer,
>    ocultação futura será mudança aditiva; não altera o modelo de voto/ranking.
> 10. **Transparência pública de contagens; moderação completa.** A resposta pública
>     expõe `upvotes`, `downvotes` e `score`; quando autenticada, também `my_vote`.
>     A superfície de moderação acessa identidade das contas votantes e histórico
>     completo de criação, troca e remoção de voto. A API pública nunca expõe a
>     lista nominal de votantes.
> 11. **Conta nova vota imediatamente e com o mesmo peso.** Não há espera,
>     quarentena, voto pendente, peso secreto nem assimetria entre upvote e
>     downvote. Proteções iniciais: uma escolha ativa por conta/comentário, rate
>     limit por usuário e IP, credencial backend-to-backend e auditoria completa
>     para moderação. Endurecimento futuro exige abuso medido, não prevenção oculta.
> 12. **Mutação de voto usa estado absoluto e última gravação vence.**
>     `PUT /internal/v1/comments/:id/vote` recebe `{ value: -1 | 0 | 1 }`; `0`
>     remove. Mesmo valor é no-op: `200`, sem nova revisão nem histórico. Troca ou
>     remoção real atualiza voto, contagens, score, versão e auditoria na mesma
>     transação. Não há `ETag`, `If-Match` nem `Idempotency-Key`; concorrência entre
>     dispositivos resolve pela última transação persistida. A escolha segue o
>     modelo de estado ternário do Reddit (`POST /api/vote`, `dir=-1|0|1`), embora
>     use `PUT` aqui por semântica HTTP. Token do app e `X-Acting-User-Id` continuam
>     obrigatórios; retry idêntico não duplica efeito.
> 13. **Voto não gera notificação.** Nem voto individual nem marco agregado cria
>     `notification_event`/`notification_receipt`; autor acompanha contagens na
>     própria thread. O núcleo transacional antecipado da Fase 3 continua restrito
>     a criação de comentário e resposta.
> 14. **Destino do voto depende da causa da perda de acesso da conta.** Saída ou
>     desativação comum preserva votos e score históricos, mas impede voto novo.
>     Bloqueio por abuso permite ao moderador invalidar todos os votos da conta,
>     com motivo e auditoria; cada assunto afetado recebe nova `ranking_revision`
>     e scores recalculados. A invalidação não apaga o histórico bruto.
> 15. **Vínculo nominal do voto é retido permanentemente.** Desativação ou pedido de
>     exclusão da conta não pseudonimiza nem remove `user_id` do voto/histórico; a
>     moderação continua capaz de identificar a conta. Consequência técnica: a
>     identidade referenciada precisa sobreviver como registro tombstone/soft-delete
>     ou identidade de auditoria — não existe exclusão física capaz de apagar a linha
>     referenciada e, ao mesmo tempo, manter vínculo nominal íntegro. O contrato de
>     exclusão de conta e a justificativa/política de retenção ainda precisam ser
>     fechados antes da implementação; não inferir esses detalhes desta decisão.
>     **Conseqüência confirmada pelo mantenedor:** conta excluída vira soft-delete
>     permanente; login é bloqueado, identidade pública neutralizada e vínculo
>     nominal fica restrito a moderação/auditoria. A política jurídica de retenção
>     continua decisão própria e bloqueia implementação desse ciclo de vida.
> 16. **IDs públicos usam UUID v4.** Comentário, `notification_event` e
>     `notification_receipt` recebem UUID v4; `parent_id` e `root_id` referenciam o
>     UUID do comentário. `legacy_id` permanece campo separado com a identidade da
>     origem. Não usar `BIGINT` enumerável nem introduzir UUID v7/ULID/lib nova.
> 17. **Autor pode editar e retirar o próprio comentário, seguindo o Reddit.** Esta
>     decisão revoga explicitamente D111 item 6, requisito 12 e a formulação atual
>     de T2.7 que proibiam autoedição/autoexclusão. Edição registra `edited_at` e
>     mantém histórico completo restrito à moderação. Retirada do autor usa
>     tombstone — nunca `DELETE` físico —, preserva posição e descendentes, oculta
>     o corpo público e entra no histórico com ator/motivo/timestamp. Poderes de
>     remoção e restauração da moderação permanecem separados.
> 18. **Edição preserva votos e ranking.** Trocar `body_text` não apaga, recalcula
>     nem invalida votos; `upvotes`, `downvotes`, score e versões de ranking seguem
>     vinculados ao mesmo comentário. O risco de bait-and-switch é tratado pelo
>     marcador público de edição e pelo histórico completo da moderação, não por
>     zerar a reação de terceiros.
> 19. **`Melhores` replica o Wilson histórico do Reddit.** Usa limite inferior
>     unilateral com `z = 1.281551565545` (80% de confiança), sem decaimento
>     temporal, sob `algorithm_version = 'reddit-wilson-80-v1'`. Fórmula e vetores
>     de referência entram em teste. Resultado persistido mantém precisão para
>     ordenação; `created_at` e `id` desempatem. Algoritmo futuro cria nova versão e
>     nova série de score; nunca reinterpreta histórico silenciosamente.
> 20. **Contrato de edição e auto-retirada.** Autor pode editar sem prazo, somente
>     `body_text`; pai, assunto, autoria e `created_at` são imutáveis. Público vê só
>     a versão atual e `edited_at`; versões antigas ficam restritas à moderação.
>     Edição idêntica é no-op e edição não gera notificação. Auto-retirada é
>     irreversível para o autor; apenas `moderator`/`admin` pode restaurar a última
>     versão válida, com auditoria.
> 21. **PostgreSQL é a fonte canônica de `score` e Wilson.** Em
>     `comment_score_version`, `upvotes` e `downvotes` são colunas base não negativas;
>     `score` é coluna gerada como `upvotes - downvotes`; `best_score` é coluna
>     gerada por função SQL `IMMUTABLE` versionada, inicialmente
>     `comment_wilson_reddit_80_v1`, usando aritmética `numeric` para manter ordenação
>     e cursor determinísticos. TypeScript/Kysely autoriza o ator, serializa a troca
>     de voto e cria a nova versão dentro da transação, mas não mantém segunda
>     implementação produtiva da fórmula. Vetores de referência testam diretamente
>     a função PostgreSQL. Versão futura cria nova função e nova série de score;
>     nunca altera semanticamente `_v1` nem reinterpreta histórico. Esta divisão
>     segue o padrão local: aplicação orquestra o workflow; banco garante derivados
>     e invariantes, inclusive contra scripts, backfills e novas rotas de escrita.
> 22. **Moderação nunca edita o texto de outro usuário.** Somente o autor pode
>     alterar `body_text`. `moderator` e `admin` podem retirar ou restaurar versões
>     válidas, sempre com motivo e auditoria, mas não reescrevem a fala alheia nem
>     fazem redação parcial. Conteúdo que exponha PII ou viole regra é retirado por
>     tombstone; uma versão corrigida exige nova edição do próprio autor. Assim a
>     identidade exibida nunca assina texto produzido pela moderação.
> 23. **Comentário legado pode receber resposta nova.** O registro importado continua
>     imutável, sem voto e marcado como antigo/autoria não verificada, mas pode ser
>     pai de comentário novo feito por conta autenticada. A nova resposta obedece ao
>     limite estrutural, autorização do assunto e regras atuais. Esta decisão revoga
>     expressamente a recusa a “resposta a legado” presente em T2.4 e T2.11: antigo
>     descreve proveniência, não congela a conversa.
> 24. **Comentário novo usa obrigatoriamente o pipeline Markdown existente.** A Fase
>     2 não cria parser, sanitizador nem renderizador paralelo. Na escrita, o backend
>     passa a entrada por `sanitizeUserMarkdown` de
>     `@artificio/content-editor/sanitize` e persiste o Markdown canônico; a API
>     devolve esse Markdown, não HTML montado. Consumidores renderizam somente por
>     `MarkdownContent`/`renderMarkdown` de `@artificio/content-editor`, cujo
>     `markdown-it` já desabilita HTML e cuja saída passa por DOMPurify. O campo novo
>     deve refletir o contrato como `body_markdown`, não o antigo `body_text`.
>     Negrito, itálico, listas, citações, código e links entram; HTML arbitrário não.
>     Esta decisão revoga expressamente o texto puro de T2.1/T2.5 e reutiliza também
>     `ContentEditor` nas interfaces de criação/edição, sem biblioteca nova.
> 25. **Comentário Markdown aceita no máximo 10.000 caracteres.** O backend valida o
>     limite tanto na entrada original, antes de trabalho de parsing, quanto no
>     Markdown canônico produzido pelo sanitizador; a interface usa o mesmo máximo
>     no `ContentEditor`. Excesso rejeita a operação inteira com erro específico —
>     nunca trunca silenciosamente nem persiste versão parcial. O mesmo contrato vale
>     para criação e edição.
> 26. **Imagem em comentário existe somente como referência HTTPS clicável.** Não há
>     upload, Cloudinary, hospedagem, proxy, preview nem busca server-side de mídia.
>     O perfil de comentário do pipeline existente desativa a renderização de
>     `<img>`: sintaxe `![alt](https://...)` vira link textual explícito, como
>     “alt — abrir imagem externa”, sem o browser buscar o recurso até o clique.
>     Referência de imagem aceita apenas `https://` e abre em nova aba com
>     `rel="ugc nofollow noopener noreferrer"`. Isso evita pixel remoto, hotlink,
>     superfície de moderação de mídia e SSRF sem criar parser paralelo.
> 27. **Links do Markdown são HTTPS-only e distinguem a suíte de destinos externos.**
>     URL sem esquema é canonicalizada para `https://`; `http:` ou qualquer outro
>     esquema explícito é rejeitado com mensagem específica, nunca promovido
>     silenciosamente. Host exato `artificiorpg.com` ou subdomínio real
>     `*.artificiorpg.com` abre na mesma aba; destino externo abre em nova aba. Todo
>     link gerado por usuário recebe `rel="ugc nofollow"`; externo acrescenta
>     `noopener noreferrer`. A comparação de host é estrutural por `URL`, não
>     `includes`/sufixo frouxo que aceite `artificiorpg.com.evil.example`.
> 28. **Link root-relative pertence ao app dono do assunto.** Sintaxe `/rota` é
>     permitida e resolvida pelo consumidor contra a origem confiável derivada de
>     `source_app`, nunca contra um host enviado no comentário; abre na mesma aba e
>     conserva portabilidade entre ambientes. São rejeitados `//host`, `../`, URL
>     relativa sem `/` inicial e qualquer forma ambígua capaz de mudar de destino
>     conforme a tela consumidora. O `accounts.` valida a forma; o backend consumidor
>     fornece a origem canônica já prevista no contrato do assunto.
> 29. **Link proibido falha; Markdown apenas malformado permanece texto, usando uma
>     única política compartilhada.** Sintaxe incompleta que o CommonMark trata como
>     literal é aceita e exibida literalmente. Quando o parser reconhece um link,
>     porém o destino viola as decisões 26–28 (`http:`, esquema perigoso, `//host`,
>     relativo ambíguo), criação ou edição inteira é rejeitada com código estável
>     `INVALID_COMMENT_LINK`, posição e mensagem da regra, sem ecoar o payload hostil.
>     Nada é removido ou reescrito silenciosamente. A validação e o perfil de
>     renderização pertencem ao pacote compartilhado **já existente**
>     `@artificio/content-editor`; não nasce pacote novo nem implementação local por
>     app. `accounts.` e todos os frontends importam a mesma política. O cliente usa
>     isso para erro imediato/prévia; o backend repete como autoridade final.
> 30. **Comentário precisa produzir conteúdo textual visível.** Depois da
>     canonicalização e sanitização, `markdownToPlainText` do pipeline compartilhado
>     precisa resultar em conteúdo não vazio. Espaços, HTML integralmente removido,
>     separador temático isolado ou marcadores sem texto são rejeitados; emoji,
>     código, citação e link com rótulo visível são aceitos. Não existe mínimo
>     arbitrário além de um conteúdo real, e a regra vale igualmente para criação e
>     edição.
> 31. **Não há `@menções` nesta fase.** Qualquer `@texto` permanece texto Markdown
>     comum e nunca resolve conta nem cria destinatário. `accounts.users` não possui
>     handle público único: nome Google é mutável/não único e e-mail não pode ser
>     exposto. Notificação continua derivada apenas da estrutura confiável — autor do
>     comentário pai e dono do assunto, excluindo o ator. Menção futura exige decisão
>     própria de identidade pública; não será simulada por heurística sobre nome.
> 32. **Denúncia de comentário entra no núcleo da Fase 2.** A fila já prometia itens
>     denunciados e a matriz já autorizava usuário a denunciar, mas o contrato não
>     tinha schema nem rota que produzisse esse estado. A lacuna é fechada agora no
>     `accounts.`: persistência, API interna consumida pelas fachadas dos apps, fila
>     compartilhada, resolução e auditoria pertencem à mesma entrega. Denúncia não
>     será armazenada isoladamente em cada app nem adiada enquanto a fila central
>     finge que pode recebê-la.
> 33. **Denúncia exige conta, terceiro e unicidade por comentário.** Autor não
>     denuncia o próprio comentário porque pode editar ou auto-retirar; cada conta
>     mantém no máximo uma denúncia ativa por comentário. A identidade do denunciante
>     é persistida e visível somente a `moderator`/`admin`; público, outros
>     denunciantes e autor denunciado nunca a recebem. A escolha é deliberadamente
>     mais próxima do Discourse — staff vê quem sinalizou — que do Reddit, onde
>     moderador comunitário não sabe. Aqui o moderador é papel global concedido e
>     auditado pelo `accounts.`, não voluntário limitado a uma comunidade; precisa
>     investigar abuso coordenado sem expor o denunciante ao alvo.
> 34. **Denúncia isolada não oculta; múltiplas denúncias podem ocultar
>     temporariamente.** Uma denúncia apenas cria/prioriza item na fila. Ao atingir o
>     limiar de **cinco contas distintas**, o comentário passa para estado próprio
>     `pending_review_hidden`: público vê placeholder, corpo e score somem, posição e
>     descendentes permanecem. Isso não é tombstone nem decisão de moderador. A fila
>     conserva corpo, denúncias e identidades; moderação confirma a retirada ou
>     descarta as denúncias e restaura a visibilidade, tudo auditado. Contam somente
>     denúncias ativas, ainda não resolvidas, de contas válidas; a mesma conta nunca
>     soma duas vezes. O limiar alto é deliberado: em baixo volume, auto-ocultação
>     será rara, priorizando resistência a coordenação entre poucas contas.
> 35. **Solução madura de um app sobe ao compartilhado; não é reimplementada nos
>     demais.** O fluxo de denúncias do `downloads` é fonte de aprendizado para o
>     núcleo central: estados `open`/`in_review`/`resolved`/`dismissed`, uma denúncia
>     ativa por denunciante e alvo, nova denúncia após decisão terminal, “minhas
>     denúncias”, retirada voluntária antes da análise, prioridade, detalhes e nota
>     de resolução separados, aviso do resultado, sinal de sequência abusiva sem
>     punição automática, contexto do alvo na fila e auditoria. O que for geral é
>     consolidado no `accounts.` e exposto pelo único `packages/comments`; frontends
>     e fachadas importam/consomem isso, sem pacote de denúncia separado, cópia por
>     app ou segundo state machine. Elementos realmente de domínio — por exemplo
>     `material_id` e motivo “link quebrado” de material — ficam no adaptador do
>     domínio, não contaminam o contrato comum. “Subir ao compartilhado” significa
>     extrair a solução corrigida, não copiar cegamente a implementação local.
> 36. **Três defeitos do fluxo local de denúncia do `downloads` são corrigidos na
>     adoção dele pela spec 090, não durante a Fase 2 central.** (a) `GET /mine`,
>     `GET /abuse-check/:userId` e `GET /reports` deixam de consumir
>     `writeRateLimiter` e usam orçamento de leitura; (b) decisão terminal deixa de
>     fazer check-before-transaction seguido de `UPDATE` só por `id` e passa a
>     serializar/condicionar a transição, garantindo um único vencedor, uma única
>     notificação e conflito explícito ao segundo moderador; (c) auditoria de decisão
>     deixa de ser somente `console.log` e vira registro persistente na mesma
>     transação do estado. A Fase 2 implementa esses invariantes corretamente desde o
>     início; a fase de adoção remove a divergência local também para o fluxo que
>     continuar específico de material. Esta é organização temporal decidida pelo
>     mantenedor, não autorização para preservar os bugs.
> 37. **Motivos de denúncia vivem em registro compartilhado extensível por tipo de
>     alvo.** O núcleo declara código, rótulo, prioridade e obrigatoriedade de
>     detalhes para `malicious_link`, `inappropriate_content`, `spam_or_off_topic`,
>     `harassment_or_hate`, `personal_data`, `copyright_violation`,
>     `illegal_content` e `other`. Formulário, schema, estado e fila consomem esse
>     registro único. Cada tipo de alvo apenas habilita um subconjunto ou acrescenta
>     definição realmente de domínio — por exemplo `broken_link` em material — pelo
>     mesmo contrato declarativo. Nenhum app cria enum, componente ou state machine
>     paralelo; também não se obriga comentário a mostrar motivo sem sentido só para
>     manter um enum rígido.
> 38. **Prioridade mede urgência/reversibilidade durante a espera, não culpa.** O
>     registro compartilhado inicia com P0 para `personal_data`, `malicious_link` e
>     `illegal_content`; P1 para `harassment_or_hate`, `inappropriate_content` e
>     `copyright_violation`; P2 para `spam_or_off_topic` e `other`; `broken_link` de
>     material permanece P3. Categoria/P0 só ordena a fila e nunca oculta ou decide
>     conteúdo sozinha — o único auto-hide continua sendo o limiar de cinco denúncias
>     distintas da decisão 34. Moderador pode reclassificar prioridade, sempre com
>     motivo e auditoria persistente.
> 39. **Denúncia fixa a versão imutável existente no instante do envio.**
>     `comment_reports` guarda `comment_id` e `reported_version_id` obrigatório para
>     `comment_versions`; criação captura ambos atomicamente e a integridade garante
>     que a versão pertence ao mesmo comentário. Edição posterior cria nova versão,
>     não altera a evidência e não resolve nem retira a denúncia da fila. Moderação
>     vê lado a lado versão denunciada, versão atual, diff e histórico; o relatório
>     não duplica o corpo. Versão referenciada não sofre purga automática. Conteúdo
>     sensível exige expurgo administrativo explícito e auditado: corpo da revisão
>     sai, metadados do evento permanecem. A escolha é adaptação do projeto, não
>     alegação sobre schema interno de terceiros: Reddit documenta filas de
>     denunciados e editados, GitHub liga denúncia ao comentário e mantém histórico,
>     e Discourse mantém o item editado em revisão e registra todas as revisões de
>     conteúdo sinalizado para permitir julgamento do original. Rejeitadas: somente
>     `comment_id` + inferência por horário (ambígua em concorrência) e snapshot do
>     corpo dentro da denúncia (duplica conteúdo, PII, política de retenção e
>     expurgo).
> 40. **Moderação agrupa denúncias por caso episódico do comentário.** Existe no
>     máximo um `moderation_case` aberto por comentário; cada denúncia continua uma
>     linha individual, imutável como evidência, ligada ao caso. A fila mostra um
>     item agregado com quantidade, categorias, prioridade máxima e, apenas para a
>     moderação, identidades dos denunciantes. Decisão terminal fecha o caso e as
>     denúncias ativas vinculadas sem apagar o histórico. Denúncia válida posterior
>     abre novo caso, em vez de reabrir ou misturar o episódio encerrado. A interface
>     segue a unidade de trabalho por conteúdo observada no Reddit e no Discourse,
>     mas preserva granularidade individual para auditoria. Rejeitadas: uma entrada
>     de fila por denúncia, que duplica trabalho e permite decisões concorrentes; e
>     um caso eterno por comentário, que mistura versões, incidentes e decisões de
>     épocas diferentes.
> 41. **Editar não revela comentário auto-oculto.** Depois de alcançar o limiar de
>     cinco denúncias e entrar em `pending_review_hidden`, o autor ainda pode editar
>     normalmente e cada edição cria nova versão, mas comentário e caso permanecem
>     oculto e aberto. A moderação compara versão denunciada, versão atual e diff;
>     somente ação explícita dela restaura, remove ou encerra o caso. A escolha
>     diverge deliberadamente do Discourse, que revela o conteúdo na primeira edição
>     corretiva: no Artifício, edição unilateral não pode republicar link malicioso,
>     dado pessoal ou conteúdo ilegal já retirado por sinal coletivo. O custo aceito
>     é correção legítima aguardar revisão humana.
> 42. **Denunciante só pode retirar antes do auto-hide.** Enquanto o caso está aberto
>     e o comentário ainda visível, a própria denúncia ativa pode virar `withdrawn`:
>     deixa de contar para o limiar, mas permanece na auditoria. Assim que a quinta
>     denúncia distinta confirma `pending_review_hidden`, as denúncias do caso ficam
>     bloqueadas para seus autores; somente a moderação pode invalidar, resolver ou
>     dispensar dali em diante. A transição do caso, a inserção da quinta denúncia e
>     qualquer retirada concorrente são serializadas na mesma transação/lock: se a
>     retirada concluir antes, o limiar é recalculado; se o auto-hide concluir antes,
>     a retirada é recusada. Rejeitadas: permitir retirada sem restaurar, que deixa o
>     usuário mudar evidência depois do gatilho sem alterar consequência, e restaurar
>     automaticamente ao cair abaixo de cinco, que permite oscilação coordenada de
>     visibilidade.
> 43. **Veredito é individual por denúncia; ação sobre conteúdo é única por caso.**
>     Cada denúncia não retirada termina como `upheld`, `dismissed` ou
>     `no_determination`; o caso recebe uma ação única entre `no_change`,
>     `restore` e `remove`. A interface pode preencher um veredito em lote, mas
>     permite corrigir cada denúncia antes de concluir. O caso só fecha quando todas
>     as denúncias não retiradas têm veredito e a ação foi persistida na mesma
>     transação, com moderador, motivo e auditoria. `upheld` conta como acerto,
>     `dismissed` como erro; `withdrawn` e `no_determination` são neutros para sinais
>     de abuso. Assim, link malicioso pode proceder sem transformar uma denúncia
>     simultânea e infundada de assédio em acerto. A separação segue a prática do
>     Discourse de distinguir julgamento da flag da ação sobre o post. Rejeitados:
>     um veredito herdado por todo o caso e um veredito por categoria, ambos
>     imprecisos para reputação do denunciante e detalhes individuais.
> 44. **Resultado da moderação é privado, mínimo e entregue aos dois lados.** Cada
>     denunciante recebe pelo núcleo compartilhado de notificações somente um dos
>     resultados `action_taken`, `not_upheld` ou `no_determination`, correspondente
>     ao próprio veredito; nunca recebe identidade de outro denunciante, nota interna,
>     detalhe de ação disciplinar ou raciocínio reservado. O autor recebe aviso
>     quando o comentário entra em auto-hide e quando a moderação remove ou restaura,
>     com categoria pública aplicável e orientação de próximo passo. Evento e recibos
>     nascem na mesma transação da mudança de estado, deduplicam destinatário e nunca
>     notificam o próprio ator da ação. A escolha usa o núcleo transacional já
>     absorvido pela Fase 2 e prefere feedback proporcional ao baixo volume do
>     Artifício; rejeita tanto transparência detalhada, que expõe pessoas e lógica
>     interna, quanto silêncio ao denunciante, adequado à escala do Reddit mas sem
>     necessidade aqui.
> 45. **Versão aprovada pela moderação ganha imunidade contra reabertura automática.**
>     Quando um caso termina com `no_change` sobre conteúdo visível ou `restore` e as denúncias relevantes
>     são improcedentes, a aprovação referencia a `comment_version_id` revisada.
>     Denúncia posterior contra essa mesma versão ainda é recebida e auditada como
>     `no_determination`, com motivo interno `approved_version`, mas não abre caso,
>     não conta para novo limiar e não altera visibilidade; o denunciante recebe só o
>     resultado mínimo da decisão 44. Moderador pode reabrir manualmente com motivo.
>     Edição cria versão nova, não coberta pela aprovação anterior e novamente
>     denunciável. A regra adapta `Ignore reports and Approve` do Reddit e impede
>     brigada infinita de ocultar o mesmo texto já revisado. Rejeitados: cooldown,
>     que apenas agenda o novo ataque, e ausência de proteção, que torna a fila e a
>     visibilidade controláveis por sucessivos grupos de cinco contas.
> 46. **Auto-retirada cria tombstone imediatamente, mas não encerra moderação.** O
>     autor pode retirar o próprio comentário mesmo com caso aberto; o corpo some da
>     leitura pública, a ação entra na timeline e as versões já gravadas continuam
>     acessíveis somente à moderação. O caso permanece aberto, cada denúncia recebe
>     veredito e a retirada não vale como confissão. Resolver com `no_change` preserva
>     o tombstone escolhido pelo autor; `restore` exige ação moderadora explícita e
>     nunca decorre automaticamente de denúncia improcedente. A auto-retirada antes
>     do limiar não congela a retirada dos denunciantes — só a transição para
>     `pending_review_hidden` da decisão 42 o faz. Para suportar este estado sem
>     falsificar auditoria, `no_change` substitui o nome anterior `keep_visible` na
>     decisão 43: significa não alterar a visibilidade atual, esteja ela visível ou
>     retirada pelo autor. A escolha preserva autonomia pública sem permitir apagar
>     evidência ou fugir do julgamento.
> 47. **Remoção moderadora admite um recurso estruturado em até seis meses.** Somente
>     o autor pode recorrer, uma vez por decisão terminal que removeu seu conteúdo;
>     o recurso pertence ao núcleo compartilhado, referencia caso, decisão e versão,
>     não restaura automaticamente e termina em `upheld` ou `reversed`, com
>     notificação privada. Denunciante não recorre de `not_upheld`. Diferente do
>     modelo ideal de equipe grande do GitHub, **não há exigência de segundo
>     moderador**: a equipe inicial do Artifício é reduzida e o mesmo moderador pode
>     rejulgar. A tela deixa explícito que ele tomou a decisão original e exige nova
>     justificativa; ator, datas e resultado ficam na auditoria. Outro moderador pode
>     assumir quando existir, mas isso não é trava. Rejeitados: reabrir e sobrescrever
>     o caso original, que mistura as duas instâncias, e recurso apenas por contato
>     externo, que faria cada app criar fluxo próprio e não rastreável.
> 48. **Sanção é comunitária, escalonável e separada do acesso à suíte.** O
>     `accounts.` mantém restrições independentes para `posting` e `commenting`, com
>     escada `warning` → suspensão temporária → suspensão permanente; a temporária
>     aceita duração explícita e presets operacionais, e uma decisão pode atingir um
>     ou os dois escopos. Histórico e gravidade ficam visíveis para sugerir
>     progressão, mas nenhuma denúncia, limiar ou reincidência aplica sanção
>     automaticamente: moderador escolhe nível, prazo e motivo, tudo auditado. Login,
>     leitura e uso não comunitário dos projetos continuam; auto-retirada de conteúdo
>     próprio também continua permitida. A Fase 2 já faz `commenting` falhar fechado
>     antes da escrita. `posting` nasce no mesmo contrato central para os demais apps
>     adotarem ao mapear suas superfícies de publicação comunitária; não transforma
>     silenciosamente criar mesa, material ou outro objeto de domínio em postagem.
>     Voto e denúncia mantêm seus controles de abuso próprios já decididos, em vez de
>     serem confundidos com esses dois escopos. Rejeitados: só remover conteúdo, que
>     não contém reincidência, e suspender o SSO inteiro, cujo blast radius alcançaria
>     todos os subdomínios por um caso de comentário.
> 49. **Necessidade de detalhe é declarada por motivo no registro compartilhado.**
>     Cada razão define `details: required | optional | forbidden`; inicialmente
>     `other`, `copyright_violation` e `illegal_content` exigem detalhe, e as demais
>     o aceitam opcionalmente. O campo é texto puro normalizado com trim, máximo de
>     4.000 caracteres — limite já exercitado pelo fluxo maduro do `downloads` — e,
>     quando obrigatório, vazio é rejeitado. Depois do envio é imutável; o usuário
>     pode retirar a denúncia somente nas condições da decisão 42. Detalhe fica
>     restrito à moderação, nunca aparece para autor/público, notificação, log ou
>     mensagem de erro com eco do payload. O mesmo schema e formulário atendem todos
>     os apps; tipo de domínio apenas configura o registro. A escolha segue o modelo
>     configurável do Discourse e rejeita tanto detalhe sempre opcional, que torna
>     `other` inútil, quanto sempre obrigatório, que fabrica ruído em violações
>     autoexplicativas.
> 50. **Antiabuso usa buckets independentes por camada, identidade e ação.** O
>     backend de cada app aplica limites separados por IP real validado na própria
>     borda e por usuário; o `accounts.`, que em escrita backend-to-backend enxerga o
>     serviço chamador em vez do navegador, aplica por usuário e por credencial de
>     `source_app`. Leitura, criação/resposta, edição, voto, denúncia e recurso têm
>     buckets próprios e valores configuráveis; nenhum consome a cota de login,
>     `/me` ou refresh. Todos os buckets aplicáveis precisam permitir a operação —
>     não se usa chave combinada IP+usuário. Excesso retorna `429` e orientação
>     genérica de espera, sem revelar qual bucket, limite restante ou sinal interno.
>     Antes de calibrar números, T2.10 continua obrigada a medir qual IP chega hoje
>     pelo Cloudflare/trusted proxy; limiares iniciais são configuração operacional
>     revisável com teste, não regra pétrea do produto. Rejeitados: só usuário, que
>     não contém multiconta/leitura anônima, e só IP, que bloqueia NAT e pode reduzir
>     toda a suíte ao endereço do proxy ou backend.
> 51. **Não há cache persistente de comentários nesta fase.** `packages/comments`
>     mantém apenas o estado em memória da tela montada: se uma atualização falhar
>     depois de uma leitura bem-sucedida, pode conservar aquele resultado como
>     `stale`, com idade e aviso; recarregar ou abrir a página durante a queda não
>     consulta IndexedDB, localStorage, Redis nem cache público no Cloudflare e
>     mostra `unavailable` somente na área de comentários. A página do app continua
>     funcional e toda escrita falha fechada. Logout/troca de conta descarta o estado
>     em memória. Esta decisão aceita deliberadamente perder comentários entre
>     recargas durante indisponibilidade e **substitui a exigência anterior de provar
>     degradação stale sobrevivendo ao reload**; evita persistir UGC removido, estado
>     personalizado e mecanismo de invalidação distribuído antes de haver escala que
>     o justifique. Rejeitados: IndexedDB compartilhado e cache de edge/Cloudflare.
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
> **Tasks reformuladas a partir destas decisões em 2026-08-04.** O bloco acima é a
> fonte; T2.1–T2.20 abaixo são a execução dele e foram reescritas para não
> contradizê-lo. Onde uma task dizia o oposto de uma decisão, o texto antigo foi
> substituído e a revogação anotada na própria task — não silenciosamente. Mapa
> das inversões, para quem revisar sem reler as 40 decisões:
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
>
> **Tasks novas criadas pela reformulação:** T2.1b–T2.1e (schema de versão, voto,
> notificação e denúncia), T2.5b (perfil de comentário e política de link no
> pacote compartilhado), T2.6b (sem menções), T2.7b (edição/auto-retirada),
> T2.12–T2.16 (voto), T2.17–T2.20 (denúncia e moderação).
>
> **Dois itens seguem abertos, por decisão registrada e não por omissão:** a
> política jurídica de retenção/exclusão de conta bloqueia o ciclo de vida de
> T2.15, e o regime real do rate limit (por usuário ou por IP de borda) segue não
> medido em T2.10. Nenhum dos dois foi resolvido por inferência aqui.

> **Estado medido do ambiente antes de começar a fase (2026-08-04, leitura read-only, não inferência).**
> Levantado depois que a Fase 1 entrou em produção. Números medidos, não estimados —
> substituem qualquer suposição herdada do texto original da spec.
>
> **Banco do `accounts.` (`artificio_auth`, prod) — a fase nasce do zero.**
> Só quatro tabelas existem: `users`, `admin_secrets`, `global_role_audit`,
> `schema_migrations`. **Nenhuma tabela de comentário existe.** Não há legado
> interno ao `accounts.` a preservar, nem migração incremental a fazer: T2.1
> escreve schema novo.
>
> **⚠️ Guard `MAX_AUTO_PENDING=5` — a primeira migration desta fase estoura.**
> O `accounts` tem hoje **exatamente 5** migrations aplicadas (`001`…`005`), e o
> comparador de `apply_required_migrations.sh:95` é `-gt`. A migration de T2.1 é a
> **sexta**: no deploy seguinte o runner encontra 6 > 5 e **aborta**. Isso não é
> hipótese — é aritmética do guard que já foi observado em produção (E012).
> Consequência prática para quem implementar: **a fase não pode ser deployada
> "só quando estiver pronta" sem tratar o guard**. Ou a migration entra num deploy
> onde `MAX_AUTO_PENDING` é ajustado ao total pendente pelo procedimento oficial
> (`AGENTS.md` §Migrations item 4, com o mesmo script, nunca fatiando em lotes),
> ou a fase é promovida em pedaços que mantenham a contagem ≤ 5. Decisão do
> mantenedor, não do agente. Registrar aqui o caminho escolhido antes do primeiro
> deploy da fase.
>
> **Legado do `site` (T2.8) — medido em produção (`site-prod-db`, banco `site`):**
>
> | Métrica | Valor real |
> |---|---|
> | Comentários | **25** |
> | Com `parent_id` | **3** |
> | Pais órfãos | **0** |
> | Autores distintos (`author_name`) | **21** |
>
> O `parent_id BIGINT` **sem FK** está confirmado em
> `apps/site/db/migrations/001_init.sql:66` — a ausência de FK é real e T2.8
> procede como escrita. Mas o risco que ela antecipa **não se materializou neste
> conjunto**: zero órfãos, zero ciclos possíveis com 3 relações. A detecção
> continua obrigatória (é barata e o dado pode mudar antes do import), só não é o
> caminho provável. O "25" que T6.3 desconfiava ser número chutado **é o número
> real**; a desconfiança pode ser encerrada com esta medição.
- [ ] T2.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T2.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.

### Bloco A — Schema

- [ ] T2.1 — **Schema do comentário, com identidade pública UUID v4 e corpo Markdown** (requisitos 5, 8, 9; decisões 3, 16, 24). Reformulado em 2026-08-04: a formulação anterior pedia `body_text` (texto puro) e `depth<=2`, ambos revogados pelo grilling. Exigir: `id UUID` v4 como identidade pública, **nunca `BIGINT` enumerável** (decisão 16), sem UUID v7/ULID/lib nova; `realm`, `source_app`, `subject_type`, `subject_id TEXT` (T0.6); `user_id`, `parent_id UUID`, `root_id UUID` **obrigatório, não opcional** (decisão 3), `depth` com raiz em `0` e máximo `4`; **`body_markdown` para o comentário novo e campo próprio para o HTML legado — nunca campo ambíguo** (T0.9, decisão 24); `created_at`, `edited_at`; `removed_at`, `removed_by`, `removed_reason`; `ranking_revision` por assunto e `created_revision` por comentário (decisão 8); estado de visibilidade que comporte `pending_review_hidden` (decisão 34); `legacy_source`, `legacy_id`, `legacy_author_name`, com **`unique (legacy_source, legacy_id)`** para importação idempotente; e índice de listagem na ordem `(realm, source_app, subject_type, subject_id, created_at, id)`. · feito quando: migration idempotente, com header válido, passando no guard.
- [ ] T2.1b — **Schema de versões do comentário** (decisões 17, 20, 39). `comment_versions` guarda todo `body_markdown` já válido, com autor da versão e timestamp. O público lê só a versão atual e `edited_at`; versões antigas são restritas a `moderator`/`admin`. A tabela é pré-requisito de T2.7b (edição) e de T2.12 (denúncia fixa `reported_version_id`) — sem ela a evidência de denúncia é ambígua. Versão referenciada por denúncia **não sofre purga automática**; expurgo de conteúdo sensível é ato administrativo explícito e auditado, que remove o corpo da revisão e preserva os metadados do evento. · feito quando: editar cria versão nova sem destruir a anterior, e o público não alcança versão antiga.
- [ ] T2.1c — **Schema de voto e score** (decisões 4, 5, 7, 8, 21). `comment_vote` guarda o **estado atual** do voto, único por `(user_id, comment_id)`. `comment_score_version` guarda `upvotes` e `downvotes` como **colunas base não negativas**, `score` como **coluna gerada** `upvotes - downvotes`, `best_score` como **coluna gerada por função SQL `IMMUTABLE` versionada** — inicialmente `comment_wilson_reddit_80_v1`, aritmética `numeric` para ordenação e cursor determinísticos —, mais `algorithm_version` e o intervalo de revisões em que a versão é válida. **PostgreSQL é a fonte canônica**: TypeScript/Kysely autoriza o ator, serializa a troca e cria a versão dentro da transação, mas **não mantém segunda implementação produtiva da fórmula** (decisão 21). Comentário novo nasce com score `0`; não há auto-upvote (decisão 5). Histórico de score é retido permanentemente nesta fase, sem rotina destrutiva (decisão 8). · feito quando: migration idempotente; tentativa de gravar `score` ou `best_score` diretamente falha; e `upvotes`/`downvotes` negativos são rejeitados pelo banco.
- [ ] T2.1d — **Schema de notificação transacional antecipado da Fase 3** (decisão 1). Entram **agora** `notification_event` e `notification_receipt`, com a mesma estrutura que T3.1 especifica — evento imutável separado do estado por destinatário. Não entram central de notificações, polling, API pública de notificações nem outbox/eventos externos: esses continuam na Fase 3. Justificativa da antecipação: sem recibo transacional, o comentário nasceria com notificação best-effort, que é exatamente o defeito que T3.5 corrige no `downloads`. · feito quando: as duas tabelas existem e a Fase 3 não precisa migrá-las, só consumi-las.
- [ ] T2.1e — **Schema de denúncia, caso de moderação e registro de motivos** (decisões 32, 33, 37, 39, 40). `comment_reports` com `comment_id`, `reported_version_id` **obrigatório** apontando para `comment_versions`, denunciante, motivo, detalhes, estado e auditoria; integridade garante que a versão pertence ao mesmo comentário. Unicidade: **no máximo uma denúncia ativa por conta e comentário** (decisão 33). `moderation_case` com **no máximo um caso aberto por comentário** (decisão 40); cada denúncia permanece linha individual imutável ligada ao caso. Registro compartilhado de motivos declarando código, rótulo, prioridade e obrigatoriedade de detalhes para `malicious_link`, `inappropriate_content`, `spam_or_off_topic`, `harassment_or_hate`, `personal_data`, `copyright_violation`, `illegal_content` e `other` (decisão 37), com prioridades iniciais P0/P1/P2 da decisão 38. Nenhum app cria enum ou state machine paralelo. · feito quando: migration idempotente; segunda denúncia ativa da mesma conta no mesmo comentário é rejeitada pelo banco; e segundo caso aberto no mesmo comentário é rejeitado pelo banco.

> **Nota de sequenciamento — T2.1 a T2.1e são uma migration só, não cinco.**
> `AGENTS.md` §Migrations item 2.1 proíbe fatiar em vários arquivos o schema de uma
> mesma spec no mesmo diff quando as tabelas nascem juntas e dependem umas das
> outras — e aqui dependem: denúncia referencia versão, versão referencia
> comentário, score referencia comentário. Fatiar também multiplicaria o problema
> do guard `MAX_AUTO_PENDING=5` descrito no topo da fase: cinco arquivos contam
> como cinco migrations pendentes. As tasks estão separadas por **assunto de
> revisão**, não por arquivo de migration.

### Bloco B — Escrita, autorização e integridade

- [ ] T2.2 — **Contrato `CommentSubjectAuthorization` e suíte de conformidade** (requisito 6; decisão 2). Reformulado: a versão anterior dizia apenas "o backend do módulo valida antes de chamar", sem contrato nomeado. O `accounts.` não conhece material nem mesa e **não deve fingir que conhece**; ele define um contrato único — alvo existente, visível, comentável, `ownerUserId` confiável e `canonicalPath` — mais uma **suíte de conformidade reutilizável** que cada backend consumidor roda contra a própria implementação. O guard específico é implementado por cada app na sua fase de adoção, antes de chamar o `accounts.`. Referência opaca **não** substitui autorização por objeto — sem isso o atacante comenta em assunto inexistente ou invisível (OWASP IDOR). · feito quando: o contrato e a suíte existem no compartilhado; comentário em assunto inexistente, invisível ou fechado é recusado; e escrita direta do navegador não é aceita.
- [ ] T2.3 — **Leitura em árvore com cursor versionado por revisão** (requisito 6; decisões 3, 8). Reformulado: a versão anterior tratava a listagem como lista plana paginada por `(created_at, id)`, o que o grilling revogou. No volume normal a leitura devolve **a árvore inteira**, sem limite de respostas irmãs. Hard cap defensivo de **1.000 comentários ou 2 MiB**, o que ocorrer primeiro; só então raízes/ramos restantes viram `more`, com cursor próprio e **nunca filho órfão**. A primeira leitura fixa `snapshot_revision`; o cursor é **opaco e assinado**, carregando identidade do assunto, sort, revisão, último sort-key, ramo, limite e expiração de **30 minutos**. Páginas e expansões `more` usam a mesma revisão, sem duplicar nem perder item; score exibido e `my_vote` podem vir do estado atual, mas a **posição permanece congelada** naquela navegação. Nova visita usa a revisão mais recente imediatamente; cursor expirado exige recarregar. O modelo evita transação PostgreSQL aberta entre requests, cache de paginação e cron. · feito quando: árvore de 1.500 comentários devolve `more` sem órfão; expansão na mesma revisão não duplica nem perde item; e cursor expirado falha explicitamente em vez de devolver posição errada.
- [ ] T2.3b — **As quatro ordenações do produto** (decisões 7, 19). `Melhores` (padrão de abertura) usa o **limite inferior de Wilson unilateral com `z = 1.281551565545`** (80% de confiança), sem decaimento temporal, sob `algorithm_version = 'reddit-wilson-80-v1'`; `Mais votados` ordena por score líquido; `Recentes` por `created_at DESC`; `Mais antigos` por `created_at ASC`. A ordenação acontece **entre irmãos, nunca misturando níveis** da árvore. `created_at` e `id` formam o desempate estável. Tombstone mantém a posição estrutural mas não expõe corpo nem score. `Controversos`, `Random`, `Q&A`, `Live` e `Hot` **não entram**. Fórmula e vetores de referência entram em teste, **testando diretamente a função PostgreSQL** de T2.1c, não uma reimplementação em TypeScript. Algoritmo futuro cria nova versão e nova série de score; nunca reinterpreta histórico silenciosamente. · feito quando: os quatro sorts testados; vetores de Wilson batem contra a função SQL; e nenhuma ordenação mistura níveis da árvore.
- [ ] T2.4 — **Integridade de thread validada na transação** (requisito 8; decisões 3, 23). Reformulado em dois pontos que o grilling revogou: a profundidade máxima é **`depth<=4`**, não `depth<=2`; e **resposta a comentário legado é permitida**, não recusada — o registro importado continua imutável, sem voto e marcado como antigo/autoria não verificada, mas **pode ser pai** de comentário novo de conta autenticada (decisão 23: antigo descreve proveniência, não congela a conversa). O pai precisa existir, pertencer ao **mesmo `realm`, `source_app` e assunto**, aceitar respostas e produzir `depth<=4`. `root_id` é derivado na escrita, nunca aceito do cliente. Rejeitar na escrita, não corrigir depois. · feito quando: resposta cross-subject, cross-realm ou além de `depth=4` é recusada — inclusive sob concorrência — e resposta a legado é **aceita** com `depth` correto.
- [ ] T2.5 — **Markdown pelo pipeline compartilhado existente; DOMPurify só no legado** (requisito 10; decisões 24, 25, 30). Reformulado: a versão anterior mandava texto puro no comentário novo, revogado pela decisão 24. A Fase 2 **não cria parser, sanitizador nem renderizador paralelo**. Na escrita, o backend passa a entrada por `sanitizeUserMarkdown` de `@artificio/content-editor/sanitize` e persiste o **Markdown canônico**; a API devolve esse Markdown, **não HTML montado**. Consumidores renderizam somente por `MarkdownContent`/`renderMarkdown` de `@artificio/content-editor`, cujo `markdown-it` já roda com `html: false` e cuja saída passa por DOMPurify. Limite de **10.000 caracteres**, validado **tanto na entrada original, antes do trabalho de parsing, quanto no Markdown canônico produzido** (decisão 25); excesso rejeita a operação inteira com erro específico, **nunca trunca silenciosamente nem persiste versão parcial**. Depois da canonicalização, `markdownToPlainText` precisa resultar em **conteúdo não vazio** (decisão 30): espaços, HTML integralmente removido, separador temático isolado ou marcadores sem texto são rejeitados; emoji, código, citação e link com rótulo visível são aceitos. As três regras valem igualmente para criação e edição. O legado do `site` tem `content_html` e é sanitizado **uma vez, na entrada**, com política e versão registradas; a saída passa por defesa adicional **sem regravar o banco**. Nunca ressanitizar continuamente nem alterar o HTML depois de sanitizado (anula a proteção). · feito quando: testes de XSS cobrindo script, links, SVG/MathML, atributos e o HTML legado; entrada de 10.001 caracteres rejeitada antes do parsing; e comentário que sanitiza para vazio rejeitado.
- [ ] T2.5b — **Perfil de comentário e política de link no `@artificio/content-editor`** (decisões 26, 27, 28, 29). **Task nova, criada em 2026-08-04 a partir de leitura do código real.** As decisões 26–29 pressupõem um perfil de renderização de comentário que **hoje não existe no pacote**: `packages/content-editor/src/sanitize.ts:10` e `ContentEditor.tsx:6` configuram `MarkdownIt` com `html: false`, o que já barra HTML bruto, mas **não há desativação de `<img>` nem qualquer política de destino de link**. Sem esta task, as decisões 26–29 não têm onde ser implementadas — e a decisão 29 proíbe expressamente implementação local por app. Exigir, dentro do pacote compartilhado já existente: (a) **imagem só como referência HTTPS clicável** — `![alt](https://...)` vira link textual explícito (“alt — abrir imagem externa”), o browser **não busca o recurso até o clique**, sem upload, Cloudinary, hospedagem, proxy, preview ou busca server-side; (b) **links HTTPS-only** — URL sem esquema é canonicalizada para `https://`, `http:` ou qualquer outro esquema explícito é **rejeitado com mensagem específica, nunca promovido silenciosamente**; (c) **comparação de host estrutural por `URL`**, nunca `includes`/sufixo frouxo que aceite `artificiorpg.com.evil.example` — host exato `artificiorpg.com` ou subdomínio real abre na mesma aba, externo abre em nova aba; (d) **`rel="ugc nofollow"` em todo link de usuário**, mais `noopener noreferrer` no externo; (e) **link root-relative `/rota`** resolvido pelo consumidor contra a origem confiável derivada de `source_app`, **nunca contra host enviado no comentário**, rejeitando `//host`, `../`, relativo sem `/` inicial e qualquer forma ambígua; (f) **política de falha única e compartilhada** — sintaxe incompleta que o CommonMark trata como literal é aceita e exibida literalmente, mas quando o parser **reconhece** um link cujo destino viola (a)–(e), criação ou edição inteira é rejeitada com código estável **`INVALID_COMMENT_LINK`**, posição e mensagem da regra, **sem ecoar o payload hostil** e sem remover ou reescrever nada silenciosamente. `accounts.` e todos os frontends importam a **mesma** política; o cliente usa para erro imediato/prévia, o backend repete como **autoridade final**. Mudança em pacote compartilhado: exige aprovação e verificação de impacto nos consumidores (`AGENTS.md` §Autorização). · feito quando: `<img>` não é buscado pelo browser em nenhum caminho de render; `http://`, `//host` e `artificiorpg.com.evil.example` são rejeitados com `INVALID_COMMENT_LINK`; `[texto](` incompleto permanece literal; e os consumidores atuais do pacote seguem verdes.
- [ ] T2.6 — **Badge de autor calculado a partir de fonte confiável** (requisito 11). O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada — nunca do payload público**, senão qualquer um se declara dono. Usuário comum sem rótulo; e-mail nunca exposto. Comentário legado exibe marca de **antigo/importado com autoria não verificada** (decisões 6, 23), misturado à árvore e à ordenação normais — sem seção própria e sem ocultação. · feito quando: tentativa de forjar dono no payload é ignorada; badge sai correto na resposta; e legado aparece na árvore normal com a marca de não verificado.
- [ ] T2.6b — **Sem `@menções` nesta fase** (decisão 31). Qualquer `@texto` permanece **texto Markdown comum** e nunca resolve conta nem cria destinatário. Motivo material: `accounts.users` **não possui handle público único** — nome Google é mutável e não único, e-mail não pode ser exposto. Notificação continua derivada apenas da estrutura confiável: autor do comentário pai e dono do assunto, excluindo o ator. Menção futura exige decisão própria de identidade pública; **não será simulada por heurística sobre nome**. · feito quando: `@qualquercoisa` renderiza como texto e não gera nenhum `notification_receipt`.

### Bloco C — Ciclo de vida do comentário

- [ ] T2.7 — **Retirada por tombstone, com auditoria** (requisito 12; decisões 17, 22). Não apagar a linha — apagar quebraria os filhos e perderia o contexto. A resposta pública devolve o estado removido e `removed_at`, **sem o corpo e sem o score**; `removed_by` e `removed_reason` ficam para a moderação. Tombstone **preserva posição e descendentes** (decisão 3). **A proibição de autoexclusão foi revogada** — ver T2.7b. Poderes de remoção e restauração da moderação permanecem separados dos do autor. **Moderação nunca edita o texto de outro usuário** (decisão 22): `moderator`/`admin` podem retirar ou restaurar versões válidas, sempre com motivo e auditoria, mas **não reescrevem a fala alheia nem fazem redação parcial**; conteúdo que exponha PII é retirado por tombstone, e versão corrigida exige nova edição do próprio autor — assim a identidade exibida nunca assina texto produzido pela moderação. · feito quando: filhos sobrevivem à remoção do pai; corpo e score somem da resposta pública; e não existe caminho de código em que a moderação grave `body_markdown`.
- [ ] T2.7b — **Autor edita e retira o próprio comentário** (decisões 17, 18, 20). **Task nova: esta decisão revoga expressamente D111 item 6, o requisito 12 e a formulação anterior de T2.7**, que proibiam autoedição e autoexclusão. Edição: sem prazo, **somente `body_markdown`** — pai, assunto, autoria e `created_at` são imutáveis; registra `edited_at`; público vê só a versão atual mais o marcador de edição; versões antigas ficam restritas à moderação (T2.1b); **edição idêntica é no-op** e **edição não gera notificação**. **Edição preserva votos e ranking** (decisão 18): trocar o corpo não apaga, recalcula nem invalida votos — `upvotes`, `downvotes`, score e versões de ranking seguem vinculados ao mesmo comentário. O risco de bait-and-switch é tratado pelo **marcador público de edição e pelo histórico completo da moderação**, não por zerar a reação de terceiros. Auto-retirada usa tombstone — **nunca `DELETE` físico** —, preserva posição e descendentes, oculta o corpo público, entra no histórico com ator/motivo/timestamp e é **irreversível para o autor**; apenas `moderator`/`admin` restaura a última versão válida, com auditoria. · feito quando: autor edita e o score não muda; edição idêntica não cria versão nem notificação; auto-retirada preserva os filhos; e autor não consegue desfazer a própria retirada.
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

- [ ] T2.9 — **Identidade resolvida no mesmo `SELECT`** (requisito 7), por `JOIN` — não por segunda chamada nem pela rota em lote de T1.4. Conta removida ou desativada cai em nome neutro e avatar nulo — e, por T2.15, a linha de identidade **continua existindo** como soft-delete, então o `JOIN` não perde o vínculo nem precisa de caminho especial para conta excluída. · feito quando: uma consulta devolve comentário e identidade, e o caso da conta removida não vaza nem quebra a lista.
- [ ] T2.10 — **[P1] Separar os rate limiters do `accounts.`** antes de expor comentários. Hoje um único limiter cobre a aplicação inteira em 200 requests/15 min: três catálogos consultando comentários podem consumir a cota de `/login`, `/me` e `/refresh` e derrubar o login de todo mundo. Criar limiters separados para autenticação, leitura pública e escrita; escrita por usuário e IP; leitura com cache. · feito quando: carga de leitura de comentário não afeta a cota de autenticação, provado por teste.

  **Verificado contra o código real em 2026-08-04 — procede, com correção de referência e um agravante novo.**
  A referência `app.ts:79` **está desatualizada**: o limiter vive hoje em
  `apps/accounts/src/app.ts:201`. O diagnóstico em si continua correto e foi
  confirmado linha a linha: é `app.use(rateLimit({ windowMs: 15*60*1000, max: 200 }))`,
  registrado **antes** de `cookieParser`, `csrfProtection`, `express.json` e `cors`
  — ou seja, cobre a aplicação inteira, incluindo qualquer rota de comentário que
  a Fase 2 adicionar. A cota é compartilhada com `/login`, `/me` e `/refresh`.

  **Agravante não registrado na formulação original: o limiter não declara
  `keyGenerator`.** Sem ele, `express-rate-limit` chaveia por IP de origem. Como
  há `app.set("trust proxy", env.TRUSTED_PROXY_CIDR)` com default
  `172.18.0.0/16` (`apps/accounts/src/env.ts:25`) e Cloudflare na borda, **é
  preciso determinar empiricamente se a cota se aplica por usuário final ou por
  IP de saída da borda**. Se for por borda, os 200 req/15 min não são o teto de
  uma pessoa — são o teto do SSO inteiro, e o problema é ordens de magnitude
  pior do que "comentário consome cota de login". **Isto não foi medido**, apenas
  identificado por leitura; quem implementar T2.10 deve provar em qual dos dois
  regimes o serviço está antes de dimensionar os limiters novos. Enquanto não
  medido, tratar como incerteza aberta, não como fato em nenhuma direção.

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
- [ ] T2.11 — **Testes de borda obrigatórios**. Reformulado: a lista anterior tinha onze itens e incluía "resposta a legado" como caso que **deveria falhar** — invertido pela decisão 23, agora é caso que deve **passar**. Cobrir: pai em outro assunto; pai em outro `realm`; profundidade sob concorrência (`depth=4` é o teto); assunto inexistente; dono forjado no payload; **resposta a legado, que deve ser aceita**; voto em legado, que deve ser recusado; **auto-retirada do próprio comentário, que deve ser aceita** (decisão 17) e é irreversível para o autor; edição por terceiro, recusada; `moderator` com papel revogado mas sessão viva (ver T1.2); leitura em árvore sem duplicação nem órfão entre páginas da mesma revisão; cursor expirado; voto concorrente de dois dispositivos da mesma conta; quinta denúncia distinta acionando `pending_review_hidden`; sexta denúncia da mesma conta, recusada; dois moderadores decidindo o mesmo caso em concorrência, com um único vencedor; `INVALID_COMMENT_LINK` em `http://`, `//host` e sufixo frouxo; comentário que sanitiza para vazio; entrada acima de 10.000 caracteres; e `accounts.` indisponível. · feito quando: todos cobertos, cada um falhando fechado — e os casos marcados como "deve ser aceito" passando de fato, em vez de serem tratados como negativa.

### Bloco D — Voto e ranking

- [ ] T2.12 — **Mutação de voto por estado absoluto** (decisões 11, 12). **Task nova.** `PUT /internal/v1/comments/:id/vote` recebe `{ value: -1 | 0 | 1 }`; `0` **remove** o voto. Mesmo valor é **no-op**: devolve `200`, **sem nova revisão nem novo registro de histórico**. Troca ou remoção real atualiza voto, contagens, score, versão de ranking e auditoria **na mesma transação**. **Não há `ETag`, `If-Match` nem `Idempotency-Key`**: concorrência entre dispositivos resolve por **última gravação vence**, pela última transação persistida. Token do app e `X-Acting-User-Id` continuam obrigatórios; retry idêntico não duplica efeito. **Somente terceiros votam** (decisão 5): o autor não recebe auto-upvote e **não pode votar no próprio comentário** — divergência deliberada do Reddit, porque aqui o score representa reação de outras contas, não participação do autor. **Comentário legado não aceita voto** (decisão 6). **Conta nova vota imediatamente e com o mesmo peso** (decisão 11): sem espera, quarentena, voto pendente, peso secreto ou assimetria entre upvote e downvote. Proteções iniciais: uma escolha ativa por conta/comentário, rate limit por usuário e IP (T2.10), credencial backend-to-backend e auditoria completa. Endurecimento futuro exige **abuso medido**, não prevenção oculta. · feito quando: voto repetido idêntico não incrementa revisão; voto no próprio comentário recusado; voto em legado recusado; e dois dispositivos concorrentes convergem para a última transação, sem linha duplicada.
- [ ] T2.13 — **Revisão de ranking incrementada sob lock transacional curto** (decisão 8). **Task nova.** Cada assunto mantém `ranking_revision`; cada comentário registra `created_revision`; **mudança de voto incrementa a revisão sob lock transacional curto**. Isto é o que permite o cursor de T2.3 ser stateless: época fixa, ranking vivo sem consistência e snapshot por sessão foram **explicitamente descartados** no grilling. O lock precisa ser curto o bastante para não serializar o assunto inteiro sob carga — dimensionar e medir, não presumir. Referências pesquisadas registradas na decisão 8: árvore truncada e `more` do Reddit (`reddit-archive/reddit`, `r2/r2/models/builder.py`), contrato `MoreChildrenRequest`, limite de snapshot exportado do PostgreSQL 16 e padrão `search_after` + point-in-time do Elasticsearch. · feito quando: votos concorrentes em comentários do mesmo assunto não perdem incremento de revisão, e a navegação paginada iniciada antes deles mantém posição estável.
- [ ] T2.14 — **Transparência de contagens e visibilidade do voto** (decisões 9, 10). **Task nova.** A resposta pública expõe `upvotes`, `downvotes` e `score`; quando autenticada, também `my_vote`. **Score é público imediatamente**: não existe `score_hidden_until`, janela de ocultação nem política por `source_app` nesta fase — o baixo volume atual e a escrita autenticada tornam o custo do efeito-manada menor que a complexidade de esconder o número; ocultação futura seria mudança aditiva e não altera o modelo de voto/ranking. A superfície de **moderação** acessa identidade das contas votantes e histórico completo de criação, troca e remoção de voto. **A API pública nunca expõe a lista nominal de votantes.** · feito quando: resposta pública traz as três contagens e nenhuma identidade de votante; `my_vote` só aparece autenticado; e a rota de moderação exige papel e é auditada.
- [ ] T2.15 — **Destino do voto quando a conta perde acesso** (decisões 14, 15). **Task nova.** Saída ou desativação comum **preserva votos e score históricos**, mas impede voto novo. **Bloqueio por abuso** permite ao moderador **invalidar todos os votos da conta**, com motivo e auditoria; cada assunto afetado recebe **nova `ranking_revision`** e scores recalculados; a invalidação **não apaga o histórico bruto**. O vínculo nominal do voto é **retido permanentemente**: desativação ou pedido de exclusão **não pseudonimiza nem remove `user_id`** do voto/histórico, e a moderação continua capaz de identificar a conta. Consequência técnica registrada na decisão 15: a identidade referenciada **precisa sobreviver como tombstone/soft-delete ou identidade de auditoria** — não existe exclusão física capaz de apagar a linha referenciada e ao mesmo tempo manter vínculo nominal íntegro. Conta excluída vira **soft-delete permanente**: login bloqueado, identidade pública neutralizada, vínculo nominal restrito a moderação/auditoria.
  > **⚠️ Bloqueio declarado no próprio grilling.** A decisão 15 diz textualmente que **o contrato de exclusão de conta e a justificativa/política jurídica de retenção ainda precisam ser fechados antes da implementação**, e que esses detalhes **não devem ser inferidos da decisão**. Enquanto não fechados, T2.15 implementa apenas o lado de **preservação e invalidação por abuso**; o **ciclo de vida de exclusão de conta permanece bloqueado**. Não tratar como pendência menor: é o único item da Fase 2 com bloqueio jurídico explícito.
  · feito quando: desativação comum preserva score e barra voto novo; invalidação por abuso recalcula os assuntos afetados com revisão nova; e nenhum caminho de código apaga fisicamente a identidade referenciada por voto.
- [ ] T2.16 — **Voto não gera notificação** (decisão 13). **Task nova.** Nem voto individual nem marco agregado ("seu comentário chegou a 10 pontos") cria `notification_event` ou `notification_receipt`; o autor acompanha contagens na própria thread. O núcleo transacional antecipado da Fase 3 (T2.1d) continua **restrito a criação de comentário e resposta**. · feito quando: sequência de votos não produz nenhum recibo, provado por teste.

### Bloco E — Denúncia e moderação

- [ ] T2.17 — **API de denúncia e fila compartilhada** (decisões 32, 33, 35, 37, 38). **Task nova — fecha lacuna real do contrato.** A fila já prometia itens denunciados e a matriz já autorizava usuário a denunciar, mas **não existia schema nem rota que produzisse esse estado**. Persistência, API interna consumida pelas fachadas dos apps, fila compartilhada, resolução e auditoria pertencem à **mesma entrega**: denúncia **não** será armazenada isoladamente em cada app nem adiada enquanto a fila central finge que pode recebê-la. Regras: **exige conta**; **autor não denuncia o próprio comentário** (pode editar ou auto-retirar); **no máximo uma denúncia ativa por conta e comentário**. A identidade do denunciante é persistida e **visível somente a `moderator`/`admin`** — público, outros denunciantes e autor denunciado **nunca a recebem**; escolha deliberadamente mais próxima do Discourse (staff vê quem sinalizou) que do Reddit, porque aqui o moderador é papel global concedido e auditado pelo `accounts.`, não voluntário de uma comunidade, e precisa investigar abuso coordenado sem expor o denunciante ao alvo. O fluxo do `downloads` é **fonte de aprendizado** (decisão 35): estados `open`/`in_review`/`resolved`/`dismissed`, nova denúncia após decisão terminal, "minhas denúncias", retirada voluntária antes da análise, prioridade, detalhes e nota de resolução separados, aviso do resultado, sinal de sequência abusiva **sem punição automática**, contexto do alvo na fila e auditoria. O que for geral é consolidado no `accounts.` e exposto pelo **único** `packages/comments`; **sem pacote de denúncia separado, cópia por app ou segundo state machine**. Elementos de domínio real — `material_id`, motivo `broken_link` de material — ficam no adaptador do domínio. "Subir ao compartilhado" significa **extrair a solução corrigida, não copiar a implementação local**. Moderador pode reclassificar prioridade, sempre com motivo e auditoria persistente. · feito quando: denúncia do autor recusada; segunda denúncia ativa da mesma conta recusada; denunciante invisível a todos exceto `moderator`/`admin`; e nenhum app mantém state machine própria de denúncia de comentário.
- [ ] T2.18 — **Auto-ocultação por limiar de cinco contas distintas** (decisão 34). **Task nova.** Uma denúncia isolada **apenas cria ou prioriza item na fila** — não oculta nada. Ao atingir **cinco contas distintas**, o comentário passa ao estado próprio **`pending_review_hidden`**: público vê placeholder, **corpo e score somem**, **posição e descendentes permanecem**. Isto **não é tombstone nem decisão de moderador**, e precisa ser estado distinto no schema (T2.1). A fila conserva corpo, denúncias e identidades; a moderação confirma a retirada ou **descarta as denúncias e restaura a visibilidade**, tudo auditado. Contam **somente denúncias ativas, ainda não resolvidas, de contas válidas**; a mesma conta **nunca soma duas vezes**. O limiar alto é deliberado: em baixo volume a auto-ocultação será rara, priorizando resistência a coordenação entre poucas contas. Categoria e prioridade **nunca ocultam sozinhas** (decisão 38) — este limiar é o **único** auto-hide da fase. · feito quando: quatro denúncias não ocultam; a quinta oculta preservando os filhos; denúncia repetida da mesma conta não conta duas vezes; e restauração pela moderação devolve corpo e score.
- [ ] T2.19 — **Caso episódico agrega denúncias sem perder granularidade** (decisões 39, 40). **Task nova.** Existe **no máximo um `moderation_case` aberto por comentário**; cada denúncia continua **linha individual, imutável como evidência**, ligada ao caso. A fila mostra **um item agregado** com quantidade, categorias, prioridade máxima e — apenas para a moderação — identidades dos denunciantes. **Decisão terminal fecha o caso e as denúncias ativas vinculadas sem apagar o histórico.** Denúncia válida posterior **abre caso novo**, em vez de reabrir ou misturar o episódio encerrado. Cada denúncia fixa `reported_version_id` **no instante do envio**, capturado atomicamente com `comment_id`; **edição posterior cria versão nova, não altera a evidência e não resolve nem retira a denúncia da fila**. A moderação vê lado a lado versão denunciada, versão atual, diff e histórico; o relatório **não duplica o corpo**. Alternativas rejeitadas, registradas para não serem redescobertas: uma entrada de fila por denúncia (duplica trabalho, permite decisões concorrentes); caso eterno por comentário (mistura versões, incidentes e decisões de épocas diferentes); somente `comment_id` + inferência por horário (ambígua sob concorrência); e snapshot do corpo dentro da denúncia (duplica conteúdo, PII e política de retenção). · feito quando: duas denúncias no mesmo comentário produzem um item de fila e duas linhas de evidência; edição durante o caso não some da fila; decisão terminal fecha tudo sem apagar; e denúncia posterior abre caso novo.
- [ ] T2.20 — **Invariantes de decisão terminal implementados corretamente desde o início** (decisão 36). **Task nova.** Os três defeitos identificados no fluxo local do `downloads` **não são reproduzidos** no núcleo: (a) rotas de leitura (`GET /mine`, `GET /abuse-check/:userId`, `GET /reports`) usam **orçamento de leitura**, nunca o limiter de escrita; (b) decisão terminal **não** faz check-before-transaction seguido de `UPDATE` só por `id` — a transição é **serializada e condicionada**, garantindo **um único vencedor, uma única notificação e conflito explícito ao segundo moderador**; (c) auditoria de decisão é **registro persistente na mesma transação do estado**, nunca `console.log`. A correção do fluxo local do `downloads` acontece na **fase de adoção** dele, não aqui — organização temporal decidida pelo mantenedor, **não autorização para preservar os bugs** (`AGENTS.md` §Bug achado: o item segue até o verde). · feito quando: dois moderadores decidindo em concorrência produzem um vencedor e um `409`; uma única notificação é emitida; e a auditoria da decisão sobrevive a rollback do restante da requisição sendo — corretamente — revertida junto.

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
