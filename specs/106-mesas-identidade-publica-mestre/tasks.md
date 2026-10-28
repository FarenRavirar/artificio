# Tasks 106 — Identidade pública do mestre

Evidência: `spec.md` §2. Decisões e autorizações: `spec.md` §3. Desenho: `plan.md`. Cada task tem
**um** bloco de estado; ao retomar, o bloco é reescrito, nunca recebe anexo.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` fechada com o comando do aceite rodado ·
**(decisão)** só o mantenedor · **(aut.)** ação de §Autorização, nominal e a cada vez.

Ordem de execução proposta: `plan.md` §14. Cada fase fecha antes da seguinte só quando o aceite
roda; o mantenedor pode reordenar (D15). Commit só com a palavra `commite`.

---

## Manutenção do mapa

### [ ] T-MAP — Atualizar `specs/backlog.md` e `project-state.md`

Regra de `specs/README.md`. Só executa quando o mantenedor mandar.

---

## F0 — Medir o que a spec ainda não mediu

### [x] T0.1 — Fechar os não medidos de `spec.md` §2.10 que mudam o desenho

1. **Porta do Victor: `POST /gm/profile`.** `docker logs mesas-api --since 2026-10-25T11:53:30Z
   --until 2026-10-25T11:55:30Z` → `POST /api/v1/gm/profile` às 11:54:26.932Z; `gm_profiles.created_at`
   11:54:26.945Z (13 ms depois); `discord_connected = f` e `created_at = updated_at` (não foi
   `connectDiscord`, que atualizaria). `users.username = 'void'` e `display_name = 'VOID'` já
   existiam, e o nickname gravado foi o prefixo do e-mail (`patorico027`): a derivação do front.
2. **Feito:** `gmPanel.ts:293` chama `prepareNewGmProfileIdentity(userId, { nickname })`.
3. **Job: `mesas-cron` roda `npm run og:cron` → `dist/scripts/cronRunner.js`** (`docker inspect
   mesas-cron`). Cada rotina é um script npm chamado por `setInterval` em
   `scripts/cronRunner.ts`; a retenção (`client-errors:purge`) e os alertas (`ops:alerts`) seguem o mesmo molde.
4. **`slots_filled` só é escrito pelo editor da mesa** (`tableValidators.ts`, `gmPanel.ts`); nenhum
   job o recalcula. Superado pela D24: a vaga é `slots_open`, e `slots_filled` sai do modelo (T8.2).
5. **`react-router` 7.18.3; `onError` do `HydratedRouter` é `ClientOnErrorFunction`**
   (`dom-export.d.ts:93`), recebe `(error, { location, params, pattern, errorInfo })`; usado em
   `entry.client.tsx:39`.
6. **`users.username` só tem um escritor HTTP:** `PATCH /profile/me` (`profile.ts:73` →
   `updateUser`, único chamador). `middleware/auth.ts:116` cria o usuário sem `username`. A
   hidratação do beta copia a coluna da produção. O valor vem do que a pessoa digitou
   (`[a-z0-9_]{3,}`), nunca do e-mail.

Aceite: cada item com o comando e a saída em uma linha, neste bloco.

---

## F1 — Regra de nascimento (R1, R2, R21)

### [ ] T1.1 — `prepareNewGmProfileIdentity` sem e-mail; `POST /gm/profile` deriva; front não deriva

Plan §2. Arquivos: `profileService.ts`, `gmPanel.ts:226-232` e `:295`, `useProfileQuery.ts`
(remover `deriveGmNickname` e a derivação de slug), `profileServiceNickname.test.ts`,
`gmPanel` testes. Testes: ordem `patch → display_name → username → user-<8 hex>`; teste que
falha se `email` for lido; contrato das 3 portas. A9: reintroduzir `split('@')` quebra ≥ 1 teste.
Aceite: `rtk rg "split\('@'\)" apps/mesas` → 0 fora de testes e de `actorNameResolver`/
`devFeedbackAdmin` (que só exibem); `pnpm --filter @artificio/mesas test` dirigido verde;
`pnpm verify:api`.

Estado: faltam o teste de contrato da porta `updateGmProfile` (só `POST /gm/profile` tem teste de
rota; para o `updateGmProfile` há `profileServiceNickname.test.ts`, que lê o código-fonte e não
executa a rota) e a conferência em beta. A A9 foi medida: `email.split('@')` reintroduzido → 1 teste
falha; restaurado → 15 passam. Sobram duas portas de criação, `POST /gm/profile` e `updateGmProfile`.

---

## F2 — Redirecionamento de slug (R3)

### [x] T2.1 — Migration `gm_slug_redirects` **(aut.: aplicar em produção)**

Medido em beta e em produção: `migration_168_spec106_slug_redirects_client_errors.sql` é a última de
`schema_migrations`; `to_regclass('gm_slug_redirects')` e `to_regclass('client_errors')` não nulos;
`dev_feedback.stale_alerted_at` existe. É a única migration da spec; a próxima é a da T8.9.

### [x] T2.2 — `GET /gm/perfis/:slug` com `redirect_to`; `loader` com 301

Medido em produção (`curl`): `/mestre/patorico027`, `/mestre/academiahardya`,
`/mestre/dadoviciadopodcast` e `/mestre/endyrpg13` → 301 para o slug novo; slug inexistente → 404;
slug atual (`void`) → 200; a API devolve `redirect_to`. Encadeado (A→B→C responde A→C) só por teste
unitário (`gmSlug.test.ts`).

### [x] T2.3 — `renameGmSlug` (transação, unicidade, `activity_log`)

`gmSlug.test.ts` (12 testes verdes): colisão contra `gm_profiles` e `gm_slug_redirects`, formato,
reversão. `renameGmSlug(input, outer?)` aceita transação externa: o script da T6 grava slug,
redirect, nickname e auditoria numa transação só.

---

## F3 — Um nome em todas as superfícies (R4)

### [~] T3.1 — `gmDisplayNameSql` nas 6 consultas

Plan §4. Aceite: para as 6 mesas com sobrescrita divergente (spec §2.5), card, OG, busca, lista e
página devolvem o mesmo nome; o `SELECT` da §2.5 remedido.

Estado: `utils/gmDisplayName.ts` aplicado em `tables.ts` (lista, busca, detalhe), `og.ts` (perfil e
mesa) e `gm.ts` (perfil). A página do mestre ganhou `t.master_display_name` no payload e
`useMestre.ts` o prefere ao nome do perfil. Medido em produção (`SELECT` read-only, 2026-10-27):
as 6 mesas com sobrescrita divergente devolvem o nome da sobrescrita na expressão nova.
Revisados os outros usos de `display_name` da §2.5: autor de avaliação (`gm.ts:689`), `AuthContext`,
`actorNameResolver` e `activityLog` são identidade de pessoa/ator, não nome de mestre; ficam. Única
superfície pública achada: "encerrada pelo mestre X" (`tables.ts:874`, resposta 410), que usava
`display_name`/`username`; passou a preferir `gm.nickname`. Medido em
produção (2026-10-27): das 6 mesas, 5 respondem 410 (encerradas) e deixaram de ser verificáveis; na do Nido
(`o-sequestro-de-bess-mulil1xa`) detalhe, lista e busca devolvem `Nido` (a sobrescrita), enquanto o perfil
é `Mestre Nido`. A descrição OG dessa mesa não cita o nome do mestre, então o aceite de OG não foi
conferido. As mesas do `dadoviciadopodcast` e do `endyrpg13` mantêm a sobrescrita própria (decisão dele:
manter o que o mestre colocou).

---

## F4 — Auditoria (R8)

### [x] T4.1 — Ações novas em `activity_log` nas portas de nome e slug

Medido em beta com a sessão de admin: `PUT /me/preferences` com `display_name` de 1 caractere → 400 e
`profile.display_name_rejected` com `reason: length` e `door: PUT /me/preferences`; `PATCH
/profile/me/profile` com nome válido grava `profile.display_name_changed` com de/para, e a reversão
grava a segunda linha. Em produção, o script da T6 gravou 4 `gm.slug_changed` e 4
`gm.nickname_changed`.

---

## F5 — UI e onboarding (R5, R6, R7, R16)

### [~] T5.1 — Campo "Nome público do mestre" na aba Mestre (D5 decidida: sim)

Estado: `NicknameField` em `GmProfileFields.tsx`, montado em `ProfileEditPage.tsx` (parte "Quem"),
no padrão linha + modal dos vizinhos (Salvar explícito, 2–40 validado antes de enviar). Desvio do
plan §5: o plan dizia "salvamento ao sair"; o campo segue o primitivo dos vizinhos (modal), que
já descarta sem gravar. Medido em beta: a aba Mestre mostra "Nome público do mestre"; o modal e a validação 2 a 40 só têm teste
unitário. Falta a validação visual.

### [~] T5.2 — Aba Geral: gravar ao sair do campo, validar antes, sem tecla descartada

Estado: `CommitTextField` + `utils/profileFieldRules.ts` (espelho das regras do servidor);
`ProfileContext.tsx` ganhou fila: `updateUser`/`updateProfile` esperam a escrita anterior em vez de
descartá-la, e devolvem a mensagem de erro, que o campo mostra (antes só um tooltip do indicador
de autosave sabia que o username estava em uso). Fila, erro devolvido e campo têm teste; a fila
foi provada removendo-a (1 teste falha). `PATCH /profile/me/profile` não validava `display_name`
(gravava vazio); passou a recusar < 2 caracteres (`profile.displayName.test.ts`). Falta beta.

### [~] T5.3 — Rótulos, onboarding e aviso do `/painel` sem perfil

Estado: rótulos da aba Geral trocados, texto sob o campo do onboarding, entrada em
`changelogs.json`, aviso de perfil pendente com teste. Medido: o `/painel` não oferece banner
(`rg banner PainelMestrePage.tsx` só acha tipo e comentário); quem oferece é a aba Mestre de
`/perfil` com `profile.gm` nulo, e o aviso foi para lá. Revisão de copy e auditoria feitas por
leitura do código contra os critérios WCAG 3.3.1, 3.3.2, 4.1.3 e as heurísticas H1 e H9, não pelo
roteiro completo das skills `wcag-accessibility-audit` e `nielsen-heuristics-audit`; contraste
não medido. Medido em beta: a aba Geral de `/perfil` mostra os rótulos novos. Falta o aviso de perfil pendente (exige
usuário sem perfil de mestre) e a validação com a janela anônima do mantenedor.

---

## F6 — Dado em produção (R9)

### [x] T6.1 — Nickname e slug do Victor e do Albert **(aut.)**

Aplicado em produção por `npm run gm-identity:fix` (`fixGmIdentity.ts`, lista fechada por id). Sem
argumento só imprime; grava com `--apply --actor=<id do admin>`. O ensaio em beta não prova nada: beta
não tem esses mestres (medido: 13 mestres, nenhum com nome do e-mail). `pg_dump` de `gm_profiles`,
`profiles` e `gm_slug_redirects` antes; uma transação por mestre (slug, redirect, nickname, auditoria) com
releitura `FOR UPDATE`, que recusa o alvo se o dono já trocou o nome.

Medido depois: `patorico027` → `void`/`VOID` e `academiahardya` → `albert`/`Albert`, com 301 nos dois;
`/sitemap.xml?cb=…` lista os novos e nenhum dos antigos; `activity_log` com 4 `gm.slug_changed` e 4
`gm.nickname_changed`.

### [x] T6.2 — `dadoviciadopodcast` → `Dado Viciado` e `endyrpg13` → `Endy` (D8) **(aut.)**

Mesma execução da T6.1. Slugs derivados por `slugifyGmName` e impressos no dry-run antes de gravar:
`dado-viciado` e `endy`. `/mestre/dadoviciadopodcast` → 301 para `/mestre/dado-viciado`. As mesas deles têm
`master_display_name` próprio (`Jeferson Stankowski [DADO VICIADO]`, `EndyRPG`). Decisão dele: manter o que
o mestre colocou, então só o título da página do mestre mudou.

---

## F8 — Reports abertos e prevenção (R10 a R22)

Cada bloco foi reescrito após a segunda rodada de investigação (2026-10-27); o diagnóstico da
primeira rodada mudou em cinco deles (`spec.md` §2.8).

### [ ] T8.1 — `redfallen`: aviso e confirmação (R10)

Correção `2e38fd1` em produção. O aviso ao autor saiu: `fa0efabf…` foi fechado como `resolved` pelo
`PATCH` com a sessão do mantenedor, e `mesas_notification_outbox` tem 1 `mesas.system.notice` entregue.
Falta ele confirmar que volta a gravar (`gm_profiles.updated_at` era 2026-09-14). **Não fechar sem o
`updated_at` novo ou sem nomear o bloqueio "usuário não respondeu".** Reprodução como ele exige a sessão
dele: pedir antes.

### [x] T8.2 — Vagas: dois números só, `slots_total` e `slots_open` (R11, R15, D11, D24)

Decisão dele (2026-10-27, D24): "tem um total de vagas e vagas que dá para entrar; vagas totais é o
que manda; não existe vagas preenchidas". Modelo: `slots_total` (teto) e `slots_open` (vagas para
entrar, de 0 até o total); sem `slots_open`, vale `slots_total`. `slots_filled` e `slots_available`
não existem como conceito. Plan §10.

Medido em produção (2026-10-27, `tables`, 230 linhas): `slots_filled = 0` em 190; `slots_open <>
total - filled` em 70; `slots_open > slots_total` em 0. Por isso o fallback `total - filled` do D11
original caiu.

Decisões de execução, o porquê que o código não mostra: a coluna `slots_filled` continua no banco com
`DEFAULT 0` até a T8.9 (o deploy aplica migration antes do build, e o app antigo ainda a seleciona);
o schema aceita e ignora `slots_filled` vindo de aba aberta antes do deploy (`strict`); o `PUT` que
envia `slots_total` e o `UPDATE` de `syncDraftToTable` gravam `slots_filled = 0`, porque o CHECK
`slots_filled_valid` (filled <= total) barraria reduzir o total de mesa antiga; `tableRepository`
tira `slots_filled` da leitura (o `selectAll` devolveria valor velho); o cartão diz "N de Y vagas
abertas", não "preenchidas".

Aceite medido: `/gm/perfis/*` e `/tables` não têm `slots_filled` e devolvem `slots_total` e `slots_open`
(beta e produção). Soma da página igual à da home em produção (`mestre-hermes`: 5 mesas, 15 vagas abertas
nos dois) e em beta (`mestre-pollux`: 5 e 5). A home de beta tem 20 cartões "N de Y vagas abertas" e
nenhum "preenchid" (Playwright sem sessão); o cartão de produção não foi visto no navegador. O
`DROP COLUMN` é a T8.9.

### [x] T8.3 — Contatos: cauda de Markdown e duplicados de Discord (R12, R20)

Plan §12. Aplicado em produção: `pg_dump` de `table_contacts`, depois uma transação com 2 `UPDATE`
(`uma-nova-fabula-se-inicia-ms21l0mk` → `https://forms.gle/mVvUiUTq7Z5yJTWT9`,
`techno-jogos-do-anfitriao-mrrxgq10` → `https://forms.gle/b3uwFZeGNLQViQ1U7`) e 3 `DELETE` por id de
`form` igual ao `discord` da mesma mesa (`uwill`, `.zero9899`, `kauarang`). Medido depois: a regex
`MARKDOWN_URL_TAIL_SQL` de `utils/contactUrls.ts` em `form`/`facebook`/`instagram` → 0 (eram 2); `form`
duplicado de Discord → 0.

Decisões de execução: `canonicalizeHttpsUrl` só limpa cauda inequívoca (`)`, `]` ou ênfase repetida
`**`, `__`, `~~`); `_`, `*`, `~` isolados são válidos no caminho e ficam (medido: `instagram.com/mestre_`
virava `…/mestre` com a limpeza incondicional). A varredura (`ops:alerts`, cron diário) usa a mesma
regra em SQL mais `>`, dedupe de 24 h por `activity_log` (`contact.tail_detected`) e
`notifyAdmins('contact_tail')`; varre só `table_contacts`, não `gm_profiles.contact_methods`. O
primeiro `ops:alerts` em produção acusou `contatos com cauda: 2`, antes do dado ser limpo.

### [x] T8.4 — Fila de feedback: status dos 14 e aviso ao autor (R13, D13, D19, D20)

Aplicado em produção (`dev_feedback`; `pg_dump` antes): 13 relatos por `UPDATE` numa transação
(`reviewed_by` = único `admin`, `reviewed_at` e `updated_at` = `now()`, `admin_notes` internas) e
`fa0efabf…` (`redfallen`) pelo `PATCH` com a sessão dele, para o autor receber o aviso. Resultado
medido: `status='new'` → 0; 11 `resolved`, 2 `duplicate` (`0d7992ef…` → `fa0efabf…`, `ea186f5f…` →
`7bf0ffcf…`) e 4 `triaged` (`57a70eca…` T5.3, `1f4c0f2d…` T8.6, `1e0c54c0…` T8.5, `7b375d1d…` T8.6).
Rollback: `status='new'`, `admin_notes=NULL`, `reviewed_at=NULL`, `reviewed_by=NULL`, `merged_into=NULL`.

Desvio da tabela original: `1ea146a7…` (formulário), `7bf0ffcf…` (vagas) e `6812bb3b…` (`void`) foram
para `resolved`, porque T8.3, T8.2 e T6.1 já estavam aplicadas em produção; as notas dizem isso.

Código: aviso ao autor no `PATCH` (plan §11.2) e alerta de fila parada (plan §11.3); D13 decidida: só
in-app. Medido em beta: `PATCH` `resolved` no único `new` → 1 `mesas.system.notice` entregue; o 2º `PATCH`
com o mesmo status não duplica; `ops:alerts` 1ª rodada `relatos parados: 1`, 2ª `0`. Em produção o cron
novo avisou os 12 relatos antigos de uma vez no boot (aceito pelo mantenedor). Não medido: a caixa de
notificações do `accounts` do autor, só o outbox do `mesas`.

### [ ] T8.5 — Dungeon World, Monster of the Week, Urban Shadows no catálogo (R14, D9) **(aut.)**

Plan §16. Catálogo central: `POST /api/admin/v1/catalog/nodes` ou a tela de catálogo do `/gestao`;
nunca SQL em `systems` do `mesas`, nunca o `CATALOG_INTERNAL_TOKEN` por conta própria. O agente
prepara os 3 payloads (slug, nome, `name_pt`, aliases, `official_website_url` conferido na fonte) e
o mantenedor cria ou autoriza. Preparados e enviados a ele (`node_type: system`, `status: active`, `name_pt`
nulo como `Monsterhearts`; `curl` 200 em cada URL): `dungeon-world` (`https://www.dungeon-world.com/`,
alias `DW`), `monster-of-the-week` (`https://evilhat.com/product/monster-of-the-week/`, alias `MotW`) e
`urban-shadows` (`https://magpiegames.com/collections/urban-shadows`, a coleção da editora, não há página
própria do jogo). Medido em produção: `Masks` e `Monsterhearts` casam como sistemas distintos (`Masks`
com a edição `A New Generation`). Aceite: `GET /api/v1/systems?view=tree` contém os 3; `mesas` os
oferece no seletor de sistema; `Masks` e `Monsterhearts` conferidos contra o que casou.

### [ ] T8.6 — `/painel` como `player` e o 500 de 27/08

Percorrer em beta o caminho de quem não tem perfil (spec 096) e reproduzir `POST
/profile/systems` logo após a criação do perfil pelo editor (hipótese E1, não testada). Os logs
de agosto não existem: a prova tem que ser nova. Sem reprodução, a causa permanece "não medida"
e a task fecha com esse nome, não como resolvida.

### [~] T8.7 — Telemetria de erro de cliente e contenção (R17, R18, R19, R20, D16, D17)

Plan §9 e §13. Tabela `client_errors`, na `migration_168` **(aut.: aplicar)**. Itens:
1. `reportClientError()` + `HydratedRouter onError` + `ErrorBoundary.componentDidCatch`.
2. `POST /api/v1/client-errors` (bucket próprio `clientErrorRateLimiter`, 30 por 15 min por IP; corpo de
   64 KB; limites de tamanho; sem IP/header/query).
3. Upsert por `fingerprint`, aviso ao admin na 1ª ocorrência, retenção de 90 dias, e os tetos
   contra abuso do plan §9 (fingerprints novos/h, avisos/h, linhas).  Teste: 1000 mensagens
   distintas em sequência criam no máximo o teto de linhas e de avisos.
4. Painel read-only em `/gestao`.
5. `ErrorBoundary` por seção; fallback em `MestreContactMethods`; teste de paridade
   `CONTACT_CHANNEL_META` × `CONTACT_CHANNELS`; varredura de outros mapas por string externa.
Aceite: erro forçado em beta → 1 linha em `client_errors` + 1 aviso; 2ª ocorrência incrementa sem
novo aviso; canal desconhecido renderiza com fallback; `pnpm verify:api`.

Medido em beta: 2 `POST /client-errors` → 204; 1 linha com `occurrences = 2`; `path` sem a query; 1 aviso
ao admin (outbox entregue); a linha de teste foi removida. `GET /admin/client-errors` → 200 com sessão;
`client_errors` em produção = 0. Falta: o fallback de canal desconhecido e o `ErrorBoundary` por seção só
têm teste unitário, não foram forçados no navegador.

### [~] T8.8 — Testes cruzados (R21)

Vagas (perfil × home × WhatsApp × resposta do editor) e identidade (`nickname`/`slug` ≠ prefixo do
e-mail). Entram nas fases F1 e T8.2; esta task confere que ambos existem e falham sem a correção.

Estado: vagas em `whatsappAnnouncement.test.ts` (soma do mestre × texto do WhatsApp); identidade em
`profileServiceNickname.test.ts` (o e-mail nem é argumento de `deriveGmNickname`; a A9 quebra se
`email` voltar). Não cobre a "resposta do editor" nem a home (cartão) por teste de componente. A
falha sem a correção foi medida só para a soma do mestre (revertendo `sumOpenSlots`); a de identidade
não foi remedida depois da mudança de vagas.

### [ ] T8.9 — Migration destrutiva: `DROP COLUMN tables.slots_filled` **(decisão e aut.)**

Decisão dele em 2026-10-27: a migration destrutiva fica **para depois de tudo testado em
produção**. Não entra na PR de T8.2 (plan §10: o deploy aplica migrations antes do build, e o app
antigo ainda seleciona `slots_filled`).

Só começa quando: (1) o código da T8.2 está em produção; (2) o aceite da T8.2 rodou em produção; (3)
as demais tasks desta spec que tocam `tables` passaram no mesmo ambiente. Aí, uma PR própria com a
próxima `migration_NNN` (conferir `ls apps/mesas/database | grep migration_1`; a última é a 168,
aplicada em prod e beta; a T8.2 já roda em produção e o aceite dela passou): `DROP COLUMN IF EXISTS slots_filled` e os
CHECKs `slots_filled_valid` e `check_slots_valid` (este último é recriado sem `slots_filled`, mantendo
`slots_open >= 0 AND slots_open <= slots_total`), `DROP INDEX IF EXISTS idx_tables_slots`. Header de
5 campos e idempotência (`deploy-flow.md` §3), `pg_dump` antes, aprovação nominal.

Remover junto, do código: `slots_filled` em `db/types.ts` e `hydration/config.ts`, e as escritas
`slots_filled: 0` do `gmPanel.ts` (PUT com `slots_total`) e do UPDATE de `syncDraftToTable`
(`syncHelpers.ts`), e o campo legado `slots_filled` do schema de `tableValidators.ts`. Aceite: `information_schema.columns` sem
`slots_filled`; `rtk rg "slots_filled" apps packages --glob '!**/database/**'` → 0.

---

## F9 — Política de Privacidade completa (R22, D14, D22 decidida: sem banner)

Decisão dele: "sim e completo". Plan §15. `apps/site` é outro app: **ampliação de escopo explícita**
antes de editar.

### [ ] T9.1 — Remedir o inventário de dados (`spec.md` §2.11) e fechar o que ficou sem medição

Prazo da anonimização das métricas (`anonymizeMetricEvents`); hosts de fonte e script do `site`;
rota de exclusão e de exportação de conta em `accounts` e `mesas`; o que `POST /api/feedback` do `site` grava; se o Cloudflare Web Analytics está ligado; o que Cloudinary e Discord
recebem de fato. Sem medição, o texto diz "não medido" para o item, não afirma.

### [ ] T9.2 — Escrever e publicar `/privacidade/` no `site`

Estrutura e regras de redação do plan §15 (coleta permanente, finalidade como medida, cada cookie e ID de medição listados, sem banner). Rodapé de todos os apps com link. Texto sai de doc, em prosa normal.
Revisão jurídica: dele. Aceite: `curl -I https://artificiorpg.com/privacidade/` → 200; link no
rodapé de `mesas`, `glossario`, `downloads`, `links`, `site`; canonical e sitemap do `site`.

### [ ] T9.3 — Fluxo de exclusão/exportação ou texto honesto

Se não houver rota (T9.1), a política descreve o pedido por e-mail e esta task abre o fluxo.
Nenhuma promessa na política que o produto não cumpra.

### [x] T9.4 — Consentimento do GA4: **não será feito** (D22)

Decisão dele em 2026-10-27: sem banner; a política diz que a coleta é permanente e o que se
coleta. Nenhum código, nenhum componente em `packages/ui`. Fica registrada a decisão de não
fazer e o motivo dele (cookies para manutenção do site e outros fins técnicos).

---

## F7 — Fechamento

### [~] T7.1 — Deploy do `mesas`, conferes e remedição da §2

**Ordem** (plan §8; cada passo é autorização nominal): deploy de beta; conferes de beta; promote
`dev→main`; deploy de produção; conferes de produção; dado em produção (T6.1, T6.2, T8.3, T8.4);
T8.9 por último. A `migration_168` aplica antes do app. O promote só move o ponteiro Git: produção só
atualiza com o dispatch de `deploy.yml` (`deploy-flow.md` §6).

**Conferes feitos (medidos):**
- Migration: ver T2.1, em beta e produção.
- Cron: em produção, `mesas-cron` rodou `[client-errors:purge] 0 erros removidos` e `[ops:alerts] relatos
  parados: 12` / `contatos com cauda: 2` no boot. **Beta não tem container de cron** (só o `mesas-cron` de
  produção): lá o confere é `docker exec mesas-beta-api npm run ops:alerts` (escreve).
- T8.2, T8.4, T8.7, T10.1: ver os blocos. `mestre-hermes` só existe em produção; em beta usar um slug de
  `gm_profiles` (`mestre-pollux`).
- T2.2, T4.1, T6.x, T8.3: aceites medidos, ver os blocos.

**Remedição da §2:** `COUNT` da §2.2 em beta → 13 mestres, 0 com nickname ou slug igual ao prefixo do
e-mail; em produção os 4 casos foram corrigidos pela T6; `dev_feedback` sem `new` (T8.4);
`client_errors` em produção = 0 (nada reportado). Falta decidir o que vai para
`.specify/memory/errors.md` (protocolo: forma que não funciona, medição que contradiz a spec).
Candidatos medidos: o ensaio em beta da T6 não vale (beta não tem os mestres); o confere de cron em beta
não existe; das 6 mesas da §2.5, 5 estão encerradas.

---

## F10 — Resíduo de autenticação Discord

### [x] T10.1 — Remover o vínculo Discord sem uso (D23)

Decisão dele em 2026-10-27: era uma autenticação Discord antiga, para algumas finalidades; o
resíduo sai. Hoje o Discord no produto é só importação de mesas (JSON) e canal de contato.

Medido antes de apagar (produção, read-only, `mesas-db`): `gm_profiles` 66 linhas, com
`discord_connected`, `discord_username` e `discord_id` preenchidos em 0; `auth_providers` só
`google|1`, 0 `discord`. A rota `POST /profile/me/connect/discord` gravava `discord_connected = true`
com `username` e `id` do corpo, sem OAuth; o front não a chamava. A coluna e o `DROP COLUMN` ficam
fora até ele mandar. Outros leitores das colunas, deixados: resposta pública do mestre (`gm.ts`,
sempre `false`/`null`), `hydration/config.ts`, `adminEnrichment.ts` e tipos do front; saem com o
`DROP COLUMN`.

Medido: `GET /api/v1/profile/me/discord` e `/profile/me/connect/discord` → 404 em beta com sessão (`me/options`
→ 200) e em produção sem sessão (`me/options` → 401, então a rota não existe); `rtk rg
"connectDiscord|disconnectDiscord" apps/mesas` só em comentário (`ProfileEditPage.tsx` e um teste).
`pnpm verify:api` aponta `breaking=2`, as duas rotas removidas, esperado.
