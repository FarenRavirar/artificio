-- @class: online-safe
-- @requires-backup: false
-- @author: sessao-26-08-22_1-mesas-cobranca
-- @created: 2026-08-22
-- @description: colunas price_value_monthly, accepts_donations e suggested_donation_value em tables — pacote mensal (adicional opcional da mesa paga) e doacoes (exclusivas de mesa gratuita)

-- Regras de produto (decididas pelo mantenedor, sessao 26-08-22_1):
--   - `price_value` (Valor Avulso) continua sendo o principal e obrigatorio para
--     mesa paga (CHECK `price_value_required`, migration_01).
--   - `price_value_monthly` e o valor individual POR SESSAO no pacote mensal.
--     Adicional, opcional, dado de entrada explicito — nunca percentual.
--   - Doacoes sao exclusivas de mesa GRATUITA: `accepts_donations` + valor
--     sugerido opcional (`suggested_donation_value`). Mesa paga nao muda.
--   - Sem CHECK de relacao entre avulso e mensal: nao obrigar mensal < avulso.
--     A economia percentual ("economize ~27%") e calculada somente na exibicao.
--   - Sem CHECK de relacao entre doacao e price_type (a regra "doacao exige
--     gratuita" e de schema, no Zod — paridade com a regra do mensal).
--   - O catalogo continua expondo so o avulso; a pagina da mesa mostra os dois
--     quando o mensal estiver preenchido. Sort por preco segue pelo avulso.

-- Colunas aditivas: mesas existentes ficam com NULL (sem pacote mensal),
-- `accepts_donations = false` e NULL (sem valor sugerido). Sem CHECK de
-- positividade no banco, seguindo o padrao de `price_value` — a validacao
-- numerica vive no Zod (z.number().min(0)).
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS price_value_monthly NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS accepts_donations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_donation_value NUMERIC(10,2);

COMMENT ON COLUMN tables.price_value_monthly IS
  'Valor individual por sessao no pacote mensal (opcional, somente mesa paga). NULL = sem pacote mensal. Nunca armazenar economia percentual: derivada em exibicao.';

COMMENT ON COLUMN tables.accepts_donations IS
  'Mesa gratuita aceita doacoes (exclusivo de price_type = gratuita; regra de schema no Zod). false por padrao.';

COMMENT ON COLUMN tables.suggested_donation_value IS
  'Valor sugerido por sessao para doacao (opcional; exige accepts_donations = true — regra de schema no Zod). NULL = sem sugestao.';
