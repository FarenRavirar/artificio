import fs from 'fs';
import path from 'path';
import { db } from '../db';

// =============================================================================
// INTERFACES
// =============================================================================

interface SystemJSON {
  name: string;
  aliases: string[];
  editions: string[];
  variants: string[];
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================

const slugify = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// =============================================================================
// LÓGICA DE IMPORTAÇÃO
// =============================================================================

const importSystems = async () => {
  console.log('[import-sistemas] Iniciando importação de sistemas.json...');

  // Ler arquivo JSON
  const jsonPath = path.resolve(__dirname, '../../sistemas.json');
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Arquivo não encontrado: ${jsonPath}`);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const parsedSystems: unknown = JSON.parse(jsonContent);
  if (!Array.isArray(parsedSystems)) {
    throw new TypeError('sistemas.json inválido: a raiz deve ser uma lista de sistemas.');
  }
  const systems = parsedSystems as SystemJSON[];

  const hasVariants = systems.some((system, index) => {
    const variants = (system as unknown as Record<string, unknown>)?.variants;
    if (variants === undefined) return false;
    if (!Array.isArray(variants)) {
      throw new TypeError(`sistemas.json inválido: variants do item ${index} deve ser uma lista.`);
    }
    return variants.length > 0;
  });
  if (hasVariants) {
    throw new Error(
      'sistemas.json legado não informa a edição-pai de cada variante. Importação bloqueada para impedir produto cartesiano; use systems:import-tree.',
    );
  }

  console.log(`[import-sistemas] ${systems.length} sistemas encontrados no JSON.`);

  let systemsInserted = 0;
  let editionsInserted = 0;
  let aliasesInserted = 0;

  await db.transaction().execute(async (trx) => {
    for (const sys of systems) {
      // 1. INSERIR SISTEMA BASE
      const baseSlug = slugify(sys.name);
      const pathSlug = baseSlug;

      const base = await trx
        .insertInto('systems')
        .values({
          name: sys.name,
          slug: baseSlug,
          node_type: 'system',
          depth: 0,
          path_slug: pathSlug,
          parent_id: null,
        })
        .onConflict((oc) => oc.column('slug').doNothing())
        .returning(['id'])
        .executeTakeFirst();

      if (!base) {
        console.warn(`[import-sistemas] Falha ao inserir sistema base: ${sys.name}`);
        continue;
      }

      systemsInserted++;

      // 2. INSERIR ALIASES
      for (const alias of sys.aliases) {
        if (!alias || alias.trim().length === 0) continue;

        const aliasSlug = slugify(alias);
        if (!aliasSlug) continue;

        const insertedAlias = await trx
          .insertInto('system_aliases')
          .values({
            system_id: base.id,
            alias: alias.trim(),
            alias_slug: aliasSlug,
            is_official: false, // Pode ser refinado depois
          })
          .onConflict((oc) => oc.columns(['system_id', 'alias_slug']).doNothing())
          .returning(['id'])
          .executeTakeFirst();

        if (insertedAlias?.id) aliasesInserted++;
      }

      // 3. INSERIR EDIÇÕES
      if (sys.editions.length > 0) {
        for (const edition of sys.editions) {
          if (!edition || edition.trim().length === 0) continue;

          const edSlug = slugify(edition);
          const edPathSlug = `${baseSlug}/${edSlug}`;
          const edName = `${sys.name} ${edition}`;

          const ed = await trx
            .insertInto('systems')
            .values({
              name: edName,
              slug: `${baseSlug}--${edSlug}`,
              node_type: 'edition',
              depth: 1,
              path_slug: edPathSlug,
              parent_id: base.id,
            })
            .onConflict((oc) => oc.column('slug').doNothing())
            .returning(['id'])
            .executeTakeFirst();

          if (!ed) {
            console.warn(`[import-sistemas] Falha ao inserir edição: ${edName}`);
            continue;
          }

          editionsInserted++;
        }
      }
    }
  });

  console.log('[import-sistemas] Importação concluída com sucesso!');
  console.log(`- Sistemas base inseridos: ${systemsInserted}`);
  console.log(`- Edições inseridas: ${editionsInserted}`);
  console.log(`- Aliases inseridos: ${aliasesInserted}`);

  await db.destroy();
};

// =============================================================================
// EXECUÇÃO
// =============================================================================

importSystems().catch(async (error) => {
  console.error('[import-sistemas] Erro durante importação:', error);
  await db.destroy();
  process.exit(1);
});
