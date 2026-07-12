import { z } from 'zod';

export const favoriteSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  material_type: z.string(),
  created_at: z.string(),
});
export type Favorite = z.infer<typeof favoriteSchema>;

export const collectionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  slug: z.string(),
  title: z.string(),
  is_public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;

export const collectionItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  material_type: z.string(),
  added_at: z.string(),
});
export type CollectionItem = z.infer<typeof collectionItemSchema>;

export const organizationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  role: z.enum(['member', 'admin']),
});
export type Organization = z.infer<typeof organizationSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: z.string(),
  material_id: z.string().nullable(),
  body: z.string(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const materialVersionSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  field_name: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_by: z.string(),
  changed_at: z.string(),
});
export type MaterialVersion = z.infer<typeof materialVersionSchema>;

export const ratingSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  user_id: z.string(),
  score: z.number(),
  comment: z.string().nullable(),
  created_at: z.string(),
});
export type Rating = z.infer<typeof ratingSchema>;
