-- @class: online-safe
-- @requires-backup: false
-- @author: spec-099
-- @created: 2026-09-02
-- @description: mapeia role/emoji do Discord para sistema, estilo, ambientacao ou letra

-- =============================================================================
-- migration_165_discord_role_mappings.sql
--
-- Servidores usam ROLE como tag: o anuncio traz "Sistema: <@&1118328496721248347>"
-- em vez do nome. O export do Chat Exporter NAO carrega o nome da role
-- (`mentions: []` nos tres arquivos medidos em 2026-09-02), entao o id sozinho
-- nao diz nada e o parser perdia o dado — virava so a nota "Role mencionada".
--
-- O mesmo vale para emoji customizado de LETRA usado como capitular
-- (`<:emoji_15:...>ra uma vez` = "Era uma vez"): o `inlineEmojis` do export traz
-- `name: "emoji_15"`, que e opaco. Nenhum campo do arquivo diz que letra e.
--
-- Medido: 27 roles distintas em 2 servidores, e as 4 mais frequentes concentram
-- 89 ocorrencias. O cadastro e finito; o que nao pode e ficar so na cabeca do
-- mantenedor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS discord_role_mappings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Escopo: id de role e por SERVIDOR, entao o mesmo numero pode significar
  -- coisas diferentes em guilds diferentes. A unicidade e do par.
  guild_id         TEXT NOT NULL,
  -- Guarda o id CRU (so digitos), nunca o `<@&...>`: o formato do token muda
  -- entre versoes do Discord, o id nao.
  discord_id       TEXT NOT NULL,

  -- 'role' para <@&id>; 'emoji' para <:nome:id>. A tabela serve aos dois porque
  -- o problema e o mesmo: um id opaco que so o servidor de origem traduz.
  source_type      TEXT NOT NULL CHECK (source_type IN ('role', 'emoji')),

  -- O que o id SIGNIFICA. Derivado do rotulo da linha em que ele aparece
  -- ("Sistema:", "Estilo:", "Ambientacao:", "Epoca:", "Generos:") — os mesmos
  -- rotulos que o parser ja conhece, nao uma lista paralela.
  -- 'letter' e o caso do emoji capitular: `target_text` guarda a letra.
  kind             TEXT NOT NULL CHECK (kind IN ('system', 'style', 'setting', 'era', 'letter')),

  -- Alvo no catalogo, quando existe (kind='system' → systems.id).
  target_system_id UUID NULL REFERENCES systems(id) ON DELETE SET NULL,
  -- Alvo textual: nome do estilo/ambientacao/epoca, ou a LETRA (kind='letter').
  target_text      TEXT NULL,

  -- Como o vinculo nasceu. 'inferred' = o parser deduziu por co-ocorrencia
  -- (role ao lado de texto sob rotulo conhecido, ex.: "Sistema: D&D 2024 -
  -- <@&id>"); 'manual' = o mantenedor cadastrou. Manual vence inferido.
  source           TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('inferred', 'manual')),
  -- Quantas vezes a inferencia se repetiu. Uma co-ocorrencia pode ser acidente;
  -- tres em anuncios diferentes e padrao. A UI ordena a revisao por isto.
  occurrences      INT NOT NULL DEFAULT 1,
  -- Vinculo inferido so entra no parse depois de confirmado: dado errado no
  -- draft e pior que dado ausente, porque ninguem revisa o que parece certo.
  confirmed_at     TIMESTAMPTZ NULL,
  confirmed_by     UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Ultimo texto visto ao lado do id: e a evidencia que o mantenedor le na tela
  -- de revisao para decidir. Sem isto ele veria so um numero.
  last_seen_text   TEXT NULL,
  last_seen_at     TIMESTAMPTZ NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um significado por id por servidor. `ON CONFLICT` do parser depende disto
-- para incrementar `occurrences` em vez de duplicar linha.
CREATE UNIQUE INDEX IF NOT EXISTS discord_role_mappings_guild_id_uq
  ON discord_role_mappings (guild_id, discord_id);

-- Leitura quente do parser: resolve os ids de uma mensagem de uma vez.
CREATE INDEX IF NOT EXISTS discord_role_mappings_lookup_idx
  ON discord_role_mappings (guild_id, source_type, kind);

-- Fila de revisao: nao confirmados, mais frequentes primeiro.
CREATE INDEX IF NOT EXISTS discord_role_mappings_pending_idx
  ON discord_role_mappings (confirmed_at, occurrences DESC)
  WHERE confirmed_at IS NULL;

-- Alvo coerente com o tipo: sistema aponta para o catalogo, o resto e texto.
-- Sem isto um 'style' poderia carregar `target_system_id` e o parser leria o
-- campo errado sem erro nenhum.
ALTER TABLE discord_role_mappings
  DROP CONSTRAINT IF EXISTS discord_role_mappings_target_coherent;
ALTER TABLE discord_role_mappings
  -- O literal 'system' se repete aqui e no CHECK de `kind` (Sonar aponta 3 ocorrencias).
  -- Mantido de proposito: SQL nao tem constante, e extrair exigiria um DOMAIN/ENUM
  -- proprio — mudanca de schema desproporcional para evitar repetir uma palavra, que
  -- ainda por cima tornaria a leitura da constraint indireta.
  ADD CONSTRAINT discord_role_mappings_target_coherent CHECK (
    (kind = 'system' AND target_text IS NULL)
    OR (kind <> 'system' AND target_system_id IS NULL)
  );

COMMENT ON TABLE discord_role_mappings IS
  'Traduz id opaco do Discord (role usada como tag, emoji usado como capitular) para sistema/estilo/ambientacao/epoca/letra. Escopo por guild. Spec 099.';
