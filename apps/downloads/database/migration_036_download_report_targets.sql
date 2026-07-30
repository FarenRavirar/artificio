-- @class: online-safe
-- @requires-backup: false
-- @author: spec-089
-- @created: 2026-07-30
-- @description: Generaliza denuncia para material ou comentario e registra sinal de abuso.

ALTER TABLE download_report
  ALTER COLUMN material_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES download_comment(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reporter_abuse_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reporter_dismissed_streak SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_download_report_single_target'
      AND conrelid = 'download_report'::regclass
  ) THEN
    ALTER TABLE download_report
      ADD CONSTRAINT chk_download_report_single_target
      CHECK ((material_id IS NOT NULL) <> (comment_id IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_download_report_dismissed_streak_nonnegative'
      AND conrelid = 'download_report'::regclass
  ) THEN
    ALTER TABLE download_report
      ADD CONSTRAINT chk_download_report_dismissed_streak_nonnegative
      CHECK (reporter_dismissed_streak >= 0);
  END IF;
END $$;

-- Unicidade "uma denuncia por denunciante por alvo" (D111/T9.7). Historico do
-- desenho, porque duas revisoes de PR #230 mudaram a solucao:
--
-- 1. Antes da 036 nao havia unicidade nenhuma (migration_005 nao criou), so o
--    SELECT de duplicata no handler — check-then-insert, que perde corrida. Logo
--    duplicata legitima pode existir em banco ja rodando, e um indice unico
--    irrestrito abortaria com 23505, derrubando o deploy (achado Codex P1).
-- 2. A primeira correcao deduplicava com DELETE FROM. Errado por dois motivos
--    independentes: o guard `validate_sql_against_class` barra DELETE FROM em
--    `online-safe` (verificado por execucao real, exit 1 — padrao E011), e
--    apagar a denuncia mais recente pode descartar a de MAIOR prioridade/estado
--    mais avancado, perdendo trabalho de moderacao (achado CodeRabbit).
--
-- Solucao final: escopo do indice = apenas casos NAO decididos (open/in_review).
-- Isso da a garantia que o produto precisa — nao acumular denuncia pendente
-- repetida do mesmo denunciante sobre o mesmo alvo — sem apagar linha nenhuma:
-- historico ja resolvido/dispensado fica intacto, e um banco com duplicata
-- antiga nao trava mais o deploy, porque duplicata antiga so existe entre casos
-- ja decididos. Continua `online-safe`, sem exigir backup nem parar a esteira.
--
-- Consequencia deliberada: denunciar de novo APOS a moderacao decidir e
-- permitido. Correto — problema pode reaparecer (link volta a quebrar, material
-- e reeditado), e a decisao anterior nao deve calar o denunciante para sempre.
-- O handler completa o par: o SELECT de duplicata em reports.ts tambem filtra
-- por case_state, e o 23505 e a rede contra corrida.
CREATE UNIQUE INDEX IF NOT EXISTS idx_download_report_reporter_material_unique
  ON download_report(reporter_user_id, material_id)
  WHERE reporter_user_id IS NOT NULL
    AND material_id IS NOT NULL
    AND case_state IN ('open', 'in_review');

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_report_reporter_comment_unique
  ON download_report(reporter_user_id, comment_id)
  WHERE reporter_user_id IS NOT NULL
    AND comment_id IS NOT NULL
    AND case_state IN ('open', 'in_review');

CREATE INDEX IF NOT EXISTS idx_download_report_comment
  ON download_report(comment_id)
  WHERE comment_id IS NOT NULL;
