-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-077
-- @created: 2026-07-14
-- @description: Une D&D/2024 duplicado à variante D&D/5e/2024.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

-- Merge decidido pelo mantenedor: 2024 é variante filha de D&D 5e, não edição.
-- Pré-condição operacional: Mesas migration 148 já remapeou referências externas.

DO $$
DECLARE
  v_source_id constant text := 'ac74d486-e3d3-4635-b7a0-7847f04050f5';
  v_target_id constant text := 'c3d31503-b4af-4663-af10-c1ef062102c3';
  source_ok boolean;
  target_ok boolean;
  already_merged boolean;
  next_version bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = v_source_id)
     OR NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = v_target_id) THEN
    RAISE NOTICE 'dnd_2024_merge_not_applicable_in_this_environment';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM catalog_nodes source
    WHERE source.id = v_source_id
      AND source.status = 'merged'
      AND source.merged_into_id = v_target_id
      AND EXISTS (
        SELECT 1 FROM catalog_redirects redirect
        WHERE redirect.source_id = v_source_id AND redirect.target_id = v_target_id
      )
  ) INTO already_merged;
  IF already_merged THEN
    RAISE NOTICE 'dnd_2024_merge_already_applied';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = v_source_id AND name = '2024' AND node_type = 'edition'
      AND parent_id = '36698ed7-2d51-4edb-95ea-b1fcddd1e9c9'
      AND status <> 'merged' AND merged_into_id IS NULL
  ) INTO source_ok;
  SELECT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = v_target_id AND name = '2024' AND node_type = 'variant'
      AND parent_id = 'c324b0de-7dda-4a9c-9109-d8b47c04ffd8'
  ) INTO target_ok;

  IF NOT source_ok OR NOT target_ok THEN
    RAISE EXCEPTION 'dnd_2024_merge_precondition_failed';
  END IF;
  IF EXISTS (SELECT 1 FROM catalog_nodes WHERE parent_id = v_source_id) THEN
    RAISE EXCEPTION 'dnd_2024_source_has_children';
  END IF;

  UPDATE catalog_legacy_mappings SET canonical_id = v_target_id, updated_at = now()
  WHERE canonical_id = v_source_id;
  UPDATE catalog_suggestions SET resolved_node_id = v_target_id WHERE resolved_node_id = v_source_id;

  INSERT INTO catalog_aliases (node_id, alias, locale, kind, created_by)
  SELECT v_target_id, source.alias, source.locale, source.kind, source.created_by
  FROM catalog_aliases source
  WHERE source.node_id = v_source_id
  ON CONFLICT DO NOTHING;
  DELETE FROM catalog_aliases WHERE node_id = v_source_id;

  INSERT INTO catalog_redirects (source_id, target_id, reason)
  VALUES (v_source_id, v_target_id, 'D&D 2024 reclassificado como variante de 5e')
  ON CONFLICT (source_id) DO UPDATE SET target_id = EXCLUDED.target_id, reason = EXCLUDED.reason;

  UPDATE catalog_nodes
  SET status = 'merged', merged_into_id = v_target_id, updated_at = now(), version = version + 1
  WHERE id = v_source_id;

  LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
  INSERT INTO catalog_versions (version, reason) VALUES (next_version, 'catalog_node_reclassified');
  INSERT INTO catalog_audit_events (node_id, event_type, payload, catalog_version)
  VALUES (v_source_id, 'catalog_node_reclassified', jsonb_build_object(
    'source_id', v_source_id, 'target_id', v_target_id,
    'reason', '2024 is variant of D&D 5e'
  ), next_version);
END;
$$;
