-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 17: Sistema de Changelog/Atualizações
-- Criado em: 2026-04-08
-- Descrição: Tabela para registro de atualizações do sistema (changelog público)

-- Enum para tipo de atualização
CREATE TYPE update_log_type AS ENUM ('app', 'dados');

-- Tabela principal
CREATE TABLE public.update_log (
  id         UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT             NOT NULL,
  body       TEXT             NOT NULL,  -- suporta quebras de linha
  type       update_log_type  NOT NULL,
  published  BOOLEAN          NOT NULL DEFAULT false,
  created_by UUID             REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_update_log_published  ON public.update_log(published);
CREATE INDEX idx_update_log_created_at ON public.update_log(created_at DESC);

-- CORREÇÃO A03: Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.update_log
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.update_log IS 'Registro de atualizações do sistema (changelog público)';
COMMENT ON COLUMN public.update_log.title IS 'Título da atualização';
COMMENT ON COLUMN public.update_log.body IS 'Descrição detalhada (texto puro com quebras de linha)';
COMMENT ON COLUMN public.update_log.type IS 'Tipo: app (mudanças no sistema) ou dados (novos conteúdos)';
COMMENT ON COLUMN public.update_log.published IS 'Se false, apenas admins veem (rascunho)';
COMMENT ON COLUMN public.update_log.created_by IS 'Usuário admin que criou a atualização';

-- Inserir primeira atualização de exemplo
INSERT INTO public.update_log (title, body, type, published) VALUES
(
  'Melhorias de UX no Catálogo',
  'Implementamos 7 melhorias de experiência do usuário:

• Contador de resultados ("X mesas encontradas")
• Filtro automático de mesas de teste
• Truncamento de descrições longas
• Nova ordenação "Mais vagas"
• Estados visuais melhorados para selos DDAL/Covil
• Correção de erro 401 para usuários anônimos
• Links de contato corrigidos (WhatsApp, redes sociais)',
  'app',
  true
);
