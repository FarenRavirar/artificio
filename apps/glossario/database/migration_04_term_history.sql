-- =============================================================================
-- MIGRATION 04 — Tabela term_history
-- Lote: sanitizacao-importacao
-- =============================================================================
-- Registra o histórico de alterações campo a campo em cada termo.
-- Cada linha = um campo alterado em um evento de edição ou importação.
-- =============================================================================

CREATE TABLE public.term_history (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  term_id     uuid        NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  changed_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  field       text        NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_term_history_term_id    ON public.term_history(term_id);
CREATE INDEX idx_term_history_changed_by ON public.term_history(changed_by);
CREATE INDEX idx_term_history_changed_at ON public.term_history(changed_at DESC);

COMMENT ON TABLE  public.term_history              IS 'Histórico de alterações campo a campo em termos do glossário.';
COMMENT ON COLUMN public.term_history.field        IS 'Nome do campo alterado (ex: name_en, name_pt, additional_info).';
COMMENT ON COLUMN public.term_history.old_value    IS 'Valor anterior do campo (NULL = campo era vazio ou inexistente).';
COMMENT ON COLUMN public.term_history.new_value    IS 'Novo valor do campo após a alteração.';
COMMENT ON COLUMN public.term_history.changed_by   IS 'Usuário que realizou a alteração. NULL = sistema/importação automática.';
