# Spec 106 — Identidade pública do mestre (`mesas`): nome, URL e reports abertos do perfil

**Status:** pronta para execução; nenhuma decisão do mantenedor em aberto (§3.1) · **Criada:** 2026-10-27 · **Apps:** `apps/mesas` (e `packages/catalog-table`, só se T8.2 exigir)
**Origem:** relato do usuário Victor (`username = void`): ao procurar a mesa dele, o card mostra
`patorico027`, o prefixo do e-mail dele, em vez de `VOID`. Ele já tinha reportado o problema pelo
formulário de feedback do próprio site em 2026-10-25 12:27 (`dev_feedback`, kind `bug`, título
"Como eu mudo o nome do meu perfil?", status `new`, ninguém leu). A investigação dos outros 13
reports abertos achou mais 6 defeitos e 5 classes de risco sem trava.

---

## 0. Como executar esta spec num chat novo

1. Ler: `AGENTS.md` inteiro, esta spec, `plan.md`, `tasks.md`. T1 que a spec toca:
   `docs/agents/deploy-flow.md` §3 (migration), `docs/agents/deploy-runbook.md` (deploy de
   `mesas`), `.specify/memory/errors.md` (migration e Dockerfile = 13 dos 23 incidentes).
2. Estado do código não está nesta spec: `git status`, `git log`, `gh` medem. Esta spec guarda o
   que comando não mede: diagnóstico, decisão, bloqueio.
3. Remedir antes de agir: o banco muda. Os números da §2 são de 2026-10-27; cada task diz o
   comando que os remede.
4. Branch nova de `dev` atualizado (`git fetch origin && git switch -c fix/106-identidade-mestre origin/dev`).
   Não commitar sem a palavra nominal do mantenedor. Push e PR estão liberados por decisão dele.
5. A §3 separa o que é decisão dele do que o agente decide. **Agente não pergunta o que está em
   §3.3.** Só para e pergunta no que está em §3.1 (decisão) e §3.4 (autorização).
6. Acesso à produção: `ssh faren` + `docker exec mesas-db sh -c 'psql -U "$POSTGRES_USER" -d mesas_rpg …'`,
   só `SELECT`. Qualquer escrita é §3.4.

---

## 1. Problema

O mestre tem **três campos de nome** que as superfícies públicas resolvem de formas diferentes,
**nenhum campo para editar o principal** (`gm_profiles.nickname`) fora de um botão escondido no
editor de mesa, e a criação do perfil de mestre **deriva nome e URL do prefixo do e-mail** da conta
Google. O prefixo do e-mail fica público, indexado e sem caminho para troca.

Falhas, todas medidas na §2:

- **A. Origem do nome.** O `nickname` nasce de `patch → username → prefixo do e-mail → slug` e
  nunca lê `profiles.display_name`, o nome que o usuário digitou no onboarding.
- **B. Origem da URL.** O `slug` nasce de `username → prefixo do e-mail`. `PUT /gm/profile` não
  aceita `slug` e não existe redirecionamento de slug. O sitemap de produção lista o slug.
- **C. Superfícies divergentes.** Página da mesa usa `master_display_name ?? gm_display_name`;
  card, OG, busca e lista ignoram `master_display_name`.
- **D. Sem campo de edição.** A aba Mestre de `/perfil` não tem campo de nome público.
- **E. Formulário quebrado.** `Username` e `Nome de Exibição` gravam a cada tecla; o servidor
  recusa 1–2 caracteres e o contexto descarta teclas durante requisição em andamento.
- **F. Sem auditoria.** `activity_log` não registra mudança de nome, nem sucesso nem recusa.
- **G. Onboarding não explica.** "Nome de exibição *" não diz onde aparece nem que a página de
  mestre usa outro campo.
- **H. `/perfil` quebrou inteira para um mestre** (`redfallen`). Corrigido em produção; o usuário
  nunca foi avisado e nenhum mecanismo teria detectado o erro sem o report dele.
- **I. Vagas erradas no perfil público do mestre** (2 reports) e em mais 3 lugares com a mesma conta.
- **J. Link de inscrição quebrado em 2 mesas ativas** e 3 contatos `form` que duplicam o Discord.
- **K. Fila de feedback sem desfecho nem aviso ao autor:** 14 `new`, o mais antigo de 2026-07-22.
- **L. Cinco classes de risco sem trava** (R17 a R21).

---

## 2. Evidência medida (2026-10-27)

Banco: `ssh faren 'docker exec mesas-db sh -c "psql -U \"\$POSTGRES_USER\" -d mesas_rpg -c …"'`.
Rede: `curl` GET com `?cb=$(date +%s%N)` (CDN mede cache, não origem).

### 2.1 O caso do Victor

```
users:        username=void, role=gm, criado 2026-10-25 11:46
profiles:     display_name='VOID' (criado 11:48, última edição 17:16)
gm_profiles:  slug='patorico027', nickname='patorico027' (criado 11:54, updated_at = created_at)
tables:       uma-bebida-muito-potente-mvo1m1ys, master_display_name vazio
activity_log: 25 linhas do usuário, todas dev_feedback.created e table.*; zero de nome
```

`COALESCE(gm.nickname, p.display_name, gm.slug)` (`gm.ts:145`) e `COALESCE(gm.nickname,
p.display_name)` (`tables.ts:247`, `:1000`, `og.ts:242`) devolvem `patorico027`.

O report dele, literal: "Tem dois lugares para preencher, nome e Username, preencho o nome e
qualquer coisa que escreva no user name da erro, dai quando eu entro no meu perfil publico ta o
nome do meu e-mail mostrando para os jogadores, gostaria que fosse outro nome."

### 2.2 Tamanho do problema

```sql
SELECT count(*), count(*) FILTER (WHERE lower(gm.nickname)=lower(split_part(u.email,'@',1)))
FROM gm_profiles gm JOIN users u ON u.id=gm.user_id;                       -- 66 | 4
SELECT … WHERE lower(gm.slug)=lower(split_part(u.email,'@',1));            -- 5 slugs
```

| slug | nickname | display_name | mesas ativas | conclusão |
|---|---|---|---|---|
| `patorico027` | `patorico027` | `VOID` | 1 | trocar nickname e slug (D1, D2) |
| `academiahardya` | `academiahardya` | `Albert` | 0 | trocar nickname e slug (D1, D2) |
| `dadoviciadopodcast` | `dadoviciadopodcast` | (vazio) | 2 | nome `Dado Viciado`, slug `dado-viciado` (D8, dado por ele) |
| `endyrpg13` | `endyrpg13` | (vazio) | 0 | nome `Endy`, slug `endy` (D8, dado por ele) |
| `cleziorpg` | `ClézioRPG` | `ClézioRPG` | 1 | não troca: o nome foi digitado por ele e `slugify('ClézioRPG')` = o slug |

Dos 4 `nickname` iguais ao prefixo, 2 têm `display_name` diferente (VOID e Albert).
`dadoviciadopodcast` é o mestre que motivou o E1 da spec 099 (report de 09-01): o E3 o "recuperou"
gravando o prefixo do e-mail como nome. Continua assim.

### 2.3 Sitemap e URL

`curl https://mesas.artificiorpg.com/sitemap.xml?cb=…` → 66 `<loc>` de `/mestre/`, incluindo
`patorico027`, `academiahardya`, `endyrpg13`, `dadoviciadopodcast`. `/mestre/patorico027` → 200.
`rg -c -i "slug_history|old_slug|previous_slug|gm_slug_redirect|slug_redirect"` em `backend`,
`database`, `frontend` → 0 (exit 1). `gmPanel.ts` `PUT /profile` não desestrutura `slug` (`:370-390`).
Rota pública: `routes.ts:21` `mestre/:slug`; API `GET /api/v1/gm/perfis/:slug` (`gm.ts:119`).
Montam `/mestre/${slug}` com o slug vindo da API: `ProfileEditPage.tsx:189`, `TableCard.tsx:208`,
`MasterCard.tsx:147`, `TableMaster.tsx:65`, `MestreReviewsSection.tsx:129`, `og.ts:185`, `sitemap.ts:42`.

### 2.4 Três portas criam `gm_profiles`

`rg "insertInto\('gm_profiles'\)"` → `gmPanel.ts:295` (`POST /gm/profile`, **recebe `slug` e `nickname`
do cliente**, que os deriva em `useProfileQuery.ts`), `profileService.ts:367` (`updateGmProfile`) e
`profileService.ts:528` (vínculo do Discord). Só os dois últimos usam `prepareNewGmProfileIdentity`
(`profileService.ts:97`). O editor de mesa (`useTableEditor.ts:1043-1050`) deriva o `slug` do
nome digitado. **Qual das portas criou o perfil do Victor às 11:54 não foi medido**; as três
derivam do e-mail, então a causa independe disso.

### 2.5 Divergência entre superfícies

23 das 224 mesas (`active`) têm `master_display_name`; em **6** ele difere do perfil. Nelas, a
página da mesa (`packages/catalog-table/src/tableViewMapper.ts:275`) mostra um nome e o card
(`TableCard.tsx:212`), a descrição OG (`ogDescription.ts:59`), a busca (`tables.ts:311`) e a
lista (`tables.ts:247`) mostram outro. `whatsappAnnouncement.ts:438` usa a sobrescrita.
`AuthContext.tsx:43`, `actorNameResolver.ts:26`, `activityLog.ts:142`, autor de avaliação
(`gm.ts:688`) e lista do admin usam `profiles.display_name`.
`packages/catalog-table` tem um único consumidor: `apps/mesas/frontend` (`rg -l` em `package.json`).

### 2.6 Formulário

`ProfileEditPage.tsx:383` e `:394` chamam `updateProfile`/`updateUser` em `onChange`. Validação
no servidor: `profile.ts:51` (username ≥ 3), `me.ts:124` (display_name ≥ 2).
`ProfileContext.tsx:168` e `:177` retornam cedo se `isPending`. `users.username` é nulo em 139
de 154 usuários. `username` define `/jogador/:username` e alimenta a derivação do mestre. Nenhuma
das 3 portas do §2.4 lê `profiles.display_name`.

### 2.7 Decisões anteriores que esta spec toca

- **Spec 099 E1/E3 (2026-09-01):** fixou `patch → username → prefixo do e-mail → slug`, espelhada
  em `profileService.ts:70` e `useProfileQuery.ts:348`, travada por
  `profileServiceNickname.test.ts`. O E3 gravou o `nickname` de 7 perfis por essa ordem. O motivo
  era nunca deixar o `nickname` nulo; `display_name` e privacidade do e-mail não foram
  considerados. **Esta spec a substitui**, mantendo a garantia de `nickname` nunca nulo.
- **Migration 03:** `nickname` existe "sem sobrescrever `profiles.display_name`". Mantida.
- **Spec 096 (2026-08-23/24):** editar o nome no editor de mesa vira sobrescrita daquela mesa e
  o perfil não muda; botão "Sincronizar com o Perfil Principal de Mestre". Mantida.
- **AGENTS.md:** slugs e 301 inegociáveis no SEO. O veto a dados foi esclarecido em 2026-10-27
  (§3.2, D12): é a venda/repasse/vigilância, não a coleta técnica de operação.

### 2.8 Reports de usuários: os 14 `new`

`SELECT status, kind, count(*) FROM dev_feedback GROUP BY 1,2` → `new/bug` 13, `new/suggestion` 1,
`resolved/bug` 3. Os 3 resolvidos têm `reviewed_at` e `admin_notes`; os 14 `new` têm `reviewed_at`
nulo. Cada um dos 14 foi lido na íntegra e medido contra o código e a produção.
`dev_feedback_status_check`: `new`, `triaged`, `in_progress`, `resolved`, `wont_fix`, `duplicate`.
`admin_notes` só é lido pelo painel de admin (`DevFeedbackPanel.tsx`); nenhuma rota de usuário o
devolve (`rg admin_notes` fora de `devFeedbackAdmin`/painel → só `hydration/config.ts`, do
`vtt_platform_suggestions`, outra tabela). **As notas são internas.**

**Abertos de fato:**

| Report | Diagnóstico medido |
|---|---|
| 10-25 `void` | §2.1 a §2.6 |
| 09-30 e 10-11 `redfallen` | `/perfil` quebrava com `Minified React error #130`. O nome `VttPlatformsEditor` no stack é o do chunk, não o do componente. A causa está no código (`linkTypes.ts:8-13`): a cópia do mapa de ícones do `LinksManager` não tinha `whatsapp`, o `<Icon/>` recebia `undefined` e o `ErrorBoundary` derrubava a aba Mestre para todo mestre com link `wa.me`. Medido: os 3 links dele (`user_links`) foram criados em 09-30 09:29–09:34 UTC (06:29–06:34 BRT, o "05:30 ou 06hs" do relato), um é `wa.me`; `contact_methods` dele é `[]`. Correção `2e38fd1` (PR #336, mergeada em 2026-10-12 12:04) está no HEAD da VM (`eefc4b6c`) e a imagem de `mesas-app` é de 2026-10-13 20:29. Bloqueado 13 dias sem aviso. `gm_profiles.updated_at` dele segue 09-14: não sabemos se voltou a gravar. Não reproduzi com a sessão dele |
| 08-28 `mestre_hermes` e 10-21 | `gm.ts:249` seleciona `t.slots_filled` e **não** `t.slots_open`; `useMestre.ts:284` soma `slots_total - slots_filled`. No banco, `mestre-hermes`: `slots_filled` 0 em todas, `slots_open` 2, 4, 4, 0, 5, 6. `utils/slots.ts:39` e `tableViewMapper.ts:194` ("CORREÇÃO DT-09") já usam `slots_open`, e `tables.ts:215` e `TableCard.tsx:507` mandam usar. A conta crua continua em `useMestre.ts:284`, `whatsappAnnouncement.ts:274` e `gmPanel.ts:725` (campo `slots_available` da resposta de `GET /gm/tables/:id`, que nenhum código lê: `rg slots_available` → 1 ocorrência, a que escreve). Os cards da página do mestre caem no fallback porque o payload não traz `slots_open`. 40 de 225 mesas ativas têm `slots_filled > 0` |
| 07-28 | `table_contacts` de `uma-nova-fabula-se-inicia-ms21l0mk`: `https://forms.gle/mVvUiUTq7Z5yJTWT9)__`; de `techno-jogos-do-anfitriao-mrrxgq10`: `https://forms.gle/b3uwFZeGNLQViQ1U7**`. Ambas `origin = imported`. O parser já limpa (`parseDiscordAnnouncement.ts:1931`, "medido em produção 2026-08-11"), **o dado das 2 linhas não**. O caminho manual também aceita o lixo: `canonicalizeHttpsUrl` (`contactUrls.ts:54`) devolve válido para ambos (`new URL` aceita). Outros 3 contatos `form` (`uwill`, `.zero9899`, `kauarang`; mesas `a-sombra-do-mago-estranho-mrdx6a4m`, `ark-nova-mrdx82bh`, `o-misterio-da-ilha-do-mal-mrdxat4h`) são o handle de Discord duplicado: cada mesa tem `discord` (sort 0) e `form` (sort 1) com o mesmo valor; as 3 são `imported` de 2026-07 e nenhum `form` sem URL nasceu depois |
| 08-27 Dungeon World | `systems` 1269 linhas; `name ilike '%dungeon world%'` → 0. `Apocalypse World` existe. **Nenhuma sugestão de Dungeon World existe** (a `rejected` com `%dungeon%` é "Dungeons e Dragonsd 5&", D&D 5 com erro de digitação). O jogador reportou pelo feedback, não pelo fluxo de sugestão. **Correção de outra afirmação minha:** as 2 linhas "The Apocalypse" não são duplicata; são `variant` de Werewolf 1e e 2e (`parent_id` diferentes). Não medi a linha `of Darkness … "2.0` |
| 08-27 `o-trovador` (sistema 500, banner como `player`) | Linha do tempo: conta 22:14, report de banner como `player` 22:25 (`GET /gm/me` → 404, esperado sem perfil), `table.created` 22:40:26 (o `gm_profiles` nasceu aí, spec 096), report `POST /profile/systems` 500 às 22:48:57 e 22:48:58. Hoje tem banner e 1 sistema. Logs de agosto não existem (o log do container começa em 2026-10-13 20:29 e tem 7 chamadas `profile/systems` no total). **Causa não medida**; hipótese E1 não testada |
| 10-06 Crônicas de Aureth | `reporter_role = player`, sem `gm_profiles`, 0 sistemas; colou um anúncio de mesa no campo de feedback. Provavelmente tentou publicar mesa por ali. Não percorri o caminho como `player` |

**Tratados** (não entram na implementação, mas recebem desfecho):

- 07-22: `GET /api/v1/tables/odisseia-…` responde `410` "Mesa encerrada" (`tables.ts:1020`, spec 090/102).
- 08-24 `Erro ao criar link` (500): `db.fn.count` (backlog `D-QA-ROTAS-ESCRITA-SEM-TESTE`); depois de
  2026-08-24 `user_links` ganhou 21 links de 11 usuários. A classe "rota de escrita sem teste" segue
  aberta no backlog, fora desta spec.
- 09-01 "nome e sistema" (`dadoviciadopodcast`): spec 099 E1/E2/E3 (ligação com a §2.2).
- 09-08 filtro por dia da semana: `GET /api/v1/tables?weekday=sexta` → 3 resultados contra 30;
  `weekday=domingo` → 4; valor inválido → 30 sem erro. Não medi se a UI o deixa visível.

**Fila:** `devFeedbackAdmin.ts:110-183` (`PATCH`) grava status/notas e `activity_log` mas **não avisa o
autor**. O aviso ao admin existe só na criação (`devFeedback.ts:80`, `notifyAdmins`).
`enqueueNotification` (`notificationOutbox.ts:158`) com `eventType: 'mesas.system.notice'` e `body`
chega ao usuário sem tocar `apps/accounts`: `notificationFormatter.ts:98-101` devolve o `legacy_body`
de qualquer evento com ponto que não seja `comment.`/`moderation.`.

### 2.9 Riscos sem trava (medidos)

- **Mapa por string externa sem fallback:** `MestreContactMethods.tsx:100-101` faz
  `CONTACT_CHANNEL_META[contact.channel].icon` sem fallback; `linkTypes.ts` tem fallback e
  `linkTypes.test.ts`. Os 7 canais em `table_contacts` (whatsapp 83, form 137, instagram 4,
  discord 42, email 1) e em `contact_methods` (whatsapp 30, discord 13, email 2, form 2,
  instagram 1, phone 1) são todos conhecidos: risco latente, não bug atual.
  `TableContactsBlock.tsx:218` tem fallback.
- **Contenção:** `ErrorBoundary` só de rota (`perfil.tsx`, `root.tsx`). `ErrorBoundary.tsx:36-40`
  tem um `TODO: Integrar com Sentry` e um `onError` opcional que ninguém passa.
  `entry.client.tsx` renderiza `<HydratedRouter />` sem `onError`.
- **Detecção:** `diagnostics.ts` guarda um buffer (console, rede ≥ 400) que só sai se a pessoa
  abre o widget e envia feedback. Não há endpoint nem serviço de erro. É assim que o `redfallen`
  ficou 13 dias bloqueado sem que ninguém soubesse.
- **Escrita:** o editor manual aceita cauda de Markdown em URL (acima).
- **Regra duplicada:** `profileServiceNickname.test.ts` trava a ordem errada; nenhum teste cruza
  vagas entre perfil, home, WhatsApp e notificação.
- **Sem política de privacidade publicada:** em `apps/site/src/pages` só existe
  `termos-de-uso-e-direitos-autorais.astro`, sem seção de dados, cookies ou coleta. O site já usa
  GA4 (`packages/analytics`).

### 2.10 Não medido

- Qual das 3 portas criou o `gm_profiles` do Victor.
- Se `academiahardya` veio do backfill E3 (inferência).
- Se `dadoviciadopodcast`/`endyrpg13` usam o prefixo do e-mail de propósito (parece nome de marca).
- Links externos já compartilhados com o slug antigo (só o que o Search Console indexa é conhecido).
- Capacidade de memória/CPU da VM para um serviço novo de erro (relevante só se D13 mudar).
- Spec 102: os 6 perfis com "Duplicate, Google chose different canonical" (fora de escopo).
- Quem rejeitou "Dungeons e Dragonsd 5&" e se o filtro de dia da semana é visível na UI.

### 2.11 Inventário de dados (base da F9)

Medido em 2026-10-27; a execução da F9 remede cada linha.

- **Cookies** (`apps/accounts/src/cookies.ts`): `artificio_session` (15 min) e `artificio_refresh`
  (7 dias), `httpOnly`, `secure`, `sameSite=lax`, domínio `COOKIE_DOMAIN`. Cookie `XSRF`
  (`packages/auth/src/csrf.ts:17`, `mesas/.../csrfProtection.ts:17`). Cookie de tema
  `artificio_theme` (`entry.client.tsx`). GA4: cookie em `.artificiorpg.com` (`config.ts`).
- **GA4** (`packages/analytics`): `anonymize_ip` ligado em `initGtag`, `allow_google_signals` e
  `allow_ad_personalization_signals` desligados. Sem consentimento (D22).
- **Conta** (`artificio_auth.users`): `id`, `google_sub`, `email`, `name`, `avatar`, `role`,
  `avatar_source`, `role_version`, `created_at`. Login só Google.
- **`mesas`**: `users` (`google_id`, `email`, `username`, `location`, `privacy_public`),
  `profiles` (nome, bio, avatar, idiomas), `player_profiles`, `gm_profiles` (bio, `contact_methods`
  com WhatsApp, telefone, e-mail, Discord), `user_links`, `table_contacts` (públicos),
  `dev_feedback` (`contact_email`, `user_agent`, `viewport`, erros de console e rede, screenshot),
  `activity_log` (ator e alvo), notificações, favoritos.
- **Métricas** (spec 105): `table_metric_events` (`fingerprint_hash`, sem IP),
  `gm_profile_view_events` (`session_id`), `table_click_events` (sem identificador). Existe rotina de
  anonimização (`anonymizeMetricEvents`); o prazo exato não foi medido.
- **Terceiros que recebem dado:** Google (login e GA4), Cloudinary (imagem enviada), Cloudflare
  (borda e túnel), Discord (só quem vincula a conta). Não medi Google Fonts nem outros hosts de
  fonte/script do `site`.
- **GA4 no projeto inteiro (medido em produção, 2026-10-27, `curl` do HTML e dos bundles `.js` de
  cada host):** `artificiorpg.com` (`Analytics.astro`, snippet empacotado) carrega `G-2H50PCM950`;
  `downloads` carrega o mesmo `G-2H50PCM950`; `mesas` carrega `G-43T3C6K6V6`; `glossario` carrega
  `G-YVHMJEVTE4`. `links` e `accounts` não carregam GA4 (nenhum `G-…` no HTML nem nos bundles;
  `initGtag` só é chamado em `mesas`, `glossario`, `downloads`). `site-admin` não tem host próprio medido.
  Nenhum host envia `Set-Cookie` (`curl -sI`); o `_ga` é gravado pelo gtag no navegador. Nenhum
  gate de consentimento em nenhum app. Cada `G-…` é um fluxo de dados; não medi quantas
  propriedades do GA4 existem por trás deles.
- **Outros pontos de coleta do `site`, ainda não lidos:** `FeedbackWidget.astro:207` envia para
  `POST /api/feedback` (o que guarda não foi medido); a CSP libera `static.cloudflareinsights.com`
  (Cloudflare Web Analytics, injetado na borda; não medi se está ligado no painel). O rodapé do
  `site` linka só os Termos.
- **Contato do controlador:** `artificiorpg@gmail.com` (`termos-de-uso-e-direitos-autorais.astro:120`).
- **O que não existe:** página de privacidade, mecanismo de consentimento. Não medi se há rota de
  exclusão ou exportação de conta.

---

## 3. Decisões e autorizações

Critério: `AGENTS.md` §Produto vs. técnico. **Dele:** o que o produto faz, o que o usuário vê,
prioridade, prazo, escopo, risco de negócio, custo operacional e toda ação de §Autorização.
**Do agente:** como implementar, padrão, nomes, estrutura de teste, forma de correção, ferramenta,
redação de doc interna.

### 3.1 Decisões abertas do mantenedor

**Nenhuma.** As oito que a documentação exigia foram respondidas em 2026-10-27 (§3.2). Se a
execução achar algo de produto fora da §3.2, para e pergunta com opções medidas.

### 3.2 Decisões já tomadas por você (2026-10-27)

| # | Decisão |
|---|---|
| D1 | Trocar os slugs que expõem o prefixo do e-mail, com tabela de redirecionamento 301 e sitemap atualizado ("sim") |
| D2 | Albert: o que está escrito no campo certo (`profiles.display_name` = `Albert`) |
| D3 | Tudo vira uma spec nova (esta), pronta para um chat de execução |
| D12 | **Esclarecimento do veto a dados.** O veto é a dado coletado para vender, repassar a terceiros ou vigiar pessoa. Coleta técnica necessária para operar (erro, desempenho, segurança, auditoria) é permitida: mínima, guardada só no Artifício e sem identificar além do necessário. Gravado em `AGENTS.md` §Produto e SEO, `.specify/memory/constitution.md` e `apps/mesas/docs/agents/context-capsule.md` |

| D4 | O `nickname` de perfil novo nasce de `patch (o front manda o nome da conta Google, se tiver) → profiles.display_name → username → user-<8 hex>`, nunca do e-mail ("d4: sim") |
| D5 | Campo "Nome público do mestre" na aba Mestre, separado do nome da conta ("d5: sim") |
| D13 | Avisar o autor do report por notificação in-app ao fechar ("d13: sim"). Só in-app, sem e-mail novo |
| D8 | "é Dado Viciado e o outro é Endy": `dadoviciadopodcast` passa a `Dado Viciado` e `endyrpg13` a `Endy`. Slug derivado pela regra R1: `dado-viciado` e `endy` (medido: nenhum dos dois existe; `void` e `albert` também estão livres). **A derivação do slug a partir do nome é minha leitura**; o `--dry-run` da T6.1 imprime o slug antes de gravar |
| D9 | Incluir Dungeon World e outros PbtA no catálogo central ("D9: sim"). Fronteira em T8.5: PbtA é família de milhares de títulos, então a lista é fechada |
| D14 | Política de Privacidade no `site`, "sim e completo": F9 cobre o inventário inteiro da §2.9, não só GA4 e erro |
| D15 | Ordem das fases do `plan.md` §14 ("sim, mas não execute, apenas deixe toda a spec pronta"). **Esta sessão não executa nada da spec** |
| D21 | O commit e a PR levam todo o diff, inclusive os `tasks.md` das specs 091 e 105 e o `cloudflared` ("todo o all vai no commit e na pr") |

| D23 | Remover o resíduo de vínculo Discord (rotas `/profile/me/connect/discord`, `connectDiscord`), antiga autenticação Discord sem uso ('coloque no final da spec'). Tarefa T10.1 |
| D22 | **Sem banner de consentimento.** A política informa que a coleta é permanente e o que se coleta ("segue sem informar […] coloque apenas na política que sempre coleta e o que coleta, na página de política"). Razão dele: os cookies servem à manutenção do site e a outros fins técnicos. Recomendação do agente era banner com recusa; o mantenedor decidiu o contrário. Registrado como decisão de **não fazer** o banner (T9.4 encerrada) |

### 3.3 Decisões do agente (executar sem perguntar; ele reverte se quiser)

| # | Decisão |
|---|---|
| D6 | Uma função de resolução de nome (SQL no backend) para card, OG, busca, lista, perfil e página da mesa |
| D7 | `cleziorpg` não troca (§2.2) |
| D10 | Remover os 3 contatos `form` que duplicam o Discord (reversível por `INSERT`; a escrita em si é §3.4) |
| D11 | Vagas seguem `slots_open`, com `COALESCE(slots_open, slots_total - slots_filled)` calculado no backend e consumido pelo front |
| D16 | Telemetria de erro **própria**: endpoint + tabela no próprio banco do `mesas`, sem serviço de terceiro (plan §9). Motivo: o repasse a terceiros é o que o produto veda (D12); Sentry SaaS levaria stack e `user_id` para fora; GlitchTip self-hosted são ~4 containers (número de um fornecedor, não verificado) e custaria memória da VM que não medi. Se D16 mudar para serviço próprio na VM, vira **custo operacional, decisão sua** |
| D17 | `ErrorBoundary` por seção, fallback em mapas por string externa, teste de paridade com o backend |
| D18 | Gravar ao sair do campo (`onBlur`/`Enter`) e validar antes de enviar, no `Username` e no `Nome de Exibição` |
| D19 | `admin_notes` dos 14 reports em linguagem técnica, internas (§2.8) |
| D20 | O `redfallen` de 09-30 fica `resolved` com nota "confirmação do usuário pendente"; o de 10-11 `duplicate` dele |

### 3.4 Autorizações (§Autorização: nominais, a cada ação)

| Ação | Quando pedir |
|---|---|
| `commit` | A cada commit, com a palavra `commite`. **Conteúdo = todo o diff, inclusive os `tasks.md` das specs 091 e 105 e o `cloudflared`** (decisão dele, 2026-10-27: "todo o all vai no commit e na PR") |
| `push` de branch e abertura de PR | Liberados por ele. `push origin dev`/`main`, merge: não |
| Aplicar a migration em produção | Ao fim da F2 (168) e da T8.7 (169); vem junto com o deploy (`deploy-flow.md` §3) |
| Deploy de beta e de produção | Por módulo, nominal. `beta-antes-de-prod` bloqueia produção sem beta com `main` |
| `UPDATE` em `dev_feedback` (14 linhas) | T8.4. Estrutura do pedido em `tasks.md` T8.4 |
| `UPDATE` de `gm_profiles.nickname`/`slug` + `gm_slug_redirects` (Victor, Albert, Dado Viciado, Endy) | T6.1, depois de ensaio em beta, `pg_dump` de `gm_profiles` e `profiles` |
| `UPDATE`/`DELETE` em `table_contacts` (2 + 3 linhas) | T8.3, `pg_dump` de `table_contacts` antes |
| Lib/pacote novo | Não previsto. Se aparecer, pergunta antes de instalar |
| Tocar `packages/catalog-table` | Só se T8.2 precisar; blast radius medido: 1 consumidor (`apps/mesas/frontend`) |
| Usar o Chrome com sessão dele | Nunca sem pedir; o `redfallen` exige a conta dele, não a nossa |

---

## 4. Requisitos

**Identidade**

- **R1** `nickname` e `slug` de perfil novo nunca derivam do e-mail. `nickname` nunca é nulo nem
  fora de 2–40 caracteres (garantia da 099 preservada). Vale nas 3 portas do §2.4.
- **R2** Front e back usam a mesma regra, de uma fonte só: o backend deriva; o front não deriva.
- **R3** Todo slug trocado responde 301 para o slug atual em `/mestre/:slug`; o sitemap lista só o novo.
- **R4** Um nome de mestre resolve igual em página da mesa, card, OG, busca, lista e compartilhamento.
- **R5** A aba Mestre tem o campo "Nome público do mestre", com validação visível e salvamento ao sair.
- **R6** `Username` e `Nome de Exibição` gravam ao sair do campo, validam antes de enviar e não
  descartam tecla.
- **R7** O onboarding diz onde o nome aparece e como mudá-lo depois.
- **R8** Mudança de `display_name`, `nickname`, `username` e `slug` grava `activity_log` (ator,
  valor anterior e novo, resultado, motivo da recusa).
- **R9** Correção do dado dos mestres afetados, com `pg_dump` prévio e aprovação nominal.

**Reports**

- **R10** `/perfil` não cai inteira por um componente. A causa do `redfallen` está corrigida;
  falta o usuário confirmar.
- **R11** O perfil público do mestre mostra as vagas que ele controla (`slots_open`).
- **R12** Contato de URL não carrega cauda de Markdown: as 2 linhas ativas corrigidas, o editor
  recusa ou limpa a cauda, os 3 `form` duplicados de Discord removidos.
- **R13** Cada report ganha desfecho (`status`, `admin_notes`, `reviewed_at`), e o `PATCH` avisa o
  autor (D13). Os 14 atuais saem de `new`.
- **R14** Dungeon World, Monster of the Week e Urban Shadows no catálogo central (T8.5); `Monsterhearts`, `Masks` e `Apocalypse World` já casam no catálogo (conferir o que casou).
- **R15** Vagas: `gm.ts:249`, `useMestre.ts:284`, `whatsappAnnouncement.ts:274`, `gmPanel.ts:725`
  usam a mesma conta (D11).
- **R16** `/painel` não oferece edição de banner a quem ainda não tem perfil de mestre sem dizer
  que o perfil nasce ao criar a primeira mesa.

**Prevenção**

- **R17** Todo mapa indexado por tipo/canal que vem do servidor tem fallback e teste de paridade
  com o backend. Começa por `MestreContactMethods.tsx:100-101`.
- **R18** `ErrorBoundary` por seção em `/perfil` e na página do mestre.
- **R19** Erro de renderização e de rota no cliente chega ao próprio servidor, sem depender de o
  usuário abrir o widget, e avisa o admin na primeira ocorrência (plan §9).
- **R20** O editor de contato limpa ou recusa cauda de Markdown, e uma varredura periódica acusa
  contato de URL com cauda inválida.
- **R21** Dois testes cruzados: vagas (perfil × home × texto do WhatsApp × resposta do editor) e identidade
  (`nickname`/`slug` nunca iguais ao prefixo do e-mail).
- **R22** Política de Privacidade completa publicada (D14, D22): inventário da §2.11, finalidade de
  cada coleta, que a coleta é permanente e sem recusa (D22), direitos do titular (LGPD art. 18),
  retenção, contato do controlador, sem venda nem repasse (D12). Sem banner.

## 5. Fora de escopo

Mudar o contrato de `profiles.display_name`, a regra de sobrescrita por mesa da spec 096,
`/jogador/:username`, o canonical dos 6 perfis da spec 102, a classe "rota de escrita sem teste"
(`D-QA-ROTAS-ESCRITA-SEM-TESTE`), e a limpeza do catálogo de sistemas (spec 062). Não se trocam
slugs fora da §2.2.

## 6. Aceite

Cada item só fecha com o comando rodado.

- Identidade: `GET /mestre/patorico027` → 301 para o slug novo; sitemap sem o slug antigo;
  `SELECT` de card, OG e lista da mesa do Victor → `VOID`; o `COUNT` da §2.2 devolve 0 para
  `nickname` igual ao prefixo com `display_name` diferente; teste cruzado da R21 verde;
  `activity_log` com a linha de nome depois de um `PUT` de teste em beta, e a recusa de 1 caractere
  com `*_rejected`.
- Vagas: `GET /api/v1/gm/perfis/mestre-hermes` devolve `slots_open`; a soma da página é igual à da home.
- Contatos: `table_contacts` sem cauda de Markdown (regex `~ '[)\]_*>]+$'` em URL → 0); `form`
  duplicado de Discord → 0.
- Prevenção: um erro forçado em beta cria 1 linha em `client_errors` e 1 aviso ao admin; um canal
  desconhecido em `MestreContactMethods` renderiza com fallback, sem derrubar a página.
- Reports: `SELECT count(*) FROM dev_feedback WHERE status='new'` → 0 e os 7 com nota; o autor de
  um report fechado em beta recebe a notificação.
- `redfallen`: `gm_profiles.updated_at` novo depois de ele confirmar. Se ele não responder, a task
  fica aberta com esse bloqueio nomeado.
