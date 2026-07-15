-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Registra identidades Beta curadas e aliases CAIN/Mutants para projeção canônica.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  changed boolean := false;
  affected integer;
  mapping_count integer;
  alias_count integer;
  next_version bigint;
BEGIN
  CREATE TEMP TABLE spec078_identity_mapping (
    legacy_id text PRIMARY KEY,
    canonical_id text NOT NULL,
    source_path_slug text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO spec078_identity_mapping VALUES
    ('169b6b26-f82b-429e-9acd-05e7138688a9', '7c1eed17-d430-4efe-a66b-b01a097cbd17', '3d-t/3det-victory'),
    ('76a95222-8f62-49cb-a621-df3e292dbf96', '3dcc4d63-a3d7-45de-b7f4-0f313b71d6ab', 'cain'),
    ('6da195f3-e949-4db5-a4b2-397859e37022', '9da8691f-63e0-4136-a827-56b13e6bcd28', 'call-of-cthulhu/7e'),
    ('677d5650-574e-420d-964f-419e775da3cb', '8e430636-7732-4f3c-bbfa-52162d0fbb1b', 'dungeons-dragons/dungeons-dragons-4e'),
    ('405ff13e-f1e4-4b92-915d-4e5b343624d3', 'c324b0de-7dda-4a9c-9109-d8b47c04ffd8', 'dungeons-dragons/dungeons-dragons-5e'),
    ('c488301a-ac16-4275-9f85-c9bf76a2b119', '4f85d61e-c843-4a03-a81f-0564eeb6aba7', 'dungeons-dragons/dungeons-dragons-5e/dungeons-dragons-2014'),
    ('230bed63-b5af-4aa6-8220-99bfdbdc4696', 'c3d31503-b4af-4663-af10-c1ef062102c3', 'dungeons-dragons/dungeons-dragons-5e/dungeons-dragons-2024'),
    ('3b94f3df-fd3a-4dd0-a81b-0557e118ab45', 'fc9887fa-0b71-47bc-8f62-fac9001be272', 'mutants-masterminds/mutants-and-masterminds'),
    ('2b701e77-c6af-48fa-baf7-344c54deff31', 'be2e5244-057f-4617-a5df-c1798805b23a', 'tormenta/tormenta-20');

  IF EXISTS (
    SELECT 1 FROM spec078_identity_mapping mapping
    LEFT JOIN catalog_nodes node ON node.id = mapping.canonical_id
    WHERE node.id IS NULL
  ) THEN
    RAISE EXCEPTION 'spec078_identity_mapping_target_missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM spec078_identity_mapping expected
    JOIN catalog_legacy_mappings current
      ON current.source_app = 'mesas'
     AND current.source_environment = 'prod'
     AND current.source_table = 'systems'
     AND current.legacy_id = expected.legacy_id
    WHERE current.canonical_id <> expected.canonical_id
  ) THEN
    RAISE EXCEPTION 'spec078_identity_mapping_conflicts_existing';
  END IF;

  INSERT INTO catalog_legacy_mappings (
    source_app, source_environment, source_table, legacy_id, canonical_id,
    source_path_slug, source_payload, checksum
  )
  SELECT 'mesas', 'prod', 'systems', legacy_id, canonical_id, source_path_slug,
    jsonb_build_object('decision', 'D115/spec-078'), md5(legacy_id || ':' || canonical_id)
  FROM spec078_identity_mapping
  ON CONFLICT (source_app, source_environment, source_table, legacy_id)
  DO UPDATE SET
    canonical_id = EXCLUDED.canonical_id,
    source_path_slug = EXCLUDED.source_path_slug,
    source_payload = EXCLUDED.source_payload,
    checksum = EXCLUDED.checksum,
    updated_at = now()
  WHERE catalog_legacy_mappings.canonical_id IS DISTINCT FROM EXCLUDED.canonical_id
     OR catalog_legacy_mappings.source_path_slug IS DISTINCT FROM EXCLUDED.source_path_slug
     OR catalog_legacy_mappings.source_payload IS DISTINCT FROM EXCLUDED.source_payload
     OR catalog_legacy_mappings.checksum IS DISTINCT FROM EXCLUDED.checksum;
  GET DIAGNOSTICS affected = ROW_COUNT;
  mapping_count := affected;
  changed := mapping_count > 0;

  INSERT INTO catalog_aliases (node_id, alias, kind, created_by)
  VALUES
    ('3dcc4d63-a3d7-45de-b7f4-0f313b71d6ab', 'CAIN', 'abbreviation', 'spec-078'),
    ('fc9887fa-0b71-47bc-8f62-fac9001be272', 'Mutants And Masterminds', 'alias', 'spec-078')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  alias_count := affected;
  changed := changed OR alias_count > 0;

  IF changed THEN
    LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
    INSERT INTO catalog_versions (version, reason, created_by)
    VALUES (next_version, 'spec078_beta_identity_mappings', 'spec-078');
    INSERT INTO catalog_audit_events (event_type, payload, catalog_version)
    VALUES ('catalog_identity_mappings_added', jsonb_build_object(
      'mapping_count', mapping_count,
      'alias_count', alias_count,
      'decision', 'D115'
    ), next_version);
  END IF;
END;
$$;
