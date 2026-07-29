import { db } from '../db';

export const PUBLIC_MATERIAL_FIELDS = [
  'download_material.id',
  'download_material.slug',
  'download_material.title',
  'download_material.summary',
  'download_material.description',
  'download_material.material_type',
  'download_material.material_type_id',
  'download_material.access_kind',
  'download_material.external_url',
  'download_material.system_id',
  'download_material.edition_id',
  'download_material.creator_id',
  'download_material.editorial_state',
  'download_material.created_at',
  'download_material.updated_at',
] as const;

export const CARD_METADATA_FIELDS = [
  'download_material_metadata.cover_image_url',
  'download_material_metadata.credits',
  'download_material_metadata.authors',
  'download_material_metadata.author_keys',
  'download_material_metadata.artists',
  'download_material_metadata.publisher_name',
  'download_material_metadata.publisher_key',
  'download_material_metadata.scenario',
] as const;

/**
 * Fonte única da leitura pública por slug. A API JSON e o shell HTML usam a
 * mesma query e a mesma trava editorial; nenhum renderer pode vazar rascunho.
 */
export async function findPublishedMaterialBySlug(slug: string) {
  return db
    .selectFrom('download_material')
    .leftJoin('download_creator', (join) =>
      join.on((eb) => eb.or([
        eb('download_creator.user_id', '=', eb.ref('download_material.creator_id')),
        eb('download_creator.id', '=', eb.ref('download_material.creator_id')),
      ])),
    )
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select([...PUBLIC_MATERIAL_FIELDS, ...CARD_METADATA_FIELDS, 'download_creator.slug as creator_slug'])
    .where('download_material.slug', '=', slug)
    .where('download_material.editorial_state', '=', 'published')
    .executeTakeFirst();
}

export type PublicMaterial = NonNullable<Awaited<ReturnType<typeof findPublishedMaterialBySlug>>>;
