# Débitos — 057

> Achados internos (investigação/lint/build/auditoria). Reviews externos vão em `reviews.md`.

## Achados de investigação (Fase 0 — preliminares, confirmar nas tasks)

- **DEB-057-01** — Duas árvores admin coexistem (`features/admin` novo + `modules/admin` velho) → inconsistência visual/estado. Origem: specs 049/054 não absorveram o legado. Escopo: unificar (R9/T1.5).
- **DEB-057-02** — Bundle de API com `consumers:[]` em 100% das rotas admin + `api-orphans.generated.md` stale (timestamp 1970). Mapa de órfãs não confiável. Próximo passo: reconstruir cruzamento front×back (T0.2); avaliar se o gerador de consumers da spec 055 cobre rotas admin.
- **DEB-057-03** — `DashboardSection` dispara 3 GETs de pendência no mount e são cancelados pelo dedup (`[api] Cancelando requisição duplicada`) em `/gestao/conteudo`→Mesas. Ruído, não erro. Causa: efeito de pendência montado fora do Dashboard. Corrigir no redesign (T0.3).
- **DEB-057-04** — Dois sistemas de draft paralelos (`/admin/discord/drafts/*` + `/admin/import/drafts/*`) sem destino central. Unificar em Mesas central (R4/T0.4).
- **DEB-057-05** — Dashboard com conteúdo redundante (Visão geral = ActivityPanel + Últimas atividades = mesmo ActivityPanel) e stubs (Alertas, Atalhos). Refazer (R8).
- **DEB-057-06** — **Notificações do admin efetivamente mortas.** Beta: 42 notificações, todas `suggestion_approved/rejected` (endereçadas ao sugeridor); 0 dos tipos que o sino do admin mostra. Causa: `notifyAdmins` exclui o autor (single-admin = único sugeridor → auto-exclusão) + `table_published`/`member_joined`/`dev_feedback` nunca inseridos. Evidência em `investigacao-notif-config.md` §A. → R14.
- **DEB-057-07** — **ChatExporter (Via B) só tem perfil único** (1 linha `discord_settings` guild_id=null, 1 channelId/token/importDir). Pedido do mantenedor exige perfis multi-canal. Precisa tabela `discord_chat_exporter_profiles` (migração aditiva). Evidência em `investigacao-notif-config.md` §B. → R13.

## Débitos herdados da 052 (D1–D10) — CodeRabbit no PR #120

> **Origem:** revisão do CodeRabbit em `reviews.md` §"Em arquivos da 052 (NÃO estão no #120)". Arquivos do backend DCE pertencem à spec 052. **Alvo:** Fase 6 do 057 (absorção do DCE). Pré-condição para ChatExporter funcional.

| ID | Sev | Arquivo | Achado |
|---|---|---|---|
| **DEB-057-08** (D1) | **Major** | `chatExporterCliRunner.ts:26-48` | `export` do DCE **não aceita `--cookies`** → flag inválida quebra o processo quando `config.cookies` preenchido. Remover ramo `--cookies`. |
| **DEB-057-09** (D2) | **Major** | `chatExporterCliRunner.ts` | Validar `channelId` (só dígitos) antes de compor `outputPath` — path traversal possível. |
| **DEB-057-10** (D3) | Major | `chatExporterCliRunner.ts:74-77` | Timeout só manda SIGTERM; adicionar fallback SIGKILL p/ processo órfão. |
| **DEB-057-11** (D4) | **Major** | `chatExporterFolderImportService.ts:26-52` | `allowedBaseDir` opcional → rota admin chama sem contenção → `importDir` do config escapa da base. Tornar obrigatório/validar. |
| **DEB-057-12** (D5) | Major | `chatExporterFolderImportService.ts:165-172` | `cleanup` de retenção sem try/catch mascara resultado já processado se FS falhar. |
| **DEB-057-13** (D6) | Minor | `routes/discord/automation.ts:28-32` | `limit` inválido (`abc`/`0`/`1001`) cai em fallback 100 — schema devia rejeitar (400). |
| **DEB-057-14** (D7) | Minor | `routes/discord/chatExporterAutomation.ts:24` | Regex de `time` aceita `99:99`; restringir 00:00–23:59. |
| **DEB-057-15** (D8) | **Major** | `routes/discord/chatExporterAutomation.ts:31-36` | `updateSchema` herda defaults do `configSchema` → PUT parcial sobrescreve `enabled/frequency/time/timezone` salvos. Separar schema de update sem `.default()`. |
| **DEB-057-16** (D9) | Major | `routes/discord/import.ts:64-74` | Auto-parse processa só 500 de até 2000 e retorna sucesso sem sinalizar truncamento. Lote ou flag `truncated/remaining`. |
| **DEB-057-17** (D10) | Minor | `ChatExporterAutomationPanel.tsx:67-87,136-155` | `after` removido do payload não limpa filtro; `decrypt_error` nunca exibido ao admin (visibilidade de status). |
