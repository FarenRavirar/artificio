-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 07: Fase B - Funcionalidades Avançadas do Parser
-- Adiciona 15 novos campos para múltiplos horários, vagas detalhadas,
-- classificações de sistema/pagamento/candidato e separação mestre/anunciante

-- ============================================================================
-- 1. MÚLTIPLOS HORÁRIOS E VAGAS DETALHADAS
-- ============================================================================

-- Array de sessões estruturadas (JSONB)
ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS sessions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN aggregator_import_candidates.sessions IS 'Array de sessões estruturadas com dia, horário, frequência e vagas por sessão';

-- Vagas detalhadas
ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS slots_total INTEGER,
ADD COLUMN IF NOT EXISTS slots_available INTEGER,
ADD COLUMN IF NOT EXISTS slots_filled INTEGER;

COMMENT ON COLUMN aggregator_import_candidates.slots_total IS 'Total de vagas da mesa';
COMMENT ON COLUMN aggregator_import_candidates.slots_available IS 'Vagas disponíveis (não preenchidas)';
COMMENT ON COLUMN aggregator_import_candidates.slots_filled IS 'Vagas já preenchidas';

-- ============================================================================
-- 2. SISTEMA DE CLASSIFICAÇÃO
-- ============================================================================

-- Classificação de sistema
ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS system_raw VARCHAR(255),
ADD COLUMN IF NOT EXISTS system_normalized VARCHAR(255),
ADD COLUMN IF NOT EXISTS system_classification VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_homebrew BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN aggregator_import_candidates.system_raw IS 'Sistema original extraído do anúncio';
COMMENT ON COLUMN aggregator_import_candidates.system_normalized IS 'Sistema normalizado (ex: D&D 5e Homebrew → D&D 5e)';
COMMENT ON COLUMN aggregator_import_candidates.system_classification IS 'Classificação: válido, inválido, revisável';
COMMENT ON COLUMN aggregator_import_candidates.is_homebrew IS 'Se o sistema é homebrew/adaptado';
COMMENT ON COLUMN aggregator_import_candidates.is_custom IS 'Se é sistema próprio/experimental';

-- Classificação de pagamento
ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS payment_classification VARCHAR(50);

COMMENT ON COLUMN aggregator_import_candidates.payment_classification IS 'Classificação de pagamento: gratuita, paga, ambígua';

-- Tipo de candidato
ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS candidate_kind VARCHAR(50);

COMMENT ON COLUMN aggregator_import_candidates.candidate_kind IS 'Tipo de candidato: mesa, grupo, anúncio múltiplo, inválido';

-- ============================================================================
-- 3. SEPARAÇÃO MESTRE VS ANUNCIANTE
-- ============================================================================

ALTER TABLE aggregator_import_candidates 
ADD COLUMN IF NOT EXISTS master_display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS recruiter_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS publisher_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_same_person BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN aggregator_import_candidates.master_display_name IS 'Nome do mestre exibido no anúncio';
COMMENT ON COLUMN aggregator_import_candidates.recruiter_name IS 'Nome de quem está publicando o anúncio';
COMMENT ON COLUMN aggregator_import_candidates.publisher_role IS 'Papel do publicador: mestre ou anunciante';
COMMENT ON COLUMN aggregator_import_candidates.is_same_person IS 'Se o mestre e o anunciante são a mesma pessoa';

-- ============================================================================
-- 4. ÍNDICES PARA BUSCA E FILTROS
-- ============================================================================

-- Índice GIN para busca em sessões (JSONB)
CREATE INDEX IF NOT EXISTS idx_candidates_sessions ON aggregator_import_candidates USING GIN(sessions);

-- Índices para vagas
CREATE INDEX IF NOT EXISTS idx_candidates_slots_available ON aggregator_import_candidates(slots_available);
CREATE INDEX IF NOT EXISTS idx_candidates_slots_total ON aggregator_import_candidates(slots_total);

-- Índices para classificações
CREATE INDEX IF NOT EXISTS idx_candidates_system_classification ON aggregator_import_candidates(system_classification);
CREATE INDEX IF NOT EXISTS idx_candidates_payment_classification ON aggregator_import_candidates(payment_classification);
CREATE INDEX IF NOT EXISTS idx_candidates_candidate_kind ON aggregator_import_candidates(candidate_kind);
CREATE INDEX IF NOT EXISTS idx_candidates_is_homebrew ON aggregator_import_candidates(is_homebrew);
CREATE INDEX IF NOT EXISTS idx_candidates_is_custom ON aggregator_import_candidates(is_custom);

-- Índice para papel do publicador
CREATE INDEX IF NOT EXISTS idx_candidates_publisher_role ON aggregator_import_candidates(publisher_role);

-- ============================================================================
-- 5. VALIDAÇÃO
-- ============================================================================

-- Verificar se as colunas foram criadas
DO $$
DECLARE
    missing_columns TEXT[];
BEGIN
    SELECT ARRAY_AGG(column_name)
    INTO missing_columns
    FROM (
        VALUES 
            ('sessions'),
            ('slots_total'),
            ('slots_available'),
            ('slots_filled'),
            ('system_raw'),
            ('system_normalized'),
            ('system_classification'),
            ('is_homebrew'),
            ('is_custom'),
            ('payment_classification'),
            ('candidate_kind'),
            ('master_display_name'),
            ('recruiter_name'),
            ('publisher_role'),
            ('is_same_person')
    ) AS expected(column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'aggregator_import_candidates'
        AND column_name = expected.column_name
    );
    
    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 07 failed: Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'Migration 07 completed successfully: All 15 columns created';
    END IF;
END $$;
