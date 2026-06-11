-- =============================================================================
-- GLOSSÁRIO ARTIFÍCIO RPG v2 — SEED 04 (DADOS BASE)
-- =============================================================================

-- 1. SISTEMAS E EDIÇÕES
-- -----------------------------------------------------------------------------
INSERT INTO public.systems (name, slug, description) VALUES
('Dungeons & Dragons', 'dungeons-dragons', 'O maior sistema de RPG do mundo.'),
('Pathfinder', 'pathfinder', 'Aventura fantástica épica baseada no d20.'),
('Tormenta', 'tormenta', 'O maior cenário e sistema de RPG brasileiro.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '5ª Edição (2014)', '5e' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'Edição 2024', '2024' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '2ª Edição', '2e' FROM public.systems WHERE slug = 'pathfinder'
ON CONFLICT (system_id, slug) DO NOTHING;

-- 2. CENÁRIOS
-- -----------------------------------------------------------------------------
INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Forgotten Realms', 'forgotten-realms', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Eberron', 'eberron', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug)
VALUES ('Tormenta (Arton)', 'arton')
ON CONFLICT (slug) DO NOTHING;

-- 3. CATEGORIAS (SISTEMA)
-- -----------------------------------------------------------------------------
INSERT INTO public.categories (name, slug, type, position) VALUES
('Magias', 'magias', 'sistema', 1),
('Classes', 'classes', 'sistema', 2),
('Monstros', 'monstros', 'sistema', 3),
('Regras de Combate', 'regras-combate', 'sistema', 4),
('Itens Mágicos', 'itens-magicos', 'sistema', 5),
('Condições', 'condicoes', 'sistema', 6)
ON CONFLICT (parent_id, slug) DO NOTHING;

-- 4. CATEGORIAS (CENÁRIO)
-- -----------------------------------------------------------------------------
INSERT INTO public.categories (name, slug, type, position) VALUES
('Locais', 'locais', 'cenario', 1),
('NPCs', 'npcs', 'cenario', 2),
('Acontecimentos', 'acontecimentos', 'cenario', 3),
('Organizações', 'organizacoes', 'cenario', 4),
('Lendas e Mitos', 'lendas', 'cenario', 5)
ON CONFLICT (parent_id, slug) DO NOTHING;
