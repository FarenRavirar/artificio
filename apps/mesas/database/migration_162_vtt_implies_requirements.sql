-- @class: online-safe
-- @requires-backup: false
-- @author: spec-096
-- @created: 2026-08-25
-- @description: colunas implies_pc/implies_microphone/implies_camera em vtt_platforms e communication_platforms — catalogo declara os requisitos que cada plataforma implica (spec 096, Fase 5, plan.md §Regras VTT → requisitos)

-- Regra de produto (spec 096, R3): escolher VTT/comunicacao auto-marca os
-- requisitos correspondentes e explica o porquê ao lado do requisito; o
-- mestre pode desmarcar. O mapa vive em tabela (e nao em codigo) porque os
-- catalogos ja sao dados com seed e o admin ja os edita — hardcodar um mapa
-- paralelo no front seria a "excecao por app" que o AGENTS.md trata como
-- divida.
--
-- Semente inicial (plan.md §Regras VTT → requisitos):
--   - VTT desktop → computador: Foundry VTT, Roll20, Fantasy Grounds Unity.
--   - Microfone: Discord, Microsoft Teams.
--   - Microfone + câmera: Google Meet, Zoom.
--
-- Colunas aditivas com default false: plataformas existentes (e novas, ate o
-- admin editar os flags) nao implicam nada. Migration idempotente: DDL com
-- IF NOT EXISTS e UPDATEs que apenas setam valores — segura para rodar duas
-- vezes.

ALTER TABLE vtt_platforms
  ADD COLUMN IF NOT EXISTS implies_pc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS implies_microphone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS implies_camera BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE communication_platforms
  ADD COLUMN IF NOT EXISTS implies_pc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS implies_microphone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS implies_camera BOOLEAN NOT NULL DEFAULT false;

-- VTT desktop exige computador.
UPDATE vtt_platforms
SET implies_pc = true
WHERE slug IN ('foundry-vtt', 'roll20', 'fantasy-grounds-unity');

-- Discord e Teams implicam microfone.
UPDATE communication_platforms
SET implies_microphone = true
WHERE slug IN ('discord', 'microsoft-teams');

-- Meet e Zoom implicam microfone E câmera.
UPDATE communication_platforms
SET implies_microphone = true,
    implies_camera = true
WHERE slug IN ('google-meet', 'zoom');

COMMENT ON COLUMN vtt_platforms.implies_pc IS
  'A plataforma VTT exige computador (nao funciona em mobile). Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
COMMENT ON COLUMN vtt_platforms.implies_microphone IS
  'A plataforma VTT implica requisito de microfone. Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
COMMENT ON COLUMN vtt_platforms.implies_camera IS
  'A plataforma VTT implica requisito de câmera. Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
COMMENT ON COLUMN communication_platforms.implies_pc IS
  'A plataforma de comunicacao exige computador. Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
COMMENT ON COLUMN communication_platforms.implies_microphone IS
  'A plataforma de comunicacao implica requisito de microfone (ex.: Discord, Teams, Meet, Zoom). Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
COMMENT ON COLUMN communication_platforms.implies_camera IS
  'A plataforma de comunicacao implica requisito de câmera (ex.: Meet, Zoom). Consumido pela auto-marcacao de requisitos no editor (spec 096, R3).';
