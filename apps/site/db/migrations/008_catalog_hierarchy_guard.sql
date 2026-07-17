-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-077
-- @created: 2026-07-14
-- @description: Fecha o contrato universal system -> edition -> variant.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

-- Contrato universal e unico: system -> edition -> variant.
-- Impede novas combinacoes invalidas mesmo em writes que contornem a API.

-- Decisão explícita do mantenedor: D&D 1e é edição. O filho Basic Set (Mentzer)
-- já é variante e passa a ter pai correto quando o tipo de 1e é corrigido.
DO $$
DECLARE
  affected integer;
  dnd_1e_id text;
  dnd_root_id text;
  victory_id text;
  victory_root_id text;
BEGIN
  -- source_environment nao filtrado: legacy_id de D&D 1e e unico por source_app+source_table
  -- em qualquer ambiente (prod ou beta); filtro fixo em 'prod' impedia a migration de
  -- rodar em beta, onde o mesmo mapeamento existe sob source_environment='beta'.
  SELECT canonical_id INTO dnd_1e_id
  FROM catalog_legacy_mappings
  WHERE source_app = 'mesas'
    AND source_table = 'systems'
    AND legacy_id = '2b87932e-9938-463f-b1fc-b1693bfb94ba';
  SELECT canonical_id INTO dnd_root_id
  FROM catalog_legacy_mappings
  WHERE source_app = 'mesas'
    AND source_table = 'systems'
    AND legacy_id = '5092ddb4-b9a8-40cc-bf07-afdec155cab7';
  IF dnd_1e_id IS NULL OR dnd_root_id IS NULL THEN
    RAISE EXCEPTION 'dnd_1e_legacy_mapping_missing';
  END IF;

  UPDATE catalog_nodes
  SET node_type = 'edition', updated_at = now(), version = version + 1
  WHERE id = dnd_1e_id
    AND node_type = 'variant'
    AND parent_id = dnd_root_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 AND NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = dnd_1e_id
      AND node_type = 'edition'
      AND parent_id = dnd_root_id
  ) THEN
    RAISE EXCEPTION 'dnd_1e_reclassification_state_diverged';
  END IF;

  SELECT canonical_id INTO victory_id
  FROM catalog_legacy_mappings
  WHERE source_app = 'mesas'
    AND source_table = 'systems'
    AND legacy_id = '169b6b26-f82b-429e-9acd-05e7138688a9';
  IF victory_id IS NOT NULL THEN
    SELECT canonical_id INTO victory_root_id
    FROM catalog_legacy_mappings
    WHERE source_app = 'mesas'
      AND source_table = 'systems'
      AND legacy_id = '3a5327e2-5842-4c77-9e9d-51cc9989f711';
    IF victory_root_id IS NULL THEN
      RAISE EXCEPTION '3det_victory_parent_mapping_missing';
    END IF;
  END IF;

  -- Victory só existe no snapshot Beta; se mapeada, deve ser edição de 3D&T.
  UPDATE catalog_nodes
  SET node_type = 'edition', updated_at = now(), version = version + 1
  WHERE id = victory_id
    AND node_type = 'subsystem'
    AND parent_id = victory_root_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF victory_id IS NOT NULL AND affected = 0 AND NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = victory_id
      AND node_type = 'edition'
      AND parent_id = victory_root_id
  ) THEN
    RAISE EXCEPTION '3det_victory_reclassification_state_diverged';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM catalog_nodes WHERE node_type = 'subsystem')
     OR EXISTS (SELECT 1 FROM catalog_suggestions WHERE node_type = 'subsystem') THEN
    RAISE EXCEPTION 'legacy_subsystem_requires_manual_reclassification';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM catalog_nodes child
    LEFT JOIN catalog_nodes parent ON parent.id = child.parent_id
    WHERE (child.node_type = 'system' AND child.parent_id IS NOT NULL)
       OR (child.node_type = 'edition' AND parent.node_type IS DISTINCT FROM 'system')
       OR (child.node_type = 'variant' AND parent.node_type IS DISTINCT FROM 'edition')
  ) THEN
    RAISE EXCEPTION 'invalid_catalog_hierarchy_requires_manual_reclassification';
  END IF;
END;
$$;

ALTER TABLE catalog_nodes DROP CONSTRAINT IF EXISTS catalog_nodes_type_check;
ALTER TABLE catalog_nodes DROP CONSTRAINT IF EXISTS catalog_nodes_parent_check;
ALTER TABLE catalog_nodes
  ADD CONSTRAINT catalog_nodes_type_check CHECK (node_type IN ('system', 'edition', 'variant')),
  ADD CONSTRAINT catalog_nodes_parent_check CHECK (
    (parent_id IS NULL AND node_type = 'system')
    OR (parent_id IS NOT NULL AND node_type IN ('edition', 'variant'))
  );

ALTER TABLE catalog_suggestions DROP CONSTRAINT IF EXISTS catalog_suggestions_type_check;
ALTER TABLE catalog_suggestions
  ADD CONSTRAINT catalog_suggestions_type_check CHECK (node_type IN ('system', 'edition', 'variant'));

CREATE OR REPLACE FUNCTION validate_catalog_node_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_type text;
BEGIN
  IF NEW.node_type = 'system' THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'root_parent_forbidden';
    END IF;
    IF EXISTS (
      SELECT 1 FROM catalog_nodes child
      WHERE child.parent_id = NEW.id AND child.node_type <> 'edition'
    ) THEN
      RAISE EXCEPTION 'hierarchy_invalid';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    RAISE EXCEPTION 'parent_required';
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'hierarchy_cycle';
  END IF;

  SELECT node_type INTO parent_type FROM catalog_nodes WHERE id = NEW.parent_id;
  IF parent_type IS NULL THEN
    RAISE EXCEPTION 'parent_not_found';
  END IF;
  IF NEW.node_type = 'edition' AND parent_type <> 'system' THEN
    RAISE EXCEPTION 'hierarchy_invalid';
  END IF;
  IF NEW.node_type = 'variant' AND parent_type <> 'edition' THEN
    RAISE EXCEPTION 'hierarchy_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM catalog_nodes child
    WHERE child.parent_id = NEW.id
      AND NOT (
        (NEW.node_type = 'system' AND child.node_type = 'edition')
        OR (NEW.node_type = 'edition' AND child.node_type = 'variant')
      )
  ) THEN
    RAISE EXCEPTION 'hierarchy_invalid';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT id FROM catalog_nodes WHERE parent_id = NEW.id
      UNION ALL
      SELECT child.id FROM catalog_nodes child JOIN descendants parent ON child.parent_id = parent.id
    )
    SELECT 1 FROM descendants WHERE id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'hierarchy_cycle';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_nodes_hierarchy_guard ON catalog_nodes;
CREATE TRIGGER catalog_nodes_hierarchy_guard
BEFORE INSERT OR UPDATE OF parent_id, node_type ON catalog_nodes
FOR EACH ROW EXECUTE FUNCTION validate_catalog_node_hierarchy();
