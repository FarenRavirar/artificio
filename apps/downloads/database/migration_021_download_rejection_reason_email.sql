-- @class: online-safe
-- @requires-backup: false
-- @author: spec-083
-- @created: 2026-07-23
-- @description: Schema completo de rejeicao com categoria estruturada +
--   e-mail transacional (spec 083). Cria download_rejection_category
--   (categoria configuravel via admin, com enquadramento legal BR quando
--   aplicavel; seed inicial cobre direitos autorais, plagio, link
--   quebrado/malicioso, duplicado, conteudo improprio, spam, termos de
--   terceiros, LGPD, metadados incompletos, outro), adiciona
--   rejection_category_id a download_material (FK nullable, so preenchida
--   quando editorial_state='rejected'; nunca deletada fisicamente pra
--   preservar auditoria de material ja reprovado com categoria depois
--   desativada) e cria download_email_log (audita toda tentativa de envio
--   de e-mail, sucesso ou falha; reenvio manual do MESMO evento falho
--   atualiza attempts/status/last_attempt_at na mesma linha, ver
--   services/moderationEmail.ts).

CREATE TABLE IF NOT EXISTS download_rejection_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  legal_basis TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_rejection_category_active
  ON download_rejection_category(active);

INSERT INTO download_rejection_category (slug, label, legal_basis) VALUES
  ('copyright', 'Violação de direitos autorais', 'Lei 9.610/98 — Direitos Autorais'),
  ('plagiarism', 'Plágio ou atribuição indevida', 'Lei 9.610/98 — Direitos Autorais'),
  ('broken_link', 'Link quebrado ou inacessível', NULL),
  ('malicious_link', 'Link malicioso ou inseguro', 'Marco Civil da Internet (Lei 12.965/2014), art. 19'),
  ('duplicate', 'Conteúdo duplicado no catálogo', NULL),
  ('inappropriate_content', 'Conteúdo impróprio ou faixa etária incorreta', 'Estatuto da Criança e do Adolescente (Lei 8.069/90), quando aplicável'),
  ('spam_off_topic', 'Spam ou fora do escopo da plataforma', NULL),
  ('third_party_terms', 'Violação dos termos de uso do serviço de origem do link', 'Marco Civil da Internet (Lei 12.965/2014)'),
  ('personal_data', 'Exposição indevida de dados pessoais de terceiros', 'Lei Geral de Proteção de Dados (Lei 13.709/2018)'),
  ('incomplete_metadata', 'Metadados incompletos ou inconsistentes', NULL),
  ('other', 'Outro motivo (detalhar no campo de texto)', NULL)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS rejection_category_id UUID REFERENCES download_rejection_category(id);

CREATE INDEX IF NOT EXISTS idx_download_material_rejection_category
  ON download_material(rejection_category_id);

-- Reforco defensivo (o codigo ja zera rejection_category_id em toda
-- transicao pra fora de 'rejected', ver moderation.ts) — impede escrita
-- direta/bug futuro de deixar categoria presa a material nao-rejeitado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_material_rejection_category_state_check'
  ) THEN
    ALTER TABLE download_material
      ADD CONSTRAINT download_material_rejection_category_state_check
      CHECK (rejection_category_id IS NULL OR editorial_state = 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS download_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  material_id UUID REFERENCES download_material(id) ON DELETE SET NULL,
  kind VARCHAR(40) NOT NULL CHECK (kind IN ('material_rejected', 'material_approved')),
  to_email TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_no_email')),
  provider_message_id TEXT,
  error_detail TEXT,
  attempts INT NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_email_log_material
  ON download_email_log(material_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_download_email_log_status
  ON download_email_log(status);
