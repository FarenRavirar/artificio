-- =============================================================================
-- GLOSSÁRIO ARTIFÍCIO RPG v2 — SEED 05: Sistemas, Edições, Cenários e Categorias
-- =============================================================================
-- Rodar manualmente no banco via: docker exec -i glossario-beta-db psql -U admin -d glossario_v2 < database/05_seed_structure.sql

-- =============================================================================
-- 1. SISTEMAS DE RPG
-- =============================================================================

INSERT INTO public.systems (name, slug, description) VALUES
  ('Dungeons & Dragons', 'dungeons-dragons', 'O maior e mais icônico sistema de RPG do mundo, pela Wizards of the Coast.'),
  ('Pathfinder', 'pathfinder', 'Sistema derivado do D&D 3.5, publicado pela Paizo Publishing.'),
  ('Tormenta', 'tormenta', 'O maior universo e sistema de RPG do Brasil, pela Jambo/Secular Games.'),
  ('Vampiro: A Máscara', 'vampiro-a-mascara', 'Jogo narrativo de horror pessoal do Mundo das Trevas, pela World of Darkness/Renegade.'),
  ('O Chamado de Cthulhu', 'chamado-de-cthulhu', 'Horror investigativo baseado na obra de H.P. Lovecraft, publicado pela Chaosium.'),
  ('GURPS', 'gurps', 'Sistema universal e genérico da Steve Jackson Games, adaptável a qualquer gênero.'),
  ('Savage Worlds', 'savage-worlds', 'Sistema de jogo rápido, furioso e divertido da Pinnacle Entertainment.'),
  ('Fate Core', 'fate-core', 'Sistema narrativo e colaborativo da Evil Hat Productions.'),
  ('Ordem Paranormal RPG', 'ordem-paranormal', 'RPG de horror e investigação criado por Cellbit, publicado pela Galápagos Jogos.'),
  ('Old Dragon', 'old-dragon', 'Sistema retroclone de RPG old school brasileiro, pela RedBox Editora.'),
  ('Shadowrun', 'shadowrun', 'Cyberpunk com fantasia, publicado pela Catalyst Game Labs.'),
  ('Starfinder', 'starfinder', 'Ficção científica e fantasia espacial da Paizo, baseado no Pathfinder.')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. EDIÇÕES POR SISTEMA
-- =============================================================================

-- Dungeons & Dragons
INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'Advanced D&D (2ª Ed.)', 'adnd-2e' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '3ª Edição / 3.5', '3-5e' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '4ª Edição', '4e' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '5ª Edição (2014)', '5e' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'Edição 2024 (One D&D)', '2024' FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Pathfinder
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '1ª Edição', '1e' FROM public.systems WHERE slug = 'pathfinder'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '2ª Edição', '2e' FROM public.systems WHERE slug = 'pathfinder'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Tormenta
INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'Tormenta 20', 't20' FROM public.systems WHERE slug = 'tormenta'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'Tormenta RPG (3ª Ed.)', '3e' FROM public.systems WHERE slug = 'tormenta'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Vampiro: A Máscara
INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'V5 (5ª Edição)', 'v5' FROM public.systems WHERE slug = 'vampiro-a-mascara'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, 'V20 (Edição Aniversário)', 'v20' FROM public.systems WHERE slug = 'vampiro-a-mascara'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Chamado de Cthulhu
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '7ª Edição', '7e' FROM public.systems WHERE slug = 'chamado-de-cthulhu'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Ordem Paranormal
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '1ª Edição', '1e' FROM public.systems WHERE slug = 'ordem-paranormal'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Old Dragon
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '2ª Edição', '2e' FROM public.systems WHERE slug = 'old-dragon'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Shadowrun
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '6ª Edição', '6e' FROM public.systems WHERE slug = 'shadowrun'
ON CONFLICT (system_id, slug) DO NOTHING;

-- Starfinder
INSERT INTO public.editions (system_id, name, slug)
SELECT id, '1ª Edição', '1e' FROM public.systems WHERE slug = 'starfinder'
ON CONFLICT (system_id, slug) DO NOTHING;

INSERT INTO public.editions (system_id, name, slug)
SELECT id, '2ª Edição', '2e' FROM public.systems WHERE slug = 'starfinder'
ON CONFLICT (system_id, slug) DO NOTHING;

-- =============================================================================
-- 3. CENÁRIOS CANÔNICOS
-- =============================================================================

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Forgotten Realms', 'forgotten-realms', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Eberron', 'eberron', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Ravenloft', 'ravenloft', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Planescape', 'planescape', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Dark Sun', 'dark-sun', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Greyhawk', 'greyhawk', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Spelljammer', 'spelljammer', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Dragonlance', 'dragonlance', id FROM public.systems WHERE slug = 'dungeons-dragons'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Golarion (Pathfinder)', 'golarion', id FROM public.systems WHERE slug = 'pathfinder'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Arton (Tormenta)', 'arton', id FROM public.systems WHERE slug = 'tormenta'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug, system_id)
SELECT 'Mundo das Trevas', 'mundo-das-trevas', id FROM public.systems WHERE slug = 'vampiro-a-mascara'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scenarios (name, slug)
VALUES ('Mythos (Cthulhu)', 'mythos')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 4. CATEGORIAS E SUBCATEGORIAS (via bloco DO para suportar NULL em parent_id)
-- =============================================================================

DO $$
DECLARE
  -- Raízes SISTEMA
  id_magias        uuid;
  id_classes       uuid;
  id_especies      uuid;
  id_monstros      uuid;
  id_itens         uuid;
  id_regras        uuid;
  id_atributos     uuid;
  id_talentos      uuid;
  id_antecedentes  uuid;
  -- Raízes CENÁRIO
  id_locais        uuid;
  id_personagens   uuid;
  id_organizacoes  uuid;
  id_historia      uuid;
  id_criatura_unica uuid;
  id_artefatos     uuid;
  id_titulos       uuid;
BEGIN
  -- =========================================================
  -- SISTEMA — Categorias Raiz
  -- =========================================================

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Magias', 'magias', 'sistema', 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='magias' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_magias FROM public.categories WHERE slug='magias' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Classes', 'classes', 'sistema', 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='classes' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_classes FROM public.categories WHERE slug='classes' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Espécies e Raças', 'especies', 'sistema', 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='especies' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_especies FROM public.categories WHERE slug='especies' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Monstros e Criaturas', 'monstros', 'sistema', 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='monstros' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_monstros FROM public.categories WHERE slug='monstros' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Itens e Equipamentos', 'itens', 'sistema', 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='itens' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_itens FROM public.categories WHERE slug='itens' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Regras e Mecânicas', 'regras', 'sistema', 6
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='regras' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_regras FROM public.categories WHERE slug='regras' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Atributos e Perícias', 'atributos', 'sistema', 7
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='atributos' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_atributos FROM public.categories WHERE slug='atributos' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Talentos e Feitos', 'talentos', 'sistema', 8
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='talentos' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_talentos FROM public.categories WHERE slug='talentos' AND type='sistema' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Antecedentes', 'antecedentes', 'sistema', 9
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='antecedentes' AND type='sistema' AND parent_id IS NULL);
  SELECT id INTO id_antecedentes FROM public.categories WHERE slug='antecedentes' AND type='sistema' AND parent_id IS NULL;

  -- =========================================================
  -- SISTEMA — Subcategorias de Magias
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Escolas de Magia', 'escolas-de-magia', 'sistema', id_magias, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='escolas-de-magia' AND parent_id=id_magias);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Truques (Cantrips)', 'truques', 'sistema', id_magias, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='truques' AND parent_id=id_magias);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Magias por Nível', 'magias-por-nivel', 'sistema', id_magias, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='magias-por-nivel' AND parent_id=id_magias);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Rituais', 'rituais', 'sistema', id_magias, 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='rituais' AND parent_id=id_magias);

  -- =========================================================
  -- SISTEMA — Subcategorias de Classes
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Arquétipos e Subclasses', 'arquetipos', 'sistema', id_classes, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='arquetipos' AND parent_id=id_classes);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Habilidades de Classe', 'habilidades-de-classe', 'sistema', id_classes, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='habilidades-de-classe' AND parent_id=id_classes);

  -- =========================================================
  -- SISTEMA — Subcategorias de Monstros
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Tipos de Criaturas', 'tipos-criaturas', 'sistema', id_monstros, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='tipos-criaturas' AND parent_id=id_monstros);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Tags de Criatura', 'tags-criatura', 'sistema', id_monstros, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='tags-criatura' AND parent_id=id_monstros);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Ações de Monstros', 'acoes-monstros', 'sistema', id_monstros, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='acoes-monstros' AND parent_id=id_monstros);

  -- =========================================================
  -- SISTEMA — Subcategorias de Itens
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Itens Mágicos', 'itens-magicos', 'sistema', id_itens, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='itens-magicos' AND parent_id=id_itens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Armas', 'armas', 'sistema', id_itens, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='armas' AND parent_id=id_itens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Armaduras e Escudos', 'armaduras', 'sistema', id_itens, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='armaduras' AND parent_id=id_itens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Equipamentos e Ferramentas', 'equipamentos', 'sistema', id_itens, 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='equipamentos' AND parent_id=id_itens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Poções e Pergaminhos', 'pocoes', 'sistema', id_itens, 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='pocoes' AND parent_id=id_itens);

  -- =========================================================
  -- SISTEMA — Subcategorias de Regras
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Ações de Combate', 'acoes-combate', 'sistema', id_regras, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='acoes-combate' AND parent_id=id_regras);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Condições', 'condicoes', 'sistema', id_regras, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='condicoes' AND parent_id=id_regras);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Terreno e Ambiente', 'terreno', 'sistema', id_regras, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='terreno' AND parent_id=id_regras);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Descanso e Recuperação', 'descanso', 'sistema', id_regras, 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='descanso' AND parent_id=id_regras);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Testes e Salvaguardas', 'testes', 'sistema', id_regras, 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='testes' AND parent_id=id_regras);

  -- =========================================================
  -- SISTEMA — Subcategorias de Atributos
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Atributos Base', 'atributos-base', 'sistema', id_atributos, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='atributos-base' AND parent_id=id_atributos);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Perícias', 'pericias', 'sistema', id_atributos, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='pericias' AND parent_id=id_atributos);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Jogadas de Resistência', 'resistencias', 'sistema', id_atributos, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='resistencias' AND parent_id=id_atributos);

  -- =========================================================
  -- CENÁRIO — Categorias Raiz
  -- =========================================================

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Locais', 'locais', 'cenario', 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='locais' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_locais FROM public.categories WHERE slug='locais' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Personagens e NPCs', 'personagens', 'cenario', 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='personagens' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_personagens FROM public.categories WHERE slug='personagens' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Organizações e Facções', 'organizacoes', 'cenario', 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='organizacoes' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_organizacoes FROM public.categories WHERE slug='organizacoes' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Eventos e História', 'historia', 'cenario', 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='historia' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_historia FROM public.categories WHERE slug='historia' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Criaturas Únicas', 'criaturas-unicas', 'cenario', 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='criaturas-unicas' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_criatura_unica FROM public.categories WHERE slug='criaturas-unicas' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Artefatos e Relíquias', 'artefatos', 'cenario', 6
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='artefatos' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_artefatos FROM public.categories WHERE slug='artefatos' AND type='cenario' AND parent_id IS NULL;

  INSERT INTO public.categories (name, slug, type, position)
  SELECT 'Títulos e Honrarias', 'titulos', 'cenario', 7
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='titulos' AND type='cenario' AND parent_id IS NULL);
  SELECT id INTO id_titulos FROM public.categories WHERE slug='titulos' AND type='cenario' AND parent_id IS NULL;

  -- =========================================================
  -- CENÁRIO — Subcategorias de Locais
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Reinos e Nações', 'reinos', 'cenario', id_locais, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='reinos' AND parent_id=id_locais);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Cidades e Vilas', 'cidades', 'cenario', id_locais, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='cidades' AND parent_id=id_locais);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Dungeons e Masmorras', 'dungeons', 'cenario', id_locais, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='dungeons' AND parent_id=id_locais);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Planos de Existência', 'planos', 'cenario', id_locais, 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='planos' AND parent_id=id_locais);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Pontos de Interesse', 'pontos-de-interesse', 'cenario', id_locais, 5
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='pontos-de-interesse' AND parent_id=id_locais);

  -- =========================================================
  -- CENÁRIO — Subcategorias de Personagens
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Heróis e Lendas', 'herois', 'cenario', id_personagens, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='herois' AND parent_id=id_personagens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Vilões e Antagonistas', 'viloes', 'cenario', id_personagens, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='viloes' AND parent_id=id_personagens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Divindades e Panteões', 'divindades', 'cenario', id_personagens, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='divindades' AND parent_id=id_personagens);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'NPCs Notáveis', 'npcs', 'cenario', id_personagens, 4
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='npcs' AND parent_id=id_personagens);

  -- =========================================================
  -- CENÁRIO — Subcategorias de Eventos
  -- =========================================================
  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Guerras e Conflitos', 'guerras', 'cenario', id_historia, 1
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='guerras' AND parent_id=id_historia);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Profecias e Mitos', 'profecias', 'cenario', id_historia, 2
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='profecias' AND parent_id=id_historia);

  INSERT INTO public.categories (name, slug, type, parent_id, position)
  SELECT 'Eventos Cósmicos', 'eventos-cosmicos', 'cenario', id_historia, 3
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug='eventos-cosmicos' AND parent_id=id_historia);

END $$;

-- =============================================================================
-- FIM DO SEED 05
-- Verificação rápida:
-- SELECT type, count(*) FROM categories GROUP BY type;
-- SELECT count(*) FROM systems;
-- SELECT count(*) FROM scenarios;
-- =============================================================================
