-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Adiciona Victory como edição filha de 3D&T com aliases observados nos anúncios.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  v_parent_id constant text := '56799362-2d6b-44bf-8fe5-64b98c5fc577';
  victory_id constant text := '7c1eed17-d430-4efe-a66b-b01a097cbd17';
  changed boolean := false;
  next_version bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = v_parent_id AND node_type = 'system' AND path_slug = '3d-t'
  ) THEN
    RAISE EXCEPTION '3det_victory_parent_precondition_failed';
  END IF;

  IF EXISTS (SELECT 1 FROM catalog_nodes node WHERE node.path_slug = '3d-t/victory' AND node.id <> victory_id)
    OR EXISTS (SELECT 1 FROM catalog_nodes node WHERE node.id = victory_id AND (
      node.parent_id IS DISTINCT FROM '56799362-2d6b-44bf-8fe5-64b98c5fc577'
      OR node.node_type <> 'edition'
      OR node.path_slug <> '3d-t/victory'
    )) THEN
    RAISE EXCEPTION '3det_victory_conflicting_node';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = victory_id) THEN
    INSERT INTO catalog_nodes (
      id, parent_id, node_type, canonical_slug, path_slug, name, status,
      version, created_by, updated_by
    ) VALUES (
      victory_id, v_parent_id, 'edition', 'victory', '3d-t/victory', 'Victory', 'active',
      1, 'spec-078', 'spec-078'
    );
    changed := true;
  END IF;

  INSERT INTO catalog_aliases (node_id, alias, kind, created_by)
  VALUES
    (v_parent_id, '3DeT', 'alias', 'spec-078'),
    (victory_id, '3D&T Victory', 'alias', 'spec-078'),
    (victory_id, '3DeT Victory', 'alias', 'spec-078')
  ON CONFLICT DO NOTHING;
  IF FOUND THEN changed := true; END IF;

  IF changed THEN
    LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
    INSERT INTO catalog_versions (version, reason, created_by)
    VALUES (next_version, 'catalog_3det_victory_added', 'spec-078');
    INSERT INTO catalog_audit_events (node_id, event_type, payload, catalog_version)
    VALUES (victory_id, 'catalog_node_created', jsonb_build_object(
      'parent_id', v_parent_id, 'reason', 'real Discord announcement evidence'
    ), next_version);
  END IF;
END;
$$;
