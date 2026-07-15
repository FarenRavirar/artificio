-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Remove quatro UUIDs órfãos antes da hidratação Mesas Prod para Beta.

UPDATE tables
SET system_id = NULL,
    updated_at = NOW()
WHERE system_id IN (
  '07a4e87b-5c98-4be7-864f-686e01193cd7',
  '10f78c36-ab50-48c9-ae26-bcbc88a049e3'
);

UPDATE user_preferences
SET systems = array_remove(
  array_remove(systems, '88616b7d-36da-48df-b04c-50bfaa738c73'::uuid),
  'e14a9dcf-c2b0-4d8c-be96-0b2569afec24'::uuid
),
updated_at = NOW()
WHERE systems && ARRAY[
  '88616b7d-36da-48df-b04c-50bfaa738c73'::uuid,
  'e14a9dcf-c2b0-4d8c-be96-0b2569afec24'::uuid
];
