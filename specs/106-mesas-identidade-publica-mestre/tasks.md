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
4. **`slots_filled` só é escrito pelo editor da mesa** (`tableValidators.ts:589`, `gmPanel.ts`);
   nenhum job o recalcula. Por isso `slots_open` (controlado pelo mestre) é a vaga, e `total - filled`
   só entra sem ele (D11).
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

Estado: o `slug` derivado sai de `slugifyGmName(nickname)` com sufixo `-2`, `-3` em colisão
só contra `gm_profiles`; **quando a T2.1 criar `gm_slug_redirects`, `slugTaken` precisa checar
a tabela também** (plan §3). Falta o teste de contrato das portas `updateGmProfile` e Discord
(só o `POST` tem teste de rota). A9 medida: `email.split('@')` reintroduzido → 1 teste falha;
restaurado → 15 passam. A porta do Discord (`connectDiscord`) saiu na T10.1: sobram duas
portas, `POST /gm/profile` e `updateGmProfile`.

---

## F2 — Redirecionamento de slug (R3)

### [ ] T2.1 — Migration `gm_slug_redirects` **(aut.: aplicar em produção)**

Plan §3. Ler `deploy-flow.md` §3 e os cabeçalhos das migrations vizinhas. Número: conferir
`ls apps/mesas/database | grep migration_16` (última medida: 167). Idempotente; guard
`MAX_AUTO_PENDING` ([[E012]]) lido antes de aplicar (a 168 é a única migration da spec).

### [ ] T2.2 — `GET /gm/perfis/:slug` com `redirect_to`; `loader` com 301

Testes: slug antigo → 301; inexistente → 404; atual → 200; encadeado → 301 direto ao atual.
`pnpm verify:api` (muda contrato de rota).

### [ ] T2.3 — `renameGmSlug` (transação, unicidade, `activity_log`)

Testes de colisão contra `gm_profiles` e `gm_slug_redirects`; formato; reversão da transação.

---

## F3 — Um nome em todas as superfícies (R4)

### [ ] T3.1 — `gmDisplayNameSql` nas 6 consultas

Plan §4. Aceite: para as 6 mesas com sobrescrita divergente (spec §2.5), card, OG, busca, lista e
página devolvem o mesmo nome; o `SELECT` da §2.5 remedido.

Estado: `utils/gmDisplayName.ts` aplicado em `tables.ts` (lista, busca, detalhe), `og.ts` (perfil e
mesa) e `gm.ts` (perfil). A página do mestre ganhou `t.master_display_name` no payload e
`useMestre.ts` o prefere ao nome do perfil. Medido em produção (`SELECT` read-only, 2026-10-27):
as 6 mesas com sobrescrita divergente devolvem o nome da sobrescrita na expressão nova.
Revisados os outros usos de `display_name` da §2.5: autor de avaliação (`gm.ts:689`), `AuthContext`,
`actorNameResolver` e `activityLog` são identidade de pessoa/ator, não nome de mestre; ficam. Única
superfície pública achada: "encerrada pelo mestre X" (`tables.ts:874`, resposta 410), que usava
`display_name`/`username`; passou a preferir `gm.nickname`. Falta
conferir em beta, com HTTP real, card, OG e página de uma dessas mesas.

---

## F4 — Auditoria (R8)

### [ ] T4.1 — Ações novas em `activity_log` nas portas de nome e slug

Plan §6. Aceite: um `PUT /me/preferences` de teste em beta grava a linha; recusa (1 caractere)
grava `*_rejected` com `{ attempted, reason }`.

---

## F5 — UI e onboarding (R5, R6, R7, R16)

### [~] T5.1 — Campo "Nome público do mestre" na aba Mestre (D5 decidida: sim)

Estado: `NicknameField` em `GmProfileFields.tsx`, montado em `ProfileEditPage.tsx` (parte "Quem"),
no padrão linha + modal dos vizinhos (Salvar explícito, 2–40 validado antes de enviar). Desvio do
plan §5: o plan dizia "salvamento ao sair"; o campo segue o primitivo dos vizinhos (modal), que
já descarta sem gravar. Falta validação visual em beta.

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
não medido. Falta a validação funcional em beta com a janela anônima do mantenedor.

---

## F6 — Dado em produção (R9)

### [ ] T6.1 — Nickname e slug do Victor e do Albert **(aut.)**

Depois de F1, F2, F3 em produção. Ensaio em beta. `pg_dump` de `gm_profiles` e `profiles`. Em
transação com `SELECT` antes e depois. Script no padrão de `backend/src/scripts/`, `docker exec` no
`mesas-api`, `--dry-run` primeiro (plan §7). Victor: `nickname='VOID'`, slug → `void`. Albert:
`nickname='Albert'`, slug → `albert`. Via `renameGmSlug`. Aceite: `GET /mestre/patorico027` → 301
para `void`, `GET /mestre/academiahardya` → 301 para `albert`; `/sitemap.xml` sem os antigos.

### [ ] T6.2 — `dadoviciadopodcast` → `Dado Viciado` e `endyrpg13` → `Endy` (D8) **(aut.)**

Decisão dele: "é Dado Viciado e o outro é Endy". Mesmo procedimento da T6.1; slugs `dado-viciado`
e `endy` (livres em 2026-10-27; remedir) com redirect do slug antigo. O `--dry-run` imprime o slug
antes de gravar, porque a derivação do slug a partir do nome é leitura minha. `dadoviciadopodcast`
tem 2 mesas ativas: conferir no beta que `/mestre/dadoviciadopodcast` segue em 301.

---

## F8 — Reports abertos e prevenção (R10 a R22)

Cada bloco foi reescrito após a segunda rodada de investigação (2026-10-27); o diagnóstico da
primeira rodada mudou em cinco deles (`spec.md` §2.8).

### [ ] T8.1 — `redfallen`: aviso e confirmação (R10)

Correção já em produção (`2e38fd1`). Falta o aviso (T8.4 item 2) e ele confirmar que volta a
gravar (`gm_profiles.updated_at` hoje 2026-09-14). **Não fechar sem o `updated_at` novo ou sem
nomear o bloqueio "usuário não respondeu".** Reprodução como ele exige a sessão dele: pedir antes.

### [~] T8.2 — Vagas: uma conta só em quatro lugares (R11, R15, D11)

Plan §10. `gm.ts:249` (+ `t.slots_open`), `useMestre.ts:284`, `whatsappAnnouncement.ts:274`,
`gmPanel.ts:725`. Teste cruzado. `pnpm verify:api`. Aceite: `curl
/api/v1/gm/perfis/mestre-hermes` devolve `slots_available`; soma da página = soma da home.

Estado: `slots_open` é `NOT NULL` (migration 100), então o `COALESCE` fica só no TypeScript. As
quatro pontas já usam `slots_open` e caem em `total - filled` só sem ele: `gm.ts:257` (devolve
`slots_open`), `sumOpenSlots` (`useMestre.ts:8`), `formatSlots` (`whatsappAnnouncement.ts:272`) e
`gmPanel.ts` via `slotsAvailable` (`utils/slots.ts`, uma cópia). Teste cruzado em
`whatsappAnnouncement.test.ts` (soma do mestre × texto do WhatsApp): com `sumOpenSlots` revertido
para `total - filled`, 2 casos falham. Falta o `curl` do aceite (só em beta).

### [~] T8.3 — Contatos: cauda de Markdown e duplicados de Discord (R12, R20)

Plan §12. Código sem autorização: limpeza no `canonicalizeHttpsUrl` (uma função compartilhada com
o parser) e a varredura. **Dado (aut.):** `pg_dump` de `table_contacts`; 2 `UPDATE`
(`uma-nova-fabula-se-inicia-ms21l0mk` → `https://forms.gle/mVvUiUTq7Z5yJTWT9`,
`techno-jogos-do-anfitriao-mrrxgq10` → `https://forms.gle/b3uwFZeGNLQViQ1U7`) e 3 `DELETE` de
`form` (`uwill`, `.zero9899`, `kauarang`; `channel='form'` e `value` igual ao `discord` da mesma
mesa). Aceite: regex `~ '[)\]_*>]+$'` em URL → 0; `form` duplicado de Discord → 0.

Estado do código: `trimTrailingUrlWrappers` mora em `utils/contactUrls.ts` (uma cópia; o parser
importa). `canonicalizeHttpsUrl` só a aplica quando a cauda é inequívoca (`hasMarkdownUrlTail`: `)`,
`]` ou ênfase repetida `**`, `__`, `~~`); `_`, `*`, `~` isolados são válidos no caminho e ficam
(medido: `instagram.com/mestre_` virava `…/mestre` com a limpeza incondicional). Varredura:
`services/contactTailSweep.ts`, mesma regra em SQL mais `>`, chamada por `ops:alerts` no cron diário,
dedupe de 24 h por `activity_log` (`contact.tail_detected`) e `notifyAdmins('contact_tail')`.
Varre só `table_contacts`. O aceite `~ '[)\]_*>]+$'` abaixo acusa `_` isolado válido: usar a regex do
código. Dado (aut.) pendente.

### [~] T8.4 — Fila de feedback: status dos 14 e aviso ao autor (R13, D13, D19, D20)

**(aut.) 14 `UPDATE`** em `dev_feedback`, uma transação, `reviewed_by =
'15f19890-625d-4b4c-8761-dc5f30e1cec9'` (único `admin`, `farenravirar`), `reviewed_at = now()`,
`updated_at = now()`. `admin_notes` internas (nenhuma rota de usuário as lê, `spec.md` §2.8).
`SELECT` antes e depois; rollback: `status='new'`, `admin_notes=NULL`, `reviewed_at=NULL`,
`reviewed_by=NULL`, `merged_into=NULL` nos mesmos ids.

| id | report | status | admin_notes |
|---|---|---|---|
| `98077e25-7fac-482d-9961-796d08f36cb8` | 07-22 Sumiram as informações | `resolved` | Mesa encerrada responde 410 "Mesa encerrada" por desenho (`tables.ts:1020`, spec 090/102). |
| `1ea146a7-a129-437b-a741-d986d400ce4c` | 07-28 Formulário | `triaged` | Contato `form` gravado na importação com `)__` no fim. Parser corrigido em 2026-08-11; dado e editor manual não (spec 106 T8.3). |
| `93817982-7e1b-42b5-b309-13c86b63b0a8` | 08-24 Link | `resolved` | Causa `db.fn.count` (backlog D-QA-ROTAS-ESCRITA-SEM-TESTE). 21 links de 11 usuários criados depois de 2026-08-24. |
| `57a70eca-aca2-44ed-b97f-57315236fd64` | 08-27 Banner (player) | `triaged` | A aba Mestre de `/perfil` oferece banner sem perfil de mestre; `GET /gm/me` 404 esperado (spec 106 T5.3). |
| `1f4c0f2d-69ed-48d2-ae41-86d1d88e40a0` | 08-27 Adicionar sistema | `triaged` | `POST /profile/systems` 500 sem causa medida; logs de agosto não existem. Hipótese E1 não testada (spec 106 T8.6). |
| `1e0c54c0-07ea-4750-a819-1f883fd36d46` | 08-27 Lista de sistemas | `triaged` | Dungeon World ausente do catálogo; decisão de conteúdo (spec 106 T8.5, D9). |
| `7bf0ffcf-ff66-4f2e-b9d8-491bb23df5bb` | 08-28 Vagas | `triaged` | `gm.ts:249` sem `slots_open`; conta crua em 3 outros lugares (spec 106 T8.2). |
| `85c53cd9-c07a-44a2-8ae9-fed927352971` | 09-01 Nome e sistema | `resolved` | Spec 099 E1/E2/E3. O nome gravado vem do e-mail e é revisto na spec 106 (D8). |
| `0148d2d4-2674-4245-b911-f7975b958155` | 09-08 Filtro de dias | `resolved` | `GET /api/v1/tables?weekday=sexta` filtra (30 → 3). |
| `fa0efabf-d312-4223-bcd2-c02401075f74` | 09-30 `redfallen` | `resolved` | Ícone `whatsapp` ausente em cópia do mapa (`linkTypes.ts:8-13`); correção `2e38fd1` em produção desde 2026-10-13. Confirmação do usuário pendente. |
| `7b375d1d-ff95-4d07-9aef-96693b445d19` | 10-06 Aureth | `triaged` | Colou anúncio no feedback; sem perfil de mestre (spec 106 T8.6). |
| `0d7992ef-f512-48fb-b154-63c1d8bbba18` | 10-11 `redfallen` | `duplicate` | Mesmo usuário e causa de `fa0efabf…`. `merged_into = fa0efabf-d312-4223-bcd2-c02401075f74`. |
| `ea186f5f-1728-4fe5-aa2c-71fe42b7e66a` | 10-21 Vagas | `duplicate` | Mesma causa de `7bf0ffcf…`. `merged_into = 7bf0ffcf-ff66-4f2e-b9d8-491bb23df5bb`. |
| `6812bb3b-c54f-4320-a7bc-7500479bafd2` | 10-25 `void` | `triaged` | Nome e URL do mestre vêm do e-mail (spec 106 F1 a F6). |

Resultado: 5 `resolved`, 2 `duplicate`, 7 `triaged`. Remedir os ids com `SELECT id, status FROM
dev_feedback WHERE status='new'` antes (a lista pode ter crescido).

**Código (sem aut.):** aviso ao autor no `PATCH` (plan §11.2) e alerta de fila parada (plan §11.3).
D13 decidida: sim (só in-app). Aceite: fechar um report de teste em beta cria a notificação
do autor; um `new` com 7 dias aciona `notifyAdmins` uma vez.

Estado do código: `services/devFeedbackNotices.ts`. O `PATCH` trava a linha, compara com o status
anterior e enfileira `mesas.system.notice` na mesma transação só na transição para `resolved`,
`wont_fix` ou `duplicate` (sem `user_id` ou sem mudança, não avisa); entrega pós-commit. O alerta
(`alertStaleFeedback`, em `ops:alerts`) marca `stale_alerted_at` num `UPDATE ... RETURNING`
antes de avisar: 1 aviso por relato, no máximo 20 por execução. Falta o aceite em beta.

### [ ] T8.5 — Dungeon World, Monster of the Week, Urban Shadows no catálogo (R14, D9) **(aut.)**

Plan §16. Catálogo central: `POST /api/admin/v1/catalog/nodes` ou a tela de catálogo do `/gestao`;
nunca SQL em `systems` do `mesas`, nunca o `CATALOG_INTERNAL_TOKEN` por conta própria. O agente
prepara os 3 payloads (slug, nome, `name_pt`, aliases, `official_website_url` conferido na fonte) e
o mantenedor cria ou autoriza. Aceite: `GET /api/v1/systems?view=tree` contém os 3; `mesas` os
oferece no seletor de sistema; `Masks` e `Monsterhearts` conferidos contra o que casou.

### [ ] T8.6 — `/painel` como `player` e o 500 de 27/08

Percorrer em beta o caminho de quem não tem perfil (spec 096) e reproduzir `POST
/profile/systems` logo após a criação do perfil pelo editor (hipótese E1, não testada). Os logs
de agosto não existem: a prova tem que ser nova. Sem reprodução, a causa permanece "não medida"
e a task fecha com esse nome, não como resolvida.

### [ ] T8.7 — Telemetria de erro de cliente e contenção (R17, R18, R19, R20, D16, D17)

Plan §9 e §13. Tabela `client_errors`, na `migration_168` **(aut.: aplicar)**. Itens:
1. `reportClientError()` + `HydratedRouter onError` + `ErrorBoundary.componentDidCatch`.
2. `POST /api/v1/client-errors` (rate limit estrito, limites de tamanho, sem IP/header/query).
3. Upsert por `fingerprint`, aviso ao admin na 1ª ocorrência, retenção de 90 dias, e os tetos
   contra abuso do plan §9 (fingerprints novos/h, avisos/h, linhas).  Teste: 1000 mensagens
   distintas em sequência criam no máximo o teto de linhas e de avisos.
4. Painel read-only em `/gestao`.
5. `ErrorBoundary` por seção; fallback em `MestreContactMethods`; teste de paridade
   `CONTACT_CHANNEL_META` × `CONTACT_CHANNELS`; varredura de outros mapas por string externa.
Aceite: erro forçado em beta → 1 linha em `client_errors` + 1 aviso; 2ª ocorrência incrementa sem
novo aviso; canal desconhecido renderiza com fallback; `pnpm verify:api`.

### [~] T8.8 — Testes cruzados (R21)

Vagas (perfil × home × WhatsApp × resposta do editor) e identidade (`nickname`/`slug` ≠ prefixo do
e-mail). Entram nas fases F1 e T8.2; esta task confere que ambos existem e falham sem a correção.

Estado: vagas em `whatsappAnnouncement.test.ts` (falha com `sumOpenSlots` revertido, medido) e
`utils/slots.test.ts`; identidade em `profileServiceNickname.test.ts` (e-mail nem é argumento de
`deriveGmNickname`; A9 já quebra se `email` voltar). Não cobre a "resposta do editor" nem a home
(cartão) por teste de componente: a home usa o mesmo `slots_open` do payload, sem conta própria.

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

### [ ] T7.1 — Remedir a §2 e o aceite da §6 após o deploy

Reexecutar cada comando da `spec.md` §2 e §6. O `COUNT` da §2.2 deve devolver 0 para `nickname`
igual ao prefixo com `display_name` diferente; sitemap sem os slugs antigos; `dev_feedback` sem
`new`; `client_errors` recebendo. Atualizar o que o comando não mede (decisão, bloqueio) e apagar
o resto; trabalho mergeado encolhe (T0). Registrar em `.specify/memory/errors.md` só o que o
protocolo manda (forma que não funciona, medição que contradiz a spec).

---

## F10 — Resíduo de autenticação Discord

### [ ] T10.1 — Remover o vínculo Discord sem uso (D23)

Decisão dele em 2026-10-27: era uma autenticação Discord antiga, para algumas finalidades; o
resíduo sai. Hoje o Discord no produto é só importação de mesas (JSON) e canal de contato.

Medido: `connectDiscord` (`profileService.ts:522`), `disconnectDiscord`, `getDiscordStatus` e as
rotas `GET/POST/DELETE /profile/me/connect/discord` e `GET /profile/me/discord` (`profile.ts:279-325`).
A rota `POST` grava `discord_connected = true` com `username` e `id` do corpo, sem OAuth.
`rg "connect/discord|me/discord" apps/mesas/frontend/src` → 0 chamadores.

Antes de apagar, medir (read-only, sem escrita na VM): linhas com `gm_profiles.discord_connected`
verdadeiro e `auth_providers` com `provider = 'discord'`; outros leitores de `discord_id`,
`discord_username` e `discord_connected` (`rtk rg`, inclusive `packages/` e `apps/accounts`);
contrato público em `docs/api/openapi/`. Linhas com valor em produção: parar e pedir decisão
sobre o dado. Zero: remover funções, rotas e testes. A coluna e a migration (`DROP COLUMN`) ficam
fora até ele mandar (T1 de migration). `pnpm verify:api`. Aceite: `rtk rg "connectDiscord|disconnectDiscord"
apps/mesas` → 0; `GET /api/v1/profile/me/discord` → 404.

Estado: medido em produção (read-only, `mesas-db`): `gm_profiles` 66 linhas, `discord_connected`,
`discord_username` e `discord_id` preenchidos em 0; `auth_providers` só `google|1`, 0 `discord`.
Funções, rotas e a classificação em `scripts/api/generate-openapi.ts` removidas; artefatos de
`docs/api` regenerados (`api:inventory`, `api:generate-openapi`, `api:bundle`). Não existiam testes
dessas rotas. Outros leitores das colunas, deixados: `gm.ts:195` (resposta pública do mestre,
sempre `false`/`null`), `hydration/config.ts`, `adminEnrichment.ts:120`, tipos do front; saem
com o `DROP COLUMN`, que fica para ele mandar. Resta um comentário em `ProfileEditPage.tsx:610`.
