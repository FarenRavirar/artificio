-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Adiciona aliases inequívocos observados nos anúncios reais do Discord.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  old_school_essentials_id constant text := 'db8b7864-b6c7-4232-9db2-9f4ae357beac';
  vampire_5e_id constant text := 'ca3eefa4-2d35-42ab-b7bc-98a0fa117cb4';
  werewolf_id constant text := '39dc9a14-47b6-4df1-996d-3c686b9bf87c';
  changed boolean := false;
  next_version bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM catalog_nodes WHERE id = old_school_essentials_id
      AND node_type = 'system' AND name = 'Old-School Essentials'
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog_nodes WHERE id = vampire_5e_id
      AND node_type = 'edition' AND name = 'Vampire 5e'
  ) OR NOT EXISTS (
    SELECT 1 FROM catalog_nodes WHERE id = werewolf_id
      AND node_type = 'system' AND name = 'Werewolf'
  ) THEN
    RAISE EXCEPTION 'real_announcement_alias_precondition_failed';
  END IF;

  INSERT INTO catalog_aliases (node_id, alias, kind, created_by)
  VALUES
    (old_school_essentials_id, 'OSE', 'abbreviation', 'spec-078'),
    (vampire_5e_id, 'V5', 'abbreviation', 'spec-078'),
    (werewolf_id, 'Lobisomem: O Apocalipse', 'localized_name', 'spec-078'),
    (werewolf_id, 'Lobisomem o Apocalipse', 'localized_name', 'spec-078')
  ON CONFLICT DO NOTHING;
  IF FOUND THEN changed := true; END IF;

  IF changed THEN
    LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
    INSERT INTO catalog_versions (version, reason, created_by)
    VALUES (next_version, 'real_announcement_aliases_added', 'spec-078');
    INSERT INTO catalog_audit_events (event_type, payload, catalog_version)
    VALUES ('catalog_aliases_added', jsonb_build_object(
      'node_ids', jsonb_build_array(old_school_essentials_id, vampire_5e_id, werewolf_id),
      'reason', 'real Discord announcement evidence'
    ), next_version);
  END IF;
END;
$$;
