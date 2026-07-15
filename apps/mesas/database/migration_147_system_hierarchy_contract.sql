-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-077
-- @created: 2026-07-14
-- @description: Fecha a taxonomia em system -> edition -> variant.

-- Nunca reclassificar automaticamente: nomes não determinam semântica. Se algum
-- ambiente ainda possui legado ou parentesco inválido, a curadoria deve decidir.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM systems child
    LEFT JOIN systems parent ON parent.id = child.parent_id
    WHERE child.node_type NOT IN ('system', 'edition', 'variant')
       OR (child.node_type = 'system' AND (child.parent_id IS NOT NULL OR child.depth <> 0))
       OR (child.node_type = 'edition' AND (parent.node_type IS DISTINCT FROM 'system' OR child.depth <> 1))
       OR (child.node_type = 'variant' AND (parent.node_type IS DISTINCT FROM 'edition' OR child.depth <> 2))
  ) THEN
    RAISE EXCEPTION 'legacy_or_invalid_system_hierarchy_requires_manual_curatorship';
  END IF;

  IF EXISTS (
    SELECT 1 FROM system_suggestions
    WHERE node_type NOT IN ('system', 'edition', 'variant')
  ) THEN
    RAISE EXCEPTION 'legacy_system_suggestion_type_requires_manual_curatorship';
  END IF;
END;
$$;

ALTER TABLE systems DROP CONSTRAINT IF EXISTS systems_node_type_check;
ALTER TABLE systems DROP CONSTRAINT IF EXISTS systems_hierarchy_shape_check;
ALTER TABLE systems
  ADD CONSTRAINT systems_node_type_check
    CHECK (node_type IN ('system', 'edition', 'variant')),
  ADD CONSTRAINT systems_hierarchy_shape_check
    CHECK (
      (node_type = 'system' AND parent_id IS NULL AND depth = 0)
      OR (node_type = 'edition' AND parent_id IS NOT NULL AND depth = 1)
      OR (node_type = 'variant' AND parent_id IS NOT NULL AND depth = 2)
    );

ALTER TABLE system_suggestions DROP CONSTRAINT IF EXISTS system_suggestions_node_type_check;
ALTER TABLE system_suggestions
  ADD CONSTRAINT system_suggestions_node_type_check
    CHECK (node_type IN ('system', 'edition', 'variant'));

CREATE OR REPLACE FUNCTION validate_system_hierarchy_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_type text;
BEGIN
  IF NEW.node_type = 'system' THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'system_hierarchy_cycle';
  END IF;

  SELECT node_type INTO parent_type FROM systems WHERE id = NEW.parent_id;
  IF parent_type IS NULL THEN
    RAISE EXCEPTION 'system_parent_not_found';
  END IF;
  IF NEW.node_type = 'edition' AND parent_type <> 'system' THEN
    RAISE EXCEPTION 'edition_parent_must_be_system';
  END IF;
  IF NEW.node_type = 'variant' AND parent_type <> 'edition' THEN
    RAISE EXCEPTION 'variant_parent_must_be_edition';
  END IF;

  IF EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT id FROM systems WHERE parent_id = NEW.id
      UNION ALL
      SELECT child.id
      FROM systems child
      JOIN descendants parent ON child.parent_id = parent.id
    )
    SELECT 1 FROM descendants WHERE id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'system_hierarchy_cycle';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS systems_hierarchy_contract_guard ON systems;
CREATE TRIGGER systems_hierarchy_contract_guard
BEFORE INSERT OR UPDATE OF parent_id, node_type, depth ON systems
FOR EACH ROW EXECUTE FUNCTION validate_system_hierarchy_contract();
