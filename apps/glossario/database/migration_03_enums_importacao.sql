-- =============================================================================
-- MIGRATION 03 — Enums de importação
-- Lote: sanitizacao-importacao
-- =============================================================================
-- Adiciona valores faltantes nos enums existentes:
--   • term_nucleus  ← 'artificio'  (já usado no frontend; banco rejeitava silenciosamente)
--   • term_status   ← 'aprovado'   (para hierarquia de importação)
--   • source_type   ← 'tabela'     (termos vindos de upload de planilha)
--
-- ATENÇÃO: ALTER TYPE ADD VALUE não pode ser executado dentro de uma transação
-- com rollback em PostgreSQL < 12. No PG 12+ é seguro em transação com COMMIT.
-- Executar com psql ou via migration runner que aceite DDL fora de transação.
-- =============================================================================

-- 1. Adiciona 'artificio' ao enum term_nucleus (CRÍTICO: corrige bug ativo no frontend)
ALTER TYPE public.term_nucleus ADD VALUE IF NOT EXISTS 'artificio';

-- 2. Adiciona 'aprovado' ao enum term_status
ALTER TYPE public.term_status ADD VALUE IF NOT EXISTS 'aprovado';

-- 3. Adiciona 'tabela' ao enum source_type
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'tabela';

-- Verificação (executar após migration para confirmar):
-- SELECT unnest(enum_range(NULL::public.term_nucleus));
-- SELECT unnest(enum_range(NULL::public.term_status));
-- SELECT unnest(enum_range(NULL::public.source_type));
