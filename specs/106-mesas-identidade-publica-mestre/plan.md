# Plan 106 — Identidade pública do mestre

Evidência e requisitos: `spec.md`. Este arquivo diz **como**. As decisões técnicas são do agente e
podem ser revertidas pelo mantenedor (`spec.md` §3.3). As dele estão em `spec.md` §3.1.

Leitura obrigatória antes de tocar: `docs/agents/deploy-flow.md` §3 (migration) e §6 (workflows),
`docs/agents/deploy-runbook.md`, `.specify/memory/errors.md`. Commit que toca `apps/`, `packages/`
ou `scripts/api/`: `pnpm verify:api` antes do `git add`. Validação repo-wide só no fim e um comando
por vez (`lint`, `test`, `build` em paralelo travam a máquina).

---

## 1. Princípio

Uma regra, num lugar só. Hoje o mesmo contrato de identidade existe em `profileService.ts:70`,
`useProfileQuery.ts:348` e, para o nome exibido, em seis consultas SQL; a conta de vagas existe em
cinco lugares. A spec 099 E1 já mediu o custo de duas cópias (7 perfis nasceram fora do contrato).
Aqui a cópia do front é **apagada**, não sincronizada. Toda regra nova nasce com o teste que a
cruza com os outros pontos de uso.

## 2. Regra de nascimento (R1, R2) — `apps/mesas/backend`

`prepareNewGmProfileIdentity` (`profileService.ts:97`) passa a ler `profiles.display_name` e
devolve `{ slug, nickname }` sem nunca usar `email`. O nome da conta Google **não está no banco do
`mesas`** (`UsersTable` em `db/types.ts:13` não tem `name`; ele vem do `accounts.` como `user.name`
no front). Por isso o front, quando tiver `user.name`, o manda como patch de `nickname` (o editor já
faz isso em `useTableEditor.ts:1043`), e o backend não depende dele:

- `nickname`: patch válido → `profiles.display_name` → `users.username` → `user-<8 hex do id>`.
  Corte em 40, piso de 2 (contrato de `gmPanel.ts:230`).
- `slug`: `slugify(nickname)`, sufixo numérico em colisão (a mecânica do editor,
  `useTableEditor.ts:1050`, que já trata 409). Fallback `user-<8 hex do id>`.

As **3 portas** do `spec.md` §2.4 passam pela função:

1. `profileService.ts:367` e `:528` já passam.
2. `gmPanel.ts:295` (`POST /gm/profile`) deixa de exigir `slug`/`nickname` (`:226-232`): se vierem,
   valem como patch; se faltarem, deriva. O contrato de resposta não muda (medir no teste).
3. O front deixa de derivar: remover `deriveGmNickname` e a derivação de slug de
   `useProfileQuery.ts:203-230` e `:337-360`; o editor de mesa (`useTableEditor.ts:1043-1050`)
   continua mandando o nome digitado como patch.

Testes: reescrever `profileServiceNickname.test.ts` para a nova ordem; teste que falha se o texto
`email` aparecer na função; teste de contrato das 3 portas (cada uma cria perfil sem e-mail no
nome). A9: reintroduzir o `split('@')` deve fazer ≥ 1 teste falhar.

## 3. Redirecionamento de slug (R3)

Migration `migration_168_gm_slug_redirects.sql` (a última é a 167; conferir antes). Cabeçalho de 5
campos conforme `deploy-flow.md` §3, `@class: online-safe`, idempotente:

```sql
CREATE TABLE IF NOT EXISTS gm_slug_redirects (
  old_slug   text PRIMARY KEY,
  gm_id      uuid NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gm_slug_redirects_gm ON gm_slug_redirects (gm_id);
```

Guarda `gm_id`, não o slug novo: o destino é sempre o slug atual e não existem cadeias.
`old_slug` precisa ser `UNIQUE` contra `gm_profiles.slug` (trigger não; checar na função de troca).

`GET /gm/perfis/:slug` (`gm.ts:119`): em miss, procura em `gm_slug_redirects` e devolve **200**
`{ data: null, redirect_to: '<slug atual>' }`. O `loader` de `routes/mestre.tsx` responde
`redirect('/mestre/<novo>', 301)`. Motivo do 200: o `fetch` do SSR segue 301 sozinho e o loader
perderia a informação. Os endpoints `/perfis/:slug/view` e `/insights` seguem 404 em slug antigo.

Troca de slug é uma função de serviço `renameGmSlug(gmId, novoSlug, actor)`: transação, valida
formato `/^[a-z0-9-]+$/` e unicidade (contra `gm_profiles` **e** `gm_slug_redirects`), insere o
redirect, atualiza o `slug`, grava `activity_log`. Sem endpoint público; uso: script de correção
do dado (T6.1). Sitemap (`sitemap.ts:42`) lê o slug atual e se atualiza sozinho.
Os pontos que montam `/mestre/${slug}` (spec §2.3) usam o slug da API e passam a apontar para o
novo sem edição. Links externos antigos dependem do 301.

Testes: slug antigo → 301 para o atual; slug inexistente → 404; slug atual → 200; A→B→C responde
301 direto para C; colisão recusada; sitemap lista só o atual.

## 4. Um nome em todas as superfícies (R4, D6)

Fragmento SQL único `gmDisplayNameSql(alias)` em `apps/mesas/backend/src/utils/` aplicado em
`tables.ts:247`, `:311` (busca), `:1000`, `og.ts:168`, `og.ts:242`, `gm.ts:145`. Para mesa:
`COALESCE(NULLIF(btrim(t.master_display_name),''), gm.nickname, p.display_name, gm.slug)`; para
perfil: `COALESCE(gm.nickname, p.display_name, gm.slug)`. `gm_display_name` passa a vir resolvido;
`tableViewMapper.ts:275` e `whatsappAnnouncement.ts:438` mantêm o fallback (redundante, inofensivo).
`useMestre.ts:279` e `profilePreviewMapping.ts:100` (prévia) seguem a mesma cadeia — medir antes.
Teste: para as 6 mesas com sobrescrita divergente, card, OG, busca, lista e página devolvem o
mesmo nome.

## 5. UI (R5, R6, R7, R16)

- **"Nome público do mestre"** na aba Mestre, seção "Quem" (`GmProfileFields.tsx`), no primitivo de
  campo dos vizinhos. Grava `nickname` por `updateGm` (debounce em buffer, já existe). Contador
  2–40, texto "É o nome que jogadores veem na sua página e nos cards".
- **Aba Geral:** `Nome de Exibição` e `Username` gravam em `onBlur` e `Enter`, validam antes de
  enviar com as regras do servidor e mostram o erro no campo. `ProfileContext.tsx:168/177` deixa
  de descartar; a última escrita vence (fila de uma posição).
- **Rótulos:** "Seu nome na comunidade (conta)" e "Username (endereço do perfil de jogador)". Texto
  final com a skill `design:ux-copy`; auditoria com `nielsen-heuristics-audit` e
  `wcag-accessibility-audit`.
- **Onboarding** (`OnboardingPage.tsx:262`): linha sob o campo dizendo onde o nome aparece e que o
  mestre pode ter outro nome público depois, na aba Mestre.
- **`/painel` sem perfil** (R16): onde a edição de banner aparece para `GET /gm/me` → 404, trocar
  por um aviso "o perfil nasce quando você criar a primeira mesa" com link para o editor.
- `database/changelogs.json` antes do deploy (mudança visível a mestres).

## 6. Auditoria (R8)

Ações novas em `activityLogger.ts` (`ActivityAction`, hoje só `user.registered`/`user.role_changed`
para usuário): `profile.display_name_changed`, `gm.nickname_changed`, `user.username_changed`,
`gm.slug_changed`, e `*_rejected` para cada uma; `ActivityEntityType` ganha `gm_profile` (e
`client_error`, §9). `activity_log.action` é `text` sem CHECK (medido), então não precisa de
migration. Metadado: `{ from, to, door }` e, na recusa, `{ attempted, reason }`. Rotas (nomes
medidos): `PUT /me/preferences` (`me.ts:107`, onboarding, grava `display_name`), `PATCH
/profile/me` (`profile.ts:39`, `username`/`location`), `PATCH /profile/me/profile`
(`profile.ts:81`, `display_name`), `PATCH /profile/me/gm` e `/gm` (`profile.ts:209/211`), `PUT` e
`POST /gm/profile` (`gmPanel.ts`), as 2 portas de `profileService`, e `renameGmSlug`. `logActivity` engole erro por
desenho (`activityLogger.ts:55`); não envolver em transação de mérito.

## 7. Dado (R9)

Script `UPDATE` em transação com `SELECT` antes e depois, `pg_dump` de `gm_profiles` e `profiles`.
Lista fechada por id:

- `nickname` ← `display_name`: Victor (`VOID`) e Albert (`Albert`) — D1, D2.
- Slug: Victor → `void`, Albert → `albert`, via `renameGmSlug` (com redirect). Colisão → sufixo.
- `dadoviciadopodcast` e `endyrpg13`: só depois de D8.

`renameGmSlug` roda como script no padrão de `apps/mesas/backend/src/scripts/` (há
`backfillNotificationOutbox.ts`), executado com `docker exec` no `mesas-api`, primeiro com
`--dry-run` (imprime o que mudaria e não grava). Ensaiar em beta com cópia de dados. É escrita em
produção: autorização nominal (`spec.md` §3.4).

## 8. Entrega

Branch de `dev`, PR para `dev`, beta antes de produção, migration conforme `deploy-flow.md` §3
com o backup exigido. Depois da PR aberta o agente para: sem polling.

**Ordem de deploy (nova):** a `migration_168_spec106_slug_redirects_client_errors.sql` é a única da
spec (cria `gm_slug_redirects`, `client_errors` e `dev_feedback.stale_alerted_at`); não existe 169.
Ela vai ANTES do app: o `PATCH` de feedback e o `ops:alerts` do `mesas-cron` leem
`stale_alerted_at`, e o cron roda `ops:alerts` no boot, então app novo sobre banco sem a 168 faz o
cron falhar. Depois: app e cron do `mesas`, beta antes de produção; por último o dado (F6).

---

## 9. Telemetria de erro de cliente (R19, D16)

**Padrão da lib:** React Router 7 (framework mode) separa contenção e relato. `ErrorBoundary` não
basta para log; o cliente passa `onError` ao `HydratedRouter` (recebe o erro, `location`, `params`,
`pattern`, `errorInfo`) e o servidor exporta `handleError` em `entry.server.tsx`. Fonte:
https://reactrouter.com/how-to/error-reporting . Conferir a assinatura na versão instalada
(`react-router --version`) e no `.d.ts` antes de escrever.

**Desenho (próprio, no banco do `mesas`):**

- Tabela na `migration_168` (a mesma dos redirects): `client_errors(id uuid, fingerprint text, first_seen timestamptz,
  last_seen timestamptz, occurrences int, user_id uuid null, route_pattern text, path text,
  message text, stack text, component_stack text, user_agent text, build text)`, `UNIQUE
  (fingerprint)`. Upsert: mesmo fingerprint incrementa `occurrences` e atualiza `last_seen`.
- `POST /api/v1/client-errors` com bucket próprio `clientErrorRateLimiter` (30 por 15 min por IP;
  o `strictRateLimiter` dividia a cota com o widget de feedback) e `optionalAuth`; corpo de
  **64 KB** (`express.json({ limit: '64kb' })` na própria rota, montada antes do parser global de
  12 MB). Limites: `message` ≤ 500, `stack` ≤ 4000, `component_stack` ≤ 4000,
  `user_agent` ≤ 200. Sem corpo de requisição, sem header, sem IP, sem query string (`path` sem `?`),
  sem cookie. `user_id` só se logado, porque é o que permite avisar quem teve o problema (o caso
  `redfallen`).
- `fingerprint` = hash de `route_pattern + message + 1ª linha do component_stack`.
- Tipos de evento do outbox: `mesas.admin.client_error`, `mesas.admin.feedback_stale` e
  `mesas.admin.contact_tail` (avisos ao admin); `mesas.system.notice` para o aviso ao autor.
- Primeira ocorrência de um fingerprint: `notifyAdmins` (já existe) e `logActivity` com
  `entityType: 'client_error'`. Reincidência não notifica; limite de 1 aviso por fingerprint por hora.
- Cliente: `reportClientError()` em `lib/` chamado por `HydratedRouter onError`
  (`entry.client.tsx`) e por `ErrorBoundary.componentDidCatch` (substitui o `TODO: Sentry` de
  `ErrorBoundary.tsx:36-40`). `navigator.sendBeacon` com fallback `fetch keepalive`; falha de envio
  é silenciosa; nunca lança. Não reporta o mesmo fingerprint mais de 1 vez por sessão.
- Retenção: apagar `last_seen < now() - 90 dias`. O `mesas-cron` roda `npm run og:cron`
  (`scripts/cronRunner.ts`), e cada rotina é um script npm em `setInterval`: `client-errors:purge`
  (retenção) e `ops:alerts` (fila parada e contato com cauda, §11.3 e §12) seguem esse molde, com
  execução no boot.
- **Contra abuso** (o endpoint é público e o `fingerprint` sai de texto do cliente): teto global de
  fingerprints novos por hora (excedente só soma num contador, sem linha nova), teto de avisos ao
  admin por hora, teto de linhas na tabela (a limpeza dos 90 dias também corta o excedente), e
  `message`/`stack` sempre renderizados como texto no painel, nunca como HTML.
- Painel: lista em `/gestao` reaproveitando o padrão de `DevFeedbackPanel.tsx` (read-only).
- Texto da Política de Privacidade (R22) cita: tipo de erro, rota, navegador, identificador da
  conta se logada, retenção de 90 dias, nenhum repasse.

**Descartado, com o que não cobre:** Sentry SaaS (leva stack e `user_id` a terceiro — o que D12
veta); GlitchTip self-hosted (4 containers, número de um fornecedor, não verificado; custo de
memória da VM não medido). Voltaria à mesa só se a tabela própria se mostrar insuficiente, e aí o
custo operacional é decisão do mantenedor.

Testes: unitário do fingerprint e do truncamento; rota recusa corpo gigante; `onError` forçado em
beta cria 1 linha e 1 aviso; segunda ocorrência incrementa sem novo aviso.

## 10. Vagas (R11, R15, D11)

Fonte única no backend: `COALESCE(t.slots_open, t.slots_total - t.slots_filled)` como
`slots_available` (nome já usado em `gmPanel.ts:725`, campo hoje sem nenhum leitor), em `gm.ts:249`
(junto com `t.slots_open`), `tables.ts` e na resposta de `GET /gm/tables/:id`. O front consome o valor: `useMestre.ts:284` soma
`slots_available`; `whatsappAnnouncement.ts:274` usa o do payload. Nada de importar o front no
back: `packages/catalog-table` só tem o front de `mesas` como consumidor (medido), então não é
tocado, a menos que `tableViewMapper.ts:194` precise do mesmo campo (blast radius = 1 consumidor).
Medir antes: quem escreve `slots_filled` hoje (spec 096 T3.2d deu escritor no fluxo manual) e se
isso muda o `COALESCE`. Teste cruzado: o mesmo `mestre-hermes` na página do mestre, na home, no
texto do WhatsApp e na resposta do editor dá o mesmo número.

## 11. Fila de feedback (R13, D13, D19, D20)

1. **Status dos 14** (T8.4): `UPDATE` com `reviewed_by` = único `admin`, `reviewed_at = now()`,
   `merged_into` nos 2 duplicados; sem passar pelo `PATCH`, logo sem aviso ao autor.
2. **Aviso ao autor:** no `PATCH` (`devFeedbackAdmin.ts:110`), quando o status muda para
   `resolved`/`wont_fix`/`duplicate` e o registro tem `user_id`, `enqueueNotification` com
   `eventType: 'mesas.system.notice'`, `body` curto ("Seu relato '<título>' foi analisado: …"),
   `canonicalPath` do `route_path` (validado por `isValidCanonicalPath`) e `recipients: [user_id]`.
   Não toca `apps/accounts` (`notificationFormatter.ts:98-101` lê o `legacy_body`). O texto
   enviado é separado de `admin_notes`. Só na **transição** de status (o `PATCH` trava a linha,
   lê o status anterior e enfileira na mesma transação); `route_path` inválido cai em `/`.
   Código: `services/devFeedbackNotices.ts`.
3. **Alerta de fila parada:** `notifyAdmins` quando um `new` completa 7 dias sem `reviewed_at`
   (`ops:alerts` no cron; 1 aviso por report). `alertStaleFeedback` marca `stale_alerted_at` num
   `UPDATE ... RETURNING` antes de avisar, então execuções simultâneas não duplicam; no máximo 20
   por execução.

## 12. Contatos (R12, R20)

- Dado: 2 `UPDATE` (cauda `)__` e `**`) e 3 `DELETE` de `form` duplicado de Discord, conforme T8.3.
- Escrita: `canonicalizeHttpsUrl` (`contactUrls.ts:54`) passa a aplicar a mesma limpeza de
  `trimTrailingUrlWrappers` (`parseDiscordAnnouncement.ts:1939`). Mover a função para
  `utils/contactUrls.ts` e importar nos dois lados: uma cópia só. Conferir no parser que a
  semântica de `(`/`)` balanceados continua igual (testes do parser rodam).
- Varredura: `services/contactTailSweep.ts` (`value ~ '[)\]_*>]+$'` em canal de URL de
  `table_contacts`) chama `notifyAdmins('contact_tail')`, com dedupe de 24 h por `activity_log`
  (`contact.tail_detected`). Roda em `ops:alerts` (§11.3). Não varre `gm_profiles.contact_methods`.

## 13. Contenção e mapas (R10, R17, R18, D17)

- `ErrorBoundary` por seção em `TabMestre`/`ProfileEditPage` e na página do mestre, com
  `fallback` que preserva o resto da página e aciona `reportClientError`.
- `MestreContactMethods.tsx:99-101`: `CONTACT_CHANNEL_META[contact.channel] ?? FALLBACK_META`, mais
  teste de paridade `CONTACT_CHANNEL_META` × `CONTACT_CHANNELS` do backend (o mesmo molde de
  `linkTypes.test.ts`).
- Varrer os outros mapas por string vinda do servidor: `rg "Record<(string|[A-Z][A-Za-z]+)," ` +
  leitura de cada `[x.type]`/`[x.channel]`; `LinksDisplay.tsx` e `LinksManager.tsx` incluídos.
- `redfallen`: não há código a mudar para ele; o item é o aviso (§11.2) e a confirmação.

## 14. Ordem proposta (D15; ele pode reordenar)

1. **F8.2 vagas** (correção pequena e visível; 2 reports; sem migration).
2. **F1 regra de nascimento** + **F3 nome único** (código, sem migration; interrompe a
   reincidência para mestres novos).
3. **F5 UI** (campo, formulário, onboarding, `/painel`).
4. **F2 redirect** + **F4 auditoria** + **F8.7 telemetria** (migration 168 única: um deploy só).
5. **F8.4 fila** (aviso ao autor; status dos 14).
6. **F8.3 contatos**.
7. **F6 dado em produção** (por último: depende de F1, F2, F4 em produção).
8. **F8.5 catálogo** e **F9 política de privacidade** quando ele decidir D9 e D14.

## 15. Política de Privacidade completa (R22, D14, D22)

Hoje `apps/site/src/pages` só tem `termos-de-uso-e-direitos-autorais.astro`, sem seção de dados. A
F9 escreve a página `/privacidade/` no `site` (rota nova `apps/site/src/pages/privacidade.astro`,
mesmo layout dos termos) e linka no rodapé de todos os apps. Conteúdo, na ordem do inventário
(`spec.md` §2.11): quem é o controlador e como contatar; quais dados, de onde vêm e para quê;
cookies (um a um, com prazo e se são necessários); GA4 e o que foi desligado; terceiros que
recebem dado; retenção (90 dias para erro técnico, prazo da anonimização das métricas, a medir);
direitos do titular (LGPD art. 18: acesso, correção, exclusão, portabilidade, revogação) e como
pedir; segurança; menores; mudanças na política com data. Sem venda nem repasse (D12).

Precisa existir antes de publicar: um caminho real para o titular pedir exclusão e exportação.
Medir se há rota de exclusão de conta em `accounts` e `mesas`; se não houver, a política não pode
prometer o que o produto não faz: descreve o pedido por e-mail e abre tarefa para o fluxo.
Revisão jurídica do texto final fica com o mantenedor.
`apps/site` é outro app: ampliação de escopo explícita antes de editar (`AGENTS.md`).

D22 (decidido: sem banner): a política informa, não pede consentimento. Regras de redação, para
o texto ser verdadeiro: (1) dizer que a coleta ocorre sempre, em todo acesso, e que não há botão
de recusa; (2) declarar a finalidade como ela é medida, "medir uso e manter o site" (GA4,
Cloudflare Web Analytics, erro técnico), sem chamar o `_ga` de "estritamente necessário", porque
isso a spec não mediu e o gtag é medição de uso; (3) listar cada cookie e cada ID de medição
(`spec.md` §2.11); (4) dizer como a pessoa pode, por conta própria, bloquear (configuração do
navegador) e como pedir exclusão dos dados da conta. Revisão jurídica do texto final fica com o
mantenedor; o guia da ANPD sobre cookies (2022) é leitura dele, não decisão do agente.

## 16. Catálogo: Dungeon World e PbtA (R14, D9)

O catálogo é **central**: `mesas` lê de `CATALOG_API_URL` (`site-prod-app:4322`) pelo
`catalogClient`; as 1269 linhas locais de `systems` são todas `catalog_source = 'beta'`. A escrita
é `POST /api/admin/v1/catalog/nodes` (`apps/site/server/catalog-api.ts:111`, atrás de
`requireAdmin`), payload `{ node_type: 'system', canonical_slug, name, name_pt, description,
official_website_url, aliases, status }` (`parseNodeWrite`, `:136`). Há também a tela de catálogo
em `/gestao`. **Não se insere em `systems` do `mesas` por SQL.** Escrita em produção: o mantenedor
cria pela tela de admin dele, ou autoriza uma chamada ao endpoint com a sessão de admin dele.
Nunca usar `CATALOG_INTERNAL_TOKEN` por conta própria.

Lista fechada (PbtA é uma família de milhares de títulos:
[StartPlaying](https://startplaying.games/blog/posts/what-is-powered-by-the-apocalypse),
[lumpley.games](https://lumpley.games/2023/11/22/what-is-pbta/)): **Dungeon World** (o pedido do
jogador), **Monster of the Week**, **Urban Shadows**. Medido no catálogo de hoje: Dungeon World 0,
Monster of the Week 0, Urban Shadows 0, The Sprawl 0, Uncharted Worlds 0; `Apocalypse World`,
`Monsterhearts` e `Masks` casam 1 cada (conferir o que casou: `Masks` por substring pode ser outro
jogo). Site oficial e editora de cada um: conferir na fonte antes de preencher
`official_website_url`; vazio é aceito.
