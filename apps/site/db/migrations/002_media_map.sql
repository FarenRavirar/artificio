-- Migration 002 — cache de mídia WP->Cloudinary (D025/R8). Chaveado por URL (cobre featured + inline).
-- Idempotência do importador: URL já migrada não re-sobe. Dry-run não popula (mantém URL WP).
CREATE TABLE IF NOT EXISTS media_map (
  wp_url         TEXT PRIMARY KEY,
  cloudinary_url TEXT NOT NULL,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
