-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-077
-- @created: 2026-07-14
-- @description: Remapeia UUID central duplicado D&D/2024 para D&D/5e/2024.
-- IMPORTANTE: aplicar antes de apps/site migration 009.
-- BLOQUEANTE: só executar após backup completo, verificado e copiado off-VM.

DO $$
DECLARE
  old_id constant text := 'ac74d486-e3d3-4635-b7a0-7847f04050f5';
  new_id constant text := 'c3d31503-b4af-4663-af10-c1ef062102c3';
BEGIN
  UPDATE tables SET system_id = new_id::uuid WHERE system_id = old_id::uuid;

  -- Evita violar UNIQUE(user_id, system_id, type) quando o usuário já possui
  -- o destino e remove apenas a relação redundante com o nó duplicado.
  DELETE FROM user_systems old_link
  WHERE old_link.system_id = old_id::uuid
    AND EXISTS (
      SELECT 1 FROM user_systems new_link
      WHERE new_link.user_id = old_link.user_id
        AND new_link.system_id = new_id::uuid
        AND new_link.type IS NOT DISTINCT FROM old_link.type
    );
  UPDATE user_systems SET system_id = new_id::uuid WHERE system_id = old_id::uuid;

  UPDATE discord_import_table_drafts draft
  SET parsed_payload = jsonb_set(
    parsed_payload::jsonb,
    '{table,_system_candidates}',
    (
      SELECT jsonb_agg(candidate ORDER BY position)
      FROM (
        SELECT candidate, position,
          row_number() OVER (
            PARTITION BY candidate->>'system_id'
            ORDER BY is_existing_destination DESC, position
          ) AS candidate_rank
        FROM (
          SELECT CASE WHEN item->>'system_id' = old_id
            THEN jsonb_set(item, '{system_id}', to_jsonb(new_id), false)
            ELSE item END AS candidate,
            position,
            (item->>'system_id' = new_id)::integer AS is_existing_destination
          FROM jsonb_array_elements(parsed_payload::jsonb #> '{table,_system_candidates}')
            WITH ORDINALITY AS source(item, position)
        ) mapped
      ) ranked
      WHERE candidate_rank = 1
    ),
    false
  )
  WHERE parsed_payload::jsonb #> '{table,_system_candidates}' @> jsonb_build_array(jsonb_build_object('system_id', old_id));

  UPDATE discord_import_table_drafts
  SET parsed_payload = jsonb_set(parsed_payload::jsonb, '{table,system_id}', to_jsonb(new_id), false)
  WHERE parsed_payload::jsonb #>> '{table,system_id}' = old_id;

  UPDATE discord_import_table_drafts draft
  SET normalized_payload = jsonb_set(
    normalized_payload::jsonb,
    '{table,_system_candidates}',
    (
      SELECT jsonb_agg(candidate ORDER BY position)
      FROM (
        SELECT candidate, position,
          row_number() OVER (
            PARTITION BY candidate->>'system_id'
            ORDER BY is_existing_destination DESC, position
          ) AS candidate_rank
        FROM (
          SELECT CASE WHEN item->>'system_id' = old_id
            THEN jsonb_set(item, '{system_id}', to_jsonb(new_id), false)
            ELSE item END AS candidate,
            position,
            (item->>'system_id' = new_id)::integer AS is_existing_destination
          FROM jsonb_array_elements(normalized_payload::jsonb #> '{table,_system_candidates}')
            WITH ORDINALITY AS source(item, position)
        ) mapped
      ) ranked
      WHERE candidate_rank = 1
    ),
    false
  )
  WHERE normalized_payload IS NOT NULL
    AND normalized_payload::jsonb #> '{table,_system_candidates}' @> jsonb_build_array(jsonb_build_object('system_id', old_id));

  UPDATE discord_import_table_drafts
  SET normalized_payload = jsonb_set(normalized_payload::jsonb, '{table,system_id}', to_jsonb(new_id), false)
  WHERE normalized_payload IS NOT NULL
    AND normalized_payload::jsonb #>> '{table,system_id}' = old_id;

  UPDATE discord_field_learning
  SET output_value = jsonb_set(output_value, '{system_id}', to_jsonb(new_id), false),
      updated_at = now()
  WHERE field = 'system_entity' AND output_value->>'system_id' = old_id;

  UPDATE discord_learning_rules
  SET output_value = jsonb_set(output_value, '{system_id}', to_jsonb(new_id), false),
      updated_at = now()
  WHERE field = 'system_entity' AND output_value->>'system_id' = old_id;

  IF EXISTS (SELECT 1 FROM tables WHERE system_id = old_id::uuid)
     OR EXISTS (SELECT 1 FROM user_systems WHERE system_id = old_id::uuid)
     OR EXISTS (
       SELECT 1 FROM discord_import_table_drafts
       WHERE parsed_payload::jsonb #>> '{table,system_id}' = old_id
          OR normalized_payload::jsonb #>> '{table,system_id}' = old_id
          OR parsed_payload::jsonb #> '{table,_system_candidates}' @> jsonb_build_array(jsonb_build_object('system_id', old_id))
          OR normalized_payload::jsonb #> '{table,_system_candidates}' @> jsonb_build_array(jsonb_build_object('system_id', old_id))
     )
     OR EXISTS (SELECT 1 FROM discord_field_learning WHERE output_value->>'system_id' = old_id)
     OR EXISTS (SELECT 1 FROM discord_learning_rules WHERE output_value->>'system_id' = old_id) THEN
    RAISE EXCEPTION 'dnd_2024_reference_remap_incomplete';
  END IF;
END;
$$;
