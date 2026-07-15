-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Promove os 16 sistemas/edições exclusivos do Mesas Beta ao catálogo Central.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  next_version bigint;
  inserted_count integer;
  affected integer;
  changed boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = '3dcc4d63-a3d7-45de-b7f4-0f313b71d6ab')
     OR NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = '36698ed7-2d51-4edb-95ea-b1fcddd1e9c9')
     OR NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = '34106f28-795a-4444-b6d5-d2b4f64af1cd')
     OR NOT EXISTS (SELECT 1 FROM catalog_nodes WHERE id = 'fe9cc052-3824-4aec-853e-4141c540f3ce') THEN
    RAISE EXCEPTION 'beta_extra_parent_precondition_failed';
  END IF;

  INSERT INTO catalog_nodes (
    id, parent_id, node_type, canonical_slug, path_slug, name, name_pt,
    description, status, version, created_by, updated_by
  ) VALUES
    ('16725340-8869-426d-8a8e-52f6d97d41d7', NULL, 'system', 'assimilacao', 'assimilacao', 'Assimilação', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('95ad88eb-5ca2-41cf-9425-534a7b1a5446', NULL, 'system', 'cosmere-rpg', 'cosmere-rpg', 'Cosmere RPG', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('4d5031f9-d52f-46a0-9695-011972520a23', NULL, 'system', 'cultos-inominaveis', 'cultos-inominaveis', 'Cultos Inomináveis', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('16e3aa1a-1a2c-410c-9dd7-928ce4715fc0', NULL, 'system', 'flechas-e-magias', 'flechas-e-magias', 'Flechas e Magias', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('28294d3b-a1f8-40a1-8971-fe9ecd2f74fa', NULL, 'system', 'malditos-goblins', 'malditos-goblins', 'Malditos Goblins', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('bbe9700c-e66f-4608-94fd-dc6989786f43', NULL, 'system', 'one-two-six', 'one-two-six', 'One Two Six', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('feb6db72-0878-40e1-8663-e5c77694c3fa', NULL, 'system', 'pokemon-rpg', 'pokemon-rpg', 'Pokémon RPG', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('d694f060-cc52-49ec-b1f3-55a5bf8ac9ef', NULL, 'system', 'pokerole', 'pokerole', 'Pokerole', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('8f340611-5995-4a44-9cb7-5b1469935453', NULL, 'system', 'runarcana', 'runarcana', 'Runarcana', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('25fdea07-8331-4ab1-9af3-db6f49c1a23f', NULL, 'system', 'sacramento', 'sacramento', 'Sacramento', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('6465ff64-4cec-44bd-9bac-066b81f6b43c', NULL, 'system', 'the-witcher-rpg', 'the-witcher-rpg', 'The Witcher RPG', NULL, NULL, 'active', 1, 'spec-078', 'spec-078')
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  changed := inserted_count > 0;

  INSERT INTO catalog_nodes (
    id, parent_id, node_type, canonical_slug, path_slug, name, name_pt,
    description, status, version, created_by, updated_by
  ) VALUES
    ('20f0522c-f1dd-4bcb-abb6-81c8a8964991', '3dcc4d63-a3d7-45de-b7f4-0f313b71d6ab', 'edition', 'cain-rpg--1-3', 'cain-rpg/cain-rpg--1-3', '1.3', NULL, NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('304e4f8d-8eb7-4647-80db-64e79b4aa2f9', '36698ed7-2d51-4edb-95ea-b1fcddd1e9c9', 'edition', 'dungeons-dragons--3e', 'dungeons-dragons/dungeons-dragons--3e', '3e', '3ª Edição', NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('fc08c48a-bc4f-4fa9-bf42-c8a182898b24', 'd694f060-cc52-49ec-b1f3-55a5bf8ac9ef', 'edition', 'pokerole--3e', 'pokerole/pokerole--3e', '3e', '3ª Edição', NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('bfb7652d-03b4-4d95-857f-524d8e98ec0b', '34106f28-795a-4444-b6d5-d2b4f64af1cd', 'edition', 'starfinder-roleplaying-game--2e', 'starfinder-roleplaying-game/starfinder-roleplaying-game--2e', '2e', '2ª Edição', NULL, 'active', 1, 'spec-078', 'spec-078'),
    ('82d05c28-599b-49cc-aa03-841898430c88', 'fe9cc052-3824-4aec-853e-4141c540f3ce', 'edition', 'the-one-ring-roleplaying-game--2e', 'the-one-ring-roleplaying-game/the-one-ring-roleplaying-game--2e', '2e', '2ª Edição', NULL, 'active', 1, 'spec-078', 'spec-078')
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  inserted_count := inserted_count + affected;
  changed := changed OR affected > 0;

  IF (SELECT count(*) FROM catalog_nodes WHERE id IN (
      '16725340-8869-426d-8a8e-52f6d97d41d7', '20f0522c-f1dd-4bcb-abb6-81c8a8964991',
      '95ad88eb-5ca2-41cf-9425-534a7b1a5446', '4d5031f9-d52f-46a0-9695-011972520a23',
      '304e4f8d-8eb7-4647-80db-64e79b4aa2f9', '16e3aa1a-1a2c-410c-9dd7-928ce4715fc0',
      '28294d3b-a1f8-40a1-8971-fe9ecd2f74fa', 'bbe9700c-e66f-4608-94fd-dc6989786f43',
      'feb6db72-0878-40e1-8663-e5c77694c3fa', 'd694f060-cc52-49ec-b1f3-55a5bf8ac9ef',
      'fc08c48a-bc4f-4fa9-bf42-c8a182898b24', '8f340611-5995-4a44-9cb7-5b1469935453',
      '25fdea07-8331-4ab1-9af3-db6f49c1a23f', 'bfb7652d-03b4-4d95-857f-524d8e98ec0b',
      '82d05c28-599b-49cc-aa03-841898430c88', '6465ff64-4cec-44bd-9bac-066b81f6b43c'
    )) <> 16 THEN
    RAISE EXCEPTION 'beta_extra_promotion_state_diverged';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('16725340-8869-426d-8a8e-52f6d97d41d7', NULL::text, 'system', 'assimilacao', 'assimilacao', 'Assimilação', NULL::text),
      ('95ad88eb-5ca2-41cf-9425-534a7b1a5446', NULL, 'system', 'cosmere-rpg', 'cosmere-rpg', 'Cosmere RPG', NULL),
      ('4d5031f9-d52f-46a0-9695-011972520a23', NULL, 'system', 'cultos-inominaveis', 'cultos-inominaveis', 'Cultos Inomináveis', NULL),
      ('16e3aa1a-1a2c-410c-9dd7-928ce4715fc0', NULL, 'system', 'flechas-e-magias', 'flechas-e-magias', 'Flechas e Magias', NULL),
      ('28294d3b-a1f8-40a1-8971-fe9ecd2f74fa', NULL, 'system', 'malditos-goblins', 'malditos-goblins', 'Malditos Goblins', NULL),
      ('bbe9700c-e66f-4608-94fd-dc6989786f43', NULL, 'system', 'one-two-six', 'one-two-six', 'One Two Six', NULL),
      ('feb6db72-0878-40e1-8663-e5c77694c3fa', NULL, 'system', 'pokemon-rpg', 'pokemon-rpg', 'Pokémon RPG', NULL),
      ('d694f060-cc52-49ec-b1f3-55a5bf8ac9ef', NULL, 'system', 'pokerole', 'pokerole', 'Pokerole', NULL),
      ('8f340611-5995-4a44-9cb7-5b1469935453', NULL, 'system', 'runarcana', 'runarcana', 'Runarcana', NULL),
      ('25fdea07-8331-4ab1-9af3-db6f49c1a23f', NULL, 'system', 'sacramento', 'sacramento', 'Sacramento', NULL),
      ('6465ff64-4cec-44bd-9bac-066b81f6b43c', NULL, 'system', 'the-witcher-rpg', 'the-witcher-rpg', 'The Witcher RPG', NULL),
      ('20f0522c-f1dd-4bcb-abb6-81c8a8964991', '3dcc4d63-a3d7-45de-b7f4-0f313b71d6ab', 'edition', 'cain-rpg--1-3', 'cain-rpg/cain-rpg--1-3', '1.3', NULL),
      ('304e4f8d-8eb7-4647-80db-64e79b4aa2f9', '36698ed7-2d51-4edb-95ea-b1fcddd1e9c9', 'edition', 'dungeons-dragons--3e', 'dungeons-dragons/dungeons-dragons--3e', '3e', '3ª Edição'),
      ('fc08c48a-bc4f-4fa9-bf42-c8a182898b24', 'd694f060-cc52-49ec-b1f3-55a5bf8ac9ef', 'edition', 'pokerole--3e', 'pokerole/pokerole--3e', '3e', '3ª Edição'),
      ('bfb7652d-03b4-4d95-857f-524d8e98ec0b', '34106f28-795a-4444-b6d5-d2b4f64af1cd', 'edition', 'starfinder-roleplaying-game--2e', 'starfinder-roleplaying-game/starfinder-roleplaying-game--2e', '2e', '2ª Edição'),
      ('82d05c28-599b-49cc-aa03-841898430c88', 'fe9cc052-3824-4aec-853e-4141c540f3ce', 'edition', 'the-one-ring-roleplaying-game--2e', 'the-one-ring-roleplaying-game/the-one-ring-roleplaying-game--2e', '2e', '2ª Edição')
    ) AS expected(id, parent_id, node_type, canonical_slug, path_slug, name, name_pt)
    LEFT JOIN catalog_nodes actual ON actual.id = expected.id
    WHERE actual.id IS NULL OR actual.parent_id IS DISTINCT FROM expected.parent_id
      OR actual.node_type IS DISTINCT FROM expected.node_type
      OR actual.canonical_slug IS DISTINCT FROM expected.canonical_slug
      OR actual.path_slug IS DISTINCT FROM expected.path_slug
      OR actual.name IS DISTINCT FROM expected.name
      OR actual.name_pt IS DISTINCT FROM expected.name_pt
      OR actual.status IS DISTINCT FROM 'active'
  ) THEN
    RAISE EXCEPTION 'beta_extra_promotion_state_diverged';
  END IF;

  INSERT INTO catalog_aliases (node_id, alias, locale, kind, created_by) VALUES
    ('16725340-8869-426d-8a8e-52f6d97d41d7', 'Assimilação RPG', 'pt-BR', 'alias', 'spec-078'),
    ('16e3aa1a-1a2c-410c-9dd7-928ce4715fc0', 'F&M', NULL, 'abbreviation', 'spec-078'),
    ('16e3aa1a-1a2c-410c-9dd7-928ce4715fc0', 'FeM', NULL, 'abbreviation', 'spec-078'),
    ('bbe9700c-e66f-4608-94fd-dc6989786f43', 'On-Two-Six', NULL, 'alias', 'spec-078'),
    ('feb6db72-0878-40e1-8663-e5c77694c3fa', 'Pokémon', NULL, 'alias', 'spec-078'),
    ('fc08c48a-bc4f-4fa9-bf42-c8a182898b24', 'Pokerole 3.0', NULL, 'alias', 'spec-078'),
    ('304e4f8d-8eb7-4647-80db-64e79b4aa2f9', 'D&D 3e', NULL, 'alias', 'spec-078'),
    ('304e4f8d-8eb7-4647-80db-64e79b4aa2f9', 'DnD 3e', NULL, 'alias', 'spec-078'),
    ('bfb7652d-03b4-4d95-857f-524d8e98ec0b', 'Starfinder 2e', NULL, 'alias', 'spec-078'),
    ('82d05c28-599b-49cc-aa03-841898430c88', 'O Um Anel 2e', 'pt-BR', 'localized_name', 'spec-078'),
    ('6465ff64-4cec-44bd-9bac-066b81f6b43c', 'The Witcher TRPG', NULL, 'alias', 'spec-078'),
    ('6465ff64-4cec-44bd-9bac-066b81f6b43c', 'TWRPG', NULL, 'abbreviation', 'spec-078')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  changed := changed OR affected > 0;

  IF changed THEN
    LOCK TABLE catalog_versions IN SHARE ROW EXCLUSIVE MODE;
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM catalog_versions;
    INSERT INTO catalog_versions (version, reason, created_by)
    VALUES (next_version, 'spec078_promote_beta_extras', 'spec-078');
    INSERT INTO catalog_audit_events (event_type, payload, catalog_version)
    VALUES ('catalog_beta_extras_promoted', jsonb_build_object('count', 16), next_version);
  END IF;
END;
$$;
