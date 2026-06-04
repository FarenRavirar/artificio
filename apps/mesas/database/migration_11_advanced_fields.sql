-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 11: Campos avançados para formulário expandido
-- REQ-26: Formulário Expandido
-- Data: 05/04/2026
-- Autor: Sistema (via análise PRIORIDADES_OBVIAS.MD)

-- Adicionar 13 campos avançados à tabela tables
-- Estes campos são extraídos pelo parser Python mas não estavam representados no formulário

-- Bloco A: Identificação do mestre
ALTER TABLE tables ADD COLUMN IF NOT EXISTS master_display_name TEXT;

-- Bloco B: Detalhes da campanha
ALTER TABLE tables ADD COLUMN IF NOT EXISTS campaign_length TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS level_range TEXT;

-- Bloco D: Cobrança detalhada
ALTER TABLE tables ADD COLUMN IF NOT EXISTS billing_text TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS session_zero_free BOOLEAN DEFAULT false;

-- Bloco E: Descrições expandidas
ALTER TABLE tables ADD COLUMN IF NOT EXISTS synopsis TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS style_text TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS listing_excerpt TEXT;

-- Bloco F: Requisitos técnicos
ALTER TABLE tables ADD COLUMN IF NOT EXISTS technical_requirements TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS requires_pc BOOLEAN DEFAULT false;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS requires_camera BOOLEAN DEFAULT false;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS requires_microphone BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN tables.master_display_name IS 'Nome de exibição do mestre (pode diferir do nickname do perfil). Útil para anunciantes ou mestres com múltiplos nomes artísticos.';
COMMENT ON COLUMN tables.campaign_length IS 'Duração estimada da campanha (ex: "6 meses", "12 sessões", "Indeterminada").';
COMMENT ON COLUMN tables.level_range IS 'Faixa de nível dos personagens (ex: "1-5", "10-15", "Épico 20+").';
COMMENT ON COLUMN tables.billing_text IS 'Texto descritivo sobre cobrança (ex: "Pagamento via PIX após cada sessão", "Mensalidade com desconto para trimestre").';
COMMENT ON COLUMN tables.session_zero_free IS 'Indica se a sessão zero é gratuita (comum em mesas pagas).';
COMMENT ON COLUMN tables.synopsis IS 'Sinopse narrativa da campanha (mais longa e imersiva que description).';
COMMENT ON COLUMN tables.style_text IS 'Descrição do estilo de jogo (ex: "Roleplay pesado", "Combate tático", "Sandbox político").';
COMMENT ON COLUMN tables.listing_excerpt IS 'Resumo curto para listagens (alternativa à description para contextos específicos).';
COMMENT ON COLUMN tables.technical_requirements IS 'Requisitos técnicos detalhados (ex: "Roll20 + Discord", "Foundry VTT com módulos X, Y").';
COMMENT ON COLUMN tables.requires_pc IS 'Requer computador (não funciona em mobile).';
COMMENT ON COLUMN tables.requires_camera IS 'Requer câmera ligada durante as sessões.';
COMMENT ON COLUMN tables.requires_microphone IS 'Requer microfone funcional (obrigatório para participação).';

-- Nota: external_links será implementado como tabela separada (table_external_links) em migration futura
-- para suportar múltiplos links por mesa com labels customizados
