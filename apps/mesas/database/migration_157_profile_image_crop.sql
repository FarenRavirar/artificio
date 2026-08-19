-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090-imagem-perfil
-- @created: 2026-08-18
-- @description: enquadramento e dimensoes de avatar/banner de perfil, para recorte nao-destrutivo na exibicao

-- CONTEXTO
-- Ate 2026-08-18 todo upload era recortado no servidor em 1200x650 com
-- `crop: 'fill'`, inclusive avatar. O arquivo original era descartado e o
-- enquadramento nao podia ser reajustado. Medido em producao: avatar de mestre
-- gravado 1200x650, com topo e base da imagem perdidos.
--
-- O upload passa a preservar a imagem inteira (`crop: 'limit'`) e o
-- enquadramento vira DADO de exibicao: as colunas abaixo guardam o retangulo
-- escolhido pelo dono e as dimensoes do arquivo armazenado, que juntos viram
-- `object-position` no CSS. Reversivel e reajustavel quantas vezes quiser.
--
-- Espelha `tables.banner_crop_data` (migration 101), mesmo formato JSONB
-- {x, y, width, height} em pixels da imagem armazenada.

-- Avatar do mestre (foto do perfil publico, sempre exibida 1:1).
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS avatar_crop_data JSONB;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS avatar_width INTEGER;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS avatar_height INTEGER;

-- Banner do perfil de mestre. A coluna `banner_url` ja existia e ja era aceita
-- pelo backend, mas nao havia campo na UI nem enquadramento associado.
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS banner_crop_data JSONB;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS banner_width INTEGER;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS banner_height INTEGER;

-- Avatar do perfil geral (aba "Geral"), usado como padrao quando o mestre nao
-- define foto propria de mestre.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_crop_data JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_width INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_height INTEGER;

-- Dimensoes do banner de mesa. A coluna `banner_crop_data` existe desde a
-- migration 101, mas sem as dimensoes do arquivo o retangulo nao podia ser
-- convertido em `object-position` — por isso o recorte salvo nunca era
-- aplicado na exibicao.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS banner_width INTEGER;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS banner_height INTEGER;

COMMENT ON COLUMN gm_profiles.avatar_crop_data IS 'Retangulo de recorte {x, y, width, height} em pixels da imagem armazenada; vira object-position na exibicao 1:1';
COMMENT ON COLUMN gm_profiles.avatar_width IS 'Largura em pixels do avatar armazenado; necessaria para converter avatar_crop_data em object-position';
COMMENT ON COLUMN gm_profiles.avatar_height IS 'Altura em pixels do avatar armazenado; necessaria para converter avatar_crop_data em object-position';
COMMENT ON COLUMN gm_profiles.banner_crop_data IS 'Retangulo de recorte {x, y, width, height} em pixels do banner de perfil armazenado';
COMMENT ON COLUMN profiles.avatar_crop_data IS 'Retangulo de recorte {x, y, width, height} em pixels do avatar geral armazenado';
COMMENT ON COLUMN tables.banner_width IS 'Largura em pixels do banner armazenado; necessaria para aplicar banner_crop_data (migration 101) na exibicao';
COMMENT ON COLUMN tables.banner_height IS 'Altura em pixels do banner armazenado; necessaria para aplicar banner_crop_data (migration 101) na exibicao';
