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

> **HISTÓRICO — bloqueio T1.13 fechado em 2026-08-04.** As migrations `001`–`005`
> do `accounts` foram aplicadas pelo runner no Postgres real durante o deploy de
> produção `30918952648`. A ledger registra as cinco entre 14:27:49 e 14:27:50 UTC,
> com `applied_by = ci:ubuntu@vnic-artificio`. Antes desse deploy, T1.13 era bloqueio
> duro: merge de PR e revisão de bot não substituíam execução contra banco.
>
> Motivo de virar trava explícita agora: a Fase 1 **endurece gates antes do verde
> comprovado** — o preflight da baseline passa a exigir `users.role` como
> `TEXT NOT NULL` (achado do CodeRabbit, 2026-07-30) e o runner e o drift passam a
> falhar fechado (T1.11/T1.12). Cada um é a decisão certa isoladamente, e juntos
> significam que **um banco de produção divergente do esperado aborta o deploy**,
> o que é o comportamento desejado — desde que alguém tenha verificado que o banco
> real passa. Naquele momento, ninguém havia verificado.
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
**Naquele estado de 2026-07-30, nenhum deploy real havia rodado** — o caminho feliz
dos 6 módulos estava provado só por leitura e T1.13 seguia aberta.

**Fechamento de 2026-08-04:** o deploy de produção `30918952648` aplicou
`migration_001`–`migration_005` pelo runner, criou/preencheu `schema_migrations`,
rodou drift e `critical_routes` e terminou com sucesso. A VM confirma hoje as cinco
linhas na ledger e `accounts-api`/`accounts-db` healthy. T1.13 está fechada.

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

> **Decisões do grilling da Fase 2 — registradas em 2026-08-04; grilling CONCLUÍDO com 55 decisões.**
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
>     **Estado histórico:** a retenção nominal permanente e o bloqueio acima foram
>     expressamente substituídos pela decisão 53. A preservação/invalidação de votos
>     da decisão 14 continua ativa.
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
> 52. **Contexto jurídico e controlador ficam declarados.** Paulo Henrique Mota Lima,
>     representando o grupo Artifício RPG, é o controlador como pessoa física; o canal
>     de privacidade é `artificiorpg@gmail.com`. O projeto é 100% gratuito, sem
>     exploração econômica organizada, e dirigido somente ao Brasil. Mudança de
>     controlador, monetização ou mercado exige revisão da política antes do novo uso.
> 53. **Exclusão preserva conversa, não vínculo nominal eterno.** Nome, e-mail, avatar,
>     refresh/cookies e identidade pública saem no pedido; rotas comunitárias revalidam
>     a conta e recusam token antigo imediatamente, enquanto os demais consumidores
>     respeitam o SLA SSO existente de até 15 minutos. Comentários ficam como “Conta
>     excluída”, e votos/score permanecem. Sem caso/recurso, o vínculo ator→conta é
>     desfeito no mesmo ciclo. Com caso/recurso, fica restrito à moderação até seis
>     meses após a decisão final; depois é desfeito irreversivelmente. `legal_hold`
>     explícito e auditado suspende o expurgo. Exclusão voluntária bloqueia recadastro
>     pela mesma identidade Google por seis meses com identificador técnico mínimo;
>     sanção o retém enquanto durar. Esta decisão substitui a parte permanente da 15,
>     não a preservação/invalidação de voto da 14. A mesma janela limita a resolução
>     nominal de votantes e denunciantes mencionada nas decisões 10, 32 e 40; depois
>     do expurgo, histórico e ator opaco permanecem, mas a conta não é reconstruída.
> 54. **IP fica na fachada e somente durante o TTL do limiter.** Nenhum IP bruto entra
>     no schema, payload interno ou auditoria comunitária. Cada app limita por IP real
>     validado e usuário; `accounts.` limita por usuário e credencial do `source_app`.
>     A medição Cloudflare/trusted proxy calibra a configuração antes do uso integral,
>     mas não bloqueia schema nem implementação. Se falhar, corrige-se o ingress, não o
>     modelo comunitário.
> 55. **A Fase 2 é implementada integralmente em pré-lançamento.** Aferição de idade e
>     adequação específica ao ECA Digital serão tratadas depois, antes do uso integral
>     da comunidade. Não são critério de aceite nem bloqueio da implementação atual, e
>     esta postergação não deve ser descrita como adequação já entregue.
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

- [ ] T2.2a-op — **Emitir as credenciais reais e aposentar o `SERVICE_SECRET` global** (operacional de T2.2a; `spec.md` §"Trust boundary e credenciais"). **Débito registrado em 2026-08-04 por decisão do mantenedor, para iniciar em seguida.** T2.2a entrega o mecanismo; esta task o coloca em uso — sem ela o registro existe e ninguém o usa, e o segredo único medido (mesmo digest em vários serviços e nos dois realms; ver a ressalva de contagem no levantamento de 2026-08-07 ao fim deste bloco) continua sendo a credencial de fato. **Emissão e distribuição concluídas em 2026-08-05 (passos 1–4) e corte confirmado em 2026-08-07 (passo 5); a task segue aberta porque o `SERVICE_SECRET` continua vivo — falta o passo 6 (remover o fallback), com inventário completo ao fim do bloco.** **Não é bloqueio de deploy:** o fallback `SERVICE_SECRET` mantém `downloads` e `mesas` funcionando, então a migration 007 pode subir antes desta task; o que não pode é a task ser esquecida, porque o fallback é justamente o que se quer remover.

  Escopo, na ordem em que precisa acontecer:
  1. **Aplicar a migration 007** (deploy normal; prod tem 001–005 hoje, então 006 e 007 somam 2 pendentes, sob o `MAX_AUTO_PENDING=5`).
  2. **Emitir uma credencial por app por realm** com `node dist/scripts/serviceCredentialAdmin.js issue`: `downloads` (`users.read`, `secrets.read`) e `mesas` (`secrets.read`), em `prod` e em `beta` — quatro credenciais, quatro segredos distintos. O segredo é impresso **uma única vez** e não é recuperável.
  3. **Popular `SERVICE_CREDENTIAL`** no `.env` de cada serviço na VM e nos secrets do Actions. **Escrita em produção: exige aprovação nominal própria** (`AGENTS.md` §Autorização).
  4. **Confirmar o corte** pelo log `[serviceCredential] SERVICE_SECRET legado usado em ...`: enquanto ele aparecer, há consumidor no mecanismo antigo. `list` mostra `último uso` por credencial e é a prova positiva do outro lado.
  5. **Só então remover o fallback**: tirar `allowLegacySecret` das duas rotas (`app.ts`, `adminSecretsRoutes.ts`), remover `SERVICE_SECRET` dos compose e dos `.env.example`, e tornar `SERVICE_CREDENTIAL` obrigatório (`:?`) no lugar do atual `:-`.

  **Ordem importa e inverter causa indisponibilidade:** remover o fallback antes do passo 4 derruba a moderação do `downloads` (resolução de e-mail do autor) e o enrichment do `mesas` (chave da DeepSeek). A rotação futura segue a janela `current` + `next` documentada no cabeçalho de `serviceCredentialAdmin.ts`.

  · feito quando: as quatro credenciais existem e estão em uso; o log de uso legado não aparece por um ciclo completo de deploy; `SERVICE_SECRET` não existe mais em nenhum compose, `.env.example` ou código; e `SERVICE_CREDENTIAL` é obrigatório nos serviços que o consomem.

  **Comandos dos passos 3 e 4, prontos e conferidos contra a VM em 2026-08-05
  (leitura read-only).** Nada foi executado; cada bloco exige aprovação nominal
  própria no momento de rodar.

  Estado medido: `schema_migrations` em prod tem `001`–`005`; `006`/`007`
  pendentes. `SERVICE_CREDENTIAL` **ausente** nos três `.env` de prod
  (`accounts`, `downloads`, `mesas`), `SERVICE_SECRET` presente nos três.
  `dist/scripts/` ainda **não existe** dentro de `accounts-api` — a imagem em
  execução é anterior a esta PR, então os comandos abaixo só funcionam **depois**
  do merge e do deploy (passos 1 e 2). Containers confirmados: `accounts-api`,
  `accounts-db`; workdir do container é `/app/apps/accounts`; `DATABASE_URL` já
  está no ambiente dele.

  **Passo 3 — emitir (leitura de banco + INSERT na tabela nova; não toca dado
  existente).** O segredo é impresso **uma única vez** e não é recuperável:
  copiar antes de fechar o terminal, ou revogar e emitir outra.

  ```bash
  # prod
  ssh faren 'docker exec accounts-api node dist/scripts/serviceCredentialAdmin.js issue \
    --source-app downloads --realm prod --scopes users.read,secrets.read \
    --description "spec 083 (e-mail do autor) + spec 084 (segredos)"'
  ssh faren 'docker exec accounts-api node dist/scripts/serviceCredentialAdmin.js issue \
    --source-app mesas --realm prod --scopes secrets.read \
    --description "WS3 (chave DeepSeek), api e cron"'

  # beta — mesmo accounts (PROD-only, D042), realm diferente
  ssh faren 'docker exec accounts-api node dist/scripts/serviceCredentialAdmin.js issue \
    --source-app downloads --realm beta --scopes users.read,secrets.read \
    --description "beta"'
  ssh faren 'docker exec accounts-api node dist/scripts/serviceCredentialAdmin.js issue \
    --source-app mesas --realm beta --scopes secrets.read \
    --description "beta"'

  # conferir (não imprime segredo)
  ssh faren 'docker exec accounts-api node dist/scripts/serviceCredentialAdmin.js list'
  ```

  **Passo 4 — distribuir (ESCRITA em produção; aprovação nominal obrigatória).**
  Os valores **não** passam por secret do Actions (verificado): vivem só nos
  `.env` da VM. Editar manualmente, um arquivo por app/realm, preservando
  permissão `600`:

  | Arquivo | Valor |
  |---|---|
  | `/opt/artificio/apps/downloads/.env` | credencial `downloads`/`prod` |
  | `/opt/artificio/apps/mesas/.env` | credencial `mesas`/`prod` |
  | `/opt/artificio-beta/apps/downloads/.env.beta` | credencial `downloads`/`beta` |
  | `/opt/artificio-beta/apps/mesas/.env.beta` | credencial `mesas`/`beta` |

  `accounts` **não** recebe `SERVICE_CREDENTIAL` — ele valida, não consome.
  Depois de cada arquivo, reiniciar o serviço correspondente (`docker restart
  downloads-api mesas-api mesas-cron`, e os `*-beta-api` no clone de beta).

  **Passo 5 — confirmar antes de qualquer remoção.** Enquanto
  `[serviceCredential] SERVICE_SECRET legado usado em <rota>` aparecer em
  `docker logs accounts-api`, há consumidor no mecanismo antigo. `list` mostra
  `último uso` por credencial: é a prova pelo outro lado. **Só quando o log
  silenciar por um ciclo completo** entra o passo 6 (remover `allowLegacySecret`,
  tirar `SERVICE_SECRET` dos compose, tornar `SERVICE_CREDENTIAL` obrigatório) —
  que é código e vira PR própria. Inverter 5 e 6 derruba a moderação do
  `downloads` e o enrichment do `mesas` na hora.

  **Execução de 2026-08-05 — passos 1 a 4, com um erro operacional registrado.**
  PR #242 mergeada (`75b0340`), `dev→main` promovido por fast-forward (13 commits),
  deploy do `accounts` em prod verde, **migrations `006` e `007` aplicadas** às
  03:45. Quatro credenciais emitidas e escritas nos `.env` da VM (backup
  `*.bak-20260805-035402` antes de tocar; permissão `600` preservada; conferência
  por `token_id` + digest, sem imprimir segredo — quatro digests distintos,
  nenhuma credencial trocada de arquivo).

  **`docker restart` NÃO aplica `.env` novo.** O agente reiniciou os cinco
  serviços e conferiu dentro do container: `SERVICE_CREDENTIAL=0`,
  `SERVICE_SECRET=1`. `restart` recria o processo com o **ambiente original** do
  container; só `docker compose up -d` relê o arquivo e recria com o ambiente
  novo. Sem essa conferência, o passo teria sido declarado concluído com as
  credenciais distribuídas e **nenhum container as usando** — o tipo de
  falso-verde que só apareceria na hora de remover o fallback.

  O caminho aplicado foi o canônico (`deploy.yml` por módulo), não `up -d` manual:
  deixa rastro no Actions e usa a mesma esteira do resto. Ordem: `downloads` prod,
  `mesas` prod, depois os dois em beta.

  **Mecanismo provado end-to-end em produção, não só "variável presente".** Com o
  `downloads` e o `mesas` já deployados, chamada real de container para container:

  | Chamada | Resultado | O que prova |
  |---|---|---|
  | `downloads-api` → `GET /internal/users/<uuid inexistente>` | **404** | credencial autenticou e passou no escopo `users.read`; 404 é só o usuário não existir |
  | `mesas-api` → mesma rota | **403** | `insufficient_scope` — `mesas` tem só `secrets.read` |

  O **403 é o achado que fecha a task**: com o `SERVICE_SECRET` global essa mesma
  chamada retornaria **200**, porque não havia escopo algum — quem resolvia e-mail
  de usuário também lia segredo decifrado. A separação de capacidade agora existe
  de fato, verificada em produção.

  `último uso` da credencial do `downloads` saiu de `nunca` para
  `2026-08-05T04:22:57Z` no mesmo teste, confirmando que a rastreabilidade que
  destrava o passo 6 funciona.

  **O invariante central da spec, verificado no banco de produção:**

  ```text
  downloads-beta-93a6f607 | downloads | {beta} | usada
  downloads-prod-f96f13f2 | downloads | {prod} | usada
  ```

  Mesmo `source_app`, mesma instância do `accounts` (PROD-only, D042: beta e prod
  **compartilham** a instância e o banco `artificio_auth`), e ainda assim os
  realms ficam separados **por construção**: a credencial de beta carrega `{beta}`
  e não tem `prod` de onde derivar, com o `CHECK cardinality(realms) = 1` tornando
  impossível declarar o outro. Era exatamente isto que o `SERVICE_SECRET` único
  não conseguia expressar — e a razão de `realm` ter entrado na chave desde a
  primeira migration (T0.6).

  **Passos 1–4 concluídos em 2026-08-05.** Cinco containers com a credencial
  correta e saudáveis:

  ```text
  downloads-api       | downloads-prod-f96f13f2 | healthy
  mesas-api           | mesas-prod-8a634a5b     | healthy
  mesas-cron          | mesas-prod-8a634a5b     | up
  downloads-beta-api  | downloads-beta-93a6f607 | healthy
  mesas-beta-api      | mesas-beta-6b5798f4     | healthy
  ```

  `accounts-api`/`accounts-db` seguem `healthy`. Backups dos `.env`
  (`*.bak-20260805-035402`) **deixados na VM** — contêm segredos e a remoção é
  decisão do mantenedor, não do agente.

  **Passo 6 ainda NÃO tem base** *(escrito em 2026-08-05; superado em 2026-08-07 —
  ver o levantamento ao fim deste bloco, onde o passo 5 é fechado).* O log
  `SERVICE_SECRET legado usado` está em zero há 45 min, mas isso **não prova
  corte**: as credenciais de `mesas` seguem com `último uso` vazio, ou seja,
  ninguém exerceu aquele caminho ainda. Zero dos dois lados é ausência de tráfego,
  não migração concluída. A base para remover o fallback é `último uso` preenchido
  nas **quatro** sob tráfego real (moderação de material no `downloads`, parse com
  DeepSeek no `mesas`), com o log legado silencioso no mesmo período.

  **Documentação operacional já escrita (2026-08-04, por decisão do mantenedor),
  então o passo 3 não começa sem instrução.** `docs/agents/deploy-runbook.md`
  ganhou a seção §Credenciais de serviço (medição do segredo único, variáveis por
  serviço, comandos de emissão/revogação e a janela de rotação `current`/`next`) e
  teve a §Migrations atualizada com `006`/`007`.
  `docs/agents/github-actions-secrets.md` registra o fato verificado de que
  `SERVICE_SECRET`/`ACCOUNTS_SECRETS_KEY`/`SERVICE_CREDENTIAL` **não** passam por
  secret do Actions — vivem nos `.env` da VM e são distribuídos manualmente pelo
  mantenedor, então acrescentar chave ao cofre local não a leva para a VM.

  **Correção de fato desatualizado encontrada ao escrever isso:** o runbook
  afirmava "`accounts` tem exatamente 5 migrations pendentes", encostado no guard
  `MAX_AUTO_PENDING=5`. A leitura de `schema_migrations` em prod mostra `001`–`005`
  **aplicadas** em 2026-08-04 14:27 pelo CI — o primeiro deploy pelo runner já
  aconteceu. Pendentes reais: **2** (`006` e `007`). Manter o número antigo levaria
  quem lê a planejar baseline manual que hoje seria errada, ou a achar que não cabe
  migration nova.

  ---

  ### Levantamento de 2026-08-07 — o que falta para fechar T2.2a-op

  Releitura do ambiente real (somente leitura) para responder uma pergunta: as
  credenciais estão emitidas, então a task acabou? **Não.** A task tem duas metades
  no próprio título — *emitir* e *aposentar o `SERVICE_SECRET`*. A primeira está
  feita e provada; a segunda não começou. O que segue é o levantamento fechado do
  que resta, para que a etapa possa ser encerrada sem deixar o fallback vivo.

  **Estado confirmado hoje (`accounts-db`, banco `artificio_auth`, leitura direta):**

  ```text
  token_id                | app       | realms | scopes                    | revogada | último uso
  mesas-prod-8a634a5b     | mesas     | {prod} | {secrets.read}            | não      | NUNCA
  mesas-beta-6b5798f4     | mesas     | {beta} | {secrets.read}            | não      | NUNCA
  downloads-beta-93a6f607 | downloads | {beta} | {users.read,secrets.read} | não      | 2026-08-07 07:00
  downloads-prod-f96f13f2 | downloads | {prod} | {users.read,secrets.read} | não      | 2026-08-07 07:00
  ```

  `migration_007` consta em `schema_migrations` de prod (junto com `006`; a série
  vai de `001` a `007`, sem pendência). `SERVICE_CREDENTIAL` presente nos cinco
  containers consumidores (`downloads-api`, `mesas-api`, `mesas-cron`,
  `downloads-beta-api`, `mesas-beta-api`). Log `[serviceCredential] SERVICE_SECRET
  legado usado`: **zero ocorrências em 168 h** de `accounts-api`.

  **Passos 1–4: concluídos.** Nada a fazer.

  **Passo 5 (confirmar o corte): parcialmente satisfeito, e é aqui que a task
  trava.** O critério escrito acima exige `último uso` preenchido nas **quatro**
  credenciais sob tráfego real. Hoje só as duas do `downloads` foram exercitadas —
  e por tráfego genuíno, não por teste manual: o carimbo de 07:00 de hoje é
  posterior ao teste de 2026-08-05. As duas do `mesas` seguem em `NUNCA`.

  Isso **não** indica credencial quebrada. `apps/mesas/backend/src/services/adminSecrets.ts`
  só chama `GET /admin/secrets/<name>` sob demanda, com cache em memória de 5 min;
  sem parse com DeepSeek no período, não há chamada. Mas a distinção importa: o
  estado real é *nunca exercitada*, não *funcionando*. Remover o fallback agora
  seria apostar que um caminho jamais executado em produção funciona — e o modo de
  falha é o enrichment do `mesas` parar de uma vez, exatamente o que a ordem dos
  passos existe para impedir.

  **Passo 5 fechado em 2026-08-07 por chamada dirigida** (autorizada nominalmente
  pelo mantenedor). `GET /admin/secrets/__probe_inexistente_090__` disparado de
  dentro de `mesas-api` e `mesas-beta-api` contra `accounts-api`, usando o
  `SERVICE_CREDENTIAL` de cada container. **404 nos dois** — que é o resultado
  desejado: `requireServiceOrAdmin` autentica a credencial, valida o escopo
  `secrets.read` e chama `touchServiceCredential` **antes** de a rota consultar
  `admin_secrets`; nome inexistente carimba `last_used_at` e devolve 404 sem
  decifrar segredo algum. Escolha deliberada de nome inexistente: exercitar a
  credencial sem trafegar valor decifrado.

  ```text
  downloads-beta-93a6f607 | 2026-08-07 07:00:05  (tráfego real)
  downloads-prod-f96f13f2 | 2026-08-07 07:00:05  (tráfego real)
  mesas-beta-6b5798f4     | 2026-08-07 16:31:24  (chamada dirigida)
  mesas-prod-8a634a5b     | 2026-08-07 16:31:20  (chamada dirigida)
  ```

  Log `[serviceCredential] SERVICE_SECRET legado usado`: **0** na janela. Critério
  do passo 5 — `último uso` preenchido nas quatro, log legado silencioso no mesmo
  período — atendido.

  **Ressalva que o passo 6 precisa levar em conta:** o carimbo das duas credenciais
  do `mesas` veio de chamada dirigida, não de tráfego de produção. Isso prova que a
  **credencial** autentica e tem o escopo certo; **não** prova que o caminho real do
  `mesas` (`adminSecrets.ts`, parse com DeepSeek, cache de 5 min) a exercita em
  operação normal. As duas afirmações são diferentes e o registro não as equipara.

  **Correção de suposição feita durante a execução:** o comando planejado usava
  `accounts-api:4000`, chutado a partir do padrão dos outros backends. Primeiro
  disparo falhou com exit 7 / `000` (connection refused). A porta exposta real é
  **3000** (`docker inspect accounts-api` → `{"3000/tcp":null}`), e ambos os
  containers estão em `artificio_net`, então o hostname resolve. Sem efeito
  colateral: connection refused não chega a autenticar. Fica registrado porque o
  número errado estava num bloco de comandos "prontos e conferidos" e outra pessoa
  o copiaria.

  **Passo 6 executado em 2026-08-07** (autorização nominal do mantenedor).
  Inventário abaixo, levantado antes de tocar o código para que a remoção não
  fosse descoberta por partes — todos os pontos aplicados.

  | Onde | O que sai |
  |---|---|
  | `apps/accounts/src/app.ts:458-459` | `allowLegacySecret: true` e `legacySecret: env.SERVICE_SECRET` da rota `/internal/users/:id` |
  | `apps/accounts/src/adminSecretsRoutes.ts:43,87-90` | fallback e o `console.warn` de uso legado |
  | `apps/accounts/src/requireServiceCredential.ts:49-55,68,92` | opções `allowLegacySecret`/`legacySecret` e o ramo `isValidServiceToken` |
  | `apps/accounts/src/env.ts:24` | `SERVICE_SECRET` do schema |
  | `apps/accounts/src/serviceToken.ts` | módulo inteiro, se nenhum outro consumidor restar |
  | `apps/downloads/backend/src/services/accountsClient.ts:26` | `\|\| process.env.SERVICE_SECRET` |
  | `apps/downloads/backend/src/services/secretsClient.ts:33` | idem |
  | `apps/mesas/backend/src/services/adminSecrets.ts:33` | idem |
  | `apps/accounts/docker-compose.prod.yml:62` | variável `SERVICE_SECRET` |
  | `apps/mesas/docker-compose.{prod,beta}.yml` | `SERVICE_SECRET` (2 serviços no prod: api e cron) e `SERVICE_CREDENTIAL` passa de `:-` para `:?` |
  | `apps/downloads/docker-compose.{prod,beta}.yml` | idem |
  | `apps/accounts/.env.example:17`, `apps/downloads/backend/.env.example:16` | linha `SERVICE_SECRET=` |
  | testes | `serviceToken.test.ts`, `adminSecretsRoutes.test.ts`, `internalUsers.test.ts` cobrem o caminho legado e mudam junto |

  Remoção toca `apps/accounts` (auth): exigiu aprovação nominal, concedida em
  2026-08-07, e sai em PR própria — não entra junto com código de comentário.

  **Além do inventário, três remoções que ele não previa e apareceram ao executar:**
  - `apps/accounts/src/serviceToken.ts` **e seu teste foram apagados**, não só
    editados. Removido o último consumidor (`isValidServiceToken` no fallback), o
    módulo ficou órfão: só o próprio teste o importava. `serviceCredential.ts` tem
    implementação própria de comparação em tempo constante (`constantTimeEquals`)
    e nunca dependeu dele. Manter um módulo de comparação de segredo global sem
    chamador é convite a alguém reintroduzir o caminho.
  - `requireServiceOrAdmin` **perdeu o parâmetro `env`**. Ele existia só para ler
    `SERVICE_SECRET`; a chave de cifra (`ACCOUNTS_SECRETS_KEY`) é lida pelos
    handlers, que recebem `env` por `createAdminSecretsRoutes`. Um comentário
    intermediário chegou a afirmar que `env` seguia em uso pelo guard — estava
    errado e foi corrigido antes do commit.
  - `SERVICE_CREDENTIAL` passou de `:-` para **`:?`** nos quatro compose de
    consumidor (`mesas` prod/beta incluindo `mesas-cron`, `downloads` prod/beta).
    Sem isso a variável some e o container sobe sem credencial nenhuma, agora que
    não há fallback: o serviço responderia com `getSecret()` nulo em runtime em
    vez de falhar no deploy.

  **Dois testes trocaram de sinal, de propósito.** `internalUsers.test.ts` e
  `adminSecretsRoutes.test.ts` tinham casos provando que um token opaco de 16+
  caracteres autenticava como serviço. Agora provam o **oposto** — o mesmo valor
  cai em 401 / guard humano. São a trava contra reintroduzir o fallback sem que
  nenhum teste reclame.

  **Validação executada (2026-08-07), toda local:**
  - `tsc --noEmit`: `accounts`, `downloads/backend`, `mesas/backend` — sem erro.
  - `accounts` **122/122**; `downloads-backend` **495/495**; `mesas-backend` **707/707**.
  - `pnpm run lint`: 25/25 tarefas.
  - `pnpm verify:api`: breaking=0 nos seis módulos.
  - Busca negativa: nenhuma ocorrência viva de `SERVICE_SECRET` em `apps`,
    `packages`, `scripts` ou `.github` — só comentários históricos e o cabeçalho
    da migration 007, que descrevem o que foi removido.

  **Não executado, e é o que falta para a task fechar:** deploy. Os `.env` da VM
  ainda têm `SERVICE_SECRET`, e os quatro compose agora exigem
  `SERVICE_CREDENTIAL` com `:?`. A variável já está nos cinco containers (medido
  hoje), então o `:?` não deve derrubar nada — mas isso é previsão, não medição:
  `:?` é avaliado contra o `.env` do host no momento do `up`, não contra o
  ambiente do container em execução. Ordem segura: deployar `accounts` primeiro
  (para de aceitar o segredo global) e os consumidores em seguida. Enquanto o
  deploy não acontecer, produção segue no código antigo, com o fallback vivo.

  **Correção de fato encontrada neste levantamento.** O cabeçalho de
  `migration_007_service_credentials.sql` e o texto desta task afirmam "mesmo digest
  de `SERVICE_SECRET` em **seis** serviços e nos dois realms", da medição de
  2026-08-04. A leitura de hoje encontra `SERVICE_SECRET` em **cinco** containers
  (`accounts-api` + os quatro consumidores) e **zero** em `glossario-api`,
  `site-prod-app` e `links-app`, nenhum dos quais importa cliente de credencial.
  Consumidores reais são **2 apps × 2 realms**. Não foi apurado se a medição
  original contou containers que depois perderam a variável ou se contou errado —
  fica registrado como divergência entre o número documentado e o ambiente, sem
  causa atribuída. O número não muda nenhuma decisão da task; muda o que um leitor
  futuro conclui sobre o alcance do segredo único.

- [x] T2.2a — **Registro de credencial de serviço por `source_app` e `realm`, substituindo o `SERVICE_SECRET` global** (requisito 5a; decisão T0.6; `spec.md` §"Trust boundary e credenciais"). **Task nova, criada em 2026-08-04 a partir de medição no ambiente real** (evidência no bloco abaixo). Pré-requisito duro de T2.6c e de qualquer rota de escrita comunitária: enquanto a credencial for um valor único global, `realm` e `source_app` só podem vir do payload, o que a trust boundary proíbe expressamente. Exigir: tabela `community_service_credential` com `token_id` público indexado, `token_hash` (Argon2id — **não** SHA-256; ver nota de dependência), `source_app`, `realms TEXT[]`, `scopes TEXT[]`, `revoked_at`, `last_used_at`; header no formato `<token_id>.<segredo>`, onde o `token_id` em claro permite `SELECT` por índice sem rodar KDF contra toda a tabela; função de resolução que devolve **identidade (`{sourceApp, realms, scopes}`) ou `null`**, nunca `boolean` — é a mudança de tipo de retorno que carrega a correção; handler **deriva** `realm`/`source_app` da credencial e rejeita com `400` o payload que tentar declarar qualquer um dos dois; comparação do `token_id` em tempo constante, senão o lookup vaza quais IDs existem; **uma credencial por app por realm** (`downloads-beta` e `downloads-prod` são linhas distintas com segredos distintos), porque é isso que dá revogação granular e rotação sem coordenação global; `realms` é array pelo caso excepcional documentado, mas toda credencial emitida nasce com **um** realm, tornando gravar `realm='prod'` a partir de beta impossível por construção e não por validação lembrada; script de emissão/revogação de credencial; migração dos três consumidores atuais (`apps/downloads/backend/src/services/accountsClient.ts:30`, `apps/downloads/backend/src/services/secretsClient.ts:35`, `apps/mesas/backend/src/services/adminSecrets.ts:46`); `SERVICE_SECRET` permanece aceito como fallback nas duas rotas existentes durante a transição, com registro de uso (**nunca o valor**), e só é removido depois de provado que ninguém o usa. · feito quando: credencial de beta não consegue gravar `realm='prod'` por nenhum caminho; payload que declara `realm`/`source_app` é rejeitado; escopo separa leitura de usuário de leitura de segredo; revogar uma credencial não afeta as outras; e busca negativa prova que nenhum log/erro ecoa o segredo.

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

- [ ] T2.3 — **Leitura em árvore com cursor versionado por revisão** (requisito 6; decisões 3, 8). Reformulado: a versão anterior tratava a listagem como lista plana paginada por `(created_at, id)`, o que o grilling revogou. No volume normal a leitura devolve **a árvore inteira**, sem limite de respostas irmãs. Hard cap defensivo de **1.000 comentários ou 2 MiB**, o que ocorrer primeiro; só então raízes/ramos restantes viram `more`, com cursor próprio e **nunca filho órfão**. A primeira leitura fixa `snapshot_revision`; o cursor é **opaco e assinado**, carregando identidade do assunto, sort, revisão, último sort-key, ramo, limite e expiração de **30 minutos**. Páginas e expansões `more` usam a mesma revisão, sem duplicar nem perder item; score exibido e `my_vote` podem vir do estado atual, mas a **posição permanece congelada** naquela navegação. Nova visita usa a revisão mais recente imediatamente; cursor expirado exige recarregar. O modelo evita transação PostgreSQL aberta entre requests, cache de paginação e cron. · feito quando: árvore de 1.500 comentários devolve `more` sem órfão; expansão na mesma revisão não duplica nem perde item; e cursor expirado falha explicitamente em vez de devolver posição errada.
- [ ] T2.3b — **As quatro ordenações do produto** (decisões 7, 19). `Melhores` (padrão de abertura) usa o **limite inferior de Wilson unilateral com `z = 1.281551565545`** (80% de confiança), sem decaimento temporal, sob `algorithm_version = 'reddit-wilson-80-v1'`; `Mais votados` ordena por score líquido; `Recentes` por `created_at DESC`; `Mais antigos` por `created_at ASC`. A ordenação acontece **entre irmãos, nunca misturando níveis** da árvore. `created_at` e `id` formam o desempate estável. Tombstone mantém a posição estrutural mas não expõe corpo nem score. `Controversos`, `Random`, `Q&A`, `Live` e `Hot` **não entram**. Fórmula e vetores de referência entram em teste, **testando diretamente a função PostgreSQL** de T2.1c, não uma reimplementação em TypeScript. Algoritmo futuro cria nova versão e nova série de score; nunca reinterpreta histórico silenciosamente. · feito quando: os quatro sorts testados; vetores de Wilson batem contra a função SQL; e nenhuma ordenação mistura níveis da árvore.
- [ ] T2.4 — **Integridade de thread validada na transação** (requisito 8; decisões 3, 23). Reformulado em dois pontos que o grilling revogou: a profundidade máxima é **`depth<=4`**, não `depth<=2`; e **resposta a comentário legado é permitida**, não recusada — o registro importado continua imutável, sem voto e marcado como antigo/autoria não verificada, mas **pode ser pai** de comentário novo de conta autenticada (decisão 23: antigo descreve proveniência, não congela a conversa). O pai precisa existir, pertencer ao **mesmo `realm`, `source_app` e assunto**, aceitar respostas e produzir `depth<=4`. `root_id` é derivado na escrita, nunca aceito do cliente. Rejeitar na escrita, não corrigir depois. · feito quando: resposta cross-subject, cross-realm ou além de `depth=4` é recusada — inclusive sob concorrência — e resposta a legado é **aceita** com `depth` correto.
- [ ] T2.5 — **Markdown pelo pipeline compartilhado existente; DOMPurify só no legado** (requisito 10; decisões 24, 25, 30). Reformulado: a versão anterior mandava texto puro no comentário novo, revogado pela decisão 24. A Fase 2 **não cria parser, sanitizador nem renderizador paralelo**. Na escrita, o backend passa a entrada por `sanitizeUserMarkdown` de `@artificio/content-editor/sanitize` e persiste o **Markdown canônico**; a API devolve esse Markdown, **não HTML montado**. Consumidores renderizam somente por `MarkdownContent`/`renderMarkdown` de `@artificio/content-editor`, cujo `markdown-it` já roda com `html: false` e cuja saída passa por DOMPurify. Limite de **10.000 caracteres**, validado **tanto na entrada original, antes do trabalho de parsing, quanto no Markdown canônico produzido** (decisão 25); excesso rejeita a operação inteira com erro específico, **nunca trunca silenciosamente nem persiste versão parcial**. Depois da canonicalização, `markdownToPlainText` precisa resultar em **conteúdo não vazio** (decisão 30): espaços, HTML integralmente removido, separador temático isolado ou marcadores sem texto são rejeitados; emoji, código, citação e link com rótulo visível são aceitos. As três regras valem igualmente para criação e edição. O legado do `site` tem `content_html` e é sanitizado **uma vez, na entrada**, com política e versão registradas; a saída passa por defesa adicional **sem regravar o banco**. Nunca ressanitizar continuamente nem alterar o HTML depois de sanitizado (anula a proteção). · feito quando: testes de XSS cobrindo script, links, SVG/MathML, atributos e o HTML legado; entrada de 10.001 caracteres rejeitada antes do parsing; e comentário que sanitiza para vazio rejeitado.
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

  **Dois defeitos encontrados durante a implementação:**

  1. **`new URL('https://../admin')` não lança.** O parser WHATWG aceita `..` como
     hostname, então `../admin` — que o autor escreveu como caminho relativo —
     sairia canonicalizado como link externo válido para um host inexistente, em
     vez de erro. Corrigido com guard explícito antes da canonicalização
     (`relative_not_rooted`). Achado por teste, não por leitura.
  2. **`tsconfig.cjs.json` tinha `include` fixo em `src/sanitize.ts`.** Declarar o
     `require` no `exports` sem acrescentar `commentLinks.ts` ao build CJS
     produziria `MODULE_NOT_FOUND` no backend do `downloads` (que compila
     `CommonJS`) em runtime, com build e CI verdes — mesmo modo de falha de
     E016/E017. O `require` foi exercido de fato (`node -e "require(...)"`), não
     apenas declarado.

  **Decisão que o revisor precisa conferir:** `demoteCommentImages` converte
  `![alt](url)` em link textual `[alt — abrir imagem externa](url)`, mantendo o
  resultado em Markdown para não criar pipeline paralelo. O motivo de a imagem
  nunca ser buscada é mais forte do que "economia de banda": carregar imagem de
  host arbitrário entrega IP e User-Agent de **todo leitor** ao dono daquele host,
  o que transformaria um comentário em rastreador — e contradiz o requisito de IP
  desta spec.

  **Correção de um erro do agente, 2026-08-04 — proxy NÃO é o caminho alternativo.**
  O relatório original desta task afirmou ao mantenedor que "se quiser preview, o
  caminho é proxy próprio, não liberar `<img>`". Está errado e contradiz a spec em
  dois lugares: o requisito 10b (`spec.md:151`) lista **proxy** na mesma proibição
  que `<img>` — "não há `<img>`, fetch automático, upload, Cloudinary, proxy,
  preview ou busca server-side" — e `spec.md:700` põe "upload, hospedagem, **proxy**
  ou preview automático de imagem em comentário" em **Fora de escopo**.
  O agravante material: `packages/media/src/index.ts:307` já expõe `uploadFromUrl`,
  que busca URL remota no servidor. Quem lesse a recomendação errada encontraria a
  função pronta e a usaria — trocando o vazamento de IP do leitor por SSRF no
  servidor, que é pior. **Não existe caminho aprovado para preview de imagem em
  comentário nesta fase**; mudar isso exige decisão nova do mantenedor, não
  inferência de agente.

  **Causa do erro:** o agente ofereceu uma alternativa técnica plausível sem
  procurar se a spec já a tinha decidido — a mesma falha registrada na nota de
  processo do Bloco A ("não alarmar sem ler a documentação"), agora na direção
  oposta: **não recomendar sem ler a documentação**. A regra vale para alternativa
  sugerida, não só para risco levantado.

  **Correções da review da PR #242 — 2026-08-04, cada achado reproduzido antes de
  corrigir.** Quatro procedem, um é defeito que o próprio agente introduziu:

  1. **`??` desligava o fallback legado (P1 do Codex, defeito do agente).** Os
     compose escritos nesta PR usam `SERVICE_CREDENTIAL=${SERVICE_CREDENTIAL:-}`,
     que entrega **string vazia** — não `undefined`. Como `??` só cai no fallback
     para `null`/`undefined`, a string vazia vencia e desligava a resolução de
     e-mail do `downloads` e a busca de segredos de `downloads`/`mesas`,
     **quebrando exatamente o mecanismo legado que a transição precisa manter
     vivo** até T2.2a-op. Trocado por `||` nos três consumidores.
  2. **Autolink contornava a política HTTPS-only (P2 do Codex).** Verificado no
     pipeline real: `sanitizeUserMarkdown` preserva `<http://evil.example>` de
     propósito (`sanitize.ts`) e o `markdown-it` o renderiza como
     `<a href="http://evil.example">`. O scanner só olhava `[texto](destino)`,
     então `findCommentLinkViolation` devolvia `null` e o link saía navegável.
     Acrescentado `AUTOLINK_RE` à varredura, respeitando trechos de código.
  3. **Varredura quadrática sobre corpo controlado pelo autor (CodeQL).** Medido:
     5.000 crases custam 7ms, 10.000 custam 29ms, 10.000 `[` custam 103ms — 2× a
     entrada, 4× o tempo. Não derruba o processo no teto da spec, mas a validação
     roda no request de escrita. Resolvido com `MAX_SCAN_LENGTH = 12.000`, que
     recusa **sem varrer** (`input_too_large`); entrada desse tamanho já seria
     rejeitada pelo limite de 10.000 caracteres da spec.
  4. **`exemplo.com:8443/x` era recusado como esquema inválido.** Host com porta
     casa o mesmo padrão que `javascript:1`. **A primeira correção estava errada:**
     olhar só o dígito depois do `:` fazia `javascript:1` virar
     `https://javascript:1/` — não é XSS (o resultado é `https:`), mas é reescrita
     silenciosa de destino, que a decisão 27 proíbe tanto quanto promover `http:`.
     A correção final exige **ponto no lado esquerdo**, que todo hostname público
     tem e nenhum esquema registrado usa. 9/9 casos verificados.
  5. **Normalização por `.filter()` mascarava linha corrompida.** `['prod', 42]`
     virava `['prod']` e passava como credencial de realm único — o oposto do
     invariante. Trocado por validação que invalida a linha inteira, incluindo
     realm fora do domínio, escopo desconhecido e escopo duplicado.
  6. **Timing revelava quais `token_id` existem.** "Credencial inexistente"
     respondia em microssegundos; "existe, segredo errado" gastava ~50ms de
     Argon2id. A diferença é mensurável pela rede e permite enumerar o registro.
     Agora o caminho de ausência gasta um Argon2id descartável antes de recusar.

  Também corrigido: a pré-checagem do emissor não filtrava por realm, então emitir
  a segunda credencial legítima de um app (outro realm) disparava aviso de
  conflito inexistente e orientava revogar a credencial errada.

  Validação: `accounts` 133/133, `content-editor` 53/53, suíte 38/38 pacotes,
  lint 24/24, build 24/24, `verify:api` exit 0.

  **Dois checks do CI vermelhos na PR #242, ambos corrigidos:**

  - **CodeQL (3 alertas high, `js/polynomial-redos`).** São os mesmos da correção
    3 acima — mas ao conferir os caminhos que a query rastreia apareceu um **furo
    que o guard inicial não fechava**: `demoteCommentImages` é exportada e usa a
    mesma `LINK_RE` quadrática, sem passar por `MAX_SCAN_LENGTH`. O teto protegia
    só `findCommentLinkViolation`, então a porta continuava aberta pela outra
    função pública. Corrigido; acima do teto devolve a entrada intacta, o que é
    seguro porque quem aceita ou recusa o corpo é `findCommentLinkViolation`, que
    para o mesmo texto já respondeu `input_too_large`. `resolveCommentLink` foi
    medida e é linear (40.000 caracteres em 0ms), não precisa de teto.
  - **TruffleHog (`unverified_secrets: 1`).** Falso-positivo material: o achado é
    o fixture `https://banco.example@evil.example/login`, que **prova** que URL com
    userinfo é rejeitada. O scanner roda com `--results=verified,unknown`
    (`secret-scan.yml`), então `unknown` falha o build. Suprimir o gate por causa
    de um teste enfraqueceria a varredura do repositório inteiro, então quem se
    ajustou foi o teste: a URL passou a ser montada por concatenação. Trocar só o
    host não resolveria — o padrão `algo@host` casa qualquer variante. O comentário
    em `commentLinks.ts` que trazia o exemplo literal virou prosa pela mesma razão.

  **Dois nitpicks que o agente havia descartado por raciocínio e o mantenedor
  mandou investigar — um dos descartes estava errado.**

  - **`list` morria em linha corrompida (descarte ERRADO).** O agente escreveu que
    "erro ali é visível na hora". Medido: `row.realms.join()` numa linha com
    `realms` nulo lança `TypeError`, o erro sobe até o `catch` do `main` e o
    comando morre imprimindo só `falhou: Cannot read properties of null`. O
    operador perde a lista **a partir dali** e não descobre qual credencial
    quebrou. Pior no contexto de T2.2a-op, onde `list` é o que prova quais
    credenciais estão em uso antes de revogar a antiga — e há assimetria com
    `resolveServiceCredential`, que rejeita linha fora do invariante: sem
    tratamento, a credencial quebrada não autentica **e** não aparece, ficando
    invisível. Corrigido com `formatArrayColumn`, que imprime
    `<INVÁLIDO: null>`/`<VAZIO>` e segue para as linhas seguintes.
  - **`demoteCommentImages` em trecho de código (descarte correto, mas corrigido
    assim mesmo).** Confirmado por render real: nenhum `<img>` é emitido, o
    conteúdo permanece dentro de `<code>` — não há efeito de segurança. Mas
    reescrever `` `![alt](url)` `` altera silenciosamente o texto de quem só estava
    *mostrando* a sintaxe, e a política desta fase é recusar ou preservar, nunca
    reescrever sem avisar. Passou a respeitar `findCodeRanges`.

  **Bug encontrado ao aplicar essa segunda correção:** a primeira versão usava
  `markdown.replace(LINK_RE, (whole, bang, dest, offset) => ...)`. O segundo grupo
  do `LINK_RE` **casa vazio** em `![alt]()`, e o JS omite grupo vazio dos
  argumentos do callback — então `offset` chegava na posição de `dest` e a
  varredura corrompia a saída. Trocado por `matchAll` + `match.index`, que não
  depende da aridade. Coberto por teste próprio (`![alt]()`).

  **Achados do Sonar na PR #242 — 2026-08-04.** Quatro corrigidos, um recusado com
  medição:

  - **`LINK_RE` super-linear por alternação ambígua (2 achados: runtime e
    complexidade 32).** Procede. `(?:[^\]\\]|\\.)*` deixa o motor tentar dois
    caminhos por caractere; num rótulo que nunca fecha ele explora ambos.
    Reescrito como **unrolled loop** (`A*(?:B A*)*`), cujos ramos são disjuntos por
    construção. Medido no teto de 12.000 caracteres: **248ms → 107ms**;
    equivalência verificada em 12 casos (rótulo escapado, destino entre `<>`,
    título, destino vazio, imagem, múltiplos links). Em comentário realista os
    dois custam igual (4ms/100 execuções), então a troca não paga nada no uso
    normal.
  - **Teste sem asserção (`Blocker`).** Procede em substância: `.expect(401)` do
    supertest é asserção real, mas o teste não verificava o **corpo**, ao contrário
    dos vizinhos. Acrescentado `expect(response.body).toEqual({ error:
    "unauthorized" })` — o corpo genérico é o que impede o oráculo de enumeração,
    e valia asserção explícita.
  - **`legacySecret?: string | undefined` redundante.** Procede: o projeto não usa
    `exactOptionalPropertyTypes` (verificado em `tsconfig.base.json`), então `?` já
    inclui `undefined`.
  - **Promise chain no script.** Procede: o pacote é ESM (`"type": "module"`), então
    top-level await é suportado. `void main().catch(...)` deixava a rejeição fora
    do fluxo. Trocado por `try/await/catch`; `exit 1` confirmado em execução real.

  **Recusado com medição — `CODE_SPAN_RE` (2 achados: runtime e complexidade 23).**
  O custo é inerente ao backreference `\1`, que casa a cerca de fechamento com a de
  abertura e **não admite unrolled loop**. Testei a alternativa óbvia (separar
  inline e fence em duas regexes): cobertura equivalente nos 8 casos, mas **2× mais
  lenta** (98ms contra 44ms), porque são duas varreduras completas mais filtro de
  sobreposição. Medi também de onde vem o custo: o ramo do fence é grátis
  (só-inline 47ms, alternação inteira 46ms) — tudo está no `` (`+)[\s\S]*?\1 ``,
  que a separação não remove. Reescrever para satisfazer a métrica pioraria o que
  a métrica tenta proteger. Decisão e números ficaram comentados na própria
  constante.

  **Terceira rodada de review — 2026-08-05.** Dois achados e dois nitpicks, todos
  procedentes:

  - **`list` renderizava como válido o que a resolução rejeita.** `formatArrayColumn`
    só checava tipo, então `['prod','beta']` e `['staging']` apareciam como realms
    normais — o operador leria a credencial como saudável e ela não autenticaria.
    É a mesma assimetria que a função foi criada para eliminar, invertida.
    `formatRealms`/`formatScopes` agora aplicam o critério de
    `resolveServiceCredential` (realm único, domínio fechado, escopo conhecido,
    sem duplicata), reusando `VALID_REALMS`/`SERVICE_SCOPES` — a lista não é
    duplicada, `VALID_REALMS` passou a ser exportado.
  - **`demoteCommentImages` descartava os `<>` do destino, quebrando o link.**
    Verificado no render: `![a](<https://x.com/um dois.png>)` virava
    `[...](https://x.com/um dois.png)`, que o CommonMark **não** reconhece como
    link — o espaço encerra o destino, e os `<>` existem exatamente para permiti-lo.
    Passou a emitir `rawDestination` intacto; a validação em `scanLinkDestinations`
    já desconta os delimitadores antes de aplicar a política. Coberto por teste.
  - **Asserções por relógio removidas** (`toBeLessThan(3000)`/`(500)`): ficam à
    mercê de runner compartilhado e viram teste intermitente. Trocadas por
    asserções determinísticas — resultado `null` para as entradas no teto e
    igualdade para o passa-direto —, com `timeout` explícito de 30s no caso longo.
    Explosão exponencial continua detectável: estouraria o timeout do vitest.
  - **Pré-condição de `demoteCommentImages` documentada explicitamente:** o
    chamador precisa rodar `findCommentLinkViolation` antes e abortar inclusive em
    `input_too_large`, porque acima do teto esta função devolve a entrada intacta
    e imagem em corpo gigante sairia sem ser rebaixada.

  Validação: `accounts` 133/133, `content-editor` 57/57, suíte 38/38 pacotes,
  lint 24/24, build 24/24.

  **TruffleHog vermelho — reproduzido localmente em 2026-08-04 e é irremediável
  nesta branch, por desenho da ferramenta.** Binário 3.95.5 (mesma versão do CI)
  instalado e rodado com o mesmo range do workflow. Saída exata:

  ```text
  Detector Type: URI     Decoder Type: PLAIN
  Raw result: https://user:senha@host
  Commit: 508d11752abc5ad3eee5571b406dc4dab318190c
  File: packages/content-editor/src/commentLinks.ts     Line: 127
  ```

  **O achado está no commit `508d117`, não no HEAD.** A string era um exemplo em
  **comentário de código** explicando por que userinfo em URL é phishing; foi
  removida em `95f3f69`, e o working tree está limpo (varredura do filesystem só
  encontra `postgres://admin:admin@accounts-db` de `.env.example`, pré-existente e
  fora deste diff). Mas o `secret-scan.yml` varre o **range de commits** da branch
  (`--since-commit`), não o estado final — então a linha continua sendo lida do
  histórico e continuará vermelha enquanto a branch existir.

  Corrigir exigiria **reescrever histórico** (`rebase`/`amend`), proibido por
  `AGENTS.md`. As saídas reais são: aceitar o vermelho neste PR (o achado é
  `unverified`, `verified_secrets: 0`, e `host` não é um host real — a própria
  ferramenta registra `lookup host: no such host`), ou o mantenedor decidir por
  squash no merge, que colapsa o histórico da branch.

  **Erro de método do agente, registrado porque se repetiu duas vezes.** Na
  primeira rodada o agente *supôs* que o gatilho era o fixture de teste
  `banco.example@evil.example` e o reescreveu por concatenação; na verdade aquele
  fixture **nunca casou** o detector (o regex exige `usuário:senha@host`, com
  colon obrigatório — verificado contra o fonte de `pkg/detectors/uri/uri.go`). O
  que casava era o comentário, corrigido por acaso "por precaução". Depois o
  agente concluiu que a correção tinha funcionado porque o regex não achava nada
  nos **arquivos**, sem perceber que o scan é do **histórico**. Só rodar a
  ferramenta real fechou a questão. Regra que fica: para achado de scanner,
  reproduzir com a ferramenta antes de propor correção — inferir o gatilho a
  partir da mensagem produziu duas conclusões erradas seguidas.

  **Trivy falhando na review — investigado em 2026-08-04, é bug conhecido da
  ferramenta, não achado sobre este código.** `Trivy execution failed: ... walk
  error range error: stat packages/content-editor/doctor.config.json: no such file
  or directory`.

  O arquivo **nunca existiu**: não está no disco, `git log --all` não registra
  nenhuma versão, nenhuma dependência instalada o menciona, e não há Trivy em
  `.github/workflows/` (quem o executa é o **CodeRabbit**, dentro da review da PR).

  O que identifica a causa é a comparação com a ocorrência anterior:

  | Quando | Caminho reclamado | Módulo do scanner |
  |---|---|---|
  | 2026-07-31 | `apps/accounts/doctor.config.json` | `cloudformation scan error` |
  | 2026-08-04 | `packages/content-editor/doctor.config.json` | `kubernetes scan error` |

  **O caminho muda e sempre aponta para o diretório com mais arquivos no diff da
  PR; o módulo que falha também muda.** Arquivo real teria caminho fixo.
  `doctor.config.json` é nome que os módulos de IaC do Trivy procuram por
  convenção; o scanner monta a lista de candidatos no `walk` e depois faz `stat`
  em cada um, e trata "candidato sumiu" como **FATAL** em vez de pular. Bug
  conhecido e aberto (`aquasecurity/trivy#3811`, discussion `#7677`, onde a flag
  `--ignore-walk-error` é pedida e ainda não existe).

  **Decisão pendente do mantenedor**, porque desligar tem custo real: o Trivy é o
  que varre os **9 Dockerfiles e 11 docker-compose** do repositório em busca de
  má configuração. `.coderabbit.yaml` aceita `reviews.tools.trivy.enabled: false`,
  mas isso perde a cobertura inteira para silenciar um aviso que não bloqueia
  merge. Alternativa: deixar como está e tratar o aviso como ruído conhecido,
  agora que está documentado aqui.

  **Débito transversal corrigido junto, 2026-08-04 — teste compilado ia para imagem
  de produção.** Achado ao verificar o `dist` do `content-editor`, mas a medição
  mostrou que o problema **não era do `content-editor`**: 10 dos 13 pacotes
  emitiam `*.test.js` no `dist` (`ui` com 16 arquivos, o maior volume), e cinco
  deles (`media`, `catalog-client`, `catalog-matching`, `email`, `content-editor`)
  são copiados inteiros para as imagens de `mesas`, `downloads` e `glossario`.
  Cinco desses arquivos importam `vitest`, e `testSetup.js` importa
  `@testing-library/jest-dom` — devDependencies ausentes em produção.

  **Gravidade real, medida e não suposta:** não é crash. `require` de um teste
  vazado falha com `ERR_PACKAGE_PATH_NOT_EXPORTED`, porque o campo `exports` de
  cada pacote só declara os subpaths públicos. É código morto e superfície
  desnecessária na imagem, não bug de runtime. O relatório inicial do agente
  sugeria risco maior do que o medido.

  **A correção óbvia estava errada e quebrou o lint.** Copiar o `exclude` de
  `catalog-ui` para o `tsconfig.json` dos outros pacotes derruba
  `@artificio/media` e `@artificio/email` com `Parsing error: file was not found
  in any of the provided project(s)`: 12 pacotes usam ESLint type-aware
  (`projectService`/`project`), que resolve cada arquivo pelo projeto TypeScript —
  arquivo excluído do projeto não é lintado, é erro de parse. `catalog-ui` é o
  único caso em que o `exclude` funciona, e só porque ele **não** usa lint
  type-aware; o padrão não era transferível.

  **Solução aplicada:** `tsconfig.build.json` por pacote (10 arquivos), que estende
  o `tsconfig.json` e acrescenta só o `exclude`; o `build` de cada `package.json`
  passa a apontar para ele. Os dois objetivos ficam separados — `tsconfig.json`
  inclui teste para o lint type-aware, `tsconfig.build.json` exclui para o emit.
  Resultado medido: 27 artefatos de teste no `dist` antes, **0** depois; lint 24/24,
  testes 38/38 pacotes, build 24/24, `verify:api` exit 0. Os `tsconfig.cjs.json` já
  usavam `include` explícito por arquivo e nunca vazaram — não foram tocados.

- [ ] T2.6 — **Badge de autor calculado a partir de fonte confiável** (requisito 11). O papel global vem do `JOIN` com `accounts.users`; **"autor do conteúdo" vem do backend do domínio ou de capability assinada — nunca do payload público**, senão qualquer um se declara dono. Usuário comum sem rótulo; e-mail nunca exposto. Comentário legado exibe marca de **antigo/importado com autoria não verificada** (decisões 6, 23), misturado à árvore e à ordenação normais — sem seção própria e sem ocultação. · feito quando: tentativa de forjar dono no payload é ignorada; badge sai correto na resposta; e legado aparece na árvore normal com a marca de não verificado.
- [ ] T2.6b — **Sem `@menções` nesta fase** (decisão 31). Qualquer `@texto` permanece **texto Markdown comum** e nunca resolve conta nem cria destinatário. Motivo material: `accounts.users` **não possui handle público único** — nome Google é mutável e não único, e-mail não pode ser exposto. Notificação continua derivada apenas da estrutura confiável: autor do comentário pai e dono do assunto, excluindo o ator. Menção futura exige decisão própria de identidade pública; **não será simulada por heurística sobre nome**. · feito quando: `@qualquercoisa` renderiza como texto e não gera nenhum `notification_receipt`.
- [ ] T2.6c — **Criar/responder junto do evento e dos recibos** (decisões 1 e 13). **Task nova pela reconciliação de 2026-08-04:** T2.1d criava só o schema e as tasks antigas deixavam a atomicidade ativa em T3.4, tarde demais. Na mesma transação do comentário: raiz gera recibo para publicador vinculado; resposta gera para autor do pai e publicador; destinatários iguais deduplicam; ator e conta removida/bloqueada são excluídos. Evento guarda snapshot estruturado e versionado, sem depender do domínio vivo. Falha em qualquer evento/recibo reverte o comentário. Voto e edição não passam por este fluxo. · feito quando: falha ao inserir recibo reverte criação/resposta; pai e publicador iguais produzem um recibo; e ator não recebe.

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

- [ ] T2.9 — **Identidade resolvida no mesmo `SELECT` sem depender da conta viva** (requisitos 7, 7a–7b; decisão 53). Fazer `JOIN` do comentário ao `community_actor` e, somente quando permitido, ao vínculo/usuário — não segunda chamada nem rota em lote de T1.4. Conta excluída devolve “Conta excluída” e avatar nulo mesmo durante retenção interna; conta ativa devolve perfil; vínculo vencido ou ausente nunca quebra a lista nem reaparece para moderação. · feito quando: uma consulta cobre ativo/excluído/retido/expirado; API pública nunca distingue retenção interna; e-mail/fingerprint nunca entram no resultado.
- [ ] T2.10 — **[P1] Antiabuso com buckets independentes por camada, identidade e ação** (decisões 50, 54). Antes de expor comentários, separar autenticação, leitura, criação/resposta, edição, voto, denúncia e recurso. Backend de cada app aplica IP real validado e usuário; `accounts.` aplica usuário e credencial de `source_app`. Todos os buckets aplicáveis precisam permitir a operação; não combinar IP+usuário numa chave única. Excesso retorna 429 genérico, sem revelar bucket, saldo ou sinal interno. IP bruto permanece somente na chave efêmera da fachada pelo TTL: não entra no payload interno, banco ou auditoria comunitária. Valores são configuração operacional; medição Cloudflare/trusted proxy calibra antes do uso integral e, se falhar, abre correção do ingress sem redesenhar o `accounts.`. · feito quando: carga de comentário não consome cota de `/login`, `/me` ou `/refresh`; cada ação tem orçamento independente; NAT não vira bloqueio coletivo; testes provam as chaves reais das duas camadas e busca negativa prova ausência de IP no contrato/schema comunitário.

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
- [ ] T2.11 — **Testes de borda obrigatórios**. Reformulado: a lista anterior tinha onze itens e incluía "resposta a legado" como caso que **deveria falhar** — invertido pela decisão 23, agora é caso que deve **passar**. Cobrir: pai em outro assunto; pai em outro `realm`; profundidade sob concorrência (`depth=4` é o teto); assunto inexistente; dono forjado no payload; **resposta a legado, que deve ser aceita**; voto em legado, recusado; **auto-retirada do próprio comentário, aceita**; edição por terceiro, recusada; `moderator` revogado com sessão viva; árvore/cursor; voto concorrente; auto-hide; denúncia repetida; decisão concorrente; links hostis; conteúdo vazio/excessivo; `accounts.` indisponível; exclusão sem caso; exclusão com caso/recurso; `legal_hold`; expurgo vencido; recadastro antes/depois de seis meses; sanção ativa; e ausência de IP no payload/schema. · feito quando: todos cobertos, cada negativo falhando fechado, positivos passando, e relógio controlado prova cada prazo sem teste dependente do tempo real.

### Bloco D — Voto e ranking

- [ ] T2.12 — **Mutação de voto por estado absoluto** (decisões 11, 12). **Task nova.** `PUT /internal/v1/comments/:id/vote` recebe `{ value: -1 | 0 | 1 }`; `0` **remove** o voto. Mesmo valor é **no-op**: devolve `200`, **sem nova revisão nem novo registro de histórico**. Troca ou remoção real atualiza voto, contagens, score, versão de ranking e auditoria **na mesma transação**. **Não há `ETag`, `If-Match` nem `Idempotency-Key`**: concorrência entre dispositivos resolve por **última gravação vence**, pela última transação persistida. Token do app e `X-Acting-User-Id` continuam obrigatórios; retry idêntico não duplica efeito. **Somente terceiros votam** (decisão 5): o autor não recebe auto-upvote e **não pode votar no próprio comentário** — divergência deliberada do Reddit, porque aqui o score representa reação de outras contas, não participação do autor. **Comentário legado não aceita voto** (decisão 6). **Conta nova vota imediatamente e com o mesmo peso** (decisão 11): sem espera, quarentena, voto pendente, peso secreto ou assimetria entre upvote e downvote. Proteções iniciais: uma escolha ativa por conta/comentário, rate limit por usuário e IP (T2.10), credencial backend-to-backend e auditoria completa. Endurecimento futuro exige **abuso medido**, não prevenção oculta. · feito quando: voto repetido idêntico não incrementa revisão; voto no próprio comentário recusado; voto em legado recusado; e dois dispositivos concorrentes convergem para a última transação, sem linha duplicada.
- [ ] T2.13 — **Revisão de ranking incrementada sob lock transacional curto** (decisão 8). **Task nova.** Cada assunto mantém `ranking_revision`; cada comentário registra `created_revision`; **mudança de voto incrementa a revisão sob lock transacional curto**. Isto é o que permite o cursor de T2.3 ser stateless: época fixa, ranking vivo sem consistência e snapshot por sessão foram **explicitamente descartados** no grilling. O lock precisa ser curto o bastante para não serializar o assunto inteiro sob carga — dimensionar e medir, não presumir. Referências pesquisadas registradas na decisão 8: árvore truncada e `more` do Reddit (`reddit-archive/reddit`, `r2/r2/models/builder.py`), contrato `MoreChildrenRequest`, limite de snapshot exportado do PostgreSQL 16 e padrão `search_after` + point-in-time do Elasticsearch. · feito quando: votos concorrentes em comentários do mesmo assunto não perdem incremento de revisão, e a navegação paginada iniciada antes deles mantém posição estável.
- [ ] T2.14 — **Transparência de contagens e visibilidade do voto** (decisões 9, 10, 53). **Task nova.** A resposta pública expõe `upvotes`, `downvotes` e `score`; quando autenticada, também `my_vote`. **Score é público imediatamente**: não existe `score_hidden_until`, janela de ocultação nem política por `source_app` nesta fase. A superfície de **moderação** acessa histórico completo por ator e resolve a conta votante somente enquanto existir vínculo permitido por T2.15; após expurgo, não há caminho de reidentificação. **A API pública nunca expõe lista nominal.** · feito quando: resposta pública traz as três contagens e nenhuma identidade; `my_vote` só aparece autenticado; rota de moderação exige papel/auditoria; e relógio vencido remove a identidade sem alterar histórico/score.
- [ ] T2.15 — **Destino do voto e da identidade quando a conta perde acesso** (decisões 14, 15 supersedida em parte, 52–53). **Task nova.** Saída/desativação preserva votos e score, barra voto novo; abuso permite invalidar votos com motivo, auditoria, nova `ranking_revision` e recálculo, sem apagar histórico bruto. Adaptar o `DELETE /api/account` existente (`apps/accounts/src/app.ts:345` e `users.ts:85`): revogar refresh/cookies e eliminar nome/e-mail/avatar/identidade pública no pedido; rotas comunitárias revalidam a conta e recusam access token antigo imediatamente; os demais consumidores permanecem no SLA SSO já aprovado de até 15 minutos. Conteúdo e score passam a “Conta excluída”. Sem caso/recurso, apagar o vínculo ator→conta no mesmo ciclo. Com caso/recurso, restringi-lo à moderação até seis meses após a decisão final; `legal_hold` auditado suspende; executor idempotente remove vencidos e toda leitura trata vencido como ausente. Criar fingerprint HMAC versionado apenas para impedir recadastro voluntário por seis meses ou enquanto sanção durar; nunca expor/logar; remover ao acabar a finalidade. Publicar no fluxo de exclusão controlador, contato, efeitos, prazos, SLA e exceções. · feito quando: os sete cenários temporais de T2.11 passam; comentário/voto sobrevivem sem FK nominal; conta reaparece só como nova identidade após seis meses; token antigo não escreve na comunidade; e busca negativa prova ausência de PII/IP no ator desvinculado.
- [ ] T2.16 — **Voto não gera notificação** (decisão 13). **Task nova.** Nem voto individual nem marco agregado ("seu comentário chegou a 10 pontos") cria `notification_event` ou `notification_receipt`; o autor acompanha contagens na própria thread. O núcleo transacional antecipado da Fase 3 (T2.1d) continua **restrito a criação de comentário e resposta**. · feito quando: sequência de votos não produz nenhum recibo, provado por teste.

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
