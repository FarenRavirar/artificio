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
UPDATE catalog_nodes
SET node_type = 'edition', updated_at = now(), version = version + 1
WHERE id = 'd8251bc2-c5f5-4bf7-98c7-dacf431e07de'
  AND node_type = 'variant'
  AND parent_id = '36698ed7-2d51-4edb-95ea-b1fcddd1e9c9';

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
    IF EXISTS (SELECT 1 FROM catalog_nodes WHERE parent_id = NEW.id) THEN
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
