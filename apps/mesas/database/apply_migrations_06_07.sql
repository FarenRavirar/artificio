-- =============================================================================
-- Script consolidado de migrações para CRUD de Sistemas + Notificações
-- Execute este script no banco de dados de desenvolvimento
-- =============================================================================

-- Verificar se as tabelas já existem
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_suggestions') THEN
        RAISE NOTICE 'Tabela system_suggestions já existe, pulando criação...';
    ELSE
        RAISE NOTICE 'Criando tabela system_suggestions...';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        RAISE NOTICE 'Tabela notifications já existe, pulando criação...';
    ELSE
        RAISE NOTICE 'Criando tabela notifications...';
    END IF;
END $$;

-- =============================================================================
-- MIGRAÇÃO 06: System Suggestions
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS system_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('system', 'edition', 'variant', 'subsystem')),
  parent_id UUID REFERENCES systems(id) ON DELETE CASCADE,
  description TEXT,
  aliases TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Log de aprovação/rejeição
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Notificação (obsoleto, mantido para compatibilidade)
  user_notified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_suggestions_status ON system_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_system_suggestions_user_id ON system_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_system_suggestions_reviewed_at ON system_suggestions(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_system_suggestions_user_notified ON system_suggestions(user_notified) WHERE user_notified = FALSE;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_system_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_suggestions_updated_at ON system_suggestions;
CREATE TRIGGER trigger_update_system_suggestions_updated_at
  BEFORE UPDATE ON system_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_system_suggestions_updated_at();

COMMIT;

-- =============================================================================
-- MIGRAÇÃO 07: Notifications
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('suggestion_approved', 'suggestion_rejected', 'suggestion_edited', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

COMMIT;

-- =============================================================================
-- Verificação final
-- =============================================================================

DO $$ 
DECLARE
    suggestions_count INTEGER;
    notifications_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO suggestions_count FROM information_schema.tables WHERE table_name = 'system_suggestions';
    SELECT COUNT(*) INTO notifications_count FROM information_schema.tables WHERE table_name = 'notifications';
    
    IF suggestions_count > 0 AND notifications_count > 0 THEN
        RAISE NOTICE '✅ Migrações aplicadas com sucesso!';
        RAISE NOTICE '   - system_suggestions: OK';
        RAISE NOTICE '   - notifications: OK';
    ELSE
        RAISE WARNING '⚠️ Algumas tabelas podem não ter sido criadas corretamente';
    END IF;
END $$;