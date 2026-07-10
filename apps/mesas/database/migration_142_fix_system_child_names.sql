-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-062
-- @created: 2026-07-09
-- @description: Corrige nomes contaminados de sistemas filhos importados com prefixo do pai, preservando apenas o nome proprio do no (I0b.3).

DO $$
DECLARE
  candidate_count integer;
  empty_name_count integer;
  updated_count integer;
BEGIN
  SELECT COUNT(*)
    INTO candidate_count
  FROM systems child
  JOIN systems parent ON parent.id = child.parent_id
  WHERE left(child.name, length(parent.name) + 1) = parent.name || ' '
    AND length(child.name) > length(parent.name) + 1
    AND btrim(substring(child.name FROM length(parent.name) + 2)) <> '';

  SELECT COUNT(*)
    INTO empty_name_count
  FROM systems child
  JOIN systems parent ON parent.id = child.parent_id
  WHERE left(child.name, length(parent.name) + 1) = parent.name || ' '
    AND length(child.name) > length(parent.name) + 1
    AND btrim(substring(child.name FROM length(parent.name) + 2)) = '';

  IF empty_name_count > 0 THEN
    RAISE EXCEPTION 'migration_142 abortada: % nomes ficariam vazios', empty_name_count;
  END IF;

  UPDATE systems AS target
  SET name = candidates.clean_name
  FROM (
    SELECT
      child.id,
      btrim(substring(child.name FROM length(parent.name) + 2)) AS clean_name
    FROM systems child
    JOIN systems parent ON parent.id = child.parent_id
    WHERE left(child.name, length(parent.name) + 1) = parent.name || ' '
      AND length(child.name) > length(parent.name) + 1
      AND btrim(substring(child.name FROM length(parent.name) + 2)) <> ''
  ) AS candidates
  WHERE target.id = candidates.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> candidate_count THEN
    RAISE EXCEPTION 'migration_142 abortada: candidatos % diferente de atualizados %', candidate_count, updated_count;
  END IF;

  RAISE NOTICE 'migration_142: % nomes de sistemas filhos corrigidos', updated_count;
END $$;
