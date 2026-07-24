-- @class: online-safe
-- @requires-backup: false
-- @author: spec-083
-- @created: 2026-07-23
-- @description: Cria download_rejection_category (T1.1, spec 083) — categoria
--   estruturada de reprovacao, configuravel via admin (enum de banco, nao de
--   codigo), com enquadramento legal BR quando aplicavel. Seed inicial cobre
--   as categorias identificadas na pesquisa da spec (direitos autorais,
--   plagio, link quebrado/malicioso, duplicado, conteudo improprio, spam,
--   termos de terceiros, LGPD, metadados incompletos, outro).

CREATE TABLE IF NOT EXISTS download_rejection_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  legal_basis TEXT,
  email_template_key VARCHAR(60) NOT NULL DEFAULT 'generic',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_rejection_category_active
  ON download_rejection_category(active);

INSERT INTO download_rejection_category (slug, label, legal_basis, email_template_key) VALUES
  ('copyright', 'Violação de direitos autorais', 'Lei 9.610/98 — Direitos Autorais', 'rejection_generic'),
  ('plagiarism', 'Plágio ou atribuição indevida', 'Lei 9.610/98 — Direitos Autorais', 'rejection_generic'),
  ('broken_link', 'Link quebrado ou inacessível', NULL, 'rejection_generic'),
  ('malicious_link', 'Link malicioso ou inseguro', 'Marco Civil da Internet (Lei 12.965/2014), art. 19', 'rejection_generic'),
  ('duplicate', 'Conteúdo duplicado no catálogo', NULL, 'rejection_generic'),
  ('inappropriate_content', 'Conteúdo impróprio ou faixa etária incorreta', 'Estatuto da Criança e do Adolescente (Lei 8.069/90), quando aplicável', 'rejection_generic'),
  ('spam_off_topic', 'Spam ou fora do escopo da plataforma', NULL, 'rejection_generic'),
  ('third_party_terms', 'Violação dos termos de uso do serviço de origem do link', 'Marco Civil da Internet (Lei 12.965/2014)', 'rejection_generic'),
  ('personal_data', 'Exposição indevida de dados pessoais de terceiros', 'Lei Geral de Proteção de Dados (Lei 13.709/2018)', 'rejection_generic'),
  ('incomplete_metadata', 'Metadados incompletos ou inconsistentes', NULL, 'rejection_generic'),
  ('other', 'Outro motivo (detalhar no campo de texto)', NULL, 'rejection_generic')
ON CONFLICT (slug) DO NOTHING;
