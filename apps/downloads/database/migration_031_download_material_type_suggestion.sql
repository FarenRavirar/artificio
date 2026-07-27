-- @class: online-safe
-- @requires-backup: false
-- @author: spec-088
-- @created: 2026-07-27
-- @description: Fila de triagem para hint de TIPO nao reconhecido, simetrica a
--   download_system_suggestion (migration_027). Achado de review da PR #218
--   (Codex, P2): migration_030 criou raw_material_type_hint mas nenhum consumidor
--   administrativo lia a coluna — o dado era gravado e ficava invisivel, sem
--   caminho de resolucao, enquanto raw_system_hint ja tinha fila + rota admin.
--   Decisao do mantenedor (2026-07-27): fechar a simetria agora, nao registrar
--   como debito.
--
--   Diferenca estrutural em relacao a sugestao de SISTEMA: a taxonomia de tipo
--   (catalog_material_types) e uma LISTA PLANA, nao uma arvore system/edition/
--   variant. Por isso nao existe parent_id, nem create_child, nem distincao
--   entre system_id e edition_id na resolucao — as acoes possiveis sao apontar
--   pra um tipo existente (merge_existing, ensinando o alias) ou criar um tipo
--   novo (create_type).

CREATE TABLE IF NOT EXISTS download_material_type_suggestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  raw_value TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  suggested_by_user_id UUID,
  resolution_action TEXT,
  resolved_material_type_id UUID,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT download_material_type_suggestion_source_check
    CHECK (source IN ('scraper', 'user')),
  CONSTRAINT download_material_type_suggestion_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT download_material_type_suggestion_resolution_action_check
    CHECK (resolution_action IS NULL OR resolution_action IN ('merge_existing', 'create_type'))
);

-- Mesmo motivo do indice parcial de download_system_suggestion: a fila admin
-- filtra por status='pending' o tempo todo, e sugestoes resolvidas crescem sem
-- limite.
CREATE INDEX IF NOT EXISTS idx_download_material_type_suggestion_status_pending
  ON download_material_type_suggestion (status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_download_material_type_suggestion_material_id
  ON download_material_type_suggestion (material_id);

-- Mesma trava de migration_027: sem ela, reprocessar o mesmo item empilha
-- sugestoes 'pending' identicas pro mesmo (material_id, raw_value). Restrita a
-- source='scraper' AND status='pending' — sugestao de usuario pode repetir
-- (pessoas diferentes sugerindo o mesmo texto e legitimo) e sugestao ja
-- resolvida nao conta pra unicidade (rejeitada precisa poder reabrir depois).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_download_material_type_suggestion_scraper_pending
  ON download_material_type_suggestion (material_id, raw_value)
  WHERE source = 'scraper' AND status = 'pending';
