-- @class: online-safe
-- @requires-backup: false
-- @author: spec-088
-- @created: 2026-07-27
-- @description: Preserva o hint bruto de tipo de material quando ele nao casa contra a taxonomia central.

-- Spec 088 (T2.9d, requisito 54) — simetrico a `raw_system_hint`
-- (migration_027): quando o scraper extrai um tipo que a fonte expoe mas ele
-- NAO casa contra a taxonomia central, o valor bruto e preservado aqui em vez
-- de descartado. O material nunca perde a informacao nem finge que ela nao
-- existe, e o texto guardado e o que alimenta a triagem admin.
--
-- Sem esta coluna, o hint nao-casado so teria dois destinos possiveis: ser
-- jogado fora (perda silenciosa de dado que a fonte de fato publicou) ou ser
-- gravado no catalogo central pelo proprio scraper — o que violaria o
-- requisito 48/56, que reserva a escrita na taxonomia exclusivamente a
-- triagem admin, com humano decidindo.
--
-- Nullable por natureza: a esmagadora maioria dos itens casa ou nao traz hint
-- nenhum. Valor preenchido significa exatamente "a fonte disse um tipo que o
-- catalogo ainda nao conhece" — e a fila de trabalho da triagem.
ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS raw_material_type_hint TEXT NULL;

-- Indice parcial: a unica consulta que importa e "liste o que precisa de
-- triagem", que le so as linhas preenchidas. Indice cheio desperdicaria
-- espaco com os NULLs, que sao a maioria.
CREATE INDEX IF NOT EXISTS idx_download_material_raw_material_type_hint
  ON download_material (raw_material_type_hint)
  WHERE raw_material_type_hint IS NOT NULL;
