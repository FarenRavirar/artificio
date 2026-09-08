# Débitos — Spec 075 (Downloads-F)

Achados internos de investigação, lint, build ou auditoria.

## DEB-075-01 — Job agendado de link checker não implementado, só checagem sob demanda

🟡 Aberto (2026-07-12). T5.1 previa "job agendado isolado"; implementado só `POST /admin/materials/:id/check-link` sob demanda (chamado manualmente pela UI). Sem infra de scheduler/cron disponível para o downloads nesta rodada. A lógica (`linkChecker.ts`) é pura e reusável — só falta um disparo periódico (cron VM ou GitHub Actions scheduled workflow, mesmo padrão de `docker-cleanup.yml`/`mesas-auto-archive.yml`).

## DEB-075-02 — Mídias e Publicadores sem dado real (placeholders)

🟡 Aberto (2026-07-12). `GestaoMidiasPage` e `GestaoPublicadoresPage` são placeholders: não há tabela de mídia/capa própria do downloads (D106 previu derivado Cloudinary, não implementado em nenhuma spec até aqui), e não há rota de listagem paginada de todos os publicadores (só busca individual por slug). Ambos ficam como débito até existir dado real por trás.

## DEB-075-03 — Storage real de evidência/arquivo continua bloqueado (mesma raiz do DEB-073-03)

🟡 Aberto (2026-07-12). `POST /admin/materials/:id/evidence/upload` valida magic bytes e grava `download_evidence`, mas nunca persiste o binário em storage real (071 T6.2 segue sem credencial de provider). Contrato de validação implementado por decisão nominal do mantenedor; storage real de arquivo é decisão futura, fora de controle desta sessão.
