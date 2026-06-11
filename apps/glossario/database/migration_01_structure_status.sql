-- =============================================================================
-- GLOSSÁRIO ARTIFÍCIO RPG v2 — MIGRATION 01: Status de Moderação em Estruturas
-- =============================================================================
-- Permite que membros sugiram novos Sistemas, Cenários e Categorias
-- que precisam ser aprovados por um Admin antes de aparecer na base.

DO $$
BEGIN
  -- Adicionar status em categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='status') THEN
    ALTER TABLE public.categories ADD COLUMN status text NOT NULL DEFAULT 'aprovado';
    ALTER TABLE public.categories ADD COLUMN suggested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar status em systems
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='systems' AND column_name='status') THEN
    ALTER TABLE public.systems ADD COLUMN status text NOT NULL DEFAULT 'aprovado';
    ALTER TABLE public.systems ADD COLUMN suggested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar status em scenarios
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scenarios' AND column_name='status') THEN
    ALTER TABLE public.scenarios ADD COLUMN status text NOT NULL DEFAULT 'aprovado';
    ALTER TABLE public.scenarios ADD COLUMN suggested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Adicionar status em editions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='editions' AND column_name='status') THEN
    ALTER TABLE public.editions ADD COLUMN status text NOT NULL DEFAULT 'aprovado';
    ALTER TABLE public.editions ADD COLUMN suggested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
