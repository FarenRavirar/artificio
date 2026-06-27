# Plano de implementação — Import Overhaul (spec 048)

> **Para o agente implementador (frio).** Este documento é auto-contido. Leia o T0
> (`project-state.md` + `context-capsule.md` + `decisions.md`) e as regras pétreas de
> `AGENTS.md` antes de tocar código. **Não commitar/pushar/abrir PR/merge/deploy sem
> autorização nominal do mantenedor, por ação.** Branch de trabalho já criada:
> **`feat/048-import-overhaul`** (a partir de `origin/dev`).
>
> Origem: smoke beta 2026-06-26 (DEB-048-30..35 em `debitos.md` + decisões do mantenedor
> na mesma seção). O **import é o centro**: capa, parse, landscape, homebrew, DeepSeek e
> unificação de UI convergem nele. Princípios inegociáveis deste plano: **mudança mínima,
> anti-retrabalho, anti-duplicação** (reusar helpers existentes; nunca recriar lógica que
> já existe).

---

## 0. Mapa do pipeline de import (verdade material — verificado no código)

```
POST /import-json (routes/discord/import.ts)
  → importDiscordChatExporterJson (chatExporterImportService.ts)
      → SÓ insere raw em discord_import_messages (status 'pending'). NÃO parseia, NÃO cria draft, NÃO toca capa.
POST /import-json/reparse  ou  parse-batch
  → processDiscordMessageToDraft (routes/discord/utils.ts)
      → parseDiscordMessage → parseDiscordAnnouncement (parseDiscordAnnouncement.ts)
          → extractCoverFromAttachments → grava table.cover_url_source = URL Discord CDN (efêmera)
      → cria/atualiza discord_import_table_drafts (status parsed/needs_review)
POST /admin/discord-sync/drafts/:id/sync (routes/discord/sync.ts)
  → syncDiscordDraftToTable → syncDraftToTable (syncHelpers.ts)
      → uploadCoverForDraft → uploadDiscordImageToCloudinary(cover_url_source)  ← ÚNICO ponto de upload hoje
      → cria/atualiza `tables`, marca draft 'synced'
```

**Campos de capa:** `cover_url_source` = URL Discord (efêmera, set no parse). `cover_url` =
URL Cloudinary (set no sync). `uploadCoverForDraft` tem short-circuit: se `cover_url` já
existe, reusa e não baixa de novo (`syncHelpers.ts:289-294`).

---

## 1. WS0 — Já aplicado local nesta branch (NÃO reimplementar; só revisar + testar)

| Arquivo | Mudança | Débito |
|---|---|---|
| `apps/mesas/backend/src/discord/syncDiscordDraftToTable.ts` | `getSourceId: (message) => message.id` (era `discord_message_id` snowflake → estourava `tables.source_id` uuid) | DEB-048-30 🔴 |
| `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` | `extractCoverFromAttachments` escolhe maior razão `width/height` (banner landscape) + lê campo `filename` (ChatExporter) | DEB-048-33 |
| `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts` | guard prototype pollution (`__proto__`/`constructor`/`prototype`) no diff de correção | CodeRabbit PR #99 |

**Testes a adicionar (cobrir o que já foi feito):**
- Sync Discord: draft `ready` com `discord_message_id` (uuid interno) → cria `tables` com `source_id` = uuid da msg. Regressão do 500.
- `extractCoverFromAttachments`: 2 imagens (retrato 1024×1536 + paisagem 1536×1024) → escolhe a paisagem. 1 imagem sem dimensão → mantém. SVG → ignora.

---

## 2. WS1 — Capa no import (DEB-048-31) — **CENTRO DO PR**

### Causa raiz (confirmada em log beta)
URL do Discord CDN é assinada/efêmera (`?ex=&is=&hm=`, ~24h a partir do **export**, não do
import). Entre parse e sync ela morre → preview quebrado + `uploadDiscordImageToCloudinary`
retorna `expired_url` (HTTP 404). Decisão do mantenedor: **subir ao Cloudinary no import +
limpeza de órfãs por TTL 30 dias.**

### Passo 1.1 — Antecipar o upload do sync → para a criação do draft
- **Reusar `uploadCoverForDraft` (NÃO escrever upload novo).** Em
  `processDiscordMessageToDraft` (`routes/discord/utils.ts`), **após** o insert/update do
  draft e **antes** de retornar, chamar `uploadCoverForDraft(draftId, normalized.draft, attempts)`
  e persistir o resultado via `updateDraftImageUploadState` (ambos já existem em `syncHelpers.ts`).
- Resultado: `cover_url` (Cloudinary, permanente) já preenchido no parse. O sync herda o
  short-circuit `existingCover` → vira no-op de imagem. **Zero duplicação de lógica.**
- ⚠️ Cuidado: `processDiscordMessageToDraft` roda em lote (parse-batch/reparse). Upload é I/O
  externo — manter o padrão best-effort já existente (falha de imagem **não** derruba o parse;
  status vira `expired_url`/`error` e segue). Não serializar o lote em volta do upload de forma
  que multiplique latência sem limite: respeitar o `limit(500)` já existente; se preciso,
  upload em paralelo controlado (mas **não** introduzir lib nova — usar `Promise.all` com
  fatiamento simples se a latência incomodar; caso contrário, sequencial é aceitável).

### Passo 1.2 — Refresh de URL via bot token (robustez contra export velho)
- Mesmo subindo no import, um export antigo pode chegar com URL já morta. Discord permite
  re-resolver URLs assinadas: `POST https://discord.com/api/v10/attachments/refresh-urls`
  com `{ attachment_urls: [...] }` e header `Authorization: Bot <token>`.
- **Encapsular dentro de `uploadDiscordImage.ts`** (a função `uploadDiscordImageToCloudinary`):
  ao receber 404/`expired_url` no fetch da URL, tentar **uma vez** o refresh (token via
  `discord/config.ts getBotToken` + `settingsCrypto.decryptDiscordSetting`), e re-tentar o
  upload com a URL fresca. Falhou de novo → `expired_url` como hoje. **Um só ponto**; parse e
  sync herdam. Não duplicar refresh em dois lugares.
- Se o token do bot não estiver configurado, degradar silenciosamente (mantém comportamento
  atual). Nunca logar o token (regra pétrea de segredos).

### Passo 1.3 — Preview do Cloudinary
- Conferir que `DiscordDraftPreview.tsx` / `DraftEditorTab` exibem a imagem de **`cover_url`**
  (Cloudinary, permanente) quando presente, caindo para `cover_url_source` só se `cover_url`
  vazio. Hoje o preview provavelmente usa `cover_url_source` (Discord, quebra). Ajustar a
  precedência: `cover_url || cover_url_source`.

### Passo 1.4 — Limpeza de órfãs (TTL 30 dias)
- **Problema:** drafts nunca sincronizados (status `draft`/`needs_review`, `table_id` nulo)
  deixam imagens no Cloudinary. Decisão: remover após 30 dias.
- **Pré-requisito:** para deletar no Cloudinary é preciso o `public_id`, não a URL. Verificar
  o retorno de `uploadDiscordImageToCloudinary` — se só devolve `url`, **persistir o
  `public_id`** (nova coluna `discord_import_table_drafts.cover_public_id` via migration, ou
  dentro do payload `table._cover_public_id`). Preferir **coluna** (consulta direta no cron).
- **Cron:** adicionar job no container `mesas-cron` (ver `apps/mesas` cron existente —
  scout: `rg -n "cron|schedule" apps/mesas/backend/src`). Query: drafts com
  `status in ('draft','needs_review')` **E** `table_id is null` **E**
  `image_upload_last_at < now() - interval '30 days'` **E** `cover_public_id is not null`.
  Para cada: `cloudinary.uploader.destroy(public_id)` + nular `cover_public_id`/`cover_url`.
  Logar quantos removidos (sem segredo). Idempotente.
- **Pasta Cloudinary:** subir drafts em `discord-drafts/`. No sync **não mover** o asset
  (evita complexidade); a mesa referencia o mesmo `cover_url`. Drafts sincronizados (`table_id`
  not null) ficam **fora** do filtro de limpeza. Documentar que o asset vive em `discord-drafts/`
  mesmo após sync (aceitável; alternativa de mover fica como débito futuro se incomodar).

### Testes WS1
- `uploadCoverForDraft` chamado no parse → draft sai com `cover_url` Cloudinary + `image_upload_status='success'` (mock do upload).
- expired_url no fetch → tenta refresh via bot token (mock) → sucesso na 2ª.
- cron de limpeza: draft órfão >30d com public_id → `destroy` chamado + colunas nuladas; draft synced → **não** tocado.

---

## 3. WS2 — Unificar Inbox no "Discord Sync" (DEB-048-34)

### Estado
Backend **já é DRY** (REV-016): `createCorrectionHandler`, `handlePatchDraft`,
`syncDraftToTable` são compartilhados entre inbox e discord. A duplicação restante é
**frontend** (duas telas paralelas).

### Plano
- **Scout obrigatório antes de codar** (mapear o que existe — não assumir):
  - `rg -l "inbox" apps/mesas/frontend/src` e `ls apps/mesas/frontend/src/features/discord-sync`
  - identificar componentes-gêmeos: tabela de revisão, editor de draft, ações (corrigir/patch/sync).
- **Meta:** "Discord Sync" vira o hub único de revisão de drafts, com **filtro por origem**
  (`discord` | `inbox`). A origem já é distinguível no backend (`discord_message_id` vs
  `import_message_id`).
- **Anti-duplicação:** extrair UM componente de tabela de revisão e UM editor que recebam a
  origem como prop/param; eliminar o par inbox/discord. Não criar um 3º caminho — **absorver**
  o inbox no discord-sync e remover a tela inbox redundante (ou redirecioná-la).
- **Navegação/menu:** ajustar rotas e o menu de Gestão para uma entrada só. Verificar
  `packages/ui` nav (`modules.ts`) só se houver link público — provavelmente é admin interno.
- **Risco:** regressão visual. Aplicar checklist Nielsen/ISO (regra de produto) e smoke manual.

### Testes WS2
- Lista unificada mostra drafts de ambas origens; filtro por origem funciona.
- Editar+salvar+corrigir+sync de um draft **inbox** e de um draft **discord** pela tela única.

---

## 4. WS3 — DeepSeek key central / universal (DEB-048-35) — **SDD COMPLETO**

> ⚠️ **GOVERNANÇA PÉTREA.** Toca `accounts.` (SSO) e potencialmente `packages/*` →
> **SDD Completo**: exige `spec.md`/`plan.md`/`tasks.md` (este doc cobre o plan), aprovação
> nominal do mantenedor por ação de git/deploy, e **smoke dos consumidores SSO**
> (login/me/logout + ≥1 app consumidor) porque mexe no serviço `accounts.`. Auth é sagrado:
> **não quebrar a sessão compartilhada.** O mantenedor autorizou expandir o escopo da 048 e
> manter no mesmo PR.

### Decisão de arquitetura (mantenedor): **opção (A)** — segredo central no `accounts.`, consumido em runtime pelos módulos.

### accounts (backend) — `apps/accounts/src`
- **Migration nova** (seguir padrão de `apps/accounts/src/migrate.ts`): tabela
  `admin_secrets` `{ id uuid pk, name text unique, ciphertext text not null, updated_by uuid,
  updated_at timestamptz default now() }`. Online-safe (create table puro).
- **Crypto:** replicar AES-256-GCM do mesas (`discord/settingsCrypto.ts`:
  `createCipheriv('aes-256-gcm', scryptSync(secret, salt, 32), iv)`). **Anti-duplicação:**
  preferível extrair a crypto para um `packages/*` compartilhado (ex.: `packages/config` já
  existe) e ambos (mesas + accounts) consumirem. **Decidir:**
  - (i) extrair para `packages/config/src/secretCrypto.ts` e refatorar `settingsCrypto` p/ usar
    (melhor, sem dup; mas toca `packages/*` → já estamos em SDD Completo, então cabe);
  - (ii) crypto local no accounts (rápido, duplica ~20 linhas — registrar débito).
  **Recomendado (i)** já que o PR é SDD Completo. Chave via env nova `ACCOUNTS_SECRETS_KEY`
  (secret do Actions/compose; nunca no git).
- **Rotas admin** (gate de admin já existente no accounts):
  - `PUT /admin/secrets/:name` → cifra e upsert. Body `{ value }`.
  - `GET /admin/secrets/:name` → decifra e retorna `{ value }` **só p/ admin** (ou serviço, ver auth).
  - Nunca logar `value`/`ciphertext`.
- **Auth serviço-a-serviço (mesas → accounts):** o cookie SSO é de **usuário**, não serve p/
  o backend do mesas chamar o accounts. Definir um **token de serviço compartilhado**
  (`SERVICE_SECRET` em env dos dois) validado por header `X-Service-Token` no `GET
  /admin/secrets/:name`. Documentar e tratar como segredo. (Alternativa: mesas só lê a key
  quando um admin dispara a ação, repassando o JWT do admin — mais acoplado ao request do
  usuário; **preferir o token de serviço** para o parser rodar em batch/cron.)

### accounts (frontend) — `apps/accounts/frontend`
- Tela admin "Segredos" com campo p/ a key DeepSeek (write-only; mostra "configurado ✓",
  nunca exibe o valor). Chama `PUT /admin/secrets/deepseek_api_key`.

### mesas (backend) — consumo
- Cliente `apps/mesas/backend/src/services/adminSecrets.ts`: `getSecret(name)` faz
  `GET {ACCOUNTS_ORIGIN}/admin/secrets/:name` com `X-Service-Token`, **cache em memória com
  TTL** (ex.: 5 min) p/ não bater no accounts a cada parse. `ACCOUNTS_ORIGIN` via
  `@artificio/config` (já há padrão — ver DEB-046-04).
- `discord/llmAssist.ts`: ponto único que pega a key via `getSecret('deepseek_api_key')`.
  Stub de integração (sem LLM completo até decisão).

### Smoke obrigatório WS3 (matriz mínima, regra pétrea)
- accounts: **login / me / logout** (não regrediu) + `PUT`/`GET /admin/secrets` (admin-gated;
  não-admin → 403; serviço com token → 200).
- ≥1 app consumidor SSO sobe e loga normal.
- mesas: `getSecret` busca e cacheia; sem token → 401/403.

---

## 5. WS4 — requestLogger EACCES (DEB-048-32)

- Beta: `EACCES: permission denied, open '/app/logs/routes.log'` em **toda** request.
- **Plano (proposto; aguarda "ok" do mantenedor):** em `middleware/requestLogger.ts`, no
  `catch` do `appendFileSync`, **degradar p/ `console.log` e setar um flag `loggerDisabled`**
  para **não re-tentar** o arquivo a cada request (hoje tenta sempre → ruído + I/O). Uma linha
  de aviso única.
- **Follow-up infra (débito separado):** tornar `/app/logs` writable no `Dockerfile`/compose
  do mesas (mkdir + chown p/ o user do runtime) ou volume nomeado. T1 infra — **não** misturar
  no mesmo passo de código sem aprovação de infra.

---

## 6. Ordem sugerida de execução (cada fase = autorização própria do mantenedor)

1. WS0 testes (regressão sync + landscape) — valida o que já está local.
2. WS1 capa no import (1.1→1.4) — centro; maior valor.
3. WS4 requestLogger (rápido, para o ruído).
4. WS2 unificação de UI (frontend, scout primeiro).
5. WS3 DeepSeek opção 2 (SDD Completo; deixar por último p/ não bloquear o resto; **confirmar
   escopo LLM + crypto compartilhada antes**).

---

## 7. Gates de governança (não pular)

- **Branch:** `feat/048-import-overhaul` (já criada off `origin/dev`). Tudo entra em `dev` via
  **PR** (branch protection; check `lint + build + test` verde). Nada de push direto em `dev`.
- **Commits/push/PR/merge/deploy:** **cada um** exige autorização nominal do mantenedor, por
  ação. Autorização não acumula.
- **Bots de review (CodeRabbit/CodeQL/Sonar/Q):** **nunca** responder/reagir no PR. Veredicto
  vai p/ `debitos.md`/sessão.
- **Segredos:** key DeepSeek, bot token, `SERVICE_SECRET`, `ACCOUNTS_SECRETS_KEY` —
  cifrados/em env, fora do git, filtrados de log.
- **Isolamento:** WS3 (accounts/packages) = SDD Completo + smoke SSO. WS1/WS2/WS4 = `apps/mesas`
  (Lite), mas WS1 toca Cloudinary (signed preset já existe — não hardcodar credencial).

## 8. Validação final (antes de declarar qualquer WS concluído)

```
pnpm --filter "./apps/mesas/backend" run build
pnpm --filter "./apps/mesas/frontend" run build
pnpm --filter "./apps/accounts/backend" run build     # se WS3 tocou accounts (ajustar path real)
pnpm --filter "./apps/accounts/frontend" run build
pnpm run test    # ou vitest por pacote afetado
pnpm run lint
```
LSP/diagnóstico é auxiliar — `build`+`lint`+`test` são a fonte de verdade. Registrar evidência
em sessão + atualizar `debitos.md`/`backlog.md`/`project-state.md` conforme a regra de conclusão.

---

## 9. Decisões fechadas pelo mantenedor (2026-06-26) — "fazer tudo, sem retrabalho, sem adiar, é para funcionar"

1. **Escopo LLM do WS3 = COMPLETO.** Não é só encanamento: implementar o **parser assistido
   por DeepSeek de verdade** em `discord/llmAssist.ts`, consumido no parse (parse-batch/reparse)
   quando a confiança do regex for baixa ou houver campos faltando. Chamada real à API DeepSeek
   (`https://api.deepseek.com`, modelo `deepseek-chat`), com normalização tipada do retorno
   (payload externo = `unknown` até passar por schema — regra pétrea) e fallback para o
   resultado do regex se a LLM falhar/timeout. Sem mascarar erro; logar sem vazar a key.
2. **Crypto compartilhada = `packages/config`.** Extrair AES-256-GCM para
   `packages/config/src/secretCrypto.ts`; refatorar `apps/mesas/.../settingsCrypto.ts` e o
   accounts para consumirem o mesmo util. **Sem duplicar** os ~20 linhas. (Estamos em SDD
   Completo, então tocar `packages/config` cabe — rodar build de todos os consumidores.)
3. **WS4 requestLogger = SIM**, fix por código (stdout fallback) neste PR. Infra writable
   (`/app/logs`) entra também: ajustar `Dockerfile`/compose do mesas p/ o dir ser gravável
   (não deixar só o paliativo de código).

**Tudo no mesmo PR `feat/048-import-overhaul`. Nada adiado. Critério: funcionar end-to-end
(sync cria mesa, capa persiste no Cloudinary, banner landscape, UI unificada, DeepSeek
configurável e em uso, logs limpos).**
