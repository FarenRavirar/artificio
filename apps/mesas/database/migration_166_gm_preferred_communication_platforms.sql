-- @class: online-safe
-- @requires-backup: false
-- @author: spec-100
-- @created: 2026-09-04
-- @description: perfil do mestre passa a declarar plataformas de comunicacao preferidas

-- Par simetrico de `preferred_vtt_platforms` (migration_111): o perfil ja dizia
-- em QUE VTT o mestre joga, mas nao POR ONDE se fala com a mesa. A tabela
-- `communication_platforms` (migration_105) e a rota publica
-- `GET /api/v1/communication-platforms` ja existiam e ja eram consumidas pelo
-- editor de mesa (`tables.communication_platform_id`) — o que faltava era a
-- coluna no perfil. Achado do mantenedor em 2026-09-04: no editor de perfil
-- nao havia onde informar Discord/Meet/Teams, embora o rascunho da mesa ja
-- resolvesse isso.
--
-- Mesma forma da coluna irma, medida antes de escrever (`information_schema`:
-- `UUID[]`, nullable, `DEFAULT '{}'::uuid[]`): array de UUID em vez de tabela
-- de juncao, sem FK — e a escolha que `preferred_vtt_platforms` ja fez, e
-- divergir aqui criaria dois modelos para o mesmo conceito no mesmo perfil.

-- 1. Mudancas
ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS preferred_communication_platforms UUID[] DEFAULT '{}';

COMMENT ON COLUMN gm_profiles.preferred_communication_platforms IS
  'Array de IDs de communication_platforms que o mestre usa nas mesas (Discord, Meet, Teams...) - exibido no perfil publico junto das VTTs';

-- GIN: mesma estrategia de indice da coluna irma, para busca por elemento do array
CREATE INDEX IF NOT EXISTS idx_gm_profiles_preferred_communication_platforms
  ON gm_profiles USING GIN (preferred_communication_platforms);

-- 2. Validacao: falha alto se a coluna nao existir ao final
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gm_profiles'
      AND column_name = 'preferred_communication_platforms'
  ) THEN
    RAISE EXCEPTION 'Migration 166 failed: coluna preferred_communication_platforms nao criada';
  END IF;
END $$;
