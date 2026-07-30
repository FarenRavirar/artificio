import { sql } from 'kysely';
import { z } from 'zod';
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

const PUBLIC_MATERIAL_DETAIL_FIELDS = PUBLIC_MATERIAL_FIELDS.filter(
  (field) => field !== 'download_material.updated_at',
);

const effectiveUpdatedAt = sql<Date>`GREATEST(
  ${sql.ref('download_material.updated_at')},
  COALESCE(
    ${sql.ref('download_material_metadata.updated_at')},
    ${sql.ref('download_material.updated_at')}
  )
)`.as('updated_at');

const publicMaterialSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  material_type: z.string(),
  material_type_id: z.string(),
  access_kind: z.enum(['external_link', 'managed_upload']),
  external_url: z.string().nullable(),
  system_id: z.string().nullable(),
  edition_id: z.string().nullable(),
  creator_id: z.string(),
  editorial_state: z.literal('published'),
  created_at: z.date(),
  updated_at: z.date(),
  cover_image_url: z.string().nullable(),
  credits: z.string().nullable(),
  authors: z.array(z.string()).nullable(),
  author_keys: z.array(z.string()).nullable(),
  artists: z.array(z.string()).nullable(),
  publisher_name: z.string().nullable(),
  publisher_key: z.string().nullable(),
  scenario: z.string().nullable(),
  creator_slug: z.string().nullable(),
}).strict();

const publishedMaterialSlugSchema = z.object({
  slug: z.string(),
  updated_at: z.date(),
}).strict();

/**
 * Fonte única da leitura pública por slug. A API JSON e o shell HTML usam a
 * mesma query e a mesma trava editorial; nenhum renderer pode vazar rascunho.
 */
export async function findPublishedMaterialBySlug(slug: string): Promise<PublicMaterial | undefined> {
  const row: unknown = await db
    .selectFrom('download_material')
    .leftJoin('download_creator', (join) =>
      join.on((eb) => eb.or([
        eb('download_creator.user_id', '=', eb.ref('download_material.creator_id')),
        eb('download_creator.id', '=', eb.ref('download_material.creator_id')),
      ])),
    )
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select([
      ...PUBLIC_MATERIAL_DETAIL_FIELDS,
      ...CARD_METADATA_FIELDS,
      'download_creator.slug as creator_slug',
      effectiveUpdatedAt,
    ])
    .where('download_material.slug', '=', slug)
    .where('download_material.editorial_state', '=', 'published')
    .executeTakeFirst();

  return row === undefined ? undefined : publicMaterialSchema.parse(row);
}

export async function listPublishedMaterialSlugs() {
  const rows: unknown = await db
    .selectFrom('download_material')
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select(['download_material.slug as slug', effectiveUpdatedAt])
    .where('download_material.editorial_state', '=', 'published')
    .orderBy('download_material.slug', 'asc')
    .execute();

  return z.array(publishedMaterialSlugSchema).parse(rows);
}

export type PublicMaterial = z.infer<typeof publicMaterialSchema>;
