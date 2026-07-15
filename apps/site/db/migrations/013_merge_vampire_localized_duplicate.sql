-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Une Vampire/Vampiro e preserva a tradução portuguesa no nó original.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  source_root constant text := '766a4b9b-3a7b-41fc-9a7d-c4127cfd79de';
  target_root constant text := 'bbae11a2-4506-42ee-bf47-85ed1b39ec31';
  source_5e constant text := 'ca3eefa4-2d35-42ab-b7bc-98a0fa117cb4';
  target_5e constant text := 'f4b26bf6-43fb-4309-a423-458fddf36fc8';
  next_version bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = source_root AND status = 'merged' AND merged_into_id = target_root
  ) AND EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = source_5e AND status = 'merged' AND merged_into_id = target_5e
  ) AND EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = target_root AND name = 'Vampire' AND name_pt = 'Vampiro'
  ) THEN
    RAISE NOTICE 'vampire_localized_merge_already_applied';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = source_root AND name = 'Vampiro' AND node_type = 'system'
      AND parent_id IS NULL AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = target_root AND name = 'Vampire' AND node_type = 'system'
      AND parent_id IS NULL AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = source_5e AND node_type = 'edition' AND parent_id = source_root
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog_nodes
    WHERE id = target_5e AND node_type = 'edition' AND parent_id = target_root
  ) THEN
    RAISE EXCEPTION 'vampire_localized_merge_precondition_failed';
  END IF;

  UPDATE catalog_nodes
  SET name_pt = 'Vampiro', updated_at = now(), version = version + 1
  WHERE id = target_root AND name_pt IS DISTINCT FROM 'Vampiro';

  INSERT INTO catalog_aliases (node_id, alias, locale, kind, created_by)
  VALUES (target_root, 'Vampiro', 'pt-BR', 'localized_name', 'spec-078')
  ON CONFLICT DO NOTHING;
  INSERT INTO catalog_aliases (node_id, alias, locale, kind, created_by)
  SELECT target_root, alias, locale, kind, created_by
  FROM catalog_aliases WHERE node_id = source_root
  ON CONFLICT DO NOTHING;
  DELETE FROM catalog_aliases WHERE node_id = source_root;

  INSERT INTO catalog_aliases (node_id, alias, locale, kind, created_by)
  SELECT target_5e, alias, locale, kind, created_by
  FROM catalog_aliases WHERE node_id = source_5e
  ON CONFLICT DO NOTHING;
  DELETE FROM catalog_aliases WHERE node_id = source_5e;

  UPDATE catalog_nodes
  SET parent_id = target_5e,
      path_slug = 'vampire/vampire--5e/' || canonical_slug,
      updated_at = now(), version = version + 1
  WHERE parent_id = source_5e;

  UPDATE catalog_nodes
  SET parent_id = target_root,
      name = CASE
        WHEN id = 'b75b40ff-92de-4dd3-b015-96c281b5ca33' THEN '1e'
        WHEN id = 'a87c669e-42d0-4df2-bfb8-21d8882e9e5f' THEN '2e'
        WHEN id = '606cee08-7de9-4bfb-90a9-c3453bed90c2' THEN 'Anniversary'
        ELSE name
      END,
      name_pt = CASE
        WHEN id = 'b75b40ff-92de-4dd3-b015-96c281b5ca33' THEN '1ª Edição'
        WHEN id = 'a87c669e-42d0-4df2-bfb8-21d8882e9e5f' THEN '2ª Edição'
        WHEN id = '606cee08-7de9-4bfb-90a9-c3453bed90c2' THEN 'Aniversário'
        ELSE name_pt
      END,
      path_slug = 'vampire/' || canonical_slug,
      updated_at = now(), version = version + 1
  WHERE parent_id = source_root AND id <> source_5e;

  UPDATE catalog_nodes
  SET path_slug = 'vampire/' || substr(path_slug, length('vampiro/') + 1),
      updated_at = now(), version = version + 1
  WHERE path_slug LIKE 'vampiro/%'
    AND id <> source_5e
    AND parent_id <> source_root;

  UPDATE catalog_nodes
  SET name_pt = 'Aniversário', updated_at = now(), version = version + 1
  WHERE name = 'Anniversary' AND name_pt IS DISTINCT FROM 'Aniversário';

  UPDATE catalog_legacy_mappings SET canonical_id = target_5e, updated_at = now()
  WHERE canonical_id = source_5e;
  UPDATE catalog_suggestions SET resolved_node_id = target_5e WHERE resolved_node_id = source_5e;
  INSERT INTO catalog_redirects (source_id, target_id, reason, created_by)
  VALUES (source_5e, target_5e, 'Vampire 5e duplicado sob raiz localizada', 'spec-078')
  ON CONFLICT (source_id) DO UPDATE SET target_id = EXCLUDED.target_id, reason = EXCLUDED.reason;
  UPDATE catalog_nodes
  SET status = 'merged', merged_into_id = target_5e, updated_at = now(), version = version + 1
  WHERE id = source_5e;

  UPDATE catalog_legacy_mappings SET canonical_id = target_root, updated_at = now()
  WHERE canonical_id = source_root;
  UPDATE catalog_suggestions SET resolved_node_id = target_root WHERE resolved_node_id = source_root;
  INSERT INTO catalog_redirects (source_id, target_id, reason, created_by)
  VALUES (source_root, target_root, 'Vampiro é nome português de Vampire', 'spec-078')
  ON CONFLICT (source_id) DO UPDATE SET target_id = EXCLUDED.target_id, reason = EXCLUDED.reason;
  UPDATE catalog_nodes
  SET status = 'merged', merged_into_id = target_root, updated_at = now(), version = version + 1
  WHERE id = source_root;

  LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
  INSERT INTO catalog_versions (version, reason, created_by)
  VALUES (next_version, 'spec078_vampire_localized_merge', 'spec-078');
  INSERT INTO catalog_audit_events (node_id, event_type, payload, catalog_version)
  VALUES (source_root, 'catalog_localized_duplicate_merged', jsonb_build_object(
    'source_id', source_root, 'target_id', target_root,
    'source_5e_id', source_5e, 'target_5e_id', target_5e
  ), next_version);
END;
$$;
