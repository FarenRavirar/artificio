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
